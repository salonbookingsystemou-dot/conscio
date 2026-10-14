import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { IconaChiudi } from './IconeAdmin.jsx'

const SnackbarContext = createContext({ mostra: () => {} })

const DURATA = 6000
const DURATA_CON_ANNULLA = 10000

/**
 * Conferme non bloccanti dell'area facilitatore (brief navigazione, sez. 4bis).
 * Una sola alla volta: la nuova sostituisce la vecchia.
 */
export function SnackbarProvider({ children }) {
  const [attuale, setAttuale] = useState(null)
  const [ferma, setFerma] = useState(false)
  const contatore = useRef(0)

  const mostra = useCallback(({ testo, annulla }) => {
    contatore.current += 1
    setFerma(false)
    setAttuale({ id: contatore.current, testo, annulla })
  }, [])

  const chiudi = useCallback(() => setAttuale(null), [])

  useEffect(() => {
    if (!attuale || ferma) return undefined
    const t = setTimeout(chiudi, attuale.annulla ? DURATA_CON_ANNULLA : DURATA)
    return () => clearTimeout(t)
  }, [attuale, ferma, chiudi])

  async function annulla() {
    const azione = attuale?.annulla
    chiudi()
    await azione?.()
  }

  const valore = useMemo(() => ({ mostra }), [mostra])

  return (
    <SnackbarContext.Provider value={valore}>
      {children}
      <div className="snackbar-zona" role="status" aria-live="polite">
        {attuale && (
          <div
            key={attuale.id}
            className="snackbar"
            onPointerEnter={() => setFerma(true)}
            onPointerLeave={() => setFerma(false)}
            onFocus={() => setFerma(true)}
            onBlur={() => setFerma(false)}
          >
            <span className="snackbar-testo">{attuale.testo}</span>
            {attuale.annulla && (
              <button type="button" className="snackbar-annulla" onClick={annulla}>Annulla</button>
            )}
            <button type="button" className="snackbar-chiudi" aria-label="Chiudi" onClick={chiudi}>
              <IconaChiudi />
            </button>
          </div>
        )}
      </div>
    </SnackbarContext.Provider>
  )
}

/** `mostra({ testo, annulla? })`: annulla è una funzione (anche asincrona) che ripristina lo stato. */
export function useSnackbar() {
  return useContext(SnackbarContext)
}
