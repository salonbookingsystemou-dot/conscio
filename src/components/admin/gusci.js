import { createContext, useContext } from 'react'

// Quello che il guscio del facilitatore passa alle pagine: la classe di finestra
// e «Esci», che sotto i 600px finisce nel menu ⋯ della barra della pagina.
export const GuscioContext = createContext({ classe: 'ampia', esci: null })

export function useGuscio() {
  return useContext(GuscioContext)
}
