-- Campana tibetana dentro il file della traccia, all'inizio e alla fine
-- (decisione del 15/10/2026: suona anche a schermo spento e offline, mentre
-- quella del player poteva perdersi). La colonna dice se il file la contiene già.
-- I file caricati a settembre la hanno di loro; quelli generati da script
-- (ottobre) no, finché non si usa «Aggiungi le campane» nella scheda della traccia.
-- Nessun dato dei partecipanti.

alter table public.tracce
  add column if not exists campane_nel_file boolean not null default false;

alter table public.tracce disable trigger trg_tracce_aggiornato;
update public.tracce
  set campane_nel_file = true
  where creato_il < '2026-10-01';
alter table public.tracce enable trigger trg_tracce_aggiornato;

notify pgrst, 'reload schema';
