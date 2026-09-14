import {
  Box3,
  CapsuleGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Quaternion,
  Vector3,
  type Scene,
} from 'three'
import { KID_MODE, STUKA_LENGTH } from './config'
import { normalizeModel, stripJunk } from './rig'
import { terrainHeight } from './terrain'
import type { Tank } from './Tank'

const BOMB_FALL = 3
const BLAST_RADIUS = 6.1
const PLANE_LIFE = 13.4
const START_DIST = 186
const EXIT_DIST = -72
const START_ALT = 11.4
const DIVE_ALT = 6.4
const EXIT_ALT = 15
const FORMATION = [-16, 0, 16]
const DROP_U = [0.58, 0.63, 0.68]
const STAGGER = [0, 0.35, 0.7]

const bombGeo = new CapsuleGeometry(0.22, 1.28, 3, 8)
const bombMat = new MeshBasicMaterial({ color: 0x08080a })
const BOMB_POOL = 9

const _box = new Box3()
const _center = new Vector3()
const _nose = new Vector3()
const _fwd = new Vector3(0, 0, 1)
const _vel = new Vector3()
const _up = new Vector3(0, 1, 0)
const _q = new Quaternion()

type Plane = {
  root: Group
  props: Object3D[]
  t: number
  delay: number
  dirX: number
  dirZ: number
  sideX: number
  sideZ: number
  offset: number
  aimX: number
  aimZ: number
  dropped: number
  lastX: number
  lastY: number
  lastZ: number
}

type Bomb = {
  mesh: Mesh
  age: number
  sx: number
  sy: number
  sz: number
  ix: number
  iy: number
  iz: number
}

export class StukaRaid {
  private readonly craft: { root: Group; props: Object3D[] }[] = []
  private readonly planes: Plane[] = []
  private readonly bombs: Bomb[] = []
  private readonly bombPool: Mesh[] = []
  private scene: Scene | null = null
  private inbound = false

  get active(): boolean {
    return this.planes.length > 0 || this.bombs.length > 0
  }

  get warning(): boolean {
    return this.inbound
  }

  prime(scene: Scene): void {
    this.scene = scene
    if (this.bombPool.length === 0) {
      for (let i = 0; i < BOMB_POOL; i++) {
        const mesh = new Mesh(bombGeo, bombMat)
        mesh.visible = false
        mesh.castShadow = false
        mesh.receiveShadow = false
        mesh.frustumCulled = true
        this.bombPool.push(mesh)
      }
    }
    for (const mesh of this.bombPool) {
      if (mesh.parent !== scene) scene.add(mesh)
    }
  }

  setTemplate(model: Object3D): void {
    stripJunk(model)
    const extra: Object3D[] = []
    model.traverse((obj) => {
      if (/^sun/i.test(obj.name) || /^empty/i.test(obj.name)) extra.push(obj)
      if (/bomb/i.test(obj.name)) obj.visible = false
      if (/antenna|bombfork|reargun|machinegun/i.test(obj.name)) obj.visible = false
    })
    for (const obj of extra) obj.removeFromParent()
    normalizeModel(model, STUKA_LENGTH)
    alignNoseToPlusZ(model)
    for (const item of this.craft) item.root.removeFromParent()
    this.craft.length = 0
    for (let i = 0; i < 3; i++) {
      const visual = model.clone(true)
      visual.traverse((obj) => {
        const mesh = obj as Mesh
        if (!mesh.isMesh) return
        mesh.castShadow = false
        mesh.receiveShadow = false
        mesh.frustumCulled = true
      })
      const root = new Group()
      root.visible = false
      root.add(visual)
      this.craft.push({ root, props: findProps(visual) })
    }
  }

  begin(polish: Tank[], scene: Scene, facingYaw: number): boolean {
    if (this.craft.length < 3 || this.active) return false
    const living = polish.filter((tank) => tank.alive)
    if (living.length === 0) return false
    this.spawnFormation(living, scene, facingYaw)
    return this.planes.length > 0
  }

