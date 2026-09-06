import { useEffect, useRef, useState } from 'react'
import iconaConscio from '../assets/icona-conscio.png'
import { usePartecipante } from '../lib/partecipante.jsx'
import {
  memorizzaInvitoChiuso,
  ripristinaScalaViewport,
  vaMostratoInvito
} from '../lib/invitoHome.js'

function IconaCondividi() {
  return (
    <svg className="invito-home-icona-passo" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 4v11M8.2 7.8 12 4l3.8 3.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 13.5V18a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function InvitoHome() {
  const dialog = useRef(null)
  const sessionePronta = useRef(false)
  const eraRegistrato = useRef(false)
  const { registrato, caricamento } = usePartecipante()
  const [aperto, setAperto] = useState(false)

  useEffect(() => {
    function suApri() {
      setAperto(true)
    }
    window.addEventListener('conscio-apri-invito-home', suApri)
    return () => {
      window.removeEventListener('conscio-apri-invito-home', suApri)
    }
  }, [])

  useEffect(() => {
    if (caricamento) return undefined
    if (!sessionePronta.current) {
      sessionePronta.current = true
      eraRegistrato.current = registrato
      return undefined
    }
    if (registrato && !eraRegistrato.current && vaMostratoInvito()) {
      const t = window.setTimeout(() => setAperto(true), 450)
      eraRegistrato.current = true
      return () => window.clearTimeout(t)
    }
    eraRegistrato.current = registrato
    return undefined
  }, [registrato, caricamento])

  useEffect(() => {
    const el = dialog.current
    if (!el) return
    if (aperto && !el.open) {
      el.showModal()
      ripristinaScalaViewport()
    }
    if (!aperto && el.open) el.close()
  }, [aperto])

  function chiudi() {
    memorizzaInvitoChiuso()
    setAperto(false)
    ripristinaScalaViewport()
  }

  if (!aperto) return null

  return (
    <dialog
      ref={dialog}
      className="invito-home"
      aria-labelledby="invito-home-titolo"
      onCancel={e => {
        e.preventDefault()
        chiudi()
      }}
      onClick={e => {
        if (e.target === dialog.current) chiudi()
      }}
    >
      <button
        type="button"
        className="invito-home-chiudi"
        onClick={chiudi}
        aria-label="Chiudi"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M6.4 6.4 17.6 17.6M17.6 6.4 6.4 17.6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <img className="invito-home-icona" src={iconaConscio} alt="" />
      <h2 id="invito-home-titolo">Tieni il percorso a portata di mano</h2>
      <p>
        Puoi aggiungere questa app alla schermata Home del telefono.
        Così la apri come le altre, senza passare dal browser.
      </p>
      <ol className="invito-home-passi">
        <li>
          <IconaCondividi />
          <span>Fai Tap sull’icona <strong>Condividi</strong> nel browser</span>
        </li>
        <li>
          <span>Tap su <strong>Aggiungi alla schermata Home</strong></span>
        </li>
      </ol>
    </dialog>
  )
}
