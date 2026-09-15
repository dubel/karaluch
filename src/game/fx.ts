import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DynamicDrawUsage,
  NormalBlending,
  PointLight,
  Points,
  PointsMaterial,
  Vector3,
  type Scene,
} from 'three'

type Kind = 'spark' | 'smoke' | 'fire' | 'dirt' | 'splash'
type Particle = {
  kind: Kind
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  life: number
  max: number
  size: number
}

export const MAX_WRECKS = 10
const SPARK_MAX = 480
const SMOKE_MAX = 360
const FLASH_MAX = 2
const WRECK_LIGHTS = 4
const _c = new Color()
const _puff = new Vector3()

export class CombatFx {
  readonly sparks: Points
  readonly smoke: Points
  private readonly sparkList: Particle[] = []
  private readonly smokeList: Particle[] = []
  private readonly sparkPos: Float32Array
  private readonly sparkCol: Float32Array
  private readonly smokePos: Float32Array
  private readonly smokeCol: Float32Array
  private readonly wrecks: { x: number; y: number; z: number; t: number }[] = []
  private readonly lightPool: PointLight[] = []
  private readonly flashes: { light: PointLight; life: number }[] = []
  private readonly flashPool: PointLight[] = []
  private readonly sparkSpare: Particle[] = []
  private readonly smokeSpare: Particle[] = []
  private puffAcc = 0
  private prepared = false

  constructor() {
    const sparkTex = circleTexture('rgba(255,220,120,1)', 'rgba(255,80,0,0)')
    const smokeTex = circleTexture('rgba(210,200,180,0.9)', 'rgba(40,38,32,0)')
    const spark = makeCloud(SPARK_MAX, sparkTex, true)
    const smoke = makeCloud(SMOKE_MAX, smokeTex, false)
    this.sparks = spark.points
    this.smoke = smoke.points
    this.sparkPos = spark.pos
    this.sparkCol = spark.col
    this.smokePos = smoke.pos
    this.smokeCol = smoke.col
    this.sparks.renderOrder = 2
    this.smoke.renderOrder = 2
    this.sparks.frustumCulled = false
    this.smoke.frustumCulled = false
  }

  prepare(scene: Scene): void {
    if (this.prepared) return
    this.prepared = true
    for (let i = 0; i < WRECK_LIGHTS; i++) {
      const light = new PointLight(0xff6a1c, 0, 14, 2)
      light.castShadow = false
      light.visible = true
      scene.add(light)
      this.lightPool.push(light)
    }
    for (let i = 0; i < FLASH_MAX; i++) {
      const light = new PointLight(0xff7a22, 0, 22, 1.6)
      light.castShadow = false
      light.visible = true
      scene.add(light)
      this.flashPool.push(light)
    }
  }

  hit(at: Vector3): void {
    for (let i = 0; i < 28; i++) this.spawnSpark(at, 5.5)
    for (let i = 0; i < 10; i++) this.spawnSmoke(at, 2.2)
  }

  muzzle(at: Vector3): void {
    for (let i = 0; i < 10; i++) this.spawnSpark(at, 4)
  }

  explode(at: Vector3): void {
    for (let i = 0; i < 22; i++) this.spawnSpark(at, 8)
    for (let i = 0; i < 14; i++) this.spawnFire(at, 1.1)
    for (let i = 0; i < 12; i++) this.spawnSmoke(at, 3.4)
  }

  bombBurst(at: Vector3): void {
    for (let i = 0; i < 12; i++) this.spawnSpark(at, 9)
    for (let i = 0; i < 8; i++) this.spawnFire(at, 1.35)
    for (let i = 0; i < 12; i++) this.spawnDirt(at)
    for (let i = 0; i < 5; i++) this.spawnSmoke(at, 2.4, 1.05 + Math.random() * 0.7)
    this.flash(at)
  }

  wade(at: Vector3, speed: number): void {
    const n = 2 + Math.min(4, Math.floor(speed * 0.35))
    for (let i = 0; i < n; i++) this.spawnSplash(at, speed)
  }

  igniteWreck(at: Vector3, height: number): void {
    this.wrecks.push({ x: at.x, y: at.y + height * 0.55, z: at.z, t: Math.random() * 8 })
  }

  douseOldest(): void {
    this.wrecks.shift()
  }

