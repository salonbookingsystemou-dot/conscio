-- Dopo migrazione_facilitatore.sql. Colonna tipo sul log + viste partecipante.

alter table log_pratica add column if not exists tipo text;

drop function if exists salva_log_pratica(text, date, int, text);

create or replace function salva_log_pratica(
  p_codice text,
  p_data date,
  p_durata int,
  p_note text,
  p_tipo text default null
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

  insert into log_pratica (utente_id, data, durata_minuti, note, tipo)
  values (v_utente_id, coalesce(p_data, current_date), p_durata, p_note, p_tipo);

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function log_pratica_pseudonimi()
returns table (
  codice_partecipante text,
  data date,
  durata_minuti int,
  tipo text,
  note text
)
language sql
security definer
set search_path = public
as $$
  select u.codice_partecipante, l.data, l.durata_minuti, l.tipo, l.note
  from log_pratica l
  join utenti u on u.id = l.utente_id
  where is_facilitatore()
    and u.ruolo = 'partecipante';
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
          select jsonb_agg(jsonb_build_object('id', e.id, 'tipo', e.tipo, 'descrizione', e.descrizione))
          from esercizi e where e.lezione_id = l.id
        ), '[]'::jsonb)
      ) order by l.numero_settimana)
      from lezioni l
      where l.ciclo_id = v_ciclo_id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function comunicazioni_del_partecipante(p_codice text)
returns table (
  id uuid,
  tipo text,
  oggetto text,
  testo text,
  data_invio timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_utente_id uuid;
  v_ciclo_id uuid;
begin
  select u.id into v_utente_id
  from utenti u
  where upper(trim(u.codice_partecipante)) = upper(trim(p_codice))
    and u.ruolo = 'partecipante';

  if v_utente_id is null then
    raise exception 'CODICE_NON_TROVATO';
  end if;

  select i.ciclo_id into v_ciclo_id
  from iscrizioni i
  where i.utente_id = v_utente_id
  order by i.data_iscrizione desc
  limit 1;

  return query
  select c.id, c.tipo, c.oggetto, c.testo, c.data_invio
  from comunicazioni c
  where c.ciclo_id = v_ciclo_id
  order by (c.tipo = 'reminder_t3') desc, c.data_invio desc;
end;
$$;

revoke all on function salva_log_pratica(text, date, int, text, text) from public;
revoke all on function programma_del_partecipante(text) from public;
revoke all on function comunicazioni_del_partecipante(text) from public;

grant execute on function salva_log_pratica(text, date, int, text, text) to anon, authenticated;
grant execute on function programma_del_partecipante(text) to anon, authenticated;
grant execute on function comunicazioni_del_partecipante(text) to anon, authenticated;
grant execute on function log_pratica_pseudonimi() to authenticated;
