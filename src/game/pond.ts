import {
  Box3,
  BufferAttribute,
  CircleGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  ShaderMaterial,
  Vector3,
  type BufferGeometry,
  type Object3D,
  type Scene,
} from 'three'
import type { Aabb } from './collision'
import { rawTerrainHeight, wrapTerrainGrade } from './terrain'
import type { WindClock } from './foliage'
import { normalizeModel, stripJunk } from './rig'

/** SW grove — off the road, village, mill and both spawns. */
export const POND = {
  x: -84,
  z: -72,
  yaw: 0.58,
  rx: 28.8,
  rz: 22.4,
  inner: 0.48,
  outer: 1.36,
  depth: 0.72,
}

export const WHARF_LENGTH = 3.84
export const BOAT_LENGTH = 3.5

const _c = Math.cos(POND.yaw)
const _s = Math.sin(POND.yaw)

let basinReady = false
let baseY = 0
let waterY = 0
const _rippleA = new Vector3()
const _rippleB = new Vector3()

type MooredBoat = {
  root: Group
  restY: number
}

let boat: MooredBoat | null = null

function shoreTowardVillage(): { nx: number; nz: number } {
  const towardX = -POND.x
  const towardZ = -POND.z
  const inv = 1 / Math.max(Math.hypot(towardX, towardZ), 0.01)
  return { nx: towardX * inv, nz: towardZ * inv }
}

export function wharfShore(): { nx: number; nz: number; dist: number } {
  const { nx, nz } = shoreTowardVillage()
  return { nx, nz, dist: (POND.rx + POND.rz) * 0.5 * 0.88 }
}

/** Sandy clearing on the village shore: waterline out to the reed wall. */
export const BEACH = {
  halfWidth: 18,
  innerU: 0.96,
  outerU: 1.55,
}

/** Pier, boat and the beach — keep this belt clear of reeds. */
export function nearWharf(x: number, z: number): boolean {
  const { nx, nz, dist } = wharfShore()
  const dx = x - POND.x
  const dz = z - POND.z
  const along = dx * nx + dz * nz
  const side = -dx * nz + dz * nx
  if (Math.abs(side) > BEACH.halfWidth) return false
  if (along < dist - 10) return false
  return pondU(x, z) < BEACH.outerU
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

export function pondU(x: number, z: number): number {
  const dx = x - POND.x
  const dz = z - POND.z
  const lx = dx * _c + dz * _s
  const lz = -dx * _s + dz * _c
  return Math.hypot(lx / POND.rx, lz / POND.rz)
}

export function pondContains(x: number, z: number): boolean {
  return pondU(x, z) < 1
}

/** Hull is actually in the water, not just on the beach inside the pond ellipse. */
export function pondWading(x: number, z: number, hullY: number): boolean {
  return pondContains(x, z) && hullY < waterY - 0.1
}

/** One-time vertex mask on the terrain mesh — follows the slope, no extra draw. */
export function paintBeachVertices(geo: BufferGeometry): void {
  const pos = geo.getAttribute('position')
  const data = new Float32Array(pos.count * 3)
  const { nx, nz, dist } = wharfShore()
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const dx = x - POND.x
    const dz = z - POND.z
    const along = dx * nx + dz * nz
    const side = -dx * nz + dz * nx
    const u = pondU(x, z)
    let beach = 0
    if (along >= dist - 10) {
      const w = 1 - smoothstep(BEACH.halfWidth - 1.5, BEACH.halfWidth + 3.5, Math.abs(side))
      const ring =
        smoothstep(BEACH.innerU - 0.05, BEACH.innerU, u) *
        (1 - smoothstep(BEACH.outerU - 0.12, BEACH.outerU + 0.08, u))
      beach = w * ring
    }
    data[i * 3] = beach
    data[i * 3 + 1] = 1 - smoothstep(0.98, 1.14, u)
    data[i * 3 + 2] = 0
  }
  geo.setAttribute('color', new BufferAttribute(data, 3))
}

export function pondWaterY(): number {
  return waterY
}

export function installPondBasin(): void {
  if (basinReady) return
  baseY = rawTerrainHeight(POND.x, POND.z)
  const tShore = 1 - smoothstep(POND.inner, POND.outer, 1)
  waterY = baseY - POND.depth * tShore * tShore + 0.03
  wrapTerrainGrade((x, z, h) => {
    const u = pondU(x, z)
    if (u >= POND.outer) return h
    const t = 1 - smoothstep(POND.inner, POND.outer, u)
    return h + (baseY - h) * t - POND.depth * t * t
  })
  basinReady = true
}

