import {
  BoxGeometry,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Scene,
} from 'three'
import type { Aabb } from './collision'

export const ARENA_HALF = 42

type BuildingSpec = {
  x: number
  z: number
  w: number
  d: number
  h: number
}

const BUILDINGS: BuildingSpec[] = [
  { x: 0, z: 0, w: 9, d: 6, h: 4.2 },
  { x: -14, z: 8, w: 6, d: 5, h: 4.5 },
  { x: 16, z: -6, w: 7, d: 4, h: 3.2 },
  { x: 4, z: 18, w: 5, d: 8, h: 5.5 },
  { x: -18, z: -16, w: 8, d: 6, h: 3.8 },
  { x: 22, z: 14, w: 4, d: 4, h: 6.5 },
  { x: -6, z: -22, w: 9, d: 4, h: 2.8 },
  { x: 8, z: 2, w: 3.5, d: 3.5, h: 2.2 },
  { x: -24, z: 4, w: 4, d: 9, h: 4.1 },
]

export class Arena {
  readonly obstacles: Aabb[] = []

  constructor(scene: Scene) {
    scene.background = new Color(0x6b7c8a)
    scene.fog = new Fog(0x6b7c8a, 45, 130)

    const hemi = new HemisphereLight(0xc5d4e0, 0x4a4030, 0.85)
    scene.add(hemi)

    const sun = new DirectionalLight(0xffe2b8, 1.45)
    sun.position.set(28, 42, 18)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.near = 2
    sun.shadow.camera.far = 120
    sun.shadow.camera.left = -55
    sun.shadow.camera.right = 55
    sun.shadow.camera.top = 55
    sun.shadow.camera.bottom = -55
    sun.shadow.bias = -0.0004
    scene.add(sun)

    const ground = new Mesh(
      new PlaneGeometry(ARENA_HALF * 2.4, ARENA_HALF * 2.4),
      new MeshStandardMaterial({ color: 0x5a6b3a, roughness: 0.95, metalness: 0.02 }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    scene.add(ground)

    const wallMat = new MeshStandardMaterial({ color: 0x3d3a32, roughness: 0.9 })
    const wallH = 2.4
    const thickness = 1.2
    const span = ARENA_HALF * 2 + thickness
    const walls = [
      { x: 0, z: ARENA_HALF, w: span, d: thickness },
      { x: 0, z: -ARENA_HALF, w: span, d: thickness },
      { x: ARENA_HALF, z: 0, w: thickness, d: span },
      { x: -ARENA_HALF, z: 0, w: thickness, d: span },
    ]
    for (const wall of walls) {
      const mesh = new Mesh(new BoxGeometry(wall.w, wallH, wall.d), wallMat)
      mesh.position.set(wall.x, wallH / 2, wall.z)
      mesh.castShadow = true
      mesh.receiveShadow = true
      scene.add(mesh)
    }

    const concrete = new MeshStandardMaterial({ color: 0x7a7568, roughness: 0.88, metalness: 0.05 })
    for (const b of BUILDINGS) {
      const mesh = new Mesh(new BoxGeometry(b.w, b.h, b.d), concrete)
      mesh.position.set(b.x, b.h / 2, b.z)
      mesh.castShadow = true
      mesh.receiveShadow = true
      scene.add(mesh)
      this.obstacles.push({
        minX: b.x - b.w / 2,
        maxX: b.x + b.w / 2,
        minZ: b.z - b.d / 2,
        maxZ: b.z + b.d / 2,
      })
    }
  }
}
