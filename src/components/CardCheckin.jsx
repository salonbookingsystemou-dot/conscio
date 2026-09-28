import { useEffect, useState } from 'react'
import { supabaseConfigurato } from '../lib/supabaseClient'
import { leggiCheckin } from '../lib/checkin.js'
import InvitoCheckin from './InvitoCheckin.jsx'

/** Nessun banner: l'invito al check-in passa solo dalla modale, finché non è compilato. */
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

  if (!stato?.aperto || stato.compilato) return null

  return <InvitoCheckin codice={codice} stato={stato} />
}
