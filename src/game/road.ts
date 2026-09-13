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
import { ARENA_HALF } from './config'
import { terrainHeight } from './terrain'

export const ROAD_HALF = 1.75
const RUT_OFFSET = 0.72
const RUT_HALF = 0.48
const TILE = 2.25
const LIFT = 0.045

type Vec2 = { x: number; z: number }

type Segment = {
  ax: number
  az: number
  dx: number
  dz: number
  len: number
  along0: number
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

const PATHS = [TRUNK, BRANCH_NW, BRANCH_NE]
const SEGMENTS = PATHS.flatMap((path) => polyline(sampleSpline(path)))

export function roadDistance(x: number, z: number): number {
  let best = 1e9
  for (const seg of SEGMENTS) {
    const t = clamp01(((x - seg.ax) * seg.dx + (z - seg.az) * seg.dz) / (seg.len * seg.len))
    const px = seg.ax + seg.dx * t
    const pz = seg.az + seg.dz * t
    const dist = Math.hypot(x - px, z - pz)
    if (dist < best) best = dist
  }
  return best
}

export function createRoadMesh(map: Texture): Group {
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
  for (const path of PATHS) {
    const pts = sampleSpline(path, 12)
    group.add(new Mesh(buildRut(pts, -RUT_OFFSET, RUT_HALF), mat))
    group.add(new Mesh(buildRut(pts, RUT_OFFSET, RUT_HALF), mat))
  }
  return group
}

function buildRut(points: Vec2[], offset: number, halfW: number): BufferGeometry {
  const pos: number[] = []
  const nrm: number[] = []
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
    const y = terrainHeight(points[i].x, points[i].z) + LIFT
    const v = along / TILE
    for (const side of [-1, 1] as const) {
      const w = offset + side * halfW
      pos.push(points[i].x + px * w, y, points[i].z + pz * w)
      nrm.push(0, 1, 0)
      uv.push(side < 0 ? 0 : 1, v)
    }
    if (i > 0) {
      const a = (i - 1) * 2
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  geo.setAttribute('normal', new BufferAttribute(new Float32Array(nrm), 3))
  geo.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

function polyline(points: Vec2[]): Segment[] {
  const segs: Segment[] = []
  let along = 0
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    const dx = b.x - a.x
    const dz = b.z - a.z
    const len = Math.hypot(dx, dz)
    if (len < 1e-4) continue
    segs.push({ ax: a.x, az: a.z, dx, dz, len, along0: along })
    along += len
  }
  return segs
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
