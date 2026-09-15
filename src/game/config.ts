export type RigConfig = {
  url: string
  targetLength: number
  turretNames: string[]
  gunNames: string[]
  turretYawLimit: number
  gunPitchMin: number
  gunPitchMax: number
  maxHp: number
  moveSpeed: number
  reverseSpeed: number
  turnSpeed: number
  turretTurnSpeed: number
  fireCooldown: number
  damage: number
  projectileSpeed: number
  cameraDistance: number
  /** Extra yaw applied to the mesh so model forward matches hull +Z. */
  visualYaw?: number
  /** Lateral distance from hull center to the middle of a track. */
  trackOffset?: number
  /** Ground-mark width matching one caterpillar. */
  trackWidth?: number
  /**
   * Vertex filter in native model space. Failing triangles stay on the hull
   * so bow MG / stowage in a merged "turret" mesh do not rotate.
   */
  keepTurretVertex?: (x: number, y: number, z: number) => boolean
  /** Native-space filter for the main barrel, parented to the gun pivot. */
  keepGunVertex?: (x: number, y: number, z: number) => boolean
  /** Short name shown above the hull when `?describe=true`. */
  label?: string
}

const playerUrl = new URL('../../assets/tks_20mm_tankette.glb', import.meta.url).href
const botUrl = new URL('../../assets/tank_pz_kpfw_iii_ausf_b__1937.glb', import.meta.url).href
const botPz2Url = new URL('../../assets/panzer_ii_pz.kpfw._ii.glb', import.meta.url).href
export const STUKA_URL = new URL('../../assets/junkers_ju_87_stuka.glb', import.meta.url).href
export const STUKA_LENGTH = 12.2
export const HOUSE_URL = new URL(
  '../../assets/painted_house_-_zalipie_in_southern_poland.glb',
  import.meta.url,
).href
export const HOUSE_TARGET_LENGTH = 14

export type VillageProp = {
  url: string
  length: number
  x: number
  z: number
  yaw: number
  /** Half-extent of the drive-blocking box; keeps photogrammetry dirt from becoming a no-go zone. */
  collideHx: number
  collideHz: number
  spinSails?: boolean
}

export const WELL_PROP: VillageProp = {
  url: new URL('../../assets/old_village_well.glb', import.meta.url).href,
  length: 2.35,
  x: -9,
  z: 6.5,
  yaw: 0.18,
  collideHx: 1.15,
  collideHz: 1.15,
}

export const CART_PROP: VillageProp = {
  url: new URL('../../assets/old_cart_with_a_qvevri_clay_vessel_-_raw_scan.glb', import.meta.url).href,
  length: 3.3,
  x: -13.5,
  z: -3.5,
  yaw: 1.05,
  collideHx: 1.7,
  collideHz: 1.05,
}

export const WAGON_PROP: VillageProp = {
  url: new URL('../../assets/old_wooden_wagon.glb', import.meta.url).href,
  length: 3.7,
  x: -4.5,
  z: -9,
  yaw: -0.55,
  collideHx: 1.95,
  collideHz: 1.05,
}

export const WINDMILL_PROP: VillageProp = {
  url: new URL('../../assets/windmill_in_soviet_village.glb', import.meta.url).href,
  length: 13,
  x: -58,
  z: 48,
  yaw: 0.62,
  collideHx: 3.5,
  collideHz: 3.5,
  spinSails: true,
}

