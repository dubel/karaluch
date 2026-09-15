import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  Group,
  Matrix4,
  Mesh,
  Object3D,
  Vector3,
  type Camera,
  type Light,
} from 'three'
import type { RigConfig } from './config'

const _size = new Vector3()
const _center = new Vector3()

function isLight(obj: Object3D): obj is Light {
  return (obj as Light).isLight === true
}

function isCamera(obj: Object3D): obj is Camera {
  return (obj as Camera).isCamera === true
}

export function stripJunk(root: Object3D): void {
  const remove: Object3D[] = []
  root.traverse((obj) => {
    if (isLight(obj) || isCamera(obj)) {
      remove.push(obj)
      return
    }
    if (/^(Area|Camera|Light|Sun)(\.|$)/i.test(obj.name)) {
      remove.push(obj)
    }
  })
  for (const obj of remove) {
    obj.removeFromParent()
  }
}

export function normalizeModel(root: Object3D, targetLength: number): void {
  root.updateMatrixWorld(true)
  const box = new Box3().setFromObject(root)
  box.getSize(_size)
  const length = Math.max(_size.x, _size.z, 0.001)
  root.scale.multiplyScalar(targetLength / length)
  root.updateMatrixWorld(true)
  box.setFromObject(root)
  box.getCenter(_center)
  root.position.x -= _center.x
  root.position.z -= _center.z
  root.position.y -= box.min.y
  root.updateMatrixWorld(true)
}

function nameCandidates(name: string): string[] {
  const nodot = name.replaceAll('.', '')
  const underscored = name.replaceAll(' ', '_')
  return [...new Set([name, nodot, underscored, nodot.replaceAll(' ', '_')])]
}

function collectNamed(root: Object3D, names: string[]): Object3D[] {
  const found: Object3D[] = []
  for (const name of names) {
    let obj: Object3D | undefined
    for (const candidate of nameCandidates(name)) {
      obj = root.getObjectByName(candidate)
      if (obj) break
    }
    if (obj) found.push(obj)
  }
  return found
}

function extractTriangles(src: BufferGeometry, triIndices: number[]): BufferGeometry {
  const index = src.getIndex()
  const remap = new Map<number, number>()
  const newIndex: number[] = []
  let next = 0
  const pick = (old: number): number => {
    let n = remap.get(old)
    if (n === undefined) {
      n = next++
      remap.set(old, n)
    }
    return n
  }
  for (const t of triIndices) {
    const ia = index ? index.getX(t * 3) : t * 3
    const ib = index ? index.getX(t * 3 + 1) : t * 3 + 1
    const ic = index ? index.getX(t * 3 + 2) : t * 3 + 2
    newIndex.push(pick(ia), pick(ib), pick(ic))
  }
  const dst = new BufferGeometry()
  for (const name of Object.keys(src.attributes)) {
    const attr = src.getAttribute(name)
    const itemSize = attr.itemSize
    const Ctor = attr.array.constructor as new (n: number) => typeof attr.array
    const array = new Ctor(next * itemSize)
    for (const [old, n] of remap) {
      array.set(attr.array.subarray(old * itemSize, old * itemSize + itemSize), n * itemSize)
    }
    dst.setAttribute(name, new BufferAttribute(array, itemSize, attr.normalized))
  }
  if (next > 65535) {
    dst.setIndex(new BufferAttribute(new Uint32Array(newIndex), 1))
  } else {
    dst.setIndex(newIndex)
  }
  dst.computeBoundingBox()
  dst.computeBoundingSphere()
  return dst
}

function splitMeshKeep(
  mesh: Mesh,
  keepTurret: (x: number, y: number, z: number) => boolean,
  keepGun?: (x: number, y: number, z: number) => boolean,
): void {
  const src = mesh.geometry
  const pos = src.getAttribute('position')
  if (!pos) return
  const index = src.getIndex()
  const triCount = (index ? index.count : pos.count) / 3
  if (!Number.isInteger(triCount) || triCount < 1) return

  const turretTris: number[] = []
  const gunTris: number[] = []
  const hullTris: number[] = []
  const votes = (pred: (x: number, y: number, z: number) => boolean, t: number): number => {
    const ia = index ? index.getX(t * 3) : t * 3
    const ib = index ? index.getX(t * 3 + 1) : t * 3 + 1
    const ic = index ? index.getX(t * 3 + 2) : t * 3 + 2
    return (
      (pred(pos.getX(ia), pos.getY(ia), pos.getZ(ia)) ? 1 : 0) +
      (pred(pos.getX(ib), pos.getY(ib), pos.getZ(ib)) ? 1 : 0) +
      (pred(pos.getX(ic), pos.getY(ic), pos.getZ(ic)) ? 1 : 0)
    )
  }
  for (let t = 0; t < triCount; t++) {
    if (keepGun && votes(keepGun, t) >= 2) gunTris.push(t)
    else if (votes(keepTurret, t) >= 2) turretTris.push(t)
    else hullTris.push(t)
  }
  if (turretTris.length === 0) return

  mesh.geometry = extractTriangles(src, turretTris)
  if (hullTris.length > 0) {
    spawnSiblingMesh(mesh, extractTriangles(src, hullTris), `${mesh.name}_fixed`)
  }
  if (gunTris.length > 0) {
    spawnSiblingMesh(mesh, extractTriangles(src, gunTris), `${mesh.name}_gun`)
  }
}

