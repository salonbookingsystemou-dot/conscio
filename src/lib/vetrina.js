import { chiamaPorta, supabase } from './supabaseClient.js'

export const LICENZE = [
  { valore: 'propria', etichetta: 'Propria' },
  { valore: 'cc0', etichetta: 'CC0', url: 'https://creativecommons.org/publicdomain/zero/1.0/deed.it' },
  { valore: 'cc-by', etichetta: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/deed.it' },
  { valore: 'cc-by-sa', etichetta: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/deed.it' },
  { valore: 'cc-by-nc', etichetta: 'CC BY-NC 4.0', url: 'https://creativecommons.org/licenses/by-nc/4.0/deed.it' },
  { valore: 'cc-by-nc-sa', etichetta: 'CC BY-NC-SA 4.0', url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/deed.it' },
  { valore: 'permesso-autore', etichetta: 'Permesso dell’autore' }
]

export const VOCI_REVISIONE = [
  ['linguaggio_invitante', 'Linguaggio invitante'],
  ['alternative_offerte', 'Alternative offerte'],
  ['nessuna_promessa_clinica', 'Nessuna promessa clinica'],
  ['avvertenze_presenti', 'Avvertenze presenti']
]

export const GRUPPI_TAG = [
  ['pratica', 'Pratica'],
  ['contesto', 'Contesto'],
  ['livello', 'Livello'],
  ['ancora', 'Àncora'],
  ['attenzione', 'Attenzione']
]

export const FASCE_DURATA = [
  { id: 'sotto-5', etichetta: 'Meno di 5 min', contiene: n => n < 5 },
  { id: '5-10', etichetta: '5–10 min', contiene: n => n >= 5 && n < 10 },
  { id: '10-20', etichetta: '10–20 min', contiene: n => n >= 10 && n <= 20 },
  { id: 'oltre-20', etichetta: 'Oltre 20 min', contiene: n => n > 20 }
]

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/

let cacheImpostazioni = null
let voloImpostazioni = null
const ascoltatori = new Set()

function avvisa() {
  for (const fn of ascoltatori) fn()
}

export function invalidaVetrina() {
  cacheImpostazioni = null
  voloImpostazioni = null
  avvisa()
}

export function osservaVetrina(fn) {
  ascoltatori.add(fn)
  return () => ascoltatori.delete(fn)
}

export async function leggiImpostazioniPubbliche() {
  if (!voloImpostazioni) {
    voloImpostazioni = supabase.rpc('vetrina_impostazioni').then(({ data, error }) => {
      if (error) throw error
      cacheImpostazioni = data || {}
      return cacheImpostazioni
    }).finally(() => {
      voloImpostazioni = null
    })
  }
  return voloImpostazioni
}

export function vetrinaAperta() {
  if (cacheImpostazioni) return Promise.resolve(cacheImpostazioni.vetrina_attiva === true)
  return leggiImpostazioniPubbliche().then(dati => dati.vetrina_attiva === true)
}

export async function leggiElenco() {
  const { data, error } = await supabase.rpc('vetrina_elenco')
  if (error) throw error
  return Array.isArray(data) ? data : []
}

export async function leggiTracciaPubblica(slug) {
  const { data, error } = await supabase.rpc('vetrina_traccia', { p_slug: slug })
  if (error) throw error
  return data || null
}

export async function leggiEvidenza() {
  const { data, error } = await supabase.rpc('vetrina_in_evidenza')
  if (error) throw error
  return data || null
}

export function eventoVetrina(slug, evento) {
  if (!slug || !SLUG.test(slug)) return
  chiamaPorta({ azione: 'evento-vetrina', slug, evento }).catch(() => {})
}

export function urlAscolta(slug) {
  const base = import.meta.env.BASE_URL || '/'
  const radice = base.endsWith('/') ? base : `${base}/`
  if (typeof window === 'undefined') return `${radice}#/ascolta/${slug}`
  return `${window.location.origin}${radice}#/ascolta/${slug}`
}

export function slugDaTitolo(titolo) {
  return String(titolo || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export function normalizzaSlug(valore) {
  return String(valore || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, 80)
}

export function slugValido(slug) {
  return SLUG.test(slug)
}

export function mancaPerPubblicare(scheda) {
  const manca = []
  if (!slugValido(String(scheda.slug || '').replace(/-+$/, ''))) manca.push('uno slug valido')
  if (!String(scheda.descrizione || '').trim()) manca.push('la descrizione')
  if (!scheda.sfondo_url) manca.push('lo sfondo')
  if (!scheda.sfondo_poster_url) manca.push('l’anteprima dello sfondo')
  if (!String(scheda.sfondo_autore || '').trim()) manca.push('l’autore dello sfondo')
  if (!scheda.autore_id) manca.push('l’autore del testo')
  if (!scheda.licenza) manca.push('la licenza')
  if (scheda.licenza === 'permesso-autore' && !String(scheda.permesso_nota || '').trim()) {
    manca.push('la nota sul permesso')
  }
  if (scheda.voce_tipo !== 'sintetica' && scheda.voce_tipo !== 'umana') manca.push('il tipo di voce')
  if (scheda.voce_tipo === 'umana' && !String(scheda.voce_nome || '').trim()) {
    manca.push('il nome di chi ha prestato la voce')
  }
  if (scheda.stato_revisione !== 'approvata') manca.push('la revisione approvata')
  const revisione = scheda.revisione || {}
  if (scheda.stato_revisione === 'approvata' && VOCI_REVISIONE.some(([chiave]) => !revisione[chiave])) {
    manca.push('tutte le voci della revisione')
  }
  return manca
}

export function etichettaLicenza(codice) {
  return LICENZE.find(voce => voce.valore === codice) || null
}

export function etichettaVoce(voce) {
  if (voce?.tipo === 'umana') return voce.nome ? `Voce di ${voce.nome}` : 'Voce umana'
  if (voce?.tipo === 'sintetica') return 'Voce sintetica (ElevenLabs)'
  return ''
}

export function haTag(traccia, slug) {
  if (!slug) return true
  return Object.values(traccia?.tag || {}).some(lista => (
    Array.isArray(lista) && lista.some(tag => tag.slug === slug)
  ))
}

export function rigaTag(traccia) {
  const tag = traccia?.tag || {}
  const pratica = tag.pratica?.[0]?.etichetta
  const contesto = tag.contesto?.[0]?.etichetta || tag.livello?.[0]?.etichetta
  return [pratica, contesto].filter(Boolean).join(' · ')
}

export function tagPresenti(elenco) {
  const visti = new Map()
  for (const traccia of elenco) {
    for (const lista of Object.values(traccia.tag || {})) {
      if (!Array.isArray(lista)) continue
      for (const tag of lista) {
        if (tag?.slug && !visti.has(tag.slug)) visti.set(tag.slug, tag.etichetta || tag.slug)
      }
    }
  }
  return [...visti.entries()].map(([slug, etichetta]) => ({ slug, etichetta }))
}

function testoONull(valore) {
  const testo = String(valore ?? '').trim()
  return testo || null
}

export async function leggiImpostazioniSito() {
  const { data, error } = await supabase
    .from('impostazioni_sito')
    .select('vetrina_attiva, cta_titolo, cta_testo, cta_testo_senza_ciclo')
    .eq('id', 1)
    .single()
  if (error) throw error
  return data
}

export async function salvaImpostazioniSito(campi) {
  const { error } = await supabase
    .from('impostazioni_sito')
    .update({
      vetrina_attiva: Boolean(campi.vetrina_attiva),
      cta_titolo: String(campi.cta_titolo || '').trim(),
      cta_testo: String(campi.cta_testo || '').trim(),
      cta_testo_senza_ciclo: String(campi.cta_testo_senza_ciclo || '').trim(),
      aggiornato_il: new Date().toISOString()
    })
    .eq('id', 1)
  if (error) throw error
  invalidaVetrina()
}

export async function leggiTag() {
  const { data, error } = await supabase
    .from('tag')
    .select('id, gruppo, slug, etichetta, ordine')
    .order('ordine')
  if (error) throw error
  return data || []
}

export async function leggiAutori() {
  const { data, error } = await supabase
    .from('autori')
    .select('id, nome, link')
    .order('nome')
  if (error) throw error
  return data || []
}

export async function creaAutore(nome, link) {
  const { data, error } = await supabase
    .from('autori')
    .insert({ nome: String(nome || '').trim(), link: testoONull(link) })
    .select('id, nome, link')
    .single()
  if (error) throw error
  return data
}

export async function leggiStatiVetrina() {
  const { data, error } = await supabase
    .from('tracce')
    .select('id, pubblica, stato_revisione')
  if (error) throw error
  return Object.fromEntries((data || []).map(riga => [riga.id, riga]))
}

const COLONNE_SCHEDA = [
  'slug', 'sfondo_tipo', 'sfondo_fonte', 'sfondo_url', 'sfondo_poster_url', 'sfondo_fonte_id',
  'sfondo_autore', 'sfondo_autore_link', 'sfondo_fuoco', 'autore_id', 'licenza', 'fonte_url',
  'permesso_nota', 'voce_tipo', 'voce_nome', 'revisione', 'stato_revisione', 'pubblica',
  'in_evidenza_dal'
].join(', ')

export async function leggiSchedaVetrina(id) {
  const [{ data, error }, tag] = await Promise.all([
    supabase.from('tracce').select(COLONNE_SCHEDA).eq('id', id).single(),
    supabase.from('tracce_tag').select('tag_id').eq('traccia_id', id)
  ])
  if (error) throw error
  if (tag.error) throw tag.error
  return { ...data, tag_ids: (tag.data || []).map(riga => riga.tag_id) }
}

export async function salvaSchedaVetrina(id, campi, tagIds) {
  const slug = testoONull(String(campi.slug || '').replace(/-+$/, ''))
  if (slug && !slugValido(slug)) throw new Error('Lo slug può contenere solo lettere minuscole, numeri e trattini.')
  const { error } = await supabase.from('tracce').update({
    slug,
    sfondo_tipo: campi.sfondo_tipo || null,
    sfondo_fonte: campi.sfondo_fonte || null,
    sfondo_url: testoONull(campi.sfondo_url),
    sfondo_poster_url: testoONull(campi.sfondo_poster_url),
    sfondo_fonte_id: testoONull(campi.sfondo_fonte_id),
    sfondo_autore: testoONull(campi.sfondo_autore),
    sfondo_autore_link: testoONull(campi.sfondo_autore_link),
    sfondo_fuoco: campi.sfondo_fuoco || 'centro',
    autore_id: campi.autore_id || null,
    licenza: campi.licenza || null,
    fonte_url: testoONull(campi.fonte_url),
    permesso_nota: testoONull(campi.permesso_nota),
    voce_tipo: campi.voce_tipo || null,
    voce_nome: campi.voce_tipo === 'umana' ? testoONull(campi.voce_nome) : null,
    revisione: campi.revisione || {},
    stato_revisione: campi.stato_revisione || 'bozza',
    pubblica: Boolean(campi.pubblica),
    in_evidenza_dal: campi.in_evidenza_dal || null,
    aggiornato_il: new Date().toISOString()
  }).eq('id', id)
  if (error) {
    if (error.code === '23505') throw new Error('Questo slug è già usato da un’altra traccia.')
    if (error.code === '23514') throw new Error('Per pubblicare mancano ancora dei campi, oppure la licenza non è completa.')
    throw error
  }
  const { error: erroreCancella } = await supabase.from('tracce_tag').delete().eq('traccia_id', id)
  if (erroreCancella) throw erroreCancella
  if (tagIds.length) {
    const { error: erroreTag } = await supabase
      .from('tracce_tag')
      .insert(tagIds.map(tag_id => ({ traccia_id: id, tag_id })))
    if (erroreTag) throw erroreTag
  }
}

export async function leggiStatistiche() {
  const da = new Date()
  da.setDate(da.getDate() - 27)
  const giorno = da.toLocaleDateString('sv-SE')
  const { data, error } = await supabase
    .from('statistiche_vetrina')
    .select('traccia_id, avvii, completamenti, clic_cta, condivisioni')
    .gte('giorno', giorno)
  if (error) throw error
  const righe = data || []
  const ids = [...new Set(righe.map(riga => riga.traccia_id))]
  let titoli = {}
  if (ids.length) {
    const { data: tracce, error: erroreTracce } = await supabase
      .from('tracce')
      .select('id, titolo')
      .in('id', ids)
    if (erroreTracce) throw erroreTracce
    titoli = Object.fromEntries((tracce || []).map(traccia => [traccia.id, traccia.titolo]))
  }
  return righe.map(riga => ({ ...riga, titolo: titoli[riga.traccia_id] || 'Traccia' }))
}

export function riepilogoStatistiche(righe) {
  const chiavi = ['avvii', 'completamenti', 'clic_cta', 'condivisioni']
  const totale = { avvii: 0, completamenti: 0, clic_cta: 0, condivisioni: 0 }
  const perTraccia = new Map()
  for (const riga of righe) {
    const voce = perTraccia.get(riga.traccia_id) || {
      id: riga.traccia_id,
      titolo: riga.titolo,
      avvii: 0,
      completamenti: 0,
      clic_cta: 0,
      condivisioni: 0
    }
    for (const chiave of chiavi) {
      const n = Number(riga[chiave]) || 0
      voce[chiave] += n
      totale[chiave] += n
    }
    perTraccia.set(riga.traccia_id, voce)
  }
  return {
    totale,
    righe: [...perTraccia.values()].sort((a, b) => b.avvii - a.avvii || a.titolo.localeCompare(b.titolo, 'it'))
  }
}

export async function leggiProgramma() {
  const { data, error } = await supabase
    .from('tracce')
    .select('id, titolo, slug, pubblica, in_evidenza_dal')
    .not('in_evidenza_dal', 'is', null)
    .order('in_evidenza_dal')
  if (error) throw error
  return data || []
}

function mezzanotte(data) {
  const copia = new Date(data)
  copia.setHours(0, 0, 0, 0)
  return copia
}

function dataLocale(iso) {
  const [anno, mese, giorno] = String(iso).slice(0, 10).split('-').map(Number)
  return new Date(anno, mese - 1, giorno)
}

function lunedi(data) {
  const giorno = mezzanotte(data)
  giorno.setDate(giorno.getDate() - ((giorno.getDay() + 6) % 7))
  return giorno
}

export function settimaneVetrina(tracce, quante = 8) {
  const inizio = lunedi(new Date())
  return Array.from({ length: quante }, (_, indice) => {
    const dal = new Date(inizio)
    dal.setDate(inizio.getDate() + indice * 7)
    const al = new Date(dal)
    al.setDate(dal.getDate() + 6)
    return {
      dal,
      al,
      tracce: tracce.filter(traccia => {
        if (!traccia.in_evidenza_dal) return false
        const giorno = dataLocale(traccia.in_evidenza_dal)
        return giorno >= dal && giorno <= al
      })
    }
  })
}

export function intervalloSettimana(dal, al) {
  const formato = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' })
  return `${formato.format(dal)} – ${formato.format(al)}`
}
