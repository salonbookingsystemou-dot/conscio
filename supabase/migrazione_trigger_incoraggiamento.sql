-- Trigger che chiama l'edge function invia-incoraggiamento-pratica
-- quando si salva la nota del giorno (log_pratica.tipo = 'giorno').
-- Già applicato in produzione: questo file allinea il repository.
-- Sostituisci __ENCOURAGEMENT_SECRET__ con il secret della funzione prima di eseguire.

create or replace function public.invia_incoraggiamento_dopo_pratica()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'net'
as $function$
begin
  if NEW.tipo is distinct from 'giorno' then
    return NEW;
  end if;

  perform net.http_post(
    url := 'https://pwgptsddqxrkhxfqfbpq.supabase.co/functions/v1/invia-incoraggiamento-pratica',
    body := jsonb_build_object(
      'type', TG_OP,
      'table', TG_TABLE_NAME,
      'schema', TG_TABLE_SCHEMA,
      'record', to_jsonb(NEW)
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', '__ENCOURAGEMENT_SECRET__'
    ),
    timeout_milliseconds := 5000
  );
  return NEW;
exception
  when others then
    raise warning 'invia_incoraggiamento_dopo_pratica: %', sqlerrm;
    return NEW;
end;
$function$;

revoke all on function public.invia_incoraggiamento_dopo_pratica() from public, anon, authenticated;
grant execute on function public.invia_incoraggiamento_dopo_pratica() to service_role;

drop trigger if exists trg_invia_incoraggiamento_pratica on public.log_pratica;
create trigger trg_invia_incoraggiamento_pratica
  after insert on public.log_pratica
  for each row execute function public.invia_incoraggiamento_dopo_pratica();
