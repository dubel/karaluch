import {
  Clock,
  LoadingManager,
  PCFSoftShadowMap,
  Scene,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  WebGLRenderer,
} from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { Arena } from './Arena'
import { FollowCamera } from './camera'
import { collidesAny, pointHitsObb } from './collision'
import {
  ARENA_HALF,
  BOT_RIG,
  BOT_SPAWN,
  FOLIAGE_URL,
  GRASS_PATCH_URL,
  HOUSE_URL,
  PLAYER_RIG,
  PLAYER_SPAWN,
  ROAD_DIFF_URL,
} from './config'
import { Input } from './input'
import { Projectile } from './Projectile'
import { Tank } from './Tank'
import { terrainHeight } from './terrain'
import { TrackMarks } from './TrackMarks'
import { GameAudio } from './audio'
import { CombatFx } from './fx'
import type { Hud } from '../ui/hud'

export class Game {
  private readonly renderer: WebGLRenderer
  private readonly scene = new Scene()
  private readonly cameraRig = new FollowCamera()
  private readonly clock = new Clock()
  private readonly input: Input
  private readonly hud: Hud
  private readonly aimPoint = new Vector3()
  private readonly projectiles: Projectile[] = []
  private readonly tracks = new TrackMarks()
  private readonly audio = new GameAudio()
  private readonly fx = new CombatFx()
  private arena!: Arena
  private player!: Tank
  private botTank!: Tank
  private playing = false
  private roundOver = false

  constructor(canvas: HTMLCanvasElement, hud: Hud) {
    this.hud = hud
    this.input = new Input(canvas)
    this.renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    this.renderer.outputColorSpace = SRGBColorSpace
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = PCFSoftShadowMap
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.resize()
    window.addEventListener('resize', () => this.resize())
    this.hud.onPlay(() => this.beginPlay())
  }

  async start(): Promise<void> {
    this.arena = new Arena(this.scene)
    const manager = new LoadingManager()
    manager.onProgress = (_url, loaded, total) => {
      this.hud.setLoadProgress(total === 0 ? 0 : (loaded / total) * 100)
    }
    const loader = new GLTFLoader(manager)
    const texLoader = new TextureLoader(manager)
    let playerGltf
    let botGltf
    let houseGltf
    let foliageGltf
    let grassGltf
    let roadDiff
    try {
      ;[playerGltf, botGltf, houseGltf, foliageGltf, grassGltf, roadDiff] = await Promise.all([
        loader.loadAsync(PLAYER_RIG.url),
        loader.loadAsync(BOT_RIG.url),
        loader.loadAsync(HOUSE_URL),
        loader.loadAsync(FOLIAGE_URL),
        loader.loadAsync(GRASS_PATCH_URL),
        texLoader.loadAsync(ROAD_DIFF_URL),
        this.audio.load(),
      ])
    } catch (error) {
      throw new Error(`GLB: ${error instanceof Error ? error.message : String(error)}`)
    }
    try {
      this.arena.addRoad(roadDiff)
      this.arena.addHouse(houseGltf.scene)
      this.arena.addFoliage(foliageGltf.scene, grassGltf.scene)
      this.player = new Tank(
        'player',
        playerGltf.scene,
        PLAYER_RIG,
        new Vector3(PLAYER_SPAWN.x, 0, PLAYER_SPAWN.z),
        PLAYER_SPAWN.yaw,
      )
      this.botTank = new Tank(
        'bot',
        botGltf.scene,
        BOT_RIG,
        new Vector3(BOT_SPAWN.x, 0, BOT_SPAWN.z),
        BOT_SPAWN.yaw,
      )
    } catch (error) {
      throw new Error(`Setup: ${error instanceof Error ? error.message : String(error)}`)
    }
    this.scene.add(this.player.object, this.botTank.object, this.tracks.mesh, this.fx.sparks, this.fx.smoke)
    this.player.sitOnTerrain()
    this.botTank.sitOnTerrain()
    this.cameraRig.reset(this.player)
    this.hud.readyToPlay()
    this.loop()
  }

  private beginPlay(): void {
    if (this.roundOver) {
      this.restartRound()
    }
    this.playing = true
    this.hud.hideOverlay()
    this.input.lockPointer()
    void this.audio.unlock()
  }

  private restartRound(): void {
    this.roundOver = false
    this.playing = true
    this.player.reset()
    this.botTank.reset()
    this.tracks.clear()
    this.fx.clear()
    this.audio.stopEngine()
    this.cameraRig.reset(this.player)
    for (const shot of this.projectiles) {
      shot.object.removeFromParent()
    }
    this.projectiles.length = 0
    this.hud.hideOverlay()
  }

