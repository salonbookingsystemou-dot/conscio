------------------------------------------------------------------------------
-- Email «Manca un ultimo passo per chiudere il tuo percorso» (14/11/2026)
--
-- Chi ha passato da due giorni il giorno di conclusione (giorno 56, o fine ciclo
-- se arriva dopo) e non ha concluso la sequenza riceve un'email con il pulsante
-- verso /conclusione. Una sola volta per percorso (riferimento = giorno di
-- conclusione). Oltre 30 giorni dal giorno di conclusione non si scrive più.
-- La data dell'invio entra in informativa, export e reset.
-- Poi: supabase functions deploy promemoria-conclusione --no-verify-jwt
-- Secret già usati dalle altre email: CRON_SECRET, RESEND_API_KEY.
------------------------------------------------------------------------------

create table if not exists public.promemoria_conclusione (
  id uuid primary key default gen_random_uuid(),
  utente_id uuid not null references public.utenti(id) on delete cascade,
  riferimento date not null,
  inviata_il timestamptz not null default now(),
  unique (utente_id, riferimento)
);

alter table public.promemoria_conclusione enable row level security;

drop policy if exists "facilitatore legge promemoria conclusione" on public.promemoria_conclusione;
create policy "facilitatore legge promemoria conclusione" on public.promemoria_conclusione
  for select using (is_facilitatore());

-- t2_da_fare: il T2 manca ed è ancora compilabile; t2_chiude_il serve all'email.
create or replace function public.candidati_promemoria_conclusione()
returns table (
  utente_id uuid,
  email text,
  codice text,
  riferimento date,
  t2_da_fare boolean,
  t2_chiude_il date
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_oggi date := (timezone('Europe/Rome', now()))::date;
begin
  if not (is_facilitatore() or auth.role() = 'service_role') then
    raise exception 'NON_AUTORIZZATO';
  end if;

  return query
  with base as (
    select
      u.id,
      u.email,
      u.codice_partecipante,
      apertura_t2(p.inizio, p.fine) as giorno,
      coalesce(p.fine, p.inizio + 55) + 14 as chiude_t2
    from utenti u
    cross join lateral periodo_del_partecipante(u.id) p
    where u.ruolo = 'partecipante'
      and u.email is not null
      and u.consenso_modulo_a = true
      and u.stato_screening is distinct from 'ritirato'
      and p.inizio is not null
      and exists (
        select 1 from iscrizioni i
        where i.utente_id = u.id
          and (u.stato_screening = 'idoneo' or i.esito_screening = 'idoneo')
          and i.esito_screening is distinct from 'ritirato'
      )
  )
  select
    b.id,
    b.email,
    b.codice_partecipante,
    b.giorno,
    (
      not exists (select 1 from risposte r where r.utente_id = b.id and r.timepoint = 'T2')
      and v_oggi <= b.chiude_t2
    ),
    b.chiude_t2
  from base b
  where b.giorno is not null
    and b.giorno between v_oggi - 30 and v_oggi - 2
    and not exists (
      select 1 from conclusioni_percorso k
      where k.utente_id = b.id and k.completata_il is not null
    )
    and not exists (
      select 1 from promemoria_conclusione n
      where n.utente_id = b.id and n.riferimento = b.giorno
    );
end;
$function$;

revoke all on function public.candidati_promemoria_conclusione() from public, anon;
grant execute on function public.candidati_promemoria_conclusione() to authenticated, service_role;

-- Export e reset: stessa versione di migrazione_conclusione_percorso.sql più
-- promemoria_conclusione.
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
    ), '[]'::jsonb),
    'promemoria_pausa', coalesce((
      select jsonb_agg(jsonb_build_object(
        'riferimento', n.riferimento,
        'inviata_il', n.inviata_il
      ) order by n.inviata_il desc)
      from promemoria_pausa n
      where n.utente_id = v_utente.id
    ), '[]'::jsonb),
    'segnalazioni_problema', coalesce((
      select jsonb_agg(jsonb_build_object(
        'messaggio', s.messaggio,
        'pagina', s.pagina,
        'creata_il', s.creata_il,
        'chiusa_il', s.chiusa_il,
        'esito', s.esito,
        'riepilogo', s.riepilogo,
        'pull_request', s.pr_url
      ) order by s.creata_il desc)
      from segnalazioni_problema s
      where s.utente_id = v_utente.id
    ), '[]'::jsonb),
    'conclusione_percorso', (
      select jsonb_build_object(
        'iniziata_il', k.iniziata_il,
        'stelle', k.stelle,
        'consiglieresti', k.consiglieresti,
        'porto_a_casa', k.porto_a_casa,
        'valutata_il', k.valutata_il,
        'condivisione_il', k.condivisione_il,
        'completata_il', k.completata_il
      )
      from conclusioni_percorso k
      where k.utente_id = v_utente.id
    ),
    'promemoria_conclusione', coalesce((
      select jsonb_agg(jsonb_build_object(
        'riferimento', n.riferimento,
        'inviata_il', n.inviata_il
      ) order by n.inviata_il desc)
      from promemoria_conclusione n
      where n.utente_id = v_utente.id
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
  v_n_pausa int;
  v_n_segnalazioni int;
  v_n_conclusione int;
  v_n_promemoria_conclusione int;
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

  delete from promemoria_pausa where utente_id = v_id;
  get diagnostics v_n_pausa = row_count;

  delete from segnalazioni_problema where utente_id = v_id;
  get diagnostics v_n_segnalazioni = row_count;

  delete from conclusioni_percorso where utente_id = v_id;
  get diagnostics v_n_conclusione = row_count;

  delete from promemoria_conclusione where utente_id = v_id;
  get diagnostics v_n_promemoria_conclusione = row_count;

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
    'checkin_cancellati', coalesce(v_n_checkin, 0),
    'promemoria_pausa_cancellati', coalesce(v_n_pausa, 0),
    'segnalazioni_cancellate', coalesce(v_n_segnalazioni, 0),
    'conclusione_cancellata', coalesce(v_n_conclusione, 0),
    'promemoria_conclusione_cancellati', coalesce(v_n_promemoria_conclusione, 0)
  );
end;
$function$;

notify pgrst, 'reload schema';
