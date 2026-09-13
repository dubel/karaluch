import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Clock,
  Color,
  DirectionalLight,
  FogExp2,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Points,
  PointsMaterial,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { BOT_RIG, PLAYER_RIG } from '../game/config'
import { applyRig, normalizeModel, stripJunk } from '../game/rig'

const CRAWL = `Jest 19 września 1939 roku. Trwa brutalna agresja niemieckiej III Rzeszy na Rzeczpospolitą. Zaledwie dwa dni temu bohaterska armia polska otrzymała śmiertelny cios w plecy — od wschodu granice przekroczyły wojska Związku Sowieckiego.

Mimo beznadziejnej sytuacji, Polacy nie składają broni. Wczoraj w leśnej potyczce pod Pociechą polska tankietka dokonała niemożliwego, niszcząc niemiecką kolumnę pancerną. W płonącym potworze Panzer IV zginął niemiecki as, książę Wiktor IV von Ratibor.

Tajemnicą tego sukcesu jest niska, zwrotna tankietka TKS, uzbrojona w zabójcze działko kalibru 20 mm. Wehrmacht pogardliwie nazywa te pojazdy „karaluchami”. Polscy czołgiści przyjęli ten przydomek z dumą — i zamierzają udowodnić, jak bolesne potrafi być ich ukąszenie.

Obejmujesz dowodzenie nad maszyną w plutonie kaprala podchorążego Edmunda Orlika. Niemiecka machina pancerna rusza właśnie do kontrataku na wieś Sieraków, próbując odciąć drogę odwrotu polskim oddziałom zmierzającym do Warszawy.

Twój cel: jak najdłużej osłaniać odwrót sojuszników. Nie pokonasz ich wszystkich — ale każda zniszczona maszyna to minuta życia dla tych, którzy idą do Warszawy.

Powodzenia, żołnierzu!`

const MARCH_OGG = new URL('../../assets/music/enemy_marches.ogg', import.meta.url).href
const MARCH_AAC = new URL('../../assets/music/enemy_marches.m4a', import.meta.url).href
const SMOKE_COUNT = 420

function marchUrl(): string {
  const probe = document.createElement('audio')
  return probe.canPlayType('audio/ogg; codecs="vorbis"') === 'probably' ? MARCH_OGG : MARCH_AAC
}

let introMusic: HTMLAudioElement | null = null

export function playIntro(): Promise<void> {
  const intro = new Intro()
  return intro.play()
}

/** Pause the crawl march. Safe to call more than once; iOS often ignores pause() outside a gesture. */
export function stopIntroMusic(): void {
  const music = introMusic
  if (!music) return
  music.loop = false
  music.muted = true
  music.volume = 0
  try {
    music.pause()
  } catch {
    /* ignore */
  }
}

/** Tear down the HTML audio element inside a user gesture so iOS releases the media session. */
export function releaseIntroMusic(): void {
  stopIntroMusic()
  const music = introMusic
  introMusic = null
  if (!music) return
  try {
    music.removeAttribute('src')
    music.src = ''
    music.load()
  } catch {
    /* ignore */
  }
  music.remove()
}

class Intro {
  private readonly root: HTMLElement
  private readonly bgCanvas: HTMLCanvasElement
  private readonly fgCanvas: HTMLCanvasElement
  private readonly bg: WebGLRenderer
  private readonly fg: WebGLRenderer
  private readonly camera: PerspectiveCamera
  private readonly bgScene = new Scene()
  private readonly fgScene = new Scene()
  private readonly clock = new Clock()
  private readonly music = new Audio(marchUrl())
  private readonly smokePos: Float32Array
  private readonly smokeVel: Float32Array
  private readonly smokePts: Points
  private readonly fires: { light: PointLight; mesh: Mesh }[] = []
  private raf = 0
  private finished = false
  private tapped = false
  private sawTouch = false
  private resolve: () => void = () => undefined

