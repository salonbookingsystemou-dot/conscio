import { useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import DialogConferma from '../../../components/DialogConferma.jsx'
import RigaIscrizione from '../../../components/RigaIscrizione.jsx'
import {
  dialogoRitiro,
  eIdoneo,
  eRemoto,
  impostaEsito,
  impostaModalita,
  inAttesaDiEsito,
  ritira,
  timepointsPerCodice
} from '../../../lib/cicli.js'

const FILTRI = [
  { id: 'tutte', label: 'Tutte', vale: () => true },
  { id: 'attesa', label: 'In attesa di esito', vale: inAttesaDiEsito },
  { id: 'idonei', label: 'Idonei', vale: eIdoneo },
  { id: 'presenza', label: 'In presenza', vale: i => eIdoneo(i) && !eRemoto(i) },
  { id: 'remoto', label: 'Da remoto', vale: i => eIdoneo(i) && eRemoto(i) }
]

export default function Iscritti() {
  const { ciclo, iscrizioni, punteggi, ricarica } = useOutletContext()
  const [filtro, setFiltro] = useState('tutte')
  const [errore, setErrore] = useState(null)
  const [dialogo, setDialogo] = useState(null)

  const timepoints = useMemo(() => timepointsPerCodice(punteggi), [punteggi])
  const vale = FILTRI.find(f => f.id === filtro)?.vale || (() => true)
  const visibili = iscrizioni.filter(vale)

  async function esegui(azione) {
    setErrore(null)
    const messaggio = await azione()
    if (messaggio) setErrore(messaggio)
    else ricarica()
  }

  function chiediRitiro(iscrizione) {
    setDialogo({
      ...dialogoRitiro(iscrizione),
      onOk: async () => {
        setDialogo(null)
        await esegui(() => ritira(iscrizione))
      }
    })
  }

  return (
    <section className="dash-ciclo-sezione" aria-labelledby="ciclo-iscrizioni-titolo">
      <header className="dash-ciclo-sezione-testa">
        <div>
          <h2 id="ciclo-iscrizioni-titolo">
            Iscrizioni
            <span className="dash-ciclo-conteggio">{iscrizioni.length}</span>
          </h2>
          <p className="hint">
            L’email serve solo al contatto. Nei dati di ricerca resta il codice.
            I posti in presenza valgono solo per chi è idoneo e in stanza:
            da remoto non occupano un posto.
          </p>
        </div>
      </header>

      {iscrizioni.length > 0 && (
        <div className="filtri-chip" role="group" aria-label="Filtra le iscrizioni">
          {FILTRI.map(f => {
            const n = iscrizioni.filter(f.vale).length
            return (
              <button
                key={f.id}
                type="button"
                className={`dash-tab${filtro === f.id ? ' is-on' : ''}`}
                aria-pressed={filtro === f.id}
                onClick={() => setFiltro(f.id)}
              >
                {f.label} · {n}
              </button>
            )
          })}
        </div>
      )}

      {errore && <p className="avviso-errore" role="alert">{errore}</p>}

      {iscrizioni.length === 0 ? (
        <div className="dash-ciclo-vuoto" role="status">
          <p>Nessuna iscrizione in questo ciclo.</p>
          <p className="hint">Quando qualcuno si iscrive, qui gestisci screening, modalità e posti in presenza.</p>
        </div>
      ) : visibili.length === 0 ? (
        <div className="dash-ciclo-vuoto" role="status">
          <p>Nessuna iscrizione con questo filtro.</p>
        </div>
      ) : (
        <ul className="dash-iscrizioni">
          {visibili.map(i => (
            <RigaIscrizione
              key={i.id}
              iscrizione={i}
              timepoints={timepoints.get(i.utenti?.codice_partecipante)}
              ciclo={ciclo}
              onEsito={(isc, esito) => esegui(() => impostaEsito(isc, esito))}
              onModalita={(isc, modalita) => esegui(() => impostaModalita(isc, modalita))}
              onRitira={chiediRitiro}
            />
          ))}
        </ul>
      )}

      <DialogConferma
        aperto={!!dialogo}
        titolo={dialogo?.titolo || ''}
        confermaEtichetta={dialogo?.etichetta || 'Conferma'}
        pericolo
        onConferma={() => dialogo?.onOk?.()}
        onAnnulla={() => setDialogo(null)}
      >
        {dialogo?.testo}
      </DialogConferma>
    </section>
  )
}