export const VILLAGE_PROPS: VillageProp[] = [WELL_PROP, CART_PROP, WAGON_PROP, WINDMILL_PROP]
/** Playable half-extent; 168/84 doubles the side and quadruples the surface again. */
export const ARENA_HALF = 168
export const PERIMETER_URL = new URL(
  '../../assets/hedgehog_tank_trap_and_barbed_wire_obstacles.glb',
  import.meta.url,
).href
export const FOLIAGE_URL = new URL('../../assets/low_poly_trees_flowers_and_grass.glb', import.meta.url).href
export const GRASS_PATCH_URL = new URL('../../assets/grass_patches_-_circle.glb', import.meta.url).href
export const ROAD_DIFF_URL = new URL('../../assets/textures/muddy_tracks_diff_2k.jpg', import.meta.url).href
export const WHARF_URL = new URL('../../assets/the_wharf___lake_sea.glb', import.meta.url).href
export const BOAT_URL = new URL('../../assets/old_boat.glb', import.meta.url).href
export const REEDS_URL = new URL('../../assets/reeds_low_poly.glb', import.meta.url).href
export const CHURCH_URL = new URL('../../assets/old_wooden_church.glb', import.meta.url).href
export const STONE_WALL_URL = new URL('../../assets/stone_wall__low_poly__game_ready.glb', import.meta.url).href
export const TOMBSTONES_URL = new URL('../../assets/tombstones_low_poly.glb', import.meta.url).href
export const CHURCH_LENGTH = 11.4
/** Wooden chapel east of the SE trunk, north of the parish cemetery. */
export const CHAPEL = { x: 64, z: -18, yaw: 0 }
/** Parish cemetery in the hollow east of the trunk, west of the rim hills. */
export const CEMETERY = { x: 90, z: -40, hx: 13.75, hz: 11, gateWidth: 5.5 }
/** Field track from the chapel fork on the SE trunk to the cemetery gate. */
export const CHAPEL_LANE = [
  { x: 56, z: -44 },
  { x: 66, z: -26 },
  { x: 74, z: -32 },
  { x: CEMETERY.x - CEMETERY.hx - 0.6, z: CEMETERY.z },
]
export const TREE_HEIGHT = 9.5
export const TKS_LENGTH = 2.6
export const PLAYER_SPAWN = { x: -96, z: 88, yaw: Math.PI * 0.72 }
/** Depot just off the TKS start, in the spawn clearing (right of hull). */
export const WORKSHOP = {
  x: PLAYER_SPAWN.x + Math.cos(PLAYER_SPAWN.yaw) * 7.2,
  z: PLAYER_SPAWN.z - Math.sin(PLAYER_SPAWN.yaw) * 7.2,
  yaw: PLAYER_SPAWN.yaw + 0.4,
}
export const WORKSHOP_RADIUS = TKS_LENGTH * 2
export const WORKSHOP_BARRELS_URL = new URL('../../assets/barrels_and_pallet.glb', import.meta.url).href
export const WORKSHOP_WRENCH_URL = new URL('../../assets/monkey_wrench_low_poly.glb', import.meta.url).href
export const WORKSHOP_HEAL_RATE = 0.02
const kidParam = new URLSearchParams(window.location.search).get('kid')
export const KID_MODE = parseFlag(kidParam) || kidParam?.trim().toLowerCase() === 'stas'
export const STAS_CONTROLS = kidParam?.trim().toLowerCase() === 'stas'
export const STUKA_DEBUG = parseFlag(new URLSearchParams(window.location.search).get('stuka'))
export const SHOW_FPS = parseFlag(new URLSearchParams(window.location.search).get('fps'))
export const POND_DEBUG = parseFlag(new URLSearchParams(window.location.search).get('pond'))
export const CHAPEL_DEBUG = parseFlag(new URLSearchParams(window.location.search).get('chapel'))
export const DESCRIBE = parseFlag(new URLSearchParams(window.location.search).get('describe'))
export const ENEMY_ACCURACY = KID_MODE ? 0.05 : 0.8
export const ARTY_SHELLS_PER_TANK = 5
export const ARTY_HIT_CHANCE = 0.8
/** SE road past the village — opposite the TKS approach. */
export const ENEMY_SPAWNS = [
  { x: 96, z: -80, yaw: Math.atan2(-96, 80) },
  { x: 112, z: -96, yaw: Math.atan2(-112, 96) },
  { x: 80, z: -66, yaw: Math.atan2(-80, 66) },
] as const
export const BOT_SPAWN = ENEMY_SPAWNS[0]

