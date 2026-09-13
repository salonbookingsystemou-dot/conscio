import { useEffect, useRef, useState } from 'react'

// Trascina verso il basso dall'inizio della pagina per aggiornare cache e contenuti.
const SOGLIA = 72 // px di trascinamento (post attrito) per attivare l'aggiornamento
const MAX = 110 // trascinamento massimo visibile
const RESISTENZA = 0.5 // attrito applicato al gesto

function scrollTopCorrente() {
  return (
    window.scrollY ||
    document.documentElement.scrollTop ||
    document.body.scrollTop ||
    0
  )
}

export default function PullToRefresh() {
  const [distanza, setDistanza] = useState(0)
  const [aggiorno, setAggiorno] = useState(false)

  const startY = useRef(null)
  const trascino = useRef(false)
  const distRef = useRef(0)
  const aggiornoRef = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const supportaTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    if (!supportaTouch) return undefined

    function aggiornaDist(d) {
      distRef.current = d
      setDistanza(d)
    }

    async function eseguiRefresh() {
      aggiornoRef.current = true
      setAggiorno(true)
      aggiornaDist(SOGLIA)
      try {
        if (navigator.onLine !== false) {
          if ('serviceWorker' in navigator) {
            const reg = await navigator.serviceWorker.getRegistration()
            if (reg) await reg.update()
          }
          if ('caches' in window) {
            const chiavi = await caches.keys()
            await Promise.all(chiavi.map(k => caches.delete(k)))
          }
        }
      } catch {
        // Ignora: procediamo comunque al reload.
      }
      // Piccola pausa per mostrare il feedback prima del reload.
      setTimeout(() => window.location.reload(), 420)
    }

    function onStart(e) {
      if (aggiornoRef.current) return
      if (e.touches.length !== 1) return
      if (scrollTopCorrente() > 0) return
      if (document.body.style.overflow === 'hidden') return // menu/overlay aperto
      startY.current = e.touches[0].clientY
      trascino.current = false
    }

    function onMove(e) {
      if (startY.current == null || aggiornoRef.current) return
      const dy = e.touches[0].clientY - startY.current
      if (dy <= 0) {
        if (trascino.current) {
          aggiornaDist(0)
          trascino.current = false
        }
        return
      }
      if (scrollTopCorrente() > 0) {
        startY.current = null
        if (trascino.current) {
          aggiornaDist(0)
          trascino.current = false
        }
        return
      }
      trascino.current = true
      const d = Math.min(MAX, dy * RESISTENZA)
      aggiornaDist(d)
      if (d > 4 && e.cancelable) e.preventDefault() // evita il rimbalzo nativo
    }

    function onEnd() {
      if (startY.current == null) return
      const attiva = trascino.current && distRef.current >= SOGLIA
      startY.current = null
      trascino.current = false
      if (attiva) eseguiRefresh()
      else aggiornaDist(0)
    }

    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onEnd, { passive: true })
    window.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    }
  }, [])

  const visibile = distanza > 0 || aggiorno
  const superata = distanza >= SOGLIA
  const opacita = aggiorno ? 1 : Math.min(1, distanza / SOGLIA)
  const rotazione = Math.min(180, (distanza / SOGLIA) * 180)

  return (
    <div
      className="ptr"
      aria-hidden={!visibile}
      style={{
        transform: `translateY(${(aggiorno ? SOGLIA : distanza) - 52}px)`,
        opacity: visibile ? 1 : 0,
        transition:
          aggiorno || distanza === 0
            ? 'transform 0.25s ease, opacity 0.25s ease'
            : 'none'
      }}
    >
      <div
        className={`ptr-cerchio${superata && !aggiorno ? ' is-superata' : ''}`}
        style={{ opacity: opacita }}
      >
        {aggiorno ? (
          <span className="ptr-spinner" aria-label="Aggiornamento in corso" role="status" />
        ) : (
          <svg
            className="ptr-freccia"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            style={{ transform: `rotate(${rotazione}deg)` }}
          >
            <path
              d="M12 5v14M12 19l-6-6M12 19l6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
    </div>
  )
}
