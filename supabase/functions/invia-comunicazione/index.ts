// Edge Function: invio email operative via Resend.
// Secret da impostare: RESEND_API_KEY, opzionale RESEND_FROM.
// Non legge risposte né log: usa solo email_destinatari_ciclo.

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

  const { comunicazione_id } = await req.json()
  if (!comunicazione_id) return json({ error: 'ID_MANCANTE' }, 400)

  const { data: com, error: errCom } = await supabase
    .from('comunicazioni')
    .select('id, ciclo_id, oggetto, tipo, testo')
    .eq('id', comunicazione_id)
    .single()

  if (errCom || !com) return json({ error: 'COMUNICAZIONE_NON_TROVATA' }, 404)

  const { data: destinatari } = await supabase.rpc('email_destinatari_ciclo', {
    p_ciclo_id: com.ciclo_id
  })
  const emails = (destinatari || []).map((r: { email: string }) => r.email).filter(Boolean)

  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) {
    return json({ ok: false, motivo: 'RESEND_NON_CONFIGURATO', n_destinatari: emails.length })
  }

  if (emails.length === 0) {
    await supabase.from('comunicazioni').update({ stato: 'errore' }).eq('id', com.id)
    return json({ ok: false, motivo: 'NESSUN_DESTINATARIO' }, 400)
  }

  const from = Deno.env.get('RESEND_FROM') || 'Percorso MBSR <noreply@resend.dev>'
  const oggetto = com.oggetto || com.tipo
  let inviate = 0

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
        subject: oggetto,
        text: com.testo
      })
    })
    if (res.ok) inviate += 1
  }

  const stato = inviate > 0 ? 'inviata' : 'errore'
  await supabase.from('comunicazioni').update({
    stato,
    data_invio: new Date().toISOString()
  }).eq('id', com.id)

  return json({ ok: inviate > 0, n_destinatari: inviate })
})
