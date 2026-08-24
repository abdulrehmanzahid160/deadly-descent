import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { Sky } from 'three/examples/jsm/objects/Sky.js'

const ROAD_HALF = 5.7
const ROAD_LENGTH = 30000
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const palette = [0xd45142, 0xe1b346, 0x4a7f9c, 0xe4e1d8, 0x57745d, 0x765886]

function mat(color, roughness = .76, metalness = .04) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness })
}

function meshBox(w, h, d, color, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color))
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

function roundedBox(w, h, d, color, radius = .12, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, Math.min(radius, h * .35)), mat(color, .46, .12))
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

function roadPoint(s, target = new THREE.Vector3()) {
  const x = Math.sin(s * .0085) * 18 + Math.sin(s * .0021 + .8) * 30 + Math.sin(s * .021) * 3
  const y = 24 - s * .052 + Math.sin(s * .0105 + 1.28) * 13 + Math.sin(s * .0035) * 5 + Math.sin(s * .024) * 1.3
  return target.set(x, y, -s)
}

function roadFrame(s) {
  const before = roadPoint(Math.max(0, s - 1))
  const after = roadPoint(s + 1)
  const tangent = after.sub(before).normalize()
  const right = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize()
  const up = new THREE.Vector3().crossVectors(right, tangent).normalize()
  return { tangent, right, up }
}

function roadPosition(s, offset = 0, lift = 0) {
  const point = roadPoint(s)
  const { right, up } = roadFrame(s)
  return point.addScaledVector(right, offset).addScaledVector(up, lift)
}

function makeRoadGeometry() {
  const vertices = []
  const indices = []
  const uvs = []
  const step = 7
  for (let s = 0, row = 0; s <= ROAD_LENGTH; s += step, row += 1) {
    const center = roadPoint(s)
    const { right } = roadFrame(s)
    const left = center.clone().addScaledVector(right, -ROAD_HALF)
    const rightEdge = center.clone().addScaledVector(right, ROAD_HALF)
    vertices.push(left.x, left.y, left.z, rightEdge.x, rightEdge.y, rightEdge.z)
    uvs.push(0, s / 13, 1, s / 13)
    if (row > 0) {
      const a = row * 2
      indices.push(a - 2, a - 1, a, a, a - 1, a + 1)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.computeVertexNormals()
  return geometry
}

function makeTerrainGeometry(side) {
  const vertices = []
  const indices = []
  const uvs = []
  const step = 12
  const edge = side * (ROAD_HALF + .1)
  const outer = side * 92
  for (let s = 0, row = 0; s <= ROAD_LENGTH; s += step, row += 1) {
    const center = roadPoint(s)
    const { right } = roadFrame(s)
    const roadEdge = center.clone().addScaledVector(right, edge)
    const outerEdge = center.clone().addScaledVector(right, outer)
    const ridge = side < 0
      ? 11 + Math.sin(s * .011) * 8 + Math.sin(s * .003) * 14
      : -7 + Math.sin(s * .008 + 2) * 8
    outerEdge.y += ridge
    vertices.push(roadEdge.x, roadEdge.y - .08, roadEdge.z, outerEdge.x, outerEdge.y, outerEdge.z)
    uvs.push(0, s / 18, 4.5, s / 18)
    if (row > 0) {
      const a = row * 2
      indices.push(a - 2, a - 1, a, a - 1, a + 1, a)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.computeVertexNormals()
  return geometry
}

function createWheel(x, z, radius = .42) {
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, .3, 18), mat(0x15191b, .92))
  wheel.rotation.z = Math.PI / 2
  wheel.position.set(x, radius, z)
  wheel.castShadow = true
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * .46, radius * .46, .315, 12), mat(0xaeb5b8, .4, .4))
  hub.rotation.z = Math.PI / 2
  wheel.add(hub)
  return wheel
}

