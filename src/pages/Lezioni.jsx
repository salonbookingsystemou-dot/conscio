import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AUDIO_MAX = 50 * 1024 * 1024
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

function estensioneAudio(nome) {
  const pezzo = (nome || '').split('.').pop()
  return (pezzo || 'mp3').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp3'
}

function metaVuota(numero = 1) {
  return {
    numero_settimana: numero,
    tema: '',
    sottotitolo: '',
    materiali: '',
    pratiche_formali: '',
    pratiche_informali: '',
    traccia_audio: ''
  }
}

export default function Lezioni() {
  const [cicli, setCicli] = useState([])
  const [cicloId, setCicloId] = useState('')
  const [lezioni, setLezioni] = useState([])
  const [settimana, setSettimana] = useState(1)
  const [meta, setMeta] = useState(metaVuota(1))
  const [fileAudioSettimana, setFileAudioSettimana] = useState(null)
  const [nuovaFormale, setNuovaFormale] = useState({ descrizione: '', durata_minuti: '' })
  const [nuovaInformale, setNuovaInformale] = useState('')
  const [modificaEx, setModificaEx] = useState(null)
  const [caricamentoAudio, setCaricamentoAudio] = useState(false)
  const [caricamentoEsercizioId, setCaricamentoEsercizioId] = useState(null)
  const [invioMeta, setInvioMeta] = useState(false)
  const [errore, setErrore] = useState(null)
  const [okMsg, setOkMsg] = useState(null)
  const pillsRef = useRef(null)

  useEffect(() => {
    supabase.from('cicli').select('id, nome_ciclo, stato').order('data_inizio', { ascending: false })
      .then(({ data }) => {
        const lista = data || []
        setCicli(lista)
        if (lista[0] && !cicloId) setCicloId(lista[0].id)
      })
  }, [])

  async function caricaLezioni(id) {
    if (!id) {
      setLezioni([])
      return
    }
    const { data } = await supabase
      .from('lezioni')
      .select('id, numero_settimana, tema, sottotitolo, pratiche_formali, pratiche_informali, materiali, traccia_audio, esercizi(id, tipo, descrizione, traccia_audio, ordine, durata_minuti)')
      .eq('ciclo_id', id)
      .order('numero_settimana', { ascending: true })
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
        traccia_audio: corrente.traccia_audio || ''
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

  async function caricaTraccia(file, chiavePath) {
    if (file.size > AUDIO_MAX) throw new Error('AUDIO_TROPPO_GRANDE')
    const path = `${cicloId}/${chiavePath}-${Date.now()}.${estensioneAudio(file.name)}`
    const { error } = await supabase.storage.from('tracce-audio').upload(path, file, {
      upsert: false,
      contentType: file.type || 'audio/mpeg'
    })
    if (error) throw error
    const { data } = supabase.storage.from('tracce-audio').getPublicUrl(path)
    return data.publicUrl
  }

  async function salvaMeta(e) {
    e.preventDefault()
    setErrore(null)
    setOkMsg(null)
    if (!cicloId) return
    setInvioMeta(true)
    setCaricamentoAudio(Boolean(fileAudioSettimana))
    let traccia = meta.traccia_audio || null
    try {
      if (fileAudioSettimana) {
        traccia = await caricaTraccia(fileAudioSettimana, `s${meta.numero_settimana}`)
      }
    } catch (err) {
      setCaricamentoAudio(false)
      setInvioMeta(false)
      setErrore(err?.message === 'AUDIO_TROPPO_GRANDE'
        ? 'La traccia deve pesare al massimo 50 MB.'
        : 'Non è stato possibile caricare la traccia audio.')
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
      traccia_audio: traccia
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
    await caricaLezioni(cicloId)
  }

  async function eliminaLezione() {
    if (!corrente) return
    if (!confirm('Eliminare questa settimana e tutte le pratiche collegate?')) return
    await supabase.from('lezioni').delete().eq('id', corrente.id)
    setOkMsg(null)
    await caricaLezioni(cicloId)
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
    await caricaLezioni(cicloId)
  }

  async function caricaTracciaEsercizio(esercizioId, file) {
    if (!file) return
    setErrore(null)
    setCaricamentoEsercizioId(esercizioId)
    try {
      const url = await caricaTraccia(file, `s${settimana}-ex-${esercizioId.slice(0, 8)}`)
      const { error } = await supabase.from('esercizi').update({ traccia_audio: url }).eq('id', esercizioId)
      if (error) throw error
      await caricaLezioni(cicloId)
    } catch (err) {
      setErrore(err?.message === 'AUDIO_TROPPO_GRANDE'
        ? 'La traccia deve pesare al massimo 50 MB.'
        : 'Non è stato possibile caricare la traccia sull’esercizio.')
    } finally {
      setCaricamentoEsercizioId(null)
    }
  }

  async function rimuoviTracciaEsercizio(esercizioId) {
    await supabase.from('esercizi').update({ traccia_audio: null }).eq('id', esercizioId)
    await caricaLezioni(cicloId)
  }

  const badgeSettimana = Number(settimana) === 9
    ? 'Giornata intensiva'
    : `Settimana ${settimana} di 8`

  return (
    <div className="lezioni-gestione">
      <h2>Settimane di pratica</h2>
      <p className="lead">
        Stessa struttura che vedono i partecipanti: tema, pratiche formali con audio,
        pratiche informali da spuntare.
      </p>

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
              <input
                type="file"
                accept="audio/*"
                onChange={e => setFileAudioSettimana(e.target.files?.[0] || null)}
              />
              {fileAudioSettimana && <p className="hint">Nuovo file: {fileAudioSettimana.name}</p>}
              {!fileAudioSettimana && meta.traccia_audio && (
                <div className="lezioni-audio-riga">
                  <audio className="player-audio" controls src={meta.traccia_audio} preload="metadata">
                    Il browser non riproduce questa traccia.
                  </audio>
                  <button
                    className="btn btn-ghost"
                    type="button"
                    onClick={() => setMeta({ ...meta, traccia_audio: '' })}
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
                  {formali.map(ex => (
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
                                  ex.traccia_audio ? 'traccia audio' : 'senza traccia',
                                  ex.tipo === 'a_casa' ? 'tipo: a casa' : 'tipo: formale'
                                ].filter(Boolean).join(' · ')}
                              </p>
                            </>
                          )}
                        </div>
                      </div>

                      {modificaEx?.id !== ex.id && (
                        <>
                          {ex.traccia_audio ? (
                            <div className="lezioni-audio-riga">
                              <audio className="player-audio" controls src={ex.traccia_audio} preload="metadata">
                                Il browser non riproduce questa traccia.
                              </audio>
                              <button className="btn btn-ghost" type="button" onClick={() => rimuoviTracciaEsercizio(ex.id)}>
                                Rimuovi audio
                              </button>
                            </div>
                          ) : (
                            <p className="hint">Nessuna traccia ancora collegata a questa pratica.</p>
                          )}
                          <div className="lezioni-ex-azioni">
                            <label className="btn btn-ghost lezioni-file-btn">
                              {caricamentoEsercizioId === ex.id ? 'Caricamento…' : 'Carica audio'}
                              <input
                                type="file"
                                accept="audio/*"
                                hidden
                                disabled={caricamentoEsercizioId === ex.id}
                                onChange={e => {
                                  const file = e.target.files?.[0]
                                  e.target.value = ''
                                  caricaTracciaEsercizio(ex.id, file)
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
                  ))}
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
