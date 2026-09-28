// Avviso al facilitatore quando un check-in settimanale segnala un'esperienza difficile.
// Deploy: supabase functions deploy avvisa-segnalazione-checkin --no-verify-jwt
// Secret: RESEND_API_KEY, CHECKIN_WEBHOOK_SECRET (o CRON_SECRET), opzionale RESEND_FROM, FACILITATORE_EMAIL.
// Webhook: INSERT e UPDATE su public.checkin_settimanali, header x-webhook-secret.
// L'email contiene solo codice e settimana: la nota resta nel pannello admin.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { htmlConFirma, testoConFirma } from '../_shared/firmaEmail.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret'
}

const REPLY_TO = 'contact@wordpresschef.it'
const LINK_ADMIN = 'https://conscio.mnesti.it/#/dashboard'

type CheckinRecord = {
  id?: string
  utente_id?: string
  settimana?: number
  esperienza_difficile?: boolean | null
  segnalazione_gestita_il?: string | null
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' }
  })
}

function autorizzato(req: Request): boolean {
  const secret = Deno.env.get('CHECKIN_WEBHOOK_SECRET') || Deno.env.get('CRON_SECRET') || ''
  const header = req.headers.get('x-webhook-secret') || ''
  if (secret && header && header === secret) return true

  const auth = req.headers.get('Authorization') || ''
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  return Boolean(service) && auth === `Bearer ${service}`
}

function daSegnalare(tipo: unknown, record: CheckinRecord, precedente: CheckinRecord | null): boolean {
  if (record.esperienza_difficile !== true || record.segnalazione_gestita_il) return false
  if (tipo === 'INSERT') return true
  return precedente?.esperienza_difficile !== true
}

function etichettaSettimana(n: number | undefined): string {
  if (n === 9) return 'settimana intensiva'
  return n ? `settimana ${n}` : 'settimana non indicata'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'METODO_NON_CONSENTITO' }, 405)
  if (!autorizzato(req)) return json({ error: 'NON_AUTORIZZATO' }, 401)

  let corpo: Record<string, unknown>
  try {
    corpo = await req.json()
  } catch {
    return json({ ok: false, error: 'CORPO_NON_VALIDO' }, 400)
  }

  const record = (corpo.record && typeof corpo.record === 'object' ? corpo.record : null) as CheckinRecord | null
  const precedente = (corpo.old_record && typeof corpo.old_record === 'object' ? corpo.old_record : null) as CheckinRecord | null
  if (!record?.utente_id) return json({ ok: false, error: 'RECORD_MANCANTE' }, 400)

  if (!daSegnalare(corpo.type, record, precedente)) {
    return json({ ok: true, inviata: false, motivo: 'NIENTE_DA_SEGNALARE' })
  }

  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!url || !serviceKey) return json({ error: 'CONFIG_MANCANTE' }, 500)
  if (!apiKey) return json({ ok: false, motivo: 'RESEND_NON_CONFIGURATO' })

  const admin = createClient(url, serviceKey)
  const { data: utente, error: errUtente } = await admin
    .from('utenti')
    .select('codice_partecipante')
    .eq('id', record.utente_id)
    .single()
  if (errUtente || !utente?.codice_partecipante) {
    return json({ ok: false, error: 'UTENTE_NON_TROVATO' }, 404)
  }

  const codice = String(utente.codice_partecipante)
  const settimana = etichettaSettimana(record.settimana)
  const testo = [
    'Un partecipante ha segnalato nel check-in settimanale un momento difficile durante la pratica.',
    '',
    `Codice: ${codice}`,
    `Periodo: ${settimana}`,
    '',
    'La nota, se presente, è visibile solo nel pannello admin, nella sezione «Segnalazioni da gestire».',
    'Dopo averlo contattato, segna la segnalazione come gestita.',
    '',
    LINK_ADMIN,
    '',
    '— App Conscio'
  ].join('\n')

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: Deno.env.get('RESEND_FROM') || 'Percorso MBSR <noreply@mnesti.it>',
        to: [Deno.env.get('FACILITATORE_EMAIL') || REPLY_TO],
        subject: `Check-in: segnalazione da gestire (${codice}, ${settimana})`,
        text: testoConFirma(testo),
        html: htmlConFirma(testo)
      })
    })
    if (!res.ok) {
      const dettaglio = await res.json().catch(() => null)
      console.error('resend', res.status, dettaglio)
      return json({ ok: false, motivo: 'RESEND_ERRORE' }, 502)
    }
  } catch (err) {
    console.error('resend', err instanceof Error ? err.message : err)
    return json({ ok: false, motivo: 'RESEND_ERRORE' }, 502)
  }

  return json({ ok: true, inviata: true })
})
