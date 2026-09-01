-- Solo gli idonei occupano un posto e accedono al percorso.
-- Il facilitatore può rimuovere un partecipante e impostare l'esito con tetto posti.

create or replace function partecipante_e_idoneo(p_codice text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from utenti u
    left join iscrizioni i on i.utente_id = u.id
    where upper(trim(u.codice_partecipante)) = upper(trim(p_codice))
      and u.ruolo = 'partecipante'
      and (u.stato_screening = 'idoneo' or i.esito_screening = 'idoneo')
  );
$$;

create or replace function codice_partecipante_valido(p_codice text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select partecipante_e_idoneo(p_codice);
$$;

create or replace function stato_accesso_codice(p_codice text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ruolo text;
  v_stato text;
  v_esito text;
begin
  select u.ruolo, u.stato_screening, i.esito_screening
    into v_ruolo, v_stato, v_esito
  from utenti u
  left join iscrizioni i on i.utente_id = u.id
  where upper(trim(u.codice_partecipante)) = upper(trim(p_codice))
  order by i.data_iscrizione desc nulls last
  limit 1;

  if v_ruolo is null or v_ruolo <> 'partecipante' then
    return 'non_trovato';
  end if;
  if v_stato = 'idoneo' or v_esito = 'idoneo' then
    return 'ok';
  end if;
  return 'in_attesa';
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
  v_idonei int;
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

  select posti_totali into v_posti from cicli where id = p_ciclo_id;
  select count(*) into v_idonei
  from iscrizioni i
  join utenti u on u.id = i.utente_id
  where i.ciclo_id = p_ciclo_id
    and (i.esito_screening = 'idoneo' or u.stato_screening = 'idoneo');

  if v_idonei >= coalesce(v_posti, 0) then
    raise exception 'CICLO_PIENO';
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

  insert into iscrizioni (utente_id, ciclo_id, esito_screening)
  values (v_utente_id, p_ciclo_id, 'in_attesa');

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
  v_posti int;
  v_idonei int;
  v_esito_attuale text;
begin
  if not is_facilitatore() then
    raise exception 'NON_AUTORIZZATO';
  end if;

  if p_esito not in ('in_attesa', 'in_valutazione', 'idoneo', 'da_ricontattare') then
    raise exception 'ESITO_NON_VALIDO';
  end if;

  select utente_id, ciclo_id, esito_screening
    into v_utente_id, v_ciclo_id, v_esito_attuale
  from iscrizioni
  where id = p_iscrizione_id;

  if v_utente_id is null then
    raise exception 'ISCRIZIONE_NON_TROVATA';
  end if;

  if p_esito = 'idoneo' and v_esito_attuale is distinct from 'idoneo' then
    select posti_totali into v_posti from cicli where id = v_ciclo_id;
    select count(*) into v_idonei
    from iscrizioni i
    join utenti u on u.id = i.utente_id
    where i.ciclo_id = v_ciclo_id
      and (i.esito_screening = 'idoneo' or u.stato_screening = 'idoneo');
    if v_idonei >= coalesce(v_posti, 0) then
      raise exception 'POSTI_IDONEI_PIENI';
    end if;
  end if;

  update iscrizioni set esito_screening = p_esito where id = p_iscrizione_id;
  update utenti
    set stato_screening = p_esito
    where id = v_utente_id and ruolo = 'partecipante';

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function elimina_partecipante(p_codice text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not is_facilitatore() then
    raise exception 'NON_AUTORIZZATO';
  end if;

  select id into v_id
  from utenti
  where upper(trim(codice_partecipante)) = upper(trim(p_codice))
    and ruolo = 'partecipante';

  if v_id is null then
    raise exception 'UTENTE_NON_TROVATO';
  end if;

  delete from utenti where id = v_id;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function salva_risposte_questionario(
  p_codice text,
  p_timepoint text,
  p_risposte jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_utente_id uuid;
  v_inserite int;
  v_inizio date;
  v_fine date;
  v_sett int;
begin
  if p_timepoint not in ('T0', 'T1', 'T2', 'T3') then
    raise exception 'TIMEPOINT_NON_VALIDO';
  end if;

  if p_risposte is null or jsonb_typeof(p_risposte) <> 'array' or jsonb_array_length(p_risposte) = 0 then
    raise exception 'RISPOSTE_MANCANTI';
  end if;

  select id into v_utente_id
  from utenti
  where upper(trim(codice_partecipante)) = upper(trim(p_codice))
    and ruolo = 'partecipante';

  if v_utente_id is null then
    raise exception 'CODICE_NON_TROVATO';
  end if;

  if not partecipante_e_idoneo(p_codice) then
    raise exception 'ACCESSO_NON_IDONEO';
  end if;

  select c.data_inizio, coalesce(c.data_fine, c.data_inizio + 62)
    into v_inizio, v_fine
  from iscrizioni i
  join cicli c on c.id = i.ciclo_id
  where i.utente_id = v_utente_id
  order by i.data_iscrizione desc
  limit 1;

  v_sett := settimana_per_questionari(v_inizio);

  if not timepoint_in_finestra(p_timepoint, v_sett, v_inizio, v_fine) then
    raise exception 'TIMEPOINT_NON_APERTO';
  end if;

  if exists (
    select 1 from risposte
    where utente_id = v_utente_id and timepoint = p_timepoint
  ) then
    raise exception 'COMPILAZIONE_GIA_PRESENTE';
  end if;

  insert into risposte (utente_id, item_id, timepoint, valore)
  select
    v_utente_id,
    i.id,
    p_timepoint,
    (x->>'valore')::int
  from jsonb_array_elements(p_risposte) as x
  join item i on i.id = (x->>'item_id')::uuid
  where (i.scala = 'likert_0_4' and (x->>'valore')::int between 0 and 4)
     or (i.scala = 'likert_1_5' and (x->>'valore')::int between 1 and 5);

  get diagnostics v_inserite = row_count;

  if v_inserite <> jsonb_array_length(p_risposte) then
    raise exception 'RISPOSTE_NON_VALIDE';
  end if;

  return jsonb_build_object('ok', true, 'timepoint', p_timepoint, 'n_risposte', v_inserite);
end;
$$;

create or replace function salva_log_pratica(
  p_codice text,
  p_data date,
  p_durata int,
  p_note text,
  p_tipo text default null,
  p_esercizio_id uuid default null,
  p_tono_dopo text default null,
  p_tono_prima text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_utente_id uuid;
  v_dopo text;
  v_prima text;
begin
  select id into v_utente_id
  from utenti
  where upper(trim(codice_partecipante)) = upper(trim(p_codice))
    and ruolo = 'partecipante';

  if v_utente_id is null then
    raise exception 'CODICE_NON_TROVATO';
  end if;

  if not partecipante_e_idoneo(p_codice) then
    raise exception 'ACCESSO_NON_IDONEO';
  end if;

  if p_durata is null or p_durata <= 0 then
    raise exception 'DURATA_NON_VALIDA';
  end if;

  if p_note is null or trim(p_note) = '' then
    raise exception 'NOTA_MANCANTE';
  end if;

  if p_esercizio_id is not null and not exists (
    select 1
    from esercizi e
    join lezioni l on l.id = e.lezione_id
    join iscrizioni i on i.ciclo_id = l.ciclo_id
    where e.id = p_esercizio_id
      and i.utente_id = v_utente_id
  ) then
    raise exception 'ESERCIZIO_NON_VALIDO';
  end if;

  v_dopo := case
    when p_tono_dopo in ('piacevole', 'neutro', 'spiacevole') then p_tono_dopo
  end;
  v_prima := case
    when p_tono_prima in ('piacevole', 'neutro', 'spiacevole') then p_tono_prima
  end;

  insert into log_pratica (
    utente_id, esercizio_id, data, durata_minuti, note, tipo, tono_prima, tono_dopo
  ) values (
    v_utente_id,
    p_esercizio_id,
    coalesce(p_data, current_date),
    p_durata,
    p_note,
    p_tipo,
    v_prima,
    v_dopo
  );

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function partecipante_e_idoneo(text) from public;
revoke all on function stato_accesso_codice(text) from public;
revoke all on function imposta_esito_screening(uuid, text) from public;
revoke all on function elimina_partecipante(text) from public;

grant execute on function partecipante_e_idoneo(text) to anon, authenticated;
grant execute on function codice_partecipante_valido(text) to anon, authenticated;
grant execute on function stato_accesso_codice(text) to anon, authenticated;
grant execute on function iscrivi_partecipante(text, uuid, text, boolean, boolean) to anon, authenticated;
grant execute on function imposta_esito_screening(uuid, text) to authenticated;
grant execute on function elimina_partecipante(text) to authenticated;
grant execute on function salva_risposte_questionario(text, text, jsonb) to anon, authenticated;
grant execute on function salva_log_pratica(text, date, int, text, text, uuid, text, text) to anon, authenticated;
