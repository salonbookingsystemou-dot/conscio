// Promemoria automatici per iscritti solo da remoto che non partono.
// Auth: JWT del facilitatore, oppure header x-cron-secret = CRON_SECRET.
// Deploy: supabase functions deploy notifica-inattivita --no-verify-jwt
// Secret: CRON_SECRET, RESEND_API_KEY, opzionale RESEND_FROM.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { htmlConFirma, testoConFirma } from '../_shared/firmaEmail.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret'
}

const REPLY_TO = 'contact@wordpresschef.it'
const LINK_ENTRA = 'https://conscio.mnesti.it/#/entra'
const DISCLAIMER =
  'Questo percorso è una pratica di consapevolezza (mindfulness) a scopo di ricerca e non sostituisce un percorso terapeutico o una presa in carico psicologica.'

type Candidato = {
  utente_id: string
  iscrizione_id: string | null
  email: string
  codice: string
  tipo: 'non_avviato' | 'onboarding_senza_ascolto'
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

function testoNonAvviato(codice: string): string {
  return [
    'Ciao,',
    '',
    'ti scriviamo perché ti sei iscritto al Percorso MBSR da remoto e da una settimana non abbiamo ancora visto un primo accesso.',
    '',
    'Se qualcosa non è chiaro, se questo non è il momento giusto, o se possiamo fare qualcosa per aiutarti a partire, rispondi a questa email: siamo qui.',
    '',
    `Il tuo codice partecipante è: ${codice}`,
    '',
    'Puoi entrare dall’app dalla pagina Entra:',
    LINK_ENTRA,
    '',
    DISCLAIMER,
    '',
    `Per assistenza: ${REPLY_TO}`,
    '',
    '— Percorso MBSR'
  ].join('\n')
}

function testoOnboardingSenzaAscolto(codice: string): string {
  return [
    'Ciao,',
    '',
    'hai già fatto il primo accesso al Percorso MBSR. Se non hai ancora ascoltato una traccia, va bene: puoi cominciare dalla settimana 1 quando sei pronto. L’orologio del percorso parte al primo ascolto.',
    '',
    'Se qualcosa ti frena, o se vuoi una mano a scegliere da dove partire, rispondi a questa email.',
    '',
    `Il tuo codice partecipante è: ${codice}`,
    '',
    'Puoi entrare dall’app dalla pagina Entra:',
    LINK_ENTRA,
    '',
    DISCLAIMER,
    '',
    `Per assistenza: ${REPLY_TO}`,
    '',
    '— Percorso MBSR'
  ].join('\n')
}

function messaggioPer(c: Candidato): { oggetto: string, testo: string } {
  if (c.tipo === 'onboarding_senza_ascolto') {
    return {
      oggetto: 'Un passo alla volta — Percorso MBSR',
      testo: testoOnboardingSenzaAscolto(c.codice)
    }
  }
  return {
    oggetto: 'Possiamo aiutarti a partire? — Percorso MBSR',
    testo: testoNonAvviato(c.codice)
  }
}

function etichettaTipo(tipo: Candidato['tipo']): string {
  return tipo === 'onboarding_senza_ascolto'
    ? 'onboarding senza ascolto'
    : 'percorso non avviato'
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
  const { data: candidati, error: errCand } = await admin.rpc('candidati_inattivita_remoto')
  if (errCand) return json({ error: 'CANDIDATI_NON_LEGGIBILI', dettaglio: errCand.message }, 500)

  const lista = ((candidati || []) as Candidato[]).filter(c =>
    c?.utente_id && emailValida((c.email || '').trim()) && c.codice && (
      c.tipo === 'non_avviato' || c.tipo === 'onboarding_senza_ascolto'
    )
  )

  if (!Deno.env.get('RESEND_API_KEY')) {
    return json({ ok: false, motivo: 'RESEND_NON_CONFIGURATO', n_previsti: lista.length })
  }

  let inviate = 0
  let errori = 0
  const perTipo = { non_avviato: 0, onboarding_senza_ascolto: 0 }
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
    const { error: errLog } = await admin.from('notifiche_inattivita').insert({
      utente_id: c.utente_id,
      iscrizione_id: c.iscrizione_id,
      tipo: c.tipo
    })
    if (errLog) {
      errori += 1
      continue
    }
    inviate += 1
    perTipo[c.tipo] += 1
    inviati.push({ codice: c.codice, tipo: c.tipo })
  }

  if (inviate > 0) {
    const righe = inviati.map(r => `- ${r.codice} · ${etichettaTipo(r.tipo)}`)
    await inviaEmail({
      to: REPLY_TO,
      oggetto: `Promemoria inattività: ${inviate} invii`,
      testo: [
        'Promemoria automatici inviati agli iscritti solo da remoto.',
        '',
        ...righe,
        '',
        '— App Conscio'
      ].join('\n')
    })
  }

  return json({
    ok: inviate > 0 || lista.length === 0,
    n_previsti: lista.length,
    n_inviate: inviate,
    n_errori: errori,
    tipi: perTipo
  })
})
