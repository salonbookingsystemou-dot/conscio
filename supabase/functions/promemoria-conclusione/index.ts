// Email a chi, due giorni dopo il giorno di conclusione, non ha ancora chiuso la sequenza di fine percorso.
// Auth: JWT del facilitatore, oppure header x-cron-secret = CRON_SECRET.
// Body facoltativo (solo facilitatore):
//   { "anteprima": true }  → elenco dei codici previsti, nessun invio
//   { "prova": true }      → un esempio all'email del facilitatore, nessun registro
// Deploy: supabase functions deploy promemoria-conclusione --no-verify-jwt
// Secret: CRON_SECRET, RESEND_API_KEY, opzionale RESEND_FROM.
// SQL: supabase/migrazione_promemoria_conclusione.sql.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { htmlConFirma, testoConFirma } from '../_shared/firmaEmail.ts'
import {
  htmlConclusione,
  OGGETTO_CONCLUSIONE,
  testoConclusione,
  type DatiConclusione
} from '../_shared/emailConclusione.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret'
}

const REPLY_TO = 'contact@wordpresschef.it'

type Candidato = {
  utente_id: string
  email: string
  codice: string
  riferimento: string
  t2_da_fare: boolean
  t2_chiude_il: string | null
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

async function inviaEmail(opts: { to: string, oggetto: string, testo: string, html: string }): Promise<boolean> {
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
        text: opts.testo,
        html: opts.html
      })
    })
    return res.ok
  } catch {
    return false
  }
}

function datiDi(c: Candidato): DatiConclusione {
  return { codice: c.codice, t2DaFare: Boolean(c.t2_da_fare), t2ChiudeIl: c.t2_chiude_il }
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
  let emailFacilitatore = ''
  const authHeader = req.headers.get('Authorization')
  if (!cronOk && authHeader) {
    const conSessione = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } }
    })
    const { data: isFac } = await conSessione.rpc('is_facilitatore')
    facOk = Boolean(isFac)
    if (facOk) {
      const token = authHeader.replace(/^Bearer\s+/i, '')
      const { data: u } = await conSessione.auth.getUser(token)
      emailFacilitatore = (u?.user?.email || '').trim().toLowerCase()
    }
  }

  if (!cronOk && !facOk) return json({ error: 'NON_AUTORIZZATO' }, 401)

  let body: { anteprima?: boolean, prova?: boolean } = {}
  try { body = await req.json() } catch { /* body vuoto */ }

  const admin = createClient(url, serviceKey)
  const { data: candidati, error: errCand } = await admin.rpc('candidati_promemoria_conclusione')
  if (errCand) return json({ error: 'CANDIDATI_NON_LEGGIBILI', dettaglio: errCand.message }, 500)

  const lista = ((candidati || []) as Candidato[]).filter(c =>
    c?.utente_id && c.codice && c.riferimento && emailValida((c.email || '').trim())
  )

  if (facOk && body.anteprima) {
    return json({
      ok: true,
      n_previsti: lista.length,
      previsti: lista.map(c => ({ codice: c.codice, riferimento: c.riferimento, t2_da_fare: c.t2_da_fare }))
    })
  }

  if (!Deno.env.get('RESEND_API_KEY')) {
    return json({ ok: false, motivo: 'RESEND_NON_CONFIGURATO', n_previsti: lista.length })
  }

  if (facOk && body.prova) {
    if (!emailValida(emailFacilitatore)) return json({ error: 'EMAIL_FACILITATORE_MANCANTE' }, 400)
    const esempio: DatiConclusione = {
      codice: 'MBSR-ESEMPIO',
      t2DaFare: true,
      t2ChiudeIl: lista.find(c => c.t2_chiude_il)?.t2_chiude_il || new Date().toISOString().slice(0, 10)
    }
    const ok = await inviaEmail({
      to: emailFacilitatore,
      oggetto: `[Prova] ${OGGETTO_CONCLUSIONE}`,
      testo: testoConclusione(esempio),
      html: htmlConclusione(esempio)
    })
    return json({ ok, prova: true, n_previsti: lista.length })
  }

  let inviate = 0
  let errori = 0
  const inviati: { codice: string, t2: boolean }[] = []

  for (const c of lista) {
    const dati = datiDi(c)
    const ok = await inviaEmail({
      to: c.email.trim().toLowerCase(),
      oggetto: OGGETTO_CONCLUSIONE,
      testo: testoConclusione(dati),
      html: htmlConclusione(dati)
    })
    if (!ok) {
      errori += 1
      continue
    }
    const { error: errLog } = await admin.from('promemoria_conclusione').insert({
      utente_id: c.utente_id,
      riferimento: c.riferimento
    })
    if (errLog) {
      errori += 1
      continue
    }
    inviate += 1
    inviati.push({ codice: c.codice, t2: dati.t2DaFare })
  }

  if (inviate > 0) {
    const testo = [
      'Email a chi non ha ancora chiuso il percorso, due giorni dopo il giorno di conclusione.',
      '',
      ...inviati.map(r => `- ${r.codice}${r.t2 ? ' · T2 da compilare' : ''}`),
      '',
      '— App Conscio'
    ].join('\n')
    await inviaEmail({
      to: REPLY_TO,
      oggetto: `Fine percorso: ${inviate} inviati`,
      testo: testoConFirma(testo),
      html: htmlConFirma(testo)
    })
  }

  return json({
    ok: errori === 0,
    n_previsti: lista.length,
    n_inviate: inviate,
    n_errori: errori
  })
})
