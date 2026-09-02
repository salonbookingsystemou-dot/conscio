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

/** Chiama l’edge function porta (Entra / Iscrizione / Accedi) con tetto tentativi. */
export async function chiamaPorta(corpo) {
  if (!supabaseConfigurato) {
    const err = new Error('CONFIG_MANCANTE')
    err.code = 'CONFIG_MANCANTE'
    throw err
  }
  const res = await fetch(`${url}/functions/v1/porta`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey
    },
    body: JSON.stringify(corpo)
  })
  let payload = null
  try {
    payload = await res.json()
  } catch {
    payload = null
  }
  const codice = payload?.error || (!res.ok ? 'ERRORE' : null)
  if (codice) {
    const err = new Error(codice)
    err.code = codice
    err.status = res.status
    throw err
  }
  return payload
}

const CHIAVE_CODICE = 'mbsr_codice'
const CHIAVE_RICORDO = 'mbsr_codice_ricordo'

export function leggiCodice() {
  try {
    return localStorage.getItem(CHIAVE_CODICE) || sessionStorage.getItem(CHIAVE_CODICE) || ''
  } catch {
    return ''
  }
}

export function leggiCodiceRicordato() {
  try {
    return localStorage.getItem(CHIAVE_RICORDO) || leggiCodice() || ''
  } catch {
    return ''
  }
}

export function memorizzaCodiceRicordato(codice) {
  try {
    const pulito = (codice || '').trim()
    if (!pulito) return
    localStorage.setItem(CHIAVE_RICORDO, pulito)
  } catch {
    /* archivio non disponibile */
  }
}

export function memorizzaCodice(codice) {
  try {
    const pulito = (codice || '').trim()
    if (!pulito) return
    localStorage.setItem(CHIAVE_CODICE, pulito)
    localStorage.setItem(CHIAVE_RICORDO, pulito)
    sessionStorage.removeItem(CHIAVE_CODICE)
  } catch {
    /* archivio non disponibile */
  }
}

export function dimenticaCodice() {
  try {
    localStorage.removeItem(CHIAVE_CODICE)
    sessionStorage.removeItem(CHIAVE_CODICE)
    localStorage.removeItem(CHIAVE_RICORDO)
  } catch {
    /* archivio non disponibile */
  }
}

export function dimenticaCodiceRicordato() {
  try {
    localStorage.removeItem(CHIAVE_RICORDO)
  } catch {
    /* archivio non disponibile */
  }
}

// Genera un codice partecipante pseudonimizzato, es. "MBSR-7K2Q8N3P"
export function generaCodicePartecipante() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = new Uint8Array(8)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  let code = ''
  for (let i = 0; i < 8; i++) code += chars[bytes[i] % chars.length]
  return `MBSR-${code}`
}