  update(dt: number): void {
    this.puffAcc += dt
    const puff = this.puffAcc > 0.12
    if (puff) this.puffAcc = 0
    for (const wreck of this.wrecks) {
      wreck.t += dt
      if (puff) {
        _puff.set(wreck.x + (Math.random() - 0.5) * 0.55, wreck.y, wreck.z + (Math.random() - 0.5) * 0.55)
        this.spawnSmoke(_puff, 1.35)
        this.spawnFire(_puff, 0.4)
      }
    }
    for (let i = 0; i < this.lightPool.length; i++) {
      const light = this.lightPool[i]
      const wreck = this.wrecks[this.wrecks.length - 1 - i]
      if (!wreck) {
        light.intensity = 0
        continue
      }
      light.intensity = 2.4 + Math.sin(wreck.t * 2.8) * 0.9 + Math.sin(wreck.t * 6.2) * 0.35
      light.position.set(wreck.x, wreck.y + 0.18, wreck.z)
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const flash = this.flashes[i]
      flash.life -= dt
      flash.light.intensity = Math.max(0, flash.life * 48)
      if (flash.life > 0) continue
      flash.light.intensity = 0
      this.flashes.splice(i, 1)
    }
    stepSparks(this.sparkList, this.sparkSpare, this.sparkPos, this.sparkCol, dt)
    stepSmoke(this.smokeList, this.smokeSpare, this.smokePos, this.smokeCol, dt)
    const sparkN = this.sparkList.length
    const smokeN = this.smokeList.length
    if (sparkN > 0) {
      this.sparks.geometry.attributes.position.needsUpdate = true
      this.sparks.geometry.attributes.color.needsUpdate = true
    }
    if (smokeN > 0) {
      this.smoke.geometry.attributes.position.needsUpdate = true
      this.smoke.geometry.attributes.color.needsUpdate = true
    }
    this.sparks.geometry.setDrawRange(0, sparkN)
    this.smoke.geometry.setDrawRange(0, smokeN)
  }

  clear(): void {
    recycleAll(this.sparkList, this.sparkSpare)
    recycleAll(this.smokeList, this.smokeSpare)
    this.sparks.geometry.setDrawRange(0, 0)
    this.smoke.geometry.setDrawRange(0, 0)
    for (const light of this.lightPool) light.intensity = 0
    this.wrecks.length = 0
    for (const flash of this.flashes) flash.light.intensity = 0
    this.flashes.length = 0
  }

  private flash(at: Vector3): void {
    let light: PointLight | undefined
    for (const item of this.flashPool) {
      let busy = false
      for (const flash of this.flashes) {
        if (flash.light === item) {
          busy = true
          break
        }
      }
      if (!busy) {
        light = item
        break
      }
    }
    if (!light) {
      const oldest = this.flashes.shift()
      light = oldest?.light ?? this.flashPool[0]
    }
    if (!light) return
    light.intensity = 14
    light.position.set(at.x, at.y + 1.4, at.z)
    this.flashes.push({ light, life: 0.22 })
  }

  private spawnSpark(at: Vector3, speed: number): void {
    const p = takeParticle(this.sparkList, this.sparkSpare, SPARK_MAX)
    if (!p) return
    const dir = randDir()
    p.kind = 'spark'
    p.x = at.x
    p.y = at.y + 0.15 + Math.random() * 0.4
    p.z = at.z
    p.vx = dir.x * speed
    p.vy = Math.abs(dir.y) * speed * 0.7 + 2
    p.vz = dir.z * speed
    p.life = 0
    p.max = 0.45 + Math.random() * 0.35
    p.size = 0.08
  }

  private spawnFire(at: Vector3, spread: number): void {
    const p = takeParticle(this.sparkList, this.sparkSpare, SPARK_MAX)
    if (!p) return
    p.kind = 'fire'
    p.x = at.x + (Math.random() - 0.5) * spread
    p.y = at.y + Math.random() * 0.25
    p.z = at.z + (Math.random() - 0.5) * spread
    p.vx = (Math.random() - 0.5) * 0.55
    p.vy = 1.6 + Math.random() * 2.4
    p.vz = (Math.random() - 0.5) * 0.55
    p.life = 0
    p.max = 0.55 + Math.random() * 0.45
    p.size = 0.22
  }

  private spawnSmoke(at: Vector3, lift: number, maxLife?: number): void {
    const p = takeParticle(this.smokeList, this.smokeSpare, SMOKE_MAX)
    if (!p) return
    const dir = randDir()
    p.kind = 'smoke'
    p.x = at.x + dir.x * 0.25
    p.y = at.y + 0.55 + Math.random() * 0.4
    p.z = at.z + dir.z * 0.25
    p.vx = dir.x * 0.45
    p.vy = lift * (0.55 + Math.random() * 0.5)
    p.vz = dir.z * 0.45
    p.life = 0
    p.max = maxLife ?? 2.6 + Math.random() * 1.6
    p.size = 0.55
  }

  private spawnDirt(at: Vector3): void {
    const p = takeParticle(this.sparkList, this.sparkSpare, SPARK_MAX)
    if (!p) return
    const dir = randDir()
    const speed = 6 + Math.random() * 9
    p.kind = 'dirt'
    p.x = at.x + dir.x * 0.35
    p.y = at.y + 0.2
    p.z = at.z + dir.z * 0.35
    p.vx = dir.x * speed
    p.vy = 5 + Math.random() * 10
    p.vz = dir.z * speed
    p.life = 0
    p.max = 0.7 + Math.random() * 1.2
    p.size = 0.18
  }

  private spawnSplash(at: Vector3, speed: number): void {
    const p = takeParticle(this.sparkList, this.sparkSpare, SPARK_MAX)
    if (!p) return
    const dir = randDir()
    const v = 2.4 + speed * 0.45 + Math.random() * 2.2
    p.kind = 'splash'
    p.x = at.x + dir.x * 0.18
    p.y = at.y
    p.z = at.z + dir.z * 0.18
    p.vx = dir.x * v * 0.55
    p.vy = 2.8 + Math.random() * 3.4
    p.vz = dir.z * v * 0.55
    p.life = 0
    p.max = 0.28 + Math.random() * 0.28
    p.size = 0.14
  }
}

