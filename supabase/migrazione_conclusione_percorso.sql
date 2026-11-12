------------------------------------------------------------------------------
-- Sequenza di conclusione del percorso (12/11/2026)
--
-- Quando la persona arriva al giorno 56 (ultimo giorno della settimana 8)
-- l'app propone quattro passi: congratulazioni, T2, valutazione del percorso,
-- condivisione su WhatsApp del link all'iscrizione.
--
-- 1. T2 si apre il giorno 56: apertura_t2 = il più tardi tra inizio + 55 e
--    data_fine (se il ciclo finisce dopo). Prima: giorno 57.
--    Il giorno 56 il T2 è compilabile ma non blocca ancora Settimana, Storico e
--    Check-in (chi non ha ancora praticato quel giorno può farlo): blocca dal
--    giorno dopo. stato_questionari_del_partecipante restituisce `blocca`.
-- 2. Tabella conclusioni_percorso (una riga per persona) con la valutazione:
--    stelle 1-5, «lo consiglieresti?» (si / forse / no), «cosa ti porti a casa»
--    (testo libero, facoltativo). Nuova categoria di dati: informativa,
--    export e reset aggiornati.
-- 3. RPC: stato_conclusione_del_partecipante, salva_passo_conclusione,
--    salva_valutazione_percorso (partecipante, con p_codice);
--    valutazioni_percorso_pseudonime (facilitatore).
------------------------------------------------------------------------------

-- 1. T2 dal giorno 56 ------------------------------------------------------

create or replace function public.apertura_t2(p_inizio date, p_fine date)
returns date
language sql
immutable
set search_path to 'public'
as $function$
  -- T2 si apre il giorno 56 (inizio + 55), o l'ultimo giorno del ciclo se arriva dopo.
  select case
    when p_inizio is null then p_fine
    else greatest(p_fine, p_inizio + 55)
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
  v_apre_t2 date;
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
        case when i.data_inizio_pratica is not null then i.data_inizio_pratica + 55 else null end
      else case when c.id is null then null else coalesce(c.data_fine, c.data_inizio + 55) end
    end,
    (i.ciclo_id is null and i.modalita_fruizione = 'remoto')
    into v_inizio, v_fine, v_personale
  from iscrizioni i
  left join cicli c on c.id = i.ciclo_id
  where i.utente_id = v_utente_id
  order by i.data_iscrizione desc
  limit 1;

  v_sett := settimana_per_questionari(v_inizio);
  v_rif := coalesce(v_fine, v_inizio + 55);
  v_apre_t2 := apertura_t2(v_inizio, v_fine);

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
      or (v_tp = 'T2' and (v_apre_t2 is null or current_date < v_apre_t2))
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
        when 'T2' then 'Dal giorno 56 a due settimane dopo la fine'
        else 'Da 4 a 8 settimane dopo la fine del percorso'
      end,
      'apre_il', case v_tp when 'T2' then v_apre_t2 when 'T3' then v_rif + 28 end,
      'chiude_il', case v_tp when 'T2' then v_rif + 14 when 'T3' then v_rif + 56 end,
      -- Un momento aperto ferma la pratica; il T2 solo dal giorno dopo l'apertura.
      'blocca', case when v_tp = 'T2' then current_date > v_apre_t2 else true end
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

-- 2. Tabella ---------------------------------------------------------------

create table if not exists public.conclusioni_percorso (
  utente_id uuid primary key references public.utenti(id) on delete cascade,
  iniziata_il timestamptz not null default now(),
  congratulazioni_il timestamptz,
  stelle smallint check (stelle between 1 and 5),
  consiglieresti text check (consiglieresti in ('si', 'forse', 'no')),
  porto_a_casa text check (porto_a_casa is null or char_length(porto_a_casa) <= 1000),
  valutata_il timestamptz,
  condivisione_il timestamptz,
  completata_il timestamptz
);

comment on table public.conclusioni_percorso is
  'Sequenza di fine percorso: passi fatti e valutazione dell''esperienza. Solo via RPC.';

alter table public.conclusioni_percorso enable row level security;
-- Nessuna policy: si legge e si scrive solo con le funzioni qui sotto.

-- 3. RPC del partecipante ---------------------------------------------------

