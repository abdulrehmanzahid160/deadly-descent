const TAU = Math.PI * 2
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const lerp = (a, b, t) => a + (b - a) * t
const smooth = (t) => t * t * (3 - 2 * t)
const hash = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return (x - Math.floor(x)) * 2 - 1
}
const normalizeAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle))

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath()
  ctx.roundRect(x, y, width, height, radius)
}

export function createGame(canvas, callbacks) {
  const ctx = canvas.getContext('2d')
  const controls = { gas: false, brake: false }
  const state = {
    running: false,
    crashed: false,
    time: 0,
    distance: 0,
    fuel: 100,
    coins: 0,
    bonus: 0,
    popup: '',
    popupUntil: 0,
    cameraX: 0,
    cameraY: 0,
    wheelSpin: 0,
    lastGrounded: true,
    airRotation: 0,
    airStartAngle: 0,
    maxX: 160,
    muted: false,
    car: { x: 170, y: 250, vx: 0, vy: 0, angle: 0, omega: 0 },
    pickups: [],
    seen: new Set(),
  }
  let width = 1
  let height = 1
  let dpr = 1
  let animationFrame = 0
  let previousTime = performance.now()
  let accumulator = 0
  let audio = null

  function terrainY(x) {
    const difficulty = clamp(x / 15000, 0, 1)
    const broad = Math.sin(x * .0051) * (42 + difficulty * 48)
    const mid = Math.sin(x * (.011 + difficulty * .003) + 1.4) * (18 + difficulty * 32)
    const nodeSize = lerp(250, 125, difficulty)
    const node = Math.floor(x / nodeSize)
    const fract = x / nodeSize - node
    const randomHill = lerp(hash(node), hash(node + 1), smooth(fract)) * (28 + difficulty * 115)
    const starter = clamp((x - 300) / 900, 0, 1)
    return height * .69 + (broad + mid + randomHill) * starter
  }

  function terrainSlope(x) {
    return (terrainY(x + 4) - terrainY(x - 4)) / 8
  }

  function reset() {
    Object.assign(state, {
      running: true, crashed: false, time: 0, distance: 0, fuel: 100, coins: 0, bonus: 0,
      popup: '', popupUntil: 0, cameraX: 0, cameraY: 0, wheelSpin: 0, lastGrounded: true,
      airRotation: 0, airStartAngle: 0, maxX: 170, pickups: [], seen: new Set(),
    })
    const angle = Math.atan(terrainSlope(170))
    state.car = { x: 170, y: terrainY(170) - 56, vx: 0, vy: 0, angle, omega: 0 }
    seedPickups(0, 10000)
    beep(160, .08, 'sawtooth', .025)
  }

  function seedPickups(fromX, toX) {
    const start = Math.floor(Math.max(600, fromX) / 420)
    const end = Math.ceil(toX / 420)
    for (let i = start; i <= end; i += 1) {
      const x = i * 420 + hash(i + 80) * 105
      if (state.pickups.some((pickup) => Math.abs(pickup.x - x) < 5)) continue
      const fuel = i % 9 === 0
      state.pickups.push({ id: i, x, yOffset: fuel ? 82 : 60 + Math.abs(hash(i + 8)) * 55, type: fuel ? 'fuel' : 'coin', taken: false })
    }
  }

  function showPopup(text) {
    state.popup = text
    state.popupUntil = state.time + 1.35
  }

  function beep(frequency, duration, type = 'square', gain = .02) {
    if (state.muted) return
    try {
      audio ||= new AudioContext()
      const oscillator = audio.createOscillator()
      const volume = audio.createGain()
      oscillator.type = type
      oscillator.frequency.value = frequency
      volume.gain.setValueAtTime(gain, audio.currentTime)
      volume.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + duration)
      oscillator.connect(volume).connect(audio.destination)
      oscillator.start()
      oscillator.stop(audio.currentTime + duration)
    } catch { /* Audio is an optional enhancement. */ }
  }

  function localToWorld(localX, localY) {
    const { car } = state
    const cos = Math.cos(car.angle)
    const sin = Math.sin(car.angle)
    return { x: car.x + localX * cos - localY * sin, y: car.y + localX * sin + localY * cos }
  }

  function pointVelocity(point) {
    const rx = point.x - state.car.x
    const ry = point.y - state.car.y
    return { x: state.car.vx - state.car.omega * ry, y: state.car.vy + state.car.omega * rx }
  }

  function applyForce(fx, fy, point, dt) {
    const car = state.car
    const mass = 1.9
    const inertia = 4100
    car.vx += (fx / mass) * dt
    car.vy += (fy / mass) * dt
    const rx = point.x - car.x
    const ry = point.y - car.y
    car.omega += ((rx * fy - ry * fx) / inertia) * dt
  }

  function update(dt) {
    if (!state.running || state.crashed) return
    const car = state.car
    state.time += dt
    const difficulty = clamp(car.x / 18000, 0, 1)
    car.vy += 850 * dt
    car.vx *= Math.pow(.999, dt * 60)
    car.omega *= Math.pow(.996, dt * 60)

    let grounded = false
    const wheelOffsets = [-48, 48]
    for (const offset of wheelOffsets) {
      const wheel = localToWorld(offset, 29)
      const groundY = terrainY(wheel.x)
      const penetration = wheel.y + 22 - groundY
      if (penetration > 0 && penetration < 65) {
        grounded = true
        const slope = terrainSlope(wheel.x)
        const length = Math.hypot(1, slope)
        const nx = slope / length
        const ny = -1 / length
        const tx = 1 / length
        const ty = slope / length
        const velocity = pointVelocity(wheel)
        const normalSpeed = velocity.x * nx + velocity.y * ny
        const spring = clamp(penetration * 145 - normalSpeed * 15, 0, 5500)
        applyForce(nx * spring, ny * spring, wheel, dt)

        const tangentSpeed = velocity.x * tx + velocity.y * ty
        let target = 0
        if (controls.gas && state.fuel > 0) target = 295 + difficulty * 70
        if (controls.brake) target = -125
        const grip = controls.gas || controls.brake ? clamp((target - tangentSpeed) * 15, -2300, 2300) : clamp(-tangentSpeed * 1.4, -280, 280)
        applyForce(tx * grip, ty * grip, wheel, dt)
      }
    }

    if (!grounded) {
      const torque = (controls.gas ? -2.7 : 0) + (controls.brake ? 2.7 : 0)
      car.omega += torque * dt
      state.airRotation += car.omega * dt
    }

    if (controls.gas && state.fuel > 0) state.fuel = Math.max(0, state.fuel - dt * 1.45)
    else state.fuel = Math.max(0, state.fuel - dt * .18)

    car.x += car.vx * dt
    car.y += car.vy * dt
    car.angle += car.omega * dt
    car.vx = clamp(car.vx, -160, 520 + difficulty * 120)
    car.vy = clamp(car.vy, -650, 800)
    state.wheelSpin += car.vx * dt / 22
    state.maxX = Math.max(state.maxX, car.x)
    state.distance = Math.max(0, (state.maxX - 170) / 10000)

    if (!grounded && state.lastGrounded) {
      state.airRotation = 0
      state.airStartAngle = car.angle
    }
    if (grounded && !state.lastGrounded) {
      const rotations = Math.floor(Math.abs(state.airRotation) / (TAU * .82))
      const upright = Math.abs(normalizeAngle(car.angle - Math.atan(terrainSlope(car.x)))) < .72
      if (rotations > 0 && upright) {
        const earned = rotations * 500
        state.bonus += earned
        showPopup(rotations > 1 ? `ZABARDAST! ${rotations}x FLIP +${earned}` : `SHABASH! FLIP +${earned}`)
        beep(720, .13, 'triangle', .035)
      } else if (Math.abs(car.vy) > 170 && upright) {
        state.bonus += 100
        showPopup('MAST LANDING! +100')
      }
    }
    state.lastGrounded = grounded

    for (const pickup of state.pickups) {
      if (pickup.taken || Math.abs(pickup.x - car.x) > 75) continue
      const pickupY = terrainY(pickup.x) - pickup.yOffset
      if (Math.hypot(pickup.x - car.x, pickupY - car.y) < 72) {
        pickup.taken = true
        if (pickup.type === 'fuel') {
          state.fuel = Math.min(100, state.fuel + 42)
          showPopup('FULL TANK! CHALO!')
          beep(340, .18, 'sine', .04)
        } else {
          state.coins += 1
          state.bonus += 50
          if (state.coins % 5 === 0) showPopup('PAISA HI PAISA! +250')
          beep(880, .07, 'square', .018)
        }
      }
    }

    seedPickups(car.x + 6000, car.x + 10000)
    state.pickups = state.pickups.filter((pickup) => pickup.x > car.x - 1000)

    const roofA = localToWorld(-39, -28)
    const roofB = localToWorld(38, -28)
    const nose = localToWorld(67, -4)
    const roofHit = roofA.y > terrainY(roofA.x) - 2 || roofB.y > terrainY(roofB.x) - 2
    const noseHit = nose.y > terrainY(nose.x) && Math.abs(car.vx) > 55
    if (roofHit || noseHit || car.y > height + 250 || (state.fuel <= 0 && Math.abs(car.vx) < 3 && grounded)) crash()

    const targetCamera = car.x - width * .31
    state.cameraX = lerp(state.cameraX, targetCamera, 1 - Math.pow(.0005, dt))
    const targetY = clamp(car.y - height * .49, -140, 210)
    state.cameraY = lerp(state.cameraY, targetY, 1 - Math.pow(.02, dt))
    if (state.popup && state.time > state.popupUntil) state.popup = ''
  }

  function crash() {
    if (state.crashed) return
    state.crashed = true
    state.running = false
    controls.gas = false
    controls.brake = false
    showPopup('OH HO!')
    beep(100, .45, 'sawtooth', .045)
    callbacks.onCrash(state.distance)
  }

  function drawSky() {
    const gradient = ctx.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, '#e99b55')
    gradient.addColorStop(.43, '#f6d18a')
    gradient.addColorStop(1, '#a9b77a')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)

    ctx.save()
    ctx.globalAlpha = .32
    ctx.fillStyle = '#fff0c0'
    ctx.beginPath(); ctx.arc(width * .77, height * .22, 58, 0, TAU); ctx.fill()
    ctx.globalAlpha = 1
    drawFlag(width * .74 - (state.cameraX * .02) % (width + 300), height * .1, 170, state.time)
    ctx.restore()
  }

  function drawFlag(x, y, scale, time) {
    ctx.save(); ctx.translate(x, y)
    ctx.strokeStyle = '#44372b'; ctx.lineWidth = 5
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, scale * 1.25); ctx.stroke()
    ctx.fillStyle = 'rgba(1,65,28,.72)'
    ctx.beginPath(); ctx.moveTo(2, 4)
    for (let i = 0; i <= 6; i += 1) {
      const px = (i / 6) * scale
      const py = Math.sin(time * 2 + i * .7) * 5
      ctx.lineTo(px, py + 4)
    }
    for (let i = 6; i >= 0; i -= 1) {
      const px = (i / 6) * scale
      const py = Math.sin(time * 2 + i * .7) * 5 + scale * .6
      ctx.lineTo(px, py)
    }
    ctx.closePath(); ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(2, 4, scale * .22, scale * .6)
    ctx.beginPath(); ctx.arc(scale * .54, scale * .3, scale * .13, .4, 5.5); ctx.fill()
    ctx.fillStyle = '#3b7c4c'; ctx.beginPath(); ctx.arc(scale * .58, scale * .27, scale * .115, .4, 5.5); ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,.85)'; star(ctx, scale * .69, scale * .18, 5, scale * .05, scale * .022); ctx.fill()
    ctx.restore()
  }

  function star(context, x, y, points, outer, inner) {
    context.beginPath()
    for (let i = 0; i < points * 2; i += 1) {
      const radius = i % 2 ? inner : outer
      const angle = -Math.PI / 2 + (i * Math.PI) / points
      context.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius)
    }
    context.closePath()
  }

  function drawMountains() {
    const layers = [
      { factor: .08, base: .63, color: '#718363', amp: 78, step: 250 },
      { factor: .16, base: .71, color: '#496b50', amp: 65, step: 185 },
    ]
    for (const layer of layers) {
      const shift = (state.cameraX * layer.factor) % layer.step
      ctx.fillStyle = layer.color
      ctx.beginPath(); ctx.moveTo(0, height)
      for (let x = -layer.step - shift; x < width + layer.step; x += layer.step) {
        const peak = height * layer.base - Math.abs(hash(Math.floor((x + state.cameraX * layer.factor) / layer.step))) * layer.amp
        ctx.lineTo(x, height * layer.base + 25); ctx.lineTo(x + layer.step * .5, peak); ctx.lineTo(x + layer.step, height * layer.base + 25)
      }
      ctx.lineTo(width, height); ctx.closePath(); ctx.fill()
    }
    drawSkyline()
  }

  function drawSkyline() {
    const shift = state.cameraX * .28
    ctx.save(); ctx.translate(-shift, 0); ctx.fillStyle = '#214d37'; ctx.globalAlpha = .82
    const start = Math.floor(shift / 900) * 900
    for (let base = start - 900; base < shift + width + 900; base += 900) {
      const y = height * .66
      ctx.fillRect(base + 110, y - 55, 90, 55)
      ctx.beginPath(); ctx.arc(base + 155, y - 55, 45, Math.PI, TAU); ctx.fill()
      ctx.fillRect(base + 240, y - 115, 19, 115)
      ctx.beginPath(); ctx.moveTo(base + 236, y - 115); ctx.lineTo(base + 250, y - 150); ctx.lineTo(base + 264, y - 115); ctx.fill()
      drawTruck(ctx, base + 520, y - 40, .72)
    }
    ctx.restore()
  }

  function drawTruck(context, x, y, scale) {
    context.save(); context.translate(x, y); context.scale(scale, scale)
    context.fillStyle='#b84834'; context.fillRect(0,-38,120,48)
    context.fillStyle='#e6a93d'; context.fillRect(8,-31,104,10)
    context.fillStyle='#1d6c59'; context.fillRect(10,-16,100,9)
    context.fillStyle='#d97032'; context.fillRect(120,-29,45,39)
    context.fillStyle='#172b28'; context.fillRect(128,-24,27,17)
    context.fillStyle='#20231f'; context.beginPath(); context.arc(33,13,13,0,TAU); context.arc(137,13,13,0,TAU); context.fill()
    context.restore()
  }

  function drawBunting() {
    const spacing = 700
    const start = Math.floor((state.cameraX - 200) / spacing) * spacing
    ctx.save(); ctx.translate(-state.cameraX, -state.cameraY)
    for (let x = start; x < state.cameraX + width + spacing; x += spacing) {
      const ground = terrainY(x)
      ctx.strokeStyle='#413728'; ctx.lineWidth=3
      ctx.beginPath(); ctx.moveTo(x,ground); ctx.lineTo(x,ground-145); ctx.lineTo(x+spacing,terrainY(x+spacing)-145); ctx.stroke()
      for(let j=1;j<7;j+=1){
        const px=x+j*spacing/7, py=lerp(ground-145,terrainY(x+spacing)-145,j/7)+Math.sin(j)*8
        ctx.fillStyle=j%2?'#01411c':'#f4f0de'; ctx.beginPath(); ctx.moveTo(px-13,py);ctx.lineTo(px+13,py);ctx.lineTo(px,py+25);ctx.closePath();ctx.fill()
      }
    }
    ctx.restore()
  }

  function drawTerrain() {
    const left = state.cameraX - 60
    const right = state.cameraX + width + 60
    ctx.save(); ctx.translate(-state.cameraX, -state.cameraY)
    ctx.fillStyle = '#6d5429'; ctx.beginPath(); ctx.moveTo(left, height + state.cameraY + 150)
    for (let x = left; x <= right; x += 12) ctx.lineTo(x, terrainY(x))
    ctx.lineTo(right, height + state.cameraY + 150); ctx.closePath(); ctx.fill()
    ctx.strokeStyle = '#263d25'; ctx.lineWidth = 13; ctx.lineJoin='round'; ctx.beginPath()
    for (let x=left;x<=right;x+=10) { const y=terrainY(x); if(x===left)ctx.moveTo(x,y);else ctx.lineTo(x,y) }
    ctx.stroke()
    ctx.strokeStyle='#b68a3f';ctx.lineWidth=5;ctx.stroke()
    ctx.restore()
  }

  function drawProps() {
    const start = Math.floor((state.cameraX - 400) / 850)
    const end = Math.ceil((state.cameraX + width + 400) / 850)
    ctx.save(); ctx.translate(-state.cameraX, -state.cameraY)
    for (let i=start;i<=end;i+=1) {
      const x=i*850+hash(i+50)*160, y=terrainY(x)
      const kind=Math.abs(i)%5
      if(kind===0) drawDhaba(x,y)
      else if(kind===1) drawRickshaw(x,y)
      else if(kind===2) drawPso(x,y)
      else if(kind===3) drawCow(x,y)
      else drawDonkeyCart(x,y)
    }
    for (const pickup of state.pickups) if (!pickup.taken && pickup.x>state.cameraX-80&&pickup.x<state.cameraX+width+80) drawPickup(pickup)
    ctx.restore()
  }

  function drawDhaba(x,y){ctx.save();ctx.translate(x,y);ctx.fillStyle='#493927';ctx.fillRect(-55,-55,110,55);ctx.fillStyle='#b44430';ctx.beginPath();ctx.moveTo(-65,-55);ctx.lineTo(65,-55);ctx.lineTo(45,-82);ctx.lineTo(-48,-82);ctx.closePath();ctx.fill();ctx.fillStyle='#f2c65b';ctx.font='900 12px Montserrat';ctx.textAlign='center';ctx.fillText('چائے  DHABA',0,-62);ctx.restore()}
  function drawRickshaw(x,y){ctx.save();ctx.translate(x,y-6);ctx.fillStyle='#e6a62c';ctx.strokeStyle='#253b2d';ctx.lineWidth=4;roundedRect(ctx,-40,-51,72,43,8);ctx.fill();ctx.stroke();ctx.fillStyle='#1d5941';ctx.fillRect(-32,-43,42,24);ctx.fillStyle='#20231f';ctx.beginPath();ctx.arc(-24,0,12,0,TAU);ctx.arc(27,0,12,0,TAU);ctx.fill();ctx.restore()}
  function drawPso(x,y){ctx.save();ctx.translate(x,y);ctx.fillStyle='#eee9d8';ctx.fillRect(-7,-115,14,115);ctx.fillStyle='#fff';ctx.strokeStyle='#194b39';ctx.lineWidth=4;roundedRect(ctx,-38,-142,76,39,7);ctx.fill();ctx.stroke();ctx.fillStyle='#ea3536';ctx.font='900 18px Montserrat';ctx.textAlign='center';ctx.fillText('PSO',0,-116);ctx.restore()}
  function drawCow(x,y){ctx.save();ctx.translate(x,y);ctx.fillStyle='#e8ded0';ctx.strokeStyle='#332d27';ctx.lineWidth=3;roundedRect(ctx,-36,-43,69,34,15);ctx.fill();ctx.stroke();ctx.beginPath();ctx.arc(37,-32,15,0,TAU);ctx.fill();ctx.stroke();ctx.fillStyle='#332d27';ctx.beginPath();ctx.arc(-15,-25,8,0,TAU);ctx.fill();ctx.fillRect(-24,-13,6,17);ctx.fillRect(20,-13,6,17);ctx.restore()}
  function drawDonkeyCart(x,y){ctx.save();ctx.translate(x,y);ctx.strokeStyle='#372d23';ctx.lineWidth=4;ctx.strokeRect(-10,-47,68,30);ctx.beginPath();ctx.moveTo(-10,-20);ctx.lineTo(-58,-27);ctx.stroke();ctx.fillStyle='#756958';ctx.beginPath();ctx.ellipse(-74,-34,22,13,0,0,TAU);ctx.fill();ctx.beginPath();ctx.moveTo(-87,-43);ctx.lineTo(-94,-61);ctx.lineTo(-82,-49);ctx.fill();ctx.fillStyle='#292824';ctx.beginPath();ctx.arc(3,-8,12,0,TAU);ctx.arc(48,-8,12,0,TAU);ctx.fill();ctx.restore()}
  function drawPickup(pickup){const y=terrainY(pickup.x)-pickup.yOffset;const bob=Math.sin(state.time*4+pickup.id)*5;ctx.save();ctx.translate(pickup.x,y+bob);if(pickup.type==='coin'){ctx.fillStyle='#f6c644';ctx.strokeStyle='#8a6217';ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,15,0,TAU);ctx.fill();ctx.stroke();ctx.fillStyle='#fff1a2';ctx.font='900 14px Montserrat';ctx.textAlign='center';ctx.fillText('₨',0,5)}else{ctx.fillStyle='#e8e7dc';ctx.strokeStyle='#24402d';ctx.lineWidth=4;roundedRect(ctx,-17,-22,34,44,6);ctx.fill();ctx.stroke();ctx.fillStyle='#d74435';ctx.fillRect(-11,-15,22,24);ctx.fillStyle='#fff';ctx.font='900 10px Montserrat';ctx.textAlign='center';ctx.fillText('FUEL',0,1)}ctx.restore()}

  function drawCar() {
    const car=state.car
    ctx.save();ctx.translate(car.x-state.cameraX,car.y-state.cameraY);ctx.rotate(car.angle)
    ctx.strokeStyle='#1d2721';ctx.lineWidth=5
    for(const wx of [-48,48]){ctx.beginPath();ctx.moveTo(wx,-1);ctx.lineTo(wx,27);ctx.stroke()}
    for(const wx of [-48,48]){ctx.save();ctx.translate(wx,29);ctx.rotate(state.wheelSpin);ctx.fillStyle='#172019';ctx.beginPath();ctx.arc(0,0,25,0,TAU);ctx.fill();ctx.strokeStyle='#111';ctx.lineWidth=3;ctx.stroke();ctx.fillStyle='#b9b4a8';ctx.beginPath();ctx.arc(0,0,11,0,TAU);ctx.fill();ctx.strokeStyle='#4b514c';ctx.lineWidth=2;for(let i=0;i<6;i+=1){ctx.rotate(TAU/6);ctx.beginPath();ctx.moveTo(4,0);ctx.lineTo(18,0);ctx.stroke()}ctx.restore()}
    ctx.fillStyle='#e9e6dc';ctx.strokeStyle='#203027';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-70,18);ctx.lineTo(-66,-18);ctx.lineTo(-43,-31);ctx.lineTo(-22,-52);ctx.lineTo(32,-52);ctx.lineTo(57,-28);ctx.lineTo(70,-23);ctx.lineTo(72,18);ctx.closePath();ctx.fill();ctx.stroke()
    ctx.fillStyle='#8da5a0';ctx.beginPath();ctx.moveTo(-34,-29);ctx.lineTo(-16,-47);ctx.lineTo(4,-47);ctx.lineTo(4,-28);ctx.closePath();ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(10,-47);ctx.lineTo(29,-47);ctx.lineTo(48,-28);ctx.lineTo(10,-28);ctx.closePath();ctx.fill();ctx.stroke()
    ctx.strokeStyle='#a4a39d';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(5,-48);ctx.lineTo(5,10);ctx.stroke()
    ctx.fillStyle='#01411c';ctx.fillRect(-67,6,139,9)
    ctx.fillStyle='#f6cf55';ctx.strokeStyle='#203027';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(65,-14,8,6,0,0,TAU);ctx.fill();ctx.stroke()
    ctx.fillStyle='#303b35';for(let i=0;i<3;i+=1)ctx.fillRect(66,-5+i*5,7,2)
    ctx.fillStyle='#fff';ctx.font='900 8px Montserrat';ctx.textAlign='center';ctx.fillText('MEHRAN',-22,8)
    ctx.restore()
  }

  function draw() {
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height)
    drawSky();drawMountains();drawBunting();drawProps();drawTerrain();drawCar()
    if (!state.running && !state.crashed) {
      ctx.fillStyle='rgba(18,41,29,.12)';ctx.fillRect(0,0,width,height)
    }
  }

  function reportHud() {
    callbacks.onHud({
      distance: state.distance, fuel: state.fuel, coins: state.coins, bonus: state.bonus,
      speed: Math.abs(state.car.vx) * .18, popup: state.popup,
    })
  }

  function loop(now) {
    const frameTime=clamp((now-previousTime)/1000,0,.05);previousTime=now;accumulator+=frameTime
    const fixed=1/120
    while(accumulator>=fixed){update(fixed);accumulator-=fixed}
    draw()
    if(Math.floor(now/100)!==Math.floor((now-frameTime*1000)/100))reportHud()
    animationFrame=requestAnimationFrame(loop)
  }

  function resize() {
    const rect=canvas.getBoundingClientRect();width=Math.max(1,rect.width);height=Math.max(1,rect.height);dpr=Math.min(devicePixelRatio||1,2)
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr)
    if(!state.running){state.car.y=terrainY(state.car.x)-56;state.cameraY=0}
  }

  function key(event, down) {
    const gas=['ArrowRight','KeyD','Space','ArrowUp'].includes(event.code)
    const brake=['ArrowLeft','KeyA','ArrowDown'].includes(event.code)
    if(gas||brake){event.preventDefault();if(gas)controls.gas=down;if(brake)controls.brake=down}
  }
  const onKeyDown=(event)=>key(event,true)
  const onKeyUp=(event)=>key(event,false)
  const onBlur=()=>{controls.gas=false;controls.brake=false}
  window.addEventListener('resize',resize);window.addEventListener('keydown',onKeyDown);window.addEventListener('keyup',onKeyUp);window.addEventListener('blur',onBlur)
  resize();state.car.y=terrainY(state.car.x)-56;animationFrame=requestAnimationFrame(loop)

  return {
    start:reset,
    setControl(name,down){controls[name]=down;if(down&&audio?.state==='suspended')audio.resume()},
    setMuted(value){state.muted=value},
    destroy(){cancelAnimationFrame(animationFrame);window.removeEventListener('resize',resize);window.removeEventListener('keydown',onKeyDown);window.removeEventListener('keyup',onKeyUp);window.removeEventListener('blur',onBlur);audio?.close()},
  }
}
