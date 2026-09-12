import { Mesh, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three'

const geometry = new SphereGeometry(0.12, 10, 8)

export class Projectile {
  readonly ownerId: string
  readonly damage: number
  readonly object: Mesh
  readonly velocity: Vector3
  age = 0
  readonly ttl = 2.8
  alive = true

  constructor(ownerId: string, origin: Vector3, direction: Vector3, speed: number, damage: number) {
    this.ownerId = ownerId
    this.damage = damage
    this.velocity = direction.clone().normalize().multiplyScalar(speed)
    this.object = new Mesh(
      geometry,
      new MeshStandardMaterial({
        color: 0xffe08a,
        emissive: 0xffc14d,
        emissiveIntensity: 2.2,
        roughness: 0.35,
      }),
    )
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
}
