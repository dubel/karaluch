import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
} from 'three'
import { ARENA_HALF, CHAPEL_LANE } from './config'
import { rawTerrainHeight, setTerrainGrade, terrainHeight } from './terrain'

export const ROAD_HALF = 1.75
const RUT_OFFSET = 0.72
const RUT_HALF = 0.48
const TILE = 2.25
const LIFT = 0.05
const BENCH = 2.35
const SHOULDER = 9.2
const GRADE_WINDOW = 14

type Vec2 = { x: number; z: number }

type Segment = {
  ax: number
  az: number
  dx: number
  dz: number
  len: number
  along0: number
  path: number
}

type PathGrade = {
  along: number[]
  y: number[]
}

const EDGE = ARENA_HALF - 8

const TRUNK: Vec2[] = [
  { x: EDGE * 0.94, z: -EDGE * 0.94 },
  { x: 128, z: -112 },
  { x: 96, z: -80 },
  { x: 56, z: -44 },
  { x: 26, z: -20 },
  { x: 15, z: -6 },
  { x: 13, z: 8 },
  { x: 4, z: 22 },
  { x: -2, z: 34 },
]

const BRANCH_NW: Vec2[] = [
  { x: -2, z: 34 },
  { x: -30, z: 54 },
  { x: -64, z: 74 },
  { x: -96, z: 88 },
  { x: -128, z: 122 },
  { x: -EDGE, z: EDGE },
]

const BRANCH_NE: Vec2[] = [
  { x: -2, z: 34 },
  { x: 34, z: 60 },
  { x: 82, z: 102 },
  { x: 128, z: 140 },
  { x: EDGE, z: EDGE },
]

const PATHS = [TRUNK, BRANCH_NW, BRANCH_NE, CHAPEL_LANE]
const PATH_POINTS = PATHS.map((path) => resample(sampleSpline(path, 14), 0.45))
const SEGMENTS: Segment[] = []
const GRADES: PathGrade[] = []

let graded = false

export function installRoadGrade(): void {
  if (graded) return
  SEGMENTS.length = 0
  GRADES.length = 0
  for (let p = 0; p < PATH_POINTS.length; p++) {
    SEGMENTS.push(...polyline(PATH_POINTS[p], p))
    GRADES.push(buildGrade(PATH_POINTS[p]))
  }
  setTerrainGrade((x, z, raw) => {
    const hit = nearest(x, z)
    if (hit.dist >= SHOULDER) return raw
    const grade = gradeAt(hit.path, hit.along)
    const t = 1 - smooth01((hit.dist - BENCH) / (SHOULDER - BENCH))
    return raw + (grade - raw) * t
  })
  graded = true
}

export function roadDistance(x: number, z: number): number {
  return nearest(x, z).dist
}

export function createRoadMesh(map: Texture): Group {
  installRoadGrade()
  map.colorSpace = SRGBColorSpace
  map.wrapS = RepeatWrapping
  map.wrapT = RepeatWrapping
  map.anisotropy = 8
  const mat = new MeshStandardMaterial({
    map,
    roughness: 0.86,
    metalness: 0,
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  })
  const group = new Group()
  group.name = 'field-road'
  for (let p = 0; p < PATH_POINTS.length; p++) {
    const field = p === PATHS.length - 1
    const off = field ? RUT_OFFSET * 0.78 : RUT_OFFSET
    const half = field ? RUT_HALF * 0.82 : RUT_HALF
    group.add(new Mesh(buildRut(PATH_POINTS[p], -off, half), mat))
    group.add(new Mesh(buildRut(PATH_POINTS[p], off, half), mat))
  }
  return group
}

function buildGrade(points: Vec2[]): PathGrade {
  const along: number[] = [0]
  const raw: number[] = [rawTerrainHeight(points[0].x, points[0].z)]
  for (let i = 1; i < points.length; i++) {
    along.push(
      along[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z),
    )
    raw.push(rawTerrainHeight(points[i].x, points[i].z))
  }
  const y = raw.map((_, i) => {
    let wSum = 0
    let ySum = 0
    let yMin = raw[i]
    for (let j = 0; j < raw.length; j++) {
      const d = Math.abs(along[j] - along[i])
      if (d > GRADE_WINDOW) continue
      const w = 1 - d / GRADE_WINDOW
      wSum += w
      ySum += raw[j] * w
      if (raw[j] < yMin) yMin = raw[j]
    }
    const avg = ySum / Math.max(wSum, 1e-4)
    return avg * 0.42 + yMin * 0.58
  })
  return { along, y }
}

