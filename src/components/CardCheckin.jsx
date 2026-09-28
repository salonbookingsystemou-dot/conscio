import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabaseConfigurato } from '../lib/supabaseClient'
import { leggiCheckin } from '../lib/checkin.js'

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

  return (
    <Link className={`card-checkin${stato.compilato ? ' is-fatto' : ''}`} to="/checkin">
      <span className="card-checkin-testi">
        <strong>Il check-in della settimana</strong>
        <span>{stato.compilato ? 'Fatto ✓ · puoi modificarlo fino alla fine della settimana' : '1 minuto'}</span>
      </span>
      <span className="card-checkin-azione">{stato.compilato ? 'Modifica' : 'Compila'}</span>
    </Link>
  )
}
