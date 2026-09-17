import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import LibreriaTracce, { SelettoreTraccia } from '../components/LibreriaTracce.jsx'
import CardTracciaAudio from '../components/CardTracciaAudio.jsx'
import DialogConferma from '../components/DialogConferma.jsx'
import {
  creaTraccia,
  elencaTracce,
  leggiTestoCard,
  messaggioErroreTraccia,
  rinominaTraccia,
  titoloDaNomeFile,
  testoDaUrlAudio,
  trovaTracciaDi,
  urlConTestoCard,
  urlTracciaDi,
  usiTracce
} from '../lib/tracce'

const NUMERI_SETTIMANA = [1, 2, 3, 4, 5, 6, 7, 8, 9]

function etichettaSettimana(numero) {
  return numero === 9 ? 'Intensiva' : `Settimana ${numero}`
}

function eFormale(esercizio) {
  const tipo = (esercizio.tipo || '').toLowerCase()
  return tipo === 'formale' || tipo === 'a_casa'
}

function eInformale(esercizio) {
  return (esercizio.tipo || '').toLowerCase() === 'informale'
}

function metaVuota(numero = 1) {
  return {
    numero_settimana: numero,
    tema: '',
    sottotitolo: '',
    materiali: '',
    pratiche_formali: '',
    pratiche_informali: ''
  }
}