  constructor() {
    this.root = document.createElement('div')
    this.root.id = 'intro'
    this.root.innerHTML = `
      <canvas id="intro-bg"></canvas>
      <canvas id="intro-fg"></canvas>
      <div class="intro-vignette"></div>
      <div class="intro-crawl">
        <div class="intro-crawl-track">
          ${CRAWL.split('\n\n').map((p) => `<p>${p}</p>`).join('')}
        </div>
      </div>
      <p class="intro-skip">Wciśnij dowolny klawisz by pominąć</p>`
    document.getElementById('app')?.append(this.root)
    this.bgCanvas = this.root.querySelector('#intro-bg') as HTMLCanvasElement
    this.fgCanvas = this.root.querySelector('#intro-fg') as HTMLCanvasElement

    this.bg = makeRenderer(this.bgCanvas, false)
    this.fg = makeRenderer(this.fgCanvas, true)
    this.camera = new PerspectiveCamera(30, 1, 0.12, 80)
    this.camera.position.set(1.42, 0.44, 3.15)
    this.camera.lookAt(0.02, 0.5, 0.12)

    this.bgScene.background = new Color(0x1a100c)
    this.bgScene.fog = new FogExp2(0x1a100c, 0.026)
    this.fgScene.background = null

    addLights(this.bgScene)
    addLights(this.fgScene)
    const ground = new Mesh(
      new PlaneGeometry(48, 48),
      new MeshStandardMaterial({ color: 0x1c1610, roughness: 0.98, metalness: 0.02 }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    this.bgScene.add(ground)

    const smoke = makeSmoke()
    this.smokePts = smoke.points
    this.smokePos = smoke.pos
    this.smokeVel = smoke.vel
    this.bgScene.add(this.smokePts)

    this.music.loop = true
    this.music.volume = 0.44
    this.music.preload = 'auto'
    this.music.setAttribute('playsinline', '')
    this.music.setAttribute('webkit-playsinline', '')
    this.music.style.display = 'none'
    document.body.append(this.music)
    introMusic = this.music
  }

  play(): Promise<void> {
    document.body.classList.add('intro-open')
    this.resize()
    window.addEventListener('resize', this.resize)
    window.addEventListener('keydown', this.onKey)
    this.root.addEventListener('pointerup', this.onPointer)
    const track = this.root.querySelector('.intro-crawl-track')
    track?.addEventListener('animationend', () => this.finish())
    void this.music.play().catch(() => undefined)
    void this.loadModels().catch((error: unknown) => {
      console.error(error)
    })
    this.loop()
    return new Promise((resolve) => {
      this.resolve = resolve
    })
  }

  private async loadModels(): Promise<void> {
    const loader = new GLTFLoader()
    const [tksGltf, pzGltf] = await Promise.all([
      loader.loadAsync(PLAYER_RIG.url),
      loader.loadAsync(BOT_RIG.url),
    ])
    if (this.finished) return
    const tks = applyRig(tksGltf.scene, PLAYER_RIG).root
    tks.traverse((child) => {
      const mesh = child as Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true
    })
    tks.rotation.y = 0.18
    this.fgScene.add(tks)

    stripJunk(pzGltf.scene)
    const wrecks = [
      { x: -5.4, z: -3.2, yaw: 0.62, roll: 0.44, pitch: 0.1, scale: 1.55 },
      { x: 5.8, z: -4.6, yaw: -1.05, roll: -0.5, pitch: 0.16, scale: 1.85 },
      { x: 0.8, z: -10.4, yaw: 2.45, roll: 0.26, pitch: -0.14, scale: 2.2 },
    ]
    for (const spot of wrecks) {
      const wreck = pzGltf.scene.clone(true)
      normalizeModel(wreck, BOT_RIG.targetLength * spot.scale)
      charWreck(wreck)
      wreck.position.set(spot.x, 0, spot.z)
      wreck.rotation.set(spot.pitch, spot.yaw, spot.roll)
      this.bgScene.add(wreck)
      this.fires.push(makeFire(spot.x * 0.72, 1.05, spot.z + 0.55))
    }
    for (const fire of this.fires) {
      this.bgScene.add(fire.light, fire.mesh)
    }
  }

  private loop = (): void => {
    if (this.finished) return
    this.raf = requestAnimationFrame(this.loop)
    const t = this.clock.getElapsedTime()
    this.camera.position.x = 1.42 + Math.sin(t * 0.18) * 0.07
    this.camera.position.y = 0.44 + Math.sin(t * 0.14) * 0.025
    this.camera.lookAt(0.02, 0.5, 0.1)
    stepSmoke(this.smokePos, this.smokeVel)
    this.smokePts.geometry.attributes.position.needsUpdate = true
    for (const fire of this.fires) {
      const pulse = 0.65 + Math.sin(t * 9 + fire.mesh.position.x) * 0.25
      fire.light.intensity = 3.4 * pulse
      fire.mesh.scale.setScalar(1.15 + pulse * 0.45)
      fire.mesh.lookAt(this.camera.position)
    }
    this.bg.render(this.bgScene, this.camera)
    this.fg.render(this.fgScene, this.camera)
  }

  private onKey = (event: KeyboardEvent): void => {
    if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return
    if (event.key === 'Tab' || /^F\d{1,2}$/.test(event.key)) return
    this.finish()
  }

  private onPointer = (event: PointerEvent): void => {
    // iOS emits a compatibility mouse pointerup after the real touch.
    if (event.pointerType === 'mouse' && this.sawTouch) return
    if (event.pointerType === 'touch' || event.pointerType === 'pen') this.sawTouch = true
    void this.music.play().catch(() => undefined)
    if (!this.tapped) {
      this.tapped = true
      return
    }
    this.finish()
  }

  private resize = (): void => {
    const w = window.innerWidth
    const h = window.innerHeight
    this.camera.aspect = w / Math.max(h, 1)
    this.camera.updateProjectionMatrix()
    this.bg.setSize(w, h)
    this.fg.setSize(w, h)
  }

  private finish(): void {
    if (this.finished) return
    this.finished = true
    cancelAnimationFrame(this.raf)
    window.removeEventListener('resize', this.resize)
    window.removeEventListener('keydown', this.onKey)
    this.root.removeEventListener('pointerup', this.onPointer)
    stopIntroMusic()
    this.root.classList.add('intro-out')
    this.bg.dispose()
    this.fg.dispose()
    this.bgCanvas.remove()
    this.fgCanvas.remove()
    document.body.classList.remove('intro-open')
    window.setTimeout(() => {
      this.root.remove()
      this.resolve()
    }, 280)
  }
}

function makeRenderer(canvas: HTMLCanvasElement, alpha: boolean): WebGLRenderer {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: !alpha,
    alpha,
    powerPreference: 'high-performance',
  })
  renderer.outputColorSpace = SRGBColorSpace
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, alpha ? 1.5 : 1))
  renderer.shadowMap.enabled = false
  if (alpha) renderer.setClearColor(0x000000, 0)
  return renderer
}

