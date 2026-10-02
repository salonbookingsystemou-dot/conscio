-- Data di modifica delle tracce in libreria.
-- Le righe già presenti prendono come modifica la data di creazione.

alter table public.tracce
  add column if not exists aggiornato_il timestamptz;

update public.tracce
set aggiornato_il = creato_il
where aggiornato_il is null;

alter table public.tracce
  alter column aggiornato_il set default now();

alter table public.tracce
  alter column aggiornato_il set not null;

create or replace function public.tracce_segna_aggiornamento()
returns trigger
language plpgsql
as $$
begin
  new.aggiornato_il = now();
  return new;
end;
$$;

revoke all on function public.tracce_segna_aggiornamento() from public, anon;
grant execute on function public.tracce_segna_aggiornamento() to authenticated;

drop trigger if exists trg_tracce_aggiornato on public.tracce;
create trigger trg_tracce_aggiornato
  before update on public.tracce
  for each row execute function public.tracce_segna_aggiornamento();
