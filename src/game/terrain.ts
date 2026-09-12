import type { BufferGeometry } from 'three'
import { ARENA_HALF } from './config'

const HOUSE_FLAT = 12
const HOUSE_BLEND = 22

const MOUNDS = [
  { x: -36, z: 32, h: 3.5, r: 13 },
  { x: 40, z: 18, h: 3.0, r: 12 },
  { x: -18, z: -50, h: 3.4, r: 13 },
  { x: 54, z: -42, h: 3.8, r: 15 },
  { x: -58, z: -22, h: 2.8, r: 11 },
  { x: -50, z: 54, h: 3.3, r: 14 },
  { x: 30, z: 58, h: 2.6, r: 10 },
  { x: 14, z: -30, h: 2.3, r: 9 },
  { x: -30, z: 8, h: 2.1, r: 8.5 },
  { x: 62, z: 38, h: 3.1, r: 12 },
  { x: -64, z: -56, h: 2.9, r: 11 },
  { x: 8, z: 42, h: 1.9, r: 7.5 },
  { x: -8, z: 62, h: 2.4, r: 9 },
  { x: 46, z: -8, h: 2.2, r: 8 },
] as const

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

function moundHeight(x: number, z: number): number {
  let h = 0
  for (const mound of MOUNDS) {
    const d = Math.hypot(x - mound.x, z - mound.z) / mound.r
    if (d >= 1) continue
    const fall = 1 - d * d
    h += mound.h * fall * fall
  }
  return h
}

export function terrainHeight(x: number, z: number): number {
  const house = 1 - smoothstep(HOUSE_FLAT, HOUSE_BLEND, Math.hypot(x, z))
  const edge = Math.max(Math.abs(x), Math.abs(z))
  const wall = smoothstep(ARENA_HALF - 9, ARENA_HALF, edge)
  const n =
    Math.sin(x * 0.042 + z * 0.031) * 0.32 +
    Math.sin(x * 0.021 - z * 0.028 + 1.7) * 0.24 +
    Math.sin(x * 0.078 + z * 0.064 + 0.4) * 0.12 +
    Math.sin(x * 0.013 + z * 0.017 + 4.2) * 0.18
  const raw = Math.max(0, n) + moundHeight(x, z)
  return raw * (1 - house * 0.95) * (1 - wall)
}

export function displaceTerrain(geometry: BufferGeometry): void {
  const pos = geometry.attributes.position
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, terrainHeight(pos.getX(i), pos.getZ(i)))
  }
  pos.needsUpdate = true
  geometry.computeVertexNormals()
}

export function raycastTerrain(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  maxDist: number,
): number | null {
  const step = 0.28
  for (let t = 0.65; t <= maxDist; t += step) {
    const y = oy + dy * t
    if (y < terrainHeight(ox + dx * t, oz + dz * t) + 0.55) return t
  }
  return null
}
