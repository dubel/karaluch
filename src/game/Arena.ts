import {
  Box3,
  CanvasTexture,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  Scene,
  Vector3,
  type Object3D,
  type PerspectiveCamera,
  type Texture,
} from 'three'
import type { Aabb } from './collision'
import { ARENA_HALF, HOUSE_TARGET_LENGTH, type VillageProp } from './config'
import { sowFoliage, type WindClock } from './foliage'
import { installPerimeter } from './perimeter'
import { createRoadMesh, installRoadGrade } from './road'
import { normalizeModel, stripJunk } from './rig'
import { displaceTerrain } from './terrain'
import { Atmosphere, atmosWetness } from './atmosphere'

export { ARENA_HALF } from './config'

export class Arena {
  readonly obstacles: Aabb[] = []
  readonly cameraBlockers: Aabb[] = []
  /** Extra shot volumes (tree crowns). Trunks/buildings live in `obstacles`. */
  readonly cover: Aabb[] = []
  readonly wind: WindClock = {
    value: 0,
    strength: { value: 0.5 },
    dirX: { value: 0.85 },
    dirZ: { value: 0.35 },
  }
  readonly atmosphere: Atmosphere
  private readonly scene: Scene
  private readonly groundMat: MeshStandardMaterial
  private millSails: Object3D | null = null
  private readonly millAxis = new Vector3(0, 0, 1)

  constructor(scene: Scene) {
    this.scene = scene
    this.atmosphere = new Atmosphere(scene, this.wind)

    const groundGeo = new PlaneGeometry(ARENA_HALF * 2.18, ARENA_HALF * 2.18, 256, 256)
    groundGeo.rotateX(-Math.PI / 2)
    installRoadGrade()
    displaceTerrain(groundGeo)
    this.groundMat = makeGrassMaterial()
    const ground = new Mesh(groundGeo, this.groundMat)
    ground.receiveShadow = true
    scene.add(ground)
  }

  addPerimeter(pack: Object3D): void {
    installPerimeter(this.scene, pack, this.obstacles)
  }

  tick(dt: number, camera: PerspectiveCamera, follow: Vector3): void {
    this.atmosphere.tick(dt, camera, follow)
    this.groundMat.roughness = 0.94 - this.atmosphere.wetness * 0.28
    this.groundMat.metalness = 0.02 + this.atmosphere.wetness * 0.08
    if (this.millSails) this.millSails.rotateOnAxis(this.millAxis, dt * 0.22)
  }

  addRoad(map: Texture): void {
    const road = createRoadMesh(map)
    road.traverse((child) => {
      const mesh = child as Mesh
      if (!mesh.isMesh) return
      mesh.receiveShadow = true
      mesh.castShadow = false
    })
    this.scene.add(road)
  }

  addHouse(model: Object3D): void {
    this.placeProp(model, {
      length: HOUSE_TARGET_LENGTH,
      x: 0,
      z: 0,
      yaw: 0,
      collideHx: 7.2,
      collideHz: 7.2,
    })
  }

  addVillageProp(model: Object3D, spec: VillageProp): void {
    this.placeProp(model, spec)
    if (spec.spinSails) {
      const sails = rigMillSails(model)
      this.millSails = sails.pivot
      this.millAxis.copy(sails.axis)
    }
  }

  private placeProp(
    model: Object3D,
    spec: { length: number; x: number; z: number; yaw: number; collideHx: number; collideHz: number },
  ): void {
    stripJunk(model)
    normalizeModel(model, spec.length)
    model.rotation.y = spec.yaw
    model.position.x += spec.x
    model.position.z += spec.z
    model.traverse((child) => {
      const mesh = child as Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true
    })
    this.scene.add(model)

    const box = new Box3().setFromObject(model)
    const cx = (box.min.x + box.max.x) * 0.5
    const cz = (box.min.z + box.max.z) * 0.5
    const pad = 0.2
    const hx = Math.min((box.max.x - box.min.x) * 0.5 + pad, spec.collideHx)
    const hz = Math.min((box.max.z - box.min.z) * 0.5 + pad, spec.collideHz)
    const aabb = {
      minX: cx - hx,
      maxX: cx + hx,
      minZ: cz - hz,
      maxZ: cz + hz,
      minY: box.min.y,
      maxY: box.max.y + 0.4,
    }
    this.obstacles.push(aabb)
    this.cameraBlockers.push(aabb)
  }

