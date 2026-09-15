import {
  Box3,
  BufferGeometry,
  Color,
  Group,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Vector3,
  type Scene,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { Aabb } from './collision'
import { CEMETERY, CHAPEL, CHURCH_LENGTH } from './config'
import { normalizeModel, stripJunk } from './rig'
import { terrainHeight } from './terrain'

const WALL_LENGTH = 5.5
const WALL_THICK = 0.72
const GRAVE_HEIGHT = 1.18
const _box = new Box3()
const _size = new Vector3()
const _dummy = new Object3D()

type WallPiece = {
  geometry: BufferGeometry
  material: MeshStandardMaterial
  alongZ: boolean
}

type GraveProto = {
  geometry: BufferGeometry
  material: MeshStandardMaterial
}

type Spot = { x: number; z: number; yaw: number }

export function placeChapel(
  scene: Scene,
  churchModel: Object3D,
  wallPack: Object3D,
  tombPack: Object3D,
  obstacles: Aabb[],
  cameraBlockers: Aabb[],
): void {
  placeChurch(scene, churchModel, obstacles, cameraBlockers)
  const wall = bakeWall(wallPack)
  const wallSpots = cemeteryWallSpots(wall.alongZ)
  plantWalls(scene, wall, wallSpots, obstacles, cameraBlockers)
  const graves = bakeGraves(tombPack)
  plantGraves(scene, graves, obstacles)
}

function placeChurch(
  scene: Scene,
  model: Object3D,
  obstacles: Aabb[],
  cameraBlockers: Aabb[],
): void {
  stripJunk(model)
  normalizeModel(model, CHURCH_LENGTH)
  model.rotation.y = CHAPEL.yaw
  const ground = terrainHeight(CHAPEL.x, CHAPEL.z)
  model.position.x += CHAPEL.x
  model.position.z += CHAPEL.z
  model.position.y += ground
  model.traverse((child) => {
    const mesh = child as Mesh
    if (!mesh.isMesh) return
    mesh.castShadow = true
    mesh.receiveShadow = true
  })
  scene.add(model)
  const box = new Box3().setFromObject(model)
  const cx = (box.min.x + box.max.x) * 0.5
  const cz = (box.min.z + box.max.z) * 0.5
  const hx = Math.min((box.max.x - box.min.x) * 0.5 + 0.25, 6.4)
  const hz = Math.min((box.max.z - box.min.z) * 0.5 + 0.25, 6.6)
  const aabb: Aabb = {
    minX: cx - hx,
    maxX: cx + hx,
    minZ: cz - hz,
    maxZ: cz + hz,
    minY: box.min.y,
    maxY: box.max.y + 0.4,
  }
  obstacles.push(aabb)
  cameraBlockers.push(aabb)
}

function cemeteryWallSpots(alongZ: boolean): Spot[] {
  const { x: cx, z: cz, hx, hz, gateWidth } = CEMETERY
  const north = cz + hz
  const south = cz - hz
  const west = cx - hx
  const east = cx + hx
  const yawAlongX = alongZ ? Math.PI / 2 : 0
  const yawAlongZ = alongZ ? 0 : Math.PI / 2
  const spots: Spot[] = []
  fillEdge(spots, west, north, east, north, yawAlongX)
  fillEdge(spots, west, south, east, south, yawAlongX)
  fillEdge(spots, west, south, west, north, yawAlongZ, cz, gateWidth)
  fillEdge(spots, east, south, east, north, yawAlongZ)
  return spots
}

function fillEdge(
  spots: Spot[],
  ax: number,
  az: number,
  bx: number,
  bz: number,
  yaw: number,
  gapCenter?: number,
  gapWidth?: number,
): void {
  const dx = bx - ax
  const dz = bz - az
  const len = Math.hypot(dx, dz)
  if (len < 1) return
  const ux = dx / len
  const uz = dz / len
  const alongX = Math.abs(dx) >= Math.abs(dz)
  const gapMid =
    gapCenter !== undefined ? Math.abs(gapCenter - (alongX ? ax : az)) : -1
  const spans: [number, number][] =
    gapMid >= 0 && gapWidth
      ? [
          [0, gapMid - gapWidth * 0.5],
          [gapMid + gapWidth * 0.5, len],
        ]
      : [[0, len]]
  for (const [start, end] of spans) {
    const span = end - start
    const n = Math.max(0, Math.round(span / WALL_LENGTH))
    for (let i = 0; i < n; i++) {
      const t = start + (i + 0.5) * (span / n)
      spots.push({ x: ax + ux * t, z: az + uz * t, yaw })
    }
  }
}

function plantWalls(
  scene: Scene,
  piece: WallPiece,
  spots: Spot[],
  obstacles: Aabb[],
  cameraBlockers: Aabb[],
): void {
  if (spots.length === 0) return
  const mesh = new InstancedMesh(piece.geometry, piece.material, spots.length)
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.frustumCulled = true
  for (let i = 0; i < spots.length; i++) {
    const spot = spots[i]
    _dummy.position.set(spot.x, terrainHeight(spot.x, spot.z), spot.z)
    _dummy.rotation.set(0, spot.yaw, 0)
    _dummy.scale.setScalar(1)
    _dummy.updateMatrix()
    mesh.setMatrixAt(i, _dummy.matrix)
    const hx = alongEdge(spot.yaw) ? WALL_LENGTH * 0.5 : WALL_THICK
    const hz = alongEdge(spot.yaw) ? WALL_THICK : WALL_LENGTH * 0.5
    const y = terrainHeight(spot.x, spot.z)
    const aabb: Aabb = {
      minX: spot.x - hx,
      maxX: spot.x + hx,
      minZ: spot.z - hz,
      maxZ: spot.z + hz,
      minY: y,
      maxY: y + 1.85,
    }
    obstacles.push(aabb)
    cameraBlockers.push(aabb)
  }
  mesh.instanceMatrix.needsUpdate = true
  mesh.computeBoundingSphere()
  if (mesh.boundingSphere) mesh.boundingSphere.radius += WALL_LENGTH
  mesh.name = 'CemeteryWall'
  scene.add(mesh)
}

function alongEdge(yaw: number): boolean {
  return Math.abs(Math.sin(yaw)) > 0.5
}

const GRAVE_TINTS = [
  new Color(0xf2ebe0),
  new Color(0xd9c4a0),
  new Color(0xb7bec6),
  new Color(0x8a9098),
  new Color(0x5c5852),
  new Color(0x2f3136),
  new Color(0xc4965a),
  new Color(0x8b5a3c),
  new Color(0x6f8a58),
  new Color(0x3f5a42),
  new Color(0x7a3e2e),
  new Color(0xcfd6c4),
]

const _tint = new Color()

function plantGraves(scene: Scene, protos: GraveProto[], obstacles: Aabb[]): void {
  const rng = mulberry32(0x51c3e9)
  const spots: Spot[] = []
  const { x: cx, z: cz, hx, hz } = CEMETERY
  const marginX = 2.35
  const marginZ = 2.5
  const aisle = 1.45
  const colStep = 2.05
  const rowStep = 2.55
  const x0 = cx - hx + marginX + 0.7
  const x1 = cx + hx - marginX
  const z0 = cz - hz + marginZ
  const z1 = cz + hz - marginZ
  for (let z = z0; z <= z1; z += rowStep) {
    for (let x = x0; x <= x1; x += colStep) {
      if (Math.abs(z - cz) < aisle) continue
      if (rng() < 0.08) continue
      spots.push({
        x: x + (rng() - 0.5) * 0.42,
        z: z + (rng() - 0.5) * 0.28,
        yaw: (rng() - 0.5) * 0.18,
      })
    }
  }
  const buckets: Spot[][] = protos.map(() => [])
  for (const spot of spots) {
    buckets[Math.floor(rng() * protos.length)].push(spot)
  }
  const root = new Group()
  root.name = 'CemeteryGraves'
  for (let p = 0; p < protos.length; p++) {
    const list = buckets[p]
    if (list.length === 0) continue
    const mesh = new InstancedMesh(protos[p].geometry, protos[p].material, list.length)
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.frustumCulled = true
    for (let i = 0; i < list.length; i++) {
      const spot = list[i]
      const y = terrainHeight(spot.x, spot.z)
      _dummy.position.set(spot.x, y, spot.z)
      _dummy.rotation.set(0, spot.yaw, 0)
      _dummy.scale.setScalar(1)
      _dummy.updateMatrix()
      mesh.setMatrixAt(i, _dummy.matrix)
      _tint.copy(GRAVE_TINTS[Math.floor(rng() * GRAVE_TINTS.length)])
      _tint.multiplyScalar(0.62 + rng() * 0.7)
      mesh.setColorAt(i, _tint)
      obstacles.push({
        minX: spot.x - 0.38,
        maxX: spot.x + 0.38,
        minZ: spot.z - 0.28,
        maxZ: spot.z + 0.28,
        minY: y,
        maxY: y + 1.15,
      })
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
    if (mesh.boundingSphere) mesh.boundingSphere.radius += 1.2
    root.add(mesh)
  }
  scene.add(root)
}

function bakeWall(pack: Object3D): WallPiece {
  stripJunk(pack)
  pack.updateMatrixWorld(true)
  const geos: BufferGeometry[] = []
  let material: MeshStandardMaterial | null = null
  pack.traverse((child) => {
    const mesh = child as Mesh
    if (!mesh.isMesh) return
    const geo = mesh.geometry.clone()
    geo.applyMatrix4(mesh.matrixWorld)
    geos.push(geo)
    if (material) return
    const raw = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
    material = raw instanceof MeshStandardMaterial ? raw.clone() : new MeshStandardMaterial({ color: 0x8a8680 })
    material.metalness = Math.min(material.metalness, 0.18)
    material.roughness = Math.max(material.roughness, 0.78)
  })
  if (geos.length === 0 || !material) throw new Error('Pusty murek cmentarny')
  const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false)
  if (geos.length > 1) {
    for (const geo of geos) geo.dispose()
  }
  if (!merged) throw new Error('Nie da się złożyć murku')
  merged.computeBoundingBox()
  _box.copy(merged.boundingBox ?? new Box3())
  _box.getSize(_size)
  const alongZ = _size.z >= _size.x
  const scale = WALL_LENGTH / Math.max(_size.x, _size.z, 0.001)
  merged.translate(-(_box.min.x + _box.max.x) * 0.5, -_box.min.y, -(_box.min.z + _box.max.z) * 0.5)
  merged.scale(scale, scale, scale)
  merged.computeVertexNormals()
  return { geometry: merged, material, alongZ }
}

function bakeGraves(pack: Object3D): GraveProto[] {
  stripJunk(pack)
  pack.updateMatrixWorld(true)
  const named: Object3D[] = []
  pack.traverse((obj) => {
    if ((obj as Mesh).isMesh && obj.name) named.push(obj)
  })
  const sources = named.length > 0 ? named : [pack]
  const protos: GraveProto[] = []
  for (const source of sources) {
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
      material = raw instanceof MeshStandardMaterial ? raw.clone() : new MeshStandardMaterial({ color: 0xffffff })
      material.color.set(0xffffff)
      material.metalness = Math.min(material.metalness, 0.12)
      material.roughness = Math.max(material.roughness, 0.82)
    })
    if (geos.length === 0 || !material) continue
    const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false)
    if (geos.length > 1) {
      for (const geo of geos) geo.dispose()
    }
    if (!merged) continue
    merged.computeBoundingBox()
    _box.copy(merged.boundingBox ?? new Box3())
    _box.getSize(_size)
    const scale = GRAVE_HEIGHT / Math.max(_size.y, 0.001)
    merged.translate(-(_box.min.x + _box.max.x) * 0.5, -_box.min.y, -(_box.min.z + _box.max.z) * 0.5)
    merged.scale(scale, scale, scale)
    merged.computeVertexNormals()
    protos.push({ geometry: merged, material })
  }
  if (protos.length === 0) throw new Error('Brak nagrobków w pakiecie')
  return protos
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
