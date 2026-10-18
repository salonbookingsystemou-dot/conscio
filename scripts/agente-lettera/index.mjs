#!/usr/bin/env node
// Agente redazionale della lettera settimanale (docs/brief_agente_lettera.md).
//
//   node scripts/agente-lettera/index.mjs genera [--asciutto] [--forza]
//   node scripts/agente-lettera/index.mjs invia
//
// genera: raccoglie, smista, sceglie, scrive, verifica, controlla e salva la bozza della settimana;
//         se tutti i controlli passano la programma per le 17:00 (ora italiana) e avvisa Dimitri.
//         --asciutto: niente scritture nel database né email; bozza e anteprima in scripts/agente-lettera/uscita/.
//         --forza: rifà la bozza anche se è già programmata (mai se è già partita).
// invia:  chiede a invia-lettera di spedire la bozza programmata della settimana (con x-cron-secret).
//
// Variabili: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, RESEND_FROM,
// FACILITATORE_EMAIL, CRON_SECRET.

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { composiLettera } from '../../supabase/functions/_shared/letteraSettimanale.ts'
import { MAX_CARATTERI_PAGINA, MIN_VOCI } from './config.mjs'
import { controllaBozza } from './controlli.mjs'
import { meditazioneDaTraccia, preparaMiniatura, scegliMeditazione } from './meditazione.mjs'
import { nuovoConto } from './modello.mjs'
import { componiNotifica, inviaNotifica } from './notifica.mjs'
import { scrivi, seleziona, smista, verifica } from './passi.mjs'
import { daiFeed, daPubmed, daRicercaWeb, leggiPagina, rispondeOk } from './raccogli.mjs'
import { clientSupabase, hashGiaVisti } from './supabase.mjs'
import { hashUrl } from './hash.mjs'
import { invioPrevisto, leggiParoleVietate, lunediDi, normalizzaUrl, oggiItalia } from './testi.mjs'

const QUI = dirname(fileURLToPath(import.meta.url))
const env = process.env
const log = (...a) => console.log('[lettera]', ...a)

function senzaCampiInterni(voci) {
  return voci.map(({ _testo, ...v }) => v)
}

/** Toglie i duplicati (stesso URL normalizzato o stesso titolo) e ciò che è già uscito o è stato scartato. */
export function pulisciCandidati(candidati, giaVisti) {
  const urlVisti = new Set()
  const titoliVisti = new Set()
  const fuori = []
  for (const c of candidati) {
    const url = normalizzaUrl(c.url)
    if (!url) continue
    const titolo = c.titolo.toLowerCase().replace(/\W+/g, ' ').trim()
    const hash = hashUrl(url)
    if (urlVisti.has(url) || titoliVisti.has(titolo) || giaVisti.has(hash)) continue
    urlVisti.add(url)
    titoliVisti.add(titolo)
    fuori.push({ ...c, url, hash })
  }
  return fuori
}