  private loop = (): void => {
    requestAnimationFrame(this.loop)
    const dt = Math.min(this.clock.getDelta(), 0.05)
    this.update(dt)
    this.renderer.render(this.scene, this.cameraRig.camera)
  }

  private update(dt: number): void {
    if (this.input.consumeRestart() && this.player && this.botTank) {
      this.restartRound()
      this.hud.hideOverlay()
    }

    const mouse = this.input.consumeMouse()
    if (this.playing && !this.roundOver && this.player.alive) {
      this.player.addAimDelta(-mouse.dy * 0.0024)
      this.player.addAimDelta(this.input.elevate() * 1.15 * dt)
      this.player.drive(
        this.input.throttle(),
        this.input.steer(),
        dt,
        this.arena.obstacles,
        ARENA_HALF,
        this.botTank,
      )
      if (this.input.throttle() !== 0 || this.input.steer() !== 0) {
        this.tracks.stamp(this.player)
      }
      this.audio.setMotion(Math.max(Math.abs(this.input.throttle()), Math.abs(this.input.steer()) * 0.55))
      this.player.applyAimPose()
      this.player.tickCooldown(dt)
      if (this.input.consumeFireClick() || (this.input.fireHeld && this.player.cooldown <= 0)) {
        this.cameraRig.getAimPoint(this.aimPoint, this.player)
        this.spawnShot(this.player.tryFireToward(this.aimPoint))
      }
      this.botTank.applyAimPose()
    } else if (this.botTank) {
      this.audio.stopEngine()
      this.botTank.applyAimPose()
      this.player?.applyAimPose()
    }

    this.player?.tickHitSway(dt)
    this.botTank?.tickHitSway(dt)
    this.tracks.update(dt)
    this.fx.update(dt)
    this.updateProjectiles(dt)

    if (this.player && this.botTank) {
      this.cameraRig.update(this.player, dt, this.arena.cameraBlockers)
      this.arena.tick(dt, this.cameraRig.camera, this.player.position)
      this.hud.setAtmosphere(this.arena.atmosphere.label)
      this.audio.setWeather(this.arena.atmosphere.rain, this.arena.atmosphere.wind)
      this.hud.update(
        this.player.hp,
        this.player.config.maxHp,
        this.botTank.hp,
        this.botTank.config.maxHp,
        this.player.reloadProgress(),
        this.player.gunPitch,
        this.player.config.gunPitchMin,
        this.player.config.gunPitchMax,
      )
      this.checkRound()
    }
  }

  private spawnShot(shot: Projectile | null): void {
    if (!shot) return
    this.projectiles.push(shot)
    this.scene.add(shot.object)
    this.audio.fire()
    this.fx.muzzle(shot.object.position)
  }

  private updateProjectiles(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const shot = this.projectiles[i]
      shot.update(dt)
      const p = shot.object.position
      if (p.y < terrainHeight(p.x, p.z) + 0.1 || collidesAny(p.x, p.z, 0, 0.12, 0.12, this.arena.obstacles)) {
        shot.alive = false
      } else {
        this.tryHit(shot, this.player)
        this.tryHit(shot, this.botTank)
      }
      if (!shot.alive) {
        shot.object.removeFromParent()
        this.projectiles.splice(i, 1)
      }
    }
  }

  private tryHit(shot: Projectile, tank: Tank): void {
    if (!shot.alive || !tank.alive || shot.ownerId === tank.id) return
    const p = shot.object.position
    if (p.y < tank.position.y - 0.2 || p.y > tank.position.y + tank.height + 0.4) return
    if (pointHitsObb(p.x, p.z, tank.position.x, tank.position.z, tank.hullYaw, tank.halfWidth, tank.halfLength)) {
      const killed = tank.takeDamage(shot.damage)
      const fxAt = tank.position.clone()
      fxAt.y += tank.height * 0.55
      this.audio.hit()
      this.fx.hit(fxAt)
      if (killed) {
        this.audio.explode()
        this.fx.explode(fxAt)
      }
      shot.alive = false
    }
  }

  private checkRound(): void {
    if (this.roundOver || !this.playing) return
    if (!this.player.alive) {
      this.roundOver = true
      this.playing = false
      this.hud.roundOver(false)
    } else if (!this.botTank.alive) {
      this.roundOver = true
      this.playing = false
      this.hud.roundOver(true)
    }
  }

  private resize(): void {
    const width = window.innerWidth
    const height = window.innerHeight
    this.renderer.setSize(width, height, false)
    this.cameraRig.resize(width, height)
  }
}
