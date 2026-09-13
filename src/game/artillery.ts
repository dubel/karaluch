import {
  CylinderGeometry,
  Mesh,
  MeshStandardMaterial,
  Vector3,
  type Scene,
} from 'three'
import { ARTY_HIT_CHANCE, ARTY_SHELLS_PER_TANK } from './config'
import { terrainHeight } from './terrain'
import type { Tank } from './Tank'

const geometry = new CylinderGeometry(0.07, 0.16, 1.15, 7)
const _dir = new Vector3()
const _up = new Vector3(0, 1, 0)

type Shell = {
  mesh: Mesh
  vx: number
  vy: number
  vz: number
  lethal: boolean
  tank: Tank
  alive: boolean
  delay: number
}

export class ArtilleryBarrage {
  private readonly shells: Shell[] = []

  get active(): boolean {
    return this.shells.length > 0
  }

  start(targets: Tank[], scene: Scene): void {
    this.clear()
    let n = 0
    for (const tank of targets) {
      if (!tank.alive) continue
      for (let i = 0; i < ARTY_SHELLS_PER_TANK; i++) {
        const hit = Math.random() < ARTY_HIT_CHANCE
        const yaw = Math.random() * Math.PI * 2
        const miss = hit ? 0.35 + Math.random() * 0.7 : 9 + Math.random() * 10
        const ix = tank.position.x + Math.sin(yaw) * miss
        const iz = tank.position.z + Math.cos(yaw) * miss
        const iy = terrainHeight(ix, iz)
        const inbound = 0.7 + Math.random() * 1.4
        const sx = ix + Math.sin(yaw + 0.6) * (16 + inbound * 8)
        const sz = iz + Math.cos(yaw + 0.6) * (16 + inbound * 8)
        const sy = iy + 46 + Math.random() * 18
        _dir.set(ix - sx, iy - sy, iz - sz)
        const dist = Math.max(_dir.length(), 0.01)
        const speed = 38 + Math.random() * 10
        _dir.multiplyScalar(speed / dist)
        const mesh = new Mesh(
          geometry,
          new MeshStandardMaterial({
            color: 0x3a3428,
            emissive: 0x6a2a08,
            emissiveIntensity: 1.1,
            roughness: 0.45,
            metalness: 0.4,
          }),
        )
        mesh.position.set(sx, sy, sz)
        mesh.castShadow = true
        mesh.visible = false
        scene.add(mesh)
        this.shells.push({
          mesh,
          vx: _dir.x,
          vy: _dir.y,
          vz: _dir.z,
          lethal: hit,
          tank,
          alive: true,
          delay: n * 0.07 + i * 0.11,
        })
        n += 1
      }
    }
  }

  update(dt: number, onBurst: (x: number, y: number, z: number, tank: Tank | null) => void): void {
    for (const shell of this.shells) {
      if (!shell.alive) continue
      shell.delay -= dt
      if (shell.delay > 0) continue
      shell.mesh.visible = true
      const p = shell.mesh.position
      p.x += shell.vx * dt
      p.y += shell.vy * dt
      p.z += shell.vz * dt
      _dir.set(shell.vx, shell.vy, shell.vz)
      if (_dir.lengthSq() > 1e-6) {
        if (Math.abs(_dir.x) + Math.abs(_dir.z) < 1e-4) _dir.x = 0.04
        shell.mesh.quaternion.setFromUnitVectors(_up, _dir.normalize())
      }
      const ground = terrainHeight(p.x, p.z) + 0.15
      if (p.y <= ground || p.y < -1) {
        p.y = ground
        shell.alive = false
        shell.mesh.visible = false
        const victim = shell.lethal && shell.tank.alive ? shell.tank : null
        onBurst(p.x, p.y, p.z, victim)
      }
    }
    for (let i = this.shells.length - 1; i >= 0; i--) {
      if (this.shells[i].alive) continue
      this.shells[i].mesh.removeFromParent()
      this.shells.splice(i, 1)
    }
  }

  clear(): void {
    for (const shell of this.shells) shell.mesh.removeFromParent()
    this.shells.length = 0
  }
}
