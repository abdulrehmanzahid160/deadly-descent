import * as THREE from 'three'

export const ROAD_HALF = 7.4
export const ROAD_LENGTH = 30000
export const START = 120
export const clamp = THREE.MathUtils.clamp

export function roadPoint(s, target = new THREE.Vector3()) {
  return target.set(
    Math.sin(s * .0048) * 34 + Math.sin(s * .0015 + .8) * 58,
    36 - s * .045 + Math.sin(s * .006 + 1.28) * 10 + Math.sin(s * .0018) * 16,
    -s,
  )
}

export function roadFrame(s) {
  const tangent = roadPoint(s + .5).sub(roadPoint(s - .5)).normalize()
  const right = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize()
  const up = new THREE.Vector3().crossVectors(right, tangent).normalize()
  return { tangent, right, up }
}

export function roadPosition(s, offset = 0, lift = 0) {
  const { right, up } = roadFrame(s)
  return roadPoint(s).addScaledVector(right, offset).addScaledVector(up, lift)
}

const basis = new THREE.Matrix4()
export function placeOnRoad(object, s, offset = 0, lift = 0) {
  const { tangent, right, up } = roadFrame(s)
  object.position.copy(roadPosition(s, offset, lift))
  basis.makeBasis(right, up, tangent.negate())
  object.quaternion.setFromRotationMatrix(basis)
}

export function terrainHeight(s, offset) {
  const d = Math.max(0, Math.abs(offset) - ROAD_HALF - 2)
  const fade = Math.min(1, d / 32)
  const noise = Math.sin(s * .032 + d * .12) * 2.4 + Math.sin(s * .013 - d * .075) * 4
  if (offset < 0) return d * .38 + Math.sin(s * .007 + d * .008) * d * .17 + noise * fade
  return -Math.min(d * .39, 76) + Math.sin(s * .008 + d * .023) * Math.min(d * .16, 26) + noise * fade
}

export function random(seed) {
  let value = seed >>> 0
  return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 4294967296 }
}