function createVehicle(type = 'sedan', color = 0x1666b3, player = false) {
  const group = new THREE.Group()
  const wheels = []
  const glass = mat(0x314a55, .24, .15)
  const addWheels = (front, rear, radius = .43) => {
    for (const x of [-1.04, 1.04]) {
      for (const z of [front, rear]) {
        const wheel = createWheel(x, z, radius)
        group.add(wheel)
        wheels.push(wheel)
      }
    }
  }

  if (type === 'truck') {
    group.add(roundedBox(2.35, 1.55, 4.8, 0xd7d7d2, .1, 0, 1.35, .8))
    group.add(roundedBox(2.3, 1.8, 2.1, color, .18, 0, 1.45, -2.45))
    group.add(meshBox(1.95, .65, .08, 0x3f5963, 0, 1.8, -3.52))
    addWheels(-2.55, 2.25, .47)
  } else if (type === 'pickup') {
    group.add(roundedBox(2.24, .72, 4.55, color, .16, 0, .83, 0))
    group.add(roundedBox(2.14, 1.12, 2, color, .13, 0, 1.4, -1.02))
    group.add(meshBox(1.93, .68, .08, 0x3b5662, 0, 1.67, -2.04))
    group.add(meshBox(2.02, .38, 1.85, 0x2d3334, 0, 1.02, 1.16))
    addWheels(-1.48, 1.47)
  } else {
    group.add(roundedBox(2.15, .68, 4.35, color, .18, 0, .82, 0))
    group.add(roundedBox(1.92, .92, 2.42, color, .16, 0, 1.47, .02))
    const frontGlass = meshBox(1.72, .62, .07, 0x314a55, 0, 1.65, -1.22)
    frontGlass.material = glass
    frontGlass.rotation.x = -.18
    group.add(frontGlass)
    const rearGlass = frontGlass.clone()
    rearGlass.position.z = 1.29
    rearGlass.rotation.x = .18
    group.add(rearGlass)
    group.add(meshBox(.07, .58, 1.7, 0x3d5a64, -1, 1.62, .04))
    group.add(meshBox(.07, .58, 1.7, 0x3d5a64, 1, 1.62, .04))
    group.add(meshBox(1.5, .13, .08, 0xffe1a0, 0, .82, -2.21))
    group.add(meshBox(1.55, .13, .08, 0xb52f38, 0, .82, 2.21))
    group.add(meshBox(1.8, .13, .16, 0x1d2529, 0, .48, -2.22))
    group.add(meshBox(1.8, .13, .16, 0x1d2529, 0, .48, 2.22))
    group.add(meshBox(.58, .18, .04, 0xe9edf0, 0, .73, 2.26))
    for (const x of [-1.08, 1.08]) {
      const mirror = roundedBox(.34, .18, .42, color, .07, x, 1.52, -.76)
      group.add(mirror)
    }
    const lowerGrille = meshBox(1.05, .22, .05, 0x172126, 0, .62, -2.27)
    group.add(lowerGrille)
    for (const x of [-.67, .67]) {
      const lamp = meshBox(.5, .24, .06, 0xffe5a4, x, .84, -2.27)
      lamp.material = new THREE.MeshStandardMaterial({ color: 0xffe6aa, emissive: 0x5f4618, emissiveIntensity: .65, roughness: .3 })
      group.add(lamp)
    }
    addWheels(-1.42, 1.4)
  }
  if (player) {
    const rearBadge = meshBox(.35, .06, .04, 0xc7ccce, 0, .95, 2.27)
    group.add(rearBadge)
  }
  group.userData.wheels = wheels
  return group
}

function createTree(seed) {
  const group = new THREE.Group()
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.16, .27, 3.5, 10), mat(0x58412d, .95))
  trunk.position.y = 1.75
  trunk.castShadow = true
  group.add(trunk)
  const foliageMaterial = mat(seed % 3 === 0 ? 0x2f6846 : 0x3b7650, .92)
  const clusters = [
    [0, 3.85, 0, 1.5], [-.82, 3.45, .1, 1.05], [.8, 3.55, -.08, 1.15], [0, 4.65, 0, 1.05],
  ]
  for (const [x, y, z, radius] of clusters) {
    const crown = new THREE.Mesh(new THREE.SphereGeometry(radius + (seed % 4) * .04, 14, 10), foliageMaterial)
    crown.position.set(x, y, z)
    crown.scale.y = .82
    crown.castShadow = true
    group.add(crown)
  }
  return group
}

