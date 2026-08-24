import * as THREE from 'three'

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const lanes = [-3.2, 0, 3.2]
const colors = [0xd65f48, 0x4b83a6, 0xe2b44d, 0x6a8566, 0xd9d8d1, 0x825f91]

function material(color, roughness = .72, metalness = .05) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness })
}

function box(width, height, depth, color, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material(color))
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

function createWheel(x, z, radius = .42) {
  const wheel = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, .3, 18),
    material(0x15191b, .9),
  )
  wheel.rotation.z = Math.PI / 2
  wheel.position.set(x, radius, z)
  wheel.castShadow = true
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * .43, radius * .43, .315, 12), material(0xaeb4b6, .45, .35))
  hub.rotation.z = Math.PI / 2
  wheel.add(hub)
  return wheel
}

function createVehicle(type = 'hatch', color = 0xe7e6df, player = false) {
  const group = new THREE.Group()
  const darkGlass = material(0x486773, .28, .12)
  const tyrePositions = []

  if (type === 'semi') {
    group.add(box(2.5, 1.7, 5.8, 0xd8d9d7, 0, 1.35, 1.4))
    group.add(box(2.45, 2.1, 2.3, color, 0, 1.55, -2.7))
    group.add(box(2.1, .78, .08, 0x587783, 0, 1.95, -3.88))
    tyrePositions.push([-1.2, -3], [1.2, -3], [-1.2, 2.2], [1.2, 2.2], [-1.2, 3], [1.2, 3])
  } else if (type === 'bus') {
    group.add(box(2.55, 2.55, 5.5, color, 0, 1.65, 0))
    group.add(box(2.25, .78, .09, 0x4e707c, 0, 2.05, -2.8))
    for (let z = -1.8; z <= 1.8; z += 1.2) group.add(box(2.58, .58, .72, 0x5f7e86, 0, 2.05, z))
    tyrePositions.push([-1.22, -1.8], [1.22, -1.8], [-1.22, 1.8], [1.22, 1.8])
  } else if (type === 'van') {
    group.add(box(2.25, 1.7, 4.2, color, 0, 1.15, 0))
    group.add(box(2.02, .72, 1.1, 0x54737d, 0, 1.65, -1.58))
    group.add(box(2.28, .67, 1.15, 0x5b7982, 0, 1.65, .15))
    tyrePositions.push([-1.05, -1.35], [1.05, -1.35], [-1.05, 1.35], [1.05, 1.35])
  } else if (type === 'pickup') {
    group.add(box(2.3, .72, 4.5, color, 0, .85, 0))
    group.add(box(2.2, 1.12, 2.05, color, 0, 1.42, -1.08))
    group.add(box(2.02, .69, .08, 0x53727d, 0, 1.68, -2.12))
    group.add(box(2.08, .45, 1.75, 0x343b3d, 0, 1.02, 1.15))
    tyrePositions.push([-1.08, -1.48], [1.08, -1.48], [-1.08, 1.45], [1.08, 1.45])
  } else if (type === 'bike') {
    const frame = box(.28, .45, 1.5, color, 0, .72, 0)
    frame.rotation.x = -.12
    group.add(frame)
    group.add(box(.72, .16, .75, 0x242a2c, 0, 1.08, .28))
    tyrePositions.push([0, -.72], [0, .72])
  } else {
    group.add(box(2.2, .65, 4.05, color, 0, .82, 0))
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.88, .9, type === 'sedan' ? 2.25 : 2.5), material(color))
    cabin.position.set(0, 1.46, type === 'sedan' ? .18 : .08)
    cabin.geometry.translate(0, 0, 0)
    cabin.castShadow = true
    group.add(cabin)
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.72, .58, .06), darkGlass)
    windshield.position.set(0, 1.63, -1.16)
    windshield.rotation.x = -.22
    group.add(windshield)
    const rearGlass = windshield.clone()
    rearGlass.position.z = 1.35
    rearGlass.rotation.x = .2
    group.add(rearGlass)
    tyrePositions.push([-1.04, -1.28], [1.04, -1.28], [-1.04, 1.28], [1.04, 1.28])
  }

  const wheels = tyrePositions.map(([x, z]) => {
    const wheel = createWheel(x, z, type === 'bike' ? .34 : .42)
    group.add(wheel)
    return wheel
  })

  if (type !== 'semi' && type !== 'bus' && type !== 'bike') {
    group.add(box(1.55, .16, .08, 0xffe6a3, 0, .82, -2.08))
    group.add(box(1.55, .14, .08, 0xb32d2d, 0, .83, 2.08))
  }
  if (player) {
    const marker = box(.82, .05, 1.15, 0xf0bb4f, 0, 1.97, .1)
    marker.material.emissive = new THREE.Color(0x6b4300)
    group.add(marker)
  }
  group.userData.wheels = wheels
  return group
}

