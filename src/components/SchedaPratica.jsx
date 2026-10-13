import { useEffect, useMemo, useRef } from 'react'
import {
  FASCE_MINUTI,
  TONI_GRAFICO,
  datiPraticaCiclo,
  etichettaDataBreve,
  fasciaMinuti,
  mediana,
  numeriPratica
} from '../lib/pratica.js'

const TACCHE_PERCENTUALI = [0, 25, 50, 75, 100]

function etichettaGiorni(n) {
  return n === 1 ? '1 giorno' : `${n} giorni`
}

function Numeri({ numeri, giorniTrascorsi }) {
  return (
    <div className="pratica-numeri">
      <article className="pratica-numero">
        <p className="pratica-numero-label">Aderenza del gruppo</p>
        <p className="pratica-numero-valore">
          {numeri.aderenza == null ? '—' : `${numeri.aderenza}%`}
        </p>
        <p className="pratica-numero-nota">
          {numeri.giornatePratica} giornate con ascolto su {numeri.giornatePossibili} possibili
        </p>
      </article>
      <article className="pratica-numero">
        <p className="pratica-numero-label">Minuti di meditazione</p>
        <p className="pratica-numero-valore">{numeri.minuti}</p>
        <p className="pratica-numero-nota">tracce ascoltate per intero, tutto il gruppo</p>
      </article>
      <article className="pratica-numero">
        <p className="pratica-numero-label">Media per partecipante</p>
        <p className="pratica-numero-valore">{numeri.media}</p>
        <p className="pratica-numero-nota">
          {giorniTrascorsi != null
            ? `minuti in ${etichettaGiorni(giorniTrascorsi)}`
            : 'minuti a testa'}
          {` · mediana ${numeri.mediana}`}
        </p>
      </article>
      <article className="pratica-numero">
        <p className="pratica-numero-label">Pratiche informali</p>
        <p className="pratica-numero-valore">{numeri.spunte}</p>
        <p className="pratica-numero-nota">spunte, tutto il gruppo</p>
      </article>
    </div>
  )
}

function LegendaToni() {
  return (
    <ul className="pratica-legenda">
      {TONI_GRAFICO.map(t => (
        <li key={t.id}><span className={`pratica-campione is-${t.id}`} />{t.label}</li>
      ))}
    </ul>
  )
}

function LegendaFasce() {
  return (
    <ul className="pratica-legenda">
      {FASCE_MINUTI.map(f => (
        <li key={f.id}><span className={`pratica-campione is-${f.id}`} />{f.label}</li>
      ))}
    </ul>
  )
}

function titoloColonna(giorno, iscritti) {
  const data = etichettaDataBreve(giorno.data)
  if (giorno.futuro) return `${data}: ancora da fare`
  const { piacevole, neutro, spiacevole, nd } = giorno.toni
  const quota = iscritti > 0 ? Math.round((giorno.praticanti / iscritti) * 100) : 0
  return `${data}: ${giorno.praticanti} su ${iscritti} hanno praticato, il ${quota}% `
    + `(piacevole ${piacevole}, neutro ${neutro}, spiacevole ${spiacevole}, senza tono ${nd})`
}

function Settimane({ settimane, cella }) {
  return (
    <div className="pratica-settimane" style={{ '--pratica-settimane': settimane.length }}>
      {settimane.map(s => (
        <div key={s.numero} className="pratica-settimana">
          {s.giorni.map((g, j) => (g ? cella(g) : <span key={`vuoto-${j}`} />))}
        </div>
      ))}
    </div>
  )
}

