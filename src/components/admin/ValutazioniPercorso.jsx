import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

const CONSIGLI = [
  { valore: 'si', etichetta: 'Sì' },
  { valore: 'forse', etichetta: 'Forse' },
  { valore: 'no', etichetta: 'No' }
]

/**
 * Valutazioni della sequenza di fine percorso (stelle, «lo consiglieresti?», «cosa ti porti a casa»).
 * Per codice partecipante, come le note del diario: per la divulgazione solo aggregati.
 */
export default function ValutazioniPercorso({ cicloId, tutti }) {
  const [righe, setRighe] = useState(null)
  const [errore, setErrore] = useState(false)

  useEffect(() => {
    let vivo = true
    supabase.rpc('valutazioni_percorso_pseudonime').then(({ data, error }) => {
      if (!vivo) return
      if (error) setErrore(true)
      else setRighe(data || [])
    })
    return () => { vivo = false }
  }, [])

  const vista = useMemo(
    () => (righe || []).filter(r => r.stelle != null && (tutti || r.ciclo_id === cicloId)),
    [righe, tutti, cicloId]
  )

  if (errore) return <p className="campo-errore">Non è stato possibile caricare le valutazioni del percorso.</p>
  if (!righe) return null

  const n = vista.length
  const media = n ? Math.round((vista.reduce((a, r) => a + r.stelle, 0) / n) * 10) / 10 : null
  const conta = valore => vista.filter(r => r.consiglieresti === valore).length
  const testi = vista.filter(r => r.porto_a_casa)

  return (
    <section className="card dash-valutazioni" aria-labelledby="valutazioni-titolo">
      <h3 id="valutazioni-titolo">Valutazione del percorso</h3>
      {n === 0 ? (
        <p className="hint">Nessuna valutazione ancora: arrivano dalla sequenza di fine percorso, dal giorno 56.</p>
      ) : (
        <>
          <div className="dash-kpi">
            <article className="dash-kpi-card">
              <p className="dash-kpi-label">Valutazioni</p>
              <p className="dash-kpi-valore">{n}</p>
            </article>
            <article className="dash-kpi-card">
              <p className="dash-kpi-label">Media stelle</p>
              <p className="dash-kpi-valore">{media} <span className="hint">su 5</span></p>
            </article>
            {CONSIGLI.map(c => (
              <article className="dash-kpi-card" key={c.valore}>
                <p className="dash-kpi-label">Lo consiglierebbe · {c.etichetta}</p>
                <p className="dash-kpi-valore">{conta(c.valore)}</p>
              </article>
            ))}
          </div>
          {testi.length > 0 && (
            <>
              <h4>Cosa si portano a casa</h4>
              <ul className="dash-valutazioni-testi">
                {testi.map(r => (
                  <li key={r.codice_partecipante}>
                    <p>{r.porto_a_casa}</p>
                    <p className="hint">{r.codice_partecipante} · {r.stelle} {r.stelle === 1 ? 'stella' : 'stelle'}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
      <p className="hint">Le frasi non si citano fuori dall’app senza un consenso specifico.</p>
    </section>
  )
}
