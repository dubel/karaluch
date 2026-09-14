import {
  Clock,
  LoadingManager,
  PCFShadowMap,
  Scene,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  WebGLRenderer,
  type Object3D,
} from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { Arena } from './Arena'
import { FollowCamera } from './camera'
import { hullCoverAabb, pointHitsObb, raycastObstacles, type Aabb } from './collision'
import {
  ARENA_HALF,
  BOT_RIG,
  ENEMY_SPAWNS,
  FOLIAGE_URL,
  GRASS_PATCH_URL,
  HOUSE_URL,
  KID_MODE,
  PERIMETER_URL,
  PLAYER_RIG,
  PLAYER_SPAWN,
  ROAD_DIFF_URL,
  STUKA_DEBUG,
  STUKA_URL,
  VILLAGE_PROPS,
  WORKSHOP_BARRELS_URL,
  WORKSHOP_HEAL_RATE,
  WORKSHOP_WRENCH_URL,
  allyArrivesOnKill,
  waveEnemyCount,
} from './config'
import { Input } from './input'
import { Projectile } from './Projectile'
import { Tank, toggleBeacons } from './Tank'
import { raycastTerrain } from './terrain'
import { TrackMarks } from './TrackMarks'
import { GameAudio } from './audio'
import { CombatFx, MAX_WRECKS } from './fx'
import { Bot } from './Bot'
import { ArtilleryBarrage } from './artillery'
import { Workshop } from './workshop'
import { GAME_DAY_SECONDS, artilleryCooldownSeconds } from './atmosphere'
import { StukaRaid, STUKA_BLAST } from './stuka'
import { releaseIntroMusic } from '../ui/intro'
import { formatHeldTime, type Hud } from '../ui/hud'

type CombatUnit = { tank: Tank; ai: Bot }

