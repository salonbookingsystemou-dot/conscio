-- Collega ogni riga di log alla pratica della settimana (esercizio_id).
-- Il partecipante vede i propri log sotto la lezione; nessuna email.

drop function if exists salva_log_pratica(text, date, int, text, text);

create or replace function salva_log_pratica(
  p_codice text,
  p_data date,
  p_durata int,
  p_note text,
  p_tipo text default null,
  p_esercizio_id uuid default null
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

  if p_durata is null or p_durata <= 0 then
    raise exception 'DURATA_NON_VALIDA';
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

  insert into log_pratica (utente_id, esercizio_id, data, durata_minuti, note, tipo)
  values (
    v_utente_id,
    p_esercizio_id,
    coalesce(p_data, current_date),
    p_durata,
    p_note,
    p_tipo
  );

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function programma_del_partecipante(p_codice text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_utente_id uuid;
  v_ciclo_id uuid;
  v_inizio date;
  v_settimana int;
begin
  select u.id into v_utente_id
  from utenti u
  where upper(trim(u.codice_partecipante)) = upper(trim(p_codice))
    and u.ruolo = 'partecipante';

  if v_utente_id is null then
    raise exception 'CODICE_NON_TROVATO';
  end if;

  select i.ciclo_id, c.data_inizio into v_ciclo_id, v_inizio
  from iscrizioni i
  join cicli c on c.id = i.ciclo_id
  where i.utente_id = v_utente_id
  order by i.data_iscrizione desc
  limit 1;

  if v_ciclo_id is null then
    return jsonb_build_object('settimana_corrente', 1, 'lezioni', '[]'::jsonb);
  end if;

  v_settimana := greatest(1, least(9, ((current_date - v_inizio) / 7) + 1));

  return jsonb_build_object(
    'settimana_corrente', v_settimana,
    'lezioni', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id,
        'numero_settimana', l.numero_settimana,
        'tema', l.tema,
        'pratiche_formali', l.pratiche_formali,
        'pratiche_informali', l.pratiche_informali,
        'materiali', l.materiali,
        'esercizi', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', e.id,
            'tipo', e.tipo,
            'descrizione', e.descrizione,
            'log', coalesce((
              select jsonb_agg(jsonb_build_object(
                'id', lg.id,
                'data', lg.data,
                'durata_minuti', lg.durata_minuti,
                'tipo', lg.tipo,
                'note', lg.note
              ) order by lg.data desc, lg.id desc)
              from log_pratica lg
              where lg.esercizio_id = e.id
                and lg.utente_id = v_utente_id
            ), '[]'::jsonb)
          ) order by e.id)
          from esercizi e where e.lezione_id = l.id
        ), '[]'::jsonb)
      ) order by l.numero_settimana)
      from lezioni l
      where l.ciclo_id = v_ciclo_id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function log_pratica_del_partecipante(p_codice text)
returns table (
  id uuid,
  data date,
  durata_minuti int,
  tipo text,
  note text,
  numero_settimana int,
  esercizio text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_utente_id uuid;
begin
  select u.id into v_utente_id
  from utenti u
  where upper(trim(u.codice_partecipante)) = upper(trim(p_codice))
    and u.ruolo = 'partecipante';

  if v_utente_id is null then
    raise exception 'CODICE_NON_TROVATO';
  end if;

  return query
  select
    l.id,
    l.data,
    l.durata_minuti,
    l.tipo,
    l.note,
    lez.numero_settimana,
    e.descrizione
  from log_pratica l
  left join esercizi e on e.id = l.esercizio_id
  left join lezioni lez on lez.id = e.lezione_id
  where l.utente_id = v_utente_id
  order by l.data desc, l.id desc;
end;
$$;

drop function if exists log_pratica_pseudonimi();

create or replace function log_pratica_pseudonimi()
returns table (
  codice_partecipante text,
  data date,
  durata_minuti int,
  tipo text,
  note text,
  numero_settimana int,
  esercizio text
)
language sql
security definer
set search_path = public
as $$
  select
    u.codice_partecipante,
    l.data,
    l.durata_minuti,
    l.tipo,
    l.note,
    lez.numero_settimana,
    e.descrizione
  from log_pratica l
  join utenti u on u.id = l.utente_id
  left join esercizi e on e.id = l.esercizio_id
  left join lezioni lez on lez.id = e.lezione_id
  where is_facilitatore()
    and u.ruolo = 'partecipante'
  order by l.data desc, u.codice_partecipante;
$$;

revoke all on function salva_log_pratica(text, date, int, text, text, uuid) from public;
revoke all on function log_pratica_del_partecipante(text) from public;
revoke all on function log_pratica_pseudonimi() from public;

grant execute on function salva_log_pratica(text, date, int, text, text, uuid) to anon, authenticated;
grant execute on function log_pratica_del_partecipante(text) to anon, authenticated;
grant execute on function log_pratica_pseudonimi() to authenticated;
grant execute on function programma_del_partecipante(text) to anon, authenticated;
