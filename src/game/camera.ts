import { PerspectiveCamera, Vector3 } from 'three'
import type { Tank } from './Tank'

const _look = new Vector3()

export class FollowCamera {
  readonly camera: PerspectiveCamera

  constructor() {
    this.camera = new PerspectiveCamera(55, 1, 0.1, 250)
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / Math.max(height, 1)
    this.camera.updateProjectionMatrix()
  }

  update(tank: Tank): void {
    const pitch = Math.max(0.08, Math.min(0.72, 0.24 + tank.gunPitch * 0.45))
    const yaw = tank.aimWorldYaw()
    const dist = tank.config.cameraDistance
    const height = 2.1 + Math.sin(pitch) * dist * 0.45
    const back = Math.cos(pitch) * dist
    this.camera.position.set(
      tank.position.x - Math.sin(yaw) * back,
      tank.position.y + height,
      tank.position.z - Math.cos(yaw) * back,
    )
    _look.set(tank.position.x, tank.position.y + 1.35, tank.position.z)
    this.camera.lookAt(_look)
  }
}
