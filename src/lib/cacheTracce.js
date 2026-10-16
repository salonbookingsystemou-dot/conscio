// Copie delle tracce audio sul telefono, per ascoltarle anche senza rete.
//
// I tag <audio> caricano l'audio con richieste Range (risposte 206) che il
// service worker (CacheFirst) non salva come copia completa. Per far funzionare
// la riproduzione offline serve una richiesta "piena" (GET senza Range → 200):
// la copia integrale finisce nella cache "tracce-audio-v2" e da lì il
// RangeRequestsPlugin del service worker serve i frammenti anche offline.
//
// Lo scaricamento legge il file a pezzi (per l'avanzamento), un file alla volta,
// e scrive la copia in cache solo a file completo: se si annulla o cade la rete
// non resta una copia a metà.

import { useEffect, useState } from 'react'
import { urlAudioSenzaTesto } from './tracce.js'

// Nome allineato alla route del service worker (vite.config.js).
const CACHE_TRACCE = 'tracce-audio-v2'
// Vecchia cache che poteva contenere risposte opaque non affettabili: va rimossa.
const CACHE_LEGACY = 'tracce-audio'
// Tracce che la persona ha tolto: lo scaricamento automatico non le riprende.
const CHIAVE_TOLTE = 'conscio.tracce-tolte'
const CHIAVE_PERSISTENZA = 'conscio.spazio-persistente-chiesto'
// Margine lasciato libero sul telefono oltre al peso del file.
const MARGINE_SPAZIO = 50 * 1024 * 1024

export const STATO_ASSENTE = 'assente'
export const STATO_IN_CORSO = 'in-corso'
export const STATO_PRONTA = 'pronta'

// url pulito → { stato, percentuale, errore }
const stati = new Map()
const ascoltatori = new Set()
// Coda di scaricamenti: uno alla volta.
const coda = []
let attivo = null // { url, controllo, automatico }
// Annullate a mano in questa sessione: l'automatico non le riprende subito.
const annullateSessione = new Set()

export function tracciaRemota(url) {
  const pulito = typeof url === 'string' ? urlAudioSenzaTesto(url) : ''
  return pulito.includes('/storage/v1/object/public/tracce-audio/')
}

function pulisci(url) {
  return typeof url === 'string' ? urlAudioSenzaTesto(url) : ''
}

function cacheDisponibile() {
  return typeof caches !== 'undefined' && typeof fetch !== 'undefined'
}

function notifica(url) {
  for (const fn of ascoltatori) fn(url)
}

function imposta(url, valori) {
  stati.set(url, { stato: STATO_ASSENTE, percentuale: 0, errore: '', ...stati.get(url), ...valori })
  notifica(url)
}

export function statoTraccia(url) {
  return stati.get(pulisci(url)) || { stato: STATO_ASSENTE, percentuale: 0, errore: '' }
}

function leggiTolte() {
  try {
    const lista = JSON.parse(localStorage.getItem(CHIAVE_TOLTE) || '[]')
    return new Set(Array.isArray(lista) ? lista : [])
  } catch {
    return new Set()
  }
}

function scriviTolte(insieme) {
  try {
    localStorage.setItem(CHIAVE_TOLTE, JSON.stringify([...insieme].slice(-200)))
  } catch {
    // memoria del browser non disponibile: la scelta vale fino alla chiusura
  }
}

// Rimuove la cache legacy "avvelenata" da risposte opaque (una tantum).
export async function pulisciCacheTracceLegacy() {
  if (typeof caches === 'undefined') return
  try {
    await caches.delete(CACHE_LEGACY)
  } catch {
    // ignora
  }
}

export async function tracciaInCache(url) {
  if (!url || typeof caches === 'undefined') return false
  try {
    const cache = await caches.open(CACHE_TRACCE)
    const match = await cache.match(url)
    return Boolean(match)
  } catch {
    return false
  }
}

// Legge dalla cache se la traccia è già sul telefono (all'apertura della card).
export async function verificaTraccia(url) {
  const pulito = pulisci(url)
  if (!tracciaRemota(pulito)) return
  const corrente = stati.get(pulito)
  if (corrente?.stato === STATO_IN_CORSO) return
  const presente = await tracciaInCache(pulito)
  const dopo = stati.get(pulito)
  if (dopo?.stato === STATO_IN_CORSO) return
  if (presente && dopo?.stato !== STATO_PRONTA) imposta(pulito, { stato: STATO_PRONTA, percentuale: 100, errore: '' })
  if (!presente && dopo?.stato === STATO_PRONTA) imposta(pulito, { stato: STATO_ASSENTE, percentuale: 0 })
  if (!presente && !dopo) imposta(pulito, { stato: STATO_ASSENTE })
}

