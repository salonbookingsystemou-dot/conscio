// Email di incoraggiamento dopo «Registra la pratica di oggi».
// Deploy: supabase functions deploy invia-incoraggiamento-pratica --no-verify-jwt
// Secret: RESEND_API_KEY, opzionale RESEND_FROM o EMAIL_FROM, ENCOURAGEMENT_SECRET.
// Webhook: INSERT su public.log_pratica. La funzione elabora solo tipo = 'giorno'.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  htmlIncoraggiamento,
  oggettoIncoraggiamento,
  testoIncoraggiamentoConFirma,
  type CitazioneEmail
} from '../_shared/emailIncoraggiamento.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret, x-cron-secret'
}

const REPLY_TO = 'contact@wordpresschef.it'

type LogRecord = {
  id?: string
  utente_id?: string
  data?: string
  tipo?: string | null
}

type CitazioneRiga = {
  id: string
  author: string
  book_title: string
  quote_text: string
  week_theme: number
}

type Calendario = {
  giorno_percorso: number
  settimana: number
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' }
  })
}

function emailValida(email: string): boolean {
  if (!email || email.length > 200) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function autorizzato(req: Request): boolean {
  const secret = Deno.env.get('ENCOURAGEMENT_SECRET') || Deno.env.get('CRON_SECRET') || ''
  const header = req.headers.get('x-webhook-secret') || req.headers.get('x-cron-secret') || ''
  if (secret && header && header === secret) return true

  const auth = req.headers.get('Authorization') || ''
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  return Boolean(service) && auth === `Bearer ${service}`
}

function mittente(): string {
  return (
    Deno.env.get('EMAIL_FROM') ||
    Deno.env.get('RESEND_FROM') ||
    'Percorso MBSR <noreply@mnesti.it>'
  )
}

function uuidOk(valore: unknown): valore is string {
  return typeof valore === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valore)
}

function dataIso(valore: unknown): string {
  if (typeof valore === 'string' && /^\d{4}-\d{2}-\d{2}/.test(valore)) {
    return valore.slice(0, 10)
  }
  return new Date().toISOString().slice(0, 10)
}

function recordDaWebhook(corpo: Record<string, unknown>): LogRecord | null {
  const rec = corpo.record
  if (!rec || typeof rec !== 'object') return null
  return rec as LogRecord
}

async function inviaResend(opts: {
  to: string
  oggetto: string
  citazione: CitazioneEmail
}): Promise<{ ok: boolean, errore?: string }> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) return { ok: false, errore: 'RESEND_NON_CONFIGURATO' }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: mittente(),
        to: [opts.to],
        reply_to: REPLY_TO,
        subject: opts.oggetto,
        text: testoIncoraggiamentoConFirma(opts.citazione),
        html: htmlIncoraggiamento(opts.citazione)
      })
    })
    if (res.ok) return { ok: true }
    const corpo = await res.json().catch(() => null)
    const msg = corpo && typeof corpo === 'object' && 'message' in corpo
      ? String((corpo as { message?: unknown }).message)
      : `Resend ha risposto ${res.status}`
    return { ok: false, errore: msg }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'invio interrotto'
    return { ok: false, errore: msg }
  }
}

async function calendarioDi(
  admin: SupabaseClient,
  utenteId: string,
  giorno: string,
  weekOverride?: number
): Promise<Calendario> {
  const { data, error } = await admin.rpc('calendario_pratica_utente', {
    p_utente_id: utenteId,
    p_giorno: giorno
  })
  if (error) {
    console.error('calendario_pratica_utente', error.message)
  }
  const payload = data && typeof data === 'object' ? data as Record<string, unknown> : {}
  const settimanaCalcolata = Number(payload.settimana) || 1
  const settimana = weekOverride
    ? Math.max(1, Math.min(8, weekOverride))
    : Math.max(1, Math.min(8, settimanaCalcolata))
  return {
    giorno_percorso: Math.max(1, Math.min(56, Number(payload.giorno_percorso) || 1)),
    settimana
  }
}