function Partecipazione({ dati, scorriRef, onScroll }) {
  const { iscritti, settimane } = dati
  const scala = Math.max(1, iscritti)
  return (
    <section className="pratica-card" aria-labelledby="pratica-partecipazione-titolo">
      <header className="pratica-card-testa">
        <div>
          <h3 id="pratica-partecipazione-titolo">Partecipazione giorno per giorno</h3>
          <p>
            Quota del gruppo ({iscritti} iscritti) che ha ascoltato per intero almeno una meditazione,
            divisa per tono della giornata. 100% = tutti hanno praticato.
          </p>
        </div>
        <LegendaToni />
      </header>
      <div className="pratica-riga">
        <div className="pratica-asse-y" aria-hidden="true">
          {TACCHE_PERCENTUALI.map(t => (
            <span key={t} style={{ bottom: `${t}%` }}>{t}%</span>
          ))}
        </div>
        <div className="pratica-scorri" ref={scorriRef} onScroll={onScroll}>
          <div className="pratica-scorri-interno" style={{ '--pratica-slot': settimane.length * 7 }}>
            <div className="pratica-barre">
              {TACCHE_PERCENTUALI.map(t => (
                <span
                  key={t}
                  className={`pratica-griglia${t === 0 ? ' is-base' : ''}`}
                  style={{ bottom: `${t}%` }}
                  aria-hidden="true"
                />
              ))}
              <Settimane
                settimane={settimane}
                cella={g => (
                  <div key={g.iso} className="pratica-colonna" title={titoloColonna(g, iscritti)}>
                    {g.futuro
                      ? <span className="pratica-segmento is-futuro" />
                      : TONI_GRAFICO.map(t => (g.toni[t.id] > 0 && (
                        <span
                          key={t.id}
                          className={`pratica-segmento is-${t.id}`}
                          style={{ height: `calc(${(g.toni[t.id] / scala) * 100}% - 1px)` }}
                        />
                      )))}
                  </div>
                )}
              />
            </div>
            <div className="pratica-settimane" style={{ '--pratica-settimane': settimane.length }}>
              {settimane.map(s => (
                <div key={s.numero} className={`pratica-settimana-etichetta${s.corrente ? ' is-corrente' : ''}`}>
                  <strong>Sett. {s.numero}</strong>
                  <span>{s.etichetta}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <span />
      </div>
    </section>
  )
}

function Mappa({ dati, scorriRef, onScroll }) {
  const { persone, settimane } = dati
  return (
    <section className="pratica-card" aria-labelledby="pratica-mappa-titolo">
      <header className="pratica-card-testa">
        <div>
          <h3 id="pratica-mappa-titolo">Mappa del percorso</h3>
          <p>
            Una riga per partecipante, senza codice, ordinate per minuti totali.
            Ogni casella è un giorno: più è scura, più si è meditato.
          </p>
        </div>
        <LegendaFasce />
      </header>
      {persone.length === 0 ? (
        <p className="pratica-vuoto">Nessun iscritto idoneo in questo ciclo.</p>
      ) : (
        <div className="pratica-riga">
          <span />
          <div className="pratica-scorri" ref={scorriRef} onScroll={onScroll}>
            <div className="pratica-scorri-interno pratica-mappa" style={{ '--pratica-slot': settimane.length * 7 }}>
              {persone.map((p, i) => (
                <Settimane
                  key={i}
                  settimane={settimane}
                  cella={g => (
                    <span
                      key={g.iso}
                      className={`pratica-casella is-${g.futuro ? 'futuro' : fasciaMinuti(p.celle[g.indice])}`}
                      title={`${etichettaDataBreve(g.data)}: ${g.futuro ? 'ancora da fare' : `${p.celle[g.indice]} min`}`}
                    />
                  )}
                />
              ))}
            </div>
          </div>
          <div className="pratica-mappa pratica-mappa-totali">
            {persone.map((p, i) => (
              <span key={i} className="pratica-mappa-totale">{p.minuti} min</span>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function TotalePartecipanti({ dati }) {
  const { persone } = dati
  const massimo = persone.reduce((acc, p) => Math.max(acc, p.minuti), 0)
  const valoreMediana = mediana(persone.map(p => p.minuti))
  const posizione = massimo > 0 ? valoreMediana / massimo : 0
  return (
    <section className="pratica-card" aria-labelledby="pratica-totale-titolo">
      <header className="pratica-card-testa">
        <div>
          <h3 id="pratica-totale-titolo">Totale per partecipante</h3>
          <p>
            Minuti di meditazione di ciascuno, dal più alto al più basso, senza codici.
            La linea tratteggiata è la mediana del gruppo.
          </p>
        </div>
      </header>
      {massimo === 0 ? (
        <p className="pratica-vuoto">Nessuna meditazione ancora ascoltata per intero.</p>
      ) : (
        <div className="pratica-totali" style={{ '--pratica-mediana': posizione }}>
          <span className="pratica-mediana" aria-hidden="true" />
          <span className={`pratica-mediana-etichetta${posizione > 0.6 ? ' is-sinistra' : ''}`}>
            mediana {valoreMediana} min
          </span>
          {persone.map((p, i) => (
            <div key={i} className="pratica-totale">
              <span className="pratica-totale-traccia">
                <span style={{ width: `${(p.minuti / massimo) * 100}%` }} />
              </span>
              <span className="pratica-totale-valori">
                <strong>{p.minuti} min</strong>
                <span>{etichettaGiorni(p.giorni)}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function Informali({ dati }) {
  const { informali, iscritti } = dati
  return (
    <section className="pratica-card" aria-labelledby="pratica-informali-titolo">
      <header className="pratica-card-testa">
        <div>
          <h3 id="pratica-informali-titolo">Pratiche informali</h3>
          <p>Ogni spunta conta una volta. Totale del gruppo e quante persone l’hanno fatta almeno una volta.</p>
        </div>
      </header>
      {informali.length === 0 ? (
        <p className="pratica-vuoto">Nessuna pratica informale ancora spuntata.</p>
      ) : (
        <table className="pratica-tabella">
          <thead>
            <tr>
              <th scope="col">Pratica</th>
              <th scope="col">Volte</th>
              <th scope="col">Persone</th>
            </tr>
          </thead>
          <tbody>
            {informali.map(v => (
              <tr key={`${v.settimana ?? ''}|${v.nome}`}>
                <td>
                  {v.nome}
                  {v.settimana != null && <span className="pratica-tabella-sett"> · sett. {v.settimana}</span>}
                </td>
                <td className="is-volte">{v.volte}</td>
                <td>{v.persone} su {iscritti}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

function descrizioneCiclo(dati) {
  const { periodo, iscritti } = dati
  const persone = `${iscritti} iscritt${iscritti === 1 ? 'o' : 'i'}`
  if (!periodo) return `Data di inizio mancante · ${persone}.`
  if (periodo.trascorsi === 0) return `Inizia il ${etichettaDataBreve(periodo.inizio)} · ${persone}.`
  if (periodo.concluso) return `Ciclo concluso · ${etichettaGiorni(periodo.durata)} · ${persone}.`
  return `Giorno ${periodo.trascorsi} di ${periodo.durata} · ${persone}.`
}

/**
 * `codici`: codici degli iscritti al ciclo. Servono solo a raggruppare le
 * righe del log: non compaiono in nessun punto della scheda.
 */
export default function SchedaPratica({ ciclo, codici, log }) {
  const dati = useMemo(() => datiPraticaCiclo(ciclo, codici, log), [ciclo, codici, log])
  const numeri = useMemo(() => numeriPratica([dati]), [dati])

  const scorriGrafico = useRef(null)
  const scorriMappa = useRef(null)
  const allinea = (da, a) => () => {
    if (da.current && a.current && a.current.scrollLeft !== da.current.scrollLeft) {
      a.current.scrollLeft = da.current.scrollLeft
    }
  }

  useEffect(() => {
    const scorri = scorriGrafico.current
    const corrente = scorri?.querySelector('.pratica-settimana-etichetta.is-corrente')
    if (!scorri || !corrente || scorri.scrollWidth <= scorri.clientWidth) return
    scorri.scrollLeft = corrente.getBoundingClientRect().left - scorri.getBoundingClientRect().left
      + scorri.scrollLeft - 8
  }, [dati?.periodo?.inizioIso, dati?.settimane.length])

  return (
    <div className="pratica-scheda">
      <header className="dash-panel-testa">
        <div>
          <h2>Pratica</h2>
          <p className="lead">
            {`${descrizioneCiclo(dati)} `}
            Solo dati aggregati o senza identificativi: nessun codice e nessuna email in questa scheda.
          </p>
        </div>
      </header>

      <Numeri numeri={numeri} giorniTrascorsi={dati.periodo?.trascorsi ?? 0} />

      {dati.settimane.length === 0 ? (
        <p className="hint">
          {dati.periodo
            ? 'I grafici giorno per giorno compaiono quando il ciclo è iniziato.'
            : 'Imposta la data di inizio del ciclo in Panoramica per vedere i grafici giorno per giorno.'}
        </p>
      ) : (
        <>
          <Partecipazione dati={dati} scorriRef={scorriGrafico} onScroll={allinea(scorriGrafico, scorriMappa)} />
          <Mappa dati={dati} scorriRef={scorriMappa} onScroll={allinea(scorriMappa, scorriGrafico)} />
          <div className="pratica-affiancati">
            <TotalePartecipanti dati={dati} />
            <Informali dati={dati} />
          </div>
        </>
      )}
    </div>
  )
}
