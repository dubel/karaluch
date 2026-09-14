import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  Color,
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
import { ARENA_HALF, BOT_SPAWN, PLAYER_SPAWN, TREE_HEIGHT, WINDMILL_PROP, WORKSHOP, WORKSHOP_RADIUS } from './config'
import { roadDistance } from './road'
import { stripJunk } from './rig'
import { terrainHeight } from './terrain'

export type WindClock = {
  value: number
  strength: { value: number }
  dirX: { value: number }
  dirZ: { value: number }
}

type ProtoPart = {
  geometry: BufferGeometry
  material: MeshStandardMaterial
}

type Proto = {
  name: string
  parts: ProtoPart[]
}

type Spot = {
  x: number
  z: number
  yaw: number
  scale: number
}

const _box = new Box3()
const _size = new Vector3()
const _dummy = new Object3D()
const _up = new Vector3(0, 1, 0)
const _normal = new Vector3()
const _color = new Color()

const TREE_NAMES = [
  'tree-stylized-01',
  'tree-stylized-04-green',
  'tree-stylized-05-autumn-brown',
  'tree-stylized-03-autumn-yellow',
  'tree-stylized-02-dry',
] as const

const FLOWER_NAMES = [
  'daisy-flower-diffuse-01',
  'daisy-flower-diffuse-02',
  'daisy-flower-diffuse-03',
  'daffodil-flower-01',
  'daffodil-flower-02',
] as const

export function sowFoliage(
  scene: Scene,
  foliagePack: Object3D,
  grassPack: Object3D,
  obstacles: Aabb[],
  cameraBlockers: Aabb[],
  cover: Aabb[],
  wind: WindClock,
): void {
  stripJunk(foliagePack)
  stripJunk(grassPack)
  foliagePack.updateMatrixWorld(true)
  grassPack.updateMatrixWorld(true)

  const trees = TREE_NAMES.map((name) =>
    bakeProto(mustFind(foliagePack, name), name, { targetHeight: TREE_HEIGHT, wind: 0.018 }),
  )
  const tuft = bakeProto(mustFind(foliagePack, 'grass-bushes-01'), 'grass-bushes-01', {
    targetHeight: 0.85,
    wind: 0.11,
  })
  const bush = bakeProto(mustFind(foliagePack, 'grass-bushes-02'), 'grass-bushes-02', {
    targetHeight: 1.55,
    wind: 0.07,
  })
  const plantGreen = bakeProto(mustFind(foliagePack, 'plant-ground-green-01'), 'plant-ground-green-01', {
    targetHeight: 0.55,
    wind: 0.05,
  })
  const plantBrown = bakeProto(mustFind(foliagePack, 'plant-ground-brown-02'), 'plant-ground-brown-02', {
    targetHeight: 0.5,
    wind: 0.05,
  })
  const flowers = FLOWER_NAMES.map((name) =>
    bakeProto(mustFind(foliagePack, name), name, { targetHeight: 0.42, wind: 0.09 }),
  )
  const circle = bakeProto(grassPack, 'grass-circle', { targetHeight: 0.78, maxTris: 2400, wind: 0.08 })

  attachWind(wind, tuft, bush, plantGreen, plantBrown, circle, ...flowers, ...trees)

  const rng = mulberry32(0x6b1a7c)
  const treeSpots = thinMinDist(
    scatter(14.5, rng, {
      house: 18,
      spawn: 11,
      wall: 5.5,
      skip: 0.22,
      grove: 0.38,
      road: 7.2,
    }),
    8.6,
  )
  const typedTrees: Spot[][] = TREE_NAMES.map(() => [])
  for (const p of treeSpots) {
    typedTrees[Math.floor(rng() * trees.length)].push({
      x: p.x,
      z: p.z,
      yaw: rng() * Math.PI * 2,
      scale: 0.78 + rng() * 0.48,
    })
  }
  for (let i = 0; i < trees.length; i++) {
    plant(scene, trees[i], typedTrees[i], { slope: 0, tint: true, rng, wind })
    addTreeCollision(typedTrees[i], obstacles, cameraBlockers, cover)
  }

  plant(
    scene,
    circle,
    scatter(10.8, rng, { house: 11, spawn: 1.6, wall: 2.8, skip: 0.12, grove: 0.08, road: 3.4 }).map((p) => ({
      x: p.x,
      z: p.z,
      yaw: rng() * Math.PI * 2,
      scale: 0.9 + rng() * 0.55,
    })),
    { slope: 0.55, tint: true, rng, wind },
  )
  plant(
    scene,
    tuft,
    scatter(2.35, rng, { house: 10, spawn: 1.2, wall: 2.0, skip: 0.08, grove: 0.04, road: 2.5 }).map((p) => ({
      x: p.x,
      z: p.z,
      yaw: rng() * Math.PI * 2,
      scale: 0.9 + rng() * 0.75,
    })),
    { slope: 0.7, tint: true, rng, wind },
  )
  plant(
    scene,
    bush,
    scatter(9.2, rng, { house: 12, spawn: 4, wall: 3, skip: 0.28, grove: 0.2, road: 4.2 }).map((p) => ({
      x: p.x,
      z: p.z,
      yaw: rng() * Math.PI * 2,
      scale: 0.7 + rng() * 0.55,
    })),
    { slope: 0.35, tint: true, rng, wind },
  )
  plant(
    scene,
    plantGreen,
    scatter(5.4, rng, { house: 9.5, spawn: 2.2, wall: 2.4, skip: 0.3, grove: 0.1, road: 2.8 }).map((p) => ({
      x: p.x,
      z: p.z,
      yaw: rng() * Math.PI * 2,
      scale: 0.8 + rng() * 0.6,
    })),
    { slope: 0.8, tint: true, rng, wind },
  )
  plant(
    scene,
    plantBrown,
    scatter(6.8, rng, { house: 9.5, spawn: 2.2, wall: 2.4, skip: 0.42, grove: 0, road: 2.8 }).map((p) => ({
      x: p.x,
      z: p.z,
      yaw: rng() * Math.PI * 2,
      scale: 0.75 + rng() * 0.55,
    })),
    { slope: 0.8, tint: true, rng, wind },
  )

  const flowerPts = scatter(6.2, rng, { house: 10.5, spawn: 2.6, wall: 2.6, skip: 0.34, grove: 0.15, road: 2.4 })
  const flowerSpots: Spot[][] = flowers.map(() => [])
  for (const p of flowerPts) {
    flowerSpots[Math.floor(rng() * flowers.length)].push({
      x: p.x,
      z: p.z,
      yaw: rng() * Math.PI * 2,
      scale: 0.75 + rng() * 0.7,
    })
  }
  for (let i = 0; i < flowers.length; i++) {
    plant(scene, flowers[i], flowerSpots[i], { slope: 0.75, tint: true, rng, wind })
  }
}

