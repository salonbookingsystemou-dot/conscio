import { useEffect, useId, useRef } from 'react'
import { dueColonne } from '../../lib/useClasseFinestra.js'
import StatoVuoto from '../StatoVuoto.jsx'
import { useGuscio } from './gusci.js'
import { IconaChiudi } from './IconeAdmin.jsx'

/** Colonna dell'elenco nel layout elenco–dettaglio. */
export function ElencoPannello({ children, etichetta }) {
  return <div className="elenco-pannello" aria-label={etichetta} role={etichetta ? 'region' : undefined}>{children}</div>
}

/**
 * Dettaglio dell'elemento scelto nel layout elenco–dettaglio. Da 840px sta a destra
 * dell'elenco; sotto prende la pagina e titolo e «←» passano nella barra della pagina.
 */
export function PannelloDettaglio({ aperto, onChiudi, titolo, sopratitolo, vuoto = 'Scegli un elemento', children }) {
  const { classe } = useGuscio()
  const affiancato = dueColonne(classe)
  const intestazione = useRef(null)
  const id = useId()

  useEffect(() => {
    if (aperto && affiancato) intestazione.current?.focus({ preventScroll: true })
  }, [aperto, titolo, affiancato])

  function tasti(e) {
    if (e.key === 'Escape' && aperto && onChiudi) {
      e.stopPropagation()
      onChiudi()
    }
  }

  if (!affiancato) {
    if (!aperto) return null
    return <section className="pannello-dettaglio is-pagina" aria-label={titolo} onKeyDown={tasti}>{children}</section>
  }

  if (!aperto) {
    return (
      <section className="pannello-dettaglio is-vuoto" aria-label="Dettaglio">
        <StatoVuoto titolo={vuoto} />
      </section>
    )
  }

  return (
    <section className="pannello-dettaglio" aria-labelledby={id} onKeyDown={tasti}>
      <header className="pannello-dettaglio-testa">
        <div className="pannello-dettaglio-titoli">
          {sopratitolo && <p className="pannello-dettaglio-sopratitolo">{sopratitolo}</p>}
          <h2 id={id} ref={intestazione} tabIndex={-1}>{titolo}</h2>
        </div>
        <button type="button" className="icon-btn" aria-label="Chiudi la scheda" onClick={onChiudi}>
          <IconaChiudi />
        </button>
      </header>
      <div className="pannello-dettaglio-corpo">{children}</div>
    </section>
  )
}

/** Pannello fisso a destra del layout di supporto; sotto 840px va sotto il contenuto. */
export function PannelloSupporto({ etichetta, children }) {
  return <aside className="pannello-supporto" aria-label={etichetta}>{children}</aside>
}

/** Area principale del layout di supporto. */
export function AreaPrincipale({ children }) {
  return <div className="area-principale">{children}</div>
}
