import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  intervalloSettimana,
  leggiImpostazioniSito,
  leggiProgramma,
  leggiStatistiche,
  riepilogoStatistiche,
  salvaImpostazioniSito,
  settimaneVetrina
} from '../lib/vetrina.js'

const ETICHETTE = [
  ['avvii', 'Avvii'],
  ['completamenti', 'Completamenti'],
  ['clic_cta', 'Clic sull’invito'],
  ['condivisioni', 'Condivisioni']
]

export default function EditorVetrina() {
  const [attiva, setAttiva] = useState(false)
  const [titolo, setTitolo] = useState('')
  const [testo, setTesto] = useState('')
  const [senzaCiclo, setSenzaCiclo] = useState('')
  const [statistiche, setStatistiche] = useState(null)
  const [settimane, setSettimane] = useState([])
  const [stato, setStato] = useState(null)
  const [errore, setErrore] = useState('')

  useEffect(() => {
    let vivo = true
    Promise.all([
      leggiImpostazioniSito(),
      leggiStatistiche().catch(() => []),
      leggiProgramma().catch(() => [])
    ]).then(([impostazioni, righe, programma]) => {
      if (!vivo) return
      setAttiva(Boolean(impostazioni.vetrina_attiva))
      setTitolo(impostazioni.cta_titolo || '')
      setTesto(impostazioni.cta_testo || '')
      setSenzaCiclo(impostazioni.cta_testo_senza_ciclo || '')
      setStatistiche(riepilogoStatistiche(righe))
      setSettimane(settimaneVetrina(programma))
    }).catch(() => {
      if (vivo) setErrore('Non è stato possibile leggere le impostazioni della vetrina.')
    })
    return () => { vivo = false }
  }, [])

  async function salva(e) {
    e.preventDefault()
    if (!titolo.trim() || !testo.trim() || !senzaCiclo.trim()) {
      setErrore('I tre testi dell’invito vanno compilati.')
      return
    }
    setErrore('')
    setStato('invio')
    try {
      await salvaImpostazioniSito({
        vetrina_attiva: attiva,
        cta_titolo: titolo,
        cta_testo: testo,
        cta_testo_senza_ciclo: senzaCiclo
      })
      setStato('ok')
    } catch {
      setErrore('Non è stato possibile salvare la vetrina.')
      setStato(null)
    }
  }

  const totale = statistiche?.totale

  return (
    <div className="card">
      <h3>Ascolta</h3>
      <p className="hint">
        Pagina pubblica delle meditazioni. Elenca le tracce della libreria con la spunta «Disponibile per la vetrina», senza seguire i cicli.
      </p>
      <form onSubmit={salva}>
        <label className="vetrina-spunta">
          <input
            type="checkbox"
            checked={attiva}
            onChange={e => { setAttiva(e.target.checked); setStato(null) }}
          />
          <span>Vetrina attiva</span>
        </label>
        <p className="disclaimer">Accende la pagina. Le meditazioni sono quelle spuntate in libreria, non le pratiche del ciclo.</p>

        <div className="field">
          <label htmlFor="vetrina-cta-titolo">Titolo dell’invito</label>
          <input id="vetrina-cta-titolo" value={titolo} onChange={e => { setTitolo(e.target.value); setStato(null) }} />
        </div>
        <div className="field">
          <label htmlFor="vetrina-cta-testo">Testo, quando le iscrizioni sono aperte</label>
          <textarea id="vetrina-cta-testo" rows={3} value={testo} onChange={e => { setTesto(e.target.value); setStato(null) }} />
        </div>
        <div className="field">
          <label htmlFor="vetrina-cta-chiuso">Testo, quando non c’è un ciclo in reclutamento</label>
          <textarea id="vetrina-cta-chiuso" rows={3} value={senzaCiclo} onChange={e => { setSenzaCiclo(e.target.value); setStato(null) }} />
        </div>

        <div className="azioni">
          <button className="btn" type="submit" disabled={stato === 'invio'}>
            {stato === 'invio' ? 'Salvataggio…' : 'Salva vetrina'}
          </button>
          <Link className="btn btn-ghost" to="/ascolta" target="_blank" rel="noopener noreferrer">
            Apri la vetrina
          </Link>
        </div>
        {stato === 'ok' && <p className="hint">Impostazioni aggiornate.</p>}
        {errore && <p className="avviso-errore" role="alert">{errore}</p>}
      </form>

      <h3>Prossime settimane</h3>
      <ul className="vetrina-calendario">
        {settimane.map(settimana => (
          <li key={settimana.dal.toISOString()}>
            <span>{intervalloSettimana(settimana.dal, settimana.al)}</span>
            {settimana.tracce.length === 0 ? (
              <span className="hint">Slot vuoto</span>
            ) : settimana.tracce.map(traccia => (
              <span key={traccia.id}>
                {traccia.titolo}
                {!traccia.pubblica && ' · non ancora pubblica'}
              </span>
            ))}
          </li>
        ))}
      </ul>

      <h3>Ultime quattro settimane</h3>
      {totale && (
        <div className="dash-kpi">
          {ETICHETTE.map(([chiave, etichetta]) => (
            <article key={chiave} className="dash-kpi-card">
              <p className="dash-kpi-label">{etichetta}</p>
              <p className="dash-kpi-valore">{totale[chiave]}</p>
            </article>
          ))}
        </div>
      )}
      {statistiche && statistiche.righe.length === 0 ? (
        <p className="hint">Nessun ascolto in queste quattro settimane.</p>
      ) : statistiche && (
        <table className="pratica-tabella">
          <thead>
            <tr>
              <th scope="col">Traccia</th>
              <th scope="col">Avvii</th>
              <th scope="col">Completamenti</th>
              <th scope="col">Invito</th>
              <th scope="col">Condivisioni</th>
            </tr>
          </thead>
          <tbody>
            {statistiche.righe.map(riga => (
              <tr key={riga.id}>
                <td>{riga.titolo}</td>
                <td className="is-volte">{riga.avvii}</td>
                <td className="is-volte">{riga.completamenti}</td>
                <td className="is-volte">{riga.clic_cta}</td>
                <td className="is-volte">{riga.condivisioni}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="hint">
        Le pagine per l’anteprima sui social, all’indirizzo /a/…, si generano in un passaggio successivo. Il pulsante per rigenerarle arriverà allora.
      </p>
    </div>
  )
}
