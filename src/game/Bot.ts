import { Vector3 } from 'three'
import type { Aabb } from './collision'
import { ARENA_HALF } from './config'
import type { Tank } from './Tank'
import type { Projectile } from './Projectile'

const _toPlayer = new Vector3()

export class Bot {
  constructor(private readonly tank: Tank) {}

  update(dt: number, player: Tank, obstacles: Aabb[]): Projectile | null {
    if (!this.tank.alive || !player.alive) return null

    _toPlayer.subVectors(player.position, this.tank.position)
    _toPlayer.y = 0
    const distance = _toPlayer.length()
    const targetYaw = Math.atan2(_toPlayer.x, _toPlayer.z)
    const hullDelta = wrapPi(targetYaw - this.tank.hullYaw)
    const steer = Math.max(-1, Math.min(1, hullDelta * 1.8))

    let throttle = 0
    if (distance > 26) throttle = 1
    else if (distance < 16) throttle = -0.55
    else throttle = 0.15

    if (Math.abs(hullDelta) > 0.9) throttle *= 0.25

    this.tank.drive(throttle, steer, dt, obstacles, ARENA_HALF, player)

    const heightDiff = player.position.y + 1.1 - (this.tank.position.y + this.tank.height * 0.65)
    const pitch = Math.atan2(heightDiff, Math.max(distance, 0.01))
    this.tank.aimTowards(targetYaw, pitch, dt)
    this.tank.applyAimPose()
    this.tank.tickCooldown(dt)

    if (this.tank.aimError(targetYaw) < 0.12 && distance < 38 && distance > 8) {
      return this.tank.tryFire()
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