function gradeAt(path: number, along: number): number {
  const g = GRADES[path]
  if (!g || g.along.length === 0) return 0
  if (along <= g.along[0]) return g.y[0]
  const last = g.along.length - 1
  if (along >= g.along[last]) return g.y[last]
  let lo = 0
  let hi = last
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (g.along[mid] <= along) lo = mid
    else hi = mid
  }
  const span = g.along[hi] - g.along[lo]
  const t = span < 1e-4 ? 0 : (along - g.along[lo]) / span
  return g.y[lo] + (g.y[hi] - g.y[lo]) * t
}

function nearest(x: number, z: number): { dist: number; along: number; path: number } {
  let best = 1e9
  let along = 0
  let path = 0
  for (const seg of SEGMENTS) {
    const t = clamp01(((x - seg.ax) * seg.dx + (z - seg.az) * seg.dz) / (seg.len * seg.len))
    const px = seg.ax + seg.dx * t
    const pz = seg.az + seg.dz * t
    const dist = Math.hypot(x - px, z - pz)
    if (dist < best) {
      best = dist
      along = seg.along0 + t * seg.len
      path = seg.path
    }
  }
  return { dist: best, along, path }
}

function buildRut(points: Vec2[], offset: number, halfW: number): BufferGeometry {
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  let along = 0
  for (let i = 0; i < points.length; i++) {
    const prev = points[Math.max(0, i - 1)]
    const next = points[Math.min(points.length - 1, i + 1)]
    const tx = next.x - prev.x
    const tz = next.z - prev.z
    const len = Math.max(Math.hypot(tx, tz), 1e-4)
    const px = -tz / len
    const pz = tx / len
    if (i > 0) along += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z)
    const v = along / TILE
    for (const side of [-1, 1] as const) {
      const w = offset + side * halfW
      const x = points[i].x + px * w
      const z = points[i].z + pz * w
      pos.push(x, terrainHeight(x, z) + LIFT, z)
      uv.push(side < 0 ? 0 : 1, v)
    }
    if (i > 0) {
      const a = (i - 1) * 2
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  geo.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

function polyline(points: Vec2[], path: number): Segment[] {
  const segs: Segment[] = []
  let along = 0
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    const dx = b.x - a.x
    const dz = b.z - a.z
    const len = Math.hypot(dx, dz)
    if (len < 1e-4) continue
    segs.push({ ax: a.x, az: a.z, dx, dz, len, along0: along, path })
    along += len
  }
  return segs
}

function resample(points: Vec2[], spacing: number): Vec2[] {
  if (points.length < 2) return points.slice()
  const out: Vec2[] = [{ ...points[0] }]
  let carry = 0
  for (let i = 1; i < points.length; i++) {
    let ax = points[i - 1].x
    let az = points[i - 1].z
    const bx = points[i].x
    const bz = points[i].z
    let remain = Math.hypot(bx - ax, bz - az)
    if (remain < 1e-4) continue
    const dx = (bx - ax) / remain
    const dz = (bz - az) / remain
    while (carry + remain >= spacing) {
      const step = spacing - carry
      ax += dx * step
      az += dz * step
      remain -= step
      carry = 0
      out.push({ x: ax, z: az })
    }
    carry += remain
  }
  out.push({ ...points[points.length - 1] })
  return out
}

function sampleSpline(points: Vec2[], perSeg = 10): Vec2[] {
  if (points.length < 2) return points.slice()
  const padded = [points[0], ...points, points[points.length - 1]]
  const out: Vec2[] = []
  for (let i = 1; i < padded.length - 2; i++) {
    const p0 = padded[i - 1]
    const p1 = padded[i]
    const p2 = padded[i + 1]
    const p3 = padded[i + 2]
    for (let s = 0; s < perSeg; s++) out.push(catmull(p0, p1, p2, p3, s / perSeg))
  }
  out.push(points[points.length - 1])
  return out
}

function catmull(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): Vec2 {
  const t2 = t * t
  const t3 = t2 * t
  return {
    x:
      0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    z:
      0.5 *
      (2 * p1.z +
        (-p0.z + p2.z) * t +
        (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 +
        (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3),
  }
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

function smooth01(t: number): number {
  const x = clamp01(t)
  return x * x * (3 - 2 * x)
}
