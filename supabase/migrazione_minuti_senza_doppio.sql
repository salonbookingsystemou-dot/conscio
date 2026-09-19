-- La nota del giorno non è una seconda sessione: non deve copiare i minuti
-- già registrati con l’ascolto. Un ascolto per pratica al giorno.

update log_pratica
set durata_minuti = null
where tipo = 'giorno'
  and durata_minuti is not null;

delete from log_pratica a
using log_pratica b
where a.tipo = 'ascolto'
  and b.tipo = 'ascolto'
  and a.utente_id = b.utente_id
  and a.esercizio_id = b.esercizio_id
  and a.data = b.data
  and a.id > b.id;

create unique index if not exists log_pratica_ascolto_unico
  on log_pratica (utente_id, esercizio_id, data)
  where tipo = 'ascolto';

create or replace function salva_annotazione_giorno(
  p_codice text,
  p_data date,
  p_note text,
  p_durata int default null,
  p_tono_dopo text default null,
  p_lezione_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_utente_id uuid;
  v_giorno date;
  v_dopo text;
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

  if p_note is null or trim(p_note) = '' then
    raise exception 'NOTA_MANCANTE';
  end if;

  v_giorno := coalesce(p_data, current_date);
  v_dopo := case
    when p_tono_dopo in ('piacevole', 'neutro', 'spiacevole') then p_tono_dopo
  end;

  select id into v_id
  from log_pratica
  where utente_id = v_utente_id
    and data = v_giorno
    and tipo = 'giorno'
    and esercizio_id is null
  limit 1;

  if v_id is not null then
    update log_pratica
    set note = trim(p_note),
        durata_minuti = null,
        tono_dopo = v_dopo
    where id = v_id;
  else
    insert into log_pratica (utente_id, esercizio_id, data, durata_minuti, note, tipo, tono_dopo)
    values (v_utente_id, null, v_giorno, null, trim(p_note), 'giorno', v_dopo)
    returning id into v_id;
  end if;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;