async function genera({ asciutto, forza }) {
  const ora = new Date()
  const oggi = oggiItalia(ora)
  const settimana = lunediDi(ora)
  const conto = nuovoConto()
  const errori = []
  const linea = await readFile(join(QUI, 'prompt', 'linea_editoriale.md'), 'utf8')
  const paroleVietate = leggiParoleVietate(await readFile(join(QUI, 'prompt', 'parole_vietate.txt'), 'utf8'))
  const db = clientSupabase({ url: env.SUPABASE_URL, chiave: env.SUPABASE_SERVICE_ROLE_KEY })
  const chiave = env.ANTHROPIC_API_KEY
  if (!chiave) throw new Error('ANTHROPIC_API_KEY mancante')

  const [esistente] = await db.seleziona('bozze_lettera', `select=id,stato&settimana=eq.${settimana}`)
  if (esistente && ['in_invio', 'inviata'].includes(esistente.stato)) {
    log(`la lettera della settimana ${settimana} è già ${esistente.stato}: niente da fare`)
    return
  }
  if (esistente && !forza && ['programmata', 'bloccata'].includes(esistente.stato)) {
    log(`la bozza della settimana ${settimana} è ${esistente.stato}: per rifarla usa --forza`)
    return
  }

  // 1. Raccolta
  const fonti = await db.seleziona('fonti_lettera', 'select=*')
  const [feed, pubmed, web] = await Promise.all([
    daiFeed(fonti, oggi, log),
    daPubmed(fonti, log),
    daRicercaWeb({ fonti, oggi, conto, chiave, log })
  ])
  const grezzi = [...feed.candidati, ...pubmed.candidati, ...web.candidati]
  log(`candidati: ${grezzi.length} (feed ${feed.candidati.length}, PubMed ${pubmed.candidati.length}, ricerca ${web.candidati.length})`)

  // 2. Pulizia
  const giaVisti = await hashGiaVisti(db, grezzi.map((c) => hashUrl(c.url)))
  const candidati = pulisciCandidati(grezzi, giaVisti)
  log(`dopo la pulizia: ${candidati.length}`)

  // 3–4. Smistamento e selezione
  let scartati = []
  let voci = []
  let oggetto = ''
  let introduzione = ''
  let notaSelezione = ''
  let riserve = []
  // Un errore del modello o un tetto superato non buttano via il lavoro: la bozza si salva ferma, con il motivo.
  try {
  if (candidati.length) {
    const s = await smista({ candidati, linea, conto, chiave })
    scartati = s.scartati
    log(`pertinenti: ${s.pertinenti.length}`)
    if (s.pertinenti.length) {
      const sel = await seleziona({ pertinenti: s.pertinenti, linea, conto, chiave })
      notaSelezione = sel.nota
      riserve = sel.riserve
      // 5. Lettura e scrittura
      for (const n of [...sel.scelte, ...sel.riserve]) {
        const p = await leggiPagina(n.url, MAX_CARATTERI_PAGINA)
        n.testo = p.testo
        n.stato_http = p.stato
      }
      const leggibili = sel.scelte.filter((n) => n.testo)
      for (const n of sel.scelte.filter((x) => !x.testo)) scartati.push({ ...n, motivo: `pagina non leggibile (${n.stato_http})` })
      if (leggibili.length) {
        const w = await scrivi({ notizie: leggibili, linea, conto, chiave })
        oggetto = w.oggetto
        introduzione = w.introduzione
        // 6. Verifica, con una riserva al posto di ogni voce dubbia (una volta sola)
        voci = await verifica({ voci: w.voci, linea, conto, chiave })
        const dubbie = voci.filter((v) => v.verifica !== 'verificata')
        const disponibili = riserve.filter((r) => r.testo)
        if (dubbie.length && disponibili.length) {
          const sostitute = disponibili.slice(0, dubbie.length)
          const r = await scrivi({ notizie: sostitute, linea, conto, chiave, soloVoci: true })
          const verificate = await verifica({ voci: r.voci, linea, conto, chiave })
          for (const d of dubbie) scartati.push({ url: d.url, titolo: d.titolo, fonte: d.fonte, data: d.data, motivo: `verifica: ${d.nota_verifica}` })
          voci = [...voci.filter((v) => v.verifica === 'verificata'), ...verificate]
        }
      }
    }
  }
  } catch (err) {
    errori.push(err.name === 'TettoSuperato' ? err.message : `${err.message || err}`)
    log(`preparazione interrotta: ${err.message || err}`)
  }
  voci = voci.sort((a, b) => ['italia', 'mondo', 'ricerca', 'eventi'].indexOf(a.sezione) - ['italia', 'mondo', 'ricerca', 'eventi'].indexOf(b.sezione))

  // Meditazione della settimana: a caso dalla vetrina, non quella della volta scorsa
  let meditazione = null
  try {
    const elenco = await db.rpc('vetrina_elenco')
    const [precedente] = await db.seleziona('bozze_lettera', `select=meditazione&settimana=lt.${settimana}&order=settimana.desc&limit=1`)
    const scelta = scegliMeditazione(elenco, precedente?.meditazione?.slug)
    if (scelta) meditazione = await preparaMiniatura(meditazioneDaTraccia(scelta), db, log)
  } catch (err) {
    errori.push(`meditazione: ${err.message || err}`)
  }

  // 7. Controlli
  const linkOk = {}
  for (const v of voci) linkOk[v.url] = await rispondeOk(v.url)
  const [impostazioni] = await db.seleziona('impostazioni_sito', 'select=invio_automatico&id=eq.1')
  const giaInviate = await db.seleziona('bozze_lettera', `select=id&settimana=eq.${settimana}&stato=in.(in_invio,inviata)`)
  const bozza = {
    settimana,
    oggetto: oggetto || `La lettera di Conscio · settimana del ${settimana}`,
    introduzione,
    voci: senzaCampiInterni(voci),
    meditazione,
    pratica_settimana: null
  }
  const esito = controllaBozza(
    { ...bozza, oggetto },
    { oggi, linkOk, paroleVietate, errori, invioAutomatico: impostazioni?.invio_automatico !== false, giaInviata: giaInviate.length > 0 }
  )
  if (voci.length < MIN_VOCI && notaSelezione) esito.motivi.push(`Nota della selezione: ${notaSelezione}`)
  const programmata = esito.ok
  const riga = {
    ...bozza,
    stato: programmata ? 'programmata' : 'da_rivedere',
    invio_previsto_il: programmata ? invioPrevisto(ora).toISOString() : null,
    motivo_fermo: programmata ? null : esito.motivi.join('\n'),
    resoconto: {
      generata_il: ora.toISOString(),
      candidati: grezzi.length,
      dopo_pulizia: candidati.length,
      scartati: scartati.length,
      fonti: [...feed.esiti, ...pubmed.esiti, ...web.esiti],
      nota_selezione: notaSelezione,
      controlli: esito.motivi,
      errori,
      ...conto.riassunto()
    }
  }
  log(`esito: ${riga.stato}${programmata ? ` per le ${riga.invio_previsto_il}` : ''} · costo stimato ${conto.costo.toFixed(3)} USD`)
  if (!programmata) for (const m of esito.motivi) log(`  - ${m}`)

  const invito = await leggiInvito(db).catch(() => null)
  if (asciutto) {
    const dir = join(QUI, 'uscita')
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'bozza.json'), JSON.stringify({ ...riga, scartati }, null, 2))
    const anteprima = composiLettera({ bozza: riga, invito, linkUscita: 'https://conscio.mnesti.it/#/lettera/esci' })
    await writeFile(join(dir, 'anteprima.html'), anteprima.html)
    log(`prova a secco: bozza e anteprima in ${dir}`)
    return
  }

  const [salvata] = await db.inserisci('bozze_lettera', [riga], 'settimana')
  const notizie = [
    ...voci.map((v) => ({ url_hash: hashUrl(v.url), url: v.url, titolo: v.titolo, fonte: v.fonte, pubblicata_il: v.data, esito: 'usata', motivo: null, bozza_id: salvata.id })),
    ...scartati.filter((c) => c.url).map((c) => ({ url_hash: hashUrl(c.url), url: normalizzaUrl(c.url), titolo: c.titolo, fonte: c.fonte, pubblicata_il: c.data, esito: 'scartata', motivo: String(c.motivo || '').slice(0, 300), bozza_id: salvata.id }))
  ]
  const unici = [...new Map(notizie.map((n) => [n.url_hash, n])).values()]
  if (unici.length) await db.inserisci('notizie_lettera', unici, 'url_hash')
  await db.rpc('pulisci_notizie_lettera').catch((e) => log(`pulizia notizie: ${e.message}`))

  await inviaNotifica({
    apiKey: env.RESEND_API_KEY,
    da: env.RESEND_FROM || 'Conscio <noreply@mnesti.it>',
    a: env.FACILITATORE_EMAIL,
    contenuto: componiNotifica({ esito: riga.stato, bozza: { ...riga, id: salvata.id }, motivi: esito.motivi, invito }),
    log
  })
}

