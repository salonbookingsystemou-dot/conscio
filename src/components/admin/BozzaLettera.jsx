// «Lettera della settimana»: la bozza preparata dall'agente, da rivedere prima dell'invio automatico
// (docs/brief_agente_lettera.md, sez. 6). Solo facilitatore; nessun dato dei partecipanti né degli iscritti.
import { useEffect, useMemo, useState } from 'react'
import AdminDialogo from '../AdminDialogo.jsx'
import DialogConferma from '../DialogConferma.jsx'
import StatoAttesa from '../StatoAttesa.jsx'
import StatoVuoto from '../StatoVuoto.jsx'
import Badge from './Badge.jsx'
import { useSnackbar } from './Snackbar.jsx'
import {
  aggiornaFonteLettera,
  avviaGenerazioneLettera,
  messaggioGenerazione,
  controllaBozzaClient,
  esitoInvio,
  impostaInvioAutomatico,
  inviaBozzaLettera,
  leggiBozzaLettera,
  leggiFontiLettera,
  leggiInvioAutomatico,
  prossimoInvio,
  salvaBozzaLettera,
  settimanaCorrente
} from '../../lib/lettera.js'
import { leggiElenco, leggiImpostazioniPubbliche } from '../../lib/vetrina.js'
import { composiLettera, SEZIONI } from '../../../supabase/functions/_shared/letteraSettimanale.ts'

const NOMI_SEZIONE = Object.fromEntries(SEZIONI.map(s => [s.id, s.titolo]))
const AREE = { italia: 'Italia', mondo: 'Mondo' }

function quando(istante) {
  const d = new Date(istante)
  const giorno = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', weekday: 'long', day: 'numeric', month: 'long' }).format(d)
  const ora = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' }).format(d)
  return { giorno, ora }
}

function rigaStato(bozza) {
  if (!bozza) return null
  if (bozza.stato === 'programmata') {
    const { giorno, ora } = quando(bozza.invio_previsto_il)
    return { tono: 'ok', testo: `Parte da sola ${giorno} alle ${ora}` }
  }
  if (bozza.stato === 'bloccata') return { tono: 'attenzione', testo: 'Bloccata: non parte da sola' }
  if (bozza.stato === 'da_rivedere') return { tono: 'attenzione', testo: 'Ferma: non parte da sola' }
  if (bozza.stato === 'in_invio') return { tono: 'attenzione', testo: 'Invio in corso' }
  if (bozza.stato === 'inviata') return { tono: 'ok', testo: 'Inviata' }
  return { tono: 'errore', testo: 'Scartata' }
}

function sposta(lista, i, passo) {
  const j = i + passo
  if (j < 0 || j >= lista.length) return lista
  const copia = [...lista]
  ;[copia[i], copia[j]] = [copia[j], copia[i]]
  return copia
}

