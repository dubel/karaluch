import {
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Vector3,
} from 'three'
import type { RigConfig } from './config'
import { applyRig, type TankRig } from './rig'
import { clampToBounds, collidesAny, obbHitsObb, type Aabb } from './collision'
import { Projectile } from './Projectile'
import { terrainHeight } from './terrain'

const _forward = new Vector3()
const _muzzle = new Vector3()
const _dir = new Vector3()

function wrapPi(angle: number): number {
  let a = angle
  while (a > Math.PI) a -= Math.PI * 2
  while (a < -Math.PI) a += Math.PI * 2
  return a
}

function clampTilt(angle: number): number {
  return Math.max(-0.42, Math.min(0.42, angle))
}

function shortestDelta(from: number, to: number): number {
  return wrapPi(to - from)
}

export class Tank {
  readonly id: string
  readonly config: RigConfig
  readonly object: Group
  readonly turret: Group
  readonly gun: Group
  readonly muzzle: Object3D
  readonly halfWidth: number
  readonly halfLength: number
  readonly height: number

  hullYaw = 0
  turretYaw = 0
  gunPitch = 0
  hp: number
  cooldown = 0
  alive = true

  private readonly spawn = new Vector3()
  private readonly spawnYaw: number
  private readonly dimMaterials: MeshStandardMaterial[] = []
  private hitRoll = 0
  private hitRollVel = 0
  private terrainPitch = 0
  private terrainRoll = 0

