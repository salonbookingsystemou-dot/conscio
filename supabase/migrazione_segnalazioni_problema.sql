-- Segnalazioni di problemi dell'app, collegate al partecipante solo per avvisarlo
-- quando la correzione è online. Il codice e l'email non escono verso l'agente.
-- Export e reset partono dall'ultima versione in migrazione_promemoria_pausa.sql.

create table if not exists public.segnalazioni_problema (
  id uuid primary key default gen_random_uuid(),
  utente_id uuid references public.utenti(id) on delete set null,
  messaggio text not null,
  pagina text,
  token_hash text not null,
  creata_il timestamptz not null default now(),
  avviso_partecipante_il timestamptz,
  chiusa_il timestamptz,
  riepilogo text
);

alter table public.segnalazioni_problema enable row level security;
revoke all on table public.segnalazioni_problema from public, anon, authenticated;

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
        'riepilogo', s.riepilogo
      ) order by s.creata_il desc)
      from segnalazioni_problema s
      where s.utente_id = v_utente.id
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
    'segnalazioni_cancellate', coalesce(v_n_segnalazioni, 0)
  );
end;
$function$;

notify pgrst, 'reload schema';
