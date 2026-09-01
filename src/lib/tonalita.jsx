import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { HUE_DEFAULT, applicaTonalita, leggiHue, salvaHue } from './tonalita.js'

const TonalitaCtx = createContext(null)

export function TonalitaProvider({ children }) {
  const [hue, setHue] = useState(leggiHue)

  const imposta = useCallback(prossimo => {
    const valore = ((Number(prossimo) % 360) + 360) % 360
    setHue(valore)
    salvaHue(valore)
    applicaTonalita(valore)
  }, [])

  const reset = useCallback(() => imposta(HUE_DEFAULT), [imposta])

  const value = useMemo(
    () => ({ hue, imposta, reset, predefinita: Math.abs(hue - HUE_DEFAULT) < 0.8 }),
    [hue, imposta, reset]
  )

  return <TonalitaCtx.Provider value={value}>{children}</TonalitaCtx.Provider>
}

export function useTonalita() {
  const ctx = useContext(TonalitaCtx)
  if (!ctx) throw new Error('useTonalita richiede TonalitaProvider')
  return ctx
}
