------------------------------------------------------------------------------
-- Un ciclo finito passa da solo a «concluso» (14/11/2026)
--
-- Decisione di Dimitri: un ciclo concluso non deve risultare «attivo».
-- Fine del ciclo = giorno di conclusione delle 8 settimane, come apertura_t2:
-- il più tardi tra inizio + 55 e data_fine. Dal giorno dopo lo stato è «concluso».
-- «reclutamento» e «attivo» restano scelte del facilitatore (il reclutamento
-- apre le iscrizioni); si può anche chiudere un ciclo in anticipo.
--
-- 1. fine_ciclo(inizio, fine): il giorno di conclusione del ciclo.
-- 2. Trigger su cicli: un ciclo con la fine già passata non può tornare
--    «reclutamento» o «attivo» (anche cambiando le date).
-- 3. chiudi_cicli_terminati(): la chiama ogni mattina notifica-inattivita
--    (07:00 UTC), nella pulizia. Va ridistribuita.
--
-- Nessun dato dei partecipanti: informativa, export e reset non cambiano.
-- Lo stato «concluso» non tocca accesso, questionari e promemoria (usano le date);
-- separa_email_cicli_conclusi aspetta comunque 90 giorni dalla fine.
------------------------------------------------------------------------------

create or replace function public.fine_ciclo(p_inizio date, p_fine date)
returns date
language sql
immutable
set search_path to 'public'
as $function$
  select apertura_t2(p_inizio, p_fine);
$function$;

create or replace function public.cicli_chiudi_se_finito()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.stato is distinct from 'concluso'
    and fine_ciclo(new.data_inizio, new.data_fine) < (timezone('Europe/Rome', now()))::date
  then
    new.stato := 'concluso';
  end if;
  return new;
end;
$function$;

drop trigger if exists cicli_chiudi_se_finito on public.cicli;
create trigger cicli_chiudi_se_finito
  before insert or update of stato, data_inizio, data_fine on public.cicli
  for each row execute function public.cicli_chiudi_se_finito();

create or replace function public.chiudi_cicli_terminati()
returns int
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_n int;
begin
  if not (is_facilitatore() or auth.role() = 'service_role') then
    raise exception 'NON_AUTORIZZATO';
  end if;

  update cicli
    set stato = 'concluso'
  where stato is distinct from 'concluso'
    and fine_ciclo(data_inizio, data_fine) < (timezone('Europe/Rome', now()))::date;

  get diagnostics v_n = row_count;
  return v_n;
end;
$function$;

revoke all on function public.chiudi_cicli_terminati() from public, anon;
grant execute on function public.chiudi_cicli_terminati() to authenticated, service_role;
revoke all on function public.cicli_chiudi_se_finito() from public, anon, authenticated;

-- Allinea subito i cicli già finiti (Gruppo pilota: fine il 12/11).
update public.cicli
  set stato = 'concluso'
where stato is distinct from 'concluso'
  and public.fine_ciclo(data_inizio, data_fine) < (timezone('Europe/Rome', now()))::date;