export const generaPerProva = genera

async function leggiInvito(db) {
  const imp = await db.rpc('vetrina_impostazioni')
  if (!imp) return null
  return { titolo: imp.cta_titolo, testo: imp.iscrizioni_aperte ? imp.cta_testo : imp.cta_testo_senza_ciclo }
}

async function invia() {
  const settimana = lunediDi(new Date())
  const db = clientSupabase({ url: env.SUPABASE_URL, chiave: env.SUPABASE_SERVICE_ROLE_KEY })
  const [bozza] = await db.seleziona('bozze_lettera', `select=id,stato,invio_previsto_il&settimana=eq.${settimana}`)
  if (!bozza) return log(`nessuna lettera per la settimana ${settimana}`)
  if (bozza.stato !== 'programmata') return log(`lettera della settimana ${settimana}: ${bozza.stato}, non parte da sola`)
  if (!env.CRON_SECRET) throw new Error('CRON_SECRET mancante')
  const res = await fetch(`${db.base}/functions/v1/invia-lettera`, {
    method: 'POST',
    // La funzione decide da sé con x-cron-secret; l'Authorization serve solo a passare il controllo JWT del gateway.
    headers: {
      'Content-Type': 'application/json',
      'x-cron-secret': env.CRON_SECRET,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: env.SUPABASE_SERVICE_ROLE_KEY
    },
    body: JSON.stringify({ bozza_id: bozza.id }),
    signal: AbortSignal.timeout(300_000)
  })
  const corpo = await res.json().catch(() => ({}))
  log(`invia-lettera: ${res.status} ${JSON.stringify(corpo)}`)
  if (!res.ok || corpo.ok === false) {
    // Bloccata, già partita nel frattempo o invio automatico spento: niente da fare.
    if (['NON_PROGRAMMATA', 'INVIO_AUTOMATICO_SPENTO'].includes(corpo.motivo)) return
    throw new Error(`invio non riuscito: ${corpo.motivo || res.status} ${corpo.errore || ''}`.trim())
  }
}

async function principale() {
  const [comando, ...resto] = process.argv.slice(2)
  const asciutto = resto.includes('--asciutto')
  const forza = resto.includes('--forza')
  try {
    if (comando === 'genera') await genera({ asciutto, forza })
    else if (comando === 'invia') await invia()
    else {
      console.error('Uso: index.mjs genera [--asciutto] [--forza] | invia')
      process.exitCode = 2
    }
  } catch (err) {
    console.error('[lettera] errore:', err)
    process.exitCode = 1
    if (!asciutto) {
      await inviaNotifica({
        apiKey: env.RESEND_API_KEY,
        da: env.RESEND_FROM || 'Conscio <noreply@mnesti.it>',
        a: env.FACILITATORE_EMAIL,
        contenuto: componiNotifica({ esito: 'errore', errore: `${comando}: ${err.message || err}` }),
        log
      })
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) principale()
