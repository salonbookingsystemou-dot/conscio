import { useEffect, useRef, useState } from 'react'
import { HUE_DEFAULT } from '../lib/tonalita.js'
import { useTonalita } from '../lib/tonalita.jsx'

function hueDaPunto(el, clientX, clientY) {
  const r = el.getBoundingClientRect()
  const x = clientX - r.left - r.width / 2
  const y = clientY - r.top - r.height / 2
  if (x * x + y * y < 28 * 28) return null
  return (Math.atan2(x, -y) * 180) / Math.PI + 360
}

function Disco({ hue, onChange, id }) {
  const area = useRef(null)
  const trascinando = useRef(false)

  function applica(e) {
    const nodo = area.current
    if (!nodo) return
    const x = e.clientX ?? e.touches?.[0]?.clientX
    const y = e.clientY ?? e.touches?.[0]?.clientY
    if (x == null || y == null) return
    const hue = hueDaPunto(nodo, x, y)
    if (hue == null) return
    onChange(hue % 360)
  }

  function suPointerDown(e) {
    trascinando.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    applica(e)
  }

  function suPointerMove(e) {
    if (!trascinando.current) return
    applica(e)
  }

  function suPointerUp() {
    trascinando.current = false
  }

  function suTasto(e) {
    const passo = e.shiftKey ? 12 : 4
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault()
      onChange((hue + passo) % 360)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault()
      onChange((hue - passo + 360) % 360)
    } else if (e.key === 'Home') {
      e.preventDefault()
      onChange(HUE_DEFAULT)
    }
  }

  const angolo = hue
  const rad = (angolo * Math.PI) / 180

  return (
    <div
      ref={area}
      id={id}
      className="ruota-disco"
      role="slider"
      tabIndex={0}
      aria-label="Tonalità dell’app"
      aria-valuemin={0}
      aria-valuemax={360}
      aria-valuenow={Math.round(hue)}
      aria-valuetext={`${Math.round(hue)} gradi`}
      onPointerDown={suPointerDown}
      onPointerMove={suPointerMove}
      onPointerUp={suPointerUp}
      onPointerCancel={suPointerUp}
      onKeyDown={suTasto}
    >
      <span
        className="ruota-cursore"
        style={{
          left: `calc(50% + ${Math.sin(rad) * 42}px)`,
          top: `calc(50% - ${Math.cos(rad) * 42}px)`
        }}
      />
    </div>
  )
}

export default function RuotaTonalita({ variante = 'piena' }) {
  const { hue, imposta, reset, predefinita } = useTonalita()
  const [aperto, setAperto] = useState(false)
  const radice = useRef(null)

  useEffect(() => {
    if (!aperto) return undefined
    function fuori(e) {
      if (!radice.current?.contains(e.target)) setAperto(false)
    }
    function tasto(e) {
      if (e.key === 'Escape') setAperto(false)
    }
    document.addEventListener('pointerdown', fuori)
    document.addEventListener('keydown', tasto)
    return () => {
      document.removeEventListener('pointerdown', fuori)
      document.removeEventListener('keydown', tasto)
    }
  }, [aperto])

  const corpo = (
    <div className="ruota-corpo">
      <p className="ruota-etichetta">Tonalità</p>
      <Disco hue={hue} onChange={imposta} />
      <button
        type="button"
        className="ruota-reset"
        onClick={reset}
        disabled={predefinita}
      >
        Predefinita
      </button>
    </div>
  )

  if (variante === 'piena') {
    return <div className="ruota ruota-piena">{corpo}</div>
  }

  return (
    <div ref={radice} className={`ruota ruota-compatta${aperto ? ' is-open' : ''}`}>
      <button
        type="button"
        className="ruota-apri"
        aria-expanded={aperto}
        aria-label="Scegli la tonalità dell’app"
        onClick={() => setAperto(v => !v)}
      >
        <span className="ruota-apri-anello" aria-hidden="true" />
        <span className="ruota-apri-nucleo" aria-hidden="true" />
      </button>
      {aperto && <div className="ruota-popover">{corpo}</div>}
    </div>
  )
}