function takeParticle(list: Particle[], spare: Particle[], cap: number): Particle | null {
  if (list.length >= cap) return null
  const p = spare.pop() ?? {
    kind: 'spark' as Kind,
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    life: 0,
    max: 1,
    size: 0.1,
  }
  list.push(p)
  return p
}

function recycleAll(list: Particle[], spare: Particle[]): void {
  for (const p of list) spare.push(p)
  list.length = 0
}

function stepSparks(
  list: Particle[],
  spare: Particle[],
  pos: Float32Array,
  col: Float32Array,
  dt: number,
): void {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i]
    p.life += dt
    if (p.life >= p.max) {
      spare.push(p)
      list[i] = list[list.length - 1]
      list.pop()
      continue
    }
    if (p.kind === 'fire') {
      p.vy += 2.8 * dt
      p.vx *= Math.exp(-2.2 * dt)
      p.vz *= Math.exp(-2.2 * dt)
    } else if (p.kind === 'dirt') {
      p.vy -= 28 * dt
      p.vx *= Math.exp(-1.4 * dt)
      p.vz *= Math.exp(-1.4 * dt)
    } else if (p.kind === 'splash') {
      p.vy -= 26 * dt
      p.vx *= Math.exp(-1.8 * dt)
      p.vz *= Math.exp(-1.8 * dt)
    } else {
      p.vy -= 18 * dt
    }
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.z += p.vz * dt
  }
  for (let i = 0; i < list.length; i++) {
    const p = list[i]
    pos[i * 3] = p.x
    pos[i * 3 + 1] = p.y
    pos[i * 3 + 2] = p.z
    const t = p.life / p.max
    if (p.kind === 'fire') {
      _c.setRGB(1, 0.42 + (1 - t) * 0.5, 0.06 * (1 - t))
    } else if (p.kind === 'dirt') {
      const fade = 1 - t
      _c.setRGB(0.42 * fade, 0.26 * fade, 0.1 * fade)
    } else if (p.kind === 'splash') {
      const fade = 1 - t
      _c.setRGB(0.62 * fade, 0.82 * fade, 0.88 * fade)
    } else {
      _c.setRGB(1, 0.7 - t * 0.4, 0.15)
    }
    col[i * 3] = _c.r
    col[i * 3 + 1] = _c.g
    col[i * 3 + 2] = _c.b
  }
}

function stepSmoke(
  list: Particle[],
  spare: Particle[],
  pos: Float32Array,
  col: Float32Array,
  dt: number,
): void {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i]
    p.life += dt
    if (p.life >= p.max) {
      spare.push(p)
      list[i] = list[list.length - 1]
      list.pop()
      continue
    }
    p.vx *= 0.96
    p.vz *= 0.96
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.z += p.vz * dt
  }
  for (let i = 0; i < list.length; i++) {
    const p = list[i]
    pos[i * 3] = p.x
    pos[i * 3 + 1] = p.y
    pos[i * 3 + 2] = p.z
    const t = p.life / p.max
    const a = 1 - t
    col[i * 3] = 0.42 * a
    col[i * 3 + 1] = 0.4 * a
    col[i * 3 + 2] = 0.36 * a
  }
}

function makeCloud(count: number, map: CanvasTexture, additive: boolean): {
  points: Points
  pos: Float32Array
  col: Float32Array
} {
  const pos = new Float32Array(count * 3)
  const col = new Float32Array(count * 3)
  const geo = new BufferGeometry()
  const posAttr = new BufferAttribute(pos, 3)
  posAttr.setUsage(DynamicDrawUsage)
  const colAttr = new BufferAttribute(col, 3)
  colAttr.setUsage(DynamicDrawUsage)
  geo.setAttribute('position', posAttr)
  geo.setAttribute('color', colAttr)
  geo.setDrawRange(0, 0)
  const mat = new PointsMaterial({
    map,
    size: additive ? 1.15 : 3.2,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    sizeAttenuation: true,
    blending: additive ? AdditiveBlending : NormalBlending,
    opacity: additive ? 1 : 0.85,
    toneMapped: false,
    alphaTest: 0.02,
  })
  return { points: new Points(geo, mat), pos, col }
}

function circleTexture(inner: string, outer: string): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 64
  const g = c.getContext('2d')
  if (!g) throw new Error('Brak canvas 2d')
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30)
  grd.addColorStop(0, inner)
  grd.addColorStop(1, outer)
  g.fillStyle = grd
  g.fillRect(0, 0, 64, 64)
  const tex = new CanvasTexture(c)
  tex.needsUpdate = true
  return tex
}

const _rand = new Vector3()

function randDir(): Vector3 {
  const a = Math.random() * Math.PI * 2
  const y = Math.random() * 2 - 0.3
  return _rand.set(Math.cos(a), y, Math.sin(a)).normalize()
}
