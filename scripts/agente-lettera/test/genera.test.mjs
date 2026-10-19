// Prova dell'intero «genera» con la rete finta: Supabase, feed, PubMed, pagine e API Claude.
import { test } from 'node:test'
import assert from 'node:assert/strict'

const SUPA = 'https://finto.supabase.co'
process.env.SUPABASE_URL = SUPA
process.env.SUPABASE_SERVICE_ROLE_KEY = 'servizio'
process.env.ANTHROPIC_API_KEY = 'chiave'
process.env.RESEND_API_KEY = 'resend'
process.env.FACILITATORE_EMAIL = 'dimitri@example.org'

const oggi = new Date()
const isoGiorni = (n) => new Date(oggi.getTime() - n * 86_400_000).toISOString().slice(0, 10)

function rispondi(corpo, stato = 200, tipo = 'application/json') {
  const testo = typeof corpo === 'string' ? corpo : JSON.stringify(corpo)
  return new Response(testo, { status: stato, headers: { 'content-type': tipo } })
}

function claude(passo, json, usage = { input_tokens: 2000, output_tokens: 400 }) {
  return rispondi({ content: [{ type: 'text', text: JSON.stringify(json) }], stop_reason: 'end_turn', usage, _passo: passo })
}

test('genera: dalla raccolta alla bozza programmata', async () => {
  const scritture = []
  const email = []
  const notizie = [
    { url: 'https://unipd.it/news/respiro', titolo: 'Respiro prima degli esami', area: 'italia' },
    { url: 'https://mindful.org/schools', titolo: 'Mindfulness nelle scuole', area: 'mondo' },
    { url: 'https://pubmed.ncbi.nlm.nih.gov/123/', titolo: 'Mindfulness and sleep: a meta-analysis', area: 'mondo' },
    { url: 'https://mindful.org/ad', titolo: 'Scarica la nostra app mindful', area: 'mondo' }
  ]

  globalThis.fetch = async (input, init = {}) => {
    const url = String(input)
    const metodo = init.method || 'GET'
    if (url.startsWith(`${SUPA}/rest/v1/`)) {
      const percorso = url.slice(`${SUPA}/rest/v1/`.length)
      if (metodo !== 'GET') scritture.push({ percorso, corpo: init.body ? JSON.parse(init.body) : null })
      if (percorso.startsWith('bozze_lettera?select=id,stato')) return rispondi([])
      if (percorso.startsWith('bozze_lettera?select=meditazione')) return rispondi([{ meditazione: { slug: 'anche-io-sono-un-fiore' } }])
      if (percorso.startsWith('bozze_lettera?select=id&')) return rispondi([])
      if (percorso.startsWith('bozze_lettera?on_conflict')) return rispondi([{ id: 'b1' }])
      if (percorso.startsWith('fonti_lettera')) return rispondi([
        { nome: 'PubMed', dominio: 'pubmed.ncbi.nlm.nih.gov', rss: null, area: 'mondo', tipo: 'ricerca', peso: 3, attiva: true, escluso: false },
        { nome: 'Mindful.org', dominio: 'mindful.org', rss: 'https://mindful.org/feed/', area: 'mondo', tipo: 'divulgazione', peso: 2, attiva: true, escluso: false },
        { nome: 'Università di Padova', dominio: 'unipd.it', rss: null, area: 'italia', tipo: 'universita', peso: 2, attiva: true, escluso: false }
      ])
      if (percorso.startsWith('notizie_lettera?select')) return rispondi([])
      if (percorso.startsWith('notizie_lettera?on_conflict')) return rispondi([])
      if (percorso.startsWith('impostazioni_sito')) return rispondi([{ invio_automatico: true }])
      if (percorso === 'rpc/vetrina_elenco') return rispondi([
        { slug: 'anche-io-sono-un-fiore', titolo: 'Anche io sono un fiore' },
        { slug: 'tre-minuti-per-riprendere-fiato', titolo: 'Tre minuti per riprendere fiato', durata_minuti: 3, autore: { nome: 'Mark Williams' }, voce: { tipo: 'umana', nome: 'Dimitri Grassi' }, sfondo: {} }
      ])
      if (percorso === 'rpc/vetrina_impostazioni') return rispondi({ cta_titolo: 'Il percorso', cta_testo: 'Aperte', cta_testo_senza_ciclo: 'Presto', iscrizioni_aperte: false })
      if (percorso === 'rpc/pulisci_notizie_lettera') return rispondi(0)
      throw new Error(`Supabase non previsto: ${metodo} ${percorso}`)
    }
    if (url === 'https://mindful.org/feed/') {
      const items = notizie.filter((n) => n.url.includes('mindful.org')).map((n) => `<item><title>${n.titolo}</title><link>${n.url}</link><pubDate>${new Date(oggi.getTime() - 2 * 86_400_000).toUTCString()}</pubDate></item>`).join('')
      return rispondi(`<rss><channel>${items}</channel></rss>`, 200, 'application/rss+xml')
    }
    if (url.includes('esearch.fcgi')) return rispondi({ esearchresult: { idlist: ['123'] } })
    if (url.includes('esummary.fcgi')) return rispondi({ result: { 123: { title: notizie[2].titolo, sortpubdate: `${isoGiorni(3).replaceAll('-', '/')} 00:00`, fulljournalname: 'Mindfulness', pubtype: ['Meta-Analysis'] } } })
    if (url.includes('efetch.fcgi')) return rispondi('Meta-analysis of 25 trials. Limitations: heterogeneity.', 200, 'text/plain')
    if (url.startsWith('https://pubmed.ncbi.nlm.nih.gov/123')) return rispondi('<html>PubMed</html>', 200, 'text/html')
    if (url.startsWith('https://unipd.it') || url.startsWith('https://mindful.org/')) {
      return rispondi(`<html><article><p>Testo della notizia, pubblicata il ${isoGiorni(2)}.</p></article></html>`, 200, 'text/html')
    }
    if (url === 'https://api.anthropic.com/v1/messages') {
      const corpo = JSON.parse(init.body)
      assert.equal(corpo.system[0].cache_control.type, 'ephemeral', 'la linea editoriale va in cache')
      const domanda = corpo.messages[0].content
      if (corpo.tools) {
        return rispondi({
          content: [
            { type: 'server_tool_use', id: 's1', name: 'web_search', input: { query: 'mindfulness' } },
            { type: 'web_search_tool_result', tool_use_id: 's1', content: [{ type: 'web_search_result', url: notizie[0].url, title: notizie[0].titolo, page_age: '2 days ago' }] },
            { type: 'text', text: 'fatto' }
          ],
          stop_reason: 'end_turn',
          usage: { input_tokens: 3000, output_tokens: 100, server_tool_use: { web_search_requests: 3 } }
        })
      }
      assert.ok(domanda.includes('<dati>'), 'i contenuti esterni arrivano come dati')
      if (domanda.startsWith('Per ogni candidato')) {
        const elenco = JSON.parse(domanda.slice(domanda.indexOf('<dati>') + 6, domanda.indexOf('</dati>')))
        return claude('smista', { esiti: elenco.map((c) => ({ id: c.id, pertinente: !c.titolo.includes('app'), motivo: c.titolo.includes('app') ? 'pubblicità' : 'ok' })) })
      }
      if (domanda.startsWith('Scegli da')) {
        const elenco = JSON.parse(domanda.slice(domanda.indexOf('<dati>') + 6, domanda.indexOf('</dati>')))
        const sez = (c) => (c.fonte === 'PubMed' ? 'ricerca' : c.area)
        return claude('seleziona', { scelte: elenco.map((c) => ({ id: c.id, sezione: sez(c), motivo: 'ok' })), riserve: [], nota: 'Tre notizie.' })
      }
      if (domanda.startsWith('Scrivi le voci')) {
        const elenco = JSON.parse(domanda.slice(domanda.indexOf('<dati>') + 6, domanda.indexOf('</dati>')))
        return claude('scrivi', {
          oggetto: 'Respiro, scuole e sonno',
          introduzione: 'Tre notizie questa settimana.',
          voci: elenco.map((n) => ({ id: n.id, titolo: `Titolo ${n.id}`, sunto: 'Sunto con parole proprie.', perche_conta: 'Perché interessa.', tipo_studio: n.sezione === 'ricerca' ? 'Meta-analisi di 25 studi' : null, data: isoGiorni(2) }))
        })
      }
      if (domanda.startsWith('Controlla ogni voce')) {
        const elenco = JSON.parse(domanda.slice(domanda.indexOf('<dati>') + 6, domanda.indexOf('</dati>')))
        return claude('verifica', { esiti: elenco.map((v) => ({ id: v.id, esito: 'verificata', nota: 'ok' })) })
      }
      throw new Error(`domanda non prevista: ${domanda.slice(0, 40)}`)
    }
    if (url === 'https://api.resend.com/emails') {
      email.push(JSON.parse(init.body))
      return rispondi({ id: 'e1' })
    }
    throw new Error(`fetch non previsto: ${metodo} ${url}`)
  }

  const { generaPerProva } = await import('../index.mjs')
  await generaPerProva({ asciutto: false, forza: false })

  const bozza = scritture.find((s) => s.percorso.startsWith('bozze_lettera?on_conflict')).corpo[0]
  assert.equal(bozza.stato, 'programmata', bozza.motivo_fermo)
  assert.equal(bozza.voci.length, 3)
  assert.deepEqual(bozza.voci.map((v) => v.sezione), ['italia', 'mondo', 'ricerca'])
  assert.ok(bozza.voci.every((v) => !('_testo' in v)), 'i testi delle pagine non si salvano')
  assert.equal(bozza.meditazione.slug, 'tre-minuti-per-riprendere-fiato', 'non la stessa della volta scorsa')
  assert.ok(bozza.invio_previsto_il)
  assert.ok(bozza.resoconto.costo_stimato_usd > 0)
  assert.equal(bozza.resoconto.ricerche, 3)

  const viste = scritture.find((s) => s.percorso.startsWith('notizie_lettera?on_conflict')).corpo
  assert.ok(viste.some((n) => n.esito === 'scartata' && /pubblicità/.test(n.motivo)))
  assert.equal(viste.filter((n) => n.esito === 'usata').length, 3)

  assert.equal(email.length, 1)
  assert.match(email[0].subject, /^La lettera parte \S+ alle \d\d:\d\d · 3 notizie$/)
  assert.deepEqual(email[0].to, ['dimitri@example.org'])
})