const _kidAim = new Vector3()
const _fxAt = new Vector3()

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
  private readonly force: CombatUnit[] = []
  private readonly allies: CombatUnit[] = []
  private readonly wrecks: Tank[] = []
  private readonly wreckCover: Aabb[] = []
  private readonly bodiesBuf: Tank[] = []
  private readonly friendliesBuf: Tank[] = []
  private readonly hostilesBuf: Tank[] = []
  private trackStampEven = false
  private arena!: Arena
  private workshop!: Workshop
  private player!: Tank
  private botTemplate!: Object3D
  private playerTemplate!: Object3D
  private playing = false
  private roundOver = false
  private kills = 0
  private waveIndex = 0
  private wavesCleared = 0
  private spawnWait = 0
  private missionTime = 0
  private enemySeq = 0
  private allySeq = 0
  private artilleryWait = 0
  private artilleryWaitMax = 1
  private readonly barrage = new ArtilleryBarrage()
  private readonly stukas = new StukaRaid()
  private stukaAt = nextStukaAt(0)
  private stukaDebugWait = -1

  constructor(canvas: HTMLCanvasElement, hud: Hud) {
    this.hud = hud
    this.input = new Input(canvas)
    this.renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    this.renderer.outputColorSpace = SRGBColorSpace
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = PCFShadowMap
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
    let villageGltfs
    let foliageGltf
    let grassGltf
    let roadDiff
    let perimeterGltf
    let barrelsGltf
    let wrenchGltf
    let stukaGltf
    try {
      ;[
        playerGltf,
        botGltf,
        houseGltf,
        villageGltfs,
        foliageGltf,
        grassGltf,
        roadDiff,
        perimeterGltf,
        barrelsGltf,
        wrenchGltf,
        stukaGltf,
      ] = await Promise.all([
        loader.loadAsync(PLAYER_RIG.url),
        loader.loadAsync(BOT_RIG.url),
        loader.loadAsync(HOUSE_URL),
        Promise.all(VILLAGE_PROPS.map((prop) => loader.loadAsync(prop.url))),
        loader.loadAsync(FOLIAGE_URL),
        loader.loadAsync(GRASS_PATCH_URL),
        texLoader.loadAsync(ROAD_DIFF_URL),
        loader.loadAsync(PERIMETER_URL),
        loader.loadAsync(WORKSHOP_BARRELS_URL),
        loader.loadAsync(WORKSHOP_WRENCH_URL),
        loader.loadAsync(STUKA_URL),
        this.audio.load(),
      ])
    } catch (error) {
      throw new Error(`GLB: ${error instanceof Error ? error.message : String(error)}`)
    }
    try {
      this.arena.addRoad(roadDiff)
      this.arena.addHouse(houseGltf.scene)
      for (let i = 0; i < VILLAGE_PROPS.length; i++) {
        this.arena.addVillageProp(villageGltfs[i].scene, VILLAGE_PROPS[i])
      }
      this.arena.addFoliage(foliageGltf.scene, grassGltf.scene)
      this.arena.addPerimeter(perimeterGltf.scene)
      this.workshop = new Workshop(
        this.scene,
        barrelsGltf.scene,
        wrenchGltf.scene,
        this.arena.obstacles,
        this.arena.cameraBlockers,
      )
      this.arena.indexCollision()
      this.botTemplate = botGltf.scene
      this.playerTemplate = playerGltf.scene
      this.stukas.setTemplate(stukaGltf.scene)
      this.player = new Tank(
        'player',
        this.playerTemplate.clone(true),
        PLAYER_RIG,
        new Vector3(PLAYER_SPAWN.x, 0, PLAYER_SPAWN.z),
        PLAYER_SPAWN.yaw,
        'pl',
      )
    } catch (error) {
      throw new Error(`Setup: ${error instanceof Error ? error.message : String(error)}`)
    }
    this.scene.add(this.player.object, this.tracks.mesh, this.fx.sparks, this.fx.smoke)
    this.fx.prepare(this.scene)
    this.player.sitOnTerrain()
    this.cameraRig.reset(this.player)
    this.hud.readyToPlay()
    this.loop()
  }

  private beginPlay(): void {
    if (this.roundOver) {
      this.restartRound()
    } else if (this.force.length === 0) {
      this.spawnWave()
    }
    this.playing = true
    this.hud.hideOverlay()
    this.input.arm()
    this.input.lockPointer()
    releaseIntroMusic()
    this.audio.prime()
    void this.audio.unlock()
    if (STUKA_DEBUG) this.stukaDebugWait = 0
  }

  private restartRound(): void {
    this.roundOver = false
    this.playing = true
    this.kills = 0
    this.waveIndex = 0
    this.wavesCleared = 0
    this.spawnWait = 0
    this.missionTime = 0
    this.enemySeq = 0
    this.allySeq = 0
    this.artilleryWait = 0
    this.artilleryWaitMax = 1
    this.stukaAt = nextStukaAt(0)
    this.stukaDebugWait = STUKA_DEBUG ? 0 : -1
    this.stukas.clear()
    this.audio.stopStukaRaid()
    this.hud.setStukaAlert(false)
    this.barrage.clear()
    this.clearEnemies()
    this.player.reset()
    this.tracks.clear()
    this.fx.clear()
    this.audio.stopEngine()
    this.arena.atmosphere.resetMissionClock()
    this.cameraRig.reset(this.player)
    for (const shot of this.projectiles) {
      shot.object.removeFromParent()
    }
    this.projectiles.length = 0
    this.hud.hideOverlay()
    this.spawnWave()
    this.input.arm()
    this.input.lockPointer()
  }

  private loop = (): void => {
    requestAnimationFrame(this.loop)
    const dt = Math.min(this.clock.getDelta(), 0.08)
    this.update(dt)
    this.renderer.render(this.scene, this.cameraRig.camera)
  }

  private update(dt: number): void {
    if (this.input.consumeRestart() && this.player) {
      this.restartRound()
      this.hud.hideOverlay()
      this.input.arm()
    }

    const mouse = this.input.consumeMouse()
    const bodies = this.collectBodies()
    const repairing = this.workshop
      ? this.workshop.contains(this.player.position.x, this.player.position.z)
      : false
    if (this.playing && !this.roundOver && this.player.alive) {
      this.missionTime += dt
      this.player.nudgeYaw(-mouse.dx * 0.0052)
      this.player.addAimDelta(-mouse.dy * 0.0044)
      this.player.addAimDelta(this.input.elevate() * 2.2 * dt)
      this.player.drive(
        this.input.throttle(),
        this.input.steer(),
        dt,
        this.arena.obstacleIndex,
        ARENA_HALF,
        bodies,
      )
      if (this.input.throttle() !== 0 || this.input.steer() !== 0) {
        this.audio.setMotion(Math.max(Math.abs(this.input.throttle()), Math.abs(this.input.steer()) * 0.55))
      } else {
        this.audio.setMotion(0)
      }
      this.player.applyAimPose()
      this.player.tickCooldown(dt)
      if (this.input.consumeArtillery()) this.callArtillery()
      if (this.input.consumeMarkers()) {
        const on = toggleBeacons()
        this.hud.flash(on ? 'Znaczniki włączone' : 'Znaczniki wyłączone')
      }
      if (repairing) {
        this.player.heal(this.player.config.maxHp * WORKSHOP_HEAL_RATE * dt)
      }
      if (
        !repairing &&
        (this.input.consumeFireClick() || (this.input.fireHeld && this.player.cooldown <= 0))
      ) {
        this.cameraRig.getAimPoint(this.aimPoint, this.player)
        const shot = this.player.tryFireToward(this.aimPoint)
        if (shot && KID_MODE) this.snapPlayerShot(shot)
        this.spawnShot(shot)
      } else {
        this.input.consumeFireClick()
      }
      const friendlies = this.collectFriendlies()
      for (const unit of this.force) {
        const hunt = closestAlive(unit.tank, friendlies) ?? this.player
        this.spawnShot(unit.ai.update(dt, hunt, this.arena.obstacleIndex, bodies))
      }
      const hostiles = this.collectHostiles()
      for (const unit of this.allies) {
        const hunt = closestAlive(unit.tank, hostiles) ?? this.player
        this.spawnShot(unit.ai.update(dt, hunt, this.arena.obstacleIndex, bodies))
      }
      this.advanceWave(dt)
      this.tracks.stamp(this.player)
      this.trackStampEven = !this.trackStampEven
      if (this.trackStampEven) {
        for (const unit of this.force) this.tracks.stamp(unit.tank)
        for (const unit of this.allies) this.tracks.stamp(unit.tank)
      }
    } else {
      this.audio.stopEngine()
      this.player?.applyAimPose()
      for (const unit of this.force) unit.tank.applyAimPose()
      for (const unit of this.allies) unit.tank.applyAimPose()
    }

    this.player?.tickHitSway(dt)
    for (const unit of this.force) unit.tank.tickHitSway(dt)
    for (const unit of this.allies) unit.tank.tickHitSway(dt)
    this.workshop?.tick(dt)
    this.tickArtillery(dt)
    this.tickStukas(dt)
    this.tracks.update(dt)
    this.fx.update(dt)
    this.updateProjectiles(dt)

    if (this.player) {
      this.cameraRig.update(this.player, dt, this.arena.blockerIndex)
      this.arena.tick(dt, this.cameraRig.camera, this.player.position)
      this.hud.setAtmosphere(this.arena.atmosphere.label)
      this.audio.setWeather(this.arena.atmosphere.rain, this.arena.atmosphere.wind)
      this.audio.tickAmbience(dt, this.arena.atmosphere.clockHour, this.arena.atmosphere.rain)
      const thunder = this.arena.atmosphere.consumeThunder()
      if (thunder) this.audio.thunder(thunder)
      let roster = this.player.alive ? 1 : 0
      for (const unit of this.allies) {
        if (unit.tank.alive) roster += 1
      }
      this.hud.update(
        this.player.hp,
        this.player.config.maxHp,
        this.kills,
        this.player.reloadProgress(),
        this.player.gunPitch,
        this.player.config.gunPitchMin,
        this.player.config.gunPitchMax,
        repairing,
        this.artilleryCharge(),
        roster,
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

  /** Kid mode: if the crosshair is roughly on an enemy, the tracer flies at the hull. */
  private snapPlayerShot(shot: Projectile): void {
    const origin = shot.object.position
    const speed = shot.velocity.length()
    if (speed < 1e-4) return
    const dx = shot.velocity.x / speed
    const dy = shot.velocity.y / speed
    const dz = shot.velocity.z / speed
    let best: Tank | null = null
    let bestDot = Math.cos(0.22)
    for (const unit of this.force) {
      const tank = unit.tank
      if (!tank.alive) continue
      _kidAim.set(
        tank.position.x - origin.x,
        tank.position.y + tank.height * 0.42 - origin.y,
        tank.position.z - origin.z,
      )
      const len = _kidAim.length()
      if (len < 3 || len > 94) continue
      const inv = 1 / len
      const dot = dx * _kidAim.x * inv + dy * _kidAim.y * inv + dz * _kidAim.z * inv
      if (dot > bestDot) {
        bestDot = dot
        best = tank
      }
    }
    if (!best) return
    shot.velocity.set(
      best.position.x - origin.x,
      best.position.y + best.height * 0.42 - origin.y,
      best.position.z - origin.z,
    )
    shot.velocity.setLength(speed)
  }

  private artilleryCharge(): number {
    if (this.artilleryWait <= 0) return 1
    return Math.max(0, 1 - this.artilleryWait / this.artilleryWaitMax)
  }

  private callArtillery(): void {
    if (this.artilleryWait > 0) return
    const targets = this.force.map((unit) => unit.tank).filter((tank) => tank.alive)
    if (targets.length === 0) {
      this.hud.flash('Brak celów dla nalotu')
      return
    }
    const wait = artilleryCooldownSeconds(this.missionTime)
    this.artilleryWait = wait
    this.artilleryWaitMax = wait
    this.barrage.start(targets, this.scene)
    this.audio.incomingBarrage()
    this.hud.flash('Nalot artyleryjski!')
  }

  private tickArtillery(dt: number): void {
    const wasCharging = this.artilleryWait > 0
    this.artilleryWait = Math.max(0, this.artilleryWait - dt)
    if (wasCharging && this.artilleryWait <= 0 && this.playing && this.player?.alive) {
      this.hud.flash('Artyleria gotowa')
    }
    this.barrage.update(dt, (x, y, z, tank) => {
      _fxAt.set(x, y + 0.4, z)
      this.fx.explode(_fxAt)
      this.audio.artilleryBurst()
      if (tank && tank.alive && Math.hypot(tank.position.x - x, tank.position.z - z) < 4.8) {
        const killed = tank.takeDamage(99)
        if (!killed) return
        this.fx.igniteWreck(tank.position, tank.height)
        this.onEnemyKilled(tank)
      }
    })
  }

  private tickStukas(dt: number): void {
    try {
      this.tickStukasInner(dt)
    } catch (error) {
      console.error('Stuka tick', error)
    }
  }

  private tickStukasInner(dt: number): void {
    if (this.playing && this.player?.alive && this.stukaDebugWait >= 0) {
      this.stukaDebugWait -= dt
      if (this.stukaDebugWait <= 0) {
        this.launchStukaRaid()
        this.stukaDebugWait = this.stukas.active ? -1 : 0.6
      }
    }
    const polish = this.player ? this.collectFriendlies() : []
    const was = this.stukas.active
    this.stukas.update(dt, polish, (x, y, z) => this.onStukaBomb(x, y, z))
    this.hud.setStukaAlert(this.stukas.warning && this.playing && !this.roundOver)
    if (was && !this.stukas.active) this.audio.stopStukaRaid()
  }

  private launchStukaRaid(): void {
    if (!this.player || !this.playing || this.roundOver || this.stukas.active) return
    const polish = this.collectFriendlies()
    if (!this.stukas.begin(polish, this.scene, this.cameraRig.facingYaw)) return
    this.audio.startStukaRaid()
    this.stukaAt = nextStukaAt(this.kills)
  }

  private onStukaBomb(x: number, y: number, z: number): void {
    _fxAt.set(x, y + 0.35, z)
    this.fx.bombBurst(_fxAt)
    this.audio.bombBurst()
    this.cameraRig.shake(0.52)
    if (!this.player) return
    const dmg = this.player.config.maxHp * 0.2
    this.hurtStukaVictim(this.player, x, z, dmg)
    for (const unit of this.allies) this.hurtStukaVictim(unit.tank, x, z, dmg)
  }

  private hurtStukaVictim(tank: Tank, x: number, z: number, dmg: number): void {
    if (!tank.alive) return
    if (Math.hypot(tank.position.x - x, tank.position.z - z) > STUKA_BLAST) return
    const killed = tank.takeDamage(dmg)
    if (!killed) return
    _fxAt.set(tank.position.x, tank.position.y + tank.height * 0.55, tank.position.z)
    this.audio.explode()
    this.fx.explode(_fxAt)
    this.fx.igniteWreck(tank.position, tank.height)
    if (tank.id !== 'player') this.onAllyKilled(tank)
  }

  private updateProjectiles(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const shot = this.projectiles[i]
      const p = shot.object.position
      const ox = p.x
      const oy = p.y
      const oz = p.z
      shot.update(dt)
      const nx = p.x
      const ny = p.y
      const nz = p.z
      const span = Math.hypot(nx - ox, ny - oy, nz - oz)
      if (span > 1e-5) {
        const inv = 1 / span
        const dx = (nx - ox) * inv
        const dy = (ny - oy) * inv
        const dz = (nz - oz) * inv
        const reach = span + 0.08
        const wall = raycastObstacles(ox, oy, oz, dx, dy, dz, reach, this.arena.obstacleIndex)
        const crown = raycastObstacles(ox, oy, oz, dx, dy, dz, reach, this.arena.coverIndex)
        const hulks = raycastObstacles(ox, oy, oz, dx, dy, dz, reach, this.wreckCover)
        const hill = raycastTerrain(ox, oy, oz, dx, dy, dz, reach, 0.12, 0.02, 0.28)
        let block = reach + 1
        if (wall !== null) block = Math.min(block, wall)
        if (crown !== null) block = Math.min(block, crown)
        if (hulks !== null) block = Math.min(block, hulks)
        if (hill !== null) block = Math.min(block, hill)
        const travel = Math.min(span, block)
        const steps = Math.max(1, Math.ceil(travel / 0.32))
        for (let s = 1; s <= steps && shot.alive; s++) {
          const t = (travel * s) / steps
          p.set(ox + dx * t, oy + dy * t, oz + dz * t)
          this.tryHit(shot, this.player)
          for (const unit of this.force) this.tryHit(shot, unit.tank)
          for (const unit of this.allies) this.tryHit(shot, unit.tank)
        }
        if (shot.alive && block <= span) {
          p.set(ox + dx * block, oy + dy * block, oz + dz * block)
          this.fx.hit(p)
          shot.alive = false
        }
      }
      if (!shot.alive) {
        shot.object.removeFromParent()
        this.projectiles.splice(i, 1)
      }
    }
  }

  private tryHit(shot: Projectile, tank: Tank): void {
    if (!shot.alive || !tank.alive || shot.ownerId === tank.id) return
    if (shot.team === tank.team) return
    const p = shot.object.position
    const kidPad = KID_MODE && shot.ownerId === 'player' ? 1.28 : 1
    if (p.y < tank.position.y - 0.2 || p.y > tank.position.y + tank.height + 0.4 * kidPad) return
    if (pointHitsObb(p.x, p.z, tank.position.x, tank.position.z, tank.hullYaw, tank.halfWidth * kidPad, tank.halfLength * kidPad)) {
      const killed = tank.takeDamage(shot.damage)
      _fxAt.set(tank.position.x, tank.position.y + tank.height * 0.55, tank.position.z)
      this.audio.hit()
      this.fx.hit(_fxAt)
      if (killed) {
        this.audio.explode()
        this.fx.explode(_fxAt)
        this.fx.igniteWreck(tank.position, tank.height)
        if (tank.team === 'de') this.onEnemyKilled(tank)
        else if (tank.id !== 'player') this.onAllyKilled(tank)
      }
      shot.alive = false
    }
  }

  private onEnemyKilled(tank: Tank): void {
    this.kills += 1
    if (this.kills >= this.stukaAt) this.launchStukaRaid()
    if (allyArrivesOnKill(this.kills)) this.spawnAlly()
    this.pushWreck(tank)
    const idx = this.force.findIndex((unit) => unit.tank === tank)
    if (idx >= 0) this.force.splice(idx, 1)
    if (this.force.length === 0) {
      this.wavesCleared += 1
      this.spawnWait = 2.4
    }
  }

  private onAllyKilled(tank: Tank): void {
    this.pushWreck(tank)
    const idx = this.allies.findIndex((unit) => unit.tank === tank)
    if (idx >= 0) this.allies.splice(idx, 1)
  }

  private advanceWave(dt: number): void {
    if (this.force.length > 0) return
    this.spawnWait -= dt
    if (this.spawnWait > 0) return
    this.spawnWave()
  }

  private spawnWave(): void {
    const count = waveEnemyCount(this.waveIndex)
    this.waveIndex += 1
    for (let i = 0; i < count; i++) this.spawnEnemy(i, count)
  }

  private spawnEnemy(slot: number, waveSize: number): void {
    const pose = ENEMY_SPAWNS[slot % ENEMY_SPAWNS.length]
    const jitter = (Math.random() - 0.5) * 6.5 + slot * 3.2
    const tank = new Tank(
      `enemy-${this.enemySeq}`,
      this.botTemplate.clone(true),
      BOT_RIG,
      new Vector3(pose.x + jitter, 0, pose.z + jitter),
      pose.yaw,
    )
    this.enemySeq += 1
    tank.sitOnTerrain()
    this.scene.add(tank.object)
    this.force.push({ tank, ai: new Bot(tank, slot, waveSize) })
  }

  private spawnAlly(): void {
    const yaw = PLAYER_SPAWN.yaw
    const slot = this.allySeq
    const side = slot % 2 === 0 ? 1 : -1
    const x = PLAYER_SPAWN.x + Math.sin(yaw) * 5.5 + Math.cos(yaw) * side * (3.4 + slot * 0.4)
    const z = PLAYER_SPAWN.z + Math.cos(yaw) * 5.5 - Math.sin(yaw) * side * (3.4 + slot * 0.4)
    const tank = new Tank(
      `ally-${this.allySeq}`,
      this.playerTemplate.clone(true),
      PLAYER_RIG,
      new Vector3(x, 0, z),
      yaw,
      'pl',
    )
    this.allySeq += 1
    tank.sitOnTerrain()
    this.scene.add(tank.object)
    this.allies.push({ tank, ai: new Bot(tank, slot, 2, 'ally') })
    this.hud.flash('Karaluch z plutonu Orlika dołącza do osłony!')
  }

  private clearEnemies(): void {
    this.barrage.clear()
    this.stukas.clear()
    this.audio.stopStukaRaid()
    this.hud.setStukaAlert(false)
    for (const unit of this.force) unit.tank.object.removeFromParent()
    for (const unit of this.allies) unit.tank.object.removeFromParent()
    for (const wreck of this.wrecks) wreck.object.removeFromParent()
    this.force.length = 0
    this.allies.length = 0
    this.wrecks.length = 0
    this.wreckCover.length = 0
  }

  private pushWreck(tank: Tank): void {
    if (this.wrecks.length >= MAX_WRECKS) {
      const oldest = this.wrecks.shift()
      oldest?.object.removeFromParent()
      this.wreckCover.shift()
      this.fx.douseOldest()
    }
    this.wrecks.push(tank)
    this.wreckCover.push(
      hullCoverAabb(
        tank.position.x,
        tank.position.y,
        tank.position.z,
        tank.hullYaw,
        tank.halfWidth,
        tank.halfLength,
        tank.height,
      ),
    )
  }

  private collectBodies(): Tank[] {
    const list = this.bodiesBuf
    list.length = 0
    list.push(this.player)
    for (const wreck of this.wrecks) list.push(wreck)
    for (const unit of this.force) list.push(unit.tank)
    for (const unit of this.allies) list.push(unit.tank)
    return list
  }

  private collectFriendlies(): Tank[] {
    const list = this.friendliesBuf
    list.length = 0
    list.push(this.player)
    for (const unit of this.allies) list.push(unit.tank)
    return list
  }

  private collectHostiles(): Tank[] {
    const list = this.hostilesBuf
    list.length = 0
    for (const unit of this.force) list.push(unit.tank)
    return list
  }

  private checkRound(): void {
    if (this.roundOver || !this.playing) return
    if (this.player.alive) return
    this.roundOver = true
    this.playing = false
    this.hud.showDefeat({
      kills: this.kills,
      wavesCleared: this.wavesCleared,
      held: formatHeldTime((this.missionTime * 24) / GAME_DAY_SECONDS),
    })
    this.hud.setStukaAlert(false)
  }

  private resize(): void {
    const width = window.innerWidth
    const height = window.innerHeight
    this.renderer.setSize(width, height, false)
    this.cameraRig.resize(width, height)
  }
}

function closestAlive(from: Tank, candidates: Tank[]): Tank | null {
  let best: Tank | null = null
  let bestD = Infinity
  for (const tank of candidates) {
    if (!tank.alive || tank === from) continue
    const d = Math.hypot(tank.position.x - from.position.x, tank.position.z - from.position.z)
    if (d < bestD) {
      best = tank
      bestD = d
    }
  }
  return best
}

function nextStukaAt(kills: number): number {
  return kills + 4 + Math.floor(Math.random() * 3)
}