  constructor(id: string, model: Object3D, config: RigConfig, spawn: Vector3, spawnYaw: number) {
    this.id = id
    this.config = config
    const rig: TankRig = applyRig(model, config)
    this.object = rig.root
    this.turret = rig.turret
    this.gun = rig.gun
    this.muzzle = rig.muzzle
    this.halfWidth = rig.halfWidth
    this.halfLength = rig.halfLength
    this.height = rig.height
    this.hp = config.maxHp
    this.spawn.copy(spawn)
    this.spawnYaw = spawnYaw
    this.object.position.copy(spawn)
    this.hullYaw = spawnYaw
    this.sitOnTerrain()
    this.object.traverse((child) => {
      const mesh = child as Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const mat of mats) {
        if (mat instanceof MeshStandardMaterial) {
          this.dimMaterials.push(mat)
        }
      }
    })
  }

  get position(): Vector3 {
    return this.object.position
  }

  aimWorldYaw(): number {
    return wrapPi(this.hullYaw + this.turretYaw)
  }

  reset(): void {
    this.hp = this.config.maxHp
    this.cooldown = 0
    this.alive = true
    this.object.visible = true
    this.object.position.copy(this.spawn)
    this.hullYaw = this.spawnYaw
    this.turretYaw = 0
    this.gunPitch = 0
    this.hitRoll = 0
    this.hitRollVel = 0
    this.sitOnTerrain()
    this.turret.rotation.y = 0
    this.gun.rotation.x = 0
    for (const mat of this.dimMaterials) {
      if (mat.userData.baseColor instanceof Color) {
        mat.color.copy(mat.userData.baseColor)
      }
      mat.emissive.setHex(0x000000)
    }
  }

  takeDamage(amount: number): boolean {
    if (!this.alive) return false
    this.nudgeHit()
    this.hp = Math.max(0, this.hp - amount)
    if (this.hp <= 0) {
      this.alive = false
      this.nudgeHit()
      this.object.visible = true
      for (const mat of this.dimMaterials) {
        if (!mat.userData.baseColor) {
          mat.userData.baseColor = mat.color.clone()
        }
        mat.color.multiplyScalar(0.35)
        mat.emissive.setHex(0x220000)
      }
      return true
    }
    return false
  }

  nudgeHit(): void {
    this.hitRollVel += (Math.random() < 0.5 ? -1 : 1) * (0.9 + Math.random() * 0.65)
  }

  tickHitSway(dt: number): void {
    this.hitRollVel += -this.hitRoll * 38 * dt
    this.hitRollVel *= Math.exp(-5.5 * dt)
    this.hitRoll += this.hitRollVel * dt
    this.applyHullPose()
  }

  drive(
    throttle: number,
    steer: number,
    dt: number,
    obstacles: Aabb[],
    halfArena: number,
    other?: Tank,
  ): void {
    if (!this.alive) return
    const turn = steer * this.config.turnSpeed * dt
    const nextYaw = this.hullYaw + turn
    const speed = throttle >= 0 ? this.config.moveSpeed : this.config.reverseSpeed
    _forward.set(Math.sin(nextYaw), 0, Math.cos(nextYaw))
    const dist = throttle * speed * dt
    const nextX = this.object.position.x + _forward.x * dist
    const nextZ = this.object.position.z + _forward.z * dist

    const blockedYaw = collidesAny(
      this.object.position.x,
      this.object.position.z,
      nextYaw,
      this.halfWidth,
      this.halfLength,
      obstacles,
    )
    const yaw = blockedYaw ? this.hullYaw : nextYaw

    const tryPos = (x: number, z: number, y: number): boolean => {
      if (collidesAny(x, z, y, this.halfWidth, this.halfLength, obstacles)) return false
      if (
        other?.alive &&
        obbHitsObb(
          x,
          z,
          y,
          this.halfWidth,
          this.halfLength,
          other.object.position.x,
          other.object.position.z,
          other.hullYaw,
          other.halfWidth,
          other.halfLength,
        )
      ) {
        return false
      }
      return true
    }

    const bounded = clampToBounds(nextX, nextZ, this.halfWidth, this.halfLength, halfArena)
    if (tryPos(bounded.x, bounded.z, yaw)) {
      this.object.position.x = bounded.x
      this.object.position.z = bounded.z
    } else {
      const onlyX = clampToBounds(
        bounded.x,
        this.object.position.z,
        this.halfWidth,
        this.halfLength,
        halfArena,
      )
      if (tryPos(onlyX.x, this.object.position.z, yaw)) {
        this.object.position.x = onlyX.x
      } else {
        const onlyZ = clampToBounds(
          this.object.position.x,
          bounded.z,
          this.halfWidth,
          this.halfLength,
          halfArena,
        )
        if (tryPos(this.object.position.x, onlyZ.z, yaw)) {
          this.object.position.z = onlyZ.z
        }
      }
    }

    this.hullYaw = yaw
    this.sitOnTerrain()
  }

  sitOnTerrain(): void {
    const x = this.object.position.x
    const z = this.object.position.z
    const yaw = this.hullYaw
    const sin = Math.sin(yaw)
    const cos = Math.cos(yaw)
    const along = this.halfLength * 0.88
    const across = this.halfWidth * 0.82
    const hFR = terrainHeight(x + sin * along + cos * across, z + cos * along - sin * across)
    const hFL = terrainHeight(x + sin * along - cos * across, z + cos * along + sin * across)
    const hBR = terrainHeight(x - sin * along + cos * across, z - cos * along - sin * across)
    const hBL = terrainHeight(x - sin * along - cos * across, z - cos * along + sin * across)
    const hF = (hFR + hFL) * 0.5
    const hB = (hBR + hBL) * 0.5
    const hR = (hFR + hBR) * 0.5
    const hL = (hFL + hBL) * 0.5
    const hC = terrainHeight(x, z)
    this.object.position.y = Math.min(hC, (hFR + hFL + hBR + hBL) * 0.25) - 0.03
    this.terrainPitch = clampTilt(Math.atan2(hB - hF, along * 2))
    this.terrainRoll = clampTilt(Math.atan2(hL - hR, across * 2))
    this.applyHullPose()
  }

  private applyHullPose(): void {
    this.object.rotation.order = 'YXZ'
    this.object.rotation.y = this.hullYaw
    this.object.rotation.x = this.terrainPitch
    this.object.rotation.z = this.terrainRoll + this.hitRoll
  }

  addAimDelta(dy: number): void {
    if (!this.alive) return
    this.turretYaw = 0
    this.gunPitch = Math.max(
      this.config.gunPitchMin,
      Math.min(this.config.gunPitchMax, this.gunPitch + dy),
    )
  }

  aimTowards(worldYaw: number, pitch: number, dt: number): void {
    if (!this.alive) return
    const desired = wrapPi(worldYaw - this.hullYaw)
    const limit = this.config.turretYawLimit
    const clamped = Math.max(-limit, Math.min(limit, desired))
    const step = this.config.turretTurnSpeed * dt
    const delta = shortestDelta(this.turretYaw, clamped)
    this.turretYaw += Math.max(-step, Math.min(step, delta))
    const pitchDelta = pitch - this.gunPitch
    this.gunPitch += Math.max(-step, Math.min(step, pitchDelta))
    this.gunPitch = Math.max(this.config.gunPitchMin, Math.min(this.config.gunPitchMax, this.gunPitch))
  }

  applyAimPose(): void {
    this.turret.rotation.y = this.turretYaw
    this.gun.rotation.x = -this.gunPitch
  }

  tickCooldown(dt: number): void {
    this.cooldown = Math.max(0, this.cooldown - dt)
  }

  reloadProgress(): number {
    if (this.config.fireCooldown <= 0) return 1
    return 1 - this.cooldown / this.config.fireCooldown
  }

  aimError(worldYaw: number): number {
    return Math.abs(shortestDelta(this.aimWorldYaw(), worldYaw))
  }

  getShotRay(origin: Vector3, direction: Vector3): void {
    this.muzzle.getWorldPosition(origin)
    this.gun.getWorldPosition(direction)
    direction.subVectors(origin, direction)
    if (direction.lengthSq() < 1e-6) {
      const yaw = this.aimWorldYaw()
      direction.set(Math.sin(yaw), Math.sin(this.gunPitch), Math.cos(yaw))
    }
    direction.normalize()
  }

  tryFireToward(_worldPoint: Vector3): Projectile | null {
    if (!this.alive || this.cooldown > 0) return null
    this.cooldown = this.config.fireCooldown
    this.getShotRay(_muzzle, _dir)
    return new Projectile(
      this.id,
      _muzzle.clone(),
      _dir,
      this.config.projectileSpeed,
      this.config.damage,
    )
  }
}
