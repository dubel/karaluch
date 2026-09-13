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

type Kind = 'spark' | 'smoke' | 'fire'
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
const SPARK_MAX = 260
const SMOKE_MAX = 280
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
  private readonly wrecks: { x: number; y: number; z: number; light: PointLight; t: number }[] = []
  private readonly lightPool: PointLight[] = []
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
    this.sparks.renderOrder = 4
    this.smoke.renderOrder = 3
    this.sparks.frustumCulled = false
    this.smoke.frustumCulled = false
  }

  prepare(scene: Scene): void {
    if (this.prepared) return
    this.prepared = true
    for (let i = 0; i < MAX_WRECKS; i++) {
      const light = new PointLight(0xff6a1c, 0, 14, 2)
      light.castShadow = false
      light.visible = false
      scene.add(light)
      this.lightPool.push(light)
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

  igniteWreck(at: Vector3, height: number): void {
    const light = this.lightPool.find((item) => !item.userData.lit) ?? this.recycleLight()
    if (!light) return
    light.userData.lit = true
    light.visible = true
    light.intensity = 3.2
    light.position.set(at.x, at.y + height * 0.72, at.z)
    this.wrecks.push({ x: at.x, y: at.y + height * 0.55, z: at.z, light, t: Math.random() * 8 })
  }

  douseOldest(): void {
    const wreck = this.wrecks.shift()
    if (!wreck) return
    wreck.light.intensity = 0
    wreck.light.visible = false
    wreck.light.userData.lit = false
  }

  update(dt: number): void {
    this.puffAcc += dt
    const puff = this.puffAcc > 0.12
    if (puff) this.puffAcc = 0
    for (const wreck of this.wrecks) {
      wreck.t += dt
      wreck.light.intensity = 2.4 + Math.sin(wreck.t * 2.8) * 0.9 + Math.sin(wreck.t * 6.2) * 0.35
      if (puff) {
        _puff.set(wreck.x + (Math.random() - 0.5) * 0.55, wreck.y, wreck.z + (Math.random() - 0.5) * 0.55)
        this.spawnSmoke(_puff, 1.35)
        for (let n = 0; n < 3; n++) this.spawnFire(_puff, 0.4)
      }
    }
    stepSparks(this.sparkList, this.sparkPos, this.sparkCol, dt, SPARK_MAX)
    stepSmoke(this.smokeList, this.smokePos, this.smokeCol, dt, SMOKE_MAX)
    this.sparks.geometry.attributes.position.needsUpdate = true
    this.sparks.geometry.attributes.color.needsUpdate = true
    this.smoke.geometry.attributes.position.needsUpdate = true
    this.smoke.geometry.attributes.color.needsUpdate = true
    this.sparks.geometry.setDrawRange(0, this.sparkList.length)
    this.smoke.geometry.setDrawRange(0, this.smokeList.length)
  }

  clear(): void {
    this.sparkList.length = 0
    this.smokeList.length = 0
    this.sparks.geometry.setDrawRange(0, 0)
    this.smoke.geometry.setDrawRange(0, 0)
    for (const light of this.lightPool) {
      light.intensity = 0
      light.visible = false
      light.userData.lit = false
    }
    this.wrecks.length = 0
  }

  private recycleLight(): PointLight | undefined {
    this.douseOldest()
    return this.lightPool.find((item) => !item.userData.lit)
  }

  private spawnSpark(at: Vector3, speed: number): void {
    if (this.sparkList.length >= SPARK_MAX) return
    const dir = randDir()
    this.sparkList.push({
      kind: 'spark',
      x: at.x,
      y: at.y + 0.15 + Math.random() * 0.4,
      z: at.z,
      vx: dir.x * speed,
      vy: Math.abs(dir.y) * speed * 0.7 + 2,
      vz: dir.z * speed,
      life: 0,
      max: 0.45 + Math.random() * 0.35,
      size: 0.08,
    })
  }

  private spawnFire(at: Vector3, spread: number): void {
    if (this.sparkList.length >= SPARK_MAX) return
    this.sparkList.push({
      kind: 'fire',
      x: at.x + (Math.random() - 0.5) * spread,
      y: at.y + Math.random() * 0.25,
      z: at.z + (Math.random() - 0.5) * spread,
      vx: (Math.random() - 0.5) * 0.55,
      vy: 1.6 + Math.random() * 2.4,
      vz: (Math.random() - 0.5) * 0.55,
      life: 0,
      max: 0.55 + Math.random() * 0.45,
      size: 0.22,
    })
  }

  private spawnSmoke(at: Vector3, lift: number): void {
    if (this.smokeList.length >= SMOKE_MAX) return
    const dir = randDir()
    this.smokeList.push({
      kind: 'smoke',
      x: at.x + dir.x * 0.25,
      y: at.y + 0.55 + Math.random() * 0.4,
      z: at.z + dir.z * 0.25,
      vx: dir.x * 0.45,
      vy: lift * (0.55 + Math.random() * 0.5),
      vz: dir.z * 0.45,
      life: 0,
      max: 2.6 + Math.random() * 1.6,
      size: 0.55,
    })
  }
}

function stepSparks(
  list: Particle[],
  pos: Float32Array,
  col: Float32Array,
  dt: number,
  cap: number,
): void {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i]
    p.life += dt
    if (p.life >= p.max) {
      list[i] = list[list.length - 1]
      list.pop()
      continue
    }
    if (p.kind === 'fire') {
      p.vy += 2.8 * dt
      p.vx *= Math.exp(-2.2 * dt)
      p.vz *= Math.exp(-2.2 * dt)
    } else {
      p.vy -= 18 * dt
    }
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.z += p.vz * dt
  }
  for (let i = 0; i < cap; i++) {
    const p = list[i]
    if (!p) {
      pos[i * 3 + 1] = -99
      continue
    }
    pos[i * 3] = p.x
    pos[i * 3 + 1] = p.y
    pos[i * 3 + 2] = p.z
    const t = p.life / p.max
    if (p.kind === 'fire') {
      _c.setRGB(1, 0.42 + (1 - t) * 0.5, 0.06 * (1 - t))
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
  pos: Float32Array,
  col: Float32Array,
  dt: number,
  cap: number,
): void {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i]
    p.life += dt
    if (p.life >= p.max) {
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
  for (let i = 0; i < cap; i++) {
    const p = list[i]
    if (!p) {
      pos[i * 3 + 1] = -99
      continue
    }
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
    depthTest: false,
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

function randDir(): Vector3 {
  const a = Math.random() * Math.PI * 2
  const y = Math.random() * 2 - 0.3
  return new Vector3(Math.cos(a), y, Math.sin(a)).normalize()
}
