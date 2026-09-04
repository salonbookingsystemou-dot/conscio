-- Fruizione remota: alcuni idonei seguono il ciclo senza occupare un posto in presenza.
-- Eseguire nell'SQL editor dopo le migrazioni già applicate (usa is_facilitatore e
-- assert_partecipante_noto). I posti_totali restano i posti in stanza.

alter table iscrizioni
  add column if not exists modalita_fruizione text not null default 'presenza';

alter table iscrizioni
  drop constraint if exists iscrizioni_modalita_fruizione_check;

alter table iscrizioni
  add constraint iscrizioni_modalita_fruizione_check
  check (modalita_fruizione in ('presenza', 'remoto'));

alter table cicli
  add column if not exists link_incontro text;

alter table cicli
  drop constraint if exists cicli_link_incontro_check;

alter table cicli
  add constraint cicli_link_incontro_check
  check (link_incontro is null or link_incontro ~* '^https://');

create or replace function assicura_posto_presenza(p_ciclo_id uuid, p_iscrizione_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_posti int;
  v_idonei int;
begin
  select posti_totali into v_posti from cicli where id = p_ciclo_id;
  select count(*) into v_idonei
  from iscrizioni i
  join utenti u on u.id = i.utente_id
  where i.ciclo_id = p_ciclo_id
    and i.id is distinct from p_iscrizione_id
    and (i.esito_screening = 'idoneo' or u.stato_screening = 'idoneo')
    and coalesce(i.modalita_fruizione, 'presenza') = 'presenza';

  if v_idonei >= coalesce(v_posti, 0) then
    raise exception 'POSTI_IDONEI_PIENI';
  end if;
end;
$$;

create or replace function iscrivi_partecipante(
  p_email text,
  p_ciclo_id uuid,
  p_codice text,
  p_consenso_a boolean,
  p_consenso_b boolean
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
begin
  if coalesce(p_consenso_a, false) is not true then
    raise exception 'CONSENSO_A_OBBLIGATORIO';
  end if;

  if p_email is null or trim(p_email) = '' then
    raise exception 'EMAIL_MANCANTE';
  end if;

  if p_codice is null or trim(p_codice) = '' then
    raise exception 'CODICE_MANCANTE';
  end if;

  perform 1 from cicli where id = p_ciclo_id and stato = 'reclutamento' for update;
  if not found then
    raise exception 'CICLO_NON_DISPONIBILE';
  end if;

  -- I posti in presenza si occupano allo screening, non in iscrizione:
  -- così restano iscrivibili anche eventuali fruizioni remote.
  select posti_totali into v_posti from cicli where id = p_ciclo_id;
  select count(*) into v_coda
  from iscrizioni i
  join utenti u on u.id = i.utente_id
  where i.ciclo_id = p_ciclo_id
    and not (i.esito_screening = 'idoneo' or u.stato_screening = 'idoneo');

  v_tetto_coda := greatest(coalesce(v_posti, 0) * 2, 30);
  if v_coda >= v_tetto_coda then
    raise exception 'CODA_ISCRIZIONI_PIENA';
  end if;

  if exists (
    select 1
    from utenti u
    join iscrizioni i on i.utente_id = u.id
    where i.ciclo_id = p_ciclo_id
      and lower(trim(u.email)) = lower(trim(p_email))
  ) then
    raise exception 'EMAIL_GIA_ISCRITTA';
  end if;

  insert into utenti (
    codice_partecipante, email, ruolo, stato_screening,
    consenso_modulo_a, consenso_modulo_b
  ) values (
    trim(p_codice), trim(p_email), 'partecipante', 'in_valutazione',
    true, coalesce(p_consenso_b, false)
  ) returning id into v_utente_id;

  insert into iscrizioni (utente_id, ciclo_id, esito_screening, modalita_fruizione)
  values (v_utente_id, p_ciclo_id, 'in_attesa', 'presenza');

  return jsonb_build_object('ok', true, 'codice', trim(p_codice));
exception
  when unique_violation then
    raise exception 'CODICE_DUPLICATO';
end;
$$;

create or replace function imposta_esito_screening(p_iscrizione_id uuid, p_esito text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_utente_id uuid;
  v_ciclo_id uuid;
  v_esito_attuale text;
  v_modalita text;
begin
  if not is_facilitatore() then
    raise exception 'NON_AUTORIZZATO';
  end if;

  if p_esito not in ('in_attesa', 'in_valutazione', 'idoneo', 'da_ricontattare') then
    raise exception 'ESITO_NON_VALIDO';
  end if;

  select utente_id, ciclo_id, esito_screening, coalesce(modalita_fruizione, 'presenza')
    into v_utente_id, v_ciclo_id, v_esito_attuale, v_modalita
  from iscrizioni
  where id = p_iscrizione_id;

  if v_utente_id is null then
    raise exception 'ISCRIZIONE_NON_TROVATA';
  end if;

  if p_esito = 'idoneo'
     and v_esito_attuale is distinct from 'idoneo'
     and v_modalita = 'presenza' then
    perform assicura_posto_presenza(v_ciclo_id, p_iscrizione_id);
  end if;

  update iscrizioni set esito_screening = p_esito where id = p_iscrizione_id;
  update utenti
    set stato_screening = p_esito
    where id = v_utente_id and ruolo = 'partecipante';

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
         coalesce(c.data_fine, c.data_inizio + 62),
         c.nome_ciclo,
         coalesce(i.modalita_fruizione, 'presenza'),
         case
           when coalesce(i.modalita_fruizione, 'presenza') = 'remoto'
           then c.link_incontro
           else null
         end
    into v_inizio, v_fine, v_nome, v_modalita, v_link
  from iscrizioni i
  join cicli c on c.id = i.ciclo_id
  where i.utente_id = v_utente_id
  order by i.data_iscrizione desc
  limit 1;

  if v_inizio is null then
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

revoke all on function assicura_posto_presenza(uuid, uuid) from public;
revoke all on function assicura_posto_presenza(uuid, uuid) from anon, authenticated;
revoke all on function imposta_modalita_fruizione(uuid, text) from public;
revoke all on function imposta_modalita_fruizione(uuid, text) from anon;

grant execute on function imposta_modalita_fruizione(uuid, text) to authenticated;

notify pgrst, 'reload schema';
