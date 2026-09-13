import type { BufferGeometry } from 'three'
import { ARENA_HALF, WINDMILL_PROP } from './config'

const HOUSE_FLAT = 12
const HOUSE_BLEND = 22
const MILL_FLAT = 6
const MILL_BLEND = 14

type Mound = { x: number; z: number; h: number; r: number }

function fract(n: number): number {
  return n - Math.floor(n)
}

function hash2(x: number, z: number, salt: number): number {
  return fract(Math.sin(x * 12.9898 + z * 78.233 + salt) * 43758.5453)
}

function buildMounds(): Mound[] {
  const mounds: Mound[] = []
  const cell = 38
  const limit = ARENA_HALF - 26
  for (let z = -limit + cell * 0.45; z <= limit; z += cell) {
    for (let x = -limit + cell * 0.45; x <= limit; x += cell) {
      const n = hash2(x, z, 1.7)
      if (n < 0.28) continue
      const px = x + (hash2(x, z, 4.2) - 0.5) * cell * 0.72
      const pz = z + (hash2(z, x, 9.1) - 0.5) * cell * 0.72
      if (Math.hypot(px, pz) < 30) continue
      if (Math.hypot(px - WINDMILL_PROP.x, pz - WINDMILL_PROP.z) < 18) continue
      if (Math.max(Math.abs(px), Math.abs(pz)) > limit) continue
      mounds.push({
        x: px,
        z: pz,
        h: 1.7 + n * 2.4,
        r: 7.4 + hash2(px, pz, 13.3) * 8.8,
      })
    }
  }
  return mounds
}

const MOUNDS = buildMounds()

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

export function rawTerrainHeight(x: number, z: number): number {
  const house = 1 - smoothstep(HOUSE_FLAT, HOUSE_BLEND, Math.hypot(x, z))
  const mill = 1 - smoothstep(MILL_FLAT, MILL_BLEND, Math.hypot(x - WINDMILL_PROP.x, z - WINDMILL_PROP.z))
  const village = Math.max(house, mill)
  const edge = Math.max(Math.abs(x), Math.abs(z))
  const wall = smoothstep(ARENA_HALF - 12, ARENA_HALF, edge)
  const n =
    Math.sin(x * 0.024 + z * 0.018) * 0.36 +
    Math.sin(x * 0.013 - z * 0.016 + 1.7) * 0.26 +
    Math.sin(x * 0.052 + z * 0.041 + 0.4) * 0.12 +
    Math.sin(x * 0.008 + z * 0.011 + 4.2) * 0.22
  const raw = Math.max(0, n) + moundHeight(x, z)
  return raw * (1 - village * 0.95) * (1 - wall)
}

type GradeFn = (x: number, z: number, raw: number) => number
let gradeFn: GradeFn | null = null

export function setTerrainGrade(fn: GradeFn | null): void {
  gradeFn = fn
}

export function terrainHeight(x: number, z: number): number {
  const raw = rawTerrainHeight(x, z)
  return gradeFn ? gradeFn(x, z, raw) : raw
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
  pad = 0.55,
  start = 0.65,
  step = 0.35,
): number | null {
  for (let t = start; t <= maxDist; t += step) {
    const y = oy + dy * t
    if (y < terrainHeight(ox + dx * t, oz + dz * t) + pad) return t
  }
  return null
}
