// node --test scripts/agente-lettera/test/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { controllaBozza } from '../controlli.mjs'
import { meditazioneDaTraccia, scegliMeditazione, svgSovrapposto } from '../meditazione.mjs'
import { nuovoConto, TettoSuperato } from '../modello.mjs'
import { componiNotifica } from '../notifica.mjs'
import { pulisciCandidati } from '../index.mjs'
import {
  dataDaEta, estraiJson, fontePerUrl, hashUrl, invioPrevisto, istanteItalia, leggiFeedXml, leggiParoleVietate,
  lunediDi, normalizzaUrl, parlaDelTema, testoDaHtml, trovaParoleVietate
} from '../testi.mjs'
import { composiLettera, dataLunga, giovediDi } from '../../../supabase/functions/_shared/letteraSettimanale.ts'

const OGGI = '2026-10-22'

const voce = (x = {}) => ({
  sezione: 'ricerca', titolo: 'Pratica e sonno', sunto: 'Una revisione di 25 studi.', perche_conta: 'Un quadro d’insieme.',
  tipo_studio: 'Meta-analisi di 25 studi', fonte: 'Mindfulness (Springer)', data: '2026-10-16',
  url: 'https://example.org/a', verifica: 'verificata', nota_verifica: 'ok', ...x
})
const bozzaBuona = (x = {}) => ({
  settimana: '2026-10-19', oggetto: 'Respiro e sonno', introduzione: 'Tre notizie.',
  voci: [voce(), voce({ url: 'https://example.org/b', sezione: 'italia' }), voce({ url: 'https://example.org/c', sezione: 'mondo' })],
  meditazione: { slug: 'tre-minuti', titolo: 'Tre minuti' }, ...x
})
const tuttiOk = { 'https://example.org/a': true, 'https://example.org/b': true, 'https://example.org/c': true }

test('URL normalizzati e confrontabili', () => {
  assert.equal(normalizzaUrl('http://WWW.Example.org/news/?utm_source=x&b=2&a=1#top'), 'https://example.org/news?a=1&b=2')
  assert.equal(hashUrl('https://example.org/x/'), hashUrl('https://www.example.org/x?utm_medium=rss'))
  assert.equal(normalizzaUrl('non un url'), '')
})

test('feed RSS e Atom', () => {
  const rss = `<rss><channel><item><title><![CDATA[Meditazione &amp; scuola]]></title><link>https://a.it/1</link><pubDate>Thu, 15 Oct 2026 10:00:00 +0200</pubDate><description>&lt;p&gt;Testo&lt;/p&gt;</description></item></channel></rss>`
  const atom = `<feed><entry><title>Mindful walking</title><link rel="alternate" href="https://b.org/2"/><published>2026-10-14T08:00:00Z</published><summary>Hi</summary></entry></feed>`
  const [a] = leggiFeedXml(rss)
  const [b] = leggiFeedXml(atom)
  assert.equal(a.titolo, 'Meditazione & scuola')
  assert.equal(a.data, '2026-10-15')
  assert.equal(b.url, 'https://b.org/2')
  assert.equal(b.data, '2026-10-14')
})

test('testo da HTML senza menu né script', () => {
  const t = testoDaHtml('<html><nav>Menu</nav><script>x()</script><article><h1>Titolo</h1><p>Uno&nbsp;due</p></article><footer>F</footer></html>')
  assert.equal(t, 'Titolo\nUno due')
})

test('date relative dei risultati di ricerca', () => {
  const oggi = new Date('2026-10-22T10:00:00Z')
  assert.equal(dataDaEta('3 days ago', oggi), '2026-10-19')
  assert.equal(dataDaEta('1 week ago', oggi), '2026-10-15')
  assert.equal(dataDaEta('October 14, 2026', oggi), '2026-10-14')
  assert.equal(dataDaEta(null, oggi), null)
})

test('fonte del dominio più specifico', () => {
  const fonti = [{ dominio: 'harvard.edu', nome: 'H' }, { dominio: 'news.harvard.edu', nome: 'Gazette' }]
  assert.equal(fontePerUrl('https://news.harvard.edu/gazette/x', fonti).nome, 'Gazette')
  assert.equal(fontePerUrl('https://altro.it', fonti), null)
})

test('tema e parole vietate', () => {
  assert.ok(parlaDelTema('Uno studio sulla meditazione'))
  assert.ok(!parlaDelTema('Influenza, i casi della settimana'))
  const parole = leggiParoleVietate('# commento\nterapia\ncura l\'ansia\n')
  assert.deepEqual(trovaParoleVietate('Un convegno a cura della Sapienza', parole), [])
  assert.deepEqual(trovaParoleVietate('Una nuova Terapia.', parole), ['terapia'])
  assert.deepEqual(trovaParoleVietate('Psicoterapia di gruppo', parole), [], 'parola intera, non pezzo di parola')
})

