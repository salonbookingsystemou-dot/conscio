// Edge Function: lettera settimanale e avviso del prossimo ciclo agli iscritti di «Restiamo in contatto».
// Secret: RESEND_API_KEY, opzionale RESEND_FROM, CRON_SECRET (per l'invio automatico).
// Legge solo iscritti_lettera: gli iscritti non sono partecipanti, nessun dato dello studio.
// Un'email per destinatario (mai CC o BCC), a blocchi di 100 con POST /emails/batch,
// ognuna con il link di uscita e gli header List-Unsubscribe (RFC 8058).
//
// Tre modi:
// 1. Facilitatore, testo scritto a mano: { oggetto, corpo, prova?, tipo?, ciclo_id? } (come prima).
// 2. Facilitatore, bozza dell'agente: { bozza_id, prova? } («Invia ora» e «Invia una prova a me» della scheda).
// 3. Job del giovedì: header x-cron-secret = CRON_SECRET e { bozza_id }. Solo questo, solo una bozza
//    programmata e scaduta, solo con l'invio automatico acceso (docs/brief_agente_lettera.md, sez. 4).

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  emailLettera,
  headerUscita,
  linkUscita,
  LISTE,
  REPLY_TO_LETTERA,
  SITO,
  type Lista
} from '../_shared/emailLettera.ts'
import { composiLettera, type BozzaLettera, type InvitoPercorso } from '../_shared/letteraSettimanale.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret'
}

const BLOCCO = 100
// Il piano Resend accetta poche richieste al secondo: tra un blocco e l'altro si aspetta.
const PAUSA_MS = 600
// Nelle prove il link di uscita non tocca nessuna riga.
const TOKEN_PROVA = '00000000-0000-0000-0000-000000000000'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

