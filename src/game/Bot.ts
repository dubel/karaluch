import { Vector3 } from 'three'
import type { Aabb } from './collision'
import { ARENA_HALF } from './config'
import type { Tank } from './Tank'
import type { Projectile } from './Projectile'

const _origin = new Vector3()
const SEPARATION = 18

/** Angular slots around the hunt target (radians off the rear). Slot-based surround + boids separation. */
const SLOT_OFFSETS = [[0], [-0.72, 0.72], [-1.15, 0, 1.15]]

export class Bot {
  private bumps = 0
  private bumpCool = 0
  private readonly flankSign: number
  private readonly slotOffset: number
  private readonly ring: number
  private readonly kind: 'axis' | 'ally'

  constructor(
    private readonly tank: Tank,
    slot: number,
    waveSize: number,
    kind: 'axis' | 'ally' = 'axis',
  ) {
    this.kind = kind
    const table = SLOT_OFFSETS[Math.min(Math.max(waveSize, 1), 3) - 1]
    this.slotOffset = table[slot % table.length]
    this.flankSign = this.slotOffset >= 0 ? 1 : -1
    this.ring = kind === 'ally' ? 16 + Math.abs(this.slotOffset) * 4 : waveSize === 1 ? 22 : 24 + Math.abs(this.slotOffset) * 7
  }

  update(dt: number, hunt: Tank, obstacles: Aabb[], others: Tank[]): Projectile | null {
    if (!this.tank.alive || !hunt.alive) return null
    this.bumpCool = Math.max(0, this.bumpCool - dt)

    const px = hunt.position.x
    const pz = hunt.position.z
    const tx = this.tank.position.x
    const tz = this.tank.position.z
    const distHunt = Math.hypot(px - tx, pz - tz)
    const distVillage = Math.hypot(tx, tz)

    const { sepX, sepZ, crowded } = separate(tx, tz, this.tank, others, this.kind)
    const speed = Math.hypot(this.tank.vx, this.tank.vz)
    const jammed = crowded && speed < 0.7
    if ((jammed || crowded) && this.bumpCool <= 0) {
      this.bumps += 1
      this.bumpCool = 0.65
    }

    const shotSpeed = Math.max(this.tank.config.projectileSpeed, 1)
    const lead = Math.min(0.85, distHunt / shotSpeed)
    const aimX = px + hunt.vx * lead
    const aimZ = pz + hunt.vz * lead
    const aimY = hunt.position.y + hunt.height * 0.38

    const chase = this.kind === 'ally' || distHunt < 78 || distVillage < 34
    const rearPush = Math.min(1.45, this.bumps * 0.32)
    const offset = this.slotOffset + this.flankSign * rearPush
    const around = hunt.hullYaw + Math.PI + offset

    let driveX: number
    let driveZ: number
    if (chase) {
      driveX = px + Math.sin(around) * this.ring + sepX
      driveZ = pz + Math.cos(around) * this.ring + sepZ
      if (crowded || this.bumps > 0) {
        const fx = px - tx
        const fz = pz - tz
        const inv = 1 / Math.max(Math.hypot(fx, fz), 0.01)
        const orbit = 9 + this.bumps * 2.5
        driveX += -fz * inv * this.flankSign * orbit
        driveZ += fx * inv * this.flankSign * orbit
      }
    } else {
      driveX = sepX * 0.4
      driveZ = sepZ * 0.4
    }

    const toX = driveX - tx
    const toZ = driveZ - tz
    const distSlot = Math.hypot(toX, toZ)
    const driveYaw = distSlot > 0.4 ? Math.atan2(toX, toZ) : Math.atan2(aimX - tx, aimZ - tz)
    const hullDelta = wrapPi(driveYaw - this.tank.hullYaw)
    let steer = Math.max(-1, Math.min(1, hullDelta * 1.85))
    if (sepX * sepX + sepZ * sepZ > 0.4) {
      const sepYaw = Math.atan2(sepX, sepZ)
      steer = Math.max(-1, Math.min(1, steer + wrapPi(sepYaw - this.tank.hullYaw) * 0.35))
    }

    let throttle = 0
    if (jammed) throttle = speed < 0.2 ? -0.35 : 0.45
    else if (!chase && distVillage > 18) throttle = 1
    else if (distSlot > 10) throttle = crowded ? 0.62 : 1
    else if (distSlot > 4) throttle = 0.32
    else throttle = 0.05
    if (Math.abs(hullDelta) > 0.9) throttle *= 0.16
    if (throttle > 0.45 && speed < 0.5 && this.bumpCool <= 0) {
      this.bumps += 1
      this.bumpCool = 0.8
    }

    this.tank.drive(throttle, steer, dt, obstacles, ARENA_HALF, others)

    this.tank.applyAimPose()
    this.tank.muzzle.getWorldPosition(_origin)
    const huntYaw = Math.atan2(aimX - _origin.x, aimZ - _origin.z)
    const horiz = Math.hypot(aimX - _origin.x, aimZ - _origin.z)
    const pitch = Math.atan2(aimY - _origin.y, Math.max(horiz, 0.01))
    this.tank.aimTowards(huntYaw, pitch, dt)
    this.tank.applyAimPose()
    this.tank.tickCooldown(dt)

    if (hunt.team === this.tank.team) return null
    if (distHunt < 8 || distHunt > 86) return null
    if (!this.tank.aimedAt(aimX, aimY, aimZ, 0.045)) return null
    return this.tank.tryFireToward(hunt.position)
  }
}

function separate(
  tx: number,
  tz: number,
  self: Tank,
  others: Tank[],
  kind: 'axis' | 'ally',
): { sepX: number; sepZ: number; crowded: boolean } {
  let sepX = 0
  let sepZ = 0
  let crowded = false
  for (const other of others) {
    if (other === self || !other.alive) continue
    if (kind === 'axis' && other.id === 'player') continue
    const dx = tx - other.position.x
    const dz = tz - other.position.z
    const d = Math.hypot(dx, dz)
    if (d < 0.01 || d > SEPARATION) continue
    const w = (SEPARATION - d) / SEPARATION
    sepX += (dx / d) * w * 14
    sepZ += (dz / d) * w * 14
    if (d < 9.5) crowded = true
  }
  return { sepX, sepZ, crowded }
}

function wrapPi(angle: number): number {
  let a = angle
  while (a > Math.PI) a -= Math.PI * 2
  while (a < -Math.PI) a += Math.PI * 2
  return a
}
