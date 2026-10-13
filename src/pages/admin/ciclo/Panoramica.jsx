import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { supabase } from '../../../lib/supabaseClient'
import DialogConferma from '../../../components/DialogConferma.jsx'
import { eIdoneo, eRemoto, etichettaAvanzamento, linkIncontroValido } from '../../../lib/cicli.js'

export default function Panoramica() {
  const { ciclo, iscrizioni, aggiornaCiclo } = useOutletContext()
  const navigate = useNavigate()
  const [linkIncontro, setLinkIncontro] = useState(ciclo.link_incontro || '')
  const [errore, setErrore] = useState(null)
  const [conferma, setConferma] = useState(false)
  const [eliminando, setEliminando] = useState(false)

  useEffect(() => {
    setLinkIncontro(ciclo.link_incontro || '')
  }, [ciclo.id, ciclo.link_incontro])

  const sintesi = useMemo(() => {
    const idoneiPresenza = iscrizioni.filter(i => eIdoneo(i) && !eRemoto(i)).length
    const idoneiRemoti = iscrizioni.filter(i => eIdoneo(i) && eRemoto(i)).length
    const posti = ciclo.posti_totali || 8
    return {
      idoneiPresenza,
      idoneiRemoti,
      inAttesa: iscrizioni.length - idoneiPresenza - idoneiRemoti,
      posti,
      pctPosti: Math.min(100, Math.round((idoneiPresenza / posti) * 100)),
      avanzamento: etichettaAvanzamento(ciclo)
    }
  }, [ciclo, iscrizioni])

  async function aggiorna(patch) {
    setErrore(null)
    const messaggio = await aggiornaCiclo(patch)
    if (messaggio) setErrore(messaggio)
  }

  async function salvaLinkIncontro() {
    const valido = linkIncontroValido(linkIncontro)
    if (valido === false) {
      setErrore('Il link dell’incontro deve iniziare con https://')
      return
    }
    if ((valido || null) === (ciclo.link_incontro || null)) return
    await aggiorna({ link_incontro: valido })
  }

  async function elimina() {
    setEliminando(true)
    const { error } = await supabase.from('cicli').delete().eq('id', ciclo.id)
    setEliminando(false)
    setConferma(false)
    if (error) {
      setErrore('Non è stato possibile eliminare il ciclo.')
      return
    }
    navigate('/admin/cicli', { replace: true })
  }

  return (
    <div className="dash-ciclo">
      {errore && <p className="avviso-errore" role="alert">{errore}</p>}

      <div className="dash-ciclo-stats" aria-label="Sintesi del ciclo">
        <div className="dash-ciclo-stat">
          <span className="dash-ciclo-stat-label">In presenza</span>
          <strong className="dash-ciclo-stat-valore">{sintesi.idoneiPresenza} / {sintesi.posti}</strong>
          <span className="dash-barra" aria-hidden="true">
            <span className="dash-barra-fill is-posti" style={{ width: `${sintesi.pctPosti}%` }} />
          </span>
        </div>
        <div className="dash-ciclo-stat">
          <span className="dash-ciclo-stat-label">Da remoto</span>
          <strong className="dash-ciclo-stat-valore">{sintesi.idoneiRemoti}</strong>
        </div>
        <div className="dash-ciclo-stat">
          <span className="dash-ciclo-stat-label">In attesa</span>
          <strong className={`dash-ciclo-stat-valore${sintesi.inAttesa > 0 ? ' is-attenzione' : ''}`}>
            {sintesi.inAttesa}
          </strong>
        </div>
        <div className="dash-ciclo-stat">
          <span className="dash-ciclo-stat-label">Avanzamento</span>
          <strong className="dash-ciclo-stat-valore dash-ciclo-stat-valore-sm">{sintesi.avanzamento.testo}</strong>
          <span className="dash-barra" aria-hidden="true">
            <span
              className={`dash-barra-fill is-${sintesi.avanzamento.tono}`}
              style={{ width: `${sintesi.avanzamento.pct}%` }}
            />
          </span>
        </div>
      </div>

      <section className="dash-ciclo-sezione" aria-labelledby="ciclo-impostazioni-titolo">
        <header className="dash-ciclo-sezione-testa">
          <div>
            <h2 id="ciclo-impostazioni-titolo">Date e stato</h2>
            <p className="hint">
              Prima dell’inizio i questionari segnalano che il ciclo non è partito; T0 resta disponibile.
              Senza data di fine si usano circa 9 settimane dall’inizio.
              Il link dell’incontro è visibile solo a chi fruisce da remoto.
            </p>
          </div>
        </header>
        <div className="dash-ciclo-campi">
          <div className="field">
            <label htmlFor="ciclo-stato">Stato</label>
            <select id="ciclo-stato" value={ciclo.stato} onChange={e => aggiorna({ stato: e.target.value })}>
              <option value="reclutamento">reclutamento</option>
              <option value="attivo">attivo</option>
              <option value="concluso">concluso</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="ciclo-inizio">Data di inizio</label>
            <input
              id="ciclo-inizio"
              type="date"
              value={String(ciclo.data_inizio).slice(0, 10)}
              onChange={e => aggiorna({ data_inizio: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="ciclo-fine">Data di fine</label>
            <input
              id="ciclo-fine"
              type="date"
              value={ciclo.data_fine ? String(ciclo.data_fine).slice(0, 10) : ''}
              min={String(ciclo.data_inizio).slice(0, 10)}
              onChange={e => aggiorna({ data_fine: e.target.value || null })}
            />
          </div>
          <div className="field">
            <label htmlFor="ciclo-posti">Posti in presenza</label>
            <input
              id="ciclo-posti"
              type="number"
              min="1"
              max="8"
              defaultValue={ciclo.posti_totali || 8}
              key={`${ciclo.id}-${ciclo.posti_totali}`}
              onBlur={e => {
                const posti = Number(e.target.value)
                if (Number.isFinite(posti) && posti >= 1 && posti !== ciclo.posti_totali) {
                  aggiorna({ posti_totali: posti })
                }
              }}
            />
          </div>
          <div className="field dash-ciclo-campo-largo">
            <label htmlFor="ciclo-link">Link incontro remoto</label>
            <div className="dash-ciclo-link">
              <input
                id="ciclo-link"
                type="url"
                inputMode="url"
                placeholder="https://…"
                value={linkIncontro}
                onChange={e => setLinkIncontro(e.target.value)}
                onBlur={salvaLinkIncontro}
              />
              <button type="button" className="btn btn-ghost" onClick={salvaLinkIncontro}>Salva</button>
            </div>
          </div>
        </div>
      </section>

      <footer className="dash-ciclo-pericolo">
        <div>
          <p className="dash-ciclo-pericolo-titolo">Zona delicata</p>
          <p className="hint">
            Elimina l’edizione e i dati collegati (settimane, pratiche, iscrizioni).
            Questionari e log restano sul codice partecipante.
          </p>
        </div>
        <button type="button" className="btn btn-ghost is-pericolo" onClick={() => setConferma(true)}>
          Elimina ciclo
        </button>
      </footer>

      <DialogConferma
        aperto={conferma}
        titolo={`Eliminare «${ciclo.nome_ciclo}»?`}
        confermaEtichetta="Elimina ciclo"
        pericolo
        occupato={eliminando}
        onConferma={elimina}
        onAnnulla={() => setConferma(false)}
      >
        Si cancellano anche settimane, pratiche, comunicazioni e iscrizioni di questa edizione.
        {iscrizioni.length > 0 && ` Ci sono ${iscrizioni.length} iscrizioni collegate: verranno eliminate insieme al ciclo.`}
        {' '}I questionari e i log restano legati al codice partecipante.
      </DialogConferma>
    </div>
  )
}
