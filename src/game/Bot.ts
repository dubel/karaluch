import { Vector3 } from 'three'
import type { Aabb } from './collision'
import { ARENA_HALF } from './config'
import type { Tank } from './Tank'
import type { Projectile } from './Projectile'

const _origin = new Vector3()
const _dir = new Vector3()

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
    const shotSpeed = Math.max(this.tank.config.projectileSpeed, 1)
    const lead = Math.min(1.15, distPlayer / shotSpeed)
    const aimX = px + player.vx * lead
    const aimZ = pz + player.vz * lead
    const aimY = player.position.y + 1.15
    const playerYaw = Math.atan2(aimX - tx, aimZ - tz)
    const villageYaw = Math.atan2(-tx, -tz)
    const chase = distPlayer < 68 || distVillage < 32
    const driveYaw = chase ? playerYaw : villageYaw
    const hullDelta = wrapPi(driveYaw - this.tank.hullYaw)
    const steer = Math.max(-1, Math.min(1, hullDelta * 2.1))

    let throttle = 0
    if (distPlayer < 12) throttle = -0.45
    else if (!chase && distVillage > 16) throttle = 1
    else if (chase && distPlayer > 22) throttle = 1
    else throttle = 0.18
    if (Math.abs(hullDelta) > 0.7) throttle *= 0.22

    this.tank.drive(throttle, steer, dt, obstacles, ARENA_HALF, others)

    const heightDiff = aimY - (this.tank.position.y + this.tank.height * 0.62)
    const pitch = Math.atan2(heightDiff, Math.max(distPlayer, 0.01))
    this.tank.aimTowards(playerYaw, pitch, dt)
    this.tank.applyAimPose()
    this.tank.tickCooldown(dt)

    if (distPlayer < 8 || distPlayer > 82) return null
    if (!this.tank.aimedAt(aimX, aimY, aimZ, 0.1)) return null
    this.tank.getShotRay(_origin, _dir)
    return this.tank.tryFireToward(player.position)
  }
}

function wrapPi(angle: number): number {
  let a = angle
  while (a > Math.PI) a -= Math.PI * 2
  while (a < -Math.PI) a += Math.PI * 2
  return a
}
