// Edge Function: invio email operative via Resend.
// Secret da impostare: RESEND_API_KEY, opzionale RESEND_FROM.
// Non legge risposte né log: usa solo email_destinatari_ciclo.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { htmlConFirma, testoConFirma } from '../_shared/firmaEmail.ts'

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

function messaggioResend(body: unknown, status: number) {
  if (body && typeof body === 'object') {
    const rec = body as { message?: unknown; error?: unknown }
    if (typeof rec.message === 'string' && rec.message.trim()) return rec.message
    if (typeof rec.error === 'string' && rec.error.trim()) return rec.error
  }
  return `Resend ha risposto ${status}`
}

function italianoResend(testo: string) {
  const basso = testo.toLowerCase()
  if (basso.includes('example.com') || basso.includes('testing email')) {
    return 'Resend non invia a indirizzi di prova (es. @example.com). Usa un’email reale del partecipante.'
  }
  if (basso.includes('not verified') || basso.includes('domain')) {
    return 'Il mittente non è verificato su Resend. Controlla il dominio in RESEND_FROM.'
  }
  return testo
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'NON_AUTORIZZATO' }, 401)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  )

  const { data: isFac } = await supabase.rpc('is_facilitatore')
  if (!isFac) return json({ error: 'NON_AUTORIZZATO' }, 401)

  const corpo = await req.json()
  const comunicazione_id = corpo?.comunicazione_id
  const prova = Boolean(corpo?.prova)
  if (!comunicazione_id && !prova) return json({ error: 'ID_MANCANTE' }, 400)

  let emails: string[] = []
  let com: { id?: string, oggetto?: string, tipo?: string, testo?: string } | null = null

  if (prova) {
    const { data: sessione } = await supabase.auth.getUser()
    const mia = sessione?.user?.email
    if (!mia) return json({ ok: false, motivo: 'NESSUN_DESTINATARIO' }, 400)
    emails = [mia]
    com = {
      oggetto: 'Prova invio — Percorso MBSR',
      tipo: 'prova',
      testo: 'Questa è una prova di invio da Resend. Se la leggi, le email operative sono collegate.'
    }
  } else {
    const { data: trovata, error: errCom } = await supabase
      .from('comunicazioni')
      .select('id, ciclo_id, oggetto, tipo, testo')
      .eq('id', comunicazione_id)
      .single()

    if (errCom || !trovata) return json({ error: 'COMUNICAZIONE_NON_TROVATA' }, 404)
    com = trovata

    const { data: destinatari } = await supabase.rpc('email_destinatari_ciclo', {
      p_ciclo_id: com.ciclo_id,
      p_includi_in_valutazione: com.tipo === 'screening'
    })
    emails = (destinatari || []).map((r: { email: string }) => r.email).filter(Boolean)
  }

  if (!com) return json({ error: 'COMUNICAZIONE_NON_TROVATA' }, 404)

  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) {
    return json({ ok: false, motivo: 'RESEND_NON_CONFIGURATO', n_destinatari: emails.length })
  }

  if (emails.length === 0) {
    if (com.id) {
      await supabase.from('comunicazioni').update({ stato: 'errore' }).eq('id', com.id)
    }
    return json({ ok: false, motivo: 'NESSUN_DESTINATARIO' }, 400)
  }

  const from = Deno.env.get('RESEND_FROM') || 'Percorso MBSR <noreply@mnesti.it>'
  const oggetto = com.oggetto || com.tipo
  let inviate = 0
  const errori: string[] = []

  for (const to of emails) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: 'contact@wordpresschef.it',
        subject: oggetto,
        text: testoConFirma(com.testo || ''),
        html: htmlConFirma(com.testo || '')
      })
    })
    const corpo = await res.json().catch(() => null)
    if (res.ok) inviate += 1
    else errori.push(italianoResend(messaggioResend(corpo, res.status)))
  }

  if (com.id) {
    const stato = inviate > 0 ? 'inviata' : 'errore'
    await supabase.from('comunicazioni').update({
      stato,
      data_invio: new Date().toISOString()
    }).eq('id', com.id)
  }

  return json({
    ok: inviate > 0,
    n_destinatari: inviate,
    n_previsti: emails.length,
    motivo: inviate === 0 ? 'RESEND_ERRORE' : undefined,
    errore: errori[0]
  })
})
