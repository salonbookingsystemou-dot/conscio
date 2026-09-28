-- Consenso separato al check-in settimanale ed export del consenso.
-- Già applicata in produzione il 28/9/2026 (migrazioni consenso_checkin e esporta_consenso_checkin).
-- Copiata da supabase_migrations.schema_migrations: non va rieseguita.

-- ----------------------------------------------------------------------------
-- consenso_checkin
-- ----------------------------------------------------------------------------
-- Il check-in settimanale raccoglie dati nuovi (stress, sonno, esperienze difficili)
-- non elencati nel Modulo A: serve un consenso esplicito separato (art. 9 GDPR).

alter table public.utenti add column if not exists consenso_checkin_il timestamptz;

create or replace function public.dai_consenso_checkin(p_codice text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
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

  update utenti
    set consenso_checkin_il = coalesce(consenso_checkin_il, now())
    where id = v_utente_id;

  return jsonb_build_object('ok', true);
end;
$function$;

create or replace function public.checkin_del_partecipante(p_codice text)
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
  v_attuale jsonb;
begin
  select id, consenso_checkin_il into v_utente_id, v_consenso
  from utenti
  where upper(trim(codice_partecipante)) = upper(trim(p_codice))
    and ruolo = 'partecipante';

  if v_utente_id is null then
    raise exception 'CODICE_NON_TROVATO';
  end if;

  select p.ciclo_id, p.inizio, p.fine into v_ciclo, v_inizio, v_fine
  from periodo_del_partecipante(v_utente_id) p;

  v_sett := settimana_per_questionari(v_inizio);

  select to_jsonb(k) - 'utente_id' - 'id' into v_attuale
  from checkin_settimanali k
  where k.utente_id = v_utente_id
    and k.settimana = v_sett
    and k.ciclo_id is not distinct from v_ciclo;

  return jsonb_build_object(
    'settimana', v_sett,
    'aperto', v_sett between 1 and 9 and (v_fine is null or current_date <= v_fine + 7),
    'consenso', v_consenso is not null,
    'compilato', v_attuale is not null,
    'checkin', v_attuale
  );
end;
$function$;

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

  select id into v_id
  from checkin_settimanali
  where utente_id = v_utente_id
    and settimana = v_sett
    and ciclo_id is not distinct from v_ciclo;

  if v_id is null then
    insert into checkin_settimanali (
      utente_id, ciclo_id, settimana, stress, sonno, presenza_quotidiana,
      ostacoli, esperienza_difficile, nota_difficile
    ) values (
      v_utente_id, v_ciclo, v_sett, p_stress, p_sonno, p_presenza_quotidiana,
      coalesce(p_ostacoli, '{}'), p_esperienza_difficile, nullif(trim(p_nota_difficile), '')
    )
    returning id into v_id;
  else
    update checkin_settimanali set
      stress = p_stress,
      sonno = p_sonno,
      presenza_quotidiana = p_presenza_quotidiana,
      ostacoli = coalesce(p_ostacoli, '{}'),
      esperienza_difficile = p_esperienza_difficile,
      nota_difficile = nullif(trim(p_nota_difficile), ''),
      aggiornato_il = now()
    where id = v_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'id', v_id,
    'settimana', v_sett,
    'segnalazione', coalesce(p_esperienza_difficile, false)
  );
end;
$function$;

-- ----------------------------------------------------------------------------
-- esporta_consenso_checkin
-- ----------------------------------------------------------------------------
create or replace function public.esporta_dati_del_partecipante(p_codice text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_utente utenti%rowtype;
begin
  select * into v_utente from utenti where id = assert_partecipante_noto(p_codice);

  return jsonb_build_object(
    'esportato_il', now(),
    'codice', v_utente.codice_partecipante,
    'email', v_utente.email,
    'consenso_modulo_a', v_utente.consenso_modulo_a,
    'consenso_modulo_b', v_utente.consenso_modulo_b,
    'consenso_checkin_il', v_utente.consenso_checkin_il,
    'stato_screening', v_utente.stato_screening,
    'onboarding_completato', v_utente.onboarding_completato,
    'onboarding_q1', v_utente.onboarding_q1,
    'onboarding_q2', v_utente.onboarding_q2,
    'iscrizioni', coalesce((
      select jsonb_agg(jsonb_build_object(
        'ciclo', c.nome_ciclo,
        'data_iscrizione', i.data_iscrizione,
        'esito_screening', i.esito_screening
      ) order by i.data_iscrizione desc)
      from iscrizioni i
      join cicli c on c.id = i.ciclo_id
      where i.utente_id = v_utente.id
    ), '[]'::jsonb),
    'risposte', coalesce((
      select jsonb_agg(jsonb_build_object(
        'timepoint', r.timepoint,
        'questionario', q.nome,
        'ordine', it.ordine,
        'testo', it.testo,
        'valore', r.valore,
        'data_compilazione', r.data_compilazione
      ) order by r.timepoint, q.nome, it.ordine)
      from risposte r
      join item it on it.id = r.item_id
      join questionari q on q.id = it.questionario_id
      where r.utente_id = v_utente.id
    ), '[]'::jsonb),
    'log_pratica', coalesce((
      select jsonb_agg(jsonb_build_object(
        'data', l.data,
        'registrato_il', l.registrato_il,
        'tipo', l.tipo,
        'durata_minuti', l.durata_minuti,
        'note', l.note,
        'tono_prima', l.tono_prima,
        'tono_dopo', l.tono_dopo
      ) order by l.data desc, l.id desc)
      from log_pratica l
      where l.utente_id = v_utente.id
    ), '[]'::jsonb),
    'checkin_settimanali', coalesce((
      select jsonb_agg(jsonb_build_object(
        'settimana', k.settimana,
        'stress', k.stress,
        'sonno', k.sonno,
        'presenza_quotidiana', k.presenza_quotidiana,
        'ostacoli', k.ostacoli,
        'esperienza_difficile', k.esperienza_difficile,
        'nota_difficile', k.nota_difficile,
        'creato_il', k.creato_il
      ) order by k.settimana)
      from checkin_settimanali k
      where k.utente_id = v_utente.id
    ), '[]'::jsonb)
  );
end;
$function$;