  private spawnFormation(living: Tank[], scene: Scene, facingYaw: number): void {
    const dirX = -Math.sin(facingYaw)
    const dirZ = -Math.cos(facingYaw)
    const sideX = dirZ
    const sideZ = -dirX
    const target = firstOnApproach(living, dirX, dirZ)
    const aimX = target.position.x
    const aimZ = target.position.z

    this.scene = scene
    this.inbound = true
    for (let i = 0; i < 3; i++) {
      const craft = this.craft[i]
      const offset = FORMATION[i] + (Math.random() - 0.5) * 1.6
      const t0 = STAGGER[i]
      const start = samplePath(t0 / PLANE_LIFE, dirX, dirZ, sideX, sideZ, offset, aimX, aimZ)
      craft.root.visible = true
      craft.root.position.set(start.x, start.y, start.z)
      faceVelocity(craft.root, dirX, -0.38, dirZ)
      scene.add(craft.root)
      this.planes.push({
        root: craft.root,
        props: craft.props,
        t: t0,
        delay: 0,
        dirX,
        dirZ,
        sideX,
        sideZ,
        offset,
        aimX,
        aimZ,
        dropped: 0,
        lastX: start.x,
        lastY: start.y,
        lastZ: start.z,
      })
    }
  }

  update(
    dt: number,
    polish: Tank[],
    onBurst: (x: number, y: number, z: number) => void,
  ): void {
    for (const plane of this.planes) {
      if (plane.delay > 0) {
        plane.delay -= dt
        continue
      }
      plane.t += dt
      const u = Math.min(1, plane.t / PLANE_LIFE)
      const pos = samplePath(u, plane.dirX, plane.dirZ, plane.sideX, plane.sideZ, plane.offset, plane.aimX, plane.aimZ)
      plane.root.position.set(pos.x, pos.y, pos.z)
      _vel.set(pos.x - plane.lastX, pos.y - plane.lastY, pos.z - plane.lastZ)
      if (_vel.lengthSq() > 1e-8) faceVelocity(plane.root, _vel.x, _vel.y, _vel.z)
      plane.lastX = pos.x
      plane.lastY = pos.y
      plane.lastZ = pos.z
      for (const prop of plane.props) prop.rotateZ(dt * 58)
      while (plane.dropped < 3 && u >= DROP_U[plane.dropped]) {
        this.releaseBomb(plane, polish)
        plane.dropped += 1
      }
    }

    for (let i = this.planes.length - 1; i >= 0; i--) {
      if (this.planes[i].t < PLANE_LIFE + 0.2) continue
      parkCraft(this.planes[i].root)
      this.planes.splice(i, 1)
    }

    this.inbound = this.planes.some((plane) => plane.t / PLANE_LIFE < 0.78)

    for (const bomb of this.bombs) {
      bomb.age += dt
      const u = Math.min(1, bomb.age / BOMB_FALL)
      const p = bomb.mesh.position
      p.x = bomb.sx + (bomb.ix - bomb.sx) * u
      p.z = bomb.sz + (bomb.iz - bomb.sz) * u
      p.y = bomb.sy + (bomb.iy - bomb.sy) * u * u
      _vel.set(bomb.ix - bomb.sx, 2 * u * (bomb.iy - bomb.sy), bomb.iz - bomb.sz)
      if (_vel.lengthSq() > 1e-8) {
        bomb.mesh.quaternion.setFromUnitVectors(_up, _vel.normalize())
      }
    }

    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const bomb = this.bombs[i]
      const ground = terrainHeight(bomb.mesh.position.x, bomb.mesh.position.z) + 0.12
      if (bomb.age < BOMB_FALL && bomb.mesh.position.y > ground) continue
      const x = bomb.mesh.position.x
      const z = bomb.mesh.position.z
      const y = terrainHeight(x, z)
      bomb.mesh.visible = false
      this.bombs.splice(i, 1)
      onBurst(x, y, z)
    }
  }

  clear(): void {
    for (const plane of this.planes) parkCraft(plane.root)
    for (const bomb of this.bombs) bomb.mesh.visible = false
    this.planes.length = 0
    this.bombs.length = 0
    this.inbound = false
  }

  private releaseBomb(plane: Plane, polish: Tank[]): void {
    if (!this.scene) return
    const mesh = this.bombPool.find((item) => !item.visible)
    if (!mesh) return
    const target = nearestAlive(polish, plane.root.position.x, plane.root.position.z)
    const jitter = KID_MODE ? 7 + Math.random() * 8 : 3.2 + Math.random() * 5.4
    const yaw = Math.random() * Math.PI * 2
    const stick = (plane.dropped - 1) * 3.4
    let ix: number
    let iz: number
    if (target) {
      ix = target.position.x + Math.sin(yaw) * jitter + plane.dirX * stick
      iz = target.position.z + Math.cos(yaw) * jitter + plane.dirZ * stick
    } else {
      ix = plane.root.position.x + plane.dirX * 18 + Math.sin(yaw) * 8
      iz = plane.root.position.z + plane.dirZ * 18 + Math.cos(yaw) * 8
    }
    mesh.visible = true
    mesh.position.copy(plane.root.position)
    mesh.position.y -= 1.1
    this.bombs.push({
      mesh,
      age: 0,
      sx: mesh.position.x,
      sy: mesh.position.y,
      sz: mesh.position.z,
      ix,
      iy: terrainHeight(ix, iz) + 0.1,
      iz,
    })
  }
}

