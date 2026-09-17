import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { SelettoreTraccia } from '../components/LibreriaTracce.jsx'
import { elencaTracce } from '../lib/tracce'

const NUMERI_SETTIMANA = [1, 2, 3, 4, 5, 6, 7, 8, 9]
const SCHEDE = [
  { id: 'tema', etichetta: 'Tema' },
  { id: 'formali', etichetta: 'Pratiche formali' },
  { id: 'informali', etichetta: 'Pratiche informali' }
]

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

function IconaMatita() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4.8 16.4 15.6 5.6a1.6 1.6 0 0 1 2.3 0l.5.5a1.6 1.6 0 0 1 0 2.3L7.6 19.2 4 20z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconaCestino() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 8h14M9.2 8V6.4A1.4 1.4 0 0 1 10.6 5h2.8a1.4 1.4 0 0 1 1.4 1.4V8M16.2 8v10.2a1.4 1.4 0 0 1-1.4 1.4H9.2a1.4 1.4 0 0 1-1.4-1.4V8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function EditorSettimana() {
  const { cicloId, numero } = useParams()
  const n = Number(numero)
  const [ciclo, setCiclo] = useState(null)
  const [lezioni, setLezioni] = useState([])
  const [lezione, setLezione] = useState(null)
  const [esercizi, setEsercizi] = useState([])
  const [tracce, setTracce] = useState([])
  const [scheda, setScheda] = useState('tema')
  const [tema, setTema] = useState({ titolo: '', sottotitolo: '', materiali: '' })
  const [nuovaFormale, setNuovaFormale] = useState({ descrizione: '', durata_minuti: '', tracciaId: '' })
  const [nuovaInformale, setNuovaInformale] = useState('')
  const [modifica, setModifica] = useState(null)
  const [daEliminare, setDaEliminare] = useState(null)
  const [invio, setInvio] = useState(false)
  const [errore, setErrore] = useState(null)
  const [okMsg, setOkMsg] = useState(null)

  const formali = useMemo(() => esercizi.filter(eFormale), [esercizi])
  const informali = useMemo(() => esercizi.filter(eInformale), [esercizi])
  const perNumero = useMemo(() => {
    const mappa = {}
    for (const l of lezioni) mappa[l.numero_settimana] = l
    return mappa
  }, [lezioni])

  async function carica() {
    if (!cicloId || !Number.isFinite(n)) return
    setErrore(null)
    const [{ data: cicloRiga, error: errCiclo }, { data: elenco, error: errElenco }, { data: tracceLista, error: errTracce }] = await Promise.all([
      supabase.from('cicli').select('id, nome_ciclo').eq('id', cicloId).maybeSingle(),
      supabase.from('lezioni').select('id, numero_settimana, tema').eq('ciclo_id', cicloId).order('numero_settimana'),
      elencaTracce().then(lista => ({ data: lista, error: null })).catch(error => ({ data: [], error }))
    ])
    if (errCiclo) {
      setErrore('Non è stato possibile leggere il ciclo.')
      return
    }
    if (errElenco) {
      setErrore('Non è stato possibile leggere le settimane.')
      return
    }
    if (errTracce) setErrore('Non è stato possibile leggere la libreria tracce.')
    setCiclo(cicloRiga)
    setLezioni(elenco || [])
    setTracce(tracceLista || [])

    const corrente = (elenco || []).find(l => l.numero_settimana === n) || null
    if (!corrente) {
      setLezione(null)
      setEsercizi([])
      setTema({ titolo: '', sottotitolo: '', materiali: '' })
      return
    }

    const { data: dettaglio, error: errDettaglio } = await supabase
      .from('lezioni')
      .select('id, numero_settimana, tema, sottotitolo, materiali')
      .eq('id', corrente.id)
      .single()
    if (errDettaglio) {
      setErrore('Non è stato possibile leggere il tema della settimana.')
      return
    }
    setLezione(dettaglio)
    setTema({
      titolo: dettaglio.tema || '',
      sottotitolo: dettaglio.sottotitolo || '',
      materiali: dettaglio.materiali || ''
    })

    const { data: righe, error: errEsercizi } = await supabase
      .from('esercizi')
      .select('id, tipo, descrizione, traccia_id, traccia_audio, ordine, durata_minuti')
      .eq('lezione_id', corrente.id)
      .order('ordine', { ascending: true })
    if (errEsercizi) {
      setErrore('Non è stato possibile leggere le pratiche.')
      setEsercizi([])
      return
    }
    setEsercizi(righe || [])
  }

  useEffect(() => {
    setScheda('tema')
    setModifica(null)
    setDaEliminare(null)
    setOkMsg(null)
    setErrore(null)
    setNuovaFormale({ descrizione: '', durata_minuti: '', tracciaId: '' })
    setNuovaInformale('')
    carica()
  }, [cicloId, n])

  async function salvaTema(e) {
    e.preventDefault()
    const titolo = tema.titolo.trim()
    if (!titolo) {
      setErrore('Il titolo della settimana è obbligatorio.')
      return
    }
    setInvio(true)
    setErrore(null)
    setOkMsg(null)
    const payload = {
      ciclo_id: cicloId,
      numero_settimana: n,
      tema: titolo,
      sottotitolo: tema.sottotitolo.trim() || null,
      materiali: tema.materiali.trim() || null
    }
    const { error } = lezione
      ? await supabase.from('lezioni').update(payload).eq('id', lezione.id)
      : await supabase.from('lezioni').insert(payload)
    setInvio(false)
    if (error) {
      setErrore('Non è stato possibile salvare il tema.')
      return
    }
    setOkMsg(lezione ? 'Tema salvato.' : 'Settimana creata.')
    await carica()
  }

  async function assicuraLezione() {
    if (lezione?.id) return lezione
    setErrore('Salva prima il tema per aggiungere le pratiche.')
    setScheda('tema')
    return null
  }

  async function aggiungiFormale(e) {
    e.preventDefault()
    const corrente = await assicuraLezione()
    if (!corrente) return
    const descrizione = nuovaFormale.descrizione.trim()
    const durata = Number(nuovaFormale.durata_minuti)
    const traccia = tracce.find(t => t.id === nuovaFormale.tracciaId)
    if (!descrizione || !traccia || !Number.isFinite(durata) || durata <= 0) {
      setErrore('Nome, durata e traccia sono obbligatori.')
      return
    }
    setInvio(true)
    setErrore(null)
    const ordine = (esercizi.reduce((max, ex) => Math.max(max, ex.ordine || 0), 0) || 0) + 1
    const { error } = await supabase.from('esercizi').insert({
      lezione_id: corrente.id,
      tipo: 'formale',
      descrizione,
      durata_minuti: durata,
      traccia_id: traccia.id,
      traccia_audio: traccia.url,
      ordine
    })
    setInvio(false)
    if (error) {
      setErrore('Non è stato possibile aggiungere la pratica formale.')
      return
    }
    setNuovaFormale({ descrizione: '', durata_minuti: '', tracciaId: '' })
    setOkMsg('Pratica formale aggiunta.')
    await carica()
  }

  async function salvaFormale(ex) {
    if (!modifica || modifica.id !== ex.id) return
    const descrizione = modifica.descrizione.trim()
    const durata = Number(modifica.durata_minuti)
    const traccia = tracce.find(t => t.id === modifica.tracciaId)
    if (!descrizione || !traccia || !Number.isFinite(durata) || durata <= 0) {
      setErrore('Nome, durata e traccia sono obbligatori.')
      return
    }
    setInvio(true)
    setErrore(null)
    const { error } = await supabase.from('esercizi').update({
      descrizione,
      durata_minuti: durata,
      traccia_id: traccia.id,
      traccia_audio: traccia.url
    }).eq('id', ex.id)
    setInvio(false)
    if (error) {
      setErrore('Non è stato possibile aggiornare la pratica.')
      return
    }
    setModifica(null)
    setOkMsg('Pratica formale salvata.')
    await carica()
  }

  async function aggiungiInformale(e) {
    e.preventDefault()
    const corrente = await assicuraLezione()
    if (!corrente) return
    const descrizione = nuovaInformale.trim()
    if (!descrizione) {
      setErrore('Il nome della pratica informale è obbligatorio.')
      return
    }
    setInvio(true)
    setErrore(null)
    const ordine = (esercizi.reduce((max, ex) => Math.max(max, ex.ordine || 0), 0) || 0) + 1
    const { error } = await supabase.from('esercizi').insert({
      lezione_id: corrente.id,
      tipo: 'informale',
      descrizione,
      ordine
    })
    setInvio(false)
    if (error) {
      setErrore('Non è stato possibile aggiungere la pratica informale.')
      return
    }
    setNuovaInformale('')
    setOkMsg('Pratica informale aggiunta.')
    await carica()
  }

  async function salvaInformale(ex) {
    if (!modifica || modifica.id !== ex.id) return
    const descrizione = modifica.descrizione.trim()
    if (!descrizione) {
      setErrore('Il nome della pratica informale è obbligatorio.')
      return
    }
    setInvio(true)
    setErrore(null)
    const { error } = await supabase.from('esercizi').update({ descrizione }).eq('id', ex.id)
    setInvio(false)
    if (error) {
      setErrore('Non è stato possibile aggiornare la pratica.')
      return
    }
    setModifica(null)
    setOkMsg('Pratica informale salvata.')
    await carica()
  }

  async function confermaElimina() {
    if (!daEliminare) return
    setInvio(true)
    setErrore(null)
    const { error } = await supabase.from('esercizi').delete().eq('id', daEliminare.id)
    setInvio(false)
    if (error) {
      setErrore('Non è stato possibile rimuovere la pratica.')
      return
    }
    if (modifica?.id === daEliminare.id) setModifica(null)
    setDaEliminare(null)
    setOkMsg('Pratica rimossa.')
    await carica()
  }

  const etichetta = etichettaSettimana(n)
  const nomeCiclo = ciclo?.nome_ciclo || 'Ciclo'
  const indietro = cicloId ? `/percorso?ciclo=${cicloId}` : '/percorso'

  return (
    <>
      <div className="editor-settimana">
        <nav className="editor-breadcrumb" aria-label="Percorso">
          <Link to={indietro}>Percorso</Link>
          <span aria-hidden="true"> / </span>
          <span>{nomeCiclo}</span>
          <span aria-hidden="true"> / </span>
          <span>{etichetta}</span>
        </nav>

        <div className="editor-corpo">
          <nav className="editor-settimane" aria-label="Settimane del ciclo">
            {NUMERI_SETTIMANA.map(num => {
              const riga = perNumero[num]
              const aperta = num === n
              const pronta = Boolean(riga?.tema && String(riga.tema).trim())
              return (
                <Link
                  key={num}
                  to={`/percorso/${cicloId}/settimana/${num}`}
                  className={`editor-settimane-voce${aperta ? ' is-on' : ''}${pronta ? '' : ' is-vuota'}`}
                  aria-current={aperta ? 'page' : undefined}
                >
                  <strong>{etichettaSettimana(num)}</strong>
                  <span>{pronta ? riga.tema : 'Da creare'}</span>
                </Link>
              )
            })}
          </nav>

          <div className="editor-contenuto">
            <div className="editor-schede" role="tablist" aria-label="Schede della settimana">
              {SCHEDE.map(s => (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={scheda === s.id}
                  className={`editor-scheda${scheda === s.id ? ' is-on' : ''}`}
                  onClick={() => {
                    setScheda(s.id)
                    setOkMsg(null)
                    setErrore(null)
                  }}
                >
                  {s.etichetta}
                </button>
              ))}
            </div>

            {errore && <p className="admin-alert" role="alert">{errore}</p>}
            {okMsg && <p className="editor-ok">{okMsg}</p>}

            {scheda === 'tema' && (
              <form className="editor-pannello" onSubmit={salvaTema}>
                <div className="admin-field">
                  <label htmlFor="editor-titolo">Titolo</label>
                  <input
                    id="editor-titolo"
                    required
                    value={tema.titolo}
                    onChange={e => setTema({ ...tema, titolo: e.target.value })}
                    placeholder={n === 9 ? 'Giornata intensiva' : `Tema settimana ${n}`}
                  />
                </div>
                <div className="admin-field">
                  <label htmlFor="editor-sottotitolo">Sottotitolo (facoltativo)</label>
                  <input
                    id="editor-sottotitolo"
                    value={tema.sottotitolo}
                    onChange={e => setTema({ ...tema, sottotitolo: e.target.value })}
                    placeholder="Una riga sotto il titolo"
                  />
                </div>
                <div className="admin-field">
                  <label htmlFor="editor-materiali">Materiali per il gruppo (facoltativo)</label>
                  <textarea
                    id="editor-materiali"
                    rows={4}
                    value={tema.materiali}
                    onChange={e => setTema({ ...tema, materiali: e.target.value })}
                    placeholder="Link, dispense o note"
                  />
                </div>
                <button className="admin-btn-primario" type="submit" disabled={invio}>
                  {invio ? 'Salvataggio…' : 'Salva tema'}
                </button>
              </form>
            )}

            {scheda === 'formali' && (
              <div className="editor-pannello">
                {!lezione ? (
                  <p className="admin-card-vuota">Salva prima il tema per aggiungere le pratiche formali.</p>
                ) : (
                  <>
                    <ul className="editor-lista">
                      {formali.length === 0 && (
                        <li className="editor-lista-vuota">Nessuna pratica formale. Aggiungila sotto.</li>
                      )}
                      {formali.map(ex => {
                        const inModifica = modifica?.id === ex.id
                        const titoloTraccia = tracce.find(t => t.id === ex.traccia_id)?.titolo
                        return (
                          <li key={ex.id} className="editor-riga">
                            {inModifica ? (
                              <div className="editor-riga-form">
                                <div className="admin-field">
                                  <label htmlFor={`formale-nome-${ex.id}`}>Nome</label>
                                  <input
                                    id={`formale-nome-${ex.id}`}
                                    value={modifica.descrizione}
                                    onChange={e => setModifica({ ...modifica, descrizione: e.target.value })}
                                  />
                                </div>
                                <div className="admin-field">
                                  <label htmlFor={`formale-durata-${ex.id}`}>Durata (minuti)</label>
                                  <input
                                    id={`formale-durata-${ex.id}`}
                                    type="number"
                                    min="1"
                                    max="180"
                                    value={modifica.durata_minuti}
                                    onChange={e => setModifica({ ...modifica, durata_minuti: e.target.value })}
                                  />
                                </div>
                                <div className="admin-field">
                                  <label htmlFor={`formale-traccia-${ex.id}`}>Traccia collegata</label>
                                  <SelettoreTraccia
                                    id={`formale-traccia-${ex.id}`}
                                    valore={modifica.tracciaId}
                                    tracce={tracce}
                                    etichettaVuoto="Scegli dalla libreria…"
                                    onCambia={id => setModifica({ ...modifica, tracciaId: id || '' })}
                                  />
                                </div>
                                <div className="admin-dialogo-azioni">
                                  <button type="button" className="admin-btn-primario" disabled={invio} onClick={() => salvaFormale(ex)}>
                                    Salva
                                  </button>
                                  <button type="button" className="admin-btn-ghost" onClick={() => setModifica(null)}>
                                    Annulla
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="editor-riga-testi">
                                  <strong>{ex.descrizione}</strong>
                                  <p>
                                    {Number.isFinite(ex.durata_minuti) && ex.durata_minuti > 0
                                      ? `${ex.durata_minuti} min`
                                      : 'Durata non indicata'}
                                    {titoloTraccia ? ` · ${titoloTraccia}` : ' · Senza traccia'}
                                  </p>
                                </div>
                                <div className="admin-riga-azioni">
                                  <button
                                    type="button"
                                    className="admin-icon-btn"
                                    aria-label={`Modifica ${ex.descrizione}`}
                                    title="Modifica"
                                    onClick={() => setModifica({
                                      id: ex.id,
                                      descrizione: ex.descrizione || '',
                                      durata_minuti: ex.durata_minuti || '',
                                      tracciaId: ex.traccia_id || ''
                                    })}
                                  >
                                    <IconaMatita />
                                  </button>
                                  <button
                                    type="button"
                                    className="admin-icon-btn is-danger"
                                    aria-label={`Rimuovi ${ex.descrizione}`}
                                    title="Rimuovi"
                                    onClick={() => setDaEliminare(ex)}
                                  >
                                    <IconaCestino />
                                  </button>
                                </div>
                              </>
                            )}
                          </li>
                        )
                      })}
                    </ul>

                    <form className="editor-aggiungi" onSubmit={aggiungiFormale}>
                      <p className="editor-aggiungi-kicker">Aggiungi una pratica formale</p>
                      <div className="admin-field">
                        <label htmlFor="nuova-formale-nome">Nome</label>
                        <input
                          id="nuova-formale-nome"
                          required
                          value={nuovaFormale.descrizione}
                          onChange={e => setNuovaFormale({ ...nuovaFormale, descrizione: e.target.value })}
                          placeholder="es. Body Scan"
                        />
                      </div>
                      <div className="admin-field">
                        <label htmlFor="nuova-formale-durata">Durata (minuti)</label>
                        <input
                          id="nuova-formale-durata"
                          type="number"
                          min="1"
                          max="180"
                          required
                          value={nuovaFormale.durata_minuti}
                          onChange={e => setNuovaFormale({ ...nuovaFormale, durata_minuti: e.target.value })}
                          placeholder="15"
                        />
                      </div>
                      <div className="admin-field">
                        <label htmlFor="nuova-formale-traccia">Traccia</label>
                        <SelettoreTraccia
                          id="nuova-formale-traccia"
                          valore={nuovaFormale.tracciaId}
                          tracce={tracce}
                          etichettaVuoto="Scegli dalla libreria…"
                          onCambia={id => setNuovaFormale({ ...nuovaFormale, tracciaId: id || '' })}
                        />
                      </div>
                      <button className="admin-btn-primario" type="submit" disabled={invio || !nuovaFormale.tracciaId}>
                        Aggiungi pratica
                      </button>
                    </form>
                  </>
                )}
              </div>
            )}

            {scheda === 'informali' && (
              <div className="editor-pannello">
                {!lezione ? (
                  <p className="admin-card-vuota">Salva prima il tema per aggiungere le pratiche informali.</p>
                ) : (
                  <>
                    <ul className="editor-lista">
                      {informali.length === 0 && (
                        <li className="editor-lista-vuota">Nessuna pratica informale. Aggiungila sotto.</li>
                      )}
                      {informali.map(ex => {
                        const inModifica = modifica?.id === ex.id
                        return (
                          <li key={ex.id} className="editor-riga">
                            {inModifica ? (
                              <div className="editor-riga-form">
                                <div className="admin-field">
                                  <label htmlFor={`informale-nome-${ex.id}`}>Nome</label>
                                  <input
                                    id={`informale-nome-${ex.id}`}
                                    value={modifica.descrizione}
                                    onChange={e => setModifica({ ...modifica, descrizione: e.target.value })}
                                  />
                                </div>
                                <div className="admin-dialogo-azioni">
                                  <button type="button" className="admin-btn-primario" disabled={invio} onClick={() => salvaInformale(ex)}>
                                    Salva
                                  </button>
                                  <button type="button" className="admin-btn-ghost" onClick={() => setModifica(null)}>
                                    Annulla
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <p className="editor-riga-nome">{ex.descrizione}</p>
                                <div className="admin-riga-azioni">
                                  <button
                                    type="button"
                                    className="admin-icon-btn"
                                    aria-label={`Modifica ${ex.descrizione}`}
                                    title="Modifica"
                                    onClick={() => setModifica({
                                      id: ex.id,
                                      descrizione: ex.descrizione || ''
                                    })}
                                  >
                                    <IconaMatita />
                                  </button>
                                  <button
                                    type="button"
                                    className="admin-icon-btn is-danger"
                                    aria-label={`Rimuovi ${ex.descrizione}`}
                                    title="Rimuovi"
                                    onClick={() => setDaEliminare(ex)}
                                  >
                                    <IconaCestino />
                                  </button>
                                </div>
                              </>
                            )}
                          </li>
                        )
                      })}
                    </ul>

                    <form className="editor-aggiungi" onSubmit={aggiungiInformale}>
                      <p className="editor-aggiungi-kicker">Aggiungi una pratica informale</p>
                      <div className="admin-field">
                        <label htmlFor="nuova-informale-nome">Nome</label>
                        <input
                          id="nuova-informale-nome"
                          required
                          value={nuovaInformale}
                          onChange={e => setNuovaInformale(e.target.value)}
                          placeholder="es. Bere il caffè consapevolmente"
                        />
                      </div>
                      <button className="admin-btn-primario" type="submit" disabled={invio}>
                        Aggiungi pratica
                      </button>
                    </form>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {daEliminare && (
        <EditorDialogo
          titolo="Rimuovere questa pratica?"
          onChiudi={() => !invio && setDaEliminare(null)}
        >
          <p>«{daEliminare.descrizione}» sparisce dalla settimana. La traccia resta in libreria.</p>
          <div className="admin-dialogo-azioni">
            <button type="button" className="admin-btn-pericolo" disabled={invio} onClick={confermaElimina}>
              {invio ? 'Rimozione…' : 'Rimuovi pratica'}
            </button>
            <button type="button" className="admin-btn-ghost" disabled={invio} onClick={() => setDaEliminare(null)}>
              Annulla
            </button>
          </div>
        </EditorDialogo>
      )}
    </>
  )
}

function EditorDialogo({ titolo, children, onChiudi }) {
  const el = useRef(null)

  useEffect(() => {
    const dialog = el.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
  }, [])

  return (
    <dialog
      ref={el}
      className="mbsr-theme admin-dialogo"
      onClose={onChiudi}
      onCancel={e => {
        e.preventDefault()
        onChiudi()
      }}
      onClick={e => {
        if (e.target === el.current) onChiudi()
      }}
    >
      <h2>{titolo}</h2>
      {children}
    </dialog>
  )
}
