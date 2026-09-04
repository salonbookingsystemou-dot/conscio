import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import LibreriaTracce, { SelettoreTraccia } from '../components/LibreriaTracce.jsx'
import {
  creaTraccia,
  elencaTracce,
  messaggioErroreTraccia,
  titoloDaNomeFile,
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
    pratiche_informali: '',
    traccia_audio: '',
    traccia_id: ''
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
  const [fileAudioSettimana, setFileAudioSettimana] = useState(null)
  const [nuovaFormale, setNuovaFormale] = useState({ descrizione: '', durata_minuti: '' })
  const [nuovaInformale, setNuovaInformale] = useState('')
  const [modificaEx, setModificaEx] = useState(null)
  const [caricamentoAudio, setCaricamentoAudio] = useState(false)
  const [caricamentoEsercizioId, setCaricamentoEsercizioId] = useState(null)
  const [caricamentoLibreriaId, setCaricamentoLibreriaId] = useState(null)
  const [invioMeta, setInvioMeta] = useState(false)
  const [errore, setErrore] = useState(null)
  const [okMsg, setOkMsg] = useState(null)
  const pillsRef = useRef(null)

  async function caricaLibreria() {
    try {
      const [lista, conteggi] = await Promise.all([elencaTracce(), usiTracce()])
      setLibreria(lista)
      setUsi(conteggi)
    } catch {
      setErrore('Non è stato possibile leggere la libreria tracce. Esegui la migrazione SQL se non l’hai ancora applicata.')
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
    const colonne = 'id, numero_settimana, tema, sottotitolo, pratiche_formali, pratiche_informali, materiali, traccia_audio, traccia_id, esercizi(id, tipo, descrizione, traccia_audio, traccia_id, ordine, durata_minuti)'
    let { data, error } = await supabase
      .from('lezioni')
      .select(colonne)
      .eq('ciclo_id', id)
      .order('numero_settimana', { ascending: true })
    if (error) {
      ({ data } = await supabase
        .from('lezioni')
        .select('id, numero_settimana, tema, sottotitolo, pratiche_formali, pratiche_informali, materiali, traccia_audio, esercizi(id, tipo, descrizione, traccia_audio, ordine, durata_minuti)')
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
        pratiche_informali: corrente.pratiche_informali || '',
        traccia_audio: corrente.traccia_audio || '',
        traccia_id: corrente.traccia_id || ''
      })
    } else {
      setMeta(metaVuota(settimana))
    }
    setFileAudioSettimana(null)
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
  const urlSettimana = urlTracciaDi(meta, libreria)

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
    setCaricamentoAudio(Boolean(fileAudioSettimana))
    let tracciaId = meta.traccia_id || null
    let tracciaUrl = meta.traccia_audio || null
    try {
      if (fileAudioSettimana) {
        const creata = await assicuraTracciaDaFile(
          fileAudioSettimana,
          meta.tema.trim() || `Settimana ${meta.numero_settimana}`
        )
        tracciaId = creata.id
        tracciaUrl = creata.url
      } else if (tracciaId) {
        const scelta = libreria.find(t => t.id === tracciaId)
        if (scelta) tracciaUrl = scelta.url
      } else {
        tracciaUrl = null
      }
    } catch (err) {
      setCaricamentoAudio(false)
      setInvioMeta(false)
      segnalaErrore(err)
      return
    }

    const payload = {
      ciclo_id: cicloId,
      numero_settimana: Number(settimana),
      tema: meta.tema.trim(),
      sottotitolo: meta.sottotitolo.trim() || null,
      materiali: meta.materiali.trim() || null,
      pratiche_formali: meta.pratiche_formali || '',
      pratiche_informali: meta.pratiche_informali || '',
      traccia_audio: tracciaUrl,
      traccia_id: tracciaId
    }

    const { error } = corrente
      ? await supabase.from('lezioni').update(payload).eq('id', corrente.id)
      : await supabase.from('lezioni').insert(payload)

    setCaricamentoAudio(false)
    setInvioMeta(false)
    if (error) {
      setErrore('Non è stato possibile salvare la settimana. Controlla che il numero non sia già usato.')
      return
    }
    setFileAudioSettimana(null)
    setOkMsg(corrente ? 'Settimana aggiornata.' : 'Settimana creata.')
    await Promise.all([caricaLezioni(cicloId), caricaLibreria()])
  }

  async function eliminaLezione() {
    if (!corrente) return
    if (!confirm('Eliminare questa settimana e tutte le pratiche collegate?')) return
    await supabase.from('lezioni').delete().eq('id', corrente.id)
    setOkMsg(null)
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
      return
    }
    setModificaEx(null)
    await caricaLezioni(cicloId)
  }

  async function eliminaEsercizio(id) {
    await supabase.from('esercizi').delete().eq('id', id)
    await Promise.all([caricaLezioni(cicloId), caricaLibreria()])
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
        Stessa struttura che vedono i partecipanti in «Settimana»: tema, pratiche formali con audio,
        pratiche informali da spuntare. Le tracce stanno in libreria: un file, tanti collegamenti.
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
          <p className="badge badge-settimana">{badgeSettimana}</p>

          <form onSubmit={salvaMeta} className="lezioni-meta">
            <div className="field">
              <label htmlFor="tema-sett">Tema</label>
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
                placeholder="Breve riga sotto il tema"
              />
            </div>
            <div className="field">
              <label htmlFor="mat-sett">Materiali (facoltativo)</label>
              <textarea
                id="mat-sett"
                rows="2"
                value={meta.materiali}
                onChange={e => setMeta({ ...meta, materiali: e.target.value })}
                placeholder="Link o note per il gruppo"
              />
            </div>

            <details className="lezioni-avanzate">
              <summary>Traccia audio di settimana (facoltativa)</summary>
              <p className="hint">
                Nella pratica giornaliera l’audio principale è sulle pratiche formali qui sotto.
                Questa traccia resta disponibile come materiale di settimana.
              </p>
              <SelettoreTraccia
                valore={meta.traccia_id}
                tracce={libreria}
                etichettaVuoto={meta.traccia_id || meta.traccia_audio ? 'Scollega traccia' : 'Collega dalla libreria…'}
                onCambia={id => {
                  const scelta = libreria.find(t => t.id === id)
                  setMeta({
                    ...meta,
                    traccia_id: id || '',
                    traccia_audio: scelta?.url || ''
                  })
                  setFileAudioSettimana(null)
                }}
              />
              <input
                type="file"
                accept="audio/*"
                onChange={e => setFileAudioSettimana(e.target.files?.[0] || null)}
              />
              {fileAudioSettimana && <p className="hint">Nuovo file: {fileAudioSettimana.name} — va in libreria al salvataggio.</p>}
              {!fileAudioSettimana && urlSettimana && (
                <div className="lezioni-audio-riga">
                  <audio className="player-audio" controls src={urlSettimana} preload="metadata">
                    Il browser non riproduce questa traccia.
                  </audio>
                  <button
                    className="btn btn-ghost"
                    type="button"
                    onClick={() => setMeta({ ...meta, traccia_audio: '', traccia_id: '' })}
                  >
                    Rimuovi
                  </button>
                </div>
              )}
            </details>

            <div className="azioni">
              <button className="btn" type="submit" disabled={invioMeta || caricamentoAudio}>
                {caricamentoAudio
                  ? 'Caricamento audio…'
                  : corrente
                    ? 'Salva tema e materiali'
                    : 'Crea questa settimana'}
              </button>
              {corrente && (
                <button className="btn btn-ghost" type="button" onClick={eliminaLezione}>
                  Elimina settimana
                </button>
              )}
            </div>
            {okMsg && <p className="hint">{okMsg}</p>}
            {errore && <p style={{ color: 'var(--danger)' }}>{errore}</p>}
          </form>

          {!corrente && (
            <p className="hint lezioni-hint-crea">
              Salva prima tema e materiali: poi potrai aggiungere le pratiche formali e informali
              come nella vista partecipante.
            </p>
          )}

          {corrente && (
            <>
              <section className="blocco-giorno" aria-labelledby="formali-admin-titolo">
                <h3 id="formali-admin-titolo">Da fare ogni giorno</h3>
                <p className="hint">Pratiche formali con traccia audio — come le vedono i partecipanti.</p>

                <div className="lista-task">
                  {formali.length === 0 && (
                    <p className="hint">Nessuna pratica formale ancora. Aggiungine una sotto.</p>
                  )}
                  {formali.map(ex => {
                    const urlEx = urlTracciaDi(ex, libreria)
                    const titoloEx = libreria.find(t => t.id === ex.traccia_id)?.titolo
                    return (
                      <article className="task-pratica" key={ex.id}>
                        <div className="task-pratica-testa">
                          <span className="task-punto" aria-hidden="true" />
                          <div className="task-pratica-testi">
                            {modificaEx?.id === ex.id ? (
                              <div className="lezioni-edit-ex">
                                <input
                                  value={modificaEx.descrizione}
                                  onChange={e => setModificaEx({ ...modificaEx, descrizione: e.target.value })}
                                  aria-label="Descrizione pratica"
                                />
                                <input
                                  type="number"
                                  min="1"
                                  max="180"
                                  placeholder="min"
                                  value={modificaEx.durata_minuti}
                                  onChange={e => setModificaEx({ ...modificaEx, durata_minuti: e.target.value })}
                                  aria-label="Durata in minuti"
                                />
                                <div className="azioni">
                                  <button
                                    className="btn"
                                    type="button"
                                    onClick={() => aggiornaEsercizio(ex.id, {
                                      descrizione: modificaEx.descrizione.trim(),
                                      durata_minuti: Number(modificaEx.durata_minuti) > 0
                                        ? Number(modificaEx.durata_minuti)
                                        : null
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
                              <>
                                <h4>{ex.descrizione}</h4>
                                <p className="hint">
                                  {[
                                    Number.isFinite(ex.durata_minuti) && ex.durata_minuti > 0
                                      ? `${ex.durata_minuti} min`
                                      : null,
                                    titoloEx || (urlEx ? 'traccia audio' : 'senza traccia'),
                                    ex.tipo === 'a_casa' ? 'tipo: a casa' : 'tipo: formale'
                                  ].filter(Boolean).join(' · ')}
                                </p>
                              </>
                            )}
                          </div>
                        </div>

                        {modificaEx?.id !== ex.id && (
                          <>
                            {urlEx ? (
                              <div className="lezioni-audio-riga">
                                <audio className="player-audio" controls src={urlEx} preload="metadata">
                                  Il browser non riproduce questa traccia.
                                </audio>
                                <button className="btn btn-ghost" type="button" onClick={() => rimuoviTracciaEsercizio(ex.id)}>
                                  Scollega
                                </button>
                              </div>
                            ) : (
                              <p className="hint">Nessuna traccia ancora collegata a questa pratica.</p>
                            )}
                            <div className="lezioni-ex-azioni">
                              <SelettoreTraccia
                                valore={ex.traccia_id}
                                tracce={libreria}
                                etichettaVuoto={ex.traccia_id || urlEx ? 'Scollega traccia' : 'Collega dalla libreria…'}
                                onCambia={id => {
                                  if (!id) rimuoviTracciaEsercizio(ex.id)
                                  else collegaTracciaEsercizio(ex.id, id)
                                }}
                              />
                              <label className="btn btn-ghost lezioni-file-btn">
                                {caricamentoEsercizioId === ex.id ? 'Caricamento…' : 'Carica nuova'}
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
                              <button
                                className="btn btn-ghost"
                                type="button"
                                onClick={() => setModificaEx({
                                  id: ex.id,
                                  descrizione: ex.descrizione || '',
                                  durata_minuti: ex.durata_minuti || ''
                                })}
                              >
                                Modifica
                              </button>
                              <button className="btn btn-ghost" type="button" onClick={() => eliminaEsercizio(ex.id)}>
                                Rimuovi
                              </button>
                            </div>
                          </>
                        )}
                      </article>
                    )
                  })}
                </div>

                <form
                  className="lezioni-aggiungi"
                  onSubmit={async e => {
                    e.preventDefault()
                    await aggiungiEsercizio('formale', nuovaFormale.descrizione, nuovaFormale.durata_minuti)
                    setNuovaFormale({ descrizione: '', durata_minuti: '' })
                  }}
                >
                  <div className="riga-due">
                    <div className="field">
                      <label htmlFor="nuova-formale">Nuova pratica formale</label>
                      <input
                        id="nuova-formale"
                        required
                        value={nuovaFormale.descrizione}
                        onChange={e => setNuovaFormale({ ...nuovaFormale, descrizione: e.target.value })}
                        placeholder="es. Body scan guidato"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="durata-formale">Minuti</label>
                      <input
                        id="durata-formale"
                        type="number"
                        min="1"
                        max="180"
                        value={nuovaFormale.durata_minuti}
                        onChange={e => setNuovaFormale({ ...nuovaFormale, durata_minuti: e.target.value })}
                        placeholder="45"
                      />
                    </div>
                  </div>
                  <button className="btn" type="submit">Aggiungi pratica formale</button>
                </form>
              </section>

              <section className="blocco-informali" aria-labelledby="informali-admin-titolo">
                <h3 id="informali-admin-titolo">Pratiche informali</h3>
                <p className="hint">Compare come chip da spuntare nella giornata.</p>

                <div className="chip-riga chip-informali">
                  {informali.length === 0 && (
                    <p className="hint">Nessuna pratica informale ancora.</p>
                  )}
                  {informali.map(ex => (
                    <div key={ex.id} className="chip chip-spunta is-on lezioni-chip-admin">
                      <span className="chip-check is-fatto" aria-hidden="true">✓</span>
                      {modificaEx?.id === ex.id ? (
                        <span className="lezioni-edit-ex lezioni-edit-chip">
                          <input
                            value={modificaEx.descrizione}
                            onChange={e => setModificaEx({ ...modificaEx, descrizione: e.target.value })}
                          />
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
                        </span>
                      ) : (
                        <>
                          <span className="chip-testo">{ex.descrizione}</span>
                          <button
                            className="link-testuale"
                            type="button"
                            onClick={() => setModificaEx({ id: ex.id, descrizione: ex.descrizione || '', durata_minuti: '' })}
                          >
                            Modifica
                          </button>
                          <button className="link-testuale" type="button" onClick={() => eliminaEsercizio(ex.id)}>
                            Rimuovi
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>

                <form
                  className="lezioni-aggiungi"
                  onSubmit={async e => {
                    e.preventDefault()
                    await aggiungiEsercizio('informale', nuovaInformale)
                    setNuovaInformale('')
                  }}
                >
                  <div className="field">
                    <label htmlFor="nuova-informale">Nuova pratica informale</label>
                    <input
                      id="nuova-informale"
                      required
                      value={nuovaInformale}
                      onChange={e => setNuovaInformale(e.target.value)}
                      placeholder="es. Portare attenzione a un’attività quotidiana"
                    />
                  </div>
                  <button className="btn" type="submit">Aggiungi pratica informale</button>
                </form>
              </section>
            </>
          )}
        </div>
      )}

      {cicloId && lezioni.length === 0 && (
        <p className="hint">Nessuna settimana ancora configurata: scegline una sopra e crea il tema.</p>
      )}
    </div>
  )
}
