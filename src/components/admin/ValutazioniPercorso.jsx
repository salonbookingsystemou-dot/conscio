import { useMemo, useState } from 'react'
import { CONSIGLI, formattaMedia, riepilogoValutazioni } from '../../lib/valutazioni.js'

const FILTRI = [
  { id: 'tutte', etichetta: 'Tutte', vale: () => true },
  { id: 'alte', etichetta: '4–5 stelle', vale: s => s >= 4 },
  { id: 'medie', etichetta: '3 stelle', vale: s => s === 3 },
  { id: 'basse', etichetta: '1–2 stelle', vale: s => s <= 2 }
]

function dataBreve(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
}

function idoneaConfermata(i) {
  return Boolean(i.utenti?.email_confermata_il)
    && (i.esito_screening === 'idoneo' || i.utenti?.stato_screening === 'idoneo')
}

// Una riga con etichetta, barra e «N su M». Con gruppi piccoli contano i numeri, non le percentuali.
function Barra({ etichetta, valore, totale, tono }) {
  const larghezza = totale > 0 ? Math.round((valore / totale) * 100) : 0
  return (
    <li className="valut-riga">
      <span className="valut-etichetta">{etichetta}</span>
      <span className="valut-barra" aria-hidden="true">
        <span className={`valut-barra-piena${tono ? ` is-${tono}` : ''}`} style={{ width: `${larghezza}%` }} />
      </span>
      <span className="valut-valore">{valore}{totale != null && <span className="hint"> su {totale}</span>}</span>
    </li>
  )
}

/**
 * Sezione «Valutazione del percorso» nella scheda Questionari del ciclo.
 * Dati: valutazioni_percorso_pseudonime (letta con gli altri dati della dashboard).
 */
export default function ValutazioniPercorso({ righe, cicloId, tutti, iscrizioni, punteggi }) {
  const [filtro, setFiltro] = useState('tutte')

  const vista = useMemo(
    () => (righe || []).filter(r => tutti || r.ciclo_id === cicloId),
    [righe, tutti, cicloId]
  )
  const numeri = useMemo(() => riepilogoValutazioni(vista), [vista])

  // Base del percorso: idonei con email confermata (nella vista «tutti» anche i percorsi da remoto).
  const idonei = useMemo(() => {
    const codici = new Set()
    for (const i of iscrizioni || []) {
      if (idoneaConfermata(i) && i.utenti?.codice_partecipante) codici.add(i.utenti.codice_partecipante)
    }
    return codici
  }, [iscrizioni])
  const t2 = useMemo(
    () => new Set((punteggi || []).filter(p => p.timepoint === 'T2' && idonei.has(p.codice)).map(p => p.codice)).size,
    [punteggi, idonei]
  )

  const scelto = FILTRI.find(f => f.id === filtro) || FILTRI[0]
  const frasi = vista.filter(r => r.porto_a_casa && r.stelle != null && scelto.vale(r.stelle))
  const conFrase = vista.filter(r => r.porto_a_casa && r.stelle != null)
  const base = idonei.size

  return (
    <section className="card dash-valutazioni" aria-labelledby="valutazioni-titolo">
      <h3 id="valutazioni-titolo">Valutazione del percorso</h3>
      <p className="hint">
        Dalla sequenza di fine percorso, dal giorno 56. Numeri assoluti: con gruppi piccoli le percentuali ingannano.
      </p>

      {numeri.aperte === 0 ? (
        <p>Nessuno ha ancora aperto la sequenza di fine percorso{tutti ? '.' : ' in questo ciclo.'}</p>
      ) : (
        <>
          <div className="valut-griglia">
            <div>
              <h4>Chi arriva in fondo</h4>
              <ul className="valut-righe">
                <Barra etichetta="Sequenza aperta" valore={numeri.aperte} totale={base} />
                <Barra etichetta="T2 compilato" valore={t2} totale={base} />
                <Barra etichetta="Valutazione inviata" valore={numeri.valutazioni} totale={base} />
                <Barra etichetta="Link condiviso" valore={numeri.condivisioni} totale={base} />
                <Barra etichetta="Sequenza conclusa" valore={numeri.concluse} totale={base} />
              </ul>
              <p className="hint">Su {base} {base === 1 ? 'persona idonea' : 'persone idonee'}{tutti ? ' in tutti i cicli e da remoto' : ' del ciclo'}.</p>
            </div>

            <div>
              <h4>Come valutano l’esperienza</h4>
              {numeri.valutazioni === 0 ? (
                <p className="hint">Nessuna valutazione ancora.</p>
              ) : (
                <>
                  <p className="valut-media">
                    <span className="dash-kpi-valore">{formattaMedia(numeri.media)}</span>
                    <span className="hint"> su 5 · {numeri.valutazioni} {numeri.valutazioni === 1 ? 'valutazione' : 'valutazioni'}</span>
                  </p>
                  <ul className="valut-righe">
                    {[5, 4, 3, 2, 1].map(s => (
                      <Barra
                        key={s}
                        etichetta={`${s} ${s === 1 ? 'stella' : 'stelle'}`}
                        valore={numeri.distribuzione[s]}
                        totale={numeri.valutazioni}
                        tono={s <= 2 ? 'basso' : undefined}
                      />
                    ))}
                  </ul>
                  <h4>Lo consiglierebbero?</h4>
                  <ul className="valut-righe">
                    {CONSIGLI.map(c => (
                      <Barra
                        key={c.valore}
                        etichetta={c.etichetta}
                        valore={numeri.consigli[c.valore]}
                        totale={numeri.valutazioni}
                        tono={c.valore === 'no' ? 'basso' : undefined}
                      />
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>

          {conFrase.length > 0 && (
            <>
              <h4>Cosa si portano a casa</h4>
              <div className="filtri-chip" role="group" aria-label="Filtra per stelle">
                {FILTRI.map(f => (
                  <button
                    key={f.id}
                    type="button"
                    className={`chip${filtro === f.id ? ' is-on' : ''}`}
                    aria-pressed={filtro === f.id}
                    onClick={() => setFiltro(f.id)}
                  >
                    {f.etichetta}
                  </button>
                ))}
              </div>
              {frasi.length === 0 ? (
                <p className="hint">Nessuna frase con questo filtro.</p>
              ) : (
                <ul className="dash-valutazioni-testi">
                  {frasi.map(r => (
                    <li key={r.codice_partecipante} className={r.stelle <= 2 ? 'is-basso' : undefined}>
                      <p>{r.porto_a_casa}</p>
                      <p className="hint">
                        {r.codice_partecipante} · {r.stelle} {r.stelle === 1 ? 'stella' : 'stelle'}
                        {r.consiglieresti && ` · lo consiglierebbe: ${CONSIGLI.find(c => c.valore === r.consiglieresti)?.etichetta}`}
                        {r.valutata_il && ` · ${dataBreve(r.valutata_il)}`}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </>
      )}
      <p className="hint">Le frasi non si citano fuori dall’app senza un consenso specifico. L’export contiene solo i numeri.</p>
    </section>
  )
}
