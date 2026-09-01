import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, supabaseConfigurato } from './supabaseClient'

const AuthContext = createContext({
  sessione: null,
  facilitatore: false,
  caricamento: true,
  accedi: async () => {},
  esci: async () => {}
})

export function AuthProvider({ children }) {
  const [sessione, setSessione] = useState(null)
  const [facilitatore, setFacilitatore] = useState(false)
  const [caricamento, setCaricamento] = useState(true)

  async function aggiornaRuolo(session) {
    if (!session || !supabaseConfigurato) {
      setFacilitatore(false)
      return
    }
    const { data } = await supabase.rpc('is_facilitatore')
    setFacilitatore(Boolean(data))
  }

  useEffect(() => {
    if (!supabaseConfigurato) {
      setCaricamento(false)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      setSessione(data.session ?? null)
      aggiornaRuolo(data.session).finally(() => setCaricamento(false))
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessione(session)
      aggiornaRuolo(session)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  async function accedi(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    setSessione(data.session)
    await aggiornaRuolo(data.session)
    return data.session
  }

  async function esci() {
    await supabase.auth.signOut()
    setSessione(null)
    setFacilitatore(false)
  }

  return (
    <AuthContext.Provider value={{ sessione, facilitatore, caricamento, accedi, esci }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
