-- Conscio · il check-in settimanale, una volta registrato, non si modifica più.
-- Parte da salva_checkin di migrazione_checkin_progressi.sql: stesse verifiche,
-- ma se la settimana ha già un check-in rifiuta con CHECKIN_GIA_COMPILATO invece di aggiornarlo.
-- Nessun dato esistente viene cambiato.

create or replace function public.salva_checkin(
  p_codice text,
  p_stress integer,
  p_sonno integer,
  p_presenza_quotidiana integer,
  p_ostacoli text[] default '{}',
  p_esperienza_difficile boolean default null,
  p_nota_difficile text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_utente_id uuid;
  v_consenso timestamptz;
  v_ciclo uuid;
  v_inizio date;
  v_fine date;
  v_sett int;
  v_id uuid;
begin
  select id, consenso_checkin_il into v_utente_id, v_consenso
  from utenti
  where upper(trim(codice_partecipante)) = upper(trim(p_codice))
    and ruolo = 'partecipante';

  if v_utente_id is null then
    raise exception 'CODICE_NON_TROVATO';
  end if;

  if v_consenso is null then
    raise exception 'CONSENSO_CHECKIN_MANCANTE';
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

  perform assert_limite('salva_checkin', 'utente:' || v_utente_id::text, 30, 3600);

  select p.ciclo_id, p.inizio, p.fine into v_ciclo, v_inizio, v_fine
  from periodo_del_partecipante(v_utente_id) p;

  v_sett := settimana_per_questionari(v_inizio);

  if v_sett < 1 or (v_fine is not null and current_date > v_fine + 7) then
    raise exception 'CHECKIN_NON_APERTO';
  end if;

  if exists (
    select 1
    from checkin_settimanali
    where utente_id = v_utente_id
      and settimana = v_sett
      and ciclo_id is not distinct from v_ciclo
  ) then
    raise exception 'CHECKIN_GIA_COMPILATO';
  end if;

  -- L'indice unico su (utente, ciclo, settimana) blocca anche due invii contemporanei.
  insert into checkin_settimanali (
    utente_id, ciclo_id, settimana, stress, sonno, presenza_quotidiana,
    ostacoli, esperienza_difficile, nota_difficile
  ) values (
    v_utente_id, v_ciclo, v_sett, p_stress, p_sonno, p_presenza_quotidiana,
    coalesce(p_ostacoli, '{}'), p_esperienza_difficile, nullif(trim(p_nota_difficile), '')
  )
  returning id into v_id;

  return jsonb_build_object(
    'ok', true,
    'id', v_id,
    'settimana', v_sett,
    'segnalazione', coalesce(p_esperienza_difficile, false)
  );
exception
  when unique_violation then
    raise exception 'CHECKIN_GIA_COMPILATO';
end;
$function$;

notify pgrst, 'reload schema';
