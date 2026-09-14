import {
  Box3,
  BufferGeometry,
  DoubleSide,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Vector3,
  type Scene,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { Aabb } from './collision'
import { ARENA_HALF } from './config'
import { stripJunk } from './rig'
import { terrainHeight } from './terrain'

const WIRE_LENGTH = 5.35
const HEDGEHOG_SIZE = 2.65
const WIRE_STEP = 5.05
const HOG_STEP = 7.35
const WIRE_INSET = 0.45
const HOG_INSET = 2.2
const _dummy = new Object3D()
const _size = new Vector3()
const _box = new Box3()

type Piece = {
  geometry: BufferGeometry
  material: MeshStandardMaterial
  alongZ: boolean
  wire: boolean
}

type Spot = { x: number; z: number; alongX: boolean }

export function installPerimeter(scene: Scene, pack: Object3D, obstacles: Aabb[]): void {
  stripJunk(pack)
  pack.updateMatrixWorld(true)
  const wires = [
    bakePiece(pack, 'Wire_0', WIRE_LENGTH, true),
    bakePiece(pack, 'Wire.001_4', WIRE_LENGTH, true),
  ]
  const hogs = [
    bakePiece(pack, 'Hedgehog_1', HEDGEHOG_SIZE, false),
    bakePiece(pack, 'Hedgehog.001_2', HEDGEHOG_SIZE, false),
    bakePiece(pack, 'Hedgehog.002_3', HEDGEHOG_SIZE, false),
  ]
  const rng = mulberry32(0x7a2e91)
  const wireSpots = perimeterSpots(WIRE_STEP, WIRE_INSET, rng)
  const hogSpots = perimeterSpots(HOG_STEP, HOG_INSET, rng)
  for (let i = 0; i < 4; i++) {
    hogSpots.push({
      x: (i < 2 ? -1 : 1) * (ARENA_HALF - HOG_INSET),
      z: (i % 2 === 0 ? -1 : 1) * (ARENA_HALF - HOG_INSET),
      alongX: false,
    })
  }
  plantPieces(scene, wires, wireSpots, rng)
  plantPieces(scene, hogs, hogSpots, rng)
  addRimCollision(obstacles)
  for (const spot of hogSpots) {
    const r = 1.2
    obstacles.push({
      minX: spot.x - r,
      maxX: spot.x + r,
      minZ: spot.z - r,
      maxZ: spot.z + r,
      minY: 0,
      maxY: 2.4,
    })
  }
}

function tileSpots(spots: Spot[], cell = 40): Spot[][] {
  const buckets = new Map<number, Spot[]>()
  for (const spot of spots) {
    const ix = Math.floor((spot.x + ARENA_HALF) / cell)
    const iz = Math.floor((spot.z + ARENA_HALF) / cell)
    const key = (ix + 256) | ((iz + 256) << 12)
    let list = buckets.get(key)
    if (!list) {
      list = []
      buckets.set(key, list)
    }
    list.push(spot)
  }
  return [...buckets.values()]
}

function plantPieces(scene: Scene, pieces: Piece[], spots: Spot[], rng: () => number): void {
  const buckets: Spot[][] = pieces.map(() => [])
  for (const spot of spots) {
    buckets[Math.floor(rng() * pieces.length)].push(spot)
  }
  for (let p = 0; p < pieces.length; p++) {
    const piece = pieces[p]
    for (const list of tileSpots(buckets[p])) {
      if (list.length === 0) continue
      const mesh = new InstancedMesh(piece.geometry, piece.material, list.length)
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.frustumCulled = true
      for (let i = 0; i < list.length; i++) {
        const spot = list[i]
        const yaw = piece.wire
          ? (spot.alongX === piece.alongZ ? Math.PI / 2 : 0) + (rng() - 0.5) * 0.07
          : rng() * Math.PI * 2
        _dummy.position.set(spot.x, terrainHeight(spot.x, spot.z), spot.z)
        _dummy.rotation.set(0, yaw, 0)
        _dummy.scale.setScalar(1)
        _dummy.updateMatrix()
        mesh.setMatrixAt(i, _dummy.matrix)
      }
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingSphere()
      if (mesh.boundingSphere) mesh.boundingSphere.radius += 1.2
      scene.add(mesh)
    }
  }
}

function perimeterSpots(step: number, inset: number, rng: () => number): Spot[] {
  const spots: Spot[] = []
  const inner = ARENA_HALF - inset
  const start = -ARENA_HALF + step * 0.52
  const end = ARENA_HALF - step * 0.52
  for (let along = start; along <= end; along += step) {
    const j = (rng() - 0.5) * 0.32
    spots.push({ x: along + j, z: inner, alongX: true })
    spots.push({ x: along + j * 0.7, z: -inner, alongX: true })
    spots.push({ x: inner, z: along + j, alongX: false })
    spots.push({ x: -inner, z: along + j * 0.8, alongX: false })
  }
  return spots
}

function addRimCollision(obstacles: Aabb[]): void {
  const t = 1.7
  const span = ARENA_HALF * 2 + t
  const walls = [
    { x: 0, z: ARENA_HALF, w: span, d: t },
    { x: 0, z: -ARENA_HALF, w: span, d: t },
    { x: ARENA_HALF, z: 0, w: t, d: span },
    { x: -ARENA_HALF, z: 0, w: t, d: span },
  ]
  for (const wall of walls) {
    obstacles.push({
      minX: wall.x - wall.w / 2,
      maxX: wall.x + wall.w / 2,
      minZ: wall.z - wall.d / 2,
      maxZ: wall.z + wall.d / 2,
      minY: 0,
      maxY: 2.5,
    })
  }
}

function bakePiece(root: Object3D, name: string, length: number, wire: boolean): Piece {
  const source = mustFind(root, name)
  const geos: BufferGeometry[] = []
  let material: MeshStandardMaterial | null = null
  source.traverse((child) => {
    const mesh = child as Mesh
    if (!mesh.isMesh) return
    const geo = mesh.geometry.clone()
    geo.applyMatrix4(mesh.matrixWorld)
    geos.push(geo)
    if (material) return
    const raw = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
    material = raw instanceof MeshStandardMaterial ? raw.clone() : new MeshStandardMaterial({ color: 0x6a6a68 })
    if (wire) {
      material.transparent = false
      material.alphaTest = 0.38
      material.side = DoubleSide
      material.depthWrite = true
      material.metalness = Math.max(material.metalness, 0.42)
      material.roughness = Math.min(material.roughness, 0.64)
    } else {
      material.metalness = Math.max(material.metalness, 0.74)
      material.roughness = Math.min(material.roughness, 0.46)
    }
    const maps = [material.map, material.alphaMap, material.normalMap] as const
    for (const map of maps) {
      if (map) map.anisotropy = 4
    }
  })
  if (geos.length === 0 || !material) throw new Error(`Pusty kawałek ${name}`)
  const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false)
  if (geos.length > 1) {
    for (const geo of geos) geo.dispose()
  }
  if (!merged) throw new Error(`Nie da się złożyć ${name}`)
  merged.computeBoundingBox()
  _box.copy(merged.boundingBox ?? new Box3())
  _box.getSize(_size)
  const scale = length / Math.max(_size.x, _size.z, 0.001)
  const shiftX = -(_box.min.x + _box.max.x) * 0.5
  const shiftZ = -(_box.min.z + _box.max.z) * 0.5
  merged.translate(shiftX, -_box.min.y, shiftZ)
  merged.scale(scale, scale, scale)
  merged.computeBoundingBox()
  _box.copy(merged.boundingBox ?? new Box3())
  _box.getSize(_size)
  return { geometry: merged, material, alongZ: _size.z >= _size.x, wire }
}

function mustFind(root: Object3D, name: string): Object3D {
  const found =
    root.getObjectByName(name) ??
    root.getObjectByName(name.replaceAll('.', '')) ??
    root.getObjectByName(name.replaceAll('.', '_'))
  if (found) return found
  const names: string[] = []
  root.traverse((obj) => {
    if (obj.name) names.push(obj.name)
  })
  throw new Error(`Brak ${name} w zasiekach. Są: ${names.slice(0, 24).join(', ')}`)
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}
