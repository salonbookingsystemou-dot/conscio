-- Conferma dell'email all'iscrizione (4/11/2026).
-- Un'iscrizione conta solo quando la persona dimostra di leggere quella casella:
-- il codice arriva solo per email e il primo ingresso con il codice vale come conferma.
-- Gli iscritti di oggi restano tutti confermati (backfill su creato_il).

-- 1. Colonna e backfill ─────────────────────────────────────────────────────
-- Il backfill gira solo quando la colonna nasce: rilanciare il file non conferma
-- le iscrizioni arrivate dopo.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'utenti' and column_name = 'email_confermata_il'
  ) then
    alter table public.utenti add column email_confermata_il timestamptz;
    update public.utenti set email_confermata_il = coalesce(creato_il, now());
  end if;
end;
$$;

comment on column public.utenti.email_confermata_il is
  'Primo ingresso con il codice ricevuto per email. Null = iscrizione da confermare: dopo 7 giorni senza dati si cancella.';

-- 2. Email normalizzata ──────────────────────────────────────────────────────
-- Per confrontare gli indirizzi e per i limiti: minuscole per tutti; per Gmail e
-- Googlemail via i punti e tutto ciò che segue un «+» (stessa casella).
-- La stessa regola vive in supabase/functions/_shared/normalizzaEmail.ts.
create or replace function public.normalizza_email(p_email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when s.e is null or s.e = '' then null
    when split_part(s.e, '@', 2) in ('gmail.com', 'googlemail.com') then
      replace(split_part(split_part(s.e, '@', 1), '+', 1), '.', '') || '@gmail.com'
    else s.e
  end
  from (select lower(trim(p_email)) as e) s
$$;

revoke all on function public.normalizza_email(text) from public, anon, authenticated;
grant execute on function public.normalizza_email(text) to service_role;

-- 3. iscrivi_partecipante: stessa firma ──────────────────────────────────────
-- Cambia solo il corpo: confronto sull'email normalizzata, coda senza le iscrizioni
-- non confermate, utente creato con email_confermata_il = null.
create or replace function public.iscrivi_partecipante(
  p_email text,
  p_ciclo_id uuid,
  p_codice text,
  p_consenso_a boolean,
  p_consenso_b boolean,
  p_solo_remoto boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_utente_id uuid;
  v_posti int;
  v_coda int;
  v_tetto_coda int;
  v_ciclo uuid;
  v_solo boolean;
begin
  v_solo := coalesce(p_solo_remoto, false);
  v_ciclo := case when v_solo then null else p_ciclo_id end;

  if coalesce(p_consenso_a, false) is not true then
    raise exception 'CONSENSO_A_OBBLIGATORIO';
  end if;

  if p_email is null or trim(p_email) = '' then
    raise exception 'EMAIL_MANCANTE';
  end if;

  if p_codice is null or trim(p_codice) = '' then
    raise exception 'CODICE_MANCANTE';
  end if;

  if exists (
    select 1
    from utenti u
    join iscrizioni i on i.utente_id = u.id
    where u.ruolo = 'partecipante'
      and normalizza_email(u.email) = normalizza_email(p_email)
  ) then
    raise exception 'EMAIL_GIA_ISCRITTA';
  end if;

  if v_solo then
    select count(*) into v_coda
    from iscrizioni i
    join utenti u on u.id = i.utente_id
    where i.ciclo_id is null
      and u.email_confermata_il is not null
      and not (i.esito_screening = 'idoneo' or u.stato_screening = 'idoneo');

    if v_coda >= 30 then
      raise exception 'CODA_ISCRIZIONI_PIENA';
    end if;
  else
    if v_ciclo is null then
      raise exception 'CICLO_NON_DISPONIBILE';
    end if;

    perform 1 from cicli where id = v_ciclo and stato = 'reclutamento' for update;
    if not found then
      raise exception 'CICLO_NON_DISPONIBILE';
    end if;

    select posti_totali into v_posti from cicli where id = v_ciclo;
    select count(*) into v_coda
    from iscrizioni i
    join utenti u on u.id = i.utente_id
    where i.ciclo_id = v_ciclo
      and u.email_confermata_il is not null
      and not (i.esito_screening = 'idoneo' or u.stato_screening = 'idoneo');

    v_tetto_coda := greatest(coalesce(v_posti, 0) * 2, 30);
    if v_coda >= v_tetto_coda then
      raise exception 'CODA_ISCRIZIONI_PIENA';
    end if;
  end if;

  insert into utenti (
    codice_partecipante, email, ruolo, stato_screening,
    consenso_modulo_a, consenso_modulo_b, email_confermata_il
  ) values (
    trim(p_codice), trim(p_email), 'partecipante', 'in_valutazione',
    true, coalesce(p_consenso_b, false), null
  ) returning id into v_utente_id;

  insert into iscrizioni (utente_id, ciclo_id, esito_screening, modalita_fruizione)
  values (
    v_utente_id,
    v_ciclo,
    'in_attesa',
    case when v_solo then 'remoto' else 'presenza' end
  );

  return jsonb_build_object(
    'ok', true,
    'codice', trim(p_codice),
    'solo_remoto', v_solo
  );
exception
  when unique_violation then
    raise exception 'CODICE_DUPLICATO';
end;
$function$;

-- 4. Partecipante per email (solo service role) ─────────────────────────────
-- Per «porta»: iscrizione con un'email già presente e «Recupera il codice».
-- Restituisce l'indirizzo salvato (si scrive a quello), il codice e se è confermato.
create or replace function public.partecipante_per_email(p_email text)
returns table (
  email text,
  codice text,
  confermata boolean,
  ha_iscrizione boolean
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    trim(u.email),
    u.codice_partecipante,
    u.email_confermata_il is not null,
    exists (select 1 from iscrizioni i where i.utente_id = u.id)
  from utenti u
  where u.ruolo = 'partecipante'
    and u.email is not null
    and u.codice_partecipante is not null
    and normalizza_email(u.email) = normalizza_email(p_email)
  order by (exists (select 1 from iscrizioni i where i.utente_id = u.id)) desc, u.creato_il desc
  limit 1
$$;

revoke all on function public.partecipante_per_email(text) from public, anon, authenticated;
grant execute on function public.partecipante_per_email(text) to service_role;

-- 5. Conferma al primo ingresso (solo service role) ─────────────────────────
-- Idempotente: imposta la data solo se manca. Restituisce true solo la prima volta,
-- così «porta» manda l'avviso della nuova iscrizione al facilitatore una volta sola.
create or replace function public.conferma_email_partecipante(p_codice text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_n int;
begin
  if p_codice is null or trim(p_codice) = '' then
    return false;
  end if;
  update utenti
    set email_confermata_il = now()
  where ruolo = 'partecipante'
    and email_confermata_il is null
    and upper(trim(codice_partecipante)) = upper(trim(p_codice));
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;

revoke all on function public.conferma_email_partecipante(text) from public, anon, authenticated;
grant execute on function public.conferma_email_partecipante(text) to service_role;

-- 6. Pulizia delle iscrizioni non confermate (solo service role) ────────────
-- Chiamata ogni mattina da notifica-inattivita. Tocca solo chi non ha confermato da
-- più di 7 giorni e non ha nessun dato: risposte, log di pratica, check-in.
-- Le iscrizioni e le altre righe collegate vanno via con on delete cascade.
create or replace function public.pulisci_iscrizioni_non_confermate()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_n int;
begin
  delete from utenti u
  where u.ruolo = 'partecipante'
    and u.email_confermata_il is null
    and u.creato_il < now() - interval '7 days'
    and not exists (select 1 from risposte r where r.utente_id = u.id)
    and not exists (select 1 from log_pratica l where l.utente_id = u.id)
    and not exists (select 1 from checkin_settimanali c where c.utente_id = u.id);
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function public.pulisci_iscrizioni_non_confermate() from public, anon, authenticated;
grant execute on function public.pulisci_iscrizioni_non_confermate() to service_role;
