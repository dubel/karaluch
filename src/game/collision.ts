export type Aabb = {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

function projectRadius(
  halfW: number,
  halfL: number,
  axisX: number,
  axisZ: number,
  yaw: number,
): number {
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  const rightX = c
  const rightZ = -s
  const fwdX = s
  const fwdZ = c
  return halfW * Math.abs(rightX * axisX + rightZ * axisZ) + halfL * Math.abs(fwdX * axisX + fwdZ * axisZ)
}

export function obbHitsAabb(
  x: number,
  z: number,
  yaw: number,
  halfW: number,
  halfL: number,
  box: Aabb,
  padding = 0,
): boolean {
  const boxCx = (box.minX + box.maxX) * 0.5
  const boxCz = (box.minZ + box.maxZ) * 0.5
  const boxHx = (box.maxX - box.minX) * 0.5 + padding
  const boxHz = (box.maxZ - box.minZ) * 0.5 + padding
  const dx = x - boxCx
  const dz = z - boxCz

  if (Math.abs(dx) > boxHx + projectRadius(halfW, halfL, 1, 0, yaw)) return false
  if (Math.abs(dz) > boxHz + projectRadius(halfW, halfL, 0, 1, yaw)) return false

  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  const rightX = c
  const rightZ = -s
  const fwdX = s
  const fwdZ = c

  if (Math.abs(dx * rightX + dz * rightZ) > halfW + boxHx * Math.abs(rightX) + boxHz * Math.abs(rightZ)) {
    return false
  }
  if (Math.abs(dx * fwdX + dz * fwdZ) > halfL + boxHx * Math.abs(fwdX) + boxHz * Math.abs(fwdZ)) {
    return false
  }
  return true
}

export function obbHitsObb(
  ax: number,
  az: number,
  aYaw: number,
  aHalfW: number,
  aHalfL: number,
  bx: number,
  bz: number,
  bYaw: number,
  bHalfW: number,
  bHalfL: number,
): boolean {
  const dx = ax - bx
  const dz = az - bz
  const axes = [
    [Math.cos(aYaw), -Math.sin(aYaw)],
    [Math.sin(aYaw), Math.cos(aYaw)],
    [Math.cos(bYaw), -Math.sin(bYaw)],
    [Math.sin(bYaw), Math.cos(bYaw)],
  ] as const

  for (const [axisX, axisZ] of axes) {
    const ar = projectRadius(aHalfW, aHalfL, axisX, axisZ, aYaw)
    const br = projectRadius(bHalfW, bHalfL, axisX, axisZ, bYaw)
    if (Math.abs(dx * axisX + dz * axisZ) > ar + br) return false
  }
  return true
}

export function collidesAny(
  x: number,
  z: number,
  yaw: number,
  halfW: number,
  halfL: number,
  obstacles: Aabb[],
): boolean {
  for (const box of obstacles) {
    if (obbHitsAabb(x, z, yaw, halfW, halfL, box, 0.05)) return true
  }
  return false
}

export function clampToBounds(
  x: number,
  z: number,
  halfW: number,
  halfL: number,
  halfArena: number,
): { x: number; z: number } {
  const pad = Math.max(halfW, halfL)
  return {
    x: Math.min(halfArena - pad, Math.max(-halfArena + pad, x)),
    z: Math.min(halfArena - pad, Math.max(-halfArena + pad, z)),
  }
}

export function pointHitsObb(
  px: number,
  pz: number,
  x: number,
  z: number,
  yaw: number,
  halfW: number,
  halfL: number,
): boolean {
  const dx = px - x
  const dz = pz - z
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  const localX = dx * c + dz * -s
  const localZ = dx * s + dz * c
  return Math.abs(localX) <= halfW && Math.abs(localZ) <= halfL
}
