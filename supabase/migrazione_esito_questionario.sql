-- Consente al partecipante di rivedere l’esito di un timepoint già compilato.

create or replace function risposte_questionario_del_partecipante(
  p_codice text,
  p_timepoint text
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

  if not exists (
    select 1
    from utenti u
    left join iscrizioni i on i.utente_id = u.id
    where u.id = v_utente_id
      and (u.stato_screening = 'idoneo' or i.esito_screening = 'idoneo')
  ) then
    raise exception 'ACCESSO_NON_IDONEO';
  end if;

  if p_timepoint is null or p_timepoint not in ('T0', 'T1', 'T2', 'T3') then
    raise exception 'TIMEPOINT_NON_VALIDO';
  end if;

  if not exists (
    select 1 from risposte
    where utente_id = v_utente_id and timepoint = p_timepoint
  ) then
    raise exception 'COMPILAZIONE_ASSENTE';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'item_id', r.item_id,
      'valore', r.valore
    ) order by i.ordine)
    from risposte r
    join item i on i.id = r.item_id
    where r.utente_id = v_utente_id
      and r.timepoint = p_timepoint
  ), '[]'::jsonb);
end;
$$;

revoke all on function risposte_questionario_del_partecipante(text, text) from public;
grant execute on function risposte_questionario_del_partecipante(text, text) to anon, authenticated;
