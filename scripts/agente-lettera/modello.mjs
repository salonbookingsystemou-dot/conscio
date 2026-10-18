// Chiamate all'API Claude con tetto di spesa. Il modello non ha strumenti di scrittura né di invio:
// restituisce JSON (output_config.format) oppure, nella sola ricerca, i risultati dello strumento server.

import { MAX_CHIAMATE, MAX_COSTO_USD, MAX_TOKEN, PREZZI, PREZZO_RICERCA } from './config.mjs'
import { estraiJson } from './testi.mjs'

export class TettoSuperato extends Error {
  constructor(motivo) {
    super(`Tetto superato: ${motivo}`)
    this.name = 'TettoSuperato'
  }
}

/** Contatore di chiamate, token, ricerche e costo stimato di un'esecuzione. */
export function nuovoConto() {
  return {
    chiamate: 0,
    token: 0,
    ricerche: 0,
    costo: 0,
    dettaglio: [],
    registra(modello, usage = {}, passo = '') {
      const p = PREZZI[modello] || PREZZI['claude-sonnet-5-5']
      const input = usage.input_tokens || 0
      const output = usage.output_tokens || 0
      const scritti = usage.cache_creation_input_tokens || 0
      const letti = usage.cache_read_input_tokens || 0
      const ricerche = usage.server_tool_use?.web_search_requests || 0
      const costo =
        (input * p.input + output * p.output + scritti * p.cacheScrittura + letti * p.cacheLettura) / 1e6 +
        ricerche * PREZZO_RICERCA
      this.chiamate += 1
      this.token += input + output + scritti + letti
      this.ricerche += ricerche
      this.costo += costo
      this.dettaglio.push({ passo, modello, input, output, cache_scritti: scritti, cache_letti: letti, ricerche, costo: +costo.toFixed(4) })
    },
    controlla() {
      if (this.chiamate >= MAX_CHIAMATE) throw new TettoSuperato(`${this.chiamate} chiamate`)
      if (this.token >= MAX_TOKEN) throw new TettoSuperato(`${this.token} token`)
      if (this.costo >= MAX_COSTO_USD) throw new TettoSuperato(`costo stimato ${this.costo.toFixed(2)} USD`)
    },
    riassunto() {
      return {
        chiamate: this.chiamate,
        token: this.token,
        ricerche: this.ricerche,
        costo_stimato_usd: +this.costo.toFixed(4),
        dettaglio: this.dettaglio
      }
    }
  }
}

const attendi = (ms) => new Promise((r) => setTimeout(r, ms))

async function postMessaggi(corpo, chiave, tentativi = 4) {
  let ultimo
  for (let i = 0; i < tentativi; i++) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': chiave,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(180_000)
    })
    if (res.ok) return res.json()
    const testo = await res.text().catch(() => '')
    ultimo = new Error(`API Claude ${res.status}: ${testo.slice(0, 300)}`)
    if (![429, 500, 502, 503, 504, 529].includes(res.status)) throw ultimo
    const dopo = Number(res.headers.get('retry-after'))
    await attendi(Number.isFinite(dopo) && dopo > 0 ? dopo * 1000 : 2000 * 2 ** i)
  }
  throw ultimo
}

/**
 * Una chiamata. `sistema` è la parte fissa (linea editoriale): va in cache.
 * Con `schema` la risposta è JSON validato dall'API; senza, si restituiscono i blocchi.
 */
export async function chiama({ conto, chiave, modello, sistema, utente, schema, maxToken = 4000, strumenti, passo }) {
  conto.controlla()
  const corpo = {
    model: modello,
    max_tokens: maxToken,
    system: [{ type: 'text', text: sistema, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: utente }]
  }
  if (schema) corpo.output_config = { format: { type: 'json_schema', schema } }
  if (strumenti) corpo.tools = strumenti
  const risposta = await postMessaggi(corpo, chiave)
  conto.registra(modello, risposta.usage, passo)
  const testo = (risposta.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('')
  return { risposta, testo, blocchi: risposta.content || [], stop: risposta.stop_reason }
}

/** Chiamata con risposta JSON: se lo schema non torna (rifiuto, troncata), riprova una volta. */
export async function chiamaJson(opts) {
  let ultimo = ''
  for (let tentativo = 0; tentativo < 2; tentativo++) {
    const { testo, stop } = await chiama(opts)
    const dati = stop === 'refusal' ? null : estraiJson(testo)
    if (dati && (!opts.valida || opts.valida(dati))) return dati
    ultimo = `risposta non valida (${stop}): ${testo.slice(0, 200)}`
  }
  throw new Error(`${opts.passo || 'chiamata'}: ${ultimo}`)
}