  addFoliage(foliagePack: Object3D, grassPack: Object3D): void {
    sowFoliage(this.scene, foliagePack, grassPack, this.obstacles, this.cameraBlockers, this.cover, this.wind)
  }
}

function rigMillSails(model: Object3D): { pivot: Object3D; axis: Vector3 } {
  const vane = model.getObjectByName('vane') ?? model.getObjectByName('vane_tile_0')
  if (!vane) {
    return { pivot: new Group(), axis: new Vector3(1, 0, 0) }
  }
  return { pivot: vane, axis: new Vector3(1, 0, 0) }
}

function makeGrassMaterial(): MeshStandardMaterial {
  const map = makeGrassMap()
  const material = new MeshStandardMaterial({
    color: 0xc5c4a4,
    map,
    roughness: 0.94,
    metalness: 0.02,
  })
  material.customProgramCacheKey = () => 'arena-grass-field'
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWetness = atmosWetness
    shader.vertexShader = `varying vec3 vWorldPos;\n${shader.vertexShader}`.replace(
      'vViewPosition = - mvPosition.xyz;',
      `vViewPosition = - mvPosition.xyz;
	vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
    )
    shader.fragmentShader = `varying vec3 vWorldPos;
uniform float uWetness;
float hash12(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * 0.1031);
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.x + p3.y) * p3.z);
}
float noise2(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	float a = hash12(i);
	float b = hash12(i + vec2(1.0, 0.0));
	float c = hash12(i + vec2(0.0, 1.0));
	float d = hash12(i + vec2(1.0, 1.0));
	return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
	float v = 0.0;
	float a = 0.5;
	for (int i = 0; i < 4; i++) {
		v += a * noise2(p);
		p = p * 2.03 + 13.17;
		a *= 0.5;
	}
	return v;
}
${shader.fragmentShader}`.replace(
      'diffuseColor *= sampledDiffuseColor;',
      `diffuseColor *= sampledDiffuseColor;
	vec2 wp = vWorldPos.xz;
	float n = fbm(wp * 0.07);
	float n2 = fbm(wp * 0.022 + 9.4);
	float n3 = fbm(wp * 0.13 + 2.7);
	vec3 lush = vec3(0.28, 0.42, 0.16);
	vec3 dry = vec3(0.55, 0.48, 0.22);
	vec3 dirt = vec3(0.42, 0.32, 0.18);
	vec3 mud = vec3(0.34, 0.27, 0.16);
	diffuseColor.rgb = mix(diffuseColor.rgb, lush, 0.25 + n * 0.45);
	diffuseColor.rgb = mix(diffuseColor.rgb, dry, smoothstep(0.48, 0.78, n2) * 0.7);
	diffuseColor.rgb = mix(diffuseColor.rgb, dirt, smoothstep(0.58, 0.86, n3) * 0.65);
	float yard = 1.0 - smoothstep(6.0, 15.0, length(wp) + (n2 - 0.5) * 5.0);
	diffuseColor.rgb = mix(diffuseColor.rgb, mud, yard * 0.62);
	diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.46, 0.5, 0.52), uWetness * 0.78);`,
    )
  }
  return material
}

function makeGrassMap(): CanvasTexture {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Brak canvas 2d')
  const image = ctx.createImageData(size, size)
  const data = image.data
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const n = fract(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453)
      const n2 = fract(Math.sin(x * 3.71 + y * 9.13) * 24634.6345)
      const blade = fract(Math.sin((x * 0.35 + n2 * 8.0) * 17.2 + y * 41.7) * 9187.2)
      const r = 72 + n * 38 + blade * 22
      const g = 92 + n * 36 + (1.0 - n2) * 28
      const b = 38 + n * 18
      data[i] = r
      data[i + 1] = g
      data[i + 2] = b
      data[i + 3] = 255
    }
  }
  ctx.putImageData(image, 0, 0)
  const map = new CanvasTexture(canvas)
  map.colorSpace = SRGBColorSpace
  map.wrapS = RepeatWrapping
  map.wrapT = RepeatWrapping
  map.repeat.set(48, 48)
  map.anisotropy = 8
  return map
}

function fract(n: number): number {
  return n - Math.floor(n)
}