// Chiede al browser di non liberare da solo lo spazio delle tracce (una volta sola).
async function chiediSpazioPersistente() {
  try {
    if (localStorage.getItem(CHIAVE_PERSISTENZA)) return
    localStorage.setItem(CHIAVE_PERSISTENZA, new Date().toISOString())
  } catch {
    // senza memoria del browser lo si chiede a ogni sessione: innocuo
  }
  try {
    if (navigator.storage?.persisted && await navigator.storage.persisted()) return
    await navigator.storage?.persist?.()
  } catch {
    // non supportato: il browser decide da solo
  }
}

async function spazioSufficiente(byte) {
  if (!(byte > 0)) return true
  try {
    const stima = await navigator.storage?.estimate?.()
    if (!stima || !(stima.quota > 0)) return true
    return stima.quota - (stima.usage || 0) >= byte + MARGINE_SPAZIO
  } catch {
    return true
  }
}

function erroreSpazio() {
  const err = new Error('SPAZIO')
  err.messaggio = 'Non c’è abbastanza spazio sul telefono per scaricarla.'
  return err
}

async function scarica(url, controllo) {
  const risposta = await fetch(url, { mode: 'cors', credentials: 'omit', signal: controllo.signal })
  if (!risposta.ok || !risposta.body) throw new Error('RISPOSTA')
  const totale = Number(risposta.headers.get('content-length')) || 0
  if (!(await spazioSufficiente(totale))) {
    controllo.abort()
    throw erroreSpazio()
  }
  const reader = risposta.body.getReader()
  const pezzi = []
  let letti = 0
  let ultima = -1
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    pezzi.push(value)
    letti += value.byteLength
    const percentuale = totale > 0 ? Math.min(99, Math.floor((letti / totale) * 100)) : 0
    if (percentuale !== ultima) {
      ultima = percentuale
      imposta(url, { stato: STATO_IN_CORSO, percentuale })
    }
  }
  if (totale > 0 && letti < totale) throw new Error('INCOMPLETO')
  const tipo = risposta.headers.get('content-type') || 'audio/mpeg'
  const copia = new Response(new Blob(pezzi, { type: tipo }), {
    status: 200,
    headers: { 'Content-Type': tipo, 'Content-Length': String(letti) }
  })
  const cache = await caches.open(CACHE_TRACCE)
  try {
    await cache.put(url, copia)
  } catch (err) {
    if (err?.name === 'QuotaExceededError') throw erroreSpazio()
    throw err
  }
}

function messaggioErrore(err) {
  if (err?.messaggio) return err.messaggio
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'Serve la connessione per scaricarla.'
  }
  return 'Scaricamento non riuscito. Riprova con una connessione migliore.'
}

async function prossimo() {
  if (attivo) return
  const voce = coda.shift()
  if (!voce) return
  const { url, automatico, risolvi } = voce
  const controllo = new AbortController()
  attivo = { url, controllo, automatico }
  try {
    if (await tracciaInCache(url)) {
      imposta(url, { stato: STATO_PRONTA, percentuale: 100, errore: '' })
      risolvi(true)
      return
    }
    imposta(url, { stato: STATO_IN_CORSO, percentuale: 0, errore: '' })
    await chiediSpazioPersistente()
    await scarica(url, controllo)
    imposta(url, { stato: STATO_PRONTA, percentuale: 100, errore: '' })
    risolvi(true)
  } catch (err) {
    const annullato = controllo.signal.aborted && err?.message !== 'SPAZIO'
    imposta(url, {
      stato: STATO_ASSENTE,
      percentuale: 0,
      // Gli scaricamenti automatici falliti restano silenziosi: si riprova alla prossima apertura.
      errore: annullato || automatico ? '' : messaggioErrore(err)
    })
    risolvi(false)
  } finally {
    attivo = null
    prossimo()
  }
}

// Mette in coda lo scaricamento di una traccia. Risolve true quando è sul telefono.
export function scaricaTraccia(url, { automatico = false } = {}) {
  const pulito = pulisci(url)
  if (!tracciaRemota(pulito) || !cacheDisponibile()) return Promise.resolve(false)
  if (!automatico) {
    annullateSessione.delete(pulito)
    const tolte = leggiTolte()
    if (tolte.delete(pulito)) scriviTolte(tolte)
  }
  if (attivo?.url === pulito) {
    // Una scelta manuale non viene più annullata da chi interrompe gli automatici.
    if (!automatico) attivo.automatico = false
    return new Promise(risolvi => {
      const fn = u => {
        if (u !== pulito) return
        const s = statoTraccia(pulito).stato
        if (s === STATO_IN_CORSO) return
        ascoltatori.delete(fn)
        risolvi(s === STATO_PRONTA)
      }
      ascoltatori.add(fn)
    })
  }
  const inCoda = coda.find(v => v.url === pulito)
  if (inCoda) {
    if (!automatico) {
      // Chi la chiede a mano passa davanti agli automatici.
      inCoda.automatico = false
      coda.splice(coda.indexOf(inCoda), 1)
      coda.unshift(inCoda)
    }
    return inCoda.promessa
  }
  let risolvi
  const promessa = new Promise(r => { risolvi = r })
  const voce = { url: pulito, automatico, risolvi, promessa }
  if (automatico) coda.push(voce)
  else coda.unshift(voce)
  if (!automatico) imposta(pulito, { stato: STATO_IN_CORSO, percentuale: 0, errore: '' })
  prossimo()
  return promessa
}

