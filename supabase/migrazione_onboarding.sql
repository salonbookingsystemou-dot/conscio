-- Onboarding obbligatorio al primo accesso da idoneo:
-- due risposte aperte + flag completamento; T0 resta su risposte questionari.

alter table utenti
  add column if not exists onboarding_completato boolean not null default false;

alter table utenti
  add column if not exists onboarding_completato_il timestamptz;

alter table utenti
  add column if not exists onboarding_q1 text;

alter table utenti
  add column if not exists onboarding_q2 text;

create or replace function stato_pronto_percorso(p_codice text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_utente_id uuid;
  v_onboarding boolean := false;
  v_t0 boolean := false;
begin
  select u.id, coalesce(u.onboarding_completato, false)
  into v_utente_id, v_onboarding
  from utenti u
  where upper(trim(u.codice_partecipante)) = upper(trim(p_codice))
    and u.ruolo = 'partecipante';

  if v_utente_id is null then
    raise exception 'CODICE_NON_TROVATO';
  end if;

  if not exists (
    select 1
    from utenti u
    left join iscrizioni i on i.utente_id = u.id
    where u.id = v_utente_id
      and (u.stato_screening = 'idoneo' or i.esito_screening = 'idoneo')
  ) then
    raise exception 'ACCESSO_NON_IDONEO';
  end if;

  v_t0 := ha_compilato_timepoint(p_codice, 'T0');

  return jsonb_build_object(
    'onboarding', v_onboarding,
    't0', v_t0,
    'pronto', (v_onboarding and v_t0)
  );
end;
$$;

create or replace function salva_onboarding(
  p_codice text,
  p_q1 text,
  p_q2 text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_utente_id uuid;
begin
  select id into v_utente_id
  from utenti
  where upper(trim(codice_partecipante)) = upper(trim(p_codice))
    and ruolo = 'partecipante';

  if v_utente_id is null then
    raise exception 'CODICE_NON_TROVATO';
  end if;

  if not exists (
    select 1
    from utenti u
    left join iscrizioni i on i.utente_id = u.id
    where u.id = v_utente_id
      and (u.stato_screening = 'idoneo' or i.esito_screening = 'idoneo')
  ) then
    raise exception 'ACCESSO_NON_IDONEO';
  end if;

  if p_q1 is null or trim(p_q1) = '' or p_q2 is null or trim(p_q2) = '' then
    raise exception 'RISPOSTE_MANCANTI';
  end if;

  update utenti
  set onboarding_q1 = trim(p_q1),
      onboarding_q2 = trim(p_q2),
      onboarding_completato = true,
      onboarding_completato_il = coalesce(onboarding_completato_il, now())
  where id = v_utente_id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function stato_pronto_percorso(text) from public;
revoke all on function salva_onboarding(text, text, text) from public;
grant execute on function stato_pronto_percorso(text) to anon, authenticated;
grant execute on function salva_onboarding(text, text, text) to anon, authenticated;
