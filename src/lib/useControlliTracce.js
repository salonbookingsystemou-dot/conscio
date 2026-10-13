import { useCallback, useEffect, useRef, useState } from 'react'
import {
  controllaFileTraccia,
  controllaTraccia,
  leggiControlli,
  pulisciCacheControllo,
  salvaControllo
} from './controlloTracce.js'

const FILE_IN_PARALLELO = 3

/**
 * Ultimi controlli delle tracce della libreria e azioni per rifarli.
 * Un controllo alla volta: «Controlla tutte» fa il file di tre tracce insieme,
 * poi l'ascolto tecnico in coda. Ogni esito si salva appena pronto.
 */
export default function useControlliTracce() {
  const [controlli, setControlli] = useState(null)
  const [salvabili, setSalvabili] = useState(true)
  const [inCorso, setInCorso] = useState(null)
  const [coda, setCoda] = useState(null)
  const [errore, setErrore] = useState(null)
  const abortRef = useRef(null)
  const salvabiliRef = useRef(true)

  useEffect(() => {
    let vivo = true
    void pulisciCacheControllo()
    leggiControlli()
      .then(mappa => { if (vivo) setControlli(mappa) })
      .catch(() => {
        if (!vivo) return
        salvabiliRef.current = false
        setSalvabili(false)
        setControlli(new Map())
      })
    return () => {
      vivo = false
      abortRef.current?.abort()
    }
  }, [])

  const registra = useCallback(async esito => {
    setControlli(m => new Map(m).set(esito.traccia_id, esito))
    if (!salvabiliRef.current) return
    try {
      await salvaControllo(esito)
    } catch {
      setErrore('Il controllo è fatto, ma non è stato possibile salvarlo: dopo un ricaricamento non lo vedrai.')
    }
  }, [])

  const controlla = useCallback(async traccia => {
    if (!traccia?.url || abortRef.current) return
    const controller = new AbortController()
    abortRef.current = controller
    setErrore(null)
    setInCorso(traccia.id)
    try {
      await registra(await controllaTraccia(traccia, { segnale: controller.signal }))
    } catch {
      /* interrotto */
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setInCorso(null)
    }
  }, [registra])

  const controllaTutte = useCallback(async tracce => {
    const lista = tracce.filter(t => t.url)
    if (lista.length === 0 || abortRef.current) return
    const controller = new AbortController()
    abortRef.current = controller
    setErrore(null)
    setCoda({ fatto: 0, totale: lista.length, fase: 'file' })
    try {
      const file = new Map()
      let prossimo = 0
      async function lavora() {
        while (!controller.signal.aborted && prossimo < lista.length) {
          const t = lista[prossimo]
          prossimo += 1
          file.set(t.id, await controllaFileTraccia(t))
        }
      }
      await Promise.all(Array.from({ length: FILE_IN_PARALLELO }, lavora))
      for (let i = 0; i < lista.length; i += 1) {
        if (controller.signal.aborted) break
        const t = lista[i]
        setCoda({ fatto: i, totale: lista.length, fase: 'ascolto', titolo: t.titolo })
        setInCorso(t.id)
        await registra(await controllaTraccia(t, { segnale: controller.signal, file: file.get(t.id) }))
      }
    } catch {
      /* interrotto */
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setInCorso(null)
      setCoda(null)
    }
  }, [registra])

  const interrompi = useCallback(() => abortRef.current?.abort(), [])

  return {
    controlli,
    salvabili,
    inCorso,
    coda,
    occupato: Boolean(inCorso || coda),
    errore,
    controlla,
    controllaTutte,
    interrompi
  }
}