export function addPond(scene: Scene, wind: WindClock): void {
  installPondBasin()
  const bedGeo = new CircleGeometry(1, 56)
  bedGeo.rotateX(-Math.PI / 2)
  const bedMat = new MeshStandardMaterial({
    color: 0xc49a4a,
    roughness: 0.92,
    metalness: 0.06,
  })
  bedMat.customProgramCacheKey = () => 'pond-bed-gold'
  bedMat.onBeforeCompile = (shader) => {
    shader.vertexShader = `varying vec2 vBedUv;\n${shader.vertexShader}`.replace(
      '#include <uv_vertex>',
      `#include <uv_vertex>
	vBedUv = uv;`,
    )
    shader.fragmentShader = `varying vec2 vBedUv;
${shader.fragmentShader}`.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
	float g = fract(sin(dot(vBedUv * 48.0, vec2(12.9898, 78.233))) * 43758.5453);
	float ring = smoothstep(0.72, 1.0, length(vBedUv * 2.0 - 1.0));
	diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.78, 0.58, 0.28), g * 0.28);
	diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.36, 0.24, 0.12), ring * 0.45);`,
    )
  }
  const bed = new Mesh(bedGeo, bedMat)
  bed.position.set(POND.x, waterY - 0.1, POND.z)
  bed.scale.set(POND.rx * 0.98, 1, POND.rz * 0.98)
  bed.rotation.y = POND.yaw
  bed.receiveShadow = true
  bed.castShadow = false
  bed.renderOrder = 0
  scene.add(bed)

  const waterGeo = new CircleGeometry(1, 64)
  waterGeo.rotateX(-Math.PI / 2)
  const waterMat = new ShaderMaterial({
    uniforms: {
      uTime: wind,
      uWindDirX: wind.dirX,
      uWindDirZ: wind.dirZ,
      uWindStrength: wind.strength,
      uRippleA: { value: _rippleA },
      uRippleB: { value: _rippleB },
      uDeep: { value: new Color(0x081c22) },
      uShallow: { value: new Color(0x1e463c) },
      uSky: { value: new Color(0x4e6a72) },
    },
    vertexShader: /* glsl */ `
uniform float uTime;
varying vec3 vWorldPos;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec3 p = position;
  float w = sin(uv.x * 18.0 + uTime * 1.15) * 0.018 + cos(uv.y * 14.0 - uTime * 0.9) * 0.012;
  p.y += w;
  vec4 world = modelMatrix * vec4(p, 1.0);
  vWorldPos = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}`,
    fragmentShader: /* glsl */ `
