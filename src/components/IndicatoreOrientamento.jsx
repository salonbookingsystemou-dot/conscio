/** Indicatore di posizione sul range dello strumento (non clinico). */
export default function IndicatoreOrientamento({ orientamento, compatto = false }) {
  if (!orientamento) return null
  const { id, etichetta, dettaglio, percento } = orientamento
  return (
    <div className={`orientamento${compatto ? ' is-compatto' : ''} is-${id}`}>
      <div className="orientamento-riga">
        <span className="orientamento-chip">{etichetta}</span>
        {!compatto && dettaglio && <span className="orientamento-dettaglio">{dettaglio}</span>}
      </div>
      <div
        className="orientamento-barra"
        role="meter"
        aria-label={etichetta}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percento}
      >
        <span className="orientamento-traccia" aria-hidden="true" />
        <span className="orientamento-riempimento" style={{ width: `${percento}%` }} aria-hidden="true" />
        <span className="orientamento-cursore" style={{ left: `${percento}%` }} aria-hidden="true" />
      </div>
      {!compatto && (
        <div className="orientamento-estremi" aria-hidden="true">
          <span>Minimo del range</span>
          <span>Massimo del range</span>
        </div>
      )}
    </div>
  )
}
