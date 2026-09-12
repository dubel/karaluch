import {
  Box3,
  BoxGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  Scene,
  type Object3D,
} from 'three'
import type { Aabb } from './collision'
import { ARENA_HALF, HOUSE_TARGET_LENGTH } from './config'
import { sowFoliage, type WindClock } from './foliage'
import { normalizeModel, stripJunk } from './rig'
import { displaceTerrain } from './terrain'

export { ARENA_HALF } from './config'

export class Arena {
  readonly obstacles: Aabb[] = []
  readonly cameraBlockers: Aabb[] = []
  readonly wind: WindClock = { value: 0 }
  private readonly scene: Scene

  constructor(scene: Scene) {
    this.scene = scene
    scene.background = new Color(0x6b7c8a)
    scene.fog = new Fog(0x6b7c8a, 90, 260)

    const hemi = new HemisphereLight(0xc5d4e0, 0x4a4030, 0.85)
    scene.add(hemi)

    const sun = new DirectionalLight(0xffe2b8, 1.45)
    sun.position.set(55, 80, 36)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.near = 4
    sun.shadow.camera.far = 200
    sun.shadow.camera.left = -95
    sun.shadow.camera.right = 95
    sun.shadow.camera.top = 95
    sun.shadow.camera.bottom = -95
    sun.shadow.bias = -0.0004
    scene.add(sun)

    const groundGeo = new PlaneGeometry(ARENA_HALF * 2.25, ARENA_HALF * 2.25, 192, 192)
    groundGeo.rotateX(-Math.PI / 2)
    displaceTerrain(groundGeo)
    const ground = new Mesh(groundGeo, makeGrassMaterial())
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
      this.cameraBlockers.push({
        minX: wall.x - wall.w / 2,
        maxX: wall.x + wall.w / 2,
        minZ: wall.z - wall.d / 2,
        maxZ: wall.z + wall.d / 2,
        minY: 0,
        maxY: wallH,
      })
    }
  }

  tick(dt: number): void {
    this.wind.value += dt
  }

  addHouse(model: Object3D): void {
    stripJunk(model)
    normalizeModel(model, HOUSE_TARGET_LENGTH)
    model.traverse((child) => {
      const mesh = child as Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true
    })
    this.scene.add(model)

    const box = new Box3().setFromObject(model)
    const pad = 0.35
    const aabb = {
      minX: box.min.x - pad,
      maxX: box.max.x + pad,
      minZ: box.min.z - pad,
      maxZ: box.max.z + pad,
      minY: box.min.y,
      maxY: box.max.y + 0.4,
    }
    this.obstacles.push(aabb)
    this.cameraBlockers.push(aabb)
  }

  addFoliage(foliagePack: Object3D, grassPack: Object3D): void {
    sowFoliage(this.scene, foliagePack, grassPack, this.obstacles, this.cameraBlockers, this.wind)
  }
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
    shader.vertexShader = `varying vec3 vWorldPos;\n${shader.vertexShader}`.replace(
      'vViewPosition = - mvPosition.xyz;',
      `vViewPosition = - mvPosition.xyz;
	vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
    )
    shader.fragmentShader = `varying vec3 vWorldPos;
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
	diffuseColor.rgb = mix(diffuseColor.rgb, mud, yard * 0.62);`,
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
  map.repeat.set(28, 28)
  map.anisotropy = 8
  return map
}

function fract(n: number): number {
  return n - Math.floor(n)
}