export function waveEnemyCount(waveIndex: number): number {
  if (waveIndex < 2) return 1
  return 1 + Math.floor(Math.random() * 3)
}

/** Ally TKS after 4 and 6 kills, then every 3: 9, 12, 15, 18… */
export function allyArrivesOnKill(kills: number): boolean {
  if (kills === 4 || kills === 6) return true
  return kills >= 9 && (kills - 9) % 3 === 0
}

/** Shared hull cruise; TKS is 25% faster so it can always outrun both Axis tanks. */
const CRUISE = 9
const CRUISE_REVERSE = 4.2

export const PLAYER_RIG: RigConfig = {
  url: playerUrl,
  targetLength: TKS_LENGTH,
  turretNames: ['GunShield_low.001', '20MM_low'],
  gunNames: ['GunShield_low.001', '20MM_low'],
  turretYawLimit: 0,
  gunPitchMin: -0.12,
  gunPitchMax: 0.32,
  maxHp: 9,
  moveSpeed: CRUISE * 1.25,
  reverseSpeed: CRUISE_REVERSE * 1.25,
  turnSpeed: 3.7,
  turretTurnSpeed: 2.4,
  fireCooldown: 0.85 * 0.75,
  damage: 1,
  projectileSpeed: 72,
  cameraDistance: 11,
  trackOffset: 0.63,
  trackWidth: 0.2,
  label: 'TKS',
}

export const BOT_RIG: RigConfig = {
  url: botUrl,
  targetLength: 5.4,
  turretNames: [
    'Cube.001',
    'Cube.002',
    'Cube.003',
    'Cube.012',
    'Cube.013',
  ],
  gunNames: ['Cube.005'],
  turretYawLimit: Math.PI,
  gunPitchMin: -0.1,
  gunPitchMax: 0.28,
  maxHp: 3,
  moveSpeed: CRUISE,
  reverseSpeed: CRUISE_REVERSE,
  turnSpeed: 1.35,
  turretTurnSpeed: 1.85,
  fireCooldown: 1.55,
  damage: 1,
  projectileSpeed: 78,
  cameraDistance: 14,
  visualYaw: Math.PI / 2,
  trackOffset: 1.12,
  trackWidth: 0.38,
  label: 'PzKpfw III',
}

export const BOT_RIG_PZ2: RigConfig = {
  url: botPz2Url,
  targetLength: 4.8,
  turretNames: ['Pz II_Turret_n_Tools_0'],
  gunNames: ['Pz II_Turret_n_Tools_0_gun'],
  turretYawLimit: Math.PI,
  gunPitchMin: -0.08,
  gunPitchMax: 0.22,
  maxHp: 3,
  moveSpeed: CRUISE,
  reverseSpeed: CRUISE_REVERSE,
  turnSpeed: 1.4,
  turretTurnSpeed: 2.05,
  fireCooldown: 1.55,
  damage: 1,
  projectileSpeed: 78,
  cameraDistance: 14,
  visualYaw: Math.PI / 2,
  trackOffset: 0.92,
  trackWidth: 0.32,
  keepTurretVertex: (x, y, z) => {
    const d = Math.hypot(x + 0.52, y + 0.06)
    if (z > 0.46) return true
    if (d < 0.72 && z > 0.38) return true
    if (x < -0.35 && Math.abs(y) < 0.35 && z > 0.4) return true
    return false
  },
  keepGunVertex: (x, y, z) =>
    x < -0.68 && y < -0.1 && y > -0.58 && z > 0.44 && z < 0.74,
  label: 'PzKpfw II',
}

export const ENEMY_RIGS: RigConfig[] = [BOT_RIG, BOT_RIG_PZ2]

function parseFlag(value: string | null): boolean {
  if (!value) return false
  const n = value.trim().toLowerCase()
  return n === '1' || n === 'true' || n === 'yes'
}
