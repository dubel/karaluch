import {
  Box3,
  Group,
  Object3D,
  Vector3,
  type Camera,
  type Light,
} from 'three'
import type { RigConfig } from './config'

const _size = new Vector3()
const _center = new Vector3()
const _muzzle = new Vector3()
const _origin = new Vector3()

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
    if (/^(Area|Camera|Light)(\.|$)/i.test(obj.name)) {
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

function gltfName(name: string): string {
  return name.replaceAll('.', '')
}

function collectNamed(root: Object3D, names: string[]): Object3D[] {
  const found: Object3D[] = []
  for (const name of names) {
    const obj = root.getObjectByName(name) ?? root.getObjectByName(gltfName(name))
    if (obj) found.push(obj)
  }
  return found
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

  turret.updateMatrixWorld(true)
  const gunBox = bboxOf(gunParts) ?? bboxOf(turretParts)
  if (gunBox) {
    gunBox.getCenter(_muzzle)
    const size = gunBox.getSize(_size)
    const radius = Math.max(size.x, size.z) * 0.5
    _origin.copy(turret.position)
    _muzzle.sub(_origin)
    _muzzle.y = 0
    if (_muzzle.lengthSq() < 1e-6) {
      _muzzle.set(0, 0, 1)
    }
    _muzzle.setLength(radius + 0.35)
    muzzle.position.copy(_muzzle)
    muzzle.position.y = 0
  } else {
    muzzle.position.set(0, 0, 1.4)
  }
  gun.add(muzzle)

  visual.updateMatrixWorld(true)
  let yaw = config.visualYaw ?? 0
  if (config.visualYaw === undefined) {
    const axisBox = bboxOf(gunParts) ?? bboxOf(turretParts)
    if (axisBox) {
      axisBox.getSize(_size)
      axisBox.getCenter(_center)
      if (_size.x > _size.z * 1.15) {
        yaw = _center.x >= 0 ? -Math.PI / 2 : Math.PI / 2
      } else if (_center.z < 0) {
        yaw = Math.PI
      }
    }
  }
  if (Math.abs(yaw) > 1e-4) {
    visual.rotation.y -= yaw
    visual.updateMatrixWorld(true)
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
