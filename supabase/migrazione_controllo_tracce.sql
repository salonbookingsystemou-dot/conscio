-- Esito dell'ultimo controllo di ogni traccia (file + ascolto tecnico).
-- Solo facilitatore. Nessun dato dei partecipanti.
-- Il livello «collegamenti» dipende dal ciclo e si calcola nell'app: qui non entra.

alter table public.tracce add column if not exists file_aggiornato_il timestamptz;

-- Il trigger trg_tracce_aggiornato riscriverebbe aggiornato_il su tutte le righe:
-- per il riempimento iniziale resta spento, così le date di modifica non cambiano.
alter table public.tracce disable trigger trg_tracce_aggiornato;
update public.tracce
  set file_aggiornato_il = coalesce(aggiornato_il, creato_il)
  where file_aggiornato_il is null;
alter table public.tracce enable trigger trg_tracce_aggiornato;

alter table public.tracce alter column file_aggiornato_il set default now();

create table if not exists public.controlli_tracce (
  traccia_id uuid primary key references public.tracce(id) on delete cascade,
  stato text not null check (stato in ('ok', 'attenzione', 'errore')),
  esiti jsonb not null default '[]'::jsonb,   -- [{ livello: 'file' | 'ascolto', stato, testo, da? }]
  misure jsonb,                               -- { durata, integrata, tipo, totale }
  controllato_il timestamptz not null default now()
);

alter table public.controlli_tracce enable row level security;
drop policy if exists "facilitatore gestisce controlli" on public.controlli_tracce;
create policy "facilitatore gestisce controlli" on public.controlli_tracce
  for all using (is_facilitatore()) with check (is_facilitatore());
revoke all on public.controlli_tracce from anon;
grant select, insert, update, delete on public.controlli_tracce to authenticated;

notify pgrst, 'reload schema';
