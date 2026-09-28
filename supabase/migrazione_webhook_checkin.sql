-- Avviso al facilitatore (edge function avvisa-segnalazione-checkin)
-- quando un check-in segnala un'esperienza difficile.
-- Sostituisci __CHECKIN_WEBHOOK_SECRET__ con il secret della funzione prima di eseguire.

create or replace function public.avvisa_segnalazione_checkin()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'net'
as $function$
begin
  if NEW.esperienza_difficile is not true or NEW.segnalazione_gestita_il is not null then
    return NEW;
  end if;
  if TG_OP = 'UPDATE' and OLD.esperienza_difficile is true then
    return NEW;
  end if;

  perform net.http_post(
    url := 'https://pwgptsddqxrkhxfqfbpq.supabase.co/functions/v1/avvisa-segnalazione-checkin',
    body := jsonb_build_object(
      'type', TG_OP,
      'table', TG_TABLE_NAME,
      'schema', TG_TABLE_SCHEMA,
      'record', to_jsonb(NEW) - 'nota_difficile',
      'old_record', case when TG_OP = 'UPDATE' then to_jsonb(OLD) - 'nota_difficile' end
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', '__CHECKIN_WEBHOOK_SECRET__'
    ),
    timeout_milliseconds := 5000
  );
  return NEW;
exception
  when others then
    raise warning 'avvisa_segnalazione_checkin: %', sqlerrm;
    return NEW;
end;
$function$;

revoke all on function public.avvisa_segnalazione_checkin() from public, anon, authenticated;

drop trigger if exists trg_avvisa_segnalazione_checkin on public.checkin_settimanali;
create trigger trg_avvisa_segnalazione_checkin
  after insert or update on public.checkin_settimanali
  for each row execute function public.avvisa_segnalazione_checkin();