export const STUKA_BLAST = BLAST_RADIUS

function samplePath(
  u: number,
  dirX: number,
  dirZ: number,
  sideX: number,
  sideZ: number,
  offset: number,
  aimX: number,
  aimZ: number,
): { x: number; y: number; z: number } {
  const t = u ** 1.06
  const remaining = START_DIST + (EXIT_DIST - START_DIST) * t
  const x = aimX - dirX * remaining + sideX * offset
  const z = aimZ - dirZ * remaining + sideZ * offset
  let alt = START_ALT
  if (u < 0.62) {
    alt = START_ALT + (DIVE_ALT - START_ALT) * (u / 0.62)
  } else if (u < 0.72) {
    alt = DIVE_ALT
  } else {
    const p = (u - 0.72) / 0.28
    alt = DIVE_ALT + (EXIT_ALT - DIVE_ALT) * p * p * (3 - 2 * p)
  }
  return { x, y: terrainHeight(x, z) + alt, z }
}

function firstOnApproach(tanks: Tank[], dirX: number, dirZ: number): Tank {
  let best = tanks[0]
  let bestP = best.position.x * dirX + best.position.z * dirZ
  for (const tank of tanks) {
    const p = tank.position.x * dirX + tank.position.z * dirZ
    if (p < bestP) {
      best = tank
      bestP = p
    }
  }
  return best
}

function nearestAlive(tanks: Tank[], fromX: number, fromZ: number): Tank | null {
  let best: Tank | null = null
  let bestD = Infinity
  for (const tank of tanks) {
    if (!tank.alive) continue
    const d = Math.hypot(tank.position.x - fromX, tank.position.z - fromZ)
    if (d < bestD) {
      best = tank
      bestD = d
    }
  }
  return best
}

function parkCraft(root: Group): void {
  root.visible = false
  root.removeFromParent()
}

function findProps(root: Object3D): Object3D[] {
  const list: Object3D[] = []
  root.traverse((obj) => {
    if (/^spinner/i.test(obj.name)) list.push(obj)
  })
  return list
}

function alignNoseToPlusZ(root: Object3D): void {
  root.updateMatrixWorld(true)
  let spinner: Object3D | undefined
  root.traverse((obj) => {
    if (!spinner && /spinner/i.test(obj.name)) spinner = obj
  })
  if (!spinner) return
  _box.setFromObject(root)
  _box.getCenter(_center)
  spinner.getWorldPosition(_nose)
  _nose.sub(_center)
  if (_nose.lengthSq() < 1e-6) return
  _nose.normalize()
  _q.setFromUnitVectors(_nose, _fwd)
  root.quaternion.premultiply(_q)
  root.updateMatrixWorld(true)
}

function faceVelocity(object: Object3D, vx: number, vy: number, vz: number): void {
  _vel.set(vx, vy, vz)
  if (_vel.lengthSq() < 1e-10) return
  object.quaternion.setFromUnitVectors(_fwd, _vel.normalize())
}
