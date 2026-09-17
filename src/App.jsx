import { useEffect, useRef, useState } from 'react'

const FINISHES = [{ name: 'Rosso', color: '#a91621' }, { name: 'Glacier', color: '#c3d2d5' }, { name: 'Obsidian', color: '#182529' }, { name: 'Saffron', color: '#c79638' }]
const INITIAL_HUD = { distance: 0, fuel: 100, speed: 0, passed: 0, bonus: 0, popup: '', gear: 'N', rpm: .1, camera: 'chase', fps: 60, quality: 'high' }
function readBest() { try { return Number(localStorage.getItem('deadly-descent-best')) || 0 } catch { return 0 } }

function Icon({ name, ...props }) {
  const paths = {
    sound: 'M11 5 6 9H3v6h3l5 4V5Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',
    mute: 'M11 5 6 9H3v6h3l5 4V5Zm5 4 5 6m0-6-5 6',
    camera: 'M8 5 6 8H3v12h18V8h-3l-2-3H8Zm8 9a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
    pause: 'M8 5v14M16 5v14',
    full: 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5',
    arrow: 'M4 12h16m-6-6 6 6-6 6',
  }
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name] || paths.arrow} /></svg>
}

function App() {
  const canvasRef = useRef(null), gameRef = useRef(null)
  const [phase, setPhase] = useState('loading')
  const [hud, setHud] = useState(INITIAL_HUD)
  const [best, setBest] = useState(readBest)
  const [muted, setMuted] = useState(false)
  const [paint, setPaint] = useState(0)
  const [condition, setCondition] = useState('alpine')
  const [ride, setRide] = useState('touring')
  const [notice, setNotice] = useState('')
  const [credits, setCredits] = useState(false)

  useEffect(() => {
    let disposed = false, instance
    import('./game').then(async ({ createGame }) => {
      if (disposed) return
      instance = await createGame(canvasRef.current, {
        onHud(value) {
          if (disposed) return
          setHud(value)
          if (value.reason) setBest(previous => {
            const next = Math.max(previous, value.distance)
            try { localStorage.setItem('deadly-descent-best', String(next)) } catch { /* Private browsing. */ }
            return next
          })
        },
        onPhase(value) { if (!disposed) setPhase(value) },
        onNotice(value) { if (!disposed) setNotice(value) },
      })
      if (disposed) { instance.destroy(); return }
      gameRef.current = instance
      setPhase('ready')
      if (import.meta.env.DEV && new URLSearchParams(location.search).has('test')) window.__descent = instance
    }).catch(error => { if (!disposed) { setPhase('error'); setNotice(`The graphics engine could not start. ${error.message}`) } })
    return () => { disposed = true; instance?.destroy(); gameRef.current = null; delete window.__descent }
  }, [])

  function start() { document.activeElement?.blur(); gameRef.current?.start(ride) }
  function control(event) {
    event.preventDefault()
    const button = event.currentTarget, pressed = event.type === 'pointerdown'
    if (pressed) button.setPointerCapture(event.pointerId)
    if (!pressed && button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId)
    gameRef.current?.setControl(button.dataset.control, pressed)
    button.classList.toggle('held', pressed)
  }
  const controlEvents = { onPointerDown: control, onPointerUp: control, onPointerCancel: control, onLostPointerCapture: control }
  function toggleSound() { const next = !muted; setMuted(next); gameRef.current?.setMuted(next) }
  async function fullscreen() {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen() } catch { setNotice('Fullscreen is not available in this browser.') }
  }
  const inRun = ['playing', 'paused', 'crashed', 'finished'].includes(phase)

  return (
    <main className={`game-shell phase-${phase}`}>
      <canvas ref={canvasRef} aria-label="Interactive alpine mountain driving game" />
      <div className="cinema-shade" aria-hidden="true" />
      <header className="topbar">
        <div className="brand"><span className="brand-mark">D<span>/</span>D</span><span className="brand-caption">DEADLY DESCENT<span>ALPINE MOTORSPORT</span></span></div>
        {phase === 'ready' && <div className="edition"><i /> THE ALPINE COLLECTION <span>VOL. 01</span></div>}
        <div className="toolbar">
          <label className="quality-picker"><span>GRAPHICS</span><select aria-label="Graphics quality" value={hud.quality} onChange={event => gameRef.current?.setQuality(event.target.value)}><option value="high">ULTRA</option><option value="medium">BALANCED</option><option value="low">PERFORMANCE</option></select></label>
          <button className="icon-button" onClick={toggleSound} aria-label={muted ? 'Enable sound' : 'Mute sound'} title="Engine sound"><Icon name={muted ? 'mute' : 'sound'} /></button>
          <button className="icon-button fullscreen-button" onClick={fullscreen} aria-label="Toggle fullscreen"><Icon name="full" /></button>
          {inRun && <><button className="icon-button" onClick={() => gameRef.current?.cycleCamera()} aria-label="Change camera" title="Change camera (C)"><Icon name="camera" /></button><button className="icon-button" onClick={() => gameRef.current?.pause()} aria-label="Pause or resume" title="Pause (P)"><Icon name="pause" /></button></>}
        </div>
      </header>

      {(phase === 'loading' || phase === 'error') && <section className="loading-panel" aria-live="polite"><span className="eyebrow">DEADLY DESCENT / VOL. 01</span><h1>{phase === 'error' ? 'ENGINE OFFLINE.' : 'THE MOUNTAIN\nIS CALLING.'}</h1>{phase === 'loading' ? <><div className="loading-line" /><p>Preparing your car and the alpine pass…</p></> : <><p>{notice}</p><button className="primary" onClick={() => location.reload()}>RETRY <Icon name="arrow" /></button></>}</section>}

      {phase === 'ready' && <>
        <section className="intro">
          <p className="eyebrow"><span>07</span> COL DE LA MORT · ALPINE PASS</p>
          <h1>DEADLY<br /><em>DESCENT.</em></h1>
          <p className="intro-copy">Thirty kilometres. One way down.<br />Find your line. Respect the mountain.</p>
          <div className="route-specs"><div><strong>30.0<span> KM</span></strong><small>THE DESCENT</small></div><div><strong>2,480<span> M</span></strong><small>SUMMIT ELEVATION</small></div><div><strong>04</strong><small>LANES. NO SECOND CHANCES.</small></div></div>
          <div className="drive-mode" aria-label="Driving mode"><button className={ride === 'touring' ? 'active' : ''} onClick={() => setRide('touring')}>TOURING <span>Composed & balanced</span></button><button className={ride === 'sport' ? 'active' : ''} onClick={() => setRide('sport')}>SPORT <span>Sharper & faster</span></button></div>
          <button className="primary" onClick={start}>START YOUR DESCENT <Icon name="arrow" /></button>
          <div className="keyboard-guide"><span><kbd>W A S D</kbd> DRIVE</span><span><kbd>SPACE</kbd> BOOST</span><span><kbd>C</kbd> CAMERA</span></div>
        </section>
        <section className="car-card" aria-label="Car customization">
          <div className="car-heading"><span className="eyebrow">YOUR DRIVE / 01</span><span className="live-badge"><i /> LIVE 3D</span></div>
          <h2>458 <span>ITALIA</span></h2>
          <p>4.5L V8 <i /> REAR-WHEEL DRIVE <i /> 7 SPEED</p>
          <div className="paint-row"><div className="swatches">{FINISHES.map((finish, i) => <button key={finish.name} aria-label={`${finish.name} paint`} aria-pressed={paint === i} className={paint === i ? 'selected' : ''} style={{ '--paint': finish.color }} onClick={() => { setPaint(i); gameRef.current?.setPaint(finish.color) }} />)}</div><span>{FINISHES[paint].name}</span></div>
          <div className="condition-picker"><button className={condition === 'alpine' ? 'active' : ''} onClick={() => { setCondition('alpine'); gameRef.current?.setCondition('alpine') }}><span>☀</span> ALPINE MORNING</button><button className={condition === 'golden' ? 'active' : ''} onClick={() => { setCondition('golden'); gameRef.current?.setCondition('golden') }}><span>◒</span> GOLDEN HOUR</button></div>
        </section>
        <footer className="menu-footer"><span><i /> REAL-TIME RENDERED. READY TO DRIVE.</span><button onClick={() => setCredits(true)}>CREDITS ↗</button><span>BEST RUN <b>{best.toFixed(2)} KM</b></span></footer>
      </>}

      {inRun && <>
        <section className="route-hud" aria-label="Run progress"><span className="eyebrow">COL DE LA MORT</span><div><strong>{hud.distance.toFixed(2)}</strong><span>/ 30.00 KM</span></div><div className="route-track"><i style={{ width: `${Math.min(100, hud.distance / 30 * 100)}%` }} /></div><p>SUMMIT → VALLEY <b>{hud.passed} PASSED</b></p></section>
        <div className="camera-label"><i /> {hud.camera.toUpperCase()} CAM <span>{hud.quality === 'high' ? 'ULTRA' : hud.quality.toUpperCase()}</span></div>
        <section className="speedometer" aria-label="Speed and fuel"><div className="rpm-track">{Array.from({ length: 22 }, (_, i) => <i key={i} className={i / 22 < hud.rpm ? 'on' : ''} />)}</div><div className="speed-number"><span className="gear">{hud.gear}<small>GEAR</small></span><strong>{Math.round(hud.speed).toString().padStart(3, '0')}</strong><span className="speed-unit">KM/H</span></div><div className={`fuel-row ${hud.fuel < 20 ? 'low-fuel' : ''}`}><span>FUEL</span><div><i style={{ width: `${hud.fuel}%` }} /></div><b>{Math.round(hud.fuel)}%</b></div></section>
        {hud.popup && phase === 'playing' && <div className="trick-popup">{hud.popup}</div>}
        {phase === 'playing' && <><div className="driving-hint"><kbd>W S</kbd> THROTTLE / BRAKE <span>·</span> <kbd>A D</kbd> STEER <span>·</span> <kbd>SPACE</kbd> BOOST <span>·</span> <kbd>P</kbd> PAUSE</div><section className="touch-controls" aria-label="Touch driving controls"><div className="steering-controls"><button data-control="steerLeft" aria-label="Steer left" {...controlEvents}>←</button><button data-control="steerRight" aria-label="Steer right" {...controlEvents}>→</button></div><div className="pedal-controls"><button data-control="boost" className="boost" {...controlEvents}>BOOST</button><button data-control="brake" {...controlEvents}>BRAKE</button><button data-control="gas" className="gas" {...controlEvents}>GAS ↑</button></div></section></>}
      </>}

      {['paused', 'crashed', 'finished'].includes(phase) && <section className="modal-scrim"><div className="run-modal"><span className="eyebrow">{phase === 'paused' ? 'TAKE A BREATH' : phase === 'finished' ? 'THE MOUNTAIN IS YOURS' : hud.reason || 'RUN OVER'}</span><h2>{phase === 'paused' ? 'ENGINE IDLING.' : phase === 'finished' ? 'DESCENT COMPLETE.' : 'END OF THE LINE.'}</h2><p><strong>{hud.distance.toFixed(2)} KM</strong> travelled <span> / </span> {hud.passed} overtakes</p><p className="run-best">PERSONAL BEST {best.toFixed(2)} KM</p><button className="primary" onClick={phase === 'paused' ? () => { document.activeElement?.blur(); gameRef.current?.pause() } : start}>{phase === 'paused' ? 'BACK TO THE ROAD' : 'DRIVE AGAIN'} <Icon name="arrow" /></button><button className="text-button" onClick={() => gameRef.current?.menu()}>RETURN TO GARAGE</button></div></section>}
      {credits && <section className="modal-scrim"><div className="run-modal credits"><span className="eyebrow">BUILT FOR THE DRIVE</span><h2>THE DETAILS.</h2><p>Ferrari 458 Italia model by <a href="https://sketchfab.com/models/57bf6cc56931426e87494f554df1dab6" target="_blank" rel="noreferrer">vicent091036</a>, distributed with the <a href="https://github.com/mrdoob/three.js/tree/r185" target="_blank" rel="noreferrer">Three.js examples</a>. Materials and lighting adapted for Deadly Descent.</p><p>Procedural alpine landscape, road surfaces, vegetation and driving systems. See <a href="/credits.txt" target="_blank">asset notices</a>.</p><button className="primary" onClick={() => setCredits(false)}>BACK TO GARAGE <Icon name="arrow" /></button></div></section>}
      {notice && phase !== 'error' && <div className="notice" role="status">{notice}<button aria-label="Dismiss notification" onClick={() => setNotice('')}>×</button></div>}
    </main>
  )
}

export default App
