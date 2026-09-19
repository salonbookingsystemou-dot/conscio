-- Ogni spunta informale lascia un log con minuti, così entra nei conteggi.

create or replace function spunta_informale(
  p_codice text,
  p_esercizio_id uuid,
  p_data date,
  p_fatto boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_utente_id uuid;
  v_giorno date;
  v_durata int;
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
    where e.id = p_esercizio_id
      and e.tipo = 'informale'
      and esercizio_del_percorso(v_utente_id, e.id)
  ) then
    raise exception 'ESERCIZIO_NON_VALIDO';
  end if;

  v_giorno := coalesce(p_data, current_date);
  select greatest(1, coalesce(nullif(e.durata_minuti, 0), 1))
    into v_durata
  from esercizi e
  where e.id = p_esercizio_id;

  if coalesce(p_fatto, false) then
    update log_pratica
    set durata_minuti = coalesce(nullif(durata_minuti, 0), v_durata)
    where utente_id = v_utente_id
      and esercizio_id = p_esercizio_id
      and data = v_giorno
      and tipo = 'informale';

    if not found then
      insert into log_pratica (utente_id, esercizio_id, data, durata_minuti, note, tipo)
      values (v_utente_id, p_esercizio_id, v_giorno, v_durata, null, 'informale');
    end if;
  else
    delete from log_pratica
    where utente_id = v_utente_id
      and esercizio_id = p_esercizio_id
      and data = v_giorno
      and tipo = 'informale';
  end if;

  return jsonb_build_object(
    'ok', true,
    'fatto', coalesce(p_fatto, false),
    'durata_minuti', case when coalesce(p_fatto, false) then v_durata else null end
  );
end;
$$;

update log_pratica
set durata_minuti = 1
where tipo = 'informale'
  and (durata_minuti is null or durata_minuti <= 0);
