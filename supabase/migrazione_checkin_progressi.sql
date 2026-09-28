-- migrazione_checkin_progressi.sql
-- GIÀ APPLICATA in produzione il 28/9/2026 (migrazioni Supabase:
--   dati_progressi_checkin_finestre, restringi_funzioni_facilitatore_checkin,
--   consenso_checkin, esporta_consenso_checkin).
-- Non rieseguire: il file documenta lo stato attuale delle funzioni.

-- Conscio · raccolta dati sui progressi
-- Punti 2 (ora della pratica), 3 (check-in settimanale), 6 (finestre dei questionari)
-- Solo modifiche aggiuntive: nessun dato esistente viene cambiato o cancellato.

------------------------------------------------------------------------------
-- 2. ORA DELLA PRATICA
-- La colonna nasce vuota per le righe già presenti (non inventiamo orari),
-- poi il default registra l'ora esatta di ogni nuova registrazione.
------------------------------------------------------------------------------
alter table public.log_pratica add column if not exists registrato_il timestamptz;
alter table public.log_pratica alter column registrato_il set default now();


------------------------------------------------------------------------------
-- Funzione di supporto: inizio e fine del percorso di un partecipante.
-- Stessa logica già usata da salva_risposte_questionario:
-- ciclo di gruppo, oppure orologio personale per chi segue da remoto senza ciclo.
------------------------------------------------------------------------------
create or replace function public.periodo_del_partecipante(p_utente_id uuid)
returns table (ciclo_id uuid, inizio date, fine date)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    i.ciclo_id,
    case
      when i.ciclo_id is null and i.modalita_fruizione = 'remoto' then i.data_inizio_pratica
      else c.data_inizio
    end,
    case
      when i.ciclo_id is null and i.modalita_fruizione = 'remoto' then
        case when i.data_inizio_pratica is not null then i.data_inizio_pratica + 62 else null end
      else case when c.id is null then null else coalesce(c.data_fine, c.data_inizio + 62) end
    end
  from iscrizioni i
  left join cicli c on c.id = i.ciclo_id
  where i.utente_id = p_utente_id
  order by i.data_iscrizione desc
  limit 1;
$function$;
revoke all on function public.periodo_del_partecipante(uuid) from public, anon, authenticated;


------------------------------------------------------------------------------
-- 3. CHECK-IN SETTIMANALE
------------------------------------------------------------------------------
create table if not exists public.checkin_settimanali (
  id uuid primary key default gen_random_uuid(),
  utente_id uuid not null references public.utenti(id) on delete cascade,
  ciclo_id uuid references public.cicli(id),
  settimana integer not null check (settimana between 1 and 9),
  -- 0 = per niente, 10 = moltissimo
  stress smallint check (stress between 0 and 10),
  -- 0 = pessima, 10 = ottima
  sonno smallint check (sonno between 0 and 10),
  -- Momenti di presenza nella vita quotidiana:
  -- 0 mai · 1 raramente · 2 qualche volta · 3 spesso · 4 molto spesso
  presenza_quotidiana smallint check (presenza_quotidiana between 0 and 4),
  ostacoli text[] not null default '{}'
    check (ostacoli <@ array['tempo','stanchezza','dimenticanza','noia','disagio','altro']::text[]),
  esperienza_difficile boolean,
  -- Nota facoltativa, visibile solo al facilitatore. Mai per la divulgazione.
  nota_difficile text check (nota_difficile is null or char_length(nota_difficile) <= 1000),
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz
);

create unique index if not exists checkin_settimanali_utente_settimana
  on public.checkin_settimanali (utente_id, coalesce(ciclo_id, '00000000-0000-0000-0000-000000000000'::uuid), settimana);

alter table public.checkin_settimanali enable row level security;

-- Come per le altre tabelle: i partecipanti passano solo dalle funzioni,
-- il facilitatore può leggere.
drop policy if exists "facilitatore legge checkin" on public.checkin_settimanali;
create policy "facilitatore legge checkin" on public.checkin_settimanali
  for select using (is_facilitatore());

-- Consenso esplicito e separato al check-in (art. 9 GDPR): i dati raccolti
-- (stress, sonno, esperienze difficili) non sono elencati nel Modulo A.
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


