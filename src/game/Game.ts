import {
  Clock,
  LoadingManager,
  PCFSoftShadowMap,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { Arena, ARENA_HALF } from './Arena'
import { Bot } from './Bot'
import { FollowCamera } from './camera'
import { collidesAny, pointHitsObb } from './collision'
import { BOT_RIG, PLAYER_RIG } from './config'
import { Input } from './input'
import { Projectile } from './Projectile'
import { Tank } from './Tank'
import type { Hud } from '../ui/hud'

export class Game {
  private readonly renderer: WebGLRenderer
  private readonly scene = new Scene()
  private readonly cameraRig = new FollowCamera()
  private readonly clock = new Clock()
  private readonly input: Input
  private readonly hud: Hud
  private readonly projectiles: Projectile[] = []
  private arena!: Arena
  private player!: Tank
  private botTank!: Tank
  private bot!: Bot
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
    const [playerGltf, botGltf] = await Promise.all([
      loader.loadAsync(PLAYER_RIG.url),
      loader.loadAsync(BOT_RIG.url),
    ])

    this.player = new Tank(
      'player',
      playerGltf.scene,
      PLAYER_RIG,
      new Vector3(-24, 0, 22),
      Math.PI * 0.72,
    )
    this.botTank = new Tank(
      'bot',
      botGltf.scene,
      BOT_RIG,
      new Vector3(24, 0, -20),
      -Math.PI * 0.28,
    )
    this.bot = new Bot(this.botTank)
    this.scene.add(this.player.object, this.botTank.object)
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
  }

  private restartRound(): void {
    this.roundOver = false
    this.playing = true
    this.player.reset()
    this.botTank.reset()
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
      const sensitivity = 0.0024
      this.player.addAimDelta(-mouse.dx * sensitivity, -mouse.dy * sensitivity)
      this.player.drive(
        this.input.throttle(),
        this.input.steer(),
        dt,
        this.arena.obstacles,
        ARENA_HALF,
        this.botTank,
      )
      this.player.applyAimPose()
      this.player.tickCooldown(dt)
      if (this.input.consumeFireClick() || (this.input.fireHeld && this.player.cooldown <= 0)) {
        this.spawnShot(this.player.tryFire())
      }
      const botShot = this.bot.update(dt, this.player, this.arena.obstacles)
      this.spawnShot(botShot)
    } else if (this.botTank) {
      this.botTank.applyAimPose()
      this.player?.applyAimPose()
    }

    this.updateProjectiles(dt)

    if (this.player && this.botTank) {
      this.cameraRig.update(this.player)
      this.hud.update(
        this.player.hp,
        this.player.config.maxHp,
        this.botTank.hp,
        this.botTank.config.maxHp,
        this.player.reloadProgress(),
      )
      this.checkRound()
    }
  }

  private spawnShot(shot: Projectile | null): void {
    if (!shot) return
    this.projectiles.push(shot)
    this.scene.add(shot.object)
  }

  private updateProjectiles(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const shot = this.projectiles[i]
      shot.update(dt)
      const p = shot.object.position
      if (p.y < 0.08 || collidesAny(p.x, p.z, 0, 0.12, 0.12, this.arena.obstacles)) {
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
    if (p.y < 0 || p.y > tank.height + 0.4) return
    if (pointHitsObb(p.x, p.z, tank.position.x, tank.position.z, tank.hullYaw, tank.halfWidth, tank.halfLength)) {
      tank.takeDamage(shot.damage)
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
