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

export const PLAYER_RIG: RigConfig = {
  url: playerUrl,
  targetLength: 2.6,
  turretNames: [
    'GunShield_low.001',
    'Begin_Tube_low.001',
    'End_Tube_low.001',
    'Cylinder_low.001',
    '20MM_low',
  ],
  gunNames: ['Begin_Tube_low.001', 'End_Tube_low.001', '20MM_low'],
  turretYawLimit: 0.44,
  gunPitchMin: -0.12,
  gunPitchMax: 0.32,
  maxHp: 80,
  moveSpeed: 9,
  reverseSpeed: 4.2,
  turnSpeed: 1.45,
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
