-- Le informali si contano per spunte, non per minuti.

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

  if coalesce(p_fatto, false) then
    if not exists (
      select 1
      from log_pratica
      where utente_id = v_utente_id
        and esercizio_id = p_esercizio_id
        and data = v_giorno
        and tipo = 'informale'
    ) then
      insert into log_pratica (utente_id, esercizio_id, data, durata_minuti, note, tipo)
      values (v_utente_id, p_esercizio_id, v_giorno, null, null, 'informale');
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
    'fatto', coalesce(p_fatto, false)
  );
end;
$$;

update log_pratica
set durata_minuti = null
where tipo = 'informale'
  and durata_minuti is not null;
