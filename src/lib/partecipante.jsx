import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { chiamaPorta, dimenticaCodice, leggiCodice, memorizzaCodice, supabase, supabaseConfigurato } from './supabaseClient'
import { pulisciAscoltoLocale, sommaMinutiAscoltati } from './ascolto.js'
import { sommaMinutiTracce } from './oreAscolto.js'

function chiudiSessioneLocale(codiceAperto) {
  pulisciAscoltoLocale(codiceAperto || leggiCodice())
  dimenticaCodice()
}

const PartecipanteContext = createContext({
  codice: '',
  registrato: false,
  caricamento: true,
  minutiAscolto: 0,
  onboardingCompleto: false,
  t0Completo: false,
  percorsoPronto: false,
  questionarioDaCompilare: null,
  aggiornaAscolto: async () => {},
  aggiornaPercorso: async () => {},
  entra: async () => {},
  esci: () => {}
})

async function statoAccesso(codice) {
  if (!codice || !supabaseConfigurato) return 'non_trovato'
  try {
    const data = await chiamaPorta({ azione: 'stato', codice })
    return data?.stato || 'non_trovato'
  } catch (err) {
    if (err?.code === 'TROPPI_TENTATIVI') throw err
    return 'non_trovato'
  }
}

async function codiceValido(codice) {
  return (await statoAccesso(codice)) === 'ok'
}

// Primo momento (T1, T2, T3) aperto e non ancora compilato: finché c'è, la pratica aspetta.
// T0 resta gestito da stato_pronto_percorso.
async function leggiQuestionarioDaCompilare(codice) {
  const { data, error } = await supabase.rpc('stato_questionari_del_partecipante', { p_codice: codice })
  if (error || !data) return null
  const payload = typeof data === 'string' ? JSON.parse(data) : data
  const aperto = (payload.timepoints || []).find(tp => tp.id !== 'T0' && tp.stato === 'aperto')
  return aperto?.id || null
}

async function leggiStatoPercorso(codice) {
  if (!codice || !supabaseConfigurato) {
    return { onboarding: false, t0: false, pronto: false, daCompilare: null }
  }
  const { data, error } = await supabase.rpc('stato_pronto_percorso', { p_codice: codice })
  if (error || !data) return { onboarding: false, t0: false, pronto: false, daCompilare: null }
  const payload = typeof data === 'string' ? JSON.parse(data) : data
  const pronto = Boolean(payload.pronto)
  return {
    onboarding: Boolean(payload.onboarding),
    t0: Boolean(payload.t0),
    pronto,
    daCompilare: pronto ? await leggiQuestionarioDaCompilare(codice) : null
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
  const [questionarioDaCompilare, setQuestionarioDaCompilare] = useState(null)
  const ascoltoSeq = useRef(0)

  const applicaPercorso = useCallback(stato => {
    setOnboardingCompleto(Boolean(stato.onboarding))
    setT0Completo(Boolean(stato.t0))
    setPercorsoPronto(Boolean(stato.pronto))
    setQuestionarioDaCompilare(stato.daCompilare || null)
  }, [])

  const aggiornaAscolto = useCallback(async (valore = codice) => {
    const pulito = typeof valore === 'string' ? valore.trim() : String(codice || '').trim()
    if (!pulito) {
      setMinutiAscolto(0)
      return
    }
    const seq = ++ascoltoSeq.current
    setMinutiAscolto(sommaMinutiAscoltati(pulito))
    const tot = await sommaMinutiTracce(pulito)
    if (seq === ascoltoSeq.current) setMinutiAscolto(tot)
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
    async function apriSessione(codiceAperto) {
      setCodice(codiceAperto)
      setRegistrato(true)
      const [minuti, percorso] = await Promise.all([
        sommaMinutiTracce(codiceAperto),
        leggiStatoPercorso(codiceAperto)
      ])
      setMinutiAscolto(minuti)
      applicaPercorso(percorso)
    }
    codiceValido(salvato).then(async ok => {
      if (ok) await apriSessione(salvato)
      else chiudiSessioneLocale(salvato)
    }).catch(async err => {
      if (err?.code === 'TROPPI_TENTATIVI') {
        try {
          await apriSessione(salvato)
          return
        } catch {
          /* percorso non leggibile: lascia sessione locale minima */
          setCodice(salvato)
          setRegistrato(true)
          return
        }
      }
      chiudiSessioneLocale(salvato)
    }).finally(() => setCaricamento(false))
  }, [applicaPercorso])

  async function entra(valore) {
    const pulito = (valore || '').trim()
    let stato
    try {
      stato = await statoAccesso(pulito)
    } catch (err) {
      if (err?.code === 'TROPPI_TENTATIVI') throw err
      throw new Error('CODICE_NON_TROVATO')
    }
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
    chiudiSessioneLocale(codice)
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
      questionarioDaCompilare,
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
export function destinazionePartecipante({ onboarding, t0, pronto, daCompilare }, richiesta) {
  if (pronto && daCompilare) return '/questionari'
  if (pronto) {
    if (richiesta && richiesta !== '/entra' && richiesta !== '/onboarding') return richiesta
    return '/programma'
  }
  if (!onboarding) return '/onboarding'
  if (!t0) return '/questionari'
  return '/programma'
}
