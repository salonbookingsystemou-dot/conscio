import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabaseClient'
import { leggiDatiCicli } from './cicli.js'

/**
 * Dati dello spazio del ciclo. Legge una volta cicli, iscrizioni, punteggi e
 * log; il ciclo attivo arriva dalla rotta, quindi cambiare ciclo dal selettore
 * non rilegge nulla.
 */
export default function useCiclo(cicloId) {
  const [dati, setDati] = useState(null)
  const [errore, setErrore] = useState(null)

  const ricarica = useCallback(async () => {
    try {
      const letti = await leggiDatiCicli()
      setDati(letti)
      setErrore(letti.errori.has('cicli') ? 'Non è stato possibile caricare i cicli.' : null)
    } catch {
      setErrore('Non è stato possibile caricare i cicli.')
    }
  }, [])

  useEffect(() => { ricarica() }, [ricarica])

  const ciclo = useMemo(
    () => dati?.cicli.find(c => c.id === cicloId) || null,
    [dati, cicloId]
  )
  const iscrizioni = useMemo(
    () => (dati ? dati.iscrizioni.filter(i => i.ciclo_id === cicloId) : []),
    [dati, cicloId]
  )

  const aggiornaCiclo = useCallback(async patch => {
    const { error } = await supabase.from('cicli').update(patch).eq('id', cicloId)
    if (error) return 'Non è stato possibile aggiornare il ciclo.'
    await ricarica()
    return null
  }, [cicloId, ricarica])

  return {
    caricamento: !dati && !errore,
    errore,
    ciclo,
    cicli: dati?.cicli || [],
    iscrizioni,
    tutteIscrizioni: dati?.iscrizioni || [],
    punteggi: dati?.punteggi || [],
    log: dati?.log || [],
    ricarica,
    aggiornaCiclo
  }
}
