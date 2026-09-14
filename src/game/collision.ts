export type Aabb = {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  minY?: number
  maxY?: number
  _g?: number
}

export type ObstacleSet = Aabb[] | AabbIndex

const _nearScratch: Aabb[] = []
const _rayScratch: Aabb[] = []

function packCell(i: number, j: number): number {
  return ((i + 4096) & 8191) | (((j + 4096) & 8191) << 13)
}

/** Uniform grid over static AABBs. Large boxes occupy every overlapping cell. */
export class AabbIndex {
  private readonly cell: number
  private readonly buckets = new Map<number, Aabb[]>()
  private stamp = 1

  constructor(boxes: Aabb[], cell = 22) {
    this.cell = cell
    for (const box of boxes) {
      const minI = Math.floor(box.minX / cell)
      const maxI = Math.floor(box.maxX / cell)
      const minJ = Math.floor(box.minZ / cell)
      const maxJ = Math.floor(box.maxZ / cell)
      for (let j = minJ; j <= maxJ; j++) {
        for (let i = minI; i <= maxI; i++) {
          const k = packCell(i, j)
          let list = this.buckets.get(k)
          if (!list) {
            list = []
            this.buckets.set(k, list)
          }
          list.push(box)
        }
      }
    }
  }

  nearby(x: number, z: number, radius: number, into: Aabb[]): Aabb[] {
    into.length = 0
    const gen = this.stamp++
    if (this.stamp > 1_000_000_000) this.stamp = 1
    const c = this.cell
    const minI = Math.floor((x - radius) / c)
    const maxI = Math.floor((x + radius) / c)
    const minJ = Math.floor((z - radius) / c)
    const maxJ = Math.floor((z + radius) / c)
    for (let j = minJ; j <= maxJ; j++) {
      for (let i = minI; i <= maxI; i++) {
        const list = this.buckets.get(packCell(i, j))
        if (!list) continue
        for (const box of list) {
          if (box._g === gen) continue
          box._g = gen
          into.push(box)
        }
      }
    }
    return into
  }
}

export function obbHitsAabb(
  x: number,
  z: number,
  yaw: number,
  halfW: number,
  halfL: number,
  box: Aabb,
  padding = 0,
): boolean {
  const boxCx = (box.minX + box.maxX) * 0.5
  const boxCz = (box.minZ + box.maxZ) * 0.5
  const boxHx = (box.maxX - box.minX) * 0.5 + padding
  const boxHz = (box.maxZ - box.minZ) * 0.5 + padding
  const dx = x - boxCx
  const dz = z - boxCz
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  const absC = Math.abs(c)
  const absS = Math.abs(s)

  if (Math.abs(dx) > boxHx + halfW * absC + halfL * absS) return false
  if (Math.abs(dz) > boxHz + halfW * absS + halfL * absC) return false

  const rightX = c
  const rightZ = -s
  const fwdX = s
  const fwdZ = c

  if (Math.abs(dx * rightX + dz * rightZ) > halfW + boxHx * absC + boxHz * absS) {
    return false
  }
  if (Math.abs(dx * fwdX + dz * fwdZ) > halfL + boxHx * absS + boxHz * absC) {
    return false
  }
  return true
}

export function obbHitsObb(
  ax: number,
  az: number,
  aYaw: number,
  aHalfW: number,
  aHalfL: number,
  bx: number,
  bz: number,
  bYaw: number,
  bHalfW: number,
  bHalfL: number,
): boolean {
  const dx = ax - bx
  const dz = az - bz
  const ac = Math.cos(aYaw)
  const as = Math.sin(aYaw)
  const bc = Math.cos(bYaw)
  const bs = Math.sin(bYaw)
  if (Math.abs(dx * ac + dz * -as) > aHalfW + projExtent(bHalfW, bHalfL, ac, -as, bc, bs)) return false
  if (Math.abs(dx * as + dz * ac) > aHalfL + projExtent(bHalfW, bHalfL, as, ac, bc, bs)) return false
  if (Math.abs(dx * bc + dz * -bs) > bHalfW + projExtent(aHalfW, aHalfL, bc, -bs, ac, as)) return false
  if (Math.abs(dx * bs + dz * bc) > bHalfL + projExtent(aHalfW, aHalfL, bs, bc, ac, as)) return false
  return true
}

