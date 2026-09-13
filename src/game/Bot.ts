import { Vector3 } from 'three'
import type { Aabb } from './collision'
import { ARENA_HALF } from './config'
import type { Tank } from './Tank'
import type { Projectile } from './Projectile'

const _to = new Vector3()

export class Bot {
  constructor(private readonly tank: Tank) {}

  update(dt: number, player: Tank, obstacles: Aabb[], others: Tank[]): Projectile | null {
    if (!this.tank.alive || !player.alive) return null

    const px = player.position.x
    const pz = player.position.z
    const tx = this.tank.position.x
    const tz = this.tank.position.z
    const distPlayer = Math.hypot(px - tx, pz - tz)
    const distVillage = Math.hypot(tx, tz)

    let hunt = 0.22 + clamp01((72 - distPlayer) / 72) * 0.55
    if (distVillage < 34) hunt = Math.max(hunt, 0.88)
    hunt = Math.max(0.18, Math.min(1, hunt))

    const targetX = px * hunt
    const targetZ = pz * hunt
    _to.set(targetX - tx, 0, targetZ - tz)
    const distTarget = Math.max(_to.length(), 0.01)
    const driveYaw = Math.atan2(_to.x, _to.z)
    const hullDelta = wrapPi(driveYaw - this.tank.hullYaw)
    const steer = Math.max(-1, Math.min(1, hullDelta * 1.65))

    let throttle = 0
    if (distPlayer < 13) throttle = -0.5
    else if (distTarget > 18) throttle = 1
    else throttle = 0.22
    if (Math.abs(hullDelta) > 0.85) throttle *= 0.28

    this.tank.drive(throttle, steer, dt, obstacles, ARENA_HALF, others)

    const aimYaw = Math.atan2(px - tx, pz - tz)
    const heightDiff = player.position.y + 1.1 - (this.tank.position.y + this.tank.height * 0.65)
    const pitch = Math.atan2(heightDiff, Math.max(distPlayer, 0.01))
    this.tank.aimTowards(aimYaw, pitch, dt)
    this.tank.applyAimPose()
    this.tank.tickCooldown(dt)

    if (this.tank.aimError(aimYaw) < 0.14 && distPlayer < 78 && distPlayer > 8) {
      return this.tank.tryFireToward(player.position)
    }
    return null
  }
}

function wrapPi(angle: number): number {
  let a = angle
  while (a > Math.PI) a -= Math.PI * 2
  while (a < -Math.PI) a += Math.PI * 2
  return a
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}
