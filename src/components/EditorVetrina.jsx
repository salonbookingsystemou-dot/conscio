import { useEffect, useState } from 'react'
import {
  intervalloSettimana,
  leggiImpostazioniSito,
  leggiProgramma,
  leggiStatistiche,
  riepilogoStatistiche,
  salvaImpostazioniSito,
  settimaneVetrina
} from '../lib/vetrina.js'
import { useSnackbar } from './admin/Snackbar.jsx'

const ETICHETTE = [
  ['avvii', 'Avvii'],
  ['completamenti', 'Completamenti'],
  ['clic_cta', 'Clic sull’invito'],
  ['condivisioni', 'Condivisioni']
]

// Le settimane vuote consecutive diventano una riga sola.
function raggruppaSettimane(settimane) {
  const righe = []
  for (const settimana of settimane) {
    const ultima = righe[righe.length - 1]
    if (settimana.tracce.length === 0 && ultima?.vuota) {
      ultima.al = settimana.al
      ultima.quante += 1
    } else {
      righe.push({ dal: settimana.dal, al: settimana.al, tracce: settimana.tracce, vuota: settimana.tracce.length === 0, quante: 1 })
    }
  }
  return righe
}

/** Vetrina Ascoltati: interruttore e testi dell'invito, calendario della pillola della settimana, ascolti recenti. */
export default function EditorVetrina({ onSalvata }) {
  const [attiva, setAttiva] = useState(false)
  const [titolo, setTitolo] = useState('')
  const [testo, setTesto] = useState('')
  const [senzaCiclo, setSenzaCiclo] = useState('')
  const [statistiche, setStatistiche] = useState(null)
  const [settimane, setSettimane] = useState([])
  const [salvando, setSalvando] = useState(false)
  const [errore, setErrore] = useState('')
  const { mostra } = useSnackbar()

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
    setSalvando(true)
    try {
      await salvaImpostazioniSito({
        vetrina_attiva: attiva,
        cta_titolo: titolo,
        cta_testo: testo,
        cta_testo_senza_ciclo: senzaCiclo
      })
      mostra({ testo: attiva ? 'Vetrina salvata: la pagina Ascoltati è pubblica' : 'Vetrina salvata: la pagina Ascoltati è spenta' })
      onSalvata?.()
    } catch {
      setErrore('Non è stato possibile salvare la vetrina.')
    } finally {
      setSalvando(false)
    }
  }

  const totale = statistiche?.totale

  return (
    <>
      <section className="card">
        <h3>Vetrina Ascoltati</h3>
        <p className="hint">
          La pagina pubblica delle meditazioni. Mostra le tracce con la spunta «In vetrina» in Tracce, non le pratiche dei cicli.
        </p>
        <form onSubmit={salva}>
          <label className="vetrina-spunta">
            <input type="checkbox" checked={attiva} onChange={e => setAttiva(e.target.checked)} />
            <span>Pagina Ascoltati pubblica</span>
          </label>
          <div className="field">
            <label htmlFor="vetrina-cta-titolo">Titolo dell’invito al percorso</label>
            <input id="vetrina-cta-titolo" value={titolo} onChange={e => setTitolo(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="vetrina-cta-testo">Testo, quando le iscrizioni sono aperte</label>
            <textarea id="vetrina-cta-testo" rows={3} value={testo} onChange={e => setTesto(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="vetrina-cta-chiuso">Testo, quando non c’è un ciclo in reclutamento</label>
            <textarea id="vetrina-cta-chiuso" rows={3} value={senzaCiclo} onChange={e => setSenzaCiclo(e.target.value)} />
          </div>
          {errore && <p className="avviso-errore" role="alert">{errore}</p>}
          <div className="azioni">
            <button className="btn" type="submit" disabled={salvando}>
              {salvando ? 'Salvataggio…' : 'Salva vetrina'}
            </button>
          </div>
        </form>
      </section>

      <section className="card">
        <h3>Pillola della settimana</h3>
        <p className="hint">Le prossime otto settimane. La data si sceglie nella scheda della traccia, sezione Vetrina.</p>
        <ul className="vetrina-calendario">
          {raggruppaSettimane(settimane).map(riga => (
            <li key={riga.dal.toISOString()} className={riga.vuota ? 'is-vuota' : undefined}>
              <span>{intervalloSettimana(riga.dal, riga.al)}</span>
              {riga.vuota ? (
                <span className="hint">
                  {riga.quante === 1 ? 'Nessuna meditazione in programma' : `${riga.quante} settimane senza meditazione in programma`}
                </span>
              ) : riga.tracce.map(traccia => (
                <span key={traccia.id}>
                  {traccia.titolo}
                  {!traccia.pubblica && <span className="hint"> · non ancora pubblica</span>}
                </span>
              ))}
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h3>Ascolti delle ultime quattro settimane</h3>
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
      </section>
    </>
  )
}
