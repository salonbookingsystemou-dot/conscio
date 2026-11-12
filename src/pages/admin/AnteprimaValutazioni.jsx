import ValutazioniPercorso from '../../components/admin/ValutazioniPercorso.jsx'

// Solo in sviluppo (/anteprima/valutazioni): la sezione del facilitatore con dati finti.
const CODICI = ['MBSR-A1', 'MBSR-B2', 'MBSR-C3', 'MBSR-D4', 'MBSR-E5', 'MBSR-F6', 'MBSR-G7', 'MBSR-H8']
const ISCRIZIONI = CODICI.map(c => ({
  esito_screening: 'idoneo',
  utenti: { codice_partecipante: c, email_confermata_il: '2026-09-10' }
}))
const PUNTEGGI = CODICI.slice(0, 6).map(c => ({ codice: c, timepoint: 'T2' }))
const RIGHE = [
  { codice_partecipante: 'MBSR-A1', ciclo_id: 'x', stelle: 5, consiglieresti: 'si', porto_a_casa: 'Fermarmi qualche minuto prima di rispondere, anche al lavoro.', valutata_il: '2026-11-12T09:00:00Z', condivisione: true, completata: true },
  { codice_partecipante: 'MBSR-B2', ciclo_id: 'x', stelle: 4, consiglieresti: 'si', porto_a_casa: 'Il body scan la sera: dormo meglio.', valutata_il: '2026-11-12T10:00:00Z', condivisione: true, completata: true },
  { codice_partecipante: 'MBSR-C3', ciclo_id: 'x', stelle: 5, consiglieresti: 'forse', porto_a_casa: null, valutata_il: '2026-11-12T11:00:00Z', condivisione: false, completata: true },
  { codice_partecipante: 'MBSR-D4', ciclo_id: 'x', stelle: 2, consiglieresti: 'no', porto_a_casa: 'Troppo impegnativo con i turni di lavoro.', valutata_il: '2026-11-13T08:00:00Z', condivisione: false, completata: true },
  { codice_partecipante: 'MBSR-E5', ciclo_id: 'x', stelle: 4, consiglieresti: 'si', porto_a_casa: 'Accorgermi del respiro quando sale l’ansia.', valutata_il: '2026-11-13T09:00:00Z', condivisione: true, completata: true },
  { codice_partecipante: 'MBSR-F6', ciclo_id: 'x', stelle: null, consiglieresti: null, porto_a_casa: null, valutata_il: null, condivisione: false, completata: false }
]

export default function AnteprimaValutazioni() {
  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <p className="questionari-avviso is-azione">Anteprima con dati finti.</p>
      <ValutazioniPercorso righe={RIGHE} cicloId="x" tutti={false} iscrizioni={ISCRIZIONI} punteggi={PUNTEGGI} />
    </div>
  )
}
