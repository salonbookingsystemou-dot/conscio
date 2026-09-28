// Promemoria email del follow-up T3: all'apertura (fine + 28 giorni) e 7 giorni prima della chiusura.
// Auth: JWT del facilitatore, oppure header x-cron-secret = CRON_SECRET.
// Deploy: supabase functions deploy promemoria-questionari --no-verify-jwt
// Secret: CRON_SECRET, RESEND_API_KEY, opzionale RESEND_FROM.
// SQL: supabase/migrazione_promemoria_t3.sql.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { htmlConFirma, testoConFirma } from '../_shared/firmaEmail.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret'
}

const REPLY_TO = 'contact@wordpresschef.it'
const LINK_QUESTIONARI = 'https://conscio.mnesti.it/#/questionari'
const DISCLAIMER =
  'Questo percorso è una pratica di consapevolezza (mindfulness) a scopo di ricerca e non sostituisce un percorso terapeutico o una presa in carico psicologica.'

type Candidato = {
  utente_id: string
  email: string
  codice: string
  tipo: 'apertura' | 'chiusura'
  riferimento: string
  chiude_il: string
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

function dataEstesa(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Rome'
  })
}

function messaggioPer(c: Candidato): { oggetto: string, testo: string } {
  const chiude = dataEstesa(c.chiude_il)
  const apertura = c.tipo === 'apertura'
  return {
    oggetto: apertura
      ? 'Si aprono i questionari di follow-up (T3) — Percorso MBSR'
      : 'Ultima settimana per il follow-up (T3) — Percorso MBSR',
    testo: [
      'Ciao,',
      '',
      apertura
        ? 'sono passate quattro settimane dalla fine del percorso MBSR: da oggi puoi compilare i questionari di follow-up (T3).'
        : 'mancano sette giorni alla chiusura dei questionari di follow-up (T3) del percorso MBSR.',
      '',
      'È il momento più facile da dimenticare, e per il percorso è importante quanto gli altri. Bastano pochi minuti.',
      '',
      `Restano aperti fino al ${chiude}.`,
      '',
      `Il tuo codice partecipante è: ${c.codice}`,
      '',
      'Li trovi nella pagina Questionari dell’app:',
      LINK_QUESTIONARI,
      '',
      DISCLAIMER,
      '',
      `Per assistenza: ${REPLY_TO}`,
      '',
      '— Percorso MBSR'
    ].join('\n')
  }
}

async function inviaEmail(opts: { to: string, oggetto: string, testo: string }): Promise<boolean> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) return false
  const from = Deno.env.get('RESEND_FROM') || 'Percorso MBSR <noreply@mnesti.it>'
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from,
        to: [opts.to],
        reply_to: REPLY_TO,
        subject: opts.oggetto,
        text: testoConFirma(opts.testo),
        html: htmlConFirma(opts.testo)
      })
    })
    return res.ok
  } catch {
    return false
  }
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

  const cronAtteso = Deno.env.get('CRON_SECRET') || ''
  const cronRicevuto = req.headers.get('x-cron-secret') || ''
  const cronOk = Boolean(cronAtteso) && cronRicevuto === cronAtteso

  let facOk = false
  const authHeader = req.headers.get('Authorization')
  if (!cronOk && authHeader) {
    const conSessione = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } }
    })
    const { data: isFac } = await conSessione.rpc('is_facilitatore')
    facOk = Boolean(isFac)
  }

  if (!cronOk && !facOk) return json({ error: 'NON_AUTORIZZATO' }, 401)

  const admin = createClient(url, serviceKey)
  const { data: candidati, error: errCand } = await admin.rpc('candidati_promemoria_t3')
  if (errCand) return json({ error: 'CANDIDATI_NON_LEGGIBILI', dettaglio: errCand.message }, 500)

  const lista = ((candidati || []) as Candidato[]).filter(c =>
    c?.utente_id && c.codice && c.riferimento && c.chiude_il &&
    emailValida((c.email || '').trim()) &&
    (c.tipo === 'apertura' || c.tipo === 'chiusura')
  )

  if (!Deno.env.get('RESEND_API_KEY')) {
    return json({ ok: false, motivo: 'RESEND_NON_CONFIGURATO', n_previsti: lista.length })
  }

  let inviate = 0
  let errori = 0
  const inviati: { codice: string, tipo: Candidato['tipo'] }[] = []

  for (const c of lista) {
    const msg = messaggioPer(c)
    const ok = await inviaEmail({
      to: c.email.trim().toLowerCase(),
      oggetto: msg.oggetto,
      testo: msg.testo
    })
    if (!ok) {
      errori += 1
      continue
    }
    const { error: errLog } = await admin.from('promemoria_questionari').insert({
      utente_id: c.utente_id,
      timepoint: 'T3',
      tipo: c.tipo,
      riferimento: c.riferimento
    })
    if (errLog) {
      errori += 1
      continue
    }
    inviate += 1
    inviati.push({ codice: c.codice, tipo: c.tipo })
  }

  if (inviate > 0) {
    await inviaEmail({
      to: REPLY_TO,
      oggetto: `Promemoria T3: ${inviate} inviati`,
      testo: [
        'Promemoria automatici del follow-up T3.',
        '',
        ...inviati.map(r => `- ${r.tipo === 'apertura' ? 'apertura' : 'chiusura tra 7 giorni'} · ${r.codice}`),
        '',
        '— App Conscio'
      ].join('\n')
    })
  }

  return json({
    ok: errori === 0,
    n_previsti: lista.length,
    n_inviate: inviate,
    n_errori: errori
  })
})
