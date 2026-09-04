// Porta unica per Entra, Iscrizione, recupero codice e Accedi facilitatore.
// Applica tetti tentativi per IP (hash) prima delle RPC / Auth.
// Richiede: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
// Opzionale per email codice: RESEND_API_KEY, RESEND_FROM.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { htmlConFirma, testoConFirma } from '../_shared/firmaEmail.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

const REPLY_TO = 'contact@wordpresschef.it'
const MSG_RECUPERA_OK =
  'Se l’indirizzo è presente in anagrafe con email ancora attiva, riceverai il codice a breve. Controlla anche lo spam.'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' }
  })
}

function ipDaRichiesta(req: Request): string {
  const xf = req.headers.get('x-forwarded-for')
  if (xf) {
    const primo = xf.split(',')[0]?.trim()
    if (primo) return primo
  }
  return (
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-real-ip') ||
    'sconosciuto'
  )
}

async function hashChiave(raw: string): Promise<string> {
  const data = new TextEncoder().encode(raw)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function messaggioErrore(err: { message?: string } | null): string {
  const testo = err?.message || ''
  if (testo.includes('TROPPI_TENTATIVI')) return 'TROPPI_TENTATIVI'
  if (testo.includes('CODA_ISCRIZIONI_PIENA')) return 'CODA_ISCRIZIONI_PIENA'
  if (testo.includes('CICLO_PIENO')) return 'CICLO_PIENO'
  if (testo.includes('EMAIL_GIA_ISCRITTA')) return 'EMAIL_GIA_ISCRITTA'
  if (testo.includes('CICLO_NON_DISPONIBILE')) return 'CICLO_NON_DISPONIBILE'
  if (testo.includes('CODICE_DUPLICATO')) return 'CODICE_DUPLICATO'
  if (testo.includes('CONSENSO_A_OBBLIGATORIO')) return 'CONSENSO_A_OBBLIGATORIO'
  if (testo.includes('EMAIL_MANCANTE')) return 'EMAIL_MANCANTE'
  if (testo.includes('CODICE_MANCANTE')) return 'CODICE_MANCANTE'
  return 'ERRORE'
}

function emailValida(email: string): boolean {
  if (!email || email.length > 200) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/** Evita che % e _ in ilike diventino jolly SQL. */
function escapeIlike(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

async function inviaEmail(opts: {
  to: string
  oggetto: string
  testo: string
  replyTo?: string
}): Promise<boolean> {
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
        reply_to: opts.replyTo || REPLY_TO,
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

function inviaCodiceEmail(opts: {
  to: string
  codice: string
  oggetto: string
  testo: string
}): Promise<boolean> {
  return inviaEmail({
    to: opts.to,
    oggetto: opts.oggetto,
    testo: opts.testo
  })
}

function testoRecupero(codice: string): string {
  return [
    'Ciao,',
    '',
    'Hai chiesto di ricevere di nuovo il tuo codice partecipante per il Percorso MBSR.',
    '',
    `Il tuo codice è: ${codice}`,
    '',
    'Usalo nella pagina Entra dell’app. Conservalo in un posto sicuro.',
    'Se non hai fatto tu questa richiesta, puoi ignorare questo messaggio.',
    '',
    `Per assistenza: ${REPLY_TO}`,
    '',
    '— Percorso MBSR'
  ].join('\n')
}

function testoIscrizione(codice: string): string {
  return [
    'Ciao,',
    '',
    'La tua iscrizione al Percorso MBSR è stata registrata.',
    '',
    `Il tuo codice partecipante è: ${codice}`,
    '',
    'Conservalo: ti servirà per entrare nell’app dopo lo screening.',
    'Non condividiamo il tuo nome: nel percorso ti riconosci solo con questo codice.',
    '',
    `Per assistenza: ${REPLY_TO}`,
    '',
    '— Percorso MBSR'
  ].join('\n')
}

function testoAvvisoIscrizione(opts: {
  email: string
  codice: string
  soloRemoto: boolean
  nomeCiclo: string | null
}): string {
  const destinazione = opts.soloRemoto
    ? 'Modalità: solo da remoto (non collegato a un ciclo)'
    : opts.nomeCiclo
      ? `Ciclo: ${opts.nomeCiclo}`
      : 'Ciclo: in presenza'
  return [
    'Nuova iscrizione al Percorso MBSR.',
    '',
    `Email: ${opts.email}`,
    `Codice: ${opts.codice}`,
    destinazione,
    '',
    'Lo screening si gestisce dalla dashboard.',
    '',
    '— App Conscio'
  ].join('\n')
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

  const admin = createClient(url, serviceKey)
  const chiaveIp = await hashChiave(ipDaRichiesta(req))

  let corpo: Record<string, unknown>
  try {
    corpo = await req.json()
  } catch {
    return json({ error: 'CORPO_NON_VALIDO' }, 400)
  }

  const azione = typeof corpo.azione === 'string' ? corpo.azione : ''

  async function limita(azioneLimite: string, chiave: string, max: number, secondi: number) {
    const { error } = await admin.rpc('assert_limite', {
      p_azione: azioneLimite,
      p_chiave: chiave,
      p_max: max,
      p_secondi: secondi
    })
    if (error) {
      const codice = messaggioErrore(error)
      if (codice === 'TROPPI_TENTATIVI') return json({ error: 'TROPPI_TENTATIVI' }, 429)
      return json({ error: codice }, 400)
    }
    return null
  }

  if (azione === 'stato') {
    const blocco = await limita('entra', chiaveIp, 20, 900)
    if (blocco) return blocco

    const codice = typeof corpo.codice === 'string' ? corpo.codice.trim() : ''
    if (!codice) return json({ error: 'CODICE_MANCANTE' }, 400)

    const { data, error } = await admin.rpc('stato_accesso_codice', { p_codice: codice })
    if (error) return json({ error: messaggioErrore(error) }, 400)
    return json({ stato: data || 'non_trovato' })
  }

  if (azione === 'iscrivi') {
    const honeypot = typeof corpo.sito_web === 'string' ? corpo.sito_web.trim() : ''
    if (honeypot) return json({ error: 'ERRORE' }, 400)

    const bloccoOra = await limita('iscrivi_ora', chiaveIp, 3, 3600)
    if (bloccoOra) return bloccoOra
    const bloccoGiorno = await limita('iscrivi_giorno', chiaveIp, 10, 86400)
    if (bloccoGiorno) return bloccoGiorno

    const email = typeof corpo.email === 'string' ? corpo.email.trim() : ''
    const ciclo_id = typeof corpo.ciclo_id === 'string' ? corpo.ciclo_id.trim() : ''
    const codice = typeof corpo.codice === 'string' ? corpo.codice.trim() : ''
    const consenso_a = Boolean(corpo.consenso_a)
    const consenso_b = Boolean(corpo.consenso_b)
    const solo_remoto = Boolean(corpo.solo_remoto)

    const { data, error } = await admin.rpc('iscrivi_partecipante', {
      p_email: email,
      p_ciclo_id: solo_remoto || !ciclo_id ? null : ciclo_id,
      p_codice: codice,
      p_consenso_a: consenso_a,
      p_consenso_b: consenso_b,
      p_solo_remoto: solo_remoto
    })
    if (error) {
      const codiceErr = messaggioErrore(error)
      const status = codiceErr === 'TROPPI_TENTATIVI' ? 429 : 400
      return json({ error: codiceErr }, status)
    }

    const assegnato =
      data && typeof data === 'object' && 'codice' in data && typeof (data as { codice: unknown }).codice === 'string'
        ? (data as { codice: string }).codice
        : codice
    if (emailValida(email) && assegnato) {
      let nomeCiclo: string | null = null
      if (!solo_remoto && ciclo_id) {
        const { data: ciclo } = await admin
          .from('cicli')
          .select('nome_ciclo')
          .eq('id', ciclo_id)
          .maybeSingle()
        nomeCiclo = typeof ciclo?.nome_ciclo === 'string' ? ciclo.nome_ciclo : null
      }
      // Best effort: l’iscrizione resta valida anche se Resend fallisce.
      await Promise.all([
        inviaCodiceEmail({
          to: email,
          codice: assegnato,
          oggetto: 'Il tuo codice partecipante — Percorso MBSR',
          testo: testoIscrizione(assegnato)
        }),
        inviaEmail({
          to: REPLY_TO,
          oggetto: solo_remoto
            ? 'Nuova iscrizione — solo da remoto'
            : 'Nuova iscrizione — Percorso MBSR',
          testo: testoAvvisoIscrizione({
            email,
            codice: assegnato,
            soloRemoto: solo_remoto,
            nomeCiclo
          }),
          replyTo: email
        })
      ])
    }

    return json(data ?? { ok: true })
  }

  if (azione === 'recupera') {
    const honeypot = typeof corpo.sito_web === 'string' ? corpo.sito_web.trim() : ''
    if (honeypot) return json({ ok: true, messaggio: MSG_RECUPERA_OK })

    const emailRaw = typeof corpo.email === 'string' ? corpo.email.trim().toLowerCase() : ''
    if (!emailValida(emailRaw)) return json({ error: 'EMAIL_MANCANTE' }, 400)

    const bloccoIp = await limita('recupera_ip', chiaveIp, 5, 3600)
    if (bloccoIp) return bloccoIp
    const chiaveEmail = await hashChiave(`recupera:${emailRaw}`)
    const bloccoEmail = await limita('recupera_email', chiaveEmail, 3, 86400)
    if (bloccoEmail) return bloccoEmail

    // Risposta sempre uguale: niente enumerazione email ↔ codice a schermo.
    const { data: trovati } = await admin
      .from('utenti')
      .select('codice_partecipante, email')
      .eq('ruolo', 'partecipante')
      .ilike('email', escapeIlike(emailRaw))
      .not('email', 'is', null)
      .limit(3)

    const match = (trovati || []).find(
      (u: { email?: string | null; codice_partecipante?: string | null }) =>
        (u.email || '').trim().toLowerCase() === emailRaw && Boolean(u.codice_partecipante)
    )

    if (match?.codice_partecipante) {
      await inviaCodiceEmail({
        to: emailRaw,
        codice: match.codice_partecipante,
        oggetto: 'Recupero codice partecipante — Percorso MBSR',
        testo: testoRecupero(match.codice_partecipante)
      })
    }

    return json({ ok: true, messaggio: MSG_RECUPERA_OK })
  }

  if (azione === 'facilitatore') {
    const email = typeof corpo.email === 'string' ? corpo.email.trim().toLowerCase() : ''
    const password = typeof corpo.password === 'string' ? corpo.password : ''
    if (!email || !password) return json({ error: 'CREDENZIALI_MANCANTI' }, 400)

    const chiaveEmail = await hashChiave(`email:${email}`)
    const bloccoIp = await limita('fac_ip', chiaveIp, 15, 900)
    if (bloccoIp) return bloccoIp
    const bloccoEmail = await limita('fac_email', chiaveEmail, 5, 900)
    if (bloccoEmail) return bloccoEmail

    const anon = createClient(url, anonKey)
    const { data, error } = await anon.auth.signInWithPassword({ email, password })
    if (error || !data.session) {
      return json({ error: 'ACCESSO_NON_RIUSCITO' }, 401)
    }

    return json({
      ok: true,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
        expires_in: data.session.expires_in,
        token_type: data.session.token_type,
        user: data.session.user
      }
    })
  }

  if (azione === 'prova_firma') {
    const blocco = await limita('prova_firma', chiaveIp, 3, 3600)
    if (blocco) return blocco
    const ok = await inviaEmail({
      to: REPLY_TO,
      oggetto: 'Prova firma — Percorso MBSR',
      testo: [
        'Questa è una prova di invio.',
        '',
        'Se la leggi, le notifiche operative sono collegate e in calce vedi la firma con l’icona dell’app.'
      ].join('\n')
    })
    if (!ok) return json({ error: 'INVIO_NON_RIUSCITO' }, 502)
    return json({ ok: true, destinatario: REPLY_TO })
  }

  return json({ error: 'AZIONE_NON_VALIDA' }, 400)
})
