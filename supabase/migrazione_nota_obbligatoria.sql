-- Il log di sessione richiede una nota scritta (o dettata).

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
