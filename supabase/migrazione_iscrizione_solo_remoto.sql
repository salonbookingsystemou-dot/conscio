-- Iscrizione solo da remoto: non si agganciata al ciclo in reclutamento.
-- Eseguire dopo migrazione_modalita_fruizione.sql. Poi: supabase functions deploy porta

alter table iscrizioni
  alter column ciclo_id drop not null;

drop function if exists iscrivi_partecipante(text, uuid, text, boolean, boolean);
drop function if exists iscrivi_partecipante(text, uuid, text, boolean, boolean, boolean);

create or replace function iscrivi_partecipante(
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
set search_path = public
as $$
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
      and lower(trim(u.email)) = lower(trim(p_email))
  ) then
    raise exception 'EMAIL_GIA_ISCRITTA';
  end if;

  if v_solo then
    select count(*) into v_coda
    from iscrizioni i
    join utenti u on u.id = i.utente_id
    where i.ciclo_id is null
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
      and not (i.esito_screening = 'idoneo' or u.stato_screening = 'idoneo');

    v_tetto_coda := greatest(coalesce(v_posti, 0) * 2, 30);
    if v_coda >= v_tetto_coda then
      raise exception 'CODA_ISCRIZIONI_PIENA';
    end if;
  end if;

  insert into utenti (
    codice_partecipante, email, ruolo, stato_screening,
    consenso_modulo_a, consenso_modulo_b
  ) values (
    trim(p_codice), trim(p_email), 'partecipante', 'in_valutazione',
    true, coalesce(p_consenso_b, false)
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
$$;

create or replace function assegna_iscrizione_a_ciclo(p_iscrizione_id uuid, p_ciclo_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ciclo_attuale uuid;
begin
  if not is_facilitatore() then
    raise exception 'NON_AUTORIZZATO';
  end if;

  if p_ciclo_id is null or not exists (select 1 from cicli where id = p_ciclo_id) then
    raise exception 'CICLO_NON_DISPONIBILE';
  end if;

  select ciclo_id into v_ciclo_attuale
  from iscrizioni
  where id = p_iscrizione_id;

  if not found then
    raise exception 'ISCRIZIONE_NON_TROVATA';
  end if;

  if v_ciclo_attuale is not null then
    raise exception 'ISCRIZIONE_GIA_COLLEGATA';
  end if;

  update iscrizioni
    set ciclo_id = p_ciclo_id,
        modalita_fruizione = 'remoto'
    where id = p_iscrizione_id;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function imposta_modalita_fruizione(p_iscrizione_id uuid, p_modalita text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_utente_id uuid;
  v_ciclo_id uuid;
  v_esito text;
  v_modalita text;
  v_stato_utente text;
begin
  if not is_facilitatore() then
    raise exception 'NON_AUTORIZZATO';
  end if;

  if p_modalita not in ('presenza', 'remoto') then
    raise exception 'MODALITA_NON_VALIDA';
  end if;

  select i.utente_id, i.ciclo_id, i.esito_screening,
         coalesce(i.modalita_fruizione, 'presenza'), u.stato_screening
    into v_utente_id, v_ciclo_id, v_esito, v_modalita, v_stato_utente
  from iscrizioni i
  join utenti u on u.id = i.utente_id
  where i.id = p_iscrizione_id;

  if v_utente_id is null then
    raise exception 'ISCRIZIONE_NON_TROVATA';
  end if;

  if p_modalita = 'presenza' and v_ciclo_id is null then
    raise exception 'CICLO_MANCANTE';
  end if;

  if p_modalita = 'presenza'
     and v_modalita is distinct from 'presenza'
     and (v_esito = 'idoneo' or v_stato_utente = 'idoneo') then
    perform assicura_posto_presenza(v_ciclo_id, p_iscrizione_id);
  end if;

  update iscrizioni
    set modalita_fruizione = p_modalita
    where id = p_iscrizione_id;

  return jsonb_build_object('ok', true, 'modalita_fruizione', p_modalita);
end;
$$;

create or replace function ciclo_del_partecipante(p_codice text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_utente_id uuid;
  v_inizio date;
  v_fine date;
  v_nome text;
  v_modalita text;
  v_link text;
begin
  v_utente_id := assert_partecipante_noto(p_codice);

  select c.data_inizio,
         case when c.id is null then null else coalesce(c.data_fine, c.data_inizio + 62) end,
         c.nome_ciclo,
         coalesce(i.modalita_fruizione, 'presenza'),
         case
           when coalesce(i.modalita_fruizione, 'presenza') = 'remoto'
           then c.link_incontro
           else null
         end
    into v_inizio, v_fine, v_nome, v_modalita, v_link
  from iscrizioni i
  left join cicli c on c.id = i.ciclo_id
  where i.utente_id = v_utente_id
  order by i.data_iscrizione desc
  limit 1;

  if not found then
    return jsonb_build_object(
      'nome_ciclo', null,
      'data_inizio', null,
      'data_fine', null,
      'modalita_fruizione', null,
      'link_incontro', null
    );
  end if;

  return jsonb_build_object(
    'nome_ciclo', v_nome,
    'data_inizio', v_inizio,
    'data_fine', v_fine,
    'modalita_fruizione', v_modalita,
    'link_incontro', v_link
  );
end;
$$;

revoke all on function iscrivi_partecipante(text, uuid, text, boolean, boolean, boolean) from public;
revoke all on function iscrivi_partecipante(text, uuid, text, boolean, boolean, boolean) from anon, authenticated;
revoke all on function assegna_iscrizione_a_ciclo(uuid, uuid) from public;
revoke all on function assegna_iscrizione_a_ciclo(uuid, uuid) from anon;

grant execute on function iscrivi_partecipante(text, uuid, text, boolean, boolean, boolean) to service_role;
grant execute on function assegna_iscrizione_a_ciclo(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
