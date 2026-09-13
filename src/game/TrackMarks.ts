import {
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Euler,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from 'three'
import { terrainHeight } from './terrain'
import type { Tank } from './Tank'

const MAX = 1800
const SPACING = 0.25
const TTL = 13
const _m = new Matrix4()
const _q = new Quaternion()
const _e = new Euler(0, 0, 0, 'XYZ')
const _p = new Vector3()
const _s = new Vector3(1, 1, 1)
const _c = new Color()
const _black = new Color(0x1a140e)
const _gray = new Color(0x4a4538)
const _pale = new Color(0x6e6c50)
const _gone = new Color(0x6b7348)

type LastPose = { x: number; z: number; yaw: number }

export class TrackMarks {
  readonly mesh: InstancedMesh
  private readonly ages = new Float32Array(MAX)
  private readonly live = new Uint8Array(MAX)
  private readonly last = new Map<string, LastPose>()
  private readonly padW = new Float32Array(MAX)
  private cursor = 0

  constructor() {
    const geo = new PlaneGeometry(1, 0.16)
    geo.rotateX(-Math.PI / 2)
    const mat = new MeshBasicMaterial({
      color: 0xffffff,
      side: DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
      depthWrite: false,
      toneMapped: false,
    })
    this.mesh = new InstancedMesh(geo, mat, MAX)
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 2
    this.mesh.castShadow = false
    this.mesh.receiveShadow = false
    _s.set(0, 0, 0)
    for (let i = 0; i < MAX; i++) {
      this.ages[i] = TTL
      this.mesh.setMatrixAt(i, _m.compose(_p, _q, _s))
      this.mesh.setColorAt(i, _gone)
    }
    this.mesh.instanceMatrix.needsUpdate = true
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true
  }

  clear(): void {
    this.last.clear()
    _s.set(0, 0, 0)
    for (let i = 0; i < MAX; i++) {
      this.live[i] = 0
      this.ages[i] = TTL
      this.mesh.setMatrixAt(i, _m.compose(_p, _q, _s))
    }
    this.mesh.instanceMatrix.needsUpdate = true
  }

  stamp(tank: Tank): void {
    if (!tank.alive) return
    const yaw = tank.hullYaw
    const sin = Math.sin(yaw)
    const cos = Math.cos(yaw)
    const x = tank.position.x - sin * 0.45
    const z = tank.position.z - cos * 0.45
    const prev = this.last.get(tank.id)
    if (prev) {
      const moved = Math.hypot(x - prev.x, z - prev.z)
      let dyaw = yaw - prev.yaw
      while (dyaw > Math.PI) dyaw -= Math.PI * 2
      while (dyaw < -Math.PI) dyaw += Math.PI * 2
      if (moved < SPACING && Math.abs(dyaw) < 0.09) return
    }
    this.last.set(tank.id, { x, z, yaw })
    const side = Math.max(tank.halfWidth * 0.72, 0.48)
    const width = Math.max(tank.halfWidth * 0.24, 0.12)
    this.place(x + cos * side, z - sin * side, yaw, width)
    this.place(x - cos * side, z + sin * side, yaw, width)
  }

  update(dt: number): void {
    let matrixChanged = false
    let colorChanged = false
    for (let i = 0; i < MAX; i++) {
      if (!this.live[i]) continue
      this.ages[i] += dt
      if (this.ages[i] >= TTL) {
        this.live[i] = 0
        _s.set(0, 0, 0)
        this.mesh.setMatrixAt(i, _m.compose(_p, _q, _s))
        matrixChanged = true
        continue
      }
      const fade = markStyle(this.ages[i], _c)
      this.mesh.setColorAt(i, _c)
      colorChanged = true
      if (fade < 0.999) {
        this.mesh.getMatrixAt(i, _m)
        _m.decompose(_p, _q, _s)
        _s.set(this.padW[i] * fade, fade, fade)
        this.mesh.setMatrixAt(i, _m.compose(_p, _q, _s))
        matrixChanged = true
      }
    }
    if (matrixChanged) this.mesh.instanceMatrix.needsUpdate = true
    if (colorChanged && this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true
  }

  private place(x: number, z: number, yaw: number, width: number): void {
    const i = this.cursor
    this.cursor = (this.cursor + 1) % MAX
    this.live[i] = 1
    this.ages[i] = 0
    this.padW[i] = width
    _e.set(0, yaw, 0)
    _q.setFromEuler(_e)
    _p.set(x, terrainHeight(x, z) + 0.08, z)
    _s.set(width, 1, 1)
    this.mesh.setMatrixAt(i, _m.compose(_p, _q, _s))
    this.mesh.setColorAt(i, _black)
    this.mesh.instanceMatrix.needsUpdate = true
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true
  }
}

function markStyle(age: number, into: Color): number {
  const t = age / TTL
  if (t < 0.2) {
    into.copy(_black)
    return 1
  }
  if (t < 0.45) {
    into.lerpColors(_black, _gray, (t - 0.2) / 0.25)
    return 1
  }
  if (t < 0.72) {
    into.lerpColors(_gray, _pale, (t - 0.45) / 0.27)
    return 1
  }
  into.lerpColors(_pale, _gone, (t - 0.72) / 0.28)
  return Math.max(0, 1 - (t - 0.72) / 0.28)
}
