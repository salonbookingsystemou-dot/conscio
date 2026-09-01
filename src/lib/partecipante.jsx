import { createContext, useContext, useEffect, useState } from 'react'
import { dimenticaCodice, leggiCodice, memorizzaCodice, supabase, supabaseConfigurato } from './supabaseClient'

const PartecipanteContext = createContext({
  codice: '',
  registrato: false,
  caricamento: true,
  entra: async () => {},
  esci: () => {},
  dopoIscrizione: () => {}
})

async function codiceValido(codice) {
  if (!codice || !supabaseConfigurato) return false
  const { data, error } = await supabase.rpc('codice_partecipante_valido', {
    p_codice: codice
  })
  return !error && Boolean(data)
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
    const ok = await codiceValido(pulito)
    if (!ok) throw new Error('CODICE_NON_TROVATO')
    memorizzaCodice(pulito)
    setCodice(pulito)
    setRegistrato(true)
  }

  function esci() {
    dimenticaCodice()
    setCodice('')
    setRegistrato(false)
  }

  function dopoIscrizione(valore) {
    const pulito = (valore || '').trim()
    if (!pulito) return
    memorizzaCodice(pulito)
    setCodice(pulito)
    setRegistrato(true)
  }

  return (
    <PartecipanteContext.Provider value={{ codice, registrato, caricamento, entra, esci, dopoIscrizione }}>
      {children}
    </PartecipanteContext.Provider>
  )
}

export function usePartecipante() {
  return useContext(PartecipanteContext)
}
