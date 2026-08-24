import { useCallback, useEffect, useRef, useState } from 'react'
import { createGame } from './game.js'

const INITIAL_HUD = { distance: 0, fuel: 100, coins: 0, bonus: 0, speed: 0, popup: '' }

function App() {
  const canvasRef = useRef(null)
  const gameRef = useRef(null)
  const [hud, setHud] = useState(INITIAL_HUD)
  const [phase, setPhase] = useState('ready')
  const [best, setBest] = useState(() => Number(localStorage.getItem('mehran-best') || 0))
  const [muted, setMuted] = useState(false)

  useEffect(() => {
    const game = createGame(canvasRef.current, {
      onHud: setHud,
      onCrash: (distance) => {
        setPhase('crashed')
        setBest((previous) => {
          const next = Math.max(previous, distance)
          localStorage.setItem('mehran-best', String(next))
          return next
        })
      },
    })
    gameRef.current = game
    return () => game.destroy()
  }, [])

  useEffect(() => gameRef.current?.setMuted(muted), [muted])

  const start = useCallback(() => {
    setHud(INITIAL_HUD)
    setPhase('playing')
    gameRef.current?.start()
  }, [])

  useEffect(() => {
    if (phase !== 'ready') return undefined
    const beginOnKey = (event) => {
      if (['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'Space'].includes(event.code)) start()
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
      <canvas ref={canvasRef} aria-label="Mehran Hill Climb game world" />

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
          <span>Rs. {hud.coins}</span>
          <span>{Math.round(hud.speed)} km/h</span>
          <button className="sound" onClick={() => setMuted((value) => !value)} aria-label="Toggle sound">{muted ? 'SOUND OFF' : 'SOUND ON'}</button>
        </div>
      </section>

      {hud.popup && phase === 'playing' && <div className="trick-popup">{hud.popup}</div>}

      {phase === 'ready' && (
        <section className="modal intro">
          <div className="crescent-mark" aria-hidden="true"><i /><span>★</span></div>
          <p className="eyebrow">PAKISTAN KI SHAAN</p>
          <h1>MEHRAN<br/><em>HILL CLIMB</em></h1>
          <p className="tagline">GT Road se paharon tak — kitni door jao ge?</p>
          <button className="primary" onClick={start}>START ENGINE <span>›</span></button>
          <div className="howto"><span>◀ BRAKE / REVERSE</span><span>GAS / FLIP ▶</span></div>
        </section>
      )}

      {phase === 'crashed' && (
        <section className="modal game-over">
          <p className="eyebrow">ARAY YAAR!</p>
          <h2>MEHRAN<br/>PALAT GAYI</h2>
          <p><b>{hud.distance.toFixed(2)} km</b> ka safar</p>
          <p className="bonus-line">Freestyle bonus: {hud.bonus}</p>
          <button className="primary" onClick={start}>DOBARA TRY KARO! <span>↻</span></button>
        </section>
      )}

      <section className="controls" aria-label="Driving controls">
        <button data-control="brake" className="pedal brake" onPointerDown={handleControl} onPointerUp={handleControl} onPointerCancel={handleControl} onPointerLeave={handleControl}>
          <span>◀</span><b>BRAKE</b><small>REVERSE</small>
        </button>
        <button data-control="gas" className="pedal gas" onPointerDown={handleControl} onPointerUp={handleControl} onPointerCancel={handleControl} onPointerLeave={handleControl}>
          <span>▶</span><b>GAS</b><small>ACCELERATE</small>
        </button>
      </section>
      <div className="landscape-hint">↻ Rotate your phone for the full GT Road experience</div>
    </main>
  )
}

export default App
