import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DynamicDrawUsage,
  NormalBlending,
  Points,
  PointsMaterial,
  Vector3,
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

const SPARK_MAX = 180
const SMOKE_MAX = 120
const _c = new Color()

export class CombatFx {
  readonly sparks: Points
  readonly smoke: Points
  private readonly sparkList: Particle[] = []
  private readonly smokeList: Particle[] = []
  private readonly sparkPos: Float32Array
  private readonly sparkCol: Float32Array
  private readonly smokePos: Float32Array
  private readonly smokeCol: Float32Array

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

  hit(at: Vector3): void {
    for (let i = 0; i < 28; i++) this.spawnSpark(at, 5.5)
    for (let i = 0; i < 10; i++) this.spawnSmoke(at, 2.2)
  }

  muzzle(at: Vector3): void {
    for (let i = 0; i < 10; i++) this.spawnSpark(at, 4)
  }

  explode(at: Vector3): void {
    for (let i = 0; i < 48; i++) this.spawnSpark(at, 11)
    for (let i = 0; i < 22; i++) this.spawnFire(at)
    for (let i = 0; i < 26; i++) this.spawnSmoke(at, 4.2)
  }

  update(dt: number): void {
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
  }

  private spawnSpark(at: Vector3, speed: number): void {
    if (this.sparkList.length >= SPARK_MAX) this.sparkList.shift()
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

  private spawnFire(at: Vector3): void {
    if (this.sparkList.length >= SPARK_MAX) this.sparkList.shift()
    const dir = randDir()
    this.sparkList.push({
      kind: 'fire',
      x: at.x,
      y: at.y + 0.5,
      z: at.z,
      vx: dir.x * 4,
      vy: 3 + Math.random() * 5,
      vz: dir.z * 4,
      life: 0,
      max: 0.45 + Math.random() * 0.35,
      size: 0.18,
    })
  }

  private spawnSmoke(at: Vector3, lift: number): void {
    if (this.smokeList.length >= SMOKE_MAX) this.smokeList.shift()
    const dir = randDir()
    this.smokeList.push({
      kind: 'smoke',
      x: at.x + dir.x * 0.3,
      y: at.y + 0.35 + Math.random() * 0.5,
      z: at.z + dir.z * 0.3,
      vx: dir.x * 0.6,
      vy: lift * (0.5 + Math.random() * 0.6),
      vz: dir.z * 0.6,
      life: 0,
      max: 2.2 + Math.random() * 1.4,
      size: 0.4,
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
      list.splice(i, 1)
      continue
    }
    p.vy -= 18 * dt
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
      _c.setRGB(1, 0.45 + (1 - t) * 0.35, 0.08)
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
      list.splice(i, 1)
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
    size: additive ? 0.7 : 3.2,
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
