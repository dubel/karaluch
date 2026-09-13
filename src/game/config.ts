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
}

const playerUrl = new URL('../../assets/tks_20mm_tankette.glb', import.meta.url).href
const botUrl = new URL('../../assets/tank_pz_kpfw_iii_ausf_b__1937.glb', import.meta.url).href
export const HOUSE_URL = new URL(
  '../../assets/painted_house_-_zalipie_in_southern_poland.glb',
  import.meta.url,
).href
export const HOUSE_TARGET_LENGTH = 14
/** Playable half-extent; 168/84 doubles the side and quadruples the surface again. */
export const ARENA_HALF = 168
export const FOLIAGE_URL = new URL('../../assets/low_poly_trees_flowers_and_grass.glb', import.meta.url).href
export const GRASS_PATCH_URL = new URL('../../assets/grass_patches_-_circle.glb', import.meta.url).href
export const ROAD_DIFF_URL = new URL('../../assets/textures/muddy_tracks_diff_2k.jpg', import.meta.url).href
export const TREE_HEIGHT = 9.5
export const PLAYER_SPAWN = { x: -96, z: 88, yaw: Math.PI * 0.72 }
export const BOT_SPAWN = { x: 96, z: -80, yaw: -Math.PI * 0.28 }

export const PLAYER_RIG: RigConfig = {
  url: playerUrl,
  targetLength: 2.6,
  turretNames: ['GunShield_low.001', '20MM_low'],
  gunNames: ['GunShield_low.001', '20MM_low'],
  turretYawLimit: 0,
  gunPitchMin: -0.12,
  gunPitchMax: 0.32,
  maxHp: 80,
  moveSpeed: 9,
  reverseSpeed: 4.2,
  turnSpeed: 2.25,
  turretTurnSpeed: 2.4,
  fireCooldown: 0.85,
  damage: 24,
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
  gunPitchMin: -0.1,
  gunPitchMax: 0.28,
  maxHp: 140,
  moveSpeed: 6.4,
  reverseSpeed: 3.1,
  turnSpeed: 0.95,
  turretTurnSpeed: 1.35,
  fireCooldown: 1.35,
  damage: 28,
  projectileSpeed: 78,
  cameraDistance: 14,
}
