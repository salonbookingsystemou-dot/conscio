-- Ascolto tracce formali sul server (sincronizzato tra dispositivi).
-- tipo = 'ascolto' in log_pratica: un record per (utente, esercizio, giorno).

create or replace function registra_ascolto_formale(
  p_codice text,
  p_esercizio_id uuid,
  p_data date,
  p_durata_minuti int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_utente_id uuid;
  v_giorno date;
  v_minuti int;
  v_id uuid;
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

  if not exists (
    select 1
    from esercizi e
    join lezioni l on l.id = e.lezione_id
    join iscrizioni i on i.ciclo_id = l.ciclo_id
    where e.id = p_esercizio_id
      and i.utente_id = v_utente_id
      and e.tipo in ('formale', 'a_casa')
  ) then
    raise exception 'ESERCIZIO_NON_VALIDO';
  end if;

  v_giorno := coalesce(p_data, current_date);
  v_minuti := case
    when p_durata_minuti is not null and p_durata_minuti > 0 then p_durata_minuti
  end;

  select id into v_id
  from log_pratica
  where utente_id = v_utente_id
    and esercizio_id = p_esercizio_id
    and data = v_giorno
    and tipo = 'ascolto'
  limit 1;

  if v_id is not null then
    update log_pratica
    set durata_minuti = coalesce(v_minuti, durata_minuti)
    where id = v_id;
  else
    insert into log_pratica (utente_id, esercizio_id, data, durata_minuti, note, tipo)
    values (v_utente_id, p_esercizio_id, v_giorno, v_minuti, null, 'ascolto')
    returning id into v_id;
  end if;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

create or replace function minuti_ascolto_del_partecipante(p_codice text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_utente_id uuid;
  v_minuti int;
begin
  select id into v_utente_id
  from utenti
  where upper(trim(codice_partecipante)) = upper(trim(p_codice))
    and ruolo = 'partecipante';

  if v_utente_id is null then
    return 0;
  end if;

  select coalesce(sum(greatest(coalesce(durata_minuti, 0), 0)), 0)
    into v_minuti
  from log_pratica
  where utente_id = v_utente_id
    and tipo = 'ascolto';

  return v_minuti;
end;
$$;

revoke all on function registra_ascolto_formale(text, uuid, date, int) from public;
revoke all on function minuti_ascolto_del_partecipante(text) from public;
grant execute on function registra_ascolto_formale(text, uuid, date, int) to anon, authenticated;
grant execute on function minuti_ascolto_del_partecipante(text) to anon, authenticated;

notify pgrst, 'reload schema';
