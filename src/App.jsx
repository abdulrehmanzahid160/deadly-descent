import { useCallback, useEffect, useRef, useState } from 'react'
import { createGame } from './game.js'

const INITIAL_HUD = { distance: 0, fuel: 100, coins: 0, bonus: 0, speed: 0, passed: 0, popup: '' }
const DEMO_MODE = new URLSearchParams(window.location.search).has('demo')
const RIDES = [
  { id: 'sedan', name: 'Classic', detail: 'Balanced' },
  { id: 'rally', name: 'Rally', detail: 'Fast & agile' },
  { id: 'pickup', name: 'Pickup', detail: 'Heavy & stable' },
]

function App() {
  const canvasRef = useRef(null)
  const gameRef = useRef(null)
  const [hud, setHud] = useState(INITIAL_HUD)
  const [phase, setPhase] = useState(DEMO_MODE ? 'playing' : 'ready')
  const [best, setBest] = useState(() => Number(localStorage.getItem('deadly-descent-best') || 0))
  const [muted, setMuted] = useState(false)
  const [ride, setRide] = useState('sedan')

  useEffect(() => {
    const game = createGame(canvasRef.current, {
      onHud: setHud,
      onCrash: (distance) => {
        setPhase('crashed')
        setBest((previous) => {
          const next = Math.max(previous, distance)
          localStorage.setItem('deadly-descent-best', String(next))
          return next
        })
      },
    })
    gameRef.current = game
    if (DEMO_MODE) {
      game.start('sedan')
      game.setControl('gas', true)
    }
    return () => game.destroy()
  }, [])

  useEffect(() => gameRef.current?.setMuted(muted), [muted])

  const start = useCallback(() => {
    setHud(INITIAL_HUD)
    setPhase('playing')
    gameRef.current?.start(ride)
  }, [ride])

  useEffect(() => {
    if (phase !== 'ready') return undefined
    const beginOnKey = (event) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowRight', 'ArrowLeft', 'KeyW', 'KeyS', 'KeyA', 'KeyD', 'Space'].includes(event.code)) start()
    }
    window.addEventListener('keydown', beginOnKey)
    return () => window.removeEventListener('keydown', beginOnKey)
  }, [phase, start])

  const handleControl = useCallback((event) => {
    event.preventDefault()
    const name = event.currentTarget.dataset.control
    const down = event.type === 'pointerdown'
    if (phase === 'ready' && down) start()
    gameRef.current?.setControl(name, down)
  }, [phase, start])

  return (
    <main className="game-shell">
      <canvas ref={canvasRef} aria-label="Deadly Descent 3D mountain road" />

      <section className="hud" aria-live="polite">
        <div className="score-card">
          <span className="label">DISTANCE</span>
          <strong>{hud.distance.toFixed(2)} <small>km</small></strong>
          <span className="best">BEST {best.toFixed(2)} km</span>
        </div>
        <div className="fuel-wrap">
          <div className="fuel-title"><span><i className="fuel-icon" /> FUEL</span><b>{Math.round(hud.fuel)}%</b></div>
          <div className="fuel-track"><i style={{ width: `${hud.fuel}%` }} /></div>
        </div>
        <div className="stats-card">
          <span>{hud.passed} PASSED</span>
          <span>{Math.round(hud.speed)} km/h</span>
          <button className="sound" onClick={() => setMuted((value) => !value)} aria-label="Toggle sound">{muted ? 'SOUND OFF' : 'SOUND ON'}</button>
        </div>
      </section>

      {hud.popup && phase === 'playing' && <div className="trick-popup">{hud.popup}</div>}

      {phase === 'ready' && (
        <section className="modal intro">
          <p className="eyebrow">MOUNTAIN ROAD CHALLENGE</p>
          <h1>DEADLY<br/><em>DESCENT</em></h1>
          <p className="tagline">Control the speed. Hold the line. Survive the mountain.</p>
          <div className="ride-picker" aria-label="Choose your vehicle">
            {RIDES.map((option) => (
              <button key={option.id} className={ride === option.id ? 'selected' : ''} onClick={() => setRide(option.id)}>
                <b>{option.name}</b><small>{option.detail}</small>
              </button>
            ))}
          </div>
          <button className="primary" onClick={start}>START ENGINE <span>›</span></button>
          <div className="howto"><span>← → STEER</span><span>↓ BRAKE</span><span>↑ DRIVE</span><span>SPACE BOOST</span></div>
        </section>
      )}

      {phase === 'crashed' && (
        <section className="modal game-over">
          <p className="eyebrow">RUN OVER</p>
          <h2>OFF THE<br/>ROAD</h2>
          <p><b>{hud.distance.toFixed(2)} km</b> travelled</p>
          <p className="bonus-line">Freestyle bonus: {hud.bonus}</p>
          <button className="primary" onClick={start}>TRY AGAIN <span>↻</span></button>
        </section>
      )}

      <section className="controls" aria-label="Driving controls">
        <button data-control="brake" className="pedal brake" onPointerDown={handleControl} onPointerUp={handleControl} onPointerCancel={handleControl} onPointerLeave={handleControl}>
          <span>▼</span><b>BRAKE</b><small>DECELERATE</small>
        </button>
        <button data-control="gas" className="pedal gas" onPointerDown={handleControl} onPointerUp={handleControl} onPointerCancel={handleControl} onPointerLeave={handleControl}>
          <span>▲</span><b>GAS</b><small>ACCELERATE</small>
        </button>
      </section>
      <section className="lane-controls" aria-label="Steering controls">
        <button data-control="steerLeft" onPointerDown={handleControl} onPointerUp={handleControl} onPointerCancel={handleControl} onPointerLeave={handleControl}>←<small>STEER</small></button>
        <button data-control="steerRight" onPointerDown={handleControl} onPointerUp={handleControl} onPointerCancel={handleControl} onPointerLeave={handleControl}>→<small>STEER</small></button>
      </section>
      <div className="landscape-hint">Rotate your phone for the full highway view</div>
    </main>
  )
}

export default App