export function annullaScaricamento(url) {
  const pulito = pulisci(url)
  annullateSessione.add(pulito)
  const i = coda.findIndex(v => v.url === pulito)
  if (i >= 0) {
    const [voce] = coda.splice(i, 1)
    voce.risolvi(false)
    imposta(pulito, { stato: STATO_ASSENTE, percentuale: 0, errore: '' })
  }
  if (attivo?.url === pulito) attivo.controllo.abort()
}

// Ferma gli scaricamenti automatici (per esempio quando parte un ascolto),
// così la rete resta tutta alla riproduzione.
export function sospendiAutomatici({ tranne } = {}) {
  const salva = pulisci(tranne)
  for (let i = coda.length - 1; i >= 0; i--) {
    if (coda[i].automatico && coda[i].url !== salva) {
      const [voce] = coda.splice(i, 1)
      voce.risolvi(false)
    }
  }
  if (attivo?.automatico && attivo.url !== salva) attivo.controllo.abort()
}

export async function togliTraccia(url) {
  const pulito = pulisci(url)
  if (!pulito) return
  annullaScaricamento(pulito)
  const tolte = leggiTolte()
  tolte.add(pulito)
  scriviTolte(tolte)
  try {
    const cache = await caches.open(CACHE_TRACCE)
    await cache.delete(pulito)
  } catch {
    // ignora
  }
  imposta(pulito, { stato: STATO_ASSENTE, percentuale: 0, errore: '' })
}

// Copia completa al momento dell'ascolto (comportamento precedente): parte solo
// se la rete non è lenta, per non togliere banda alla riproduzione.
export function assicuraTracciaOffline(url) {
  const pulito = pulisci(url)
  if (!tracciaRemota(pulito)) return
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return
  sospendiAutomatici({ tranne: pulito })
  if (reteLenta() || leggiTolte().has(pulito)) return
  scaricaTraccia(pulito, { automatico: true })
}

// true se il telefono chiede di risparmiare dati o la rete è 2G.
export function reteLenta() {
  const conn = typeof navigator !== 'undefined' ? navigator.connection : null
  if (!conn) return false
  if (conn.saveData) return true
  return conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g'
}

function quandoInattiva() {
  return new Promise(risolvi => {
    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(() => risolvi(), { timeout: 8000 })
    } else {
      setTimeout(risolvi, 4000)
    }
  })
}

function audioInRiproduzione() {
  if (typeof document === 'undefined') return false
  return [...document.querySelectorAll('audio')].some(el => !el.paused && !el.ended)
}

let automaticoInCorso = false

// All'apertura: scarica le tracce della settimana in corso, una alla volta,
// a pagina inattiva e mai mentre una traccia suona.
export async function scaricaSettimanaInCorso(urls) {
  if (!cacheDisponibile()) return
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return
  if (reteLenta()) return
  const tolte = leggiTolte()
  const lista = [...new Set((urls || []).map(pulisci))]
    .filter(u => tracciaRemota(u) && !tolte.has(u) && !annullateSessione.has(u))
  if (!lista.length || automaticoInCorso) return
  automaticoInCorso = true
  try {
    await scaricaInSequenza(lista)
  } finally {
    automaticoInCorso = false
  }
}

async function scaricaInSequenza(lista) {
  for (const url of lista) {
    if (await tracciaInCache(url)) {
      imposta(url, { stato: STATO_PRONTA, percentuale: 100, errore: '' })
      continue
    }
    await quandoInattiva()
    while (audioInRiproduzione()) await new Promise(r => setTimeout(r, 30000))
    if (document.visibilityState === 'hidden') {
      await new Promise(r => document.addEventListener('visibilitychange', r, { once: true }))
    }
    if (reteLenta() || navigator.onLine === false) break
    if (leggiTolte().has(url) || annullateSessione.has(url)) continue
    await scaricaTraccia(url, { automatico: true })
  }
}

// Stato di una traccia per i componenti: { stato, percentuale, errore }.
export function useStatoTraccia(url) {
  const pulito = pulisci(url)
  const [stato, setStato] = useState(() => statoTraccia(pulito))
  useEffect(() => {
    setStato(statoTraccia(pulito))
    if (!pulito) return undefined
    const fn = u => { if (u === pulito) setStato(statoTraccia(pulito)) }
    ascoltatori.add(fn)
    verificaTraccia(pulito)
    return () => { ascoltatori.delete(fn) }
  }, [pulito])
  return stato
}