export default function Lezioni() {
  const [cicli, setCicli] = useState([])
  const [cicloId, setCicloId] = useState('')
  const [lezioni, setLezioni] = useState([])
  const [libreria, setLibreria] = useState([])
  const [usi, setUsi] = useState({})
  const [settimana, setSettimana] = useState(1)
  const [meta, setMeta] = useState(metaVuota(1))
  const [nuovaFormale, setNuovaFormale] = useState({ descrizione: '', durata_minuti: '' })
  const [nuovaInformale, setNuovaInformale] = useState('')
  const [modificaEx, setModificaEx] = useState(null)
  const [caricamentoEsercizioId, setCaricamentoEsercizioId] = useState(null)
  const [caricamentoLibreriaId, setCaricamentoLibreriaId] = useState(null)
  const [invioMeta, setInvioMeta] = useState(false)
  const [errore, setErrore] = useState(null)
  const [okMsg, setOkMsg] = useState(null)
  const [confermaEliminaSettimana, setConfermaEliminaSettimana] = useState(false)
  const [daEliminareEx, setDaEliminareEx] = useState(null)
  const pillsRef = useRef(null)

  async function caricaLibreria() {
    try {
      const [lista, conteggi] = await Promise.all([elencaTracce(), usiTracce()])
      setLibreria(lista)
      setUsi(conteggi)
    } catch {
      setErrore('Non è stato possibile leggere la libreria tracce.')
    }
  }

  useEffect(() => {
    let vivo = true
    supabase.from('cicli').select('id, nome_ciclo, stato').order('data_inizio', { ascending: false })
      .then(({ data }) => {
        if (!vivo) return
        const lista = data || []
        setCicli(lista)
        setCicloId(prev => {
          if (prev && lista.some(c => c.id === prev)) return prev
          return lista[0]?.id || ''
        })
      })
    caricaLibreria()
    return () => { vivo = false }
  }, [])

  async function caricaLezioni(id) {
    if (!id) {
      setLezioni([])
      return
    }
    const colonne = 'id, numero_settimana, tema, sottotitolo, pratiche_formali, pratiche_informali, materiali, esercizi(id, tipo, descrizione, traccia_audio, traccia_id, ordine, durata_minuti)'
    let { data, error } = await supabase
      .from('lezioni')
      .select(colonne)
      .eq('ciclo_id', id)
      .order('numero_settimana', { ascending: true })
    if (error) {
      ({ data } = await supabase
        .from('lezioni')
        .select('id, numero_settimana, tema, sottotitolo, pratiche_formali, pratiche_informali, materiali, esercizi(id, tipo, descrizione, traccia_audio, ordine, durata_minuti)')
        .eq('ciclo_id', id)
        .order('numero_settimana', { ascending: true }))
    }
    setLezioni((data || []).map(l => ({
      ...l,
      esercizi: [...(l.esercizi || [])].sort((a, b) => (a.ordine || 0) - (b.ordine || 0))
    })))
  }

  useEffect(() => {
    caricaLezioni(cicloId)
  }, [cicloId])

  const corrente = useMemo(
    () => lezioni.find(l => l.numero_settimana === Number(settimana)) || null,
    [lezioni, settimana]
  )

  useEffect(() => {
    if (corrente) {
      setMeta({
        numero_settimana: corrente.numero_settimana,
        tema: corrente.tema || '',
        sottotitolo: corrente.sottotitolo || '',
        materiali: corrente.materiali || '',
        pratiche_formali: corrente.pratiche_formali || '',
        pratiche_informali: corrente.pratiche_informali || ''
      })
    } else {
      setMeta(metaVuota(settimana))
    }
    setNuovaFormale({ descrizione: '', durata_minuti: '' })
    setNuovaInformale('')
    setModificaEx(null)
    setOkMsg(null)
  }, [corrente, settimana])

  useEffect(() => {
    const attiva = pillsRef.current?.querySelector('.settimana-pill.is-on')
    attiva?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [settimana, lezioni.length])

  const esercizi = corrente?.esercizi || []
  const formali = esercizi.filter(eFormale)
  const informali = esercizi.filter(eInformale)

  function segnalaErrore(err) {
    setErrore(messaggioErroreTraccia(err))
  }

  async function assicuraTracciaDaFile(file, titolo) {
    return creaTraccia(file, { titolo })
  }

  async function salvaMeta(e) {
    e.preventDefault()
    setErrore(null)
    setOkMsg(null)
    if (!cicloId) return
    setInvioMeta(true)

    const payload = {
      ciclo_id: cicloId,
      numero_settimana: Number(settimana),
      tema: meta.tema.trim(),
      sottotitolo: meta.sottotitolo.trim() || null,
      materiali: meta.materiali.trim() || null,
      pratiche_formali: meta.pratiche_formali || '',
      pratiche_informali: meta.pratiche_informali || ''
    }

    const { error } = corrente
      ? await supabase.from('lezioni').update(payload).eq('id', corrente.id)
      : await supabase.from('lezioni').insert(payload)

    setInvioMeta(false)
    if (error) {
      setErrore('Non è stato possibile salvare la settimana. Controlla che il numero non sia già usato.')
      return
    }
    setOkMsg(corrente ? 'Settimana aggiornata.' : 'Settimana creata.')
    await Promise.all([caricaLezioni(cicloId), caricaLibreria()])
  }

  async function eliminaLezione() {
    if (!corrente) return
    setConfermaEliminaSettimana(true)
  }

  async function confermaEliminaLezione() {
    if (!corrente) return
    await supabase.from('lezioni').delete().eq('id', corrente.id)
    setOkMsg(null)
    setConfermaEliminaSettimana(false)
    await Promise.all([caricaLezioni(cicloId), caricaLibreria()])
  }

  async function aggiungiEsercizio(tipo, descrizione, durataMinuti) {
    if (!corrente || !descrizione.trim()) return
    setErrore(null)
    const ordine = (esercizi.reduce((max, ex) => Math.max(max, ex.ordine || 0), 0) || 0) + 1
    const payload = {
      lezione_id: corrente.id,
      tipo,
      descrizione: descrizione.trim(),
      ordine
    }
    const durata = Number(durataMinuti)
    if (Number.isFinite(durata) && durata > 0) payload.durata_minuti = durata
    const { error } = await supabase.from('esercizi').insert(payload)
    if (error) {
      setErrore('Non è stato possibile aggiungere la pratica.')
      return
    }
    await caricaLezioni(cicloId)
  }

  async function aggiornaEsercizio(id, patch) {
    setErrore(null)
    const { error } = await supabase.from('esercizi').update(patch).eq('id', id)
    if (error) {
      setErrore('Non è stato possibile aggiornare la pratica.')
      return false
    }
    setModificaEx(null)
    await caricaLezioni(cicloId)
    return true
  }

  async function salvaPraticaFormale(ex) {
    if (!modificaEx) return
    setErrore(null)
    setOkMsg(null)
    const traccia = trovaTracciaDi(ex, libreria)
    try {
      if (traccia?.id) {
        await rinominaTraccia(traccia.id, traccia.titolo, modificaEx.testoCard)
      } else if (ex.traccia_audio) {
        const { error } = await supabase.from('esercizi').update({
          traccia_audio: urlConTestoCard(ex.traccia_audio, modificaEx.testoCard)
        }).eq('id', ex.id)
        if (error) throw error
      }
    } catch (err) {
      segnalaErrore(err)
      return
    }
    const ok = await aggiornaEsercizio(ex.id, {
      descrizione: modificaEx.descrizione.trim(),
      durata_minuti: Number(modificaEx.durata_minuti) > 0
        ? Number(modificaEx.durata_minuti)
        : null
    })
    if (!ok) return
    await caricaLibreria()
    setOkMsg('Pratica salvata.')
  }

  async function eliminaEsercizio(id) {
    await supabase.from('esercizi').delete().eq('id', id)
    await Promise.all([caricaLezioni(cicloId), caricaLibreria()])
  }

  async function confermaEliminaEsercizio() {
    const id = daEliminareEx?.id
    if (!id) return
    setDaEliminareEx(null)
    if (modificaEx?.id === id) setModificaEx(null)
    await eliminaEsercizio(id)
  }

  async function collegaTracciaEsercizio(esercizioId, tracciaId) {
    const scelta = libreria.find(t => t.id === tracciaId)
    if (!scelta) return
    setErrore(null)
    const { error } = await supabase.from('esercizi').update({
      traccia_id: scelta.id,
      traccia_audio: scelta.url
    }).eq('id', esercizioId)
    if (error) {
      setErrore('Non è stato possibile collegare la traccia.')
      return
    }
    await Promise.all([caricaLezioni(cicloId), caricaLibreria()])
  }

  async function caricaTracciaEsercizio(esercizio, file) {
    if (!file) return
    setErrore(null)
    setCaricamentoEsercizioId(esercizio.id)
    try {
      const creata = await assicuraTracciaDaFile(
        file,
        esercizio.descrizione || titoloDaNomeFile(file.name)
      )
      const { error } = await supabase.from('esercizi').update({
        traccia_id: creata.id,
        traccia_audio: creata.url
      }).eq('id', esercizio.id)
      if (error) throw error
      await Promise.all([caricaLezioni(cicloId), caricaLibreria()])
    } catch (err) {
      segnalaErrore(err)
    } finally {
      setCaricamentoEsercizioId(null)
    }
  }

  async function rimuoviTracciaEsercizio(esercizioId) {
    await supabase.from('esercizi').update({
      traccia_id: null,
      traccia_audio: null
    }).eq('id', esercizioId)
    await Promise.all([caricaLezioni(cicloId), caricaLibreria()])
  }

  const badgeSettimana = Number(settimana) === 9
    ? 'Giornata intensiva'
    : `Settimana ${settimana} di 8`

  return (
    <div className="lezioni-gestione">
      <h2>Lezioni e pratiche</h2>
      <p className="lead">
        Prepara quello che i partecipanti vedono in «Settimana»: prima il tema, poi le pratiche.
        L’audio si carica in libreria e si collega a ogni pratica.
      </p>

      <LibreriaTracce
        tracce={libreria}
        usi={usi}
        onAggiorna={caricaLibreria}
        onErrore={segnalaErrore}
        caricamentoId={caricamentoLibreriaId}
        setCaricamentoId={setCaricamentoLibreriaId}
      />
      {errore && <p className="lezioni-errore">{errore}</p>}

      <div className="field lezioni-ciclo">
        <label htmlFor="ciclo-lezioni">Ciclo</label>
        <select id="ciclo-lezioni" value={cicloId} onChange={e => setCicloId(e.target.value)}>
          {cicli.length === 0 && <option value="">Nessun ciclo</option>}
          {cicli.map(c => (
            <option key={c.id} value={c.id}>{c.nome_ciclo} ({c.stato})</option>
          ))}
        </select>
      </div>

      {cicloId && (
        <div className="settimane-pills" ref={pillsRef}>
          {NUMERI_SETTIMANA.map(n => {
            const presente = lezioni.some(l => l.numero_settimana === n)
            const attiva = Number(settimana) === n
            return (
              <button
                key={n}
                type="button"
                className={`settimana-pill${attiva ? ' is-on' : ''}${presente ? '' : ' is-vuota'}`}
                aria-current={attiva ? 'true' : undefined}
                onClick={() => setSettimana(n)}
              >
                <span className="sett-riga">
                  <span className="sett-etichetta">{etichettaSettimana(n)}</span>
                  {!presente && <span className="sett-lock">da creare</span>}
                </span>
                <span className="sett-tema">
                  {lezioni.find(l => l.numero_settimana === n)?.tema
                    || (n === 9 ? 'Giornata intensiva' : `Settimana ${n}`)}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {cicloId && (
        <div className="card settimana-vista">
          <header className="lezioni-sett-capo">
            <p className="badge badge-settimana">{badgeSettimana}</p>
            <p className="hint lezioni-sett-guida">
              {corrente
                ? 'I partecipanti vedono tema, audio e pratiche informali così come li salvi qui.'
                : 'Crea il tema: dopo puoi aggiungere le pratiche formali (con audio) e quelle informali.'}
            </p>
          </header>

          <section className="lezioni-sezione" aria-labelledby="tema-sett-titolo">
            <h3 id="tema-sett-titolo">Tema della settimana</h3>
            <form onSubmit={salvaMeta} className="lezioni-meta">
              <div className="field">
                <label htmlFor="tema-sett">Titolo</label>
                <input
                  id="tema-sett"
                  className="lezioni-tema-input"
                  required
                  value={meta.tema}
                  onChange={e => setMeta({ ...meta, tema: e.target.value })}
                  placeholder={Number(settimana) === 9 ? 'Giornata intensiva' : `Tema settimana ${settimana}`}
                />
              </div>
              <div className="field">
                <label htmlFor="sotto-sett">Sottotitolo (facoltativo)</label>
                <input
                  id="sotto-sett"
                  value={meta.sottotitolo}
                  onChange={e => setMeta({ ...meta, sottotitolo: e.target.value })}
                  placeholder="Una riga sotto il titolo, in Settimana"
                />
              </div>
              <div className="field">
                <label htmlFor="mat-sett">Materiali per il gruppo (facoltativo)</label>
                <textarea
                  id="mat-sett"
                  rows="2"
                  value={meta.materiali}
                  onChange={e => setMeta({ ...meta, materiali: e.target.value })}
                  placeholder="Link, dispense o note"
                />
              </div>

              <div className="azioni">
                <button className="btn" type="submit" disabled={invioMeta}>
                  {corrente ? 'Salva tema' : 'Crea questa settimana'}
                </button>
                {corrente && (
                  <button className="btn btn-ghost" type="button" onClick={eliminaLezione}>
                    Elimina settimana
                  </button>
                )}
              </div>
              {okMsg && <p className="hint">{okMsg}</p>}
              {errore && <p className="campo-errore" role="alert">{errore}</p>}
            </form>
          </section>

          {corrente && (
            <>
              <section className="lezioni-sezione" aria-labelledby="formali-admin-titolo">
                <div className="lezioni-sezione-capo">
                  <h3 id="formali-admin-titolo">Pratiche formali</h3>
                  <p className="hint">
                    Compare in «Da fare ogni giorno». Ogni pratica ha un nome, una durata e una traccia.
                  </p>
                </div>

                <div className="lista-task">
                  {formali.length === 0 && (
                    <p className="hint">Nessuna pratica formale. Aggiungila sotto, poi collega l’audio.</p>
                  )}
                  {formali.map(ex => {
                    const urlEx = urlTracciaDi(ex, libreria)
                    const tracciaEx = trovaTracciaDi(ex, libreria)
                    const titoloEx = tracciaEx?.titolo
                    const inModifica = modificaEx?.id === ex.id
                    const durataTesto = Number.isFinite(ex.durata_minuti) && ex.durata_minuti > 0
                      ? (ex.durata_minuti === 1 ? '1 minuto' : `${ex.durata_minuti} minuti`)
                      : 'Durata non indicata'
                    return (
                      <article
                        className={`lezioni-pratica${inModifica ? ' is-modifica' : ''}${urlEx ? ' has-traccia' : ''}`}
                        key={ex.id}
                      >
                        {inModifica ? (
                          <>
                            <p className="lezioni-pratica-kicker">Stai modificando questa pratica</p>
                            <div className="lezioni-edit-ex">
                              <div className="field">
                                <label htmlFor={`nome-pratica-${ex.id}`}>Nome</label>
                                <input
                                  id={`nome-pratica-${ex.id}`}
                                  value={modificaEx.descrizione}
                                  onChange={e => setModificaEx({ ...modificaEx, descrizione: e.target.value })}
                                />
                              </div>
                              <div className="field">
                                <label htmlFor={`durata-pratica-${ex.id}`}>Durata in minuti</label>
                                <input
                                  id={`durata-pratica-${ex.id}`}
                                  type="number"
                                  min="1"
                                  max="180"
                                  placeholder="es. 15"
                                  value={modificaEx.durata_minuti}
                                  onChange={e => setModificaEx({ ...modificaEx, durata_minuti: e.target.value })}
                                />
                              </div>
                              <div className="field">
                                <label htmlFor={`testo-card-${ex.id}`}>Testo in card</label>
                                <textarea
                                  id={`testo-card-${ex.id}`}
                                  rows={3}
                                  value={modificaEx.testoCard || ''}
                                  onChange={e => setModificaEx({ ...modificaEx, testoCard: e.target.value })}
                                  placeholder="Compare sotto il titolo nella card del player."
                                  disabled={!urlEx}
                                />
                                {!urlEx && (
                                  <p className="hint">Collega prima una traccia, poi puoi scrivere il testo.</p>
                                )}
                              </div>
                              <div className="field">
                                <label htmlFor={`traccia-pratica-${ex.id}`}>Traccia audio</label>
                                <SelettoreTraccia
                                  id={`traccia-pratica-${ex.id}`}
                                  valore={ex.traccia_id}
                                  tracce={libreria}
                                  etichettaVuoto={urlEx ? 'Scollega la traccia' : 'Scegli dalla libreria…'}
                                  onCambia={id => {
                                    if (!id) rimuoviTracciaEsercizio(ex.id)
                                    else collegaTracciaEsercizio(ex.id, id)
                                  }}
                                />
                                <p className="hint">
                                  {urlEx
                                    ? `Ora collegata: ${titoloEx || 'traccia audio'}.`
                                    : 'Senza traccia i partecipanti non possono ascoltare.'}
                                </p>
                                <div className="lezioni-ex-azioni">
                                  <label className="btn btn-ghost lezioni-file-btn">
                                    {caricamentoEsercizioId === ex.id ? 'Caricamento…' : 'Carica un file nuovo'}
                                    <input
                                      type="file"
                                      accept="audio/*"
                                      hidden
                                      disabled={caricamentoEsercizioId === ex.id}
                                      onChange={e => {
                                        const file = e.target.files?.[0]
                                        e.target.value = ''
                                        caricaTracciaEsercizio(ex, file)
                                      }}
                                    />
                                  </label>
                                  {urlEx && (
                                    <button
                                      className="btn btn-ghost"
                                      type="button"
                                      onClick={() => rimuoviTracciaEsercizio(ex.id)}
                                    >
                                      Scollega traccia
                                    </button>
                                  )}
                                </div>
                              </div>
                              <div className="azioni">
                                <button
                                  className="btn"
                                  type="button"
                                  onClick={() => salvaPraticaFormale(ex)}
                                >
                                  Salva pratica
                                </button>
                                <button className="btn btn-ghost" type="button" onClick={() => setModificaEx(null)}>
                                  Annulla
                                </button>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="lezioni-pratica-capo">
                            <div className="lezioni-pratica-testi">
                              <h4>{ex.descrizione}</h4>
                              <p className="lezioni-pratica-meta">
                                <span>{durataTesto}</span>
                                <span className={urlEx ? 'is-ok' : 'is-manca'}>
                                  {urlEx ? `Traccia: ${titoloEx || 'collegata'}` : 'Senza traccia audio'}
                                </span>
                              </p>
                            </div>
                            <div className="lezioni-pratica-azioni">
                              <button
                                className="btn"
                                type="button"
                                onClick={async () => {
                                  const testoCard = tracciaEx
                                    ? await leggiTestoCard(tracciaEx)
                                    : ''
                                  setModificaEx({
                                    id: ex.id,
                                    descrizione: ex.descrizione || '',
                                    durata_minuti: ex.durata_minuti || '',
                                    testoCard
                                  })
                                }}
                              >
                                Modifica
                              </button>
                              <button
                                className="btn btn-ghost"
                                type="button"
                                onClick={() => setDaEliminareEx(ex)}
                              >
                                Rimuovi
                              </button>
                            </div>
                          </div>
                        )}
                        {urlEx && (
                          <details className="lezioni-anteprima">
                            <summary>Ascolta l’anteprima</summary>
                            <CardTracciaAudio
                              src={urlEx}
                              titolo={titoloEx || ex.descrizione}
                              descrizione={tracciaEx?.descrizione || testoDaUrlAudio(urlEx)}
                              etichettaDurata={
                                Number.isFinite(ex.durata_minuti) && ex.durata_minuti > 0
                                  ? durataTesto
                                  : undefined
                              }
                              anteprima
                            />
                          </details>
                        )}
                      </article>
                    )
                  })}
                </div>

                <form
                  className="lezioni-aggiungi lezioni-aggiungi-card"
                  onSubmit={async e => {
                    e.preventDefault()
                    await aggiungiEsercizio('formale', nuovaFormale.descrizione, nuovaFormale.durata_minuti)
                    setNuovaFormale({ descrizione: '', durata_minuti: '' })
                  }}
                >
                  <p className="lezioni-pratica-kicker">Aggiungi una pratica formale</p>
                  <div className="riga-due">
                    <div className="field">
                      <label htmlFor="nuova-formale">Nome</label>
                      <input
                        id="nuova-formale"
                        required
                        value={nuovaFormale.descrizione}
                        onChange={e => setNuovaFormale({ ...nuovaFormale, descrizione: e.target.value })}
                        placeholder="es. Body Scan"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="durata-formale">Durata in minuti</label>
                      <input
                        id="durata-formale"
                        type="number"
                        min="1"
                        max="180"
                        value={nuovaFormale.durata_minuti}
                        onChange={e => setNuovaFormale({ ...nuovaFormale, durata_minuti: e.target.value })}
                        placeholder="15"
                      />
                    </div>
                  </div>
                  <button className="btn" type="submit">Aggiungi pratica</button>
                </form>
              </section>

              <section className="lezioni-sezione" aria-labelledby="informali-admin-titolo">
                <div className="lezioni-sezione-capo">
                  <h3 id="informali-admin-titolo">Pratiche informali</h3>
                  <p className="hint">
                    Compare come elenco da spuntare. Non hanno audio: solo un nome.
                  </p>
                </div>

                <ul className="lezioni-lista-informali">
                  {informali.length === 0 && (
                    <li className="hint">Nessuna pratica informale. Aggiungila sotto.</li>
                  )}
                  {informali.map(ex => {
                    const inModifica = modificaEx?.id === ex.id
                    return (
                      <li
                        key={ex.id}
                        className={`lezioni-informale${inModifica ? ' is-modifica' : ''}`}
                      >
                        {inModifica ? (
                          <div className="lezioni-edit-ex">
                            <div className="field">
                              <label htmlFor={`nome-informale-${ex.id}`}>Nome</label>
                              <input
                                id={`nome-informale-${ex.id}`}
                                value={modificaEx.descrizione}
                                onChange={e => setModificaEx({ ...modificaEx, descrizione: e.target.value })}
                              />
                            </div>
                            <div className="azioni">
                              <button
                                className="btn"
                                type="button"
                                onClick={() => aggiornaEsercizio(ex.id, {
                                  descrizione: modificaEx.descrizione.trim()
                                })}
                              >
                                Salva
                              </button>
                              <button className="btn btn-ghost" type="button" onClick={() => setModificaEx(null)}>
                                Annulla
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="lezioni-pratica-capo">
                            <p className="lezioni-informale-nome">{ex.descrizione}</p>
                            <div className="lezioni-pratica-azioni">
                              <button
                                className="btn"
                                type="button"
                                onClick={() => setModificaEx({
                                  id: ex.id,
                                  descrizione: ex.descrizione || '',
                                  durata_minuti: ''
                                })}
                              >
                                Modifica
                              </button>
                              <button
                                className="btn btn-ghost"
                                type="button"
                                onClick={() => setDaEliminareEx(ex)}
                              >
                                Rimuovi
                              </button>
                            </div>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>

                <form
                  className="lezioni-aggiungi lezioni-aggiungi-card"
                  onSubmit={async e => {
                    e.preventDefault()
                    await aggiungiEsercizio('informale', nuovaInformale)
                    setNuovaInformale('')
                  }}
                >
                  <p className="lezioni-pratica-kicker">Aggiungi una pratica informale</p>
                  <div className="field">
                    <label htmlFor="nuova-informale">Nome</label>
                    <input
                      id="nuova-informale"
                      required
                      value={nuovaInformale}
                      onChange={e => setNuovaInformale(e.target.value)}
                      placeholder="es. Bere il caffè consapevolmente"
                    />
                  </div>
                  <button className="btn" type="submit">Aggiungi pratica</button>
                </form>
              </section>
            </>
          )}
        </div>
      )}

      {cicloId && lezioni.length === 0 && (
        <p className="hint">Nessuna settimana ancora configurata: scegline una sopra e crea il tema.</p>
      )}
      <DialogConferma
        aperto={confermaEliminaSettimana}
        titolo="Eliminare questa settimana?"
        confermaEtichetta="Elimina settimana"
        pericolo
        onConferma={confermaEliminaLezione}
        onAnnulla={() => setConfermaEliminaSettimana(false)}
      >
        Si cancellano anche tutte le pratiche collegate. Non si può tornare indietro.
      </DialogConferma>
      <DialogConferma
        aperto={!!daEliminareEx}
        titolo="Rimuovere questa pratica?"
        confermaEtichetta="Rimuovi pratica"
        pericolo
        onConferma={confermaEliminaEsercizio}
        onAnnulla={() => setDaEliminareEx(null)}
      >
        {daEliminareEx
          ? `«${daEliminareEx.descrizione}» sparisce dalla settimana. La traccia resta in libreria.`
          : ''}
      </DialogConferma>
    </div>
  )
}