test('il file delle parole vietate non blocca «a cura di»', async () => {
  const parole = leggiParoleVietate(await readFile(new URL('../prompt/parole_vietate.txt', import.meta.url), 'utf8'))
  assert.deepEqual(trovaParoleVietate('Un incontro a cura dell’associazione', parole), [])
  assert.ok(trovaParoleVietate('Il programma guarisce', parole).includes('guarisce'))
})

test('settimana e ora italiana con l’ora legale', () => {
  assert.equal(lunediDi(new Date('2026-10-22T05:00:00Z')), '2026-10-19')
  assert.equal(lunediDi(new Date('2026-10-25T23:30:00Z')), '2026-10-26', 'lunedì 26 alle 00:30 in Italia (ora solare)')
  assert.equal(istanteItalia('2026-10-22', 17).toISOString(), '2026-10-22T15:00:00.000Z') // CEST
  assert.equal(istanteItalia('2026-11-05', 17).toISOString(), '2026-11-05T16:00:00.000Z') // CET
  assert.equal(invioPrevisto(new Date('2026-10-22T05:00:00Z')).toISOString(), '2026-10-22T15:00:00.000Z')
  assert.equal(invioPrevisto(new Date('2026-10-19T09:00:00Z')).toISOString(), '2026-10-22T15:00:00.000Z', 'lanciata a mano il lunedì: parte giovedì')
})

test('JSON anche dentro un recinto', () => {
  assert.deepEqual(estraiJson('```json\n{"a":1}\n```'), { a: 1 })
  assert.deepEqual(estraiJson('ecco: {"b":2} fine'), { b: 2 })
  assert.equal(estraiJson('niente'), null)
})

test('controlli: una lettera buona passa', () => {
  const r = controllaBozza(bozzaBuona(), { oggi: OGGI, linkOk: tuttiOk, paroleVietate: ['terapia'] })
  assert.deepEqual(r.motivi, [])
  assert.ok(r.ok)
})

test('controlli: ogni problema ferma la lettera', () => {
  const casi = [
    [bozzaBuona({ voci: [voce(), voce({ url: 'https://example.org/b' })] }), /almeno 3/],
    [bozzaBuona({ voci: [voce({ verifica: 'da_controllare', nota_verifica: 'numero sbagliato' }), voce({ url: 'https://example.org/b' }), voce({ url: 'https://example.org/c' })] }), /da controllare/],
    [bozzaBuona({ voci: [voce({ data: '2026-10-01' }), voce({ url: 'https://example.org/b' }), voce({ url: 'https://example.org/c' })] }), /21 giorni fa/],
    [bozzaBuona({ introduzione: 'Una nuova terapia.' }), /parole da evitare/],
    [bozzaBuona({ meditazione: null }), /meditazione/],
    [bozzaBuona({ oggetto: '' }), /oggetto/]
  ]
  for (const [bozza, atteso] of casi) {
    const r = controllaBozza(bozza, { oggi: OGGI, linkOk: tuttiOk, paroleVietate: ['terapia'] })
    assert.ok(!r.ok)
    assert.match(r.motivi.join(' '), atteso)
  }
  const link = controllaBozza(bozzaBuona(), { oggi: OGGI, linkOk: { ...tuttiOk, 'https://example.org/a': false } })
  assert.match(link.motivi.join(' '), /non risponde/)
  assert.match(controllaBozza(bozzaBuona(), { oggi: OGGI, linkOk: tuttiOk, invioAutomatico: false }).motivi.join(), /spento/)
  assert.match(controllaBozza(bozzaBuona(), { oggi: OGGI, linkOk: tuttiOk, giaInviata: true }).motivi.join(), /già partita/)
  assert.match(controllaBozza(bozzaBuona(), { oggi: OGGI, linkOk: tuttiOk, errori: ['tetto'] }).motivi.join(), /tetto/)
})

test('pulizia: niente doppioni né notizie già viste', () => {
  const visti = new Set([hashUrl('https://c.org/3')])
  const fuori = pulisciCandidati([
    { url: 'https://a.org/1?utm_source=x', titolo: 'Uno' },
    { url: 'https://www.a.org/1', titolo: 'Uno bis' },
    { url: 'https://b.org/2', titolo: 'UNO' },
    { url: 'https://c.org/3', titolo: 'Tre' },
    { url: 'https://d.org/4', titolo: 'Quattro' }
  ], visti)
  assert.deepEqual(fuori.map((c) => c.url), ['https://a.org/1', 'https://d.org/4'])
})

test('meditazione a caso, non quella della volta scorsa', () => {
  const elenco = [{ slug: 'a', titolo: 'A' }, { slug: 'b', titolo: 'B' }]
  for (let i = 0; i < 20; i++) assert.equal(scegliMeditazione(elenco, 'a').slug, 'b')
  assert.equal(scegliMeditazione([{ slug: 'a', titolo: 'A' }], 'a').slug, 'a', 'se è l’unica resta quella')
  assert.equal(scegliMeditazione([], 'a'), null)
  const m = meditazioneDaTraccia({ slug: 'x', titolo: 'X', durata_minuti: 3, autore: { nome: 'Mark Williams' }, voce: { tipo: 'umana', nome: 'Dimitri Grassi' }, sfondo: { url: 'https://s/1.jpg', poster_url: 'https://s/p.jpg' } })
  assert.equal(m.voce, 'Dimitri Grassi')
  assert.equal(m.miniatura_url, 'https://s/p.jpg')
  assert.match(svgSovrapposto(3), /3 min/)
})

