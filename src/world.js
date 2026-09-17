import * as THREE from 'three'
import { Sky } from 'three/addons/objects/Sky.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { ROAD_HALF, ROAD_LENGTH, roadPoint, roadFrame, roadPosition, terrainHeight, random, placeOnRoad } from './road'
import { box } from './vehicles'

export const CONDITIONS = {
  alpine: { label: 'Alpine morning', sun: 0xffefcf, sky: 0xb3c2cb, elevation: 34, azimuth: 115, exposure: 1.05, intensity: 3.2 },
  golden: { label: 'Golden hour', sun: 0xffc184, sky: 0xbaaea0, elevation: 13, azimuth: 125, exposure: 1, intensity: 3.1 },
}

function surfaceTexture() {
  const size = 1024
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  const pixels = ctx.createImageData(size, size)
  const rng = random(90210)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const grit = rng()
      const lane = Math.pow(Math.sin(x / size * Math.PI * 8), 18)
      const value = 64 + (grit - .5) * 27 - lane * 4 + Math.sin(y * .013) * 2
      pixels.data[i] = value * .95
      pixels.data[i + 1] = value
      pixels.data[i + 2] = value * 1.025
      pixels.data[i + 3] = 255
    }
  }
  ctx.putImageData(pixels, 0, 0)
  ctx.lineWidth = 1.3
  ctx.strokeStyle = 'rgba(13,19,22,.32)'
  for (let j = 0; j < 9; j++) {
    let x = rng() * size, y = rng() * size
    ctx.beginPath(); ctx.moveTo(x, y)
    for (let k = 0; k < 8; k++) { x += (rng() - .5) * 38; y += rng() * 24; ctx.lineTo(x, y) }
    ctx.stroke()
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function stripGeometry(offsets, terrain = false, lift = 0, step = 8) {
  const positions = [], uvs = [], colors = [], indices = []
  const low = new THREE.Color(0x666c50), rock = new THREE.Color(0x929080), soil = new THREE.Color(0x686449)
  let row = 0
  for (let s = -200; s <= ROAD_LENGTH + 400; s += step, row++) {
    const center = roadPoint(s), { right } = roadFrame(s)
    offsets.forEach((offset, column) => {
      const rise = terrain ? terrainHeight(s, offset) : 0
      const point = center.clone().addScaledVector(right, offset)
      positions.push(point.x, point.y + rise + lift, point.z)
      uvs.push(terrain ? offset / 13 : column, s / (terrain ? 13 : 18))
      const noise = .5 + .5 * Math.sin(s * .03 + offset * .1) * Math.sin(offset * .19 - s * .018)
      const tint = low.clone().lerp(rock, Math.min(1, Math.abs(offset) / 160) * .6 + noise * .35).lerp(soil, noise * .25)
      colors.push(tint.r, tint.g, tint.b)
      if (row && column) {
        const a = row * offsets.length + column
        indices.push(a - offsets.length - 1, a, a - 1, a - offsets.length - 1, a - offsets.length, a)
      }
    })
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function pineGeometry() {
  const geometries = []
  for (let layer = 0; layer < 3; layer++) {
    const geometry = new THREE.PlaneGeometry(5.2, 10)
    geometry.translate(0, 5, 0)
    geometry.rotateY(layer * Math.PI / 3)
    geometries.push(geometry)
  }
  const merged = mergeGeometries(geometries)
  geometries.forEach(geometry => geometry.dispose())
  return merged
}

function pineTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 512; canvas.height = 1024
  const ctx = canvas.getContext('2d'), rng = random(12891)
  ctx.lineCap = 'round'
  ctx.strokeStyle = '#554937'; ctx.lineWidth = 9
  ctx.beginPath(); ctx.moveTo(256, 1008); ctx.lineTo(252, 46); ctx.stroke()
  function twig(x, y, length, angle, depth) {
    const endX = x + Math.cos(angle) * length, endY = y + Math.sin(angle) * length
    ctx.strokeStyle = depth > 1 ? '#374a30' : `rgb(${32 + rng() * 25},${48 + rng() * 28},${33 + rng() * 15})`
    ctx.lineWidth = depth > 1 ? 2 : 1
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(endX, endY); ctx.stroke()
    const steps = depth > 1 ? 10 : 7
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      const bx = x + (endX - x) * t, by = y + (endY - y) * t
      for (const side of [-1, 1]) {
        if (depth > 1) twig(bx, by, length * (.22 + rng() * .12) * (1 - t * .55), angle + side * .65, depth - 1)
        else {
          const needle = 3 + rng() * 7, a = angle + side * .7
          ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a) * needle, by + Math.sin(a) * needle); ctx.stroke()
        }
      }
    }
  }
  for (let layer = 0; layer < 39; layer++) {
    const y = 840 - layer * 20, width = (1 - layer / 41) * (145 + rng() * 60)
    for (const side of [-1, 1]) {
      twig(254 + (rng() - .5) * 8, y, width, side === 1 ? .12 + rng() * .25 : Math.PI - .12 - rng() * .25, 3)
      twig(254, y - 7, width * .6, side === 1 ? -.3 : Math.PI + .3, 2)
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

function mountainGeometry(seed, width, depth, height) {
  const geo = new THREE.PlaneGeometry(width, depth, 140, 72)
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position, colors = []
  const c = new THREE.Color(), stone = new THREE.Color(0x737e82), snow = new THREE.Color(0xd9e1df)
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i)
    const ridge = Math.pow(Math.max(0, 1 - Math.abs(z) / (depth * .55)), 1.2)
    const peaks = .62 + .17 * Math.sin(x * .005 + seed) + .1 * Math.sin(x * .011 - seed * 2) + .045 * Math.sin(x * .029 + z * .014)
    const detail = Math.sin(x * .12 + z * .09) * 6 + Math.sin(z * .057 - x * .05) * 12 + Math.abs(Math.sin(x * .046 + z * .072)) * 22
    const y = Math.max(0, ridge * height * peaks + detail * ridge)
    pos.setY(i, y - 40)
    const snowLine = height * .4 + Math.sin(x * .022) * 18 + Math.sin(z * .01) * 22
    c.copy(stone).lerp(snow, THREE.MathUtils.smoothstep(y, snowLine, snowLine + 30))
    c.multiplyScalar(.84 + .16 * Math.sin(x * .09 + z * .014))
    colors.push(c.r, c.g, c.b)
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geo.computeVertexNormals()
  return geo
}

function labelTexture(text, subtext) {
  const canvas = document.createElement('canvas')
  canvas.width = 768; canvas.height = 256
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#183d35'; ctx.fillRect(0, 0, 768, 256)
  ctx.strokeStyle = '#d4ded3'; ctx.lineWidth = 7; ctx.strokeRect(12, 12, 744, 232)
  ctx.fillStyle = '#f3f1df'; ctx.font = 'bold 64px Arial'; ctx.textAlign = 'center'
  ctx.fillText(text, 384, 108)
  ctx.font = '32px Arial'; ctx.fillText(subtext, 384, 180)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export function createWorld(scene, renderer, mobile) {
  const root = new THREE.Group()
  scene.add(root)
  const sky = new Sky(); sky.scale.setScalar(12000)
  // Compress the analytic sky's radiance before using it for both the visible
  // background and IBL, so reflections and bloom share a controlled range.
  sky.material.fragmentShader = sky.material.fragmentShader.replace(
    'gl_FragColor = vec4( texColor, 1.0 );',
    'gl_FragColor = vec4( texColor / (vec3(1.0) + texColor), 1.0 );',
  )
  sky.material.uniforms.turbidity.value = 3.2
  sky.material.uniforms.rayleigh.value = 2
  sky.material.uniforms.mieCoefficient.value = .003
  sky.material.uniforms.mieDirectionalG.value = .87
  // The analytic sun is extremely bright in HDR. Keep it out of bloom and use
  // the directional light for the sun; otherwise one pixel washes out the scene.
  sky.material.uniforms.showSunDisc.value = 0
  root.add(sky)
  scene.fog = new THREE.FogExp2(0x9aacb6, .00055)
  scene.environmentIntensity = .45
  const ambient = new THREE.HemisphereLight(0xc0d8ef, 0x67634f, 1.6)
  root.add(ambient)
  const sun = new THREE.DirectionalLight(0xffefcf, 3.1)
  sun.castShadow = true
  const shadowSize = mobile ? 1024 : 2048
  sun.shadow.mapSize.set(shadowSize, shadowSize)
  Object.assign(sun.shadow.camera, { left: -48, right: 48, top: 65, bottom: -45, near: 1, far: 320 })
  sun.shadow.normalBias = .035
  sun.shadow.bias = -.00015
  root.add(sun, sun.target)
  const sunVector = new THREE.Vector3()
  const pmrem = new THREE.PMREMGenerator(renderer)
  let environment
  function setCondition(name) {
    const condition = CONDITIONS[name] || CONDITIONS.alpine
    sunVector.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - condition.elevation), THREE.MathUtils.degToRad(condition.azimuth))
    sky.material.uniforms.sunPosition.value.copy(sunVector)
    sky.material.uniforms.turbidity.value = name === 'golden' ? 5.5 : 3.2
    sun.color.set(condition.sun); sun.intensity = condition.intensity
    scene.fog.color.set(condition.sky)
    renderer.toneMappingExposure = condition.exposure
    const envScene = new THREE.Scene()
    const envSky = sky.clone(); envSky.material = sky.material.clone(); envSky.material.uniforms.showSunDisc.value = 0; envScene.add(envSky)
    // Ground hemisphere supplies believable lower-body reflections as well as the sky.
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(20000, 20000), new THREE.MeshBasicMaterial({ color: 0x454b43 }))
    ground.rotation.x = -Math.PI / 2; ground.position.y = -10; envScene.add(ground)
    const next = pmrem.fromScene(envScene, .025, .1, 15000)
    scene.environment = next.texture
    environment?.dispose(); environment = next
    ground.geometry.dispose(); ground.material.dispose(); envSky.material.dispose()
  }
  setCondition('alpine')

  const asphalt = surfaceTexture(); asphalt.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy())
  const roadMaterial = new THREE.MeshStandardMaterial({ map: asphalt, bumpMap: asphalt, bumpScale: .018, roughness: .86, metalness: .03, side: THREE.DoubleSide })
  const road = new THREE.Mesh(stripGeometry([-ROAD_HALF, ROAD_HALF]), roadMaterial)
  road.receiveShadow = true; root.add(road)
  const groundTexture = new THREE.TextureLoader().load('/textures/mountain-ground-hd.png')
  groundTexture.wrapS = groundTexture.wrapT = THREE.RepeatWrapping
  groundTexture.colorSpace = THREE.SRGBColorSpace
  groundTexture.anisotropy = 8
  const groundMaterial = new THREE.MeshStandardMaterial({ map: groundTexture, bumpMap: groundTexture, bumpScale: .28, vertexColors: true, roughness: 1, side: THREE.DoubleSide })
  const offsets = [ROAD_HALF, 9, 13, 19, 30, 47, 72, 108, 165, 235, 340, 480, 720]
  for (const side of [-1, 1]) {
    const terrain = new THREE.Mesh(stripGeometry(offsets.map(x => x * side), true, -.025, 16), groundMaterial)
    terrain.receiveShadow = true; root.add(terrain)
    const shoulder = new THREE.Mesh(stripGeometry([side * ROAD_HALF, side * (ROAD_HALF + .65)], false, -.01), new THREE.MeshStandardMaterial({ color: 0x7b7769, roughness: 1, side: THREE.DoubleSide }))
    root.add(shoulder)
    const edge = new THREE.Mesh(stripGeometry([side * (ROAD_HALF - .3), side * (ROAD_HALF - .16)], false, .014), new THREE.MeshStandardMaterial({ color: 0xdbd9c6, roughness: .8, side: THREE.DoubleSide }))
    root.add(edge)
  }
  for (const offset of [-.09, .09]) {
    const centerLine = new THREE.Mesh(stripGeometry([offset - .045, offset + .045], false, .016), new THREE.MeshStandardMaterial({ color: 0xd9b878, roughness: .8, side: THREE.DoubleSide }))
    root.add(centerLine)
  }

  const mountainRoot = new THREE.Group(); root.add(mountainRoot)
  const mountainMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide })
  mountainMaterial.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vMountain;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMountain = position;')
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vMountain;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float strata = sin(vMountain.y * .16 + sin(vMountain.x * .027) * 4. + vMountain.z * .014);
        float grain = sin(vMountain.x * 1.7 + vMountain.z * .7) * sin(vMountain.y * 2.3 + vMountain.z);
        diffuseColor.rgb *= .88 + .09 * strata + .045 * grain;`)
  }
  for (let i = 0; i < 5; i++) {
    const mountain = new THREE.Mesh(mountainGeometry(i * 2.7, 3100, 1400, 330 + i * 64), mountainMaterial)
    mountain.position.set((i - 2) * 1200, -160, -1800 - Math.abs(i - 2) * 130)
    mountain.rotation.y = (i - 2) * .36
    mountainRoot.add(mountain)
  }

  const rng = random(4152)
  const treeCount = mobile ? 430 : 950
  const treeGeometry = pineGeometry()
  const trees = new THREE.InstancedMesh(treeGeometry, new THREE.MeshStandardMaterial({ map: pineTexture(), alphaTest: .35, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 1, envMapIntensity: .3 }), treeCount)
  trees.castShadow = true; trees.receiveShadow = true; trees.frustumCulled = false
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(.12, .26, 3, 6).translate(0, 1.5, 0), new THREE.MeshStandardMaterial({ color: 0x655444, roughness: 1 }), treeCount)
  trunks.castShadow = true; trunks.frustumCulled = false
  root.add(trees, trunks)
  const forest = Array.from({ length: treeCount }, (_, i) => ({
    s: -100 + rng() * 1550, offset: (i % 2 ? 1 : -1) * (11 + Math.pow(rng(), 1.6) * 230),
    scale: .65 + rng() * 1.35, angle: rng() * Math.PI * 2,
  }))
  const rockCount = mobile ? 80 : 160
  const rockGeo = new THREE.IcosahedronGeometry(1, 1)
  const rockPos = rockGeo.attributes.position
  for (let i = 0; i < rockPos.count; i++) {
    const x = rockPos.getX(i), y = rockPos.getY(i), z = rockPos.getZ(i)
    const n = 1 + .15 * Math.sin(x * 11 + y * 9) * Math.sin(z * 8)
    rockPos.setXYZ(i, x * n, y * n, z * n)
  }
  rockGeo.computeVertexNormals()
  const rocks = new THREE.InstancedMesh(rockGeo, new THREE.MeshStandardMaterial({ color: 0x7c7c6f, roughness: 1, map: groundTexture, bumpMap: groundTexture, bumpScale: .17 }), rockCount)
  rocks.castShadow = true; rocks.receiveShadow = true; rocks.frustumCulled = false; root.add(rocks)
  const stones = Array.from({ length: rockCount }, (_, i) => ({ s: -80 + rng() * 1200, offset: (i % 3 ? -1 : 1) * (11 + rng() * 49), scale: 1 + rng() * 3, angle: rng() * 6 }))

  const markerCount = mobile ? 100 : 170
  const lanes = new THREE.InstancedMesh(new THREE.BoxGeometry(.12, .012, 3.8), new THREE.MeshStandardMaterial({ color: 0xd9d9ce, roughness: .85 }), markerCount * 2)
  lanes.receiveShadow = true; lanes.frustumCulled = false; root.add(lanes)
  const railCount = mobile ? 150 : 230
  const metal = new THREE.MeshStandardMaterial({ color: 0xa5aeb0, roughness: .43, metalness: .72 })
  const railProfile = new THREE.Shape()
  railProfile.moveTo(-.05, -.14); railProfile.lineTo(.025, -.07); railProfile.lineTo(-.02, 0); railProfile.lineTo(.025, .07); railProfile.lineTo(-.05, .14); railProfile.lineTo(-.075, .14); railProfile.lineTo(-.045, 0); railProfile.lineTo(-.075, -.14)
  const railGeo = new THREE.ExtrudeGeometry(railProfile, { depth: 8.1, bevelEnabled: false, steps: 1 }).translate(0, 0, -4.05)
  const rails = new THREE.InstancedMesh(railGeo, metal, railCount * 2)
  rails.castShadow = true; rails.receiveShadow = true; rails.frustumCulled = false
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(.11, .83, .12), metal, railCount * 2)
  posts.castShadow = true; posts.frustumCulled = false
  const reflectors = new THREE.InstancedMesh(new THREE.BoxGeometry(.06, .09, .14), new THREE.MeshStandardMaterial({ color: 0xe3d1a3, emissive: 0xa67639, emissiveIntensity: .25 }), railCount * 2)
  reflectors.frustumCulled = false; root.add(rails, posts, reflectors)

  const grassCount = mobile ? 650 : 1600
  const blades = []
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.PlaneGeometry(.12, .7, 1, 2)
    const p = blade.attributes.position
    for (let j = 0; j < p.count; j++) {
      if (p.getY(j) > .2) p.setX(j, .13)
    }
    blade.translate(0, .35, 0); blade.rotateY(i * Math.PI / 3); blades.push(blade)
  }
  const grassGeo = mergeGeometries(blades); blades.forEach(g => g.dispose())
  const grass = new THREE.InstancedMesh(grassGeo, new THREE.MeshStandardMaterial({ color: 0x88825a, side: THREE.DoubleSide, roughness: 1 }), grassCount)
  grass.frustumCulled = false; root.add(grass)
  const grasses = Array.from({ length: grassCount }, (_, i) => ({ s: rng() * 700, offset: (i % 2 ? 1 : -1) * (8.4 + rng() * 22), scale: .35 + rng() * .9, angle: rng() * 6 }))

  const signs = []
  for (let i = 0; i < 5; i++) {
    const sign = new THREE.Group()
    sign.add(box(.1, 3.1, .1, metal, -1.3, 1.55), box(.1, 3.1, .1, metal, 1.3, 1.55))
    sign.add(box(3.6, 1.2, .1, new THREE.MeshStandardMaterial({ map: labelTexture(i % 2 ? 'COL DE LA MORT' : 'DESCENT  /  07', i % 2 ? 'ALT.  2 480 M' : 'LOW GEAR   •   30 KM'), roughness: .7 }), 0, 3.05))
    root.add(sign); signs.push({ object: sign, s: 205 + i * 740 })
  }

  const dummy = new THREE.Object3D()
  let lastTile = -Infinity
  function updateInstances(items, meshes, progress, period) {
    items.forEach((item, i) => {
      while (item.s < progress - 100) item.s += period
      while (item.s > progress + period - 100) item.s -= period
      dummy.position.copy(roadPosition(item.s, item.offset))
      dummy.position.y += terrainHeight(item.s, item.offset) - .1
      dummy.rotation.set(0, item.angle, 0)
      dummy.scale.set(item.scale, item.scale * (meshes[0] === rocks ? .75 : 1), item.scale)
      dummy.updateMatrix(); meshes.forEach(mesh => mesh.setMatrixAt(i, dummy.matrix))
    })
    meshes.forEach(mesh => { mesh.instanceMatrix.needsUpdate = true })
  }
  function update(progress) {
    const p = roadPoint(progress)
    sun.position.copy(p).addScaledVector(sunVector, 180)
    sun.target.position.copy(p).add(new THREE.Vector3(0, 0, -25))
    sky.position.copy(p)
    mountainRoot.position.set(p.x * .3, p.y - 70, p.z)
    const tile = Math.floor(progress / 32)
    if (tile === lastTile) return
    lastTile = tile
    updateInstances(forest, [trees, trunks], progress, 1550)
    updateInstances(stones, [rocks], progress, 1200)
    updateInstances(grasses, [grass], progress, 700)
    dummy.scale.setScalar(1)
    for (let i = 0; i < markerCount; i++) {
      const s = Math.floor((progress - 90) / 12) * 12 + i * 12
      for (let side = 0; side < 2; side++) {
        placeOnRoad(dummy, s, (side ? 1 : -1) * ROAD_HALF / 2, .025)
        dummy.updateMatrix(); lanes.setMatrixAt(i * 2 + side, dummy.matrix)
      }
    }
    lanes.instanceMatrix.needsUpdate = true
    for (let i = 0; i < railCount; i++) {
      const s = Math.floor((progress - 90) / 8) * 8 + i * 8
      for (let side = 0; side < 2; side++) {
        placeOnRoad(dummy, s, (side ? 1 : -1) * (ROAD_HALF + .9), .8)
        dummy.updateMatrix(); rails.setMatrixAt(i * 2 + side, dummy.matrix)
        dummy.position.y -= .4; dummy.updateMatrix(); posts.setMatrixAt(i * 2 + side, dummy.matrix)
        dummy.position.y += .47; dummy.updateMatrix(); reflectors.setMatrixAt(i * 2 + side, dummy.matrix)
      }
    }
    for (const mesh of [rails, posts, reflectors]) mesh.instanceMatrix.needsUpdate = true
    for (const sign of signs) {
      while (sign.s < progress - 90) sign.s += 3700
      while (sign.s > progress + 3700) sign.s -= 3700
      placeOnRoad(sign.object, sign.s, ROAD_HALF + 3, 0)
    }
  }
  return {
    update, setCondition,
    setQuality(quality) { sun.castShadow = quality !== 'low'; trees.castShadow = quality === 'high'; renderer.shadowMap.needsUpdate = true },
    destroy() { environment?.dispose(); pmrem.dispose() },
  }
}
