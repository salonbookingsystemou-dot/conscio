import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminDialogo from '../../components/AdminDialogo.jsx'
import CardTracciaAudio from '../../components/CardTracciaAudio.jsx'
import DialogConferma from '../../components/DialogConferma.jsx'
import ModuloVetrina from '../../components/ModuloVetrina.jsx'
import {
  ETICHETTE_STATO,
  etichettaSettimana,
  formattaTempo
} from '../../lib/controlloTracce.js'
import { leggiScriptTraccia } from '../../lib/scriptTraccia.js'
import {
  eliminaTraccia,
  leggiTestoCard,
  messaggioErroreTraccia,
  rinominaTraccia,
  sostituisciFileTraccia
} from '../../lib/tracce.js'

export function durataBreve(minuti) {
  if (!Number.isFinite(minuti) || minuti <= 0) return null
  return `${minuti} min`
}

export function formattaQuando(iso) {
  if (!iso) return null
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return null
  return data.toLocaleString('it-IT', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function BadgeStato({ stato }) {
  return (
    <span className={`controllo-stato is-${stato}`}>
      <span className="controllo-stato-punto" aria-hidden="true" />
      {ETICHETTE_STATO[stato] || stato}
    </span>
  )
}

function etichettaUso(voce) {
  const pratica = voce?.tipo === 'settimana' ? 'audio della settimana' : (voce?.descrizione || 'pratica')
  return `${etichettaSettimana(Number(voce?.numeroSettimana))} → ${pratica}`
}

const GRUPPI = [
  ['collegamenti', 'Collegamenti nel ciclo'],
  ['file', 'File'],
  ['ascolto', 'Ascolto tecnico']
]

export default function SchedaTraccia({
  traccia,
  usi,
  statoVetrina,
  controllo,
  stato,
  esitiCiclo,
  nomeCiclo,
  inControllo,
  occupato,
  controlliSalvabili,
  onControlla,
  onAggiornata,
  onEliminata
}) {
  const [titolo, setTitolo] = useState(traccia.titolo || '')
  const [descrizione, setDescrizione] = useState(traccia.descrizione || '')
  const [inizio, setInizio] = useState(0)
  const [lavoro, setLavoro] = useState(null)
  const [messaggio, setMessaggio] = useState(null)
  const [errore, setErrore] = useState(null)
  const [dialogo, setDialogo] = useState(null)
  const [scriptInfo, setScriptInfo] = useState(null)
  const vetrinaRef = useRef(null)
  const fileRef = useRef(null)
  const ascoltoRef = useRef(null)

  useEffect(() => {
    let vivo = true
    setTitolo(traccia.titolo || '')
    setDescrizione(traccia.descrizione || '')
    setMessaggio(null)
    setErrore(null)
    setInizio(0)
    leggiTestoCard(traccia).then(testo => {
      if (vivo && testo) setDescrizione(testo)
    })
    setScriptInfo(null)
    leggiScriptTraccia(traccia.id)
      .then(esito => {
        if (!vivo) return
        if (!esito.disponibile) setScriptInfo(false)
        else setScriptInfo(esito.ricetta ? esito.ricetta.paragrafi.length : 0)
      })
      .catch(() => { if (vivo) setScriptInfo(false) })
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [traccia.id])

  async function esegui(nome, azione, fatto) {
    setLavoro(nome)
    setErrore(null)
    setMessaggio(null)
    try {
      await azione()
      if (fatto) setMessaggio(fatto)
      return true
    } catch (err) {
      const testo = err?.message
      const codice = err?.code || ['TITOLO_VUOTO', 'TESTO_NON_SALVATO', 'AUDIO_TROPPO_GRANDE'].includes(testo)
      setErrore(codice ? messaggioErroreTraccia(err) : (testo || messaggioErroreTraccia(err)))
      return false
    } finally {
      setLavoro(null)
    }
  }

  function salvaContenuto(e) {
    e.preventDefault()
    esegui('contenuto', async () => {
      await rinominaTraccia(traccia.id, titolo, descrizione)
      await onAggiornata()
    }, 'Titolo e testo salvati.')
  }

  function salvaVetrina() {
    esegui('vetrina', async () => {
      await vetrinaRef.current?.salva()
      await onAggiornata()
    }, 'Scheda della vetrina salvata.')
  }

  function sostituisci(file) {
    if (!file) return
    esegui('file', async () => {
      await sostituisciFileTraccia(traccia, file)
      await onAggiornata()
    }, 'File sostituito. Ricontrolla la traccia quando vuoi.')
  }

  function chiediElimina() {
    setDialogo(usi.length > 0 ? 'bloccata' : 'elimina')
  }

  async function confermaElimina() {
    setLavoro('elimina')
    setErrore(null)
    try {
      await eliminaTraccia(traccia)
      setDialogo(null)
      onEliminata()
    } catch (err) {
      if (err?.message === 'TRACCIA_IN_USO') {
        setDialogo('bloccata')
      } else {
        setDialogo(null)
        setErrore(messaggioErroreTraccia(err))
      }
    } finally {
      setLavoro(null)
    }
  }

  function ascoltaDa(secondi) {
    setInizio(secondi)
    ascoltoRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }

  const esiti = [...(esitiCiclo || []), ...(controllo?.esiti || [])]
  const misure = controllo?.misure || null
  const fileAggiornato = formattaQuando(traccia.file_aggiornato_il)
  const controllata = formattaQuando(controllo?.controllato_il)
  const peso = Number.isFinite(misure?.totale) && misure.totale > 0
    ? `${Math.round(misure.totale / 1048576 * 10) / 10} MB`
    : null

  return (
    <>
      {errore && <p className="avviso-errore" role="alert">{errore}</p>}
      {messaggio && <p className="disclaimer" role="status">{messaggio}</p>}

      <section className="dash-ciclo-sezione" ref={ascoltoRef} aria-labelledby="scheda-ascolto">
        <div className="dash-ciclo-sezione-testa"><h3 id="scheda-ascolto">Ascolto</h3></div>
        {traccia.url ? (
          <CardTracciaAudio
            key={`${traccia.url}-${inizio}`}
            src={traccia.url}
            titolo={traccia.titolo}
            descrizione={traccia.descrizione}
            etichettaDurata={durataBreve(traccia.durata_minuti) || 'Audio'}
            inizio={inizio}
            anteprima
          />
        ) : (
          <p className="hint">Questa traccia non ha un file.</p>
        )}
      </section>

      <section className="dash-ciclo-sezione" aria-labelledby="scheda-contenuto">
        <div className="dash-ciclo-sezione-testa"><h3 id="scheda-contenuto">Contenuto</h3></div>
        <form onSubmit={salvaContenuto}>
          <div className="field">
            <label htmlFor="scheda-titolo">Titolo</label>
            <input id="scheda-titolo" value={titolo} onChange={e => setTitolo(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="scheda-testo">Testo della card</label>
            <textarea
              id="scheda-testo"
              rows={3}
              value={descrizione}
              onChange={e => setDescrizione(e.target.value)}
              placeholder="Facoltativo nella card. Obbligatorio per la vetrina."
            />
            <p className="hint">Nella card della pratica e, se la pubblichi, nella pagina Ascolta.</p>
          </div>
          <button type="submit" className="btn" disabled={Boolean(lavoro)}>
            {lavoro === 'contenuto' ? 'Salvataggio…' : 'Salva titolo e testo'}
          </button>
        </form>
      </section>

      <section className="dash-ciclo-sezione" aria-labelledby="scheda-file">
        <div className="dash-ciclo-sezione-testa"><h3 id="scheda-file">File</h3></div>
        <p className="hint">
          {[durataBreve(traccia.durata_minuti), peso, fileAggiornato && `file del ${fileAggiornato}`]
            .filter(Boolean).join(' · ') || 'Nessuna informazione sul file.'}
        </p>
        <div className="azioni">
          <button
            type="button"
            className="btn btn-ghost"
            disabled={Boolean(lavoro) || inControllo}
            onClick={() => fileRef.current?.click()}
          >
            {lavoro === 'file' ? 'Carico il file…' : 'Sostituisci il file'}
          </button>
          <Link
            className="btn btn-ghost"
            to={`/admin/tracce/nuova?modo=genera&sostituisci=${traccia.id}`}
          >
            Rigenera da script
          </Link>
        </div>
        <p className="hint">Titolo, testo, vetrina e collegamenti restano: cambia solo l’audio.</p>
        {scriptInfo === 0 && (
          <p className="hint">
            Non c’è ancora uno script salvato. Se la generi da qui, testo, pause e paragrafi già fatti restano sulla traccia.
          </p>
        )}
        {scriptInfo > 0 && (
          <p className="hint">
            C’è lo script di questa generazione
            {scriptInfo === 1 ? ' (1 paragrafo)' : ` (${scriptInfo} paragrafi)`}.
            Puoi cambiarlo e rigenerare solo i paragrafi toccati.
          </p>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          hidden
          onChange={e => {
            const file = e.target.files?.[0]
            e.target.value = ''
            sostituisci(file)
          }}
        />
      </section>

      <section className="dash-ciclo-sezione" aria-labelledby="scheda-vetrina">
        <div className="dash-ciclo-sezione-testa"><h3 id="scheda-vetrina">Vetrina</h3></div>
        <ModuloVetrina
          key={`${traccia.id}-${Boolean(statoVetrina?.pubblica)}`}
          ref={vetrinaRef}
          tracciaId={traccia.id}
          titolo={titolo}
          descrizione={descrizione}
        />
        <button type="button" className="btn" disabled={Boolean(lavoro)} onClick={salvaVetrina}>
          {lavoro === 'vetrina' ? 'Salvataggio…' : 'Salva la vetrina'}
        </button>
      </section>

      <section className="dash-ciclo-sezione" aria-labelledby="scheda-usi">
        <div className="dash-ciclo-sezione-testa"><h3 id="scheda-usi">Dove è usata</h3></div>
        {usi.length === 0 ? (
          <p className="hint">Non è collegata a nessuna pratica.</p>
        ) : (
          <ul className="admin-elenco-usi">
            {usi.map((voce, i) => (
              <li key={voce.esercizioId || voce.lezioneId || i}>
                {voce.cicloId ? (
                  <Link to={`/admin/cicli/${voce.cicloId}/programma/settimana/${voce.numeroSettimana}`}>
                    {etichettaUso(voce)}
                  </Link>
                ) : etichettaUso(voce)}
                {voce.cicloNome && <span className="hint"> · {voce.cicloNome}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="dash-ciclo-sezione" aria-labelledby="scheda-controllo">
        <div className="dash-ciclo-sezione-testa">
          <h3 id="scheda-controllo">Controllo</h3>
          <BadgeStato stato={inControllo ? 'attesa' : stato} />
        </div>
        <p className="hint">
          {inControllo
            ? 'Controllo il file e lo ascolto per intero…'
            : controllata
              ? `Ultimo controllo il ${controllata}${stato === 'da-ricontrollare' ? ', prima che il file cambiasse' : ''}.`
              : 'Non è ancora stata controllata.'}
          {misure?.durata > 0 && ` Durata vera ${formattaTempo(misure.durata)}`}
          {Number.isFinite(misure?.integrata) && ` · ${Math.round(misure.integrata)} LUFS`}
          {misure?.durata > 0 && '.'}
        </p>
        {nomeCiclo && (
          <p className="hint">I collegamenti si riferiscono a {nomeCiclo}.</p>
        )}
        {GRUPPI.map(([gruppo, nome]) => {
          const delGruppo = esiti.filter(e => e.gruppo === gruppo)
          if (delGruppo.length === 0) return null
          return (
            <div key={gruppo}>
              <p className="controllo-kicker">{nome}</p>
              <ul className="controllo-esiti">
                {delGruppo.map((e, i) => (
                  <li key={i} className={`controllo-esito is-${e.livello}`}>
                    <span>
                      {gruppo === 'collegamenti' && `${etichettaSettimana(e.settimana)} · ${e.pratica}: `}
                      {e.testo}
                    </span>
                    {Number.isFinite(e.da) && traccia.url && (
                      <button type="button" className="btn-text" onClick={() => ascoltaDa(e.da)}>
                        Ascolta da {formattaTempo(e.da)}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
        {controllo && esiti.length === 0 && !inControllo && (
          <p className="hint">Nessun problema trovato.</p>
        )}
        {!controlliSalvabili && (
          <p className="hint">
            I risultati non si salvano ancora: manca la tabella dei controlli nel database.
          </p>
        )}
        <button
          type="button"
          className="btn btn-ghost"
          disabled={occupato || !traccia.url || Boolean(lavoro)}
          onClick={onControlla}
        >
          {inControllo ? 'Controllo…' : controllo ? 'Ricontrolla' : 'Controlla'}
        </button>
        <p className="hint">
          Il controllo scarica il file intero e cerca tratti molto più bassi del resto, silenzi lunghi,
          finali tagliati e durate sbagliate. Segnala dove ascoltare: non sostituisce un ascolto vero.
        </p>
      </section>

      <section className="dash-ciclo-sezione" aria-labelledby="scheda-elimina">
        <div className="dash-ciclo-sezione-testa"><h3 id="scheda-elimina">Elimina</h3></div>
        <p className="hint">Il file viene rimosso dallo storage. Si può solo se la traccia non è collegata a nessuna pratica.</p>
        <button
          type="button"
          className="btn btn-ghost is-pericolo"
          disabled={Boolean(lavoro) || inControllo}
          onClick={chiediElimina}
        >
          Elimina la traccia
        </button>
      </section>

      <DialogConferma
        aperto={dialogo === 'elimina'}
        titolo="Eliminare dalla libreria?"
        confermaEtichetta="Elimina traccia"
        pericolo
        occupato={lavoro === 'elimina'}
        onConferma={confermaElimina}
        onAnnulla={() => setDialogo(null)}
      >
        <p>Eliminare «{traccia.titolo}» dalla libreria? Il file verrà rimosso.</p>
      </DialogConferma>

      {dialogo === 'bloccata' && (
        <AdminDialogo titolo="Traccia ancora collegata" onChiudi={() => setDialogo(null)}>
          <p>
            Non puoi eliminare «{traccia.titolo}»: è ancora collegata a
            {usi.length === 1 ? ' questa pratica:' : ' queste pratiche:'}
          </p>
          <ul className="admin-elenco-usi">
            {usi.map((voce, i) => (
              <li key={voce.esercizioId || voce.lezioneId || i}>
                {etichettaUso(voce)}{voce.cicloNome ? ` (${voce.cicloNome})` : ''}
              </li>
            ))}
          </ul>
          <div className="dialogo-azioni">
            <button type="button" className="btn" onClick={() => setDialogo(null)}>Ho capito</button>
          </div>
        </AdminDialogo>
      )}
    </>
  )
}