function projExtent(
  halfW: number,
  halfL: number,
  axisX: number,
  axisZ: number,
  c: number,
  s: number,
): number {
  return halfW * Math.abs(c * axisX + -s * axisZ) + halfL * Math.abs(s * axisX + c * axisZ)
}

function asList(x: number, z: number, radius: number, obstacles: ObstacleSet, scratch: Aabb[]): Aabb[] {
  return obstacles instanceof AabbIndex ? obstacles.nearby(x, z, radius, scratch) : obstacles
}

export function collidesAny(
  x: number,
  z: number,
  yaw: number,
  halfW: number,
  halfL: number,
  obstacles: ObstacleSet,
): boolean {
  const list = asList(x, z, Math.hypot(halfW, halfL) + 0.55, obstacles, _nearScratch)
  for (const box of list) {
    if (obbHitsAabb(x, z, yaw, halfW, halfL, box, 0.05)) return true
  }
  return false
}

export function clampToBounds(
  x: number,
  z: number,
  halfW: number,
  halfL: number,
  halfArena: number,
): { x: number; z: number } {
  const pad = Math.max(halfW, halfL)
  return {
    x: Math.min(halfArena - pad, Math.max(-halfArena + pad, x)),
    z: Math.min(halfArena - pad, Math.max(-halfArena + pad, z)),
  }
}

export function hullCoverAabb(
  x: number,
  y: number,
  z: number,
  yaw: number,
  halfW: number,
  halfL: number,
  height: number,
): Aabb {
  const c = Math.abs(Math.cos(yaw))
  const s = Math.abs(Math.sin(yaw))
  const hx = halfW * c + halfL * s
  const hz = halfW * s + halfL * c
  return {
    minX: x - hx,
    maxX: x + hx,
    minZ: z - hz,
    maxZ: z + hz,
    minY: y,
    maxY: y + height,
  }
}

export function pointHitsObb(
  px: number,
  pz: number,
  x: number,
  z: number,
  yaw: number,
  halfW: number,
  halfL: number,
): boolean {
  const dx = px - x
  const dz = pz - z
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  const localX = dx * c + dz * -s
  const localZ = dx * s + dz * c
  return Math.abs(localX) <= halfW && Math.abs(localZ) <= halfL
}

export function raycastAabb(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  maxT: number,
  box: Aabb,
): number | null {
  const minY = box.minY ?? 0
  const maxY = box.maxY ?? 6
  let tMin = 0
  let tMax = maxT

  for (let axis = 0; axis < 3; axis++) {
    const origin = axis === 0 ? ox : axis === 1 ? oy : oz
    const dir = axis === 0 ? dx : axis === 1 ? dy : dz
    const min = axis === 0 ? box.minX : axis === 1 ? minY : box.minZ
    const max = axis === 0 ? box.maxX : axis === 1 ? maxY : box.maxZ
    if (Math.abs(dir) < 1e-8) {
      if (origin < min || origin > max) return null
      continue
    }
    let t1 = (min - origin) / dir
    let t2 = (max - origin) / dir
    if (t1 > t2) {
      const swap = t1
      t1 = t2
      t2 = swap
    }
    if (t1 > tMin) tMin = t1
    if (t2 < tMax) tMax = t2
    if (tMin > tMax) return null
  }

  if (tMin > maxT) return null
  if (tMin > 0) return tMin
  if (tMax > 0) return 0
  return null
}

export function raycastObstacles(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  maxT: number,
  boxes: ObstacleSet,
): number | null {
  const rad = Math.hypot(dx * maxT, dz * maxT) * 0.5 + 1.6
  const list = asList(ox + dx * maxT * 0.5, oz + dz * maxT * 0.5, rad, boxes, _rayScratch)
  let best: number | null = null
  for (const box of list) {
    const t = raycastAabb(ox, oy, oz, dx, dy, dz, maxT, box)
    if (t !== null && (best === null || t < best)) best = t
  }
  return best
}
