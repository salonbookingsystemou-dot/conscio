import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { HUE_DEFAULT, applicaTonalita, leggiHue, salvaHue } from './tonalita.js'
import { leggiImpostazioniPubbliche, osservaVetrina } from './vetrina.js'

const TonalitaCtx = createContext(null)

function normalizza(valore) {
  const n = Number(valore)
  if (valore == null || !Number.isFinite(n)) return HUE_DEFAULT
  return ((n % 360) + 360) % 360
}

// La tonalità è una sola per tutto il sito: la sceglie il facilitatore in Sito.
export function TonalitaProvider({ children }) {
  const [hue, setHue] = useState(leggiHue)
  const [delSito, setDelSito] = useState(leggiHue)

  const sincronizza = useCallback(() => {
    leggiImpostazioniPubbliche()
      .then(dati => {
        const valore = normalizza(dati?.tonalita)
        setDelSito(valore)
        setHue(valore)
        salvaHue(valore)
        applicaTonalita(valore)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    sincronizza()
    return osservaVetrina(sincronizza)
  }, [sincronizza])

  // Solo sullo schermo di chi la sta scegliendo, finché non salva.
  const anteprima = useCallback(prossimo => {
    const valore = normalizza(prossimo)
    setHue(valore)
    applicaTonalita(valore)
  }, [])

  const ripristina = useCallback(() => {
    setHue(delSito)
    applicaTonalita(delSito)
  }, [delSito])

  const value = useMemo(
    () => ({
      hue,
      delSito,
      anteprima,
      ripristina,
      predefinita: Math.abs(hue - HUE_DEFAULT) < 0.8,
      modificata: Math.abs(hue - delSito) >= 0.5
    }),
    [hue, delSito, anteprima, ripristina]
  )

  return <TonalitaCtx.Provider value={value}>{children}</TonalitaCtx.Provider>
}

export function useTonalita() {
  const ctx = useContext(TonalitaCtx)
  if (!ctx) throw new Error('useTonalita richiede TonalitaProvider')
  return ctx
}
