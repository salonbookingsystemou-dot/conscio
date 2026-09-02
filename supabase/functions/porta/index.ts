// Porta unica per Entra, Iscrizione e Accedi facilitatore.
// Applica tetti tentativi per IP (hash) prima delle RPC / Auth.
// Richiede: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' }
  })
}

function ipDaRichiesta(req: Request): string {
  const xf = req.headers.get('x-forwarded-for')
  if (xf) {
    const primo = xf.split(',')[0]?.trim()
    if (primo) return primo
  }
  return (
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-real-ip') ||
    'sconosciuto'
  )
}

async function hashChiave(raw: string): Promise<string> {
  const data = new TextEncoder().encode(raw)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function messaggioErrore(err: { message?: string } | null): string {
  const testo = err?.message || ''
  if (testo.includes('TROPPI_TENTATIVI')) return 'TROPPI_TENTATIVI'
  if (testo.includes('CODA_ISCRIZIONI_PIENA')) return 'CODA_ISCRIZIONI_PIENA'
  if (testo.includes('CICLO_PIENO')) return 'CICLO_PIENO'
  if (testo.includes('EMAIL_GIA_ISCRITTA')) return 'EMAIL_GIA_ISCRITTA'
  if (testo.includes('CICLO_NON_DISPONIBILE')) return 'CICLO_NON_DISPONIBILE'
  if (testo.includes('CODICE_DUPLICATO')) return 'CODICE_DUPLICATO'
  if (testo.includes('CONSENSO_A_OBBLIGATORIO')) return 'CONSENSO_A_OBBLIGATORIO'
  if (testo.includes('EMAIL_MANCANTE')) return 'EMAIL_MANCANTE'
  if (testo.includes('CODICE_MANCANTE')) return 'CODICE_MANCANTE'
  return 'ERRORE'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'METODO_NON_CONSENTITO' }, 405)

  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!url || !anonKey || !serviceKey) {
    return json({ error: 'CONFIG_MANCANTE' }, 500)
  }

  const admin = createClient(url, serviceKey)
  const chiaveIp = await hashChiave(ipDaRichiesta(req))

  let corpo: Record<string, unknown>
  try {
    corpo = await req.json()
  } catch {
    return json({ error: 'CORPO_NON_VALIDO' }, 400)
  }

  const azione = typeof corpo.azione === 'string' ? corpo.azione : ''

  async function limita(azioneLimite: string, chiave: string, max: number, secondi: number) {
    const { error } = await admin.rpc('assert_limite', {
      p_azione: azioneLimite,
      p_chiave: chiave,
      p_max: max,
      p_secondi: secondi
    })
    if (error) {
      const codice = messaggioErrore(error)
      if (codice === 'TROPPI_TENTATIVI') return json({ error: 'TROPPI_TENTATIVI' }, 429)
      return json({ error: codice }, 400)
    }
    return null
  }

  if (azione === 'stato') {
    const blocco = await limita('entra', chiaveIp, 20, 900)
    if (blocco) return blocco

    const codice = typeof corpo.codice === 'string' ? corpo.codice.trim() : ''
    if (!codice) return json({ error: 'CODICE_MANCANTE' }, 400)

    const { data, error } = await admin.rpc('stato_accesso_codice', { p_codice: codice })
    if (error) return json({ error: messaggioErrore(error) }, 400)
    return json({ stato: data || 'non_trovato' })
  }

  if (azione === 'iscrivi') {
    const honeypot = typeof corpo.sito_web === 'string' ? corpo.sito_web.trim() : ''
    if (honeypot) return json({ error: 'ERRORE' }, 400)

    const bloccoOra = await limita('iscrivi_ora', chiaveIp, 3, 3600)
    if (bloccoOra) return bloccoOra
    const bloccoGiorno = await limita('iscrivi_giorno', chiaveIp, 10, 86400)
    if (bloccoGiorno) return bloccoGiorno

    const email = typeof corpo.email === 'string' ? corpo.email.trim() : ''
    const ciclo_id = typeof corpo.ciclo_id === 'string' ? corpo.ciclo_id : ''
    const codice = typeof corpo.codice === 'string' ? corpo.codice.trim() : ''
    const consenso_a = Boolean(corpo.consenso_a)
    const consenso_b = Boolean(corpo.consenso_b)

    const { data, error } = await admin.rpc('iscrivi_partecipante', {
      p_email: email,
      p_ciclo_id: ciclo_id,
      p_codice: codice,
      p_consenso_a: consenso_a,
      p_consenso_b: consenso_b
    })
    if (error) {
      const codiceErr = messaggioErrore(error)
      const status = codiceErr === 'TROPPI_TENTATIVI' ? 429 : 400
      return json({ error: codiceErr }, status)
    }
    return json(data ?? { ok: true })
  }

  if (azione === 'facilitatore') {
    const email = typeof corpo.email === 'string' ? corpo.email.trim().toLowerCase() : ''
    const password = typeof corpo.password === 'string' ? corpo.password : ''
    if (!email || !password) return json({ error: 'CREDENZIALI_MANCANTI' }, 400)

    const chiaveEmail = await hashChiave(`email:${email}`)
    const bloccoIp = await limita('fac_ip', chiaveIp, 15, 900)
    if (bloccoIp) return bloccoIp
    const bloccoEmail = await limita('fac_email', chiaveEmail, 5, 900)
    if (bloccoEmail) return bloccoEmail

    const anon = createClient(url, anonKey)
    const { data, error } = await anon.auth.signInWithPassword({ email, password })
    if (error || !data.session) {
      return json({ error: 'ACCESSO_NON_RIUSCITO' }, 401)
    }

    return json({
      ok: true,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
        expires_in: data.session.expires_in,
        token_type: data.session.token_type,
        user: data.session.user
      }
    })
  }

  return json({ error: 'AZIONE_NON_VALIDA' }, 400)
})
