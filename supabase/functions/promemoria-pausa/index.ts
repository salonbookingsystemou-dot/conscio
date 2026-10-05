// Email a chi, dentro un percorso aperto, non ascolta una traccia per tre giorni di fila.
// Auth: JWT del facilitatore, oppure header x-cron-secret = CRON_SECRET.
// Deploy: supabase functions deploy promemoria-pausa --no-verify-jwt
// Secret: CRON_SECRET, RESEND_API_KEY, opzionale RESEND_FROM.
// SQL: supabase/migrazione_promemoria_pausa.sql.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { htmlConFirma, testoConFirma } from '../_shared/firmaEmail.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret'
}

const REPLY_TO = 'contact@wordpresschef.it'
const DISCLAIMER =
  'Questo percorso è una pratica di consapevolezza (mindfulness) a scopo di ricerca e non sostituisce un percorso terapeutico o una presa in carico psicologica.'

const OGGETTO = 'Se senti di doverti fermare, lascia semplicemente che sia così'

type Candidato = {
  utente_id: string
  email: string
  codice: string
  riferimento: string
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

function testoPausa(): string {
  return [
    'Ciao,',
    '',
    'È abbastanza comune che durante il percorso di pratica meditativa tu senta il bisogno di fermarti o di non voler continuare.',
    '',
    'Rendersi conto che non si sono trovati più il tempo o le energie da dedicare a questo momento è assolutamente normale.',
    '',
    'Se sei in questa situazione, dai a te stesso la possibilità di renderti consapevole di cosa ti ha fermato.',
    '',
    'Prova a riportare alla mente la sensazione provata quando hai sentito che non avresti continuato o quando ti sei accorto che la meditazione non trovava più spazio nella tua giornata.',
    '',
    'Se puoi, concediti ancora un esercizio di consapevolezza lasciando emergere tutto ciò che c’è, senza giudicare.',
    '',
    'Concediti la possibilità di nuovo inizio appena ne avvertirai il bisogno.',
    '',
    'Se durante la pratica hai sperimentato delle difficoltà legate a all’emergere di sensazioni spiacevoli, sentiti libero di contattarci via email.',
    '',
    DISCLAIMER
  ].join('\n')
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
  const { data: candidati, error: errCand } = await admin.rpc('candidati_pausa_pratica')
  if (errCand) return json({ error: 'CANDIDATI_NON_LEGGIBILI', dettaglio: errCand.message }, 500)

  const lista = ((candidati || []) as Candidato[]).filter(c =>
    c?.utente_id && c.codice && c.riferimento && emailValida((c.email || '').trim())
  )

  if (!Deno.env.get('RESEND_API_KEY')) {
    return json({ ok: false, motivo: 'RESEND_NON_CONFIGURATO', n_previsti: lista.length })
  }

  let inviate = 0
  let errori = 0
  const inviati: { codice: string }[] = []
  const testo = testoPausa()

  for (const c of lista) {
    const ok = await inviaEmail({
      to: c.email.trim().toLowerCase(),
      oggetto: OGGETTO,
      testo
    })
    if (!ok) {
      errori += 1
      continue
    }
    const { error: errLog } = await admin.from('promemoria_pausa').insert({
      utente_id: c.utente_id,
      riferimento: c.riferimento
    })
    if (errLog) {
      errori += 1
      continue
    }
    inviate += 1
    inviati.push({ codice: c.codice })
  }

  if (inviate > 0) {
    await inviaEmail({
      to: REPLY_TO,
      oggetto: `Pausa di pratica: ${inviate} inviati`,
      testo: [
        'Email a chi non ascolta una traccia da tre giorni di fila.',
        '',
        ...inviati.map(r => `- ${r.codice}`),
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
