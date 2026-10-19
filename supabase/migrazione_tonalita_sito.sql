-- Tonalità dell'app scelta dal facilitatore in Sito e uguale per tutti.
-- Vuota = tonalità predefinita. La scrive il facilitatore (policy esistenti su
-- impostazioni_sito); il pubblico la legge da vetrina_impostazioni(), anche a vetrina spenta.
-- Eseguire nell'SQL editor.

alter table impostazioni_sito
  add column if not exists tonalita numeric
  check (tonalita is null or (tonalita >= 0 and tonalita < 360));

create or replace function vetrina_impostazioni()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'vetrina_attiva', coalesce(i.vetrina_attiva, false),
    'cta_titolo', i.cta_titolo,
    'cta_testo', i.cta_testo,
    'cta_testo_senza_ciclo', i.cta_testo_senza_ciclo,
    'tonalita', i.tonalita,
    'iscrizioni_aperte', exists (
      select 1 from cicli c where c.stato = 'reclutamento'
    )
  )
  from impostazioni_sito i
  where i.id = 1;
$$;

revoke all on function vetrina_impostazioni() from public;
grant execute on function vetrina_impostazioni() to anon, authenticated;