function attachWind(wind: WindClock, ...protos: Proto[]): void {
  for (const proto of protos) {
    for (const part of proto.parts) {
      const mat = part.material
      const amount = mat.userData.windAmount as number | undefined
      if (!amount) continue
      mat.userData.windClock = wind
      mat.customProgramCacheKey = () => `foliage-wind-${amount}`
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uWindTime = wind
        shader.uniforms.uWindStrength = wind.strength
        shader.uniforms.uWindDirX = wind.dirX
        shader.uniforms.uWindDirZ = wind.dirZ
        shader.vertexShader = `uniform float uWindTime;
uniform float uWindStrength;
uniform float uWindDirX;
uniform float uWindDirZ;
${shader.vertexShader}`.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
	float wLift = max(transformed.y, 0.0);
	float amp = wLift * uWindStrength * ${amount.toFixed(3)};
	float gust = sin(uWindTime * 1.15 + transformed.z * 0.55 + transformed.y * 2.1);
	float flutter = cos(uWindTime * 2.35 + transformed.x * 1.25);
	transformed.x += (uWindDirX * gust + -uWindDirZ * flutter * 0.35) * amp;
	transformed.z += (uWindDirZ * gust * 0.85 + uWindDirX * flutter * 0.28) * amp;`,
        )
      }
    }
  }
}

const TILE = 40

function tileByCell<T extends { x: number; z: number }>(spots: T[], cell = TILE): T[][] {
  const buckets = new Map<number, T[]>()
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

function plant(
  scene: Scene,
  proto: Proto,
  spots: Spot[],
  opts: { slope: number; tint: boolean; rng: () => number; wind: WindClock },
): void {
  if (spots.length === 0) return
  for (const chunk of tileByCell(spots)) plantChunk(scene, proto, chunk, opts)
}

function plantChunk(
  scene: Scene,
  proto: Proto,
  spots: Spot[],
  opts: { slope: number; tint: boolean; rng: () => number; wind: WindClock },
): void {
  for (const part of proto.parts) {
    part.material.userData.windClock = opts.wind
    const mesh = new InstancedMesh(part.geometry, part.material, spots.length)
    mesh.name = proto.name
    mesh.frustumCulled = true
    mesh.castShadow = /wood|bark/i.test(part.material.name)
    mesh.receiveShadow = !mesh.castShadow
    for (let i = 0; i < spots.length; i++) {
      const spot = spots[i]
      const y = terrainHeight(spot.x, spot.z)
      _dummy.position.set(spot.x, y, spot.z)
      _dummy.scale.setScalar(spot.scale)
      _dummy.quaternion.identity()
      if (opts.slope > 0.01) {
        terrainNormal(spot.x, spot.z, _normal)
        _normal.lerp(_up, 1 - opts.slope).normalize()
        _dummy.quaternion.setFromUnitVectors(_up, _normal)
        _dummy.rotateY(spot.yaw)
      } else {
        _dummy.rotation.set(0, spot.yaw, 0)
      }
      _dummy.updateMatrix()
      mesh.setMatrixAt(i, _dummy.matrix)
      if (opts.tint) {
        const g = 0.86 + opts.rng() * 0.22
        _color.setRGB(0.78 + opts.rng() * 0.2, g, 0.62 + opts.rng() * 0.16)
        mesh.setColorAt(i, _color)
      }
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
    if (mesh.boundingSphere) mesh.boundingSphere.radius += 2.4
    scene.add(mesh)
  }
}

function addTreeCollision(
  spots: Spot[],
  obstacles: Aabb[],
  cameraBlockers: Aabb[],
  cover: Aabb[],
): void {
  for (const spot of spots) {
    const y = terrainHeight(spot.x, spot.z)
    const r = 0.58 * spot.scale
    const aabb: Aabb = {
      minX: spot.x - r,
      maxX: spot.x + r,
      minZ: spot.z - r,
      maxZ: spot.z + r,
      minY: y,
      maxY: y + TREE_HEIGHT * spot.scale,
    }
    obstacles.push(aabb)
    cameraBlockers.push(aabb)
    const crown = 1.9 * spot.scale
    cover.push({
      minX: spot.x - crown,
      maxX: spot.x + crown,
      minZ: spot.z - crown,
      maxZ: spot.z + crown,
      minY: y,
      maxY: y + TREE_HEIGHT * spot.scale,
    })
  }
}

function scatter(
  cell: number,
  rng: () => number,
  opts: { house: number; spawn: number; wall: number; skip: number; grove: number; road?: number },
): { x: number; z: number }[] {
  const pts: { x: number; z: number }[] = []
  const limit = ARENA_HALF - opts.wall
  const start = -limit + cell * 0.5
  for (let z = start; z <= limit; z += cell) {
    for (let x = start; x <= limit; x += cell) {
      if (rng() < opts.skip) continue
      const px = x + (rng() - 0.5) * cell * 0.86
      const pz = z + (rng() - 0.5) * cell * 0.86
      if (Math.max(Math.abs(px), Math.abs(pz)) > limit) continue
      if (Math.hypot(px, pz) < opts.house) continue
      if (Math.hypot(px - WINDMILL_PROP.x, pz - WINDMILL_PROP.z) < Math.max(8, opts.house * 0.7)) continue
      if (Math.hypot(px - PLAYER_SPAWN.x, pz - PLAYER_SPAWN.z) < opts.spawn) continue
      if (Math.hypot(px - BOT_SPAWN.x, pz - BOT_SPAWN.z) < opts.spawn) continue
      if (Math.hypot(px - WORKSHOP.x, pz - WORKSHOP.z) < Math.max(opts.spawn * 0.55, WORKSHOP_RADIUS + 2.5)) continue
      const roadClear = opts.road ?? 0
      if (roadClear > 0 && roadDistance(px, pz) < roadClear) continue
      if (opts.grove > 0) {
        const grove = Math.sin(px * 0.039 + 1.7) * Math.sin(pz * 0.034 + 0.4)
        if (grove < -0.18 && rng() < opts.grove) continue
      }
      pts.push({ x: px, z: pz })
    }
  }
  return pts
}

function thinMinDist(points: { x: number; z: number }[], minDist: number): { x: number; z: number }[] {
  const kept: { x: number; z: number }[] = []
  for (const p of points) {
    if (kept.every((k) => Math.hypot(p.x - k.x, p.z - k.z) >= minDist)) kept.push(p)
  }
  return kept
}

function terrainNormal(x: number, z: number, into: Vector3): Vector3 {
  const e = 0.55
  const dx = terrainHeight(x + e, z) - terrainHeight(x - e, z)
  const dz = terrainHeight(x, z + e) - terrainHeight(x, z - e)
  return into.set(-dx, e * 2, -dz).normalize()
}

function mustFind(root: Object3D, name: string): Object3D {
  const found = root.getObjectByName(name)
  if (found) return found
  const names: string[] = []
  root.traverse((obj) => {
    if (obj.name) names.push(obj.name)
  })
  throw new Error(`Brak ${name} w pakiecie. Są: ${names.slice(0, 36).join(', ')}`)
}

function bakeProto(
  source: Object3D,
  name: string,
  opts: { targetHeight: number; maxTris?: number; wind: number },
): Proto {
  source.updateMatrixWorld(true)
  const buckets = new Map<string, { material: MeshStandardMaterial; geos: BufferGeometry[] }>()
  source.traverse((child) => {
    const mesh = child as Mesh
    if (!mesh.isMesh) return
    const raw = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
    if (!(raw instanceof MeshStandardMaterial)) return
    const key = raw.uuid
    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = { material: prepMaterial(raw.clone(), name, opts.wind), geos: [] }
      buckets.set(key, bucket)
    }
    const geo = slimGeometry(mesh.geometry)
    geo.applyMatrix4(mesh.matrixWorld)
    bucket.geos.push(geo)
  })

  const parts: ProtoPart[] = []
  for (const bucket of buckets.values()) {
    const hasUv = bucket.geos.every((geo) => Boolean(geo.getAttribute('uv')))
    if (!hasUv) {
      for (const geo of bucket.geos) geo.deleteAttribute('uv')
    }
    const merged = mergeGeometries(bucket.geos, false)
    for (const geo of bucket.geos) geo.dispose()
    if (!merged) continue
    parts.push({
      geometry: opts.maxTris ? extractTriangles(merged, opts.maxTris) : merged,
      material: bucket.material,
    })
    if (opts.maxTris) merged.dispose()
  }
  if (parts.length === 0) throw new Error(`Pusty prototyp ${name}`)

  _box.makeEmpty()
  for (const part of parts) {
    part.geometry.computeBoundingBox()
    const bb = part.geometry.boundingBox
    if (bb) _box.union(bb)
  }
  _box.getSize(_size)
  const height = Math.max(_size.y, 0.001)
  const scale = opts.targetHeight / height
  const shiftX = -(_box.min.x + _box.max.x) * 0.5
  const shiftZ = -(_box.min.z + _box.max.z) * 0.5
  const shiftY = -_box.min.y
  for (const part of parts) {
    part.geometry.translate(shiftX, shiftY, shiftZ)
    part.geometry.scale(scale, scale, scale)
    part.geometry.computeVertexNormals()
  }
  return { name, parts }
}

function slimGeometry(src: BufferGeometry): BufferGeometry {
  const geo = new BufferGeometry()
  const pos = src.getAttribute('position')
  geo.setAttribute('position', pos.clone())
  const nrm = src.getAttribute('normal')
  if (nrm) geo.setAttribute('normal', nrm.clone())
  const uv = src.getAttribute('uv')
  if (uv) geo.setAttribute('uv', uv.clone())
  if (src.index) geo.setIndex(src.index.clone())
  return geo
}

function extractTriangles(geo: BufferGeometry, maxTris: number): BufferGeometry {
  const pos = geo.getAttribute('position') as BufferAttribute
  const nrm = geo.getAttribute('normal') as BufferAttribute | undefined
  const uv = geo.getAttribute('uv') as BufferAttribute | undefined
  const index = geo.index
  const triCount = index ? index.count / 3 : pos.count / 3
  const keep = Math.min(triCount, maxTris)
  const step = triCount / keep
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const push = (vi: number) => {
    positions.push(pos.getX(vi), pos.getY(vi), pos.getZ(vi))
    if (nrm) normals.push(nrm.getX(vi), nrm.getY(vi), nrm.getZ(vi))
    if (uv) uvs.push(uv.getX(vi), uv.getY(vi))
  }
  for (let i = 0; i < keep; i++) {
    const t = Math.floor(i * step)
    for (let k = 0; k < 3; k++) {
      push(index ? index.getX(t * 3 + k) : t * 3 + k)
    }
  }
  const out = new BufferGeometry()
  out.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  if (normals.length) out.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3))
  else out.computeVertexNormals()
  if (uvs.length) out.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2))
  return out
}

function prepMaterial(mat: MeshStandardMaterial, protoName: string, wind: number): MeshStandardMaterial {
  const leafy =
    wind > 0 ||
    /leaf|branch|grass|flower|plant|daisy|daffodil|ground/i.test(`${mat.name} ${protoName}`)
  mat.side = DoubleSide
  mat.roughness = leafy ? 0.82 : 0.9
  mat.metalness = 0
  if (leafy || mat.transparent || mat.alphaTest > 0 || mat.opacity < 0.99) {
    mat.transparent = false
    mat.alphaTest = Math.max(mat.alphaTest, 0.32)
    mat.depthWrite = true
  }
  if (wind > 0) mat.userData.windAmount = wind
  return mat
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
