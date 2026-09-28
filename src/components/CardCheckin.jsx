import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabaseConfigurato } from '../lib/supabaseClient'
import { leggiCheckin } from '../lib/checkin.js'

function IconaCheckin() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M12 7.6v4.6l3 1.8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconaFatto() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m7 12.4 3.2 3.2L17 8.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function etichettaSettimana(n) {
  return n === 9 ? 'Settimana intensiva' : `Settimana ${n}`
}

export default function CardCheckin({ codice }) {
  const [stato, setStato] = useState(null)

  useEffect(() => {
    if (!codice || !supabaseConfigurato) return undefined
    let attivo = true
    leggiCheckin(codice).then(({ stato: letto }) => {
      if (attivo) setStato(letto)
    })
    return () => { attivo = false }
  }, [codice])

  if (!stato?.aperto) return null

  const fatto = stato.compilato

  return (
    <Link className={`card-checkin${fatto ? ' is-fatto' : ''}`} to="/checkin">
      <span className="card-checkin-icona">{fatto ? <IconaFatto /> : <IconaCheckin />}</span>
      <span className="card-checkin-testi">
        <span className="card-checkin-occhiello">
          {fatto ? etichettaSettimana(stato.settimana) : `${etichettaSettimana(stato.settimana)} · 1 minuto`}
        </span>
        <strong>{fatto ? 'Check-in fatto' : 'Com’è andata questa settimana?'}</strong>
        <span className="card-checkin-sotto">
          {fatto
            ? 'Puoi modificarlo fino alla fine della settimana.'
            : 'Stress, sonno e momenti di presenza: cinque domande veloci.'}
        </span>
      </span>
      <span className={`card-checkin-azione${fatto ? '' : ' btn btn-avanti'}`}>
        {fatto ? 'Modifica' : 'Inizia'}
      </span>
    </Link>
  )
}
