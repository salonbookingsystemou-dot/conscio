import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { dimenticaCodice, leggiCodice, memorizzaCodice, supabase, supabaseConfigurato } from './supabaseClient'
import { sommaMinutiTracce } from './oreAscolto.js'

const PartecipanteContext = createContext({
  codice: '',
  registrato: false,
  caricamento: true,
  minutiAscolto: 0,
  onboardingCompleto: false,
  t0Completo: false,
  percorsoPronto: false,
  aggiornaAscolto: async () => {},
  aggiornaPercorso: async () => {},
  entra: async () => {},
  esci: () => {}
})

async function statoAccesso(codice) {
  if (!codice || !supabaseConfigurato) return 'non_trovato'
  const { data, error } = await supabase.rpc('stato_accesso_codice', {
    p_codice: codice
  })
  if (error) return 'non_trovato'
  return data || 'non_trovato'
}

async function codiceValido(codice) {
  return (await statoAccesso(codice)) === 'ok'
}

async function leggiStatoPercorso(codice) {
  if (!codice || !supabaseConfigurato) {
    return { onboarding: false, t0: false, pronto: false }
  }
  const { data, error } = await supabase.rpc('stato_pronto_percorso', { p_codice: codice })
  if (error || !data) return { onboarding: false, t0: false, pronto: false }
  const payload = typeof data === 'string' ? JSON.parse(data) : data
  return {
    onboarding: Boolean(payload.onboarding),
    t0: Boolean(payload.t0),
    pronto: Boolean(payload.pronto)
  }
}

export function PartecipanteProvider({ children }) {
  const [codice, setCodice] = useState('')
  const [registrato, setRegistrato] = useState(false)
  const [caricamento, setCaricamento] = useState(true)
  const [minutiAscolto, setMinutiAscolto] = useState(0)
  const [onboardingCompleto, setOnboardingCompleto] = useState(false)
  const [t0Completo, setT0Completo] = useState(false)
  const [percorsoPronto, setPercorsoPronto] = useState(false)

  const applicaPercorso = useCallback(stato => {
    setOnboardingCompleto(Boolean(stato.onboarding))
    setT0Completo(Boolean(stato.t0))
    setPercorsoPronto(Boolean(stato.pronto))
  }, [])

  const aggiornaAscolto = useCallback(async (valore = codice) => {
    if (!valore) {
      setMinutiAscolto(0)
      return
    }
    setMinutiAscolto(await sommaMinutiTracce(valore))
  }, [codice])

  const aggiornaPercorso = useCallback(async (valore = codice) => {
    if (!valore) {
      applicaPercorso({ onboarding: false, t0: false, pronto: false })
      return
    }
    applicaPercorso(await leggiStatoPercorso(valore))
  }, [applicaPercorso, codice])

  useEffect(() => {
    const salvato = leggiCodice()
    if (!salvato) {
      setCaricamento(false)
      return
    }
    codiceValido(salvato).then(async ok => {
      if (ok) {
        setCodice(salvato)
        setRegistrato(true)
        const [minuti, percorso] = await Promise.all([
          sommaMinutiTracce(salvato),
          leggiStatoPercorso(salvato)
        ])
        setMinutiAscolto(minuti)
        applicaPercorso(percorso)
      } else {
        dimenticaCodice()
      }
    }).finally(() => setCaricamento(false))
  }, [applicaPercorso])

  async function entra(valore) {
    const pulito = (valore || '').trim()
    const stato = await statoAccesso(pulito)
    if (stato === 'in_attesa') throw new Error('SCREENING_IN_ATTESA')
    if (stato !== 'ok') throw new Error('CODICE_NON_TROVATO')
    memorizzaCodice(pulito)
    setCodice(pulito)
    setRegistrato(true)
    const [minuti, percorso] = await Promise.all([
      sommaMinutiTracce(pulito),
      leggiStatoPercorso(pulito)
    ])
    setMinutiAscolto(minuti)
    applicaPercorso(percorso)
    return percorso
  }

  function esci() {
    dimenticaCodice()
    setCodice('')
    setRegistrato(false)
    setMinutiAscolto(0)
    applicaPercorso({ onboarding: false, t0: false, pronto: false })
  }

  return (
    <PartecipanteContext.Provider value={{
      codice,
      registrato,
      caricamento,
      minutiAscolto,
      onboardingCompleto,
      t0Completo,
      percorsoPronto,
      aggiornaAscolto,
      aggiornaPercorso,
      entra,
      esci
    }}>
      {children}
    </PartecipanteContext.Provider>
  )
}

export function usePartecipante() {
  return useContext(PartecipanteContext)
}

/** Destinazione dopo login in base allo stato del percorso. */
export function destinazionePartecipante({ onboarding, t0, pronto }, richiesta) {
  if (pronto) {
    if (richiesta && richiesta !== '/entra' && richiesta !== '/onboarding') return richiesta
    return '/programma'
  }
  if (!onboarding) return '/onboarding'
  if (!t0) return '/questionari'
  return '/programma'
}
