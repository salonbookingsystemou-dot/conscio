import { useEffect, useRef, useState } from 'react'
import { HUE_DEFAULT } from '../lib/tonalita.js'
import { useTonalita } from '../lib/tonalita.jsx'
import { salvaTonalitaSito } from '../lib/vetrina.js'
import { useSnackbar } from './admin/Snackbar.jsx'

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

/** Tonalità dell'app, in Sito: si vede subito su questo schermo, vale per tutti quando si salva. */
export default function RuotaTonalita() {
  const { hue, anteprima, ripristina, predefinita, modificata } = useTonalita()
  const [salvando, setSalvando] = useState(false)
  const [errore, setErrore] = useState('')
  const { mostra } = useSnackbar()
  const daRipristinare = useRef(ripristina)
  daRipristinare.current = ripristina

  // Uscendo da Sito senza salvare torna la tonalità pubblicata.
  useEffect(() => () => daRipristinare.current(), [])

  async function salva() {
    setErrore('')
    setSalvando(true)
    try {
      await salvaTonalitaSito(predefinita ? null : hue)
      mostra({ testo: 'Tonalità salvata: ora la vedono tutti' })
    } catch {
      setErrore('Non è stato possibile salvare la tonalità.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <section className="card">
      <h3>Tonalità</h3>
      <p className="hint">
        Il colore dell’app per tutti: partecipanti, visitatori di «E se ti fermassi un momento?» e area facilitatore.
        Gira la ruota per vederla qui, poi salva.
      </p>
      <div className="ruota ruota-piena">
        <div className="ruota-corpo">
          <Disco hue={hue} onChange={anteprima} />
          <button
            type="button"
            className="ruota-reset"
            onClick={() => anteprima(HUE_DEFAULT)}
            disabled={predefinita}
          >
            Predefinita
          </button>
        </div>
      </div>
      {errore && <p className="avviso-errore" role="alert">{errore}</p>}
      <div className="azioni">
        <button type="button" className="btn" onClick={salva} disabled={salvando || !modificata}>
          {salvando ? 'Salvataggio…' : 'Salva tonalità'}
        </button>
        {modificata && (
          <button type="button" className="btn btn-ghost" onClick={ripristina} disabled={salvando}>
            Annulla
          </button>
        )}
      </div>
    </section>
  )
}
