import { useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { supabase } from '../../../lib/supabaseClient'
import { riepilogoCiclo } from '../../../lib/controlloTracce'
import StatoAttesa from '../../../components/StatoAttesa.jsx'

const NUMERI_SETTIMANA = [1, 2, 3, 4, 5, 6, 7, 8, 9]

function etichettaSettimana(numero) {
  return numero === 9 ? 'Intensiva' : `Settimana ${numero}`
}

function settimanaPronta(lezione) {
  return Boolean(lezione?.tema && String(lezione.tema).trim())
}

function testoRiepilogo({ tracce, pratiche }) {
  const parti = []
  if (tracce > 0) parti.push(tracce === 1 ? '1 traccia da guardare' : `${tracce} tracce da guardare`)
  if (pratiche > 0) parti.push(pratiche === 1 ? '1 pratica senza traccia in libreria' : `${pratiche} pratiche senza traccia in libreria`)
  return parti.join(' · ')
}

export default function Programma() {
  const { ciclo } = useOutletContext()
  const [lezioni, setLezioni] = useState(null)
  const [errore, setErrore] = useState(null)
  const [riepilogo, setRiepilogo] = useState(null)

  useEffect(() => {
    let vivo = true
    setLezioni(null)
    setErrore(null)
    supabase
      .from('lezioni')
      .select('id, numero_settimana, tema')
      .eq('ciclo_id', ciclo.id)
      .order('numero_settimana', { ascending: true })
      .then(({ data, error }) => {
        if (!vivo) return
        if (error) {
          setErrore('Non è stato possibile leggere le settimane.')
          setLezioni([])
          return
        }
        setLezioni(data || [])
      })
    setRiepilogo(null)
    riepilogoCiclo(ciclo.id)
      .then(r => { if (vivo) setRiepilogo(r) })
      .catch(() => {})
    return () => { vivo = false }
  }, [ciclo.id])

  const perNumero = useMemo(() => {
    const mappa = {}
    for (const l of lezioni || []) mappa[l.numero_settimana] = l
    return mappa
  }, [lezioni])

  const avviso = riepilogo ? testoRiepilogo(riepilogo) : ''

  return (
    <>
      <header className="dash-panel-testa">
        <div>
          <h2>Programma</h2>
          <p className="lead">Le settimane del ciclo: tema, pratiche formali con la loro traccia e pratiche informali.</p>
        </div>
      </header>

      {avviso && (
        <p className="disclaimer programma-avviso" role="status">
          {avviso}.{' '}
          <Link to={`/admin/tracce?ciclo=${ciclo.id}&filtro=da-guardare`}>Apri le tracce da guardare</Link>
        </p>
      )}

      {errore && <p className="avviso-errore" role="alert">{errore}</p>}

      {lezioni === null ? (
        <StatoAttesa etichetta="Leggo le settimane…" />
      ) : (
        <div className="percorso-griglia">
          {NUMERI_SETTIMANA.map(n => {
            const lezione = perNumero[n]
            const pronta = settimanaPronta(lezione)
            const tema = String(lezione?.tema || '').trim()
            return (
              <Link
                key={n}
                className={`percorso-card${pronta ? ' is-pronta' : ' is-vuota'}`}
                to={`/admin/cicli/${ciclo.id}/programma/settimana/${n}`}
              >
                <span className="percorso-card-capo">
                  <strong>{etichettaSettimana(n)}</strong>
                  <span className={`percorso-badge${pronta ? ' is-pronta' : ''}`}>
                    {pronta ? 'Pronta' : 'Da creare'}
                  </span>
                </span>
                {tema ? <span>{tema}</span> : <em>Da compilare</em>}
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}
