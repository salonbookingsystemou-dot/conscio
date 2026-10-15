import { Link, NavLink } from 'react-router-dom'
import { percorsoSezione } from '../../lib/sezioniAdmin.js'
import Marchio from '../Marchio.jsx'
import { ICONE_SEZIONE, IconaEsci, IconaPiu } from './IconeAdmin.jsx'

function Badge({ numero }) {
  if (!(numero > 0)) return null
  return (
    <>
      <span className="rail-badge" aria-hidden="true">{numero}</span>
      <span className="visually-hidden">, {numero} da fare</span>
    </>
  )
}

/**
 * Rail di navigazione dell'area facilitatore, da 600px in su.
 * Esteso (≥ 1200): etichette accanto alle icone e FAB esteso. Compatto: icona con etichetta sotto, FAB solo icona.
 */
export default function RailNavigazione({ sezioni, attiva, badge = {}, esteso, onEsci }) {
  const azione = attiva?.azione || null

  return (
    <nav className={`rail${esteso ? ' is-esteso' : ' is-compatto'}`} aria-label="Area facilitatore">
      <Link to="/admin/cicli" className="rail-marchio" aria-label="Conscio, area facilitatore">
        {esteso ? (
          <>
            <Marchio variante="orizzontale" altezza={30} decorativo />
            <span className="rail-marchio-ruolo" aria-hidden="true">Facilitatore</span>
          </>
        ) : (
          <Marchio variante="segno" altezza={32} decorativo />
        )}
      </Link>

      <div className="rail-azione">
        {azione && (
          <Link to={azione.a} className="fab" aria-label={esteso ? undefined : azione.etichetta}>
            <IconaPiu />
            {esteso && <span>{azione.etichetta}</span>}
          </Link>
        )}
      </div>

      <ul className="rail-voci">
        {sezioni.map(s => {
          const Icona = ICONE_SEZIONE[s.icona]
          return (
            <li key={s.id}>
              <NavLink to={percorsoSezione(s)} className="rail-voce">
                <span className="rail-indicatore">
                  <Icona />
                  {!esteso && <Badge numero={badge[s.id]} />}
                </span>
                <span className="rail-etichetta">{s.etichetta}</span>
                {esteso && <Badge numero={badge[s.id]} />}
              </NavLink>
            </li>
          )
        })}
      </ul>

      <button type="button" className="rail-voce rail-esci" onClick={onEsci}>
        <span className="rail-indicatore"><IconaEsci /></span>
        <span className="rail-etichetta">Esci</span>
      </button>
    </nav>
  )
}
