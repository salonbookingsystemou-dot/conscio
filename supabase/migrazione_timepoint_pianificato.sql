-- Questionari T0–T3 aperti solo nella finestra della settimana di ciclo.
-- T0 inizio, T1 metà (sett. 4–5), T2 fine (8–9), T3 dopo data_fine.

create or replace function settimana_per_questionari(p_inizio date)
returns int
language sql
stable
as $$
  select case
    when p_inizio is null then 0
    when current_date < p_inizio then 0
    else greatest(1, least(9, ((current_date - p_inizio) / 7) + 1))
  end;
$$;

create or replace function timepoint_in_finestra(
  p_timepoint text,
  p_settimana int,
  p_inizio date,
  p_fine date
)
returns boolean
language sql
stable
as $$
  select case p_timepoint
    when 'T0' then coalesce(p_settimana, 0) <= 1
    when 'T1' then coalesce(p_settimana, 0) between 4 and 5
    when 'T2' then
      coalesce(p_settimana, 0) between 8 and 9
      and (p_fine is null or current_date <= p_fine)
    when 'T3' then
      (p_fine is not null and current_date > p_fine)
      or (p_fine is null and p_inizio is not null and current_date >= p_inizio + 63)
    else false
  end;
$$;

create or replace function stato_questionari_del_partecipante(p_codice text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_utente_id uuid;
  v_inizio date;
  v_fine date;
  v_sett int;
  v_tp text;
  v_fatti text[] := '{}';
  v_lista jsonb := '[]'::jsonb;
  v_stato text;
begin
  select u.id into v_utente_id
  from utenti u
  where upper(trim(u.codice_partecipante)) = upper(trim(p_codice))
    and u.ruolo = 'partecipante';

  if v_utente_id is null then
    raise exception 'CODICE_NON_TROVATO';
  end if;

  select c.data_inizio, coalesce(c.data_fine, c.data_inizio + 62)
    into v_inizio, v_fine
  from iscrizioni i
  join cicli c on c.id = i.ciclo_id
  where i.utente_id = v_utente_id
  order by i.data_iscrizione desc
  limit 1;

  v_sett := settimana_per_questionari(v_inizio);

  select coalesce(array_agg(distinct r.timepoint), '{}')
    into v_fatti
  from risposte r
  where r.utente_id = v_utente_id;

  foreach v_tp in array array['T0', 'T1', 'T2', 'T3']
  loop
    if v_tp = any (v_fatti) then
      v_stato := 'completato';
    elsif timepoint_in_finestra(v_tp, v_sett, v_inizio, v_fine) then
      v_stato := 'aperto';
    elsif
      (v_tp = 'T1' and v_sett < 4)
      or (v_tp = 'T2' and v_sett < 8)
      or (v_tp = 'T3')
    then
      v_stato := 'in_attesa';
    else
      v_stato := 'chiuso';
    end if;

    v_lista := v_lista || jsonb_build_array(jsonb_build_object(
      'id', v_tp,
      'stato', v_stato,
      'quando', case v_tp
        when 'T0' then 'Dall’iscrizione alla settimana 1'
        when 'T1' then 'Settimane 4 e 5'
        when 'T2' then 'Settimane 8 e 9 (fine e intensiva)'
        else 'Dopo la fine del ciclo'
      end
    ));
  end loop;

  return jsonb_build_object(
    'settimana', v_sett,
    'data_inizio', v_inizio,
    'data_fine', v_fine,
    'timepoints', v_lista
  );
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

revoke all on function settimana_per_questionari(date) from public;
revoke all on function timepoint_in_finestra(text, int, date, date) from public;
revoke all on function stato_questionari_del_partecipante(text) from public;
revoke all on function salva_risposte_questionario(text, text, jsonb) from public;

grant execute on function stato_questionari_del_partecipante(text) to anon, authenticated;
grant execute on function salva_risposte_questionario(text, text, jsonb) to anon, authenticated;
