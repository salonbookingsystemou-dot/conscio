-- Avviso dopo 15 giorni senza onboarding o senza pratiche;
-- chiusura automatica 15 giorni dopo l’avviso se l’inattività continua.

create or replace function pratica_iniziata(p_utente_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from log_pratica lp
    where lp.utente_id = p_utente_id
      and lp.tipo in ('ascolto', 'formale', 'informale', 'a_casa')
  );
$$;

create or replace function candidati_inattivita_remoto()
returns table (
  utente_id uuid,
  iscrizione_id uuid,
  email text,
  codice text,
  tipo text,
  da_quando timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (is_facilitatore() or auth.role() = 'service_role') then
    raise exception 'NON_AUTORIZZATO';
  end if;

  return query
  select
    u.id,
    i.id,
    u.email,
    u.codice_partecipante,
    'non_avviato'::text,
    coalesce(i.idoneo_il, i.data_iscrizione)
  from utenti u
  join iscrizioni i on i.utente_id = u.id
  where i.ciclo_id is null
    and i.modalita_fruizione = 'remoto'
    and u.ruolo = 'partecipante'
    and u.email is not null
    and u.consenso_modulo_a = true
    and (u.stato_screening = 'idoneo' or i.esito_screening = 'idoneo')
    and i.esito_screening is distinct from 'ritirato'
    and u.stato_screening is distinct from 'ritirato'
    and coalesce(u.onboarding_completato, false) is not true
    and coalesce(i.idoneo_il, i.data_iscrizione) <= now() - interval '15 days'
    and not exists (
      select 1 from notifiche_inattivita n
      where n.utente_id = u.id and n.tipo = 'non_avviato'
    )
  union all
  select
    u.id,
    i.id,
    u.email,
    u.codice_partecipante,
    'onboarding_senza_ascolto'::text,
    u.onboarding_completato_il
  from utenti u
  join iscrizioni i on i.utente_id = u.id
  where i.ciclo_id is null
    and i.modalita_fruizione = 'remoto'
    and u.ruolo = 'partecipante'
    and u.email is not null
    and u.consenso_modulo_a = true
    and (u.stato_screening = 'idoneo' or i.esito_screening = 'idoneo')
    and i.esito_screening is distinct from 'ritirato'
    and u.stato_screening is distinct from 'ritirato'
    and u.onboarding_completato is true
    and u.onboarding_completato_il <= now() - interval '15 days'
    and not pratica_iniziata(u.id)
    and not exists (
      select 1 from notifiche_inattivita n
      where n.utente_id = u.id and n.tipo = 'onboarding_senza_ascolto'
    );
end;
$$;

create or replace function candidati_ritiro_inattivita()
returns table (
  utente_id uuid,
  iscrizione_id uuid,
  email text,
  codice text,
  tipo text,
  avvisato_il timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (is_facilitatore() or auth.role() = 'service_role') then
    raise exception 'NON_AUTORIZZATO';
  end if;

  return query
  select
    u.id,
    i.id,
    u.email,
    u.codice_partecipante,
    n.tipo,
    n.inviata_il
  from notifiche_inattivita n
  join utenti u on u.id = n.utente_id
  join iscrizioni i on i.utente_id = u.id
  where n.inviata_il <= now() - interval '15 days'
    and n.tipo in ('non_avviato', 'onboarding_senza_ascolto')
    and i.ciclo_id is null
    and i.modalita_fruizione = 'remoto'
    and u.ruolo = 'partecipante'
    and u.email is not null
    and (u.stato_screening = 'idoneo' or i.esito_screening = 'idoneo')
    and i.esito_screening is distinct from 'ritirato'
    and u.stato_screening is distinct from 'ritirato'
    and (
      (n.tipo = 'non_avviato' and coalesce(u.onboarding_completato, false) is not true)
      or (n.tipo = 'onboarding_senza_ascolto' and not pratica_iniziata(u.id))
    );
end;
$$;

create or replace function ritira_inattivo(p_utente_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ok boolean := false;
begin
  if not (is_facilitatore() or auth.role() = 'service_role') then
    raise exception 'NON_AUTORIZZATO';
  end if;

  select true
    into v_ok
  from candidati_ritiro_inattivita() c
  where c.utente_id = p_utente_id
  limit 1;

  if not coalesce(v_ok, false) then
    raise exception 'RITIRO_NON_DOVUTO';
  end if;

  update utenti
    set email = null,
        onboarding_q1 = null,
        onboarding_q2 = null,
        stato_screening = 'ritirato'
  where id = p_utente_id
    and ruolo = 'partecipante';

  update iscrizioni
    set esito_screening = 'ritirato'
  where utente_id = p_utente_id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function pratica_iniziata(uuid) from public;
revoke all on function candidati_inattivita_remoto() from public;
revoke all on function candidati_ritiro_inattivita() from public;
revoke all on function ritira_inattivo(uuid) from public;

grant execute on function candidati_inattivita_remoto() to authenticated, service_role;
grant execute on function candidati_ritiro_inattivita() to authenticated, service_role;
grant execute on function ritira_inattivo(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
