import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader, DRACO_GLTF_CONFIG } from 'three/addons/loaders/DRACOLoader.js'

export const FINISHES = [
  { name: 'Rosso', color: '#a91621' },
  { name: 'Glacier', color: '#c3d2d5' },
  { name: 'Obsidian', color: '#182529' },
  { name: 'Saffron', color: '#c79638' },
]

export function box(w, h, d, material, x = 0, y = 0, z = 0, radius = 0) {
  const mesh = new THREE.Mesh(radius ? new RoundedBoxGeometry(w, h, d, 2, radius) : new THREE.BoxGeometry(w, h, d), material)
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

function material(color, roughness = .5, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness })
}

function wheel(x, z, radius = .37) {
  const group = new THREE.Group()
  group.position.set(x, radius, z)
  const rubber = material(0x131619, .91)
  const alloy = material(0x929da6, .24, .92)
  const tyre = new THREE.Mesh(new THREE.TorusGeometry(radius * .77, radius * .23, 10, 28), rubber)
  tyre.rotation.y = Math.PI / 2
  tyre.castShadow = true
  group.add(tyre)
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(radius * .57, radius * .57, .13, 24), alloy)
  disc.rotation.z = Math.PI / 2
  group.add(disc)
  for (let n = 0; n < 5; n++) {
    const spoke = box(.21, .045, radius * 1.35, alloy)
    spoke.rotation.x = n * Math.PI / 5
    group.add(spoke)
  }
  group.add(box(.22, .2, .07, material(0x9e2d24), 0, .1, .08))
  return group
}

// A shaped cross-section body keeps traffic inexpensive without box-shaped silhouettes.
function shell(sections, paint) {
  const points = []
  const indices = []
  sections.forEach(([z, width, shoulder, top]) => {
    points.push(-width * .82, .35, z, -width, shoulder, z, -width * .75, top, z,
      width * .75, top, z, width, shoulder, z, width * .82, .35, z)
  })
  for (let r = 0; r < sections.length - 1; r++) {
    for (let c = 0; c < 6; c++) {
      const a = r * 6 + c, b = r * 6 + (c + 1) % 6
      indices.push(a, b, a + 6, b, b + 6, a + 6)
    }
  }
  indices.push(0, 2, 1, 0, 3, 2, 0, 4, 3, 0, 5, 4)
  const end = (sections.length - 1) * 6
  indices.push(end, end + 1, end + 2, end, end + 2, end + 3, end, end + 3, end + 4, end, end + 4, end + 5)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  const mesh = new THREE.Mesh(geometry, paint)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

export function createTraffic(type = 'sedan', color = '#bec5c7') {
  const car = new THREE.Group()
  const paint = new THREE.MeshPhysicalMaterial({ color, metalness: .55, roughness: .28, clearcoat: 1, clearcoatRoughness: .16 })
  const dark = material(0x151b20, .43)
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x15282f, metalness: .25, roughness: .1, clearcoat: 1 })
  const tall = type === 'pickup' || type === 'truck'
  car.add(shell([[-2.2, .79, .59, .68], [-1.8, .96, .75, .88], [-.8, .96, .78, .92], [1.5, .97, .78, .86], [2.15, .86, .65, .72]], paint))
  if (type === 'truck') {
    car.add(box(2.12, 1.65, 3.6, material(0xb1b6b5, .68), 0, 1.42, .68, .08))
    car.add(box(1.78, .72, .05, glass, 0, 1.26, -1.9))
  } else {
    const cabin = shell([[-1.12, .82, .86, .88], [-.52, .75, 1.32, tall ? 1.72 : 1.43], [.68, .77, 1.34, tall ? 1.72 : 1.43], [1.36, .87, .85, .9]], glass)
    car.add(cabin)
    car.add(box(1.43, .085, 1.2, paint, 0, tall ? 1.7 : 1.44, .09, .03))
    for (const side of [-1, 1]) {
      car.add(box(.07, .52, .07, paint, side * .78, 1.14, .08))
      car.add(box(.24, .13, .23, paint, side * 1.04, 1.03, -.73, .04))
      car.add(box(.035, .04, .19, material(0xb6bcbf, .25, 1), side * .96, .87, .42))
    }
  }
  car.add(box(1.7, .13, .15, dark, 0, .37, 2.08), box(1.5, .22, .09, dark, 0, .47, -2.15))
  const rearLights = new THREE.MeshStandardMaterial({ color: 0x740910, emissive: 0xff1020, emissiveIntensity: .9 })
  const headLights = new THREE.MeshStandardMaterial({ color: 0xe0efff, emissive: 0xe0efff, emissiveIntensity: 2 })
  for (const x of [-.69, .69]) {
    car.add(box(.4, .09, .04, rearLights, x, .69, 2.14))
    car.add(box(.38, .08, .07, headLights, x, .66, -2.16))
  }
  car.add(box(.38, .12, .015, material(0xdfdfd4), 0, .54, 2.17))
  const wheels = [-.95, .95].flatMap(x => [-1.4, 1.36].map(z => wheel(x, z)))
  car.add(...wheels)
  car.userData = { wheels, paint, rearLights, radius: .37 }
  return car
}

