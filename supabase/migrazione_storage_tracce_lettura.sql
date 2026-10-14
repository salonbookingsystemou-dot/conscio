-- «Sostituisci il file» (sostituisciFileTraccia) carica con upsert sullo stesso percorso.
-- Per sovrascrivere un oggetto Storage serve anche il permesso di leggerlo: senza una
-- policy SELECT su tracce-audio l'upload veniva rifiutato con
-- «new row violates row-level security policy for table objects».
-- Il bucket è pubblico: gli ascolti passano dall'URL pubblico e non cambiano.
-- Solo facilitatore. Nessun dato dei partecipanti.
drop policy if exists "facilitatore legge tracce" on storage.objects;
create policy "facilitatore legge tracce" on storage.objects
  for select to authenticated
  using (bucket_id = 'tracce-audio' and is_facilitatore());