function addLights(scene: Scene): void {
  scene.add(new HemisphereLight(0x6a5848, 0x1a0e08, 0.55))
  const key = new DirectionalLight(0xffe2c4, 1.7)
  key.position.set(3.2, 5.4, 4.2)
  key.castShadow = true
  key.shadow.mapSize.set(1024, 1024)
  scene.add(key)
  const rim = new DirectionalLight(0xff5a18, 1.35)
  rim.position.set(-2.4, 2.2, -3.5)
  scene.add(rim)
}

function charWreck(root: Object3D): void {
  root.traverse((child) => {
    const mesh = child as Mesh
    if (!mesh.isMesh) return
    const raw = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
    if (!(raw instanceof MeshStandardMaterial)) return
    const mat = raw.clone()
    mat.color.multiplyScalar(0.32)
    mat.emissive.set(0x6a2208)
    mat.emissiveIntensity = 0.95
    mat.roughness = 0.94
    mat.metalness = 0.28
    mesh.material = mat
    mesh.castShadow = true
    mesh.receiveShadow = true
  })
}

function makeFire(x: number, y: number, z: number): { light: PointLight; mesh: Mesh } {
  const light = new PointLight(0xff6a22, 3.4, 16, 1.35)
  light.position.set(x, y, z)
  const mesh = new Mesh(
    new PlaneGeometry(1.6, 2.1),
    new MeshBasicMaterial({
      map: fireTexture(),
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
  )
  mesh.position.set(x, y + 0.4, z)
  return { light, mesh }
}

function fireTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 96
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Brak canvas 2d')
  const g = ctx.createRadialGradient(32, 70, 4, 32, 40, 38)
  g.addColorStop(0, 'rgba(255, 240, 180, 0.95)')
  g.addColorStop(0.35, 'rgba(255, 110, 20, 0.7)')
  g.addColorStop(1, 'rgba(40, 8, 0, 0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 96)
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  return tex
}

function makeSmoke(): { points: Points; pos: Float32Array; vel: Float32Array } {
  const pos = new Float32Array(SMOKE_COUNT * 3)
  const vel = new Float32Array(SMOKE_COUNT * 3)
  const col = new Float32Array(SMOKE_COUNT * 3)
  for (let i = 0; i < SMOKE_COUNT; i++) {
    resetSmoke(pos, vel, i, true)
    col[i * 3] = 0.12 + Math.random() * 0.08
    col[i * 3 + 1] = 0.1 + Math.random() * 0.06
    col[i * 3 + 2] = 0.08
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(pos, 3))
  geo.setAttribute('color', new BufferAttribute(col, 3))
  const tex = circleTexture()
  const mat = new PointsMaterial({
    map: tex,
    vertexColors: true,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    blending: AdditiveBlending,
    size: 2.4,
    sizeAttenuation: true,
  })
  const points = new Points(geo, mat)
  points.frustumCulled = false
  return { points, pos, vel }
}

function resetSmoke(pos: Float32Array, vel: Float32Array, i: number, scatter: boolean): void {
  const origin = i % 3
  const ox = origin === 0 ? -3.2 : origin === 1 ? 4.6 : 0.5
  const oz = origin === 0 ? -7.0 : origin === 1 ? -9.4 : -12.8
  pos[i * 3] = ox + (Math.random() - 0.5) * 1.6
  pos[i * 3 + 1] = scatter ? Math.random() * 5.5 : 0.4
  pos[i * 3 + 2] = oz + (Math.random() - 0.5) * 1.4
  vel[i * 3] = (Math.random() - 0.5) * 0.25
  vel[i * 3 + 1] = 0.55 + Math.random() * 0.7
  vel[i * 3 + 2] = (Math.random() - 0.5) * 0.2
}

function stepSmoke(pos: Float32Array, vel: Float32Array): void {
  for (let i = 0; i < SMOKE_COUNT; i++) {
    pos[i * 3] += vel[i * 3] * 0.016
    pos[i * 3 + 1] += vel[i * 3 + 1] * 0.016
    pos[i * 3 + 2] += vel[i * 3 + 2] * 0.016
    if (pos[i * 3 + 1] > 6.2) resetSmoke(pos, vel, i, false)
  }
}

function circleTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 32
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Brak canvas 2d')
  const g = ctx.createRadialGradient(16, 16, 1, 16, 16, 15)
  g.addColorStop(0, 'rgba(90, 80, 70, 0.8)')
  g.addColorStop(1, 'rgba(20, 14, 10, 0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 32, 32)
  return new CanvasTexture(canvas)
}
