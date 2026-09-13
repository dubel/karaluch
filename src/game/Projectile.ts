import { Mesh, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three'

const geometry = new SphereGeometry(0.12, 10, 8)

export type ShotSide = 'player' | 'enemy'
export type ShotTeam = 'pl' | 'de'

const _scatterAxis = new Vector3()

export class Projectile {
  readonly ownerId: string
  readonly team: ShotTeam
  readonly damage: number
  readonly object: Mesh
  readonly velocity: Vector3
  age = 0
  readonly ttl = 2.8
  alive = true

  constructor(
    ownerId: string,
    origin: Vector3,
    direction: Vector3,
    speed: number,
    damage: number,
    side: ShotSide,
  ) {
    this.ownerId = ownerId
    this.team = side === 'player' ? 'pl' : 'de'
    this.damage = damage
    this.velocity = direction.clone().normalize().multiplyScalar(speed)
    const tracer =
      side === 'enemy'
        ? { color: 0xff5a3a, emissive: 0xff2208, emissiveIntensity: 2.6 }
        : { color: 0xffe08a, emissive: 0xffc14d, emissiveIntensity: 2.2 }
    this.object = new Mesh(geometry, new MeshStandardMaterial({ ...tracer, roughness: 0.35 }))
    this.object.position.copy(origin)
    this.object.castShadow = true
  }

  update(dt: number): void {
    this.age += dt
    this.object.position.addScaledVector(this.velocity, dt)
    if (this.age >= this.ttl || this.object.position.y < -1) {
      this.alive = false
    }
  }

  /** Nudge a well-aimed tracer so it still flies past the target. */
  scatter(radians: number): void {
    const speed = this.velocity.length()
    _scatterAxis.set(Math.random() - 0.5, 0.4 + Math.random() * 0.6, Math.random() - 0.5)
    if (_scatterAxis.lengthSq() < 1e-6) _scatterAxis.set(0, 1, 0)
    _scatterAxis.normalize()
    this.velocity.applyAxisAngle(_scatterAxis, radians)
    this.velocity.setLength(speed)
  }
}
