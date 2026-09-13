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
}

const playerUrl = new URL('../../assets/tks_20mm_tankette.glb', import.meta.url).href
const botUrl = new URL('../../assets/tank_pz_kpfw_iii_ausf_b__1937.glb', import.meta.url).href
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
export const WORKSHOP_HEAL_RATE = 0.01
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

/** Ally TKS after waves 6, 9, then every 2: 11, 13, 15… */
export function allyArrivesOnWaveClear(wavesCleared: number): boolean {
  if (wavesCleared === 6 || wavesCleared === 9) return true
  return wavesCleared > 9 && (wavesCleared - 9) % 2 === 0
}

export const PLAYER_RIG: RigConfig = {
  url: playerUrl,
  targetLength: TKS_LENGTH,
  turretNames: ['GunShield_low.001', '20MM_low'],
  gunNames: ['GunShield_low.001', '20MM_low'],
  turretYawLimit: 0,
  gunPitchMin: -0.12,
  gunPitchMax: 0.32,
  maxHp: 9,
  moveSpeed: 9,
  reverseSpeed: 4.2,
  turnSpeed: 2.25,
  turretTurnSpeed: 2.4,
  fireCooldown: 0.85,
  damage: 1,
  projectileSpeed: 72,
  cameraDistance: 11,
}

export const BOT_RIG: RigConfig = {
  url: botUrl,
  targetLength: 5.4,
  turretNames: [
    'Cube.001',
    'Cube.002',
    'Cube.003',
    'Cube.005',
    'Cube.012',
    'Cube.013',
    'Cube.015',
  ],
  gunNames: ['Cube.002', 'Cube.005'],
  turretYawLimit: Math.PI,
  gunPitchMin: -0.34,
  gunPitchMax: 0.28,
  maxHp: 3,
  moveSpeed: 6.4,
  reverseSpeed: 3.1,
  turnSpeed: 1.35,
  turretTurnSpeed: 1.85,
  fireCooldown: 1.55,
  damage: 1,
  projectileSpeed: 78,
  cameraDistance: 14,
  visualYaw: Math.PI / 2,
}