uniform float uTime;
uniform float uWindDirX;
uniform float uWindDirZ;
uniform float uWindStrength;
uniform vec3 uRippleA;
uniform vec3 uRippleB;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uSky;
varying vec3 vWorldPos;
varying vec2 vUv;

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
    p = p * 2.07 + 11.3;
    a *= 0.5;
  }
  return v;
}
float ripple(vec3 u, vec2 wp) {
  if (u.z < 0.02) return 0.0;
  float d = length(wp - u.xy);
  float wave = sin(d * 9.2 - uTime * 7.5);
  return exp(-d * 0.55) * wave * u.z * 0.45;
}
void main() {
  vec2 wp = vWorldPos.xz;
  vec2 flow = vec2(uWindDirX, uWindDirZ) * uTime * (0.08 + uWindStrength * 0.12);
  float n = fbm(wp * 0.22 + flow);
  float n2 = fbm(wp * 0.55 - flow.yx * 0.7);
  float depth = 1.0 - length(vUv * 2.0 - 1.0);
  vec3 col = mix(uShallow, uDeep, clamp(depth * 0.85 + n * 0.2, 0.0, 1.0));
  col = mix(col, uSky, 0.18 + n2 * 0.12);
  float spark = pow(max(n2 * n, 0.0), 7.0) * 1.8;
  col += vec3(0.95, 0.9, 0.7) * spark;
  float rim = 1.0 - smoothstep(0.78, 1.0, length(vUv * 2.0 - 1.0));
  col = mix(vec3(0.42, 0.38, 0.24), col, rim * 0.55 + 0.45);
  col += ripple(uRippleA, wp) * vec3(0.55, 0.7, 0.72);
  col += ripple(uRippleB, wp) * vec3(0.55, 0.7, 0.72);
  float alpha = 0.58 + depth * 0.3 + spark * 0.1;
  gl_FragColor = vec4(col, alpha);
}`,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: false,
  })
  const water = new Mesh(waterGeo, waterMat)
  water.position.set(POND.x, waterY, POND.z)
  water.scale.set(POND.rx, 1, POND.rz)
  water.rotation.y = POND.yaw
  water.receiveShadow = false
  water.castShadow = false
  water.renderOrder = 3
  water.frustumCulled = true
  scene.add(water)
}

export function tickPond(
  tanks: { position: { x: number; z: number }; vx: number; vz: number; alive: boolean }[],
  wind: WindClock,
): void {
  _rippleA.set(0, 0, 0)
  _rippleB.set(0, 0, 0)
  let filled = 0
  for (const tank of tanks) {
    if (!tank.alive || !pondContains(tank.position.x, tank.position.z)) continue
    const spd = Math.hypot(tank.vx, tank.vz)
    const str = Math.min(1.15, 0.22 + spd * 0.12)
    if (filled === 0) _rippleA.set(tank.position.x, tank.position.z, str)
    else {
      _rippleB.set(tank.position.x, tank.position.z, str)
      break
    }
    filled += 1
  }
  if (boat) {
    const t = wind.value
    const gust = 0.7 + wind.strength.value * 0.5
    boat.root.position.y = boat.restY + Math.sin(t * 1.15) * 0.05 * gust
    boat.root.rotation.x = Math.sin(t * 1.05 + 0.4) * 0.04 * gust
    boat.root.rotation.z = Math.cos(t * 0.82) * 0.055 * gust
  }
}

export function placeWharf(scene: Scene, model: Object3D, obstacles: Aabb[], cameraBlockers: Aabb[]): void {
  stripJunk(model)
  normalizeModel(model, WHARF_LENGTH)
  const { nx, nz } = shoreTowardVillage()
  const dist = (POND.rx + POND.rz) * 0.5 * 0.88
  const x = POND.x + nx * dist
  const z = POND.z + nz * dist
  model.position.x += x
  model.position.z += z
  model.position.y += pondWaterY() - 0.82
  model.rotation.y += Math.atan2(-nx, -nz)
  model.traverse((child) => {
    const mesh = child as Mesh
    if (!mesh.isMesh) return
    mesh.castShadow = true
    mesh.receiveShadow = true
  })
  scene.add(model)

  const box = new Box3().setFromObject(model)
  const cx = (box.min.x + box.max.x) * 0.5
  const cz = (box.min.z + box.max.z) * 0.5
  const hx = Math.min((box.max.x - box.min.x) * 0.5, 1.15)
  const hz = Math.min((box.max.z - box.min.z) * 0.5, 2.0)
  const aabb: Aabb = {
    minX: cx - hx,
    maxX: cx + hx,
    minZ: cz - hz,
    maxZ: cz + hz,
    minY: box.min.y,
    maxY: box.max.y + 0.3,
  }
  obstacles.push(aabb)
  cameraBlockers.push(aabb)
}

export function placeBoat(scene: Scene, model: Object3D, obstacles: Aabb[], cameraBlockers: Aabb[]): void {
  stripJunk(model)
  normalizeModel(model, BOAT_LENGTH)
  const { nx, nz } = shoreTowardVillage()
  const dist = (POND.rx + POND.rz) * 0.5 * 0.88
  const tx = -nz
  const tz = nx
  const x = POND.x + nx * (dist - 3.4) + tx * 4.5
  const z = POND.z + nz * (dist - 3.4) + tz * 4.5
  const restY = pondWaterY() - 0.26
  const root = new Group()
  root.rotation.order = 'YXZ'
  root.position.set(x, restY, z)
  root.rotation.y = Math.atan2(-nx, -nz) + 0.18
  model.traverse((child) => {
    const mesh = child as Mesh
    if (!mesh.isMesh) return
    mesh.castShadow = true
    mesh.receiveShadow = true
  })
  root.add(model)
  scene.add(root)
  boat = { root, restY }

  const box = new Box3().setFromObject(root)
  const cx = (box.min.x + box.max.x) * 0.5
  const cz = (box.min.z + box.max.z) * 0.5
  const hx = Math.min((box.max.x - box.min.x) * 0.5, 0.85)
  const hz = Math.min((box.max.z - box.min.z) * 0.5, 1.9)
  const aabb: Aabb = {
    minX: cx - hx,
    maxX: cx + hx,
    minZ: cz - hz,
    maxZ: cz + hz,
    minY: box.min.y,
    maxY: box.max.y + 0.2,
  }
  obstacles.push(aabb)
  cameraBlockers.push(aabb)
}
