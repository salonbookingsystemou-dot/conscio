import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  console.warn(
    'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY non impostate. ' +
    'Copia .env.example in .env.local e inserisci le credenziali del tuo progetto Supabase.'
  )
}

export const supabaseConfigurato = Boolean(url && anonKey)

// Placeholder solo per non far crashare createClient in assenza di .env.local.
export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'public-anon-placeholder-key-not-configured',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
)

const CHIAVE_CODICE = 'mbsr_codice'

export function leggiCodice() {
  try {
    return sessionStorage.getItem(CHIAVE_CODICE) || ''
  } catch {
    return ''
  }
}

export function memorizzaCodice(codice) {
  try {
    const pulito = (codice || '').trim()
    if (pulito) sessionStorage.setItem(CHIAVE_CODICE, pulito)
  } catch {
    /* sessione non disponibile */
  }
}

// Genera un codice partecipante pseudonimizzato, es. "MBSR-7K2Q"
export function generaCodicePartecipante() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return `MBSR-${code}`
}
