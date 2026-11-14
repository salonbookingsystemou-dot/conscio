import { GRUPPI_PARTECIPANTI } from '../../lib/cicli.js'

/**
 * Card della home Cicli: gli idonei divisi per stato del percorso, con una barra
 * proporzionale e una legenda. Dati: statiPartecipanti (lib/cicli.js).
 * «In partenza» compare solo quando c'è qualcuno.
 */
export default function CardPartecipanti({ stati }) {
  const { totale, gruppi, senzaT2 } = stati
  const visibili = GRUPPI_PARTECIPANTI.filter(g => g.id !== 'partenza' || gruppi.partenza.length > 0)

  function nota(g) {
    if (g.id === 'da_chiudere' && senzaT2 > 0) return `${g.nota} · ${senzaT2} senza T2`
    return g.nota
  }

  function titolo(g) {
    const codici = gruppi[g.id]
    return codici.length ? `${g.etichetta}: ${codici.join(', ')}` : undefined
  }

  return (
    <article className="dash-kpi-card dash-partecipanti" aria-labelledby="dash-partecipanti-titolo">
      <p className="dash-kpi-label" id="dash-partecipanti-titolo">Partecipanti</p>
      <p className="dash-kpi-valore">
        {totale} <span className="dash-partecipanti-unita">{totale === 1 ? 'idoneo' : 'idonei'}</span>
      </p>

      {totale > 0 && (
        <div className="dash-partecipanti-barra" aria-hidden="true">
          {visibili.map(g => gruppi[g.id].length > 0 && (
            <span
              key={g.id}
              className={`dash-partecipanti-tratto is-${g.id}`}
              style={{ flexGrow: gruppi[g.id].length }}
              title={titolo(g)}
            />
          ))}
        </div>
      )}

      <ul className="dash-partecipanti-legenda">
        {visibili.map(g => (
          <li key={g.id} title={titolo(g)}>
            <span className="dash-partecipanti-voce">
              <span className={`dash-partecipanti-campione is-${g.id}`} aria-hidden="true" />
              {g.etichetta}
            </span>
            <span className={`dash-partecipanti-numero${g.id === 'da_chiudere' && gruppi[g.id].length ? ' is-attenzione' : ''}`}>
              {gruppi[g.id].length}
            </span>
            <span className="dash-partecipanti-nota">{nota(g)}</span>
          </li>
        ))}
      </ul>
    </article>
  )
}
