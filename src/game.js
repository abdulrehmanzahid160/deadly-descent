import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { createWorld } from './world'
import { loadHeroCar, createTraffic, disposeObject, FINISHES, box } from './vehicles'
import { ROAD_HALF, ROAD_LENGTH, START, roadPosition, placeOnRoad, roadFrame, clamp, random } from './road'

const gradeShader = {
  uniforms: { tDiffuse: { value: null }, strength: { value: .19 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float strength; varying vec2 vUv;
    void main(){ vec3 c=texture2D(tDiffuse,vUv).rgb;
      float vignette=smoothstep(.28,.82,length((vUv-.5)*vec2(1.,.85)));
      c*=1.-vignette*strength; gl_FragColor=vec4(c,1.); }`,
}

export async function createGame(canvas, callbacks) {
  const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 800
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.outputColorSpace = THREE.SRGBColorSpace
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(52, 1, .08, 6000)
  const world = createWorld(scene, renderer, mobile)
  const renderTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: mobile ? 0 : 2 })
  const composer = new EffectComposer(renderer, renderTarget)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), .08, .4, 2.2)
  composer.addPass(bloom)
  composer.addPass(new OutputPass())
  composer.addPass(new ShaderPass(gradeShader))
  let player
  try { player = await loadHeroCar() }
  catch { player = createTraffic('sedan', FINISHES[0].color); callbacks.onNotice?.('Detailed car unavailable. Backup vehicle loaded.') }
  scene.add(player)
  const controls = { gas: false, brake: false, boost: false, steerLeft: false, steerRight: false }
  const state = {
    phase: 'ready', progress: START, offset: 1.8, speed: 0, lateralSpeed: 0,
    fuel: 100, coins: 0, passed: 0, bonus: 0, time: 0, cameraMode: 'chase',
    quality: mobile ? 'medium' : 'high', condition: 'alpine', ride: 'touring',
    popup: '', popupUntil: 0, muted: false, fps: 60, reason: '',
  }
  let disposed = false, frameId, lastTime = performance.now(), hudTime = 0, frameTime = 0, frames = 0
  const rng = random(601)
  const lanes = [-5.5, -1.85, 1.85, 5.5]
  const traffic = Array.from({ length: mobile ? 9 : 13 }, (_, i) => {
    const mesh = createTraffic(i % 5 === 0 ? 'truck' : i % 4 === 0 ? 'pickup' : 'sedan', ['#3d5261', '#c2c7c6', '#34383b', '#a58457', '#657469'][i % 5])
    scene.add(mesh)
    return { mesh, s: START + 110 + i * 80, offset: lanes[i % 4], speed: 13 + rng() * 12, passed: false }
  })
  const pickups = Array.from({ length: 6 }, (_, i) => {
    const mesh = new THREE.Group()
    const metal = new THREE.MeshStandardMaterial({ color: 0x91a283, roughness: .5, metalness: .5 })
    mesh.add(box(.4, .57, .23, metal, 0, .3, 0, .035), box(.19, .065, .09, metal, 0, .62, 0, .02))
    const cross = new THREE.MeshStandardMaterial({ color: 0xd8d4a4, emissive: 0xb8a97d, emissiveIntensity: .3 })
    mesh.add(box(.24, .055, .015, cross, 0, .3, .125), box(.055, .25, .015, cross, 0, .3, .125))
    scene.add(mesh)
    return { mesh, s: START + 340 + i * 450, offset: lanes[(i + 2) % 4] }
  })
  const skidCount = 220
  const skids = new THREE.InstancedMesh(new THREE.PlaneGeometry(.23, 1.7).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x101519, transparent: true, opacity: .2, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }), skidCount)
  skids.frustumCulled = false
  const stamp = new THREE.Object3D()
  stamp.scale.setScalar(0); stamp.updateMatrix()
  for (let i = 0; i < skidCount; i++) skids.setMatrixAt(i, stamp.matrix)
  scene.add(skids)
  let skidIndex = 0, lastSkid = 0
  const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = shadowCanvas.height = 128
  const ctx = shadowCanvas.getContext('2d')
  const gradient = ctx.createRadialGradient(64, 64, 15, 64, 64, 64)
  gradient.addColorStop(0, 'rgba(0,0,0,.65)'); gradient.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128)
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 5.4).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false }))
  scene.add(contact)

  let audio, oscillator, harmonic, volume, engineFilter
  function enableAudio() {
    if (state.muted) return
    try {
      if (!audio) {
        audio = new AudioContext()
        volume = audio.createGain(); volume.gain.value = 0
        engineFilter = audio.createBiquadFilter(); engineFilter.type = 'lowpass'; engineFilter.frequency.value = 280
        oscillator = audio.createOscillator(); oscillator.type = 'sawtooth'
        harmonic = audio.createOscillator(); harmonic.type = 'triangle'
        oscillator.connect(engineFilter); harmonic.connect(engineFilter); engineFilter.connect(volume).connect(audio.destination)
        oscillator.start(); harmonic.start()
      }
      if (audio.state === 'suspended') audio.resume().catch(() => {})
    } catch { /* Audio is optional. */ }
  }
  function updateAudio() {
    if (!audio) return
    const active = state.phase === 'playing' && !state.muted
    const rpm = 42 + state.speed * 2.5 + (controls.gas ? 13 : 0)
    oscillator.frequency.setTargetAtTime(rpm, audio.currentTime, .09)
    harmonic.frequency.setTargetAtTime(rpm * .51, audio.currentTime, .1)
    engineFilter.frequency.setTargetAtTime(180 + state.speed * 12, audio.currentTime, .2)
    volume.gain.setTargetAtTime(active ? (controls.gas ? .028 : .012) : 0, audio.currentTime, .08)
  }
  function clearControls() { Object.keys(controls).forEach(key => { controls[key] = false }) }
  function showPopup(message) { state.popup = message; state.popupUntil = state.time + 1.8 }
  function reportHud() {
    const speed = state.speed * 3.6
    callbacks.onHud({ distance: Math.max(0, state.progress - START) / 1000, fuel: state.fuel, speed, passed: state.passed, bonus: state.bonus, popup: state.popup, gear: speed < 2 ? 'N' : Math.min(7, Math.floor(speed / 38) + 1), rpm: speed < 2 ? .1 : .3 + (speed % 38) / 54, camera: state.cameraMode, fps: state.fps, quality: state.quality, reason: state.reason })
  }
  function changePhase(phase) { state.phase = phase; clearControls(); callbacks.onPhase(phase); updateAudio(); reportHud() }
  function endRun(reason) { if (state.phase !== 'playing') return; state.reason = reason; changePhase(reason === 'DESCENT COMPLETE' ? 'finished' : 'crashed') }
  function start(ride = 'touring') {
    Object.assign(state, { progress: START, offset: 1.85, speed: 0, lateralSpeed: 0, fuel: 100, coins: 0, passed: 0, bonus: 0, time: 0, popup: '', reason: '', cameraMode: 'chase', ride })
    traffic.forEach((item, i) => { item.s = START + 110 + i * 80; item.offset = lanes[i % 4]; item.passed = false })
    pickups.forEach((item, i) => { item.s = START + 340 + i * 450 })
    stamp.scale.setScalar(0); stamp.updateMatrix()
    for (let i = 0; i < skidCount; i++) skids.setMatrixAt(i, stamp.matrix)
    skids.instanceMatrix.needsUpdate = true
    lastSkid = 0; skidIndex = 0
    changePhase('playing'); enableAudio()
    placeOnRoad(player, state.progress, state.offset, .025)
    camera.position.copy(roadPosition(state.progress - 8.5, state.offset, 3.15))
  }
  function pause() {
    if (state.phase === 'playing') changePhase('paused')
    else if (state.phase === 'paused') { changePhase('playing'); enableAudio() }
  }
  function cycleCamera() {
    const modes = ['chase', 'hood', 'cockpit']
    state.cameraMode = modes[(modes.indexOf(state.cameraMode) + 1) % 3]
    reportHud()
  }
  function setQuality(quality) {
    if (!['low', 'medium', 'high'].includes(quality)) return
    state.quality = quality; world.setQuality(quality); bloom.enabled = quality === 'high'
    resize(); reportHud()
  }
  function resize() {
    const width = Math.max(1, canvas.clientWidth), height = Math.max(1, canvas.clientHeight)
    const ratio = Math.min(devicePixelRatio || 1, state.quality === 'low' ? .9 : state.quality === 'medium' ? 1.25 : 1.75)
    renderer.setPixelRatio(ratio); renderer.setSize(width, height, false)
    composer.setPixelRatio(ratio); composer.setSize(width, height)
    camera.aspect = width / height; camera.updateProjectionMatrix()
  }
  function update(dt) {
    state.time += dt
    if (state.phase !== 'playing') return
    const previous = state.progress, sport = state.ride === 'sport'
    const power = sport ? 18.5 : 15, topSpeed = sport ? 65 : 54
    const offroad = Math.abs(state.offset) > ROAD_HALF - .35
    const boosting = controls.boost && state.fuel > 0
    const gravity = clamp(-roadFrame(state.progress).tangent.y * 25, -3, 5)
    const acceleration = (controls.gas && state.fuel > 0 ? power : 0) + (boosting ? 22 : 0)
    const drag = 1.3 + state.speed * .027 + (offroad ? 10 : 0)
    state.speed = clamp(state.speed + (acceleration + gravity - drag - (controls.brake ? 30 : 0)) * dt, 0, topSpeed + (boosting ? 13 : 0))
    state.progress += state.speed * dt
    state.fuel = Math.max(0, state.fuel - dt * (.08 + (controls.gas ? .2 : 0) + (boosting ? .95 : 0)))
    const steer = Number(controls.steerRight) - Number(controls.steerLeft)
    state.lateralSpeed += steer * (sport ? 12 : 9) * Math.min(1.4, state.speed / 25) * dt
    state.lateralSpeed *= Math.exp(-(offroad ? 2.5 : 4.5) * dt)
    state.offset += state.lateralSpeed * dt * 2.1
    if (Math.abs(state.offset) > ROAD_HALF + .15) endRun('GUARDRAIL IMPACT')
    if (state.fuel <= 0 && state.speed < .25) endRun('OUT OF FUEL')
    if (state.progress >= START + ROAD_LENGTH) endRun('DESCENT COMPLETE')
    if (controls.brake && state.speed > 21 && state.progress - lastSkid > 1) {
      stamp.scale.setScalar(1)
      for (const side of [-.78, .78]) {
        placeOnRoad(stamp, state.progress - 1.3, state.offset + side, .028); stamp.updateMatrix()
        skids.setMatrixAt(skidIndex++ % skidCount, stamp.matrix)
      }
      skids.instanceMatrix.needsUpdate = true; lastSkid = state.progress
    }
    for (const item of traffic) {
      const previousGap = item.s - previous
      item.s += item.speed * dt
      const gap = item.s - state.progress, crossing = previousGap * gap <= 0
      if ((Math.abs(gap) < 4.3 || crossing) && Math.abs(item.offset - state.offset) < 1.74) endRun('TRAFFIC COLLISION')
      if (!item.passed && gap < -4.5) {
        item.passed = true; state.passed++
        if (Math.abs(item.offset - state.offset) < 2.9) { state.bonus += 100; showPopup('CLOSE PASS  +100') }
      }
      if (gap < -90) {
        item.s = Math.max(state.progress + 500, ...traffic.map(car => car.s)) + 55 + rng() * 60
        item.offset = lanes[Math.floor(rng() * 4)]; item.passed = false
      }
      for (const wheel of item.mesh.userData.wheels) wheel.rotation.x -= item.speed * dt / .37
    }
    for (const item of pickups) {
      const gap = item.s - state.progress
      if (Math.abs(gap) < 2.8 && Math.abs(item.offset - state.offset) < 1.3) {
        state.fuel = Math.min(100, state.fuel + 30); item.s += 2700; showPopup('FUEL  +30%')
      } else if (gap < -50) item.s += 2700
    }
    for (const wheel of player.userData.wheels) wheel.rotation.x -= state.speed * dt / player.userData.radius
    if (state.popup && state.time > state.popupUntil) state.popup = ''
  }

  const look = new THREE.Vector3()
  function render(dt) {
    const cover = state.phase === 'ready'
    world.update(state.progress)
    placeOnRoad(player, state.progress, state.offset, .022 + (state.speed > 1 ? Math.sin(state.time * 13) * .008 : 0))
    player.rotateZ(-state.lateralSpeed * .021); player.rotateY(-state.lateralSpeed * .014)
    player.rotateX(controls.brake && state.speed > 1 ? -.015 : controls.gas ? .008 : 0)
    player.userData.rearLights.emissiveIntensity = controls.brake ? 5 : 1.2
    if (player.userData.steeringWheel) player.userData.steeringWheel.rotation.z = -state.lateralSpeed * .28
    placeOnRoad(contact, state.progress, state.offset, .018)
    for (const item of traffic) placeOnRoad(item.mesh, item.s, item.offset, .018)
    for (const item of pickups) {
      placeOnRoad(item.mesh, item.s, item.offset, .14 + Math.sin(state.time * 2 + item.s) * .1)
      item.mesh.rotateY(state.time * .7)
    }
    let position, target, fov
    if (cover) {
      const orbit = Math.sin(state.time * .09) * .65
      position = roadPosition(state.progress - 5.8 + orbit, state.offset - 5.6, 2.2)
      target = roadPosition(state.progress + .7, state.offset - (camera.aspect > 1.2 ? 1.7 : 0), .85)
      fov = camera.aspect < 1 ? 68 : 43
    } else if (state.cameraMode === 'hood') {
      position = roadPosition(state.progress + 1.1, state.offset, .94)
      target = roadPosition(state.progress + 32, state.offset * .6, .85); fov = 66
    } else if (state.cameraMode === 'cockpit') {
      position = roadPosition(state.progress + .28, state.offset - .33, 1.04)
      target = roadPosition(state.progress + 35, state.offset - .33, .95); fov = 73
    } else {
      position = roadPosition(state.progress - 8.4 - state.speed * .015, state.offset * .85 + .25, 3.1)
      target = roadPosition(state.progress + 13, state.offset * .7, .6)
      fov = 53 + state.speed * .06 + (controls.boost ? 5 : 0)
    }
    const damping = cover ? 1 - Math.exp(-2 * dt) : state.cameraMode !== 'chase' ? 1 : 1 - Math.exp(-9 * dt)
    camera.position.lerp(position, damping); look.lerp(target, cover ? 1 - Math.exp(-3 * dt) : 1)
    camera.lookAt(look); camera.fov += (fov - camera.fov) * Math.min(1, dt * 5); camera.updateProjectionMatrix()
    if (state.quality === 'low') renderer.render(scene, camera)
    else composer.render()
  }
  function key(event, down) {
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(event.target?.tagName)) return
    if (down && !event.repeat && event.code === 'KeyC') { cycleCamera(); return }
    if (down && !event.repeat && ['Escape', 'KeyP'].includes(event.code)) { pause(); return }
    const mapping = { ArrowUp: 'gas', KeyW: 'gas', ArrowDown: 'brake', KeyS: 'brake', ArrowLeft: 'steerLeft', KeyA: 'steerLeft', ArrowRight: 'steerRight', KeyD: 'steerRight', Space: 'boost' }
    const control = mapping[event.code]
    if (control) {
      event.preventDefault()
      if (state.phase === 'playing') { controls[control] = down; if (down) enableAudio() }
    }
  }
  const keyDown = event => key(event, true), keyUp = event => key(event, false)
  const blur = () => { clearControls(); if (state.phase === 'playing') changePhase('paused') }
  const visibility = () => { if (document.hidden) blur() }
  const contextLost = event => { event.preventDefault(); blur(); callbacks.onNotice?.('Graphics connection lost. Reload to restore the game.') }
  window.addEventListener('keydown', keyDown); window.addEventListener('keyup', keyUp)
  window.addEventListener('resize', resize); window.addEventListener('blur', blur)
  document.addEventListener('visibilitychange', visibility); canvas.addEventListener('webglcontextlost', contextLost)
  setQuality(state.quality)
  camera.position.copy(roadPosition(START - 5.8, state.offset - 5.6, 2.2))
  look.copy(roadPosition(START, state.offset, .85))
  function loop(now) {
    if (disposed) return
    const elapsed = Math.max(0, (now - lastTime) / 1000), dt = Math.min(elapsed, .05)
    lastTime = now; frameTime += elapsed; frames++
    if (frameTime >= 1) { state.fps = Math.round(frames / frameTime); frameTime = 0; frames = 0 }
    update(dt); render(dt); updateAudio(); hudTime += dt
    if (hudTime > .1) { reportHud(); hudTime = 0 }
    frameId = requestAnimationFrame(loop)
  }
  frameId = requestAnimationFrame(loop)
  return {
    start, pause, cycleCamera, setQuality,
    setControl(name, pressed) { if (name in controls && state.phase === 'playing') { controls[name] = pressed; if (pressed) enableAudio() } },
    setMuted(muted) { state.muted = muted; if (!muted && state.phase === 'playing') enableAudio(); updateAudio() },
    setPaint(color) { player.userData.paint.color.set(color) },
    setCondition(condition) { if (['alpine', 'golden'].includes(condition)) { state.condition = condition; world.setCondition(condition) } },
    menu() { state.progress = START; state.offset = 1.85; state.speed = 0; state.lateralSpeed = 0; changePhase('ready') },
    snapshot() { return { ...state, controls: { ...controls }, detailedCar: !!player.userData.detailed, render: { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles } } },
    destroy() {
      disposed = true; cancelAnimationFrame(frameId)
      window.removeEventListener('keydown', keyDown); window.removeEventListener('keyup', keyUp)
      window.removeEventListener('resize', resize); window.removeEventListener('blur', blur)
      document.removeEventListener('visibilitychange', visibility); canvas.removeEventListener('webglcontextlost', contextLost)
      world.destroy(); disposeObject(scene)
      composer.passes.forEach(pass => pass.dispose?.()); composer.dispose(); renderer.dispose(); audio?.close().catch(() => {})
    },
  }
}
