import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { dimenticaCodice, leggiCodice, memorizzaCodice, supabase, supabaseConfigurato } from './supabaseClient'
import { sommaMinutiTracce } from './oreAscolto.js'

const PartecipanteContext = createContext({
  codice: '',
  registrato: false,
  caricamento: true,
  minutiAscolto: 0,
  aggiornaAscolto: async () => {},
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

export function PartecipanteProvider({ children }) {
  const [codice, setCodice] = useState('')
  const [registrato, setRegistrato] = useState(false)
  const [caricamento, setCaricamento] = useState(true)
  const [minutiAscolto, setMinutiAscolto] = useState(0)

  const aggiornaAscolto = useCallback(async (valore = codice) => {
    if (!valore) {
      setMinutiAscolto(0)
      return
    }
    setMinutiAscolto(await sommaMinutiTracce(valore))
  }, [codice])

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
        setMinutiAscolto(await sommaMinutiTracce(salvato))
      } else {
        dimenticaCodice()
      }
    }).finally(() => setCaricamento(false))
  }, [])

  async function entra(valore) {
    const pulito = (valore || '').trim()
    const stato = await statoAccesso(pulito)
    if (stato === 'in_attesa') throw new Error('SCREENING_IN_ATTESA')
    if (stato !== 'ok') throw new Error('CODICE_NON_TROVATO')
    memorizzaCodice(pulito)
    setCodice(pulito)
    setRegistrato(true)
    setMinutiAscolto(await sommaMinutiTracce(pulito))
  }

  function esci() {
    dimenticaCodice()
    setCodice('')
    setRegistrato(false)
    setMinutiAscolto(0)
  }

  return (
    <PartecipanteContext.Provider value={{ codice, registrato, caricamento, minutiAscolto, aggiornaAscolto, entra, esci }}>
      {children}
    </PartecipanteContext.Provider>
  )
}

export function usePartecipante() {
  return useContext(PartecipanteContext)
}
