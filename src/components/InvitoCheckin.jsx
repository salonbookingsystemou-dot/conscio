import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ripristinaScalaViewport, vaMostratoInvito } from '../lib/invitoHome.js'

function chiave(codice, settimana) {
  return `conscio-invito-checkin:${codice.trim().toUpperCase()}:${settimana}`
}

function giaMostrato(codice, settimana) {
  try {
    return localStorage.getItem(chiave(codice, settimana)) === '1'
  } catch {
    return true
  }
}

function memorizzaMostrato(codice, settimana) {
  try {
    localStorage.setItem(chiave(codice, settimana), '1')
  } catch {
    /* storage non disponibile */
  }
}

/** Una sola volta a settimana, e mai insieme all'invito a installare l'app. */
export default function InvitoCheckin({ codice, stato }) {
  const dialog = useRef(null)
  const navigate = useNavigate()
  const [aperto, setAperto] = useState(false)
  const settimana = stato?.settimana

  useEffect(() => {
    if (!stato?.aperto || stato.compilato || !settimana) return undefined
    if (giaMostrato(codice, settimana) || vaMostratoInvito()) return undefined
    const t = window.setTimeout(() => {
      if (document.querySelector('dialog[open]')) return
      memorizzaMostrato(codice, settimana)
      setAperto(true)
    }, 600)
    return () => window.clearTimeout(t)
  }, [codice, settimana, stato?.aperto, stato?.compilato])

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
    setAperto(false)
    ripristinaScalaViewport()
  }

  function inizia() {
    chiudi()
    navigate('/checkin')
  }

  if (!aperto) return null

  return (
    <dialog
      ref={dialog}
      className="invito-home invito-checkin"
      aria-labelledby="invito-checkin-titolo"
      onCancel={e => {
        e.preventDefault()
        chiudi()
      }}
      onClick={e => {
        if (e.target === dialog.current) chiudi()
      }}
    >
      <p className="invito-checkin-occhiello">Check-in settimanale · 1 minuto</p>
      <h2 id="invito-checkin-titolo">Com’è andata la settimana appena trascorsa?</h2>
      <p>
        Stress, sonno e momenti di presenza: cinque domande veloci.
        {!stato.consenso && ' È facoltativo e non cambia nulla nel tuo percorso.'}
      </p>
      <div className="invito-checkin-azioni">
        <button type="button" className="btn btn-avanti" onClick={inizia} autoFocus>
          Inizia
        </button>
        <button type="button" className="btn btn-ghost" onClick={chiudi}>
          Non ora
        </button>
      </div>
    </dialog>
  )
}
