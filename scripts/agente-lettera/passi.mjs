// Passi con il modello: smistamento, selezione, scrittura, verifica.
// I candidati e i testi delle pagine entrano come dati dentro <dati>; il modello restituisce solo JSON.

import { MAX_CANDIDATI_SMISTAMENTO, MAX_VOCI, MIN_VOCI, MODELLI } from './config.mjs'
import { chiamaJson } from './modello.mjs'

const SEZIONI = ['italia', 'mondo', 'ricerca', 'eventi']
const testoONull = { anyOf: [{ type: 'string' }, { type: 'null' }] }

function dati(oggetto) {
  // I contenuti esterni non possono chiudere il recinto.
  return `<dati>\n${JSON.stringify(oggetto, null, 1).replace(/<\/?dati>/gi, '')}\n</dati>`
}

const SCHEMA_SMISTA = {
  type: 'object',
  properties: {
    esiti: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'integer' }, pertinente: { type: 'boolean' }, motivo: { type: 'string' } },
        required: ['id', 'pertinente', 'motivo'],
        additionalProperties: false
      }
    }
  },
  required: ['esiti'],
  additionalProperties: false
}

/** Haiku: tiene i candidati che parlano davvero di mindfulness o meditazione. */
export async function smista({ candidati, linea, conto, chiave }) {
  const lotto = candidati.slice(0, MAX_CANDIDATI_SMISTAMENTO)
  const elenco = lotto.map((c, i) => ({ id: i, titolo: c.titolo, fonte: c.fonte, data: c.data, estratto: c.estratto.slice(0, 300) }))
  const r = await chiamaJson({
    conto, chiave, modello: MODELLI.leggero, passo: 'smistamento', sistema: linea, schema: SCHEMA_SMISTA, maxToken: 6000,
    utente: `Per ogni candidato decidi se è pertinente per la lettera (notizia, studio o evento su mindfulness o meditazione, non pubblicità, non lista di consigli generici, non cronaca). Motivo in poche parole, in italiano.\n\n${dati(elenco)}`,
    valida: (d) => Array.isArray(d.esiti)
  })
  const perId = new Map(r.esiti.map((e) => [e.id, e]))
  const pertinenti = []
  const scartati = []
  lotto.forEach((c, i) => {
    const e = perId.get(i)
    if (e?.pertinente) pertinenti.push(c)
    else scartati.push({ ...c, motivo: e?.motivo || 'non valutato' })
  })
  for (const c of candidati.slice(MAX_CANDIDATI_SMISTAMENTO)) scartati.push({ ...c, motivo: 'oltre il limite di candidati' })
  return { pertinenti, scartati }
}

const SCHEMA_SELEZIONE = {
  type: 'object',
  properties: {
    scelte: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'integer' }, sezione: { type: 'string', enum: SEZIONI }, motivo: { type: 'string' } },
        required: ['id', 'sezione', 'motivo'],
        additionalProperties: false
      }
    },
    riserve: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'integer' }, sezione: { type: 'string', enum: SEZIONI } },
        required: ['id', 'sezione'],
        additionalProperties: false
      }
    },
    nota: { type: 'string' }
  },
  required: ['scelte', 'riserve', 'nota'],
  additionalProperties: false
}

/** Sonnet: da 3 a 5 notizie bilanciate + fino a 3 riserve. */
export async function seleziona({ pertinenti, linea, conto, chiave }) {
  const elenco = pertinenti.map((c, i) => ({
    id: i, titolo: c.titolo, fonte: c.fonte, area: c.area, tipo_fonte: c.tipo, peso_fonte: c.peso, data: c.data, estratto: c.estratto.slice(0, 400)
  }))
  const r = await chiamaJson({
    conto, chiave, modello: MODELLI.scrittura, passo: 'selezione', sistema: linea, schema: SCHEMA_SELEZIONE, maxToken: 3000,
    utente: `Scegli da ${MIN_VOCI} a ${MAX_VOCI} notizie per la lettera di questa settimana secondo la linea editoriale, assegnando a ciascuna una sezione (italia, mondo, ricerca, eventi). Poi indica fino a 3 riserve, nell'ordine in cui le useresti. Se ci sono meno di ${MIN_VOCI} notizie valide, scegline meno e spiegalo nella nota. Nota in italiano, una o due frasi.\n\n${dati(elenco)}`,
    valida: (d) => Array.isArray(d.scelte) && Array.isArray(d.riserve)
  })
  const prendi = (x) => (pertinenti[x.id] ? { ...pertinenti[x.id], sezione: x.sezione } : null)
  const visti = new Set()
  const unici = (lista) => lista.filter((x) => x && !visti.has(x.url) && visti.add(x.url))
  const scelte = unici(r.scelte.map(prendi)).slice(0, MAX_VOCI)
  const riserve = unici(r.riserve.map(prendi)).slice(0, 3)
  return { scelte, riserve, nota: r.nota }
}

