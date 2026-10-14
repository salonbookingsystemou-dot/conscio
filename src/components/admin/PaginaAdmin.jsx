import { Children, isValidElement, useId } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { dueColonne } from '../../lib/useClasseFinestra.js'
import StatoAttesa from '../StatoAttesa.jsx'
import StatoVuoto from '../StatoVuoto.jsx'
import { useGuscio } from './gusci.js'
import { IconaAltro, IconaIndietro } from './IconeAdmin.jsx'
import MenuAzioni from './MenuAzioni.jsx'
import { ElencoPannello, PannelloDettaglio } from './Pannelli.jsx'

function Indietro({ indietro, soloIcona }) {
  const contenuto = (
    <>
      <IconaIndietro />
      {!soloIcona && <span>{indietro.etichetta}</span>}
    </>
  )
  const props = {
    className: `pagina-indietro${soloIcona ? ' is-icona' : ''}`,
    'aria-label': soloIcona ? `Torna a ${indietro.etichetta}` : undefined
  }
  if (indietro.a) return <Link to={indietro.a} {...props}>{contenuto}</Link>
  return <button type="button" onClick={indietro.onClick} {...props}>{contenuto}</button>
}

function Schede({ schede, etichetta }) {
  const { pathname } = useLocation()
  return (
    <nav className="pagina-schede" role="tablist" aria-label={etichetta}>
      {schede.map(s => {
        const attiva = pathname === s.a || pathname.startsWith(`${s.a}/`)
        return (
          <NavLink
            key={s.a}
            to={s.a}
            role="tab"
            aria-selected={attiva}
            aria-current={attiva ? 'page' : undefined}
            className={`pagina-scheda${attiva ? ' is-on' : ''}`}
          >
            {s.etichetta}
          </NavLink>
        )
      })}
    </nav>
  )
}

/**
 * Pagina dell'area facilitatore: barra della pagina + schede facoltative + corpo in uno
 * dei tre layout canonici ('flusso', 'elenco-dettaglio', 'supporto').
 * L'azione principale della sezione sta nel rail, non qui.
 */
export default function PaginaAdmin({
  titolo,
  meta,
  indietro,
  contesto,
  azione,
  menu = [],
  schede,
  etichettaSchede,
  layout = 'flusso',
  stato,
  statoTesto,
  children
}) {
  const { classe, esci } = useGuscio()
  const idTitolo = useId()
  const compatta = classe === 'compatta'

  let barra = { titolo, meta, indietro, azione }
  let corpo = children

  // Elenco–dettaglio su schermo stretto: o l'elenco, o il dettaglio a pagina intera.
  if (layout === 'elenco-dettaglio' && !dueColonne(classe)) {
    const figli = Children.toArray(children)
    const di = tipo => f => isValidElement(f) && f.type === tipo
    const dettaglio = figli.find(di(PannelloDettaglio))
    if (dettaglio?.props.aperto) {
      barra = {
        titolo: dettaglio.props.titolo,
        meta: dettaglio.props.sopratitolo,
        indietro: { onClick: dettaglio.props.onChiudi, etichetta: titolo },
        azione: null
      }
      corpo = figli.filter(f => !di(ElencoPannello)(f))
    } else {
      corpo = figli.filter(f => !di(PannelloDettaglio)(f))
    }
  }

  const voci = [...menu]
  if (compatta && esci) voci.push({ etichetta: 'Esci', onClick: esci })

  let contenuto = corpo
  if (stato === 'attesa') contenuto = <StatoAttesa etichetta={statoTesto} />
  else if (stato === 'vuoto') contenuto = <StatoVuoto titolo={statoTesto} />
  else if (stato === 'errore') contenuto = <p className="avviso-errore" role="alert">{statoTesto}</p>

  return (
    <div className={`pagina-admin is-${layout}`} aria-labelledby={idTitolo} role="region">
      <header className="pagina-barra">
        {barra.indietro && !compatta && (
          <div className="pagina-barra-sopra">
            <Indietro indietro={barra.indietro} />
          </div>
        )}
        <div className="pagina-barra-riga">
          {barra.indietro && compatta && <Indietro indietro={barra.indietro} soloIcona />}
          <div className="pagina-barra-testi">
            <h1 id={idTitolo} className="pagina-titolo">{barra.titolo}</h1>
            {barra.meta && <div className="pagina-meta">{barra.meta}</div>}
          </div>
          {(contesto || barra.azione) && (
            <div className="pagina-barra-azioni">
              {contesto && <div className="pagina-contesto">{contesto}</div>}
              {barra.azione}
            </div>
          )}
          {voci.length > 0 && (
            <MenuAzioni
              voci={voci}
              renderPulsante={props => (
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={compatta && esci ? 'Altre azioni ed Esci' : 'Altre azioni'}
                  {...props}
                >
                  <IconaAltro />
                </button>
              )}
            />
          )}
        </div>
      </header>
      {schede && <Schede schede={schede} etichetta={etichettaSchede || titolo} />}
      <div className="pagina-corpo">{contenuto}</div>
    </div>
  )
}
