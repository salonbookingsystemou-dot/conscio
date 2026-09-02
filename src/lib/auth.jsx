import { createContext, useContext, useEffect, useState } from 'react'
import { chiamaPorta, supabase, supabaseConfigurato } from './supabaseClient'

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
    const data = await chiamaPorta({
      azione: 'facilitatore',
      email: (email || '').trim(),
      password
    })
    if (!data?.session?.access_token || !data?.session?.refresh_token) {
      const err = new Error('ACCESSO_NON_RIUSCITO')
      err.code = 'ACCESSO_NON_RIUSCITO'
      throw err
    }
    const { data: applicata, error } = await supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token
    })
    if (error) throw error
    setSessione(applicata.session)
    await aggiornaRuolo(applicata.session)
    return applicata.session
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
