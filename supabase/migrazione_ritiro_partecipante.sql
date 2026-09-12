-- Ritiro del partecipante invece della cancellazione definitiva.
-- Conserva i dati di ricerca (questionari PSS-10/FFMQ-I e tono per sessione) e il codice
-- pseudonimo, azzerando i dati personali (email e risposte libere di onboarding).
-- L'iscrizione resta legata al ciclo (marcata 'ritirato'): non occupa un posto e blocca l'accesso.

create or replace function ritira_partecipante(p_codice text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not is_facilitatore() then
    raise exception 'NON_AUTORIZZATO';
  end if;

  select id into v_id
  from utenti
  where upper(trim(codice_partecipante)) = upper(trim(p_codice))
    and ruolo = 'partecipante';

  if v_id is null then
    raise exception 'UTENTE_NON_TROVATO';
  end if;

  -- Anonimizza i dati personali, conserva i dati di ricerca (questionari e tono).
  update utenti
  set email = null,
      onboarding_q1 = null,
      onboarding_q2 = null,
      stato_screening = 'ritirato'
  where id = v_id;

  -- Libera il posto e marca l'iscrizione come ritirata (i dati restano legati al ciclo).
  update iscrizioni
  set esito_screening = 'ritirato'
  where utente_id = v_id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function ritira_partecipante(text) from public;
grant execute on function ritira_partecipante(text) to authenticated;

notify pgrst, 'reload schema';
