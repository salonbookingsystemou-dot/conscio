-- La durata delle pratiche formali non si inserisce più a mano: è quella della
-- traccia collegata. L'editor la copia al salvataggio e la sostituzione del file
-- la aggiorna; qui si allineano le pratiche esistenti.
-- Gli ascolti già registrati (log_pratica) hanno una durata propria e non cambiano.

update public.esercizi e
set durata_minuti = t.durata_minuti
from public.tracce t
where t.id = e.traccia_id
  and t.durata_minuti is not null
  and e.durata_minuti is distinct from t.durata_minuti;