export async function loadHeroCar() {
  const draco = new DRACOLoader().setDecoderPath(DRACO_GLTF_CONFIG).setWorkerLimit(2)
  try {
    const gltf = await new GLTFLoader().setDRACOLoader(draco).loadAsync('/models/ferrari.glb')
    const car = gltf.scene
    const paint = new THREE.MeshPhysicalMaterial({ color: FINISHES[0].color, metalness: .42, roughness: .25, clearcoat: 1, clearcoatRoughness: .09, envMapIntensity: .9 })
    const glass = new THREE.MeshPhysicalMaterial({ color: 0x26343c, metalness: .2, roughness: .07, clearcoat: 1, transparent: true, opacity: .82, depthWrite: false })
    const rims = material(0xa6adb5, .24, .95)
    const leather = material(0x191e21, .82)
    const carbon = material(0x13191c, .5, .15)
    const rearLights = new THREE.MeshStandardMaterial({ color: 0x850515, emissive: 0xff0616, emissiveIntensity: 1.5, roughness: .18 })
    car.traverse(object => {
      if (!object.isMesh) return
      object.castShadow = true
      object.receiveShadow = true
      if (object.name === 'body') object.material = paint
      if (object.name === 'glass') object.material = glass
      if (/rim_|chrome/.test(object.name)) object.material = rims
      if (/leather|carpet|interior_light/.test(object.name)) object.material = leather
      if (/carbon|plastic|grill|steering_centre|steering_column/.test(object.name)) object.material = carbon
      if (/^metal$|^trim$|steering_metal|steering_trim/.test(object.name)) object.material = material(0x444c50, .35, .75)
      if (object.name === 'lights_red') object.material = rearLights
      if (object.name === 'leds') object.material = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xcbe9ff, emissiveIntensity: 3 })
      if (/tire/.test(object.name)) object.material = material(0x121416, .94)
    })
    const bounds = new THREE.Box3().setFromObject(car)
    car.position.y -= bounds.min.y
    // Model uses metres and faces -Z, matching the road's local frame.
    const wrapper = new THREE.Group()
    wrapper.add(car)
    wrapper.userData = {
      wheels: ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'].map(name => car.getObjectByName(name)).filter(Boolean),
      paint, rearLights, radius: .34, detailed: true, steeringWheel: car.getObjectByName('steering_wheel'),
    }
    return wrapper
  } finally {
    draco.dispose()
  }
}

export function disposeObject(root) {
  const geometries = new Set(), materials = new Set(), textures = new Set()
  root.traverse(object => {
    if (object.geometry) geometries.add(object.geometry)
    for (const mat of [object.material].flat().filter(Boolean)) {
      materials.add(mat)
      for (const value of Object.values(mat)) if (value?.isTexture) textures.add(value)
    }
  })
  geometries.forEach(value => value.dispose())
  materials.forEach(value => value.dispose())
  textures.forEach(value => value.dispose())
}