function spawnSiblingMesh(mesh: Mesh, geometry: BufferGeometry, name: string): void {
  const sibling = new Mesh(geometry, mesh.material)
  sibling.name = name
  sibling.position.copy(mesh.position)
  sibling.quaternion.copy(mesh.quaternion)
  sibling.scale.copy(mesh.scale)
  sibling.castShadow = mesh.castShadow
  sibling.receiveShadow = mesh.receiveShadow
  sibling.frustumCulled = mesh.frustumCulled
  sibling.renderOrder = mesh.renderOrder
  sibling.layers.mask = mesh.layers.mask
  mesh.parent?.add(sibling)
}

function peelHullFromTurret(
  root: Object3D,
  turretNames: string[],
  keepTurret: (x: number, y: number, z: number) => boolean,
  keepGun?: (x: number, y: number, z: number) => boolean,
): void {
  for (const part of collectNamed(root, turretNames)) {
    part.traverse((obj) => {
      if ((obj as Mesh).isMesh) splitMeshKeep(obj as Mesh, keepTurret, keepGun)
    })
  }
}

function bboxOf(objects: Object3D[]): Box3 | null {
  if (objects.length === 0) return null
  const box = new Box3()
  for (const obj of objects) {
    box.expandByObject(obj)
  }
  return box
}

export type TankRig = {
  root: Group
  turret: Group
  gun: Group
  muzzle: Object3D
  halfWidth: number
  halfLength: number
  height: number
}

export function applyRig(model: Object3D, config: RigConfig): TankRig {
  stripJunk(model)
  if (config.keepTurretVertex) {
    peelHullFromTurret(model, config.turretNames, config.keepTurretVertex, config.keepGunVertex)
  }
  if (config.visualYaw) {
    model.rotation.y += config.visualYaw
    model.updateMatrixWorld(true)
  }
  normalizeModel(model, config.targetLength)

  const root = new Group()
  root.name = 'TankRoot'
  const visual = new Group()
  visual.name = 'Visual'
  root.add(visual)
  visual.add(model)

  const turret = new Group()
  turret.name = 'TurretPivot'
  const gun = new Group()
  gun.name = 'GunPivot'
  const muzzle = new Object3D()
  muzzle.name = 'Muzzle'

  const turretParts = collectNamed(model, config.turretNames)
  const gunParts = collectNamed(model, config.gunNames)

  visual.updateMatrixWorld(true)
  const shieldParts = collectNamed(
    model,
    config.gunNames.filter((name) => /shield|mantlet/i.test(name)),
  )
  const turretBox = bboxOf(shieldParts) ?? bboxOf(turretParts) ?? new Box3().setFromObject(model)
  turretBox.getCenter(_center)
  turret.position.set(_center.x, _center.y, _center.z)
  visual.add(turret)
  turret.add(gun)

  for (const part of turretParts) {
    turret.attach(part)
  }
  for (const part of gunParts) {
    gun.attach(part)
  }

  gun.updateMatrixWorld(true)
  const gunBox = bboxOf(gunParts) ?? bboxOf(turretParts)
  if (gunBox) {
    const local = gunBox.clone()
    local.applyMatrix4(new Matrix4().copy(gun.matrixWorld).invert())
    const zFwd = Math.abs(local.max.z) >= Math.abs(local.min.z) ? local.max.z : local.min.z
    muzzle.position.set(0, 0, zFwd + Math.sign(zFwd || 1) * 0.4)
  } else {
    muzzle.position.set(0, 0, 1.4)
  }
  gun.add(muzzle)

  if (config.visualYaw === undefined) {
    visual.updateMatrixWorld(true)
    const axisBox = bboxOf(gunParts) ?? bboxOf(turretParts)
    if (axisBox) {
      axisBox.getSize(_size)
      axisBox.getCenter(_center)
      let yaw = 0
      if (_size.x > _size.z * 1.15) {
        yaw = _center.x >= 0 ? -Math.PI / 2 : Math.PI / 2
      } else if (_center.z < 0) {
        yaw = Math.PI
      }
      if (Math.abs(yaw) > 1e-4) {
        visual.rotation.y -= yaw
        visual.updateMatrixWorld(true)
      }
    }
  }

  const aligned = new Box3().setFromObject(visual)
  aligned.getSize(_size)
  aligned.getCenter(_center)
  visual.position.x -= _center.x
  visual.position.z -= _center.z
  visual.position.y -= aligned.min.y

  return {
    root,
    turret,
    gun,
    muzzle,
    halfWidth: Math.max(_size.x * 0.5, 0.6),
    halfLength: Math.max(_size.z * 0.48, 1.0),
    height: _size.y,
  }
}