const SCHEMA_VOCE = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    titolo: { type: 'string' },
    sunto: { type: 'string' },
    perche_conta: { type: 'string' },
    tipo_studio: testoONull,
    data: testoONull
  },
  required: ['id', 'titolo', 'sunto', 'perche_conta', 'tipo_studio', 'data'],
  additionalProperties: false
}

const SCHEMA_SCRITTURA = {
  type: 'object',
  properties: {
    oggetto: { type: 'string' },
    introduzione: { type: 'string' },
    voci: { type: 'array', items: SCHEMA_VOCE }
  },
  required: ['oggetto', 'introduzione', 'voci'],
  additionalProperties: false
}

function perIlModello(notizie) {
  return notizie.map((n, i) => ({
    id: i, sezione: n.sezione, titolo_originale: n.titolo, fonte: n.fonte, data_nota: n.data, url: n.url, testo: n.testo || n.estratto
  }))
}

/** Sonnet: titolo, sunto, «perché conta», tipo di studio; più oggetto e introduzione della lettera. */
export async function scrivi({ notizie, linea, conto, chiave, soloVoci = false }) {
  const richiesta = soloVoci
    ? 'Scrivi solo le voci per queste notizie (oggetto e introduzione lasciali vuoti).'
    : "Scrivi le voci per queste notizie, poi l'oggetto della lettera (al massimo 80 caratteri, concreto, che nomini una o due notizie, senza «newsletter») e un'introduzione di 2–3 righe che dica cosa c'è questa settimana."
  const r = await chiamaJson({
    conto, chiave, modello: MODELLI.scrittura, passo: soloVoci ? 'scrittura riserva' : 'scrittura', sistema: linea, schema: SCHEMA_SCRITTURA, maxToken: 5000,
    utente: `${richiesta}\nPer ogni voce usa solo ciò che c'è nel testo. In «data» metti la data di pubblicazione che trovi nel testo (AAAA-MM-GG), oppure null se non c'è: non indovinarla.\n\n${dati(perIlModello(notizie))}`,
    valida: (d) => Array.isArray(d.voci)
  })
  const voci = []
  for (const v of r.voci) {
    const n = notizie[v.id]
    if (!n) continue
    voci.push({
      sezione: n.sezione,
      titolo: v.titolo.trim(),
      sunto: v.sunto.trim(),
      perche_conta: v.perche_conta.trim(),
      tipo_studio: n.sezione === 'ricerca' ? (v.tipo_studio || '').trim() || null : null,
      fonte: n.fonte,
      data: n.data || v.data || null,
      url: n.url,
      _testo: n.testo || n.estratto
    })
  }
  return { oggetto: (r.oggetto || '').trim(), introduzione: (r.introduzione || '').trim(), voci }
}

const SCHEMA_VERIFICA = {
  type: 'object',
  properties: {
    esiti: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          esito: { type: 'string', enum: ['verificata', 'da_controllare'] },
          nota: { type: 'string' }
        },
        required: ['id', 'esito', 'nota'],
        additionalProperties: false
      }
    }
  },
  required: ['esiti'],
  additionalProperties: false
}

/** Sonnet in un contesto pulito: ogni voce confrontata con il testo della sua fonte. */
export async function verifica({ voci, linea, conto, chiave }) {
  const elenco = voci.map((v, i) => ({
    id: i, titolo: v.titolo, sunto: v.sunto, perche_conta: v.perche_conta, tipo_studio: v.tipo_studio, testo_della_fonte: v._testo
  }))
  const r = await chiamaJson({
    conto, chiave, modello: MODELLI.scrittura, passo: 'verifica', sistema: linea, schema: SCHEMA_VERIFICA, maxToken: 3000,
    utente: `Controlla ogni voce rispetto al testo della sua fonte, come farebbe una revisora attenta.
Segna «da_controllare» se anche una sola di queste cose è vera:
- un'affermazione, un numero, un nome o una data non si trova nel testo della fonte o lo contraddice;
- il tipo di studio o il numero di partecipanti non corrisponde;
- per uno studio manca un limite o la cautela richiesta;
- il linguaggio è clinico o promette efficacia;
- una frase è copiata quasi parola per parola dalla fonte (più di 15 parole uguali).
Altrimenti «verificata». Nella nota, in italiano, cita la frase dubbia e il motivo; per le voci verificate scrivi «ok».

${dati(elenco)}`,
    valida: (d) => Array.isArray(d.esiti)
  })
  const perId = new Map(r.esiti.map((e) => [e.id, e]))
  return voci.map((v, i) => {
    const e = perId.get(i)
    return { ...v, verifica: e?.esito === 'verificata' ? 'verificata' : 'da_controllare', nota_verifica: e?.nota || 'non verificata' }
  })
}
