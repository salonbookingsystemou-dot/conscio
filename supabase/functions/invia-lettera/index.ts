// Edge Function: lettera settimanale e avviso del prossimo ciclo agli iscritti di «Restiamo in contatto».
// Solo facilitatore (JWT + is_facilitatore()). Secret: RESEND_API_KEY, opzionale RESEND_FROM.
// Legge solo iscritti_lettera: gli iscritti non sono partecipanti, nessun dato dello studio.
// Un'email per destinatario (mai CC o BCC), a blocchi di 100 con POST /emails/batch,
// ognuna con il link di uscita e gli header List-Unsubscribe (RFC 8058).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  emailLettera,
  headerUscita,
  REPLY_TO_LETTERA,
  type Lista
} from '../_shared/emailLettera.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

const BLOCCO = 100
// Il piano Resend accetta poche richieste al secondo: tra un blocco e l'altro si aspetta.
const PAUSA_MS = 600
// Nelle prove il link di uscita non tocca nessuna riga.
const TOKEN_PROVA = '00000000-0000-0000-0000-000000000000'

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

const attendi = (ms: number) => new Promise((r) => setTimeout(r, ms))

type Destinatario = { id: string; email: string; token_uscita: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'NON_AUTORIZZATO' }, 401)

  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const conSessione = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authHeader } }
  })
  const { data: isFac } = await conSessione.rpc('is_facilitatore')
  if (!isFac) return json({ error: 'NON_AUTORIZZATO' }, 401)

  const jwt = authHeader.replace(/^Bearer\s+/i, '')
  const { data: sessione } = await conSessione.auth.getUser(jwt)
  const facilitatore = sessione?.user

  let corpo: Record<string, unknown>
  try {
    corpo = await req.json()
  } catch {
    return json({ ok: false, motivo: 'CORPO_NON_VALIDO' })
  }

  const oggetto = typeof corpo.oggetto === 'string' ? corpo.oggetto.trim().slice(0, 200) : ''
  const testo = typeof corpo.corpo === 'string' ? corpo.corpo.trim().slice(0, 20000) : ''
  const prova = corpo.prova === true
  const lista: Lista = corpo.tipo === 'avviso_ciclo' ? 'avviso_ciclo' : 'lettera'
  const cicloId = typeof corpo.ciclo_id === 'string' ? corpo.ciclo_id.trim() : ''
  if (!oggetto || !testo) return json({ ok: false, motivo: 'TESTO_MANCANTE' })

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

  if (lista === 'avviso_ciclo') {
    // Il ciclo entra in un filtro di PostgREST: solo un uuid ben formato.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cicloId)) {
      return json({ ok: false, motivo: 'CICLO_NON_TROVATO' })
    }
    const { data: ciclo } = await admin
      .from('cicli')
      .select('id, stato')
      .eq('id', cicloId)
      .maybeSingle()
    if (!ciclo) return json({ ok: false, motivo: 'CICLO_NON_TROVATO' })
    if (ciclo.stato !== 'reclutamento' && !prova) return json({ ok: false, motivo: 'CICLO_NON_IN_RECLUTAMENTO' })
  }

  let destinatari: Destinatario[] = []
  if (prova) {
    const mia = facilitatore?.email
    if (!mia) return json({ ok: false, motivo: 'NESSUN_DESTINATARIO' })
    destinatari = [{ id: '', email: mia, token_uscita: TOKEN_PROVA }]
  } else {
    let q = admin
      .from('iscritti_lettera')
      .select('id, email, token_uscita')
      .eq('stato', 'confermato')
      .eq(lista, true)
    // Nessuno riceve due volte l'avviso dello stesso ciclo.
    if (lista === 'avviso_ciclo') q = q.or(`ultimo_ciclo_avvisato.is.null,ultimo_ciclo_avvisato.neq.${cicloId}`)
    const { data, error } = await q.order('creato_il')
    if (error) return json({ ok: false, motivo: 'DESTINATARI_NON_LEGGIBILI', errore: error.message })
    destinatari = (data || []) as Destinatario[]
  }

  if (destinatari.length === 0) return json({ ok: false, motivo: 'NESSUN_DESTINATARIO' })

  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) return json({ ok: false, motivo: 'RESEND_NON_CONFIGURATO', n_previsti: destinatari.length })

  const from = Deno.env.get('RESEND_FROM') || 'Percorso MBSR <noreply@mnesti.it>'
  const soggetto = prova ? `[Prova] ${oggetto}` : oggetto
  const riusciti: string[] = []
  let inviate = 0
  let falliti = 0
  const errori: string[] = []

  for (let i = 0; i < destinatari.length; i += BLOCCO) {
    if (i > 0) await attendi(PAUSA_MS)
    const blocco = destinatari.slice(i, i + BLOCCO)
    const email = blocco.map((d) => {
      const contenuto = emailLettera({ corpo: testo, tokenUscita: d.token_uscita, lista })
      return {
        from,
        to: [d.email],
        reply_to: REPLY_TO_LETTERA,
        subject: soggetto,
        text: contenuto.testo,
        html: contenuto.html,
        headers: headerUscita(url, d.token_uscita, lista)
      }
    })
    try {
      const res = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(email)
      })
      const risposta = await res.json().catch(() => null)
      if (res.ok) {
        inviate += blocco.length
        riusciti.push(...blocco.map((d) => d.id).filter(Boolean))
      } else {
        falliti += blocco.length
        errori.push(messaggioResend(risposta, res.status))
      }
    } catch (err) {
      falliti += blocco.length
      errori.push(err instanceof Error ? err.message : 'invio interrotto')
    }
  }

  if (!prova && inviate > 0) {
    if (lista === 'avviso_ciclo') {
      for (let i = 0; i < riusciti.length; i += 500) {
        await admin
          .from('iscritti_lettera')
          .update({ ultimo_ciclo_avvisato: cicloId })
          .in('id', riusciti.slice(i, i + 500))
      }
    }
    await admin.from('lettere_inviate').insert({
      tipo: lista,
      ciclo_id: lista === 'avviso_ciclo' ? cicloId : null,
      oggetto,
      corpo: testo,
      destinatari: inviate,
      falliti,
      inviata_da: facilitatore?.id ?? null
    })
  }

  return json({
    ok: inviate > 0,
    inviate,
    falliti,
    n_previsti: destinatari.length,
    motivo: inviate === 0 ? 'RESEND_ERRORE' : undefined,
    errore: errori[0]
  })
})