test('tetto di spesa', () => {
  const c = nuovoConto()
  c.registra('claude-sonnet-5-5', { input_tokens: 1_000_000, output_tokens: 0 }, 'x')
  assert.equal(c.costo, 2)
  assert.throws(() => c.controlla(), TettoSuperato)
  const r = nuovoConto()
  r.registra('claude-haiku-5-5', { input_tokens: 1000, output_tokens: 100, server_tool_use: { web_search_requests: 4 } })
  assert.equal(r.ricerche, 4)
  assert.ok(Math.abs(r.costo - (0.0001 + 0.00005 + 0.04)) < 1e-9)
})

test('lettera: sezioni, meditazione, invito, nota e firma', () => {
  const l = composiLettera({
    bozza: {
      ...bozzaBuona(),
      meditazione: { slug: 'tre-minuti-per-riprendere-fiato', titolo: 'Tre minuti per riprendere fiato', durata_minuti: 3, autore: 'Mark Williams', voce: 'Dimitri Grassi', miniatura_url: 'https://x.supabase.co/m.jpg', miniatura_con_play: true },
      pratica_settimana: 'Tre respiri prima di rispondere.'
    },
    invito: { titolo: 'Otto settimane per praticare insieme', testo: 'Le iscrizioni sono aperte.' },
    linkUscita: 'https://conscio.mnesti.it/#/lettera/esci?u=abc&lista=lettera'
  })
  assert.equal(l.oggetto, 'Respiro e sonno')
  assert.match(l.html, /Lettera settimanale · 22 ottobre 2026/)
  const posizioni = ['Dall’Italia', 'Dal mondo', 'Dalla ricerca'].map((t) => l.html.indexOf(t))
  assert.deepEqual([...posizioni].sort((a, b) => a - b), posizioni)
  assert.ok(!l.html.includes('>Eventi<'), 'le sezioni vuote non compaiono')
  assert.match(l.html, /Meta-analisi di 25 studi/)
  assert.match(l.html, /ascolta\/tre-minuti-per-riprendere-fiato\//)
  assert.ok(!l.html.includes('▶ Ascolta'), 'con il play disegnato non serve il link sotto')
  assert.match(l.html, /Iscriviti al prossimo ciclo/)
  assert.match(l.html, /intelligenza artificiale/)
  assert.match(l.html, /lista=lettera/)
  assert.match(l.html, /ADS Hanuman/)
  assert.match(l.testo, /UNA PRATICA PER LA SETTIMANA/)
  assert.match(l.testo, /Per non riceverla più: https:\/\/conscio/)
})

test('lettera: niente HTML iniettato e link solo https', () => {
  const l = composiLettera({
    bozza: bozzaBuona({ voci: [voce({ titolo: '<img src=x onerror=alert(1)>', url: 'javascript:alert(1)' })], meditazione: { slug: 'a', titolo: 'A' } }),
    linkUscita: 'https://conscio.mnesti.it/#/lettera/esci'
  })
  assert.ok(!l.html.includes('<img src=x'))
  assert.ok(!l.html.includes('javascript:'))
  assert.match(l.html, /▶ Ascolta/, 'senza miniatura il link d’ascolto è in chiaro')
})

test('date in italiano', () => {
  assert.equal(dataLunga('2026-10-16'), '16 ottobre 2026')
  assert.equal(giovediDi('2026-10-19'), '2026-10-22')
})

test('notifiche a Dimitri', () => {
  const p = componiNotifica({ esito: 'programmata', bozza: { ...bozzaBuona(), invio_previsto_il: '2026-10-22T15:00:00Z' }, adesso: new Date('2026-10-22T05:00:00Z') })
  assert.equal(p.oggetto, 'La lettera parte oggi alle 17:00 · 3 notizie')
  assert.match(p.html, /Respiro e sonno/)
  const lunedi = componiNotifica({ esito: 'programmata', bozza: { ...bozzaBuona(), invio_previsto_il: '2026-10-22T15:00:00Z' }, adesso: new Date('2026-10-19T09:00:00Z') })
  assert.equal(lunedi.oggetto, 'La lettera parte giovedì alle 17:00 · 3 notizie')
  const f = componiNotifica({ esito: 'da_rivedere', motivi: ['Ci sono 2 notizie valide'] })
  assert.match(f.testo, /2 notizie valide/)
  assert.match(componiNotifica({ esito: 'errore', errore: 'boom' }).testo, /boom/)
})