function createTree(seed) {
  const group = new THREE.Group()
  group.add(box(.32, 2.8, .32, 0x5a4630, 0, 1.4, 0))
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.35 + (seed % 3) * .15, 1), material(0x416f53))
  crown.position.y = 3.2
  crown.castShadow = true
  group.add(crown)
  return group
}

export function createGame(canvas, callbacks) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0xdca467)
  scene.fog = new THREE.Fog(0xdca467, 65, 235)
  const camera = new THREE.PerspectiveCamera(57, 1, .1, 500)
  camera.position.set(0, 5.2, 12.5)
  camera.lookAt(0, 1.1, -17)

  scene.add(new THREE.HemisphereLight(0xffe5b4, 0x44584e, 2.2))
  const sun = new THREE.DirectionalLight(0xffd39a, 3.3)
  sun.position.set(-28, 42, 18)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.left = -28
  sun.shadow.camera.right = 28
  sun.shadow.camera.top = 28
  sun.shadow.camera.bottom = -28
  scene.add(sun)

  const road = new THREE.Mesh(new THREE.PlaneGeometry(14, 520), material(0x3f4547, .94))
  road.rotation.x = -Math.PI / 2
  road.position.set(0, 0, -235)
  road.receiveShadow = true
  scene.add(road)
  const shoulderMaterial = material(0x7f805e, 1)
  for (const x of [-27, 27]) {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 520), shoulderMaterial)
    ground.rotation.x = -Math.PI / 2
    ground.position.set(x, -.03, -235)
    ground.receiveShadow = true
    scene.add(ground)
  }

  const movingRoad = new THREE.Group()
  scene.add(movingRoad)
  const laneMarks = []
  for (let i = 0; i < 48; i += 1) {
    for (const x of [-1.6, 1.6]) {
      const mark = box(.12, .018, 4.6, 0xe8dfbd, x, .018, -i * 11)
      mark.receiveShadow = false
      movingRoad.add(mark)
      laneMarks.push(mark)
    }
  }
  for (const x of [-6.7, 6.7]) movingRoad.add(box(.15, .025, 520, 0xd8d8d1, x, .02, -235))

  const scenery = []
  for (let i = 0; i < 42; i += 1) {
    const item = i % 6 === 0 ? createBillboard(i) : createTree(i)
    item.position.set((i % 2 ? 1 : -1) * (9 + (i % 4) * 2.2), 0, -18 - i * 15)
    scene.add(item)
    scenery.push(item)
  }

  const state = {
    running: false, crashed: false, muted: false, ride: 'hatch', lane: 1, speed: 0,
    distance: 0, fuel: 100, coins: 0, passed: 0, bonus: 0, popup: '', popupUntil: 0,
    time: 0, playerX: 0, targetX: 0, lateralVelocity: 0, traffic: [], pickups: [],
  }
  const controls = { gas: false, brake: false }
  let player = createVehicle('hatch', 0xe8e7e1, true)
  player.position.set(0, .08, 5.5)
  scene.add(player)
  let audio = null
  let animationFrame = 0
  let previousTime = performance.now()

  function createBillboard(seed) {
    const group = new THREE.Group()
    group.add(box(.28, 3.8, .28, 0x55595b, 0, 1.9, 0))
    const board = box(4.6, 2.1, .22, seed % 12 ? 0x39758b : 0xcf6548, 0, 4.15, 0)
    group.add(board)
    return group
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
    } catch { /* Sound remains optional. */ }
  }

  function clearObjects(list) {
    for (const object of list) scene.remove(object.mesh)
    list.length = 0
  }

  function spawnTraffic(count = 14) {
    clearObjects(state.traffic)
    const types = ['sedan', 'hatch', 'van', 'pickup', 'bus', 'semi', 'bike']
    let z = -32
    for (let i = 0; i < count; i += 1) {
      z -= 24 + Math.random() * 25
      const type = types[Math.floor(Math.random() * types.length)]
      const lane = Math.floor(Math.random() * 3)
      const mesh = createVehicle(type, colors[Math.floor(Math.random() * colors.length)])
      const scale = type === 'bike' ? .9 : .82 + lane * .07
      mesh.scale.setScalar(scale)
      mesh.position.set(lanes[lane], .05, z)
      scene.add(mesh)
      state.traffic.push({ mesh, type, lane, speed: 12 + Math.random() * 24, passed: false })
    }
  }

  function spawnPickups() {
    clearObjects(state.pickups)
    for (let i = 0; i < 6; i += 1) {
      const fuel = i % 4 === 3
      const mesh = fuel
        ? box(.9, 1.15, .45, 0xd95448)
        : new THREE.Mesh(new THREE.CylinderGeometry(.48, .48, .16, 20), material(0xf2c34e, .4, .25))
      if (!fuel) mesh.rotation.z = Math.PI / 2
      const lane = Math.floor(Math.random() * 3)
      mesh.position.set(lanes[lane], fuel ? .75 : 1.05, -95 - i * 105)
      mesh.castShadow = true
      scene.add(mesh)
      state.pickups.push({ mesh, fuel, lane })
    }
  }

  function reset(ride = 'hatch') {
    scene.remove(player)
    player = createVehicle(ride, ride === 'pickup' ? 0xd66d3e : ride === 'van' ? 0xe1ddd0 : 0xe8e7e1, true)
    player.position.set(0, .08, 5.5)
    scene.add(player)
    Object.assign(state, {
      running: true, crashed: false, ride, lane: 1, speed: 0, distance: 0, fuel: 100,
      coins: 0, passed: 0, bonus: 0, popup: '', popupUntil: 0, time: 0,
      playerX: 0, targetX: 0, lateralVelocity: 0,
    })
    controls.gas = false
    controls.brake = false
    spawnTraffic()
    spawnPickups()
    beep(180, .09, .022)
  }

  function recycleTraffic(vehicle) {
    const farthest = Math.min(-140, ...state.traffic.map((item) => item.mesh.position.z))
    vehicle.mesh.position.z = farthest - 35 - Math.random() * 65
    vehicle.lane = Math.floor(Math.random() * 3)
    vehicle.mesh.position.x = lanes[vehicle.lane]
    vehicle.speed = 12 + Math.random() * 26 + clamp(state.distance / 3, 0, 7)
    vehicle.passed = false
  }

  function crash() {
    if (state.crashed) return
    state.crashed = true
    state.running = false
    controls.gas = false
    controls.brake = false
    player.rotation.z = -.34
    showPopup('CRASH')
    beep(90, .45, .04)
    callbacks.onCrash(state.distance)
  }

  function changeLane(direction) {
    if (!state.running || state.crashed) return
    state.lane = clamp(state.lane + direction, 0, 2)
    state.targetX = lanes[state.lane]
    beep(420, .055, .012)
  }

  function update(dt) {
    state.time += dt
    if (!state.running || state.crashed) return
    const profile = state.ride === 'hatch'
      ? { acceleration: 20, max: 57, grip: 10 }
      : state.ride === 'pickup'
        ? { acceleration: 14, max: 49, grip: 7.5 }
        : { acceleration: 16, max: 52, grip: 8.5 }
    const throttle = controls.gas && state.fuel > 0 ? profile.acceleration : 0
    const brake = controls.brake ? 32 : 0
    const drag = 1.5 + state.speed * .024
    state.speed = clamp(state.speed + (throttle - brake - drag) * dt, 0, profile.max)
    state.fuel = Math.max(0, state.fuel - dt * (.12 + (controls.gas ? .7 : 0)))
    state.distance += state.speed * dt / 1000

    const previousX = state.playerX
    state.playerX += (state.targetX - state.playerX) * (1 - Math.exp(-profile.grip * dt))
    state.lateralVelocity = (state.playerX - previousX) / Math.max(dt, .001)
    player.position.x = state.playerX
    player.position.y = .08 + Math.sin(state.time * (5 + state.speed * .2)) * Math.min(.055, state.speed * .0012)
    player.rotation.z += ((-state.lateralVelocity * .035) - player.rotation.z) * (1 - Math.exp(-8 * dt))
    player.rotation.x += ((controls.brake ? -.045 : controls.gas ? .025 : 0) - player.rotation.x) * (1 - Math.exp(-6 * dt))
    for (const wheel of player.userData.wheels) wheel.rotation.x -= state.speed * dt / .42

    const roadTravel = state.speed * dt
    for (const mark of laneMarks) {
      mark.position.z += roadTravel
      if (mark.position.z > 18) mark.position.z -= 528
    }
    for (const item of scenery) {
      item.position.z += roadTravel
      if (item.position.z > 22) item.position.z -= 630
    }

    for (const vehicle of state.traffic) {
      vehicle.mesh.position.z += (state.speed - vehicle.speed) * dt
      for (const wheel of vehicle.mesh.userData.wheels) wheel.rotation.x -= vehicle.speed * dt / .42
      const dz = vehicle.mesh.position.z - player.position.z
      if (!vehicle.passed && dz > 2.8) {
        vehicle.passed = true
        state.passed += 1
        if (Math.abs(vehicle.mesh.position.x - state.playerX) < 3.65) {
          state.bonus += 100
          showPopup('CLOSE PASS  +100')
          beep(650, .08, .02)
        }
      }
      if (Math.abs(dz) < 3.15 && Math.abs(vehicle.mesh.position.x - state.playerX) < 1.85) crash()
      if (vehicle.mesh.position.z > 24) recycleTraffic(vehicle)
    }

    for (const pickup of state.pickups) {
      pickup.mesh.position.z += state.speed * dt
      pickup.mesh.rotation.y += dt * 2.2
      const dz = pickup.mesh.position.z - player.position.z
      if (Math.abs(dz) < 2.1 && Math.abs(pickup.mesh.position.x - state.playerX) < 1.5) {
        if (pickup.fuel) {
          state.fuel = Math.min(100, state.fuel + 38)
          showPopup('FUEL REFILLED')
        } else {
          state.coins += 1
          state.bonus += 50
          showPopup('COIN  +50')
        }
        pickup.mesh.position.z -= 620
        pickup.lane = Math.floor(Math.random() * 3)
        pickup.mesh.position.x = lanes[pickup.lane]
        beep(pickup.fuel ? 320 : 820, .1, .02)
      } else if (pickup.mesh.position.z > 22) {
        pickup.mesh.position.z -= 620
        pickup.lane = Math.floor(Math.random() * 3)
        pickup.mesh.position.x = lanes[pickup.lane]
      }
    }

    camera.position.x += (state.playerX * .27 - camera.position.x) * (1 - Math.exp(-4 * dt))
    camera.position.y = 5.2 + Math.sin(state.time * 3.2) * Math.min(.05, state.speed * .001)
    camera.lookAt(state.playerX * .12, 1.05, -18)
    if (state.fuel <= 0 && state.speed < .3) crash()
    if (state.popup && state.time > state.popupUntil) state.popup = ''
  }

  function reportHud() {
    callbacks.onHud({
      distance: state.distance, fuel: state.fuel, coins: state.coins, bonus: state.bonus,
      passed: state.passed, speed: state.speed * 3.6, popup: state.popup,
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
    const gas = ['ArrowRight', 'KeyD', 'Space'].includes(event.code)
    const brake = ['ArrowLeft', 'KeyA'].includes(event.code)
    const up = ['ArrowUp', 'KeyW'].includes(event.code)
    const downLane = ['ArrowDown', 'KeyS'].includes(event.code)
    if (gas || brake || up || downLane) event.preventDefault()
    if (gas) controls.gas = down
    if (brake) controls.brake = down
    if (down && !event.repeat && up) changeLane(-1)
    if (down && !event.repeat && downLane) changeLane(1)
  }

  const onKeyDown = (event) => key(event, true)
  const onKeyUp = (event) => key(event, false)
  const onBlur = () => { controls.gas = false; controls.brake = false }
  window.addEventListener('resize', resize)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)
  resize()
  spawnTraffic()
  spawnPickups()

  function loop(now) {
    const dt = clamp((now - previousTime) / 1000, 0, .04)
    previousTime = now
    update(dt)
    renderer.render(scene, camera)
    if (Math.floor(now / 100) !== Math.floor((now - dt * 1000) / 100)) reportHud()
    animationFrame = requestAnimationFrame(loop)
  }
  animationFrame = requestAnimationFrame(loop)

  return {
    start: reset,
    setControl(name, down) {
      if (down && name === 'laneUp') changeLane(-1)
      else if (down && name === 'laneDown') changeLane(1)
      else if (name === 'gas' || name === 'brake') controls[name] = down
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
