import { ESITI, MODALITA, eIdoneo, eRemoto, eRitirato, faseIdoneo } from '../lib/cicli.js'
import { IconaAltro } from './admin/IconeAdmin.jsx'
import MenuAzioni from './admin/MenuAzioni.jsx'

const AVVISI = {
  onboarding_senza_ascolto: 'avviso pratiche',
  non_avviato: 'avviso onboarding'
}

function data(valore) {
  return valore ? new Date(valore).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) : ''
}

/** Intestazione delle colonne su schermo largo: le righe tengono le etichette solo per i lettori di schermo. */
export function IntestazioneIscrizioni({ libera = false }) {
  return (
    <li className="dash-iscrizione is-intestazione" aria-hidden="true">
      <span />
      <span>Screening</span>
      <span>{libera ? 'Ciclo' : 'Modalità'}</span>
      <span />
    </li>
  )
}

/**
 * Una iscrizione con le sue azioni, in tre livelli: codice e stato del percorso,
 * dettagli in testo, controlli con etichetta. Con `cicli` (iscrizione senza ciclo)
 * mostra «Collega a un ciclo» al posto della modalità; lì sono tutti da remoto.
 */
export default function RigaIscrizione({
  iscrizione: i,
  timepoints,
  ciclo,
  cicli,
  notifiche = [],
  onEsito,
  onModalita,
  onAssegna,
  onRitira
}) {
  const codice = i.utenti?.codice_partecipante || '—'
  const libera = Boolean(cicli)
  const ritirato = eRitirato(i)
  const idoneo = eIdoneo(i)
  const fase = idoneo && !ritirato ? faseIdoneo(i, timepoints, ciclo) : null
  const esito = ESITI.find(e => e.id === (i.esito_screening || 'in_attesa'))

  const dettagli = [
    ritirato
      ? 'Dati anonimi conservati a fini statistici'
      : fase ? fase.dettaglio.replace(/^Idoneo · /, '') : `Screening: ${(esito?.label || 'in attesa').toLowerCase()}`,
    !libera && eRemoto(i) ? 'da remoto' : null,
    ...notifiche.map(n => `${AVVISI[n.tipo] || 'avviso'} inviato il ${data(n.inviata_il)}`)
  ].filter(Boolean)
  const testoDettagli = dettagli.join(' · ').replace(/\.(?= ·)/g, '')

  return (
    <li className={`dash-iscrizione${libera ? ' is-libera' : ''}${ritirato ? ' is-ritirato' : ''}`}>
      <div className="dash-iscrizione-persona">
        <div className="dash-iscrizione-testa">
          <span className="dash-iscrizione-codice" title={i.utenti?.email || 'Nessuna email registrata'}>
            {codice}
          </span>
          {fase && (
            <span className={`dash-stato is-${fase.tono}`}>
              <span className="dash-stato-dot" aria-hidden="true" />
              {fase.etichetta}
            </span>
          )}
          {ritirato && <span className="dash-stato is-chiuso">Ritirato</span>}
        </div>
        <p className="dash-iscrizione-dettagli">{testoDettagli.charAt(0).toUpperCase() + testoDettagli.slice(1)}</p>
      </div>

      {!ritirato && (
        <>
          <label className="dash-iscrizione-campo">
            <span>Screening</span>
            <select value={i.esito_screening || 'in_attesa'} onChange={e => onEsito(i, e.target.value)}>
              {ESITI.map(e => (
                <option key={e.id} value={e.id}>{e.label}</option>
              ))}
            </select>
          </label>
          {libera ? (
            <label className="dash-iscrizione-campo">
              <span>Ciclo</span>
              <select defaultValue="" onChange={e => e.target.value && onAssegna(i, e.target.value)}>
                <option value="">Nessuno · collega…</option>
                {cicli.map(c => (
                  <option key={c.id} value={c.id}>{c.nome_ciclo}</option>
                ))}
              </select>
            </label>
          ) : (
            <label className="dash-iscrizione-campo">
              <span>Modalità</span>
              <select value={i.modalita_fruizione || 'presenza'} onChange={e => onModalita(i, e.target.value)}>
                {MODALITA.map(m => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </label>
          )}
          <div className="dash-iscrizione-menu">
            <MenuAzioni
              voci={[{ etichetta: 'Ritira dal percorso…', onClick: () => onRitira(i), pericolo: true }]}
              renderPulsante={props => (
                <button type="button" className="icon-btn" aria-label={`Altre azioni per ${codice}`} {...props}>
                  <IconaAltro />
                </button>
              )}
            />
          </div>
        </>
      )}
    </li>
  )
}