async function inviaIncoraggiamento(
  admin: SupabaseClient,
  opts: {
    utenteId: string
    practiceDate: string
    weekNumber?: number
  }
): Promise<Record<string, unknown>> {
  const { data: utente, error: errUtente } = await admin
    .from('utenti')
    .select('id, email, codice_partecipante, ruolo')
    .eq('id', opts.utenteId)
    .maybeSingle()

  if (errUtente || !utente) {
    console.error('partecipante non trovato', errUtente?.message)
    return { ok: false, motivo: 'PARTECIPANTE_NON_TROVATO' }
  }
  if (utente.ruolo !== 'partecipante') {
    return { ok: false, motivo: 'NON_PARTECIPANTE' }
  }

  const email = String(utente.email || '').trim().toLowerCase()
  if (!emailValida(email)) {
    console.error('email assente o non valida', utente.codice_partecipante)
    return { ok: false, motivo: 'EMAIL_MANCANTE' }
  }

  const cal = await calendarioDi(admin, opts.utenteId, opts.practiceDate, opts.weekNumber)

  const { data: giaInviata } = await admin
    .from('quote_sent_log')
    .select('id')
    .eq('utente_id', opts.utenteId)
    .eq('practice_date', opts.practiceDate)
    .maybeSingle()
  if (giaInviata) {
    return { ok: true, motivo: 'GIA_INVIATA', giorno: cal.giorno_percorso, settimana: cal.settimana }
  }

  const { data: scelta, error: errScelta } = await admin.rpc('scegli_citazione', {
    p_utente_id: opts.utenteId,
    p_settimana: cal.settimana
  })
  const riga = (Array.isArray(scelta) ? scelta[0] : scelta) as CitazioneRiga | null
  if (errScelta || !riga?.id) {
    console.error('nessuna citazione', errScelta?.message, 'settimana', cal.settimana)
    return { ok: false, motivo: 'NESSUNA_CITAZIONE', settimana: cal.settimana }
  }

  const citazione: CitazioneEmail = {
    quoteText: riga.quote_text,
    author: riga.author,
    bookTitle: riga.book_title
  }

  const invio = await inviaResend({
    to: email,
    oggetto: oggettoIncoraggiamento(cal.giorno_percorso),
    citazione
  })
  if (!invio.ok) {
    console.error('invio incoraggiamento fallito', invio.errore)
    return {
      ok: false,
      motivo: invio.errore === 'RESEND_NON_CONFIGURATO' ? 'RESEND_NON_CONFIGURATO' : 'RESEND_ERRORE',
      errore: invio.errore,
      settimana: cal.settimana,
      giorno: cal.giorno_percorso
    }
  }

  const { error: errLog } = await admin.from('quote_sent_log').insert({
    utente_id: opts.utenteId,
    quote_id: riga.id,
    week_number: cal.settimana,
    practice_date: opts.practiceDate
  })
  if (errLog) {
    console.error('log citazione non scritto', errLog.message)
  }

  return {
    ok: true,
    settimana: cal.settimana,
    giorno: cal.giorno_percorso,
    quote_id: riga.id
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'METODO_NON_CONSENTITO' }, 405)
  if (!autorizzato(req)) return json({ error: 'NON_AUTORIZZATO' }, 401)

  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!url || !serviceKey) return json({ error: 'CONFIG_MANCANTE' }, 500)

  let corpo: Record<string, unknown>
  try {
    corpo = await req.json()
  } catch {
    return json({ ok: false, error: 'CORPO_NON_VALIDO' })
  }

  const prova = Boolean(corpo.prova)
  const record = recordDaWebhook(corpo)
  let utenteId = ''
  let practiceDate = dataIso(undefined)
  let weekNumber: number | undefined

  if (prova) {
    if (uuidOk(corpo.utente_id)) {
      utenteId = corpo.utente_id
    } else if (typeof corpo.codice === 'string' && corpo.codice.trim()) {
      const adminLookup = createClient(url, serviceKey)
      const { data: trovato } = await adminLookup
        .from('utenti')
        .select('id')
        .ilike('codice_partecipante', corpo.codice.trim())
        .maybeSingle()
      if (trovato?.id) utenteId = trovato.id
    }
    if (typeof corpo.week_number === 'number') weekNumber = corpo.week_number
    if (typeof corpo.practice_date === 'string') practiceDate = dataIso(corpo.practice_date)
  } else {
    const tipo = record?.tipo
    if (tipo && tipo !== 'giorno') {
      return json({ ok: true, motivo: 'IGNORATO', tipo })
    }
    if (!tipo) {
      return json({ ok: false, motivo: 'TIPO_MANCANTE' })
    }
    if (!uuidOk(record?.utente_id)) {
      return json({ ok: false, motivo: 'UTENTE_MANCANTE' })
    }
    utenteId = record.utente_id
    practiceDate = dataIso(record.data)
  }

  if (!uuidOk(utenteId)) {
    return json({ ok: false, motivo: 'UTENTE_MANCANTE' })
  }

  const admin = createClient(url, serviceKey)
  try {
    const esito = await inviaIncoraggiamento(admin, {
      utenteId,
      practiceDate,
      weekNumber
    })
    return json(esito)
  } catch (err) {
    console.error('invia-incoraggiamento-pratica', err)
    return json({ ok: false, motivo: 'ERRORE_INTERNO' })
  }
})