function Voce({ voce, indice, totale, modificabile, onCambia, onTogli, onSposta }) {
  const id = `lettera-voce-${indice}`
  return (
    <li className="lettera-voce">
      <div className="lettera-voce-testa">
        <span className="lettera-voce-sezione">{NOMI_SEZIONE[voce.sezione] || voce.sezione}</span>
        <Badge tono={voce.verifica === 'verificata' ? 'ok' : 'attenzione'}>
          {voce.verifica === 'verificata' ? 'Verificata' : 'Da controllare'}
        </Badge>
      </div>
      {voce.verifica !== 'verificata' && voce.nota_verifica && (
        <p className="lettera-voce-nota">{voce.nota_verifica}</p>
      )}
      <div className="field">
        <label htmlFor={`${id}-titolo`}>Titolo</label>
        <input id={`${id}-titolo`} value={voce.titolo} disabled={!modificabile} onChange={e => onCambia({ titolo: e.target.value })} />
      </div>
      {voce.sezione === 'ricerca' && (
        <div className="field">
          <label htmlFor={`${id}-studio`}>Tipo di studio</label>
          <input id={`${id}-studio`} value={voce.tipo_studio || ''} disabled={!modificabile} onChange={e => onCambia({ tipo_studio: e.target.value })} />
        </div>
      )}
      <div className="field">
        <label htmlFor={`${id}-sunto`}>Sunto</label>
        <textarea id={`${id}-sunto`} rows={4} value={voce.sunto} disabled={!modificabile} onChange={e => onCambia({ sunto: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor={`${id}-conta`}>Perché conta</label>
        <input id={`${id}-conta`} value={voce.perche_conta || ''} disabled={!modificabile} onChange={e => onCambia({ perche_conta: e.target.value })} />
      </div>
      <div className="lettera-voce-piede">
        <a href={voce.url} target="_blank" rel="noreferrer noopener">{voce.fonte} · {voce.data}</a>
        {modificabile && (
          <span className="lettera-voce-azioni">
            <button type="button" className="btn btn-text is-piccolo" disabled={indice === 0} onClick={() => onSposta(-1)} aria-label={`Sposta su «${voce.titolo}»`}>Su</button>
            <button type="button" className="btn btn-text is-piccolo" disabled={indice === totale - 1} onClick={() => onSposta(1)} aria-label={`Sposta giù «${voce.titolo}»`}>Giù</button>
            <button type="button" className="btn btn-text is-piccolo" onClick={onTogli}>Togli</button>
          </span>
        )}
      </div>
    </li>
  )
}

function Fonti() {
  const [fonti, setFonti] = useState(null)
  const [errore, setErrore] = useState(null)

  useEffect(() => {
    leggiFontiLettera().then(setFonti).catch(() => setErrore('Non è stato possibile leggere le fonti.'))
  }, [])

  async function cambia(fonte, campi) {
    const prima = fonti
    setFonti(fonti.map(f => (f.id === fonte.id ? { ...f, ...campi } : f)))
    try {
      await aggiornaFonteLettera(fonte.id, campi)
    } catch {
      setFonti(prima)
      setErrore('La modifica non è stata salvata. Riprova.')
    }
  }

  if (errore) return <p className="avviso-errore" role="alert">{errore}</p>
  if (!fonti) return <StatoAttesa etichetta="Carico le fonti…" />
  if (!fonti.length) return <StatoVuoto titolo="Nessuna fonte">Aggiungile dal database (tabella fonti_lettera).</StatoVuoto>
  return (
    <div className="lettera-fonti">
      <table>
        <thead>
          <tr><th scope="col">Fonte</th><th scope="col">Area</th><th scope="col">Peso</th><th scope="col">Attiva</th><th scope="col">Esclusa</th></tr>
        </thead>
        <tbody>
          {fonti.map(f => (
            <tr key={f.id}>
              <td>
                <span className="lettera-fonte-nome">{f.nome}</span>
                <span className="hint">{f.dominio}{f.rss ? ' · feed' : ''}{f.nota ? ` · ${f.nota}` : ''}</span>
              </td>
              <td>{AREE[f.area] || f.area}</td>
              <td>
                <select aria-label={`Peso di ${f.nome}`} value={f.peso} onChange={e => cambia(f, { peso: Number(e.target.value) })}>
                  <option value={1}>1</option><option value={2}>2</option><option value={3}>3</option>
                </select>
              </td>
              <td><input type="checkbox" aria-label={`${f.nome} attiva`} checked={f.attiva} onChange={e => cambia(f, { attiva: e.target.checked })} /></td>
              <td><input type="checkbox" aria-label={`${f.nome} esclusa`} checked={f.escluso} onChange={e => cambia(f, { escluso: e.target.checked })} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Resoconto({ resoconto }) {
  if (!resoconto) return <p className="hint">Nessun resoconto.</p>
  const nonRaggiunte = (resoconto.fonti || []).filter(f => f.esito !== 'ok')
  return (
    <div className="lettera-resoconto">
      <dl className="com-dati">
        <div><dt>Candidati trovati</dt><dd>{resoconto.candidati ?? 0}</dd></div>
        <div><dt>Scartati</dt><dd>{resoconto.scartati ?? 0}</dd></div>
        <div><dt>Ricerche web</dt><dd>{resoconto.ricerche ?? 0}</dd></div>
        <div><dt>Costo stimato</dt><dd>{(resoconto.costo_stimato_usd ?? 0).toLocaleString('it-IT', { style: 'currency', currency: 'USD', maximumFractionDigits: 3 })}</dd></div>
      </dl>
      {resoconto.nota_selezione && <p className="hint">Selezione: {resoconto.nota_selezione}</p>}
      {nonRaggiunte.length > 0 && (
        <p className="hint">Fonti non raggiunte: {nonRaggiunte.map(f => f.fonte).join(', ')}.</p>
      )}
      {(resoconto.errori || []).length > 0 && (
        <ul className="lettera-motivi">{resoconto.errori.map(e => <li key={e}>{e}</li>)}</ul>
      )}
    </div>
  )
}

export default function BozzaLettera() {
  const { mostra } = useSnackbar()
  const [bozza, setBozza] = useState(undefined) // undefined = in caricamento, null = nessuna
  const [modifica, setModifica] = useState(null)
  const [automatico, setAutomatico] = useState(true)
  const [invito, setInvito] = useState(null)
  const [errLettura, setErrLettura] = useState(null)
  const [errore, setErrore] = useState(null)
  const [occupato, setOccupato] = useState(false)
  const [confermaInvio, setConfermaInvio] = useState(false)
  const [anteprima, setAnteprima] = useState(false)
  const [generazione, setGenerazione] = useState(null) // istante in cui è partita, finché la bozza non arriva
  const [confermaGenera, setConfermaGenera] = useState(false)

  async function carica() {
    try {
      const [b, auto] = await Promise.all([leggiBozzaLettera(), leggiInvioAutomatico()])
      setBozza(b)
      setModifica(b ? { ...b } : null)
      setAutomatico(auto)
      setErrLettura(null)
    } catch {
      setBozza(null)
      setErrLettura('Non è stato possibile leggere la lettera della settimana.')
    }
  }

  useEffect(() => {
    carica()
    leggiImpostazioniPubbliche()
      .then(imp => setInvito({ titolo: imp.cta_titolo, testo: imp.iscrizioni_aperte ? imp.cta_testo : imp.cta_testo_senza_ciclo }))
      .catch(() => setInvito(null))
  }, [])

  // Dopo «Genera lettera» si guarda ogni 20 secondi se la bozza è arrivata (il job dura pochi minuti).
  useEffect(() => {
    if (!generazione) return undefined
    const inizio = generazione
    const timer = setInterval(async () => {
      try {
        const b = await leggiBozzaLettera()
        if (b && new Date(b.aggiornata_il).getTime() >= inizio - 5000) {
          setBozza(b)
          setModifica({ ...b })
          setGenerazione(null)
          mostra({ testo: 'La lettera è pronta' })
          return
        }
      } catch {
        /* si riprova al giro dopo */
      }
      if (Date.now() - inizio > 12 * 60_000) {
        setGenerazione(null)
        setErrore('La lettera non è ancora arrivata. Controlla l’email: se la preparazione si è fermata, lì trovi il motivo.')
      }
    }, 20_000)
    return () => clearInterval(timer)
  }, [generazione, mostra])

  const diversa = useMemo(() => {
    if (!bozza || !modifica) return false
    return ['oggetto', 'introduzione', 'pratica_settimana', 'voci', 'meditazione']
      .some(k => JSON.stringify(bozza[k] ?? null) !== JSON.stringify(modifica[k] ?? null))
  }, [bozza, modifica])

  const controlli = useMemo(() => (modifica ? controllaBozzaClient(modifica, { invioAutomatico: automatico }) : null), [modifica, automatico])

  if (bozza === undefined) return <StatoAttesa etichetta="Carico la lettera della settimana…" />
  if (errLettura) return <p className="avviso-errore" role="alert">{errLettura}</p>

  const dellaSettimana = bozza && bozza.settimana === settimanaCorrente()
  const modificabile = Boolean(bozza) && ['da_rivedere', 'programmata', 'bloccata'].includes(bozza.stato)
  const stato = rigaStato(bozza)
  const motivi = bozza?.stato === 'da_rivedere' && bozza.motivo_fermo ? bozza.motivo_fermo.split('\n').filter(Boolean) : []

  function cambiaVoce(i, campi) {
    setModifica(m => ({ ...m, voci: m.voci.map((v, j) => (j === i ? { ...v, ...campi } : v)) }))
  }

  async function salva() {
    setErrore(null)
    setOccupato(true)
    try {
      const campi = {
        oggetto: modifica.oggetto.trim() || bozza.oggetto,
        introduzione: modifica.introduzione,
        voci: modifica.voci,
        meditazione: modifica.meditazione,
        pratica_settimana: modifica.pratica_settimana?.trim() || null
      }
      // Una lettera programmata resta programmata solo se passa ancora i controlli.
      if (bozza.stato === 'programmata') {
        const esito = controllaBozzaClient({ ...bozza, ...campi }, { invioAutomatico: automatico })
        if (!esito.ok) Object.assign(campi, { stato: 'da_rivedere', motivo_fermo: esito.motivi.join('\n') })
      }
      const salvata = await salvaBozzaLettera(bozza.id, campi)
      setBozza(salvata)
      setModifica({ ...salvata })
      mostra({ testo: salvata.stato === 'da_rivedere' && bozza.stato === 'programmata' ? 'Modifiche salvate · la lettera non parte più da sola' : 'Modifiche salvate' })
    } catch {
      setErrore('Le modifiche non sono state salvate. Riprova.')
    }
    setOccupato(false)
  }

  async function blocca() {
    setErrore(null)
    try {
      const salvata = await salvaBozzaLettera(bozza.id, { stato: 'bloccata' })
      setBozza(salvata)
      setModifica({ ...salvata })
      mostra({
        testo: 'Invio bloccato',
        annulla: async () => {
          const ripresa = await salvaBozzaLettera(bozza.id, { stato: 'programmata' })
          setBozza(ripresa)
          setModifica({ ...ripresa })
        }
      })
    } catch {
      setErrore('Non è stato possibile bloccare l’invio. Riprova.')
    }
  }

  async function programma() {
    setErrore(null)
    if (diversa) {
      setErrore('Prima salva le modifiche.')
      return
    }
    const esito = controllaBozzaClient(bozza, { invioAutomatico: automatico })
    if (!esito.ok) {
      setErrore(`Non si può programmare: ${esito.motivi.join(' ')}`)
      return
    }
    const quandoParte = prossimoInvio(bozza.settimana)
    if (quandoParte.getTime() < Date.now() - 60_000) {
      setErrore('Il giovedì di questa settimana è passato: usa «Invia ora».')
      return
    }
    try {
      const salvata = await salvaBozzaLettera(bozza.id, { stato: 'programmata', invio_previsto_il: quandoParte.toISOString(), motivo_fermo: null })
      setBozza(salvata)
      setModifica({ ...salvata })
      const { giorno, ora } = quando(salvata.invio_previsto_il)
      mostra({ testo: `Programmata per ${giorno} alle ${ora}` })
    } catch {
      setErrore('Non è stato possibile programmarla. Riprova.')
    }
  }

  async function invia(prova) {
    setErrore(null)
    if (diversa) {
      setErrore('Prima salva le modifiche.')
      return
    }
    setOccupato(true)
    try {
      const esito = await inviaBozzaLettera(bozza.id, prova)
      if (esito?.motivo === 'NON_PROGRAMMATA') setErrore('La lettera è già partita o è in invio.')
      else if (esito?.motivo === 'GIA_INVIATA') setErrore('Questa settimana è già partita una lettera.')
      else {
        const { testo, errore: problema } = esitoInvio(esito, prova)
        if (testo) mostra({ testo })
        if (problema) setErrore(problema)
      }
      if (!prova) await carica()
    } catch {
      setErrore(prova ? 'La prova non è partita. Riprova tra un momento.' : 'L’invio non è partito. Riprova tra un momento.')
    }
    setOccupato(false)
  }

  async function cambiaAutomatico(acceso) {
    setErrore(null)
    const prima = automatico
    setAutomatico(acceso)
    try {
      await impostaInvioAutomatico(acceso)
      mostra({
        testo: acceso ? 'Invio automatico acceso' : 'Invio automatico spento',
        annulla: async () => {
          await impostaInvioAutomatico(prima)
          setAutomatico(prima)
        }
      })
    } catch {
      setAutomatico(prima)
      setErrore('Non è stato possibile cambiare l’invio automatico.')
    }
  }

  async function altraMeditazione() {
    setErrore(null)
    try {
      const elenco = await leggiElenco()
      const altre = elenco.filter(t => t.slug !== modifica.meditazione?.slug)
      if (!altre.length) {
        setErrore('In vetrina non ci sono altre meditazioni.')
        return
      }
      const t = altre[Math.floor(Math.random() * altre.length)]
      setModifica(m => ({
        ...m,
        meditazione: {
          slug: t.slug,
          titolo: t.titolo,
          descrizione: t.descrizione || null,
          durata_minuti: t.durata_minuti || null,
          autore: t.autore?.nome || null,
          voce: t.voce?.tipo === 'umana' ? t.voce?.nome || null : t.voce?.tipo === 'sintetica' ? 'sintetica' : null,
          sfondo_url: t.sfondo?.poster_url || t.sfondo?.url || null,
          // La miniatura con il play la prepara l'agente: per una scelta a mano si usa lo sfondo com'è.
          miniatura_url: t.sfondo?.poster_url || t.sfondo?.url || null,
          miniatura_con_play: false
        }
      }))
    } catch {
      setErrore('Non è stato possibile leggere la vetrina.')
    }
  }

  async function genera() {
    setErrore(null)
    setConfermaGenera(false)
    setOccupato(true)
    try {
      const esito = await avviaGenerazioneLettera()
      const problema = messaggioGenerazione(esito)
      if (problema) setErrore(problema)
      else {
        setGenerazione(Date.now())
        mostra({ testo: 'Preparazione avviata · pronta in qualche minuto' })
      }
    } catch {
      setErrore('Non è partita. Riprova tra un momento.')
    }
    setOccupato(false)
  }

  const puoGenerare = !bozza || !dellaSettimana || ['da_rivedere', 'programmata', 'bloccata', 'scartata'].includes(bozza.stato)

  const html = anteprima && modifica
    ? composiLettera({ bozza: modifica, invito, linkUscita: 'https://conscio.mnesti.it/#/lettera/esci' }).html
    : ''

  return (
    <section className="com-sezione lettera-settimana" aria-labelledby="lettera-settimana-titolo">
      <h3 id="lettera-settimana-titolo">Lettera della settimana</h3>

      <label className="vetrina-spunta">
        <input type="checkbox" checked={automatico} onChange={e => cambiaAutomatico(e.target.checked)} />
        <span>Invio automatico</span>
      </label>
      <p className="hint">
        Ogni giovedì alle 7 l’agente prepara la lettera con 3–5 notizie e una meditazione della vetrina.
        Se tutti i controlli passano, alle 17 parte da sola. Spento, la lettera si prepara ma resta qui da inviare a mano.
      </p>

      {generazione
        ? <StatoAttesa etichetta="Preparo la lettera: cerco le notizie, scrivo i sunti e li controllo. Ci vogliono alcuni minuti…" />
        : puoGenerare && (
          <p className="lettera-genera">
            <button
              type="button"
              className={bozza && dellaSettimana ? 'btn btn-text' : 'btn'}
              disabled={occupato}
              onClick={() => (bozza && dellaSettimana ? setConfermaGenera(true) : genera())}
            >
              {bozza && dellaSettimana ? 'Rigenera la lettera' : 'Genera lettera'}
            </button>
          </p>
          )}

      {!bozza || !dellaSettimana
        ? (
          <StatoVuoto titolo="Nessuna lettera questa settimana">
            La prossima si prepara da sola giovedì mattina, oppure adesso con «Genera lettera». {bozza ? `L’ultima è della settimana del ${new Date(bozza.settimana).toLocaleDateString('it-IT')}.` : ''}
          </StatoVuoto>
          )
        : (
          <div className="lettera-bozza">
            {stato && <p className="lettera-stato"><Badge tono={stato.tono}>{stato.testo}</Badge></p>}
            {motivi.length > 0 && (
              <ul className="lettera-motivi">{motivi.map(m => <li key={m}>{m}</li>)}</ul>
            )}

            <div className="field">
              <label htmlFor="lettera-bozza-oggetto">Oggetto</label>
              <input id="lettera-bozza-oggetto" maxLength={200} value={modifica.oggetto} disabled={!modificabile} onChange={e => setModifica({ ...modifica, oggetto: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="lettera-bozza-intro">Introduzione</label>
              <textarea id="lettera-bozza-intro" rows={3} value={modifica.introduzione || ''} disabled={!modificabile} onChange={e => setModifica({ ...modifica, introduzione: e.target.value })} />
            </div>

            {modifica.voci.length === 0
              ? <p className="hint">L’agente non ha trovato notizie valide questa settimana.</p>
              : (
                <ol className="lettera-voci">
                  {modifica.voci.map((v, i) => (
                    <Voce
                      key={v.url}
                      voce={v}
                      indice={i}
                      totale={modifica.voci.length}
                      modificabile={modificabile}
                      onCambia={campi => cambiaVoce(i, campi)}
                      onTogli={() => setModifica(m => ({ ...m, voci: m.voci.filter((_, j) => j !== i) }))}
                      onSposta={passo => setModifica(m => ({ ...m, voci: sposta(m.voci, i, passo) }))}
                    />
                  ))}
                </ol>
                )}

            <div className="lettera-pratica">
              <p className="lettera-voce-sezione">Una pratica per la settimana</p>
              {modifica.meditazione
                ? (
                  <div className="lettera-meditazione">
                    {modifica.meditazione.miniatura_url && <img src={modifica.meditazione.miniatura_url} alt="" />}
                    <div>
                      <p className="lettera-meditazione-titolo">{modifica.meditazione.titolo}</p>
                      <p className="hint">{[modifica.meditazione.durata_minuti && `${modifica.meditazione.durata_minuti} min`, modifica.meditazione.autore].filter(Boolean).join(' · ')}</p>
                    </div>
                  </div>
                  )
                : <p className="hint">Nessuna meditazione: la vetrina è spenta o vuota.</p>}
              {modificabile && (
                <button type="button" className="btn btn-text is-piccolo" onClick={altraMeditazione}>Scegli un’altra meditazione</button>
              )}
              <div className="field">
                <label htmlFor="lettera-bozza-pratica">Una riga tua (facoltativa)</label>
                <textarea id="lettera-bozza-pratica" rows={2} value={modifica.pratica_settimana || ''} disabled={!modificabile} onChange={e => setModifica({ ...modifica, pratica_settimana: e.target.value })} />
              </div>
            </div>

            {errore && <p className="avviso-errore" role="alert">{errore}</p>}
            {modificabile && controlli && !controlli.ok && bozza.stato !== 'da_rivedere' && (
              <p className="hint">Con queste modifiche la lettera non passa i controlli: salvando non partirà da sola.</p>
            )}

            <div className="dialogo-azioni lettera-azioni">
              {modificabile && (
                <button type="button" className="btn" disabled={!diversa || occupato} onClick={salva}>
                  {occupato ? <StatoAttesa inline etichetta="Salvo…" /> : 'Salva le modifiche'}
                </button>
              )}
              {bozza.stato === 'programmata' && (
                <button type="button" className="btn btn-ghost" disabled={occupato} onClick={blocca}>Blocca l’invio</button>
              )}
              {['da_rivedere', 'bloccata'].includes(bozza.stato) && (
                <button type="button" className="btn btn-ghost" disabled={occupato} onClick={programma}>Programma</button>
              )}
              {modificabile && (
                <button type="button" className="btn btn-ghost" disabled={occupato || modifica.voci.length === 0} onClick={() => setConfermaInvio(true)}>Invia ora</button>
              )}
              <button type="button" className="btn btn-text" disabled={occupato} onClick={() => invia(true)}>Invia una prova a me</button>
              <button type="button" className="btn btn-text" onClick={() => setAnteprima(true)}>Anteprima</button>
            </div>
          </div>
          )}

      <details className="lettera-dettagli">
        <summary>Resoconto dell’ultima preparazione</summary>
        <Resoconto resoconto={bozza?.resoconto} />
      </details>
      <details className="lettera-dettagli">
        <summary>Fonti</summary>
        <Fonti />
      </details>

      {anteprima && (
        <AdminDialogo titolo="Anteprima della lettera" className="is-ascolto lettera-anteprima" onChiudi={() => setAnteprima(false)}>
          <p className="hint">Oggetto: {modifica?.oggetto}</p>
          <iframe title="Anteprima della lettera" srcDoc={html} sandbox="" />
          <div className="dialogo-azioni">
            <button type="button" className="btn" onClick={() => setAnteprima(false)}>Chiudi</button>
          </div>
        </AdminDialogo>
      )}

      <DialogConferma
        aperto={confermaGenera}
        titolo="Rigenerare la lettera?"
        confermaEtichetta="Rigenera"
        occupato={occupato}
        onConferma={genera}
        onAnnulla={() => setConfermaGenera(false)}
      >
        L’agente prepara una lettera nuova da capo e sostituisce questa: le modifiche fatte a mano si perdono.
        Può scegliere di nuovo le stesse notizie, mai quelle delle settimane passate.
      </DialogConferma>

      <DialogConferma
        aperto={confermaInvio}
        titolo="Inviare la lettera adesso?"
        confermaEtichetta="Invia ora"
        occupato={occupato}
        onConferma={() => { setConfermaInvio(false); invia(false) }}
        onAnnulla={() => setConfermaInvio(false)}
      >
        «{bozza?.oggetto}» parte subito a tutti gli iscritti confermati alla lettera settimanale, un’email per persona.
        Un’email inviata non si può ritirare.
      </DialogConferma>
    </section>
  )
}
