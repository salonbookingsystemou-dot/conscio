-- Il partecipante può azzerare i propri dati di percorso dal codice
-- (questionari, diario, onboarding). Restano codice, email, consensi e iscrizione.

create or replace function resetta_dati_del_partecipante(p_codice text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_n_risposte int;
  v_n_log int;
begin
  if p_codice is null or trim(p_codice) = '' then
    raise exception 'CODICE_MANCANTE';
  end if;

  perform assert_limite(
    'resetta_dati',
    'codice:' || upper(trim(p_codice)),
    3,
    86400
  );

  select id into v_id
  from utenti
  where upper(trim(codice_partecipante)) = upper(trim(p_codice))
    and ruolo = 'partecipante';

  if v_id is null then
    raise exception 'CODICE_NON_TROVATO';
  end if;

  delete from risposte where utente_id = v_id;
  get diagnostics v_n_risposte = row_count;

  delete from log_pratica where utente_id = v_id;
  get diagnostics v_n_log = row_count;

  update utenti
    set
      onboarding_completato = false,
      onboarding_completato_il = null,
      onboarding_q1 = null,
      onboarding_q2 = null
    where id = v_id;

  return jsonb_build_object(
    'ok', true,
    'risposte_cancellate', coalesce(v_n_risposte, 0),
    'log_cancellati', coalesce(v_n_log, 0)
  );
end;
$$;

revoke all on function resetta_dati_del_partecipante(text) from public;
grant execute on function resetta_dati_del_partecipante(text) to anon, authenticated;

notify pgrst, 'reload schema';