function createRock(seed) {
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1 + (seed % 5) * .27, 0), mat(0x77736b, 1))
  rock.scale.y = .65
  rock.castShadow = true
  rock.receiveShadow = true
  return rock
}

export function createGame(canvas, callbacks) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.08
  const textureLoader = new THREE.TextureLoader()
  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy()
  const loadTexture = (url) => {
    const texture = textureLoader.load(url)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = maxAnisotropy
    return texture
  }
  const asphaltTexture = loadTexture('/textures/asphalt-hd.png')
  const groundTexture = loadTexture('/textures/mountain-ground-hd.png')

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x91cce4)
  scene.fog = new THREE.FogExp2(0xa8cdd0, .0052)
  const sky = new Sky()
  sky.scale.setScalar(100000)
  sky.material.uniforms.turbidity.value = 6
  sky.material.uniforms.rayleigh.value = 2.1
  sky.material.uniforms.mieCoefficient.value = .006
  sky.material.uniforms.mieDirectionalG.value = .82
  const skySun = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(72), THREE.MathUtils.degToRad(210))
  sky.material.uniforms.sunPosition.value.copy(skySun)
  scene.add(sky)
  const camera = new THREE.PerspectiveCamera(62, 1, .1, 420)
  scene.add(new THREE.HemisphereLight(0xc9edff, 0x4f5944, 2.3))
  const sun = new THREE.DirectionalLight(0xffe5b1, 3.8)
  sun.position.set(-24, 42, 18)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.left = -28
  sun.shadow.camera.right = 28
  sun.shadow.camera.top = 28
  sun.shadow.camera.bottom = -28
  scene.add(sun)

  const roadMaterial = new THREE.MeshStandardMaterial({
    map: asphaltTexture, bumpMap: asphaltTexture, bumpScale: .055, color: 0xf0f0ed,
    roughness: .9, metalness: 0, side: THREE.DoubleSide,
  })
  const road = new THREE.Mesh(makeRoadGeometry(), roadMaterial)
  road.receiveShadow = true
  scene.add(road)
  const groundMaterial = new THREE.MeshStandardMaterial({
    map: groundTexture, bumpMap: groundTexture, bumpScale: .12, color: 0xffffff,
    roughness: 1, metalness: 0, side: THREE.DoubleSide,
  })
  const leftTerrain = new THREE.Mesh(makeTerrainGeometry(-1), groundMaterial)
  const rightTerrain = new THREE.Mesh(makeTerrainGeometry(1), groundMaterial)
  leftTerrain.receiveShadow = true
  rightTerrain.receiveShadow = true
  scene.add(leftTerrain, rightTerrain)

  const roadMarks = []
  for (let i = 0; i < 82; i += 1) {
    const mark = meshBox(.14, .035, 4.2, 0xe9e5d5)
    scene.add(mark)
    roadMarks.push({ mesh: mark, s: i * 9 })
  }
  const edgeMarks = []
  for (let i = 0; i < 96; i += 1) {
    for (const side of [-1, 1]) {
      const edge = meshBox(.16, .04, 6.1, 0xf0eee3)
      scene.add(edge)
      edgeMarks.push({ mesh: edge, s: i * 7, offset: side * (ROAD_HALF - .18) })
    }
  }

  const scenery = []
  for (let i = 0; i < 76; i += 1) {
    const side = i % 2 ? 1 : -1
    const object = i % 5 === 0 ? createRock(i) : createTree(i)
    const item = { mesh: object, s: 14 + i * 8.5, offset: side * (8 + (i % 6) * 2.2) }
    scene.add(object)
    scenery.push(item)
  }

  const guardrails = []
  for (let i = 0; i < 58; i += 1) {
    const side = i % 2 ? 1 : -1
    const group = new THREE.Group()
    group.add(meshBox(.14, .85, .14, 0x72787a, 0, .4, 0))
    group.add(meshBox(.16, .24, 5.6, 0xb9bdba, 0, .77, 0))
    scene.add(group)
    guardrails.push({ mesh: group, s: 30 + Math.floor(i / 2) * 10, offset: side * 6.25 })
  }

  const controls = { gas: false, boost: false, brake: false, steerLeft: false, steerRight: false }
  const state = {
    running: false, crashed: false, muted: false, ride: 'sedan', progress: 20, speed: 0,
    offset: 0, lateralSpeed: 0, fuel: 100, coins: 0, passed: 0, bonus: 0,
    popup: '', popupUntil: 0, time: 0, traffic: [], pickups: [], distance: 0,
  }
  let player = createVehicle('sedan', 0x1269b5, true)
  scene.add(player)
  let previousTime = performance.now()
  let animationFrame = 0
  let audio = null

  function placeObject(object, s, offset, lift = 0) {
    const point = roadPosition(s, offset, lift)
    const { tangent, right, up } = roadFrame(s)
    object.position.copy(point)
    const basis = new THREE.Matrix4().makeBasis(right, up, tangent.clone().negate())
    object.quaternion.setFromRotationMatrix(basis)
  }

  function refreshPools() {
    const recycle = (item, spacing, spread = 0) => {
      if (item.s < state.progress - 25) item.s += spacing + Math.random() * spread
    }
    for (const mark of roadMarks) {
      recycle(mark, roadMarks.length * 9)
      placeObject(mark.mesh, mark.s, 0, .035)
    }
    for (const edge of edgeMarks) {
      recycle(edge, 48 * 7)
      placeObject(edge.mesh, edge.s, edge.offset, .04)
    }
    for (const item of scenery) {
      recycle(item, 76 * 8.5, 30)
      placeObject(item.mesh, item.s, item.offset, item.mesh.type === 'Mesh' ? .5 : 0)
    }
    for (const rail of guardrails) {
      recycle(rail, 29 * 10)
      placeObject(rail.mesh, rail.s, rail.offset, 0)
    }
  }

  function clearList(list) {
    for (const item of list) scene.remove(item.mesh)
    list.length = 0
  }

  function spawnTraffic() {
    clearList(state.traffic)
    for (let i = 0; i < 11; i += 1) {
      const type = i % 6 === 0 ? 'truck' : i % 4 === 0 ? 'pickup' : 'sedan'
      const mesh = createVehicle(type, palette[i % palette.length])
      scene.add(mesh)
      state.traffic.push({ mesh, type, s: 90 + i * 52 + Math.random() * 25, offset: (Math.random() - .5) * 5.2, speed: 10 + Math.random() * 16, passed: false })
    }
  }

  function spawnPickups() {
    clearList(state.pickups)
    for (let i = 0; i < 7; i += 1) {
      const fuel = i % 4 === 3
      const mesh = fuel
        ? meshBox(.85, 1.05, .45, 0xd54d42)
        : new THREE.Mesh(new THREE.CylinderGeometry(.45, .45, .14, 20), mat(0xf2c54e, .38, .25))
      if (!fuel) mesh.rotation.z = Math.PI / 2
      mesh.castShadow = true
      scene.add(mesh)
      state.pickups.push({ mesh, fuel, s: 130 + i * 105, offset: (Math.random() - .5) * 7 })
    }
  }

  function showPopup(text) {
    state.popup = text
    state.popupUntil = state.time + 1.25
  }

  function beep(frequency, duration, gain = .018) {
    if (state.muted) return
    try {
      audio ||= new AudioContext()
      const oscillator = audio.createOscillator()
      const volume = audio.createGain()
      oscillator.type = 'triangle'
      oscillator.frequency.value = frequency
      volume.gain.setValueAtTime(gain, audio.currentTime)
      volume.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + duration)
      oscillator.connect(volume).connect(audio.destination)
      oscillator.start()
      oscillator.stop(audio.currentTime + duration)
    } catch { /* Audio is optional. */ }
  }

  function reset(ride = 'sedan') {
    scene.remove(player)
    const type = ride === 'pickup' ? 'pickup' : 'sedan'
    const color = ride === 'rally' ? 0xd74636 : ride === 'pickup' ? 0xd66a3d : 0x1269b5
    player = createVehicle(type, color, true)
    scene.add(player)
    Object.assign(state, {
      running: true, crashed: false, ride, progress: 20, speed: 0, offset: 0,
      lateralSpeed: 0, fuel: 100, coins: 0, passed: 0, bonus: 0, popup: '',
      popupUntil: 0, time: 0, distance: 0,
    })
    Object.keys(controls).forEach((key) => { controls[key] = false })
    spawnTraffic()
    spawnPickups()
    refreshPools()
    beep(180, .1, .025)
  }

  function crash(message = 'OFF ROAD') {
    if (state.crashed) return
    state.crashed = true
    state.running = false
    Object.keys(controls).forEach((key) => { controls[key] = false })
    player.rotation.z += state.offset > 0 ? -.7 : .7
    showPopup(message)
    beep(80, .5, .045)
    callbacks.onCrash(state.distance)
  }

  function recycleTraffic(vehicle) {
    const farthest = Math.max(state.progress + 250, ...state.traffic.map((item) => item.s))
    vehicle.s = farthest + 55 + Math.random() * 90
    vehicle.offset = (Math.random() - .5) * 5.2
    vehicle.speed = 9 + Math.random() * 19
    vehicle.passed = false
  }

  function update(dt) {
    state.time += dt
    refreshPools()
    if (!state.running || state.crashed) return
    const profile = state.ride === 'rally'
      ? { power: 17, top: 54, steer: 12 }
      : state.ride === 'pickup'
        ? { power: 12.5, top: 43, steer: 8.2 }
        : { power: 14.5, top: 48, steer: 10 }
    const frame = roadFrame(state.progress)
    const downhillPull = clamp(-frame.tangent.y * 30, -3, 7)
    const offroad = Math.abs(state.offset) > ROAD_HALF - .55
    const boosting = controls.boost && state.fuel > 0
    const throttle = controls.gas && state.fuel > 0 ? profile.power : 0
    const boostPower = boosting ? 24 : 0
    const braking = controls.brake ? 27 : 0
    const drag = 1.15 + state.speed * .025 + (offroad ? 13 : 0)
    state.speed = clamp(state.speed + (throttle + boostPower + downhillPull - braking - drag) * dt, 0, profile.top + (boosting ? 18 : 0))
    state.progress += state.speed * dt
    state.distance = (state.progress - 20) / 1000
    state.fuel = Math.max(0, state.fuel - dt * (.1 + (controls.gas ? .62 : 0) + (boosting ? 1.65 : 0)))

    const steer = (controls.steerRight ? 1 : 0) - (controls.steerLeft ? 1 : 0)
    const steeringForce = steer * profile.steer * (.3 + state.speed / profile.top)
    state.lateralSpeed += steeringForce * dt
    state.lateralSpeed *= Math.exp(-(offroad ? 2.1 : 4.2) * dt)
    state.offset += state.lateralSpeed * dt * 2.5
    state.offset = clamp(state.offset, -10.5, 10.5)

    const suspension = Math.sin(state.time * (5 + state.speed * .3)) * Math.min(.07, state.speed * .0015)
    placeObject(player, state.progress, state.offset, .08 + suspension)
    player.rotateZ(-state.lateralSpeed * .035)
    player.rotateX((controls.brake ? -.04 : controls.gas || boosting ? .025 : 0) + (offroad ? Math.sin(state.time * 22) * .025 : 0))
    for (const wheel of player.userData.wheels) wheel.rotation.x -= state.speed * dt / .43

    for (const vehicle of state.traffic) {
      vehicle.s += vehicle.speed * dt
      placeObject(vehicle.mesh, vehicle.s, vehicle.offset, .06)
      for (const wheel of vehicle.mesh.userData.wheels) wheel.rotation.x -= vehicle.speed * dt / .43
      const gap = vehicle.s - state.progress
      if (!vehicle.passed && gap < -3) {
        vehicle.passed = true
        state.passed += 1
        if (Math.abs(vehicle.offset - state.offset) < 2.6) {
          state.bonus += 100
          showPopup('CLOSE PASS  +100')
          beep(650, .08, .018)
        }
      }
      if (Math.abs(gap) < 3.7 && Math.abs(vehicle.offset - state.offset) < 1.8) crash('COLLISION')
      if (gap < -55) recycleTraffic(vehicle)
    }

    for (const pickup of state.pickups) {
      placeObject(pickup.mesh, pickup.s, pickup.offset, pickup.fuel ? .7 : .9)
      pickup.mesh.rotateY(dt * 2)
      const gap = pickup.s - state.progress
      if (Math.abs(gap) < 2.2 && Math.abs(pickup.offset - state.offset) < 1.45) {
        if (pickup.fuel) {
          state.fuel = Math.min(100, state.fuel + 36)
          showPopup('FUEL REFILLED')
        } else {
          state.coins += 1
          state.bonus += 50
          showPopup('COIN  +50')
        }
        pickup.s += 780
        pickup.offset = (Math.random() - .5) * 7
        beep(pickup.fuel ? 330 : 820, .1, .02)
      } else if (gap < -30) {
        pickup.s += 780
        pickup.offset = (Math.random() - .5) * 7
      }
    }

    if (Math.abs(state.offset) > 8.9 || (Math.abs(state.offset) > 7.5 && state.speed > 25)) crash('LOST CONTROL')
    if (state.fuel <= 0 && state.speed < .25) crash('OUT OF FUEL')
    if (state.progress > ROAD_LENGTH - 400) crash('SUMMIT COMPLETE')
    if (state.popup && state.time > state.popupUntil) state.popup = ''
  }

  function updateCamera(dt) {
    const backS = Math.max(0, state.progress - 10.5)
    const cameraTargetPosition = roadPosition(backS, state.offset * .45 + 2.15, 4.8)
    const lookTarget = roadPosition(state.progress + 20, state.offset * .2, 1.25)
    camera.position.lerp(cameraTargetPosition, 1 - Math.exp(-7 * dt))
    camera.lookAt(lookTarget)
    const targetFov = controls.boost && state.running ? 68 : 62
    camera.fov += (targetFov - camera.fov) * (1 - Math.exp(-5 * dt))
    camera.updateProjectionMatrix()
  }

  function reportHud() {
    callbacks.onHud({
      distance: Math.max(0, state.distance), fuel: state.fuel, coins: state.coins,
      bonus: state.bonus, passed: state.passed, speed: state.speed * 3.6, popup: state.popup,
    })
  }

  function resize() {
    const rect = canvas.getBoundingClientRect()
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false)
    camera.aspect = Math.max(1, rect.width) / Math.max(1, rect.height)
    camera.updateProjectionMatrix()
  }

  function key(event, down) {
    const mapping = {
      ArrowUp: 'gas', KeyW: 'gas', Space: 'boost', ArrowDown: 'brake', KeyS: 'brake',
      ArrowLeft: 'steerLeft', KeyA: 'steerLeft', ArrowRight: 'steerRight', KeyD: 'steerRight',
    }
    const control = mapping[event.code]
    if (control) {
      event.preventDefault()
      controls[control] = down
    }
  }

  const onKeyDown = (event) => key(event, true)
  const onKeyUp = (event) => key(event, false)
  const onBlur = () => Object.keys(controls).forEach((key) => { controls[key] = false })
  window.addEventListener('resize', resize)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)
  resize()
  spawnTraffic()
  spawnPickups()
  refreshPools()
  state.progress = 20
  placeObject(player, state.progress, 0, .08)
  camera.position.copy(roadPosition(9, 0, 4.8))

  function loop(now) {
    const dt = clamp((now - previousTime) / 1000, 0, .04)
    previousTime = now
    update(dt)
    updateCamera(dt)
    renderer.render(scene, camera)
    if (Math.floor(now / 100) !== Math.floor((now - dt * 1000) / 100)) reportHud()
    animationFrame = requestAnimationFrame(loop)
  }
  animationFrame = requestAnimationFrame(loop)

  return {
    start: reset,
    setControl(name, down) {
      if (name in controls) controls[name] = down
      if (down && audio?.state === 'suspended') audio.resume()
    },
    setMuted(value) { state.muted = value },
    destroy() {
      cancelAnimationFrame(animationFrame)
      window.removeEventListener('resize', resize)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      renderer.dispose()
      audio?.close()
    },
  }
}
