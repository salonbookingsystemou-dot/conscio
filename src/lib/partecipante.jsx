import { createContext, useContext, useEffect, useState } from 'react'
import { dimenticaCodice, leggiCodice, memorizzaCodice, supabase, supabaseConfigurato } from './supabaseClient'

const PartecipanteContext = createContext({
  codice: '',
  registrato: false,
  caricamento: true,
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

  useEffect(() => {
    const salvato = leggiCodice()
    if (!salvato) {
      setCaricamento(false)
      return
    }
    codiceValido(salvato).then(ok => {
      if (ok) {
        setCodice(salvato)
        setRegistrato(true)
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
  }

  function esci() {
    dimenticaCodice()
    setCodice('')
    setRegistrato(false)
  }

  return (
    <PartecipanteContext.Provider value={{ codice, registrato, caricamento, entra, esci }}>
      {children}
    </PartecipanteContext.Provider>
  )
}

export function usePartecipante() {
  return useContext(PartecipanteContext)
}