-- Stato del check-in per la settimana corrente (per l'app)
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


-- Salvataggio (crea o aggiorna il check-in della settimana corrente)
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


-- Esperienze difficili ancora da gestire (per il facilitatore e per l'email di avviso)
alter table public.checkin_settimanali add column if not exists segnalazione_gestita_il timestamptz;

create or replace function public.segnalazioni_difficili_aperte()
returns table (checkin_id uuid, codice_partecipante text, settimana int, nota text, creato_il timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select k.id, u.codice_partecipante, k.settimana, k.nota_difficile, k.creato_il
  from checkin_settimanali k
  join utenti u on u.id = k.utente_id
  where k.esperienza_difficile is true
    and k.segnalazione_gestita_il is null
    and (is_facilitatore() or auth.role() = 'service_role')
  order by k.creato_il;
$function$;

-- Il facilitatore segna una segnalazione come gestita (dopo aver contattato la persona)
create or replace function public.segna_segnalazione_gestita(p_checkin_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not is_facilitatore() then
    raise exception 'NON_AUTORIZZATO';
  end if;

  update checkin_settimanali
    set segnalazione_gestita_il = now()
    where id = p_checkin_id
      and esperienza_difficile is true
      and segnalazione_gestita_il is null;

  return jsonb_build_object('ok', found);
end;
$function$;


-- Diritti GDPR: il check-in entra nell'esportazione e nel reset dei dati
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

create or replace function public.resetta_dati_del_partecipante(p_codice text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id uuid;
  v_n_risposte int;
  v_n_log int;
  v_n_checkin int;
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

  delete from checkin_settimanali where utente_id = v_id;
  get diagnostics v_n_checkin = row_count;

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
    'log_cancellati', coalesce(v_n_log, 0),
    'checkin_cancellati', coalesce(v_n_checkin, 0)
  );
end;
$function$;


------------------------------------------------------------------------------
-- 6. FINESTRE DEI QUESTIONARI
-- Problema attuale: T2 richiede settimana 8-9 E data <= fine ciclo.
-- Per il Gruppo pilota (18/9 - 6/11) la settimana 8 inizia proprio il 6/11,
-- quindi T2 resterebbe aperto un solo giorno. T3 invece si apre il giorno dopo
-- la fine e non si chiude mai.
--
-- Nuove finestre:
--   T2: dalla settimana 8 fino a 14 giorni dopo la fine
--   T3 (follow-up): da 4 a 8 settimane dopo la fine
------------------------------------------------------------------------------
create or replace function public.timepoint_in_finestra(p_timepoint text, p_settimana integer, p_inizio date, p_fine date)
returns boolean
language sql
stable
set search_path to 'public'
as $function$
  select case p_timepoint
    when 'T0' then coalesce(p_settimana, 0) <= 1
    when 'T1' then coalesce(p_settimana, 0) between 4 and 5
    when 'T2' then
      coalesce(p_settimana, 0) >= 8
      and current_date <= coalesce(p_fine, p_inizio + 62) + 14
    when 'T3' then
      coalesce(p_fine, p_inizio + 62) is not null
      and current_date between coalesce(p_fine, p_inizio + 62) + 28
                           and coalesce(p_fine, p_inizio + 62) + 56
    else false
  end;
$function$;

create or replace function public.stato_questionari_del_partecipante(p_codice text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_utente_id uuid;
  v_inizio date;
  v_fine date;
  v_sett int;
  v_tp text;
  v_fatti text[] := '{}';
  v_lista jsonb := '[]'::jsonb;
  v_stato text;
  v_personale boolean := false;
  v_rif date;
begin
  select u.id into v_utente_id
  from utenti u
  where upper(trim(u.codice_partecipante)) = upper(trim(p_codice))
    and u.ruolo = 'partecipante';

  if v_utente_id is null then
    raise exception 'CODICE_NON_TROVATO';
  end if;

  select
    case
      when i.ciclo_id is null and i.modalita_fruizione = 'remoto' then i.data_inizio_pratica
      else c.data_inizio
    end,
    case
      when i.ciclo_id is null and i.modalita_fruizione = 'remoto' then
        case when i.data_inizio_pratica is not null then i.data_inizio_pratica + 62 else null end
      else case when c.id is null then null else coalesce(c.data_fine, c.data_inizio + 62) end
    end,
    (i.ciclo_id is null and i.modalita_fruizione = 'remoto')
    into v_inizio, v_fine, v_personale
  from iscrizioni i
  left join cicli c on c.id = i.ciclo_id
  where i.utente_id = v_utente_id
  order by i.data_iscrizione desc
  limit 1;

  v_sett := settimana_per_questionari(v_inizio);
  v_rif := coalesce(v_fine, v_inizio + 62);

  select coalesce(array_agg(distinct r.timepoint), '{}')
    into v_fatti
  from risposte r
  where r.utente_id = v_utente_id;

  foreach v_tp in array array['T0', 'T1', 'T2', 'T3']
  loop
    if v_tp = any (v_fatti) then
      v_stato := 'completato';
    elsif timepoint_in_finestra(v_tp, v_sett, v_inizio, v_fine) then
      v_stato := 'aperto';
    elsif
      (v_tp = 'T1' and v_sett < 4)
      or (v_tp = 'T2' and v_sett < 8)
      or (v_tp = 'T3' and (v_rif is null or current_date < v_rif + 28))
    then
      v_stato := 'in_attesa';
    else
      v_stato := 'chiuso';
    end if;

    v_lista := v_lista || jsonb_build_array(jsonb_build_object(
      'id', v_tp,
      'stato', v_stato,
      'quando', case v_tp
        when 'T0' then 'Dall’iscrizione alla settimana 1'
        when 'T1' then 'Settimane 4 e 5'
        when 'T2' then 'Dalla settimana 8 a due settimane dopo la fine'
        else 'Da 4 a 8 settimane dopo la fine del percorso'
      end,
      'apre_il', case v_tp when 'T3' then v_rif + 28 end,
      'chiude_il', case v_tp when 'T2' then v_rif + 14 when 'T3' then v_rif + 56 end
    ));
  end loop;

  return jsonb_build_object(
    'settimana', v_sett,
    'data_inizio', v_inizio,
    'data_fine', v_fine,
    'orologio_personale', coalesce(v_personale, false),
    'timepoints', v_lista
  );
end;
$function$;


------------------------------------------------------------------------------
-- Le funzioni riservate al facilitatore non sono chiamabili senza login
------------------------------------------------------------------------------
revoke execute on function public.segnalazioni_difficili_aperte() from public, anon;
revoke execute on function public.segna_segnalazione_gestita(uuid) from public, anon;
grant execute on function public.segnalazioni_difficili_aperte() to authenticated, service_role;
grant execute on function public.segna_segnalazione_gestita(uuid) to authenticated, service_role;