-- Giorno da cui la sequenza è disponibile (lo stesso dell'apertura del T2).
create or replace function public.giorno_conclusione(p_utente_id uuid)
returns date
language sql
stable
security definer
set search_path to 'public'
as $function$
  select apertura_t2(p.inizio, p.fine) from periodo_del_partecipante(p_utente_id) p;
$function$;

revoke all on function public.giorno_conclusione(uuid) from public, anon, authenticated;

create or replace function public.stato_conclusione_del_partecipante(p_codice text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id uuid;
  v_giorno date;
  v_riga conclusioni_percorso%rowtype;
  v_t2 jsonb;
begin
  v_id := assert_partecipante_noto(p_codice);
  v_giorno := giorno_conclusione(v_id);
  select * into v_riga from conclusioni_percorso where utente_id = v_id;

  select tp into v_t2
  from jsonb_array_elements(stato_questionari_del_partecipante(p_codice) -> 'timepoints') tp
  where tp ->> 'id' = 'T2';

  return jsonb_build_object(
    'giorno', v_giorno,
    'disponibile', v_giorno is not null and current_date >= v_giorno,
    't2', coalesce(v_t2 ->> 'stato', 'in_attesa'),
    't2_chiude_il', v_t2 ->> 'chiude_il',
    'congratulazioni', v_riga.congratulazioni_il is not null,
    'valutazione', v_riga.valutata_il is not null,
    'stelle', v_riga.stelle,
    'consiglieresti', v_riga.consiglieresti,
    'porto_a_casa', v_riga.porto_a_casa,
    'condivisione', v_riga.condivisione_il is not null,
    'completata', v_riga.completata_il is not null
  );
end;
$function$;

create or replace function public.salva_passo_conclusione(p_codice text, p_passo text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id uuid;
  v_giorno date;
begin
  v_id := assert_partecipante_noto(p_codice);
  v_giorno := giorno_conclusione(v_id);
  if v_giorno is null or current_date < v_giorno then
    raise exception 'CONCLUSIONE_NON_APERTA';
  end if;
  if p_passo not in ('congratulazioni', 'condivisione', 'completata') then
    raise exception 'PASSO_NON_VALIDO';
  end if;

  insert into conclusioni_percorso (utente_id) values (v_id)
  on conflict (utente_id) do nothing;

  update conclusioni_percorso set
    congratulazioni_il = case when p_passo = 'congratulazioni' then coalesce(congratulazioni_il, now()) else congratulazioni_il end,
    condivisione_il = case when p_passo = 'condivisione' then coalesce(condivisione_il, now()) else condivisione_il end,
    completata_il = case when p_passo = 'completata' then coalesce(completata_il, now()) else completata_il end
  where utente_id = v_id;
end;
$function$;

create or replace function public.salva_valutazione_percorso(
  p_codice text,
  p_stelle int,
  p_consiglieresti text,
  p_porto_a_casa text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id uuid;
  v_giorno date;
  v_testo text := nullif(trim(coalesce(p_porto_a_casa, '')), '');
begin
  v_id := assert_partecipante_noto(p_codice);
  v_giorno := giorno_conclusione(v_id);
  if v_giorno is null or current_date < v_giorno then
    raise exception 'CONCLUSIONE_NON_APERTA';
  end if;
  if p_stelle is null or p_stelle not between 1 and 5 then
    raise exception 'STELLE_NON_VALIDE';
  end if;
  if p_consiglieresti is null or p_consiglieresti not in ('si', 'forse', 'no') then
    raise exception 'CONSIGLIO_NON_VALIDO';
  end if;
  if v_testo is not null and char_length(v_testo) > 1000 then
    raise exception 'TESTO_TROPPO_LUNGO';
  end if;

  insert into conclusioni_percorso (utente_id, stelle, consiglieresti, porto_a_casa, valutata_il)
  values (v_id, p_stelle, p_consiglieresti, v_testo, now())
  on conflict (utente_id) do update set
    stelle = excluded.stelle,
    consiglieresti = excluded.consiglieresti,
    porto_a_casa = excluded.porto_a_casa,
    valutata_il = now();
end;
$function$;

grant execute on function public.stato_conclusione_del_partecipante(text) to anon, authenticated;
grant execute on function public.salva_passo_conclusione(text, text) to anon, authenticated;
grant execute on function public.salva_valutazione_percorso(text, int, text, text) to anon, authenticated;

-- 4. RPC del facilitatore ---------------------------------------------------

create or replace function public.valutazioni_percorso_pseudonime()
returns table (
  codice_partecipante text,
  ciclo_id uuid,
  stelle smallint,
  consiglieresti text,
  porto_a_casa text,
  valutata_il timestamptz,
  condivisione boolean,
  completata boolean
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    u.codice_partecipante,
    (select p.ciclo_id from periodo_del_partecipante(u.id) p),
    k.stelle,
    k.consiglieresti,
    k.porto_a_casa,
    k.valutata_il,
    k.condivisione_il is not null,
    k.completata_il is not null
  from conclusioni_percorso k
  join utenti u on u.id = k.utente_id
  where is_facilitatore()
    and u.ruolo = 'partecipante'
  order by k.valutata_il desc nulls last;
$function$;

revoke all on function public.valutazioni_percorso_pseudonime() from public, anon;
grant execute on function public.valutazioni_percorso_pseudonime() to authenticated;

-- 5. Export e reset dei dati della persona ----------------------------------

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
    )
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
    'conclusione_cancellata', coalesce(v_n_conclusione, 0)
  );
end;
$function$;
