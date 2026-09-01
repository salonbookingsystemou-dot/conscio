-- Date del ciclo per il calendario di pratica (partecipante, solo codice).

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
begin
  select u.id into v_utente_id
  from utenti u
  where upper(trim(u.codice_partecipante)) = upper(trim(p_codice))
    and u.ruolo = 'partecipante';

  if v_utente_id is null then
    raise exception 'CODICE_NON_TROVATO';
  end if;

  select c.data_inizio, coalesce(c.data_fine, c.data_inizio + 62), c.nome_ciclo
    into v_inizio, v_fine, v_nome
  from iscrizioni i
  join cicli c on c.id = i.ciclo_id
  where i.utente_id = v_utente_id
  order by i.data_iscrizione desc
  limit 1;

  if v_inizio is null then
    return jsonb_build_object('nome_ciclo', null, 'data_inizio', null, 'data_fine', null);
  end if;

  return jsonb_build_object(
    'nome_ciclo', v_nome,
    'data_inizio', v_inizio,
    'data_fine', v_fine
  );
end;
$$;

revoke all on function ciclo_del_partecipante(text) from public;
grant execute on function ciclo_del_partecipante(text) to anon, authenticated;