function stessoSegreto(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

const attendi = (ms: number) => new Promise((r) => setTimeout(r, ms))

type Destinatario = { id: string; email: string; token_uscita: string }
type Contenuto = { oggetto: string; testo: string; html: string }

/** Spedisce a blocchi, un'email per persona. */
async function spedisci(
  destinatari: Destinatario[],
  lista: Lista,
  supabaseUrl: string,
  contenutoPer: (d: Destinatario) => Contenuto
) {
  const apiKey = Deno.env.get('RESEND_API_KEY') ?? ''
  const from = Deno.env.get('RESEND_FROM') || 'Percorso MBSR <noreply@mnesti.it>'
  const riusciti: string[] = []
  let inviate = 0
  let falliti = 0
  const errori: string[] = []
  for (let i = 0; i < destinatari.length; i += BLOCCO) {
    if (i > 0) await attendi(PAUSA_MS)
    const blocco = destinatari.slice(i, i + BLOCCO)
    const email = blocco.map((d) => {
      const c = contenutoPer(d)
      return {
        from,
        to: [d.email],
        reply_to: REPLY_TO_LETTERA,
        subject: c.oggetto,
        text: c.testo,
        html: c.html,
        headers: headerUscita(supabaseUrl, d.token_uscita, lista)
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
  return { inviate, falliti, riusciti, errori }
}

async function iscrittiDellaLista(admin: SupabaseClient, lista: Lista, cicloId = '') {
  let q = admin
    .from('iscritti_lettera')
    .select('id, email, token_uscita')
    .eq('stato', 'confermato')
    .eq(lista, true)
  // Nessuno riceve due volte l'avviso dello stesso ciclo.
  if (lista === 'avviso_ciclo') q = q.or(`ultimo_ciclo_avvisato.is.null,ultimo_ciclo_avvisato.neq.${cicloId}`)
  return await q.order('creato_il')
}

async function invitoPercorso(admin: SupabaseClient): Promise<InvitoPercorso | null> {
  const { data } = await admin.rpc('vetrina_impostazioni')
  if (!data) return null
  return { titolo: data.cta_titolo, testo: data.iscrizioni_aperte ? data.cta_testo : data.cta_testo_senza_ciclo }
}

/** Modi 2 e 3: la lettera composta dalla bozza dell'agente. */
async function inviaBozza(opts: {
  admin: SupabaseClient
  supabaseUrl: string
  bozzaId: string
  daCron: boolean
  prova: boolean
  facilitatore: { id?: string; email?: string } | null
}) {
  const { admin, supabaseUrl, bozzaId, daCron, prova, facilitatore } = opts
  if (!UUID.test(bozzaId)) return json({ ok: false, motivo: 'BOZZA_NON_TROVATA' })
  if (!Deno.env.get('RESEND_API_KEY')) return json({ ok: false, motivo: 'RESEND_NON_CONFIGURATO' })

  const campi = 'id, settimana, oggetto, introduzione, voci, meditazione, pratica_settimana, stato, invio_previsto_il'

  if (prova) {
    const { data: bozza } = await admin.from('bozze_lettera').select(campi).eq('id', bozzaId).maybeSingle()
    if (!bozza) return json({ ok: false, motivo: 'BOZZA_NON_TROVATA' })
    if (!facilitatore?.email) return json({ ok: false, motivo: 'NESSUN_DESTINATARIO' })
    const invito = await invitoPercorso(admin)
    const esito = await spedisci([{ id: '', email: facilitatore.email, token_uscita: TOKEN_PROVA }], 'lettera', supabaseUrl, (d) => {
      const c = composiLettera({ bozza: bozza as BozzaLettera, invito, linkUscita: linkUscita(d.token_uscita, 'lettera'), perche: LISTE.lettera.perche })
      return { ...c, oggetto: `[Prova] ${c.oggetto}` }
    })
    return json({ ok: esito.inviate > 0, inviate: esito.inviate, falliti: esito.falliti, motivo: esito.inviate === 0 ? 'RESEND_ERRORE' : undefined, errore: esito.errori[0] })
  }

  if (daCron) {
    const { data: imp } = await admin.from('impostazioni_sito').select('invio_automatico').eq('id', 1).maybeSingle()
    if (imp?.invio_automatico === false) return json({ ok: false, motivo: 'INVIO_AUTOMATICO_SPENTO' })
  }

  // Passaggio atomico: se la bozza è stata bloccata, rimessa da rivedere o è già partita, non si invia nulla.
  // Così il job può ripartire senza doppi invii.
  let q = admin.from('bozze_lettera').update({ stato: 'in_invio' }).eq('id', bozzaId)
  q = daCron
    ? q.eq('stato', 'programmata').lte('invio_previsto_il', new Date().toISOString())
    : q.in('stato', ['programmata', 'da_rivedere', 'bloccata'])
  const { data: prese, error: errPresa } = await q.select(campi)
  if (errPresa) return json({ ok: false, motivo: 'BOZZA_NON_LEGGIBILE', errore: errPresa.message })
  const bozza = prese?.[0] as (BozzaLettera & { id: string; stato: string }) | undefined
  if (!bozza) return json({ ok: false, motivo: 'NON_PROGRAMMATA' })

  // Una sola lettera a settimana.
  const { data: gia } = await admin
    .from('bozze_lettera')
    .select('id')
    .eq('settimana', bozza.settimana)
    .eq('stato', 'inviata')
    .neq('id', bozza.id)
  if (gia && gia.length) {
    await admin.from('bozze_lettera').update({ stato: 'da_rivedere', motivo_fermo: 'Questa settimana è già partita una lettera.' }).eq('id', bozza.id)
    return json({ ok: false, motivo: 'GIA_INVIATA' })
  }

  if (!bozza.voci?.length || !bozza.oggetto?.trim()) {
    await admin.from('bozze_lettera').update({ stato: 'da_rivedere', motivo_fermo: 'Mancano oggetto o notizie.' }).eq('id', bozza.id)
    return json({ ok: false, motivo: 'BOZZA_INCOMPLETA' })
  }

  const { data: iscritti, error } = await iscrittiDellaLista(admin, 'lettera')
  if (error) {
    await admin.from('bozze_lettera').update({ stato: daCron ? 'programmata' : 'da_rivedere' }).eq('id', bozza.id)
    return json({ ok: false, motivo: 'DESTINATARI_NON_LEGGIBILI', errore: error.message })
  }
  const destinatari = (iscritti || []) as Destinatario[]
  if (!destinatari.length) {
    await admin.from('bozze_lettera').update({ stato: 'da_rivedere', motivo_fermo: 'Nessun iscritto confermato alla lettera.' }).eq('id', bozza.id)
    return json({ ok: false, motivo: 'NESSUN_DESTINATARIO' })
  }

  const invito = await invitoPercorso(admin)
  const esito = await spedisci(destinatari, 'lettera', supabaseUrl, (d) =>
    composiLettera({ bozza, invito, linkUscita: linkUscita(d.token_uscita, 'lettera'), perche: LISTE.lettera.perche })
  )

  if (esito.inviate === 0) {
    await admin
      .from('bozze_lettera')
      .update({ stato: 'da_rivedere', motivo_fermo: `Invio non riuscito: ${esito.errori[0] || 'errore del servizio email'}` })
      .eq('id', bozza.id)
    return json({ ok: false, motivo: 'RESEND_ERRORE', falliti: esito.falliti, errore: esito.errori[0] })
  }

  // In archivio la versione testo, con un link di uscita generico al posto di quello personale.
  const archivio = composiLettera({ bozza, invito, linkUscita: `${SITO}/#/lettera/esci`, perche: LISTE.lettera.perche })
  const { data: inviata } = await admin
    .from('lettere_inviate')
    .insert({
      tipo: 'lettera',
      oggetto: bozza.oggetto,
      corpo: archivio.testo,
      destinatari: esito.inviate,
      falliti: esito.falliti,
      inviata_da: daCron ? null : facilitatore?.id ?? null
    })
    .select('id')
    .single()
  await admin
    .from('bozze_lettera')
    .update({ stato: 'inviata', lettera_inviata_id: inviata?.id ?? null, motivo_fermo: null })
    .eq('id', bozza.id)

  return json({
    ok: true,
    inviate: esito.inviate,
    falliti: esito.falliti,
    n_previsti: destinatari.length,
    errore: esito.errori[0]
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

  let corpo: Record<string, unknown>
  try {
    corpo = await req.json()
  } catch {
    return json({ ok: false, motivo: 'CORPO_NON_VALIDO' })
  }
  const bozzaId = typeof corpo.bozza_id === 'string' ? corpo.bozza_id.trim() : ''

  // Modo 3: il job del giovedì. Il segreto vale solo insieme a una bozza.
  const cronRicevuto = req.headers.get('x-cron-secret') || ''
  if (cronRicevuto) {
    if (!stessoSegreto(cronRicevuto, Deno.env.get('CRON_SECRET') || '') || !bozzaId) {
      return json({ error: 'NON_AUTORIZZATO' }, 401)
    }
    return await inviaBozza({ admin, supabaseUrl: url, bozzaId, daCron: true, prova: false, facilitatore: null })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'NON_AUTORIZZATO' }, 401)
  const conSessione = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authHeader } }
  })
  const { data: isFac } = await conSessione.rpc('is_facilitatore')
  if (!isFac) return json({ error: 'NON_AUTORIZZATO' }, 401)

  const jwt = authHeader.replace(/^Bearer\s+/i, '')
  const { data: sessione } = await conSessione.auth.getUser(jwt)
  const facilitatore = sessione?.user ?? null

  const prova = corpo.prova === true

  // Modo 2: la bozza dell'agente, inviata a mano dalla scheda.
  if (bozzaId) {
    return await inviaBozza({ admin, supabaseUrl: url, bozzaId, daCron: false, prova, facilitatore })
  }

  // Modo 1: testo scritto a mano.
  const oggetto = typeof corpo.oggetto === 'string' ? corpo.oggetto.trim().slice(0, 200) : ''
  const testo = typeof corpo.corpo === 'string' ? corpo.corpo.trim().slice(0, 20000) : ''
  const lista: Lista = corpo.tipo === 'avviso_ciclo' ? 'avviso_ciclo' : 'lettera'
  const cicloId = typeof corpo.ciclo_id === 'string' ? corpo.ciclo_id.trim() : ''
  if (!oggetto || !testo) return json({ ok: false, motivo: 'TESTO_MANCANTE' })

  if (lista === 'avviso_ciclo') {
    // Il ciclo entra in un filtro di PostgREST: solo un uuid ben formato.
    if (!UUID.test(cicloId)) return json({ ok: false, motivo: 'CICLO_NON_TROVATO' })
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
    const { data, error } = await iscrittiDellaLista(admin, lista, cicloId)
    if (error) return json({ ok: false, motivo: 'DESTINATARI_NON_LEGGIBILI', errore: error.message })
    destinatari = (data || []) as Destinatario[]
  }

  if (destinatari.length === 0) return json({ ok: false, motivo: 'NESSUN_DESTINATARIO' })
  if (!Deno.env.get('RESEND_API_KEY')) return json({ ok: false, motivo: 'RESEND_NON_CONFIGURATO', n_previsti: destinatari.length })

  const soggetto = prova ? `[Prova] ${oggetto}` : oggetto
  const { inviate, falliti, riusciti, errori } = await spedisci(destinatari, lista, url, (d) => {
    const c = emailLettera({ corpo: testo, tokenUscita: d.token_uscita, lista })
    return { oggetto: soggetto, testo: c.testo, html: c.html }
  })

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
