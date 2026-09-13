import {
  AdditiveBlending,
  Box3,
  CircleGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PointLight,
  RingGeometry,
  Vector3,
  type Object3D,
  type Scene,
} from 'three'
import type { Aabb } from './collision'
import { WORKSHOP, WORKSHOP_RADIUS } from './config'
import { normalizeModel, stripJunk } from './rig'
import { terrainHeight } from './terrain'

export class Workshop {
  readonly x = WORKSHOP.x
  readonly z = WORKSHOP.z
  readonly radius = WORKSHOP_RADIUS
  private readonly wrench: Group
  private readonly glow: Mesh
  private readonly ring: Mesh
  private readonly light: PointLight
  private t = 0

  constructor(
    scene: Scene,
    barrels: Object3D,
    wrenchModel: Object3D,
    obstacles: Aabb[],
    cameraBlockers: Aabb[],
  ) {
    const ground = terrainHeight(this.x, this.z)

    stripJunk(barrels)
    normalizeModel(barrels, 3.6)
    barrels.rotation.y = WORKSHOP.yaw
    barrels.position.set(this.x, ground, this.z)
    barrels.traverse((child) => {
      const mesh = child as Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true
    })
    scene.add(barrels)

    const hx = 1.55
    const hz = 1.55
    const aabb: Aabb = {
      minX: this.x - hx,
      maxX: this.x + hx,
      minZ: this.z - hz,
      maxZ: this.z + hz,
      minY: ground,
      maxY: ground + 1.8,
    }
    obstacles.push(aabb)
    cameraBlockers.push(aabb)

    this.wrench = new Group()
    this.wrench.position.set(this.x, ground + 2.35, this.z)
    stripJunk(wrenchModel)
    fitMarker(wrenchModel, 1.25)
    paintWrench(wrenchModel)
    this.wrench.add(wrenchModel)
    scene.add(this.wrench)

    const glowMat = new MeshBasicMaterial({
      color: 0x3dff6a,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
    })
    this.glow = new Mesh(new CircleGeometry(this.radius, 48), glowMat)
    this.glow.rotation.x = -Math.PI / 2
    this.glow.position.set(this.x, ground + 0.07, this.z)
    this.glow.renderOrder = 2
    scene.add(this.glow)

    const ringMat = glowMat.clone()
    ringMat.opacity = 0.42
    this.ring = new Mesh(new RingGeometry(this.radius * 0.86, this.radius, 48), ringMat)
    this.ring.rotation.x = -Math.PI / 2
    this.ring.position.set(this.x, ground + 0.08, this.z)
    this.ring.renderOrder = 3
    scene.add(this.ring)

    this.light = new PointLight(0x44ff66, 2.4, this.radius * 2.4, 1.6)
    this.light.position.set(this.x, ground + 2.1, this.z)
    scene.add(this.light)
  }

  contains(x: number, z: number): boolean {
    return Math.hypot(x - this.x, z - this.z) <= this.radius
  }

  tick(dt: number): void {
    this.t += dt
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 2.6)
    this.wrench.position.y = terrainHeight(this.x, this.z) + 2.25 + Math.sin(this.t * 1.7) * 0.16
    this.wrench.rotation.y += dt * 0.85
    const s = 0.92 + pulse * 0.18
    this.wrench.scale.setScalar(s)
    ;(this.glow.material as MeshBasicMaterial).opacity = 0.1 + pulse * 0.12
    ;(this.ring.material as MeshBasicMaterial).opacity = 0.28 + pulse * 0.28
    this.light.intensity = 1.6 + pulse * 1.8
  }
}

function fitMarker(root: Object3D, target: number): void {
  root.updateMatrixWorld(true)
  const box = new Box3().setFromObject(root)
  const size = new Vector3()
  box.getSize(size)
  const longest = Math.max(size.x, size.y, size.z, 0.001)
  root.scale.multiplyScalar(target / longest)
  root.updateMatrixWorld(true)
  box.setFromObject(root)
  const center = new Vector3()
  box.getCenter(center)
  root.position.x -= center.x
  root.position.z -= center.z
  root.position.y -= center.y
}

function paintWrench(root: Object3D): void {
  root.traverse((child) => {
    const mesh = child as Mesh
    if (!mesh.isMesh) return
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    const painted = mats.map((mat) => {
      const next = mat instanceof MeshStandardMaterial ? mat.clone() : new MeshStandardMaterial()
      if (next instanceof MeshStandardMaterial) {
        next.color.setHex(0x3ad65a)
        next.emissive.setHex(0x146b32)
        next.emissiveIntensity = 0.9
        next.metalness = 0.42
        next.roughness = 0.38
      }
      return next
    })
    mesh.material = Array.isArray(mesh.material) ? painted : painted[0]
    mesh.castShadow = true
  })
}
