-- Esito di ogni segnalazione di problema: l'agente (Cursor) la chiude sempre, con
-- «risolta» (correzione unita su main, link alla pull request) o «non_risolta» (motivo
-- nel riepilogo). Il facilitatore la vede in «Da fare» finché non la archivia.
-- Il facilitatore legge solo testo, pagina, date ed esito: mai codice né email.
-- Esito e link entrano nell'export (stessa categoria di dati: niente da aggiungere
-- all'informativa). Il reset cancella già tutta la riga.

alter table public.segnalazioni_problema
  add column if not exists esito text check (esito in ('risolta', 'non_risolta')),
  add column if not exists pr_url text,
  add column if not exists archiviata_il timestamptz;

-- Le chiusure di prima esistevano solo per le correzioni unite.
update public.segnalazioni_problema
  set esito = 'risolta'
  where chiusa_il is not null and esito is null;

-- Segnalazioni non ancora archiviate, per «Da fare».
create or replace function public.segnalazioni_problema_da_vedere()
returns table (
  id uuid,
  messaggio text,
  pagina text,
  creata_il timestamptz,
  chiusa_il timestamptz,
  esito text,
  riepilogo text,
  pr_url text
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select s.id, s.messaggio, s.pagina, s.creata_il, s.chiusa_il, s.esito, s.riepilogo, s.pr_url
  from segnalazioni_problema s
  where s.archiviata_il is null
    and (is_facilitatore() or auth.role() = 'service_role')
  order by s.creata_il desc;
$function$;

-- Archivia (p_archivia = true) o rimette in «Da fare» (false, per «Annulla»).
create or replace function public.archivia_segnalazione_problema(p_id uuid, p_archivia boolean default true)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not is_facilitatore() then
    raise exception 'NON_AUTORIZZATO';
  end if;

  update segnalazioni_problema
    set archiviata_il = case when p_archivia then now() else null end
    where id = p_id;

  return jsonb_build_object('ok', found);
end;
$function$;

revoke execute on function public.segnalazioni_problema_da_vedere() from public, anon;
revoke execute on function public.archivia_segnalazione_problema(uuid, boolean) from public, anon;
grant execute on function public.segnalazioni_problema_da_vedere() to authenticated, service_role;
grant execute on function public.archivia_segnalazione_problema(uuid, boolean) to authenticated, service_role;

-- Export dei dati del partecipante: ultima versione (migrazione_segnalazioni_problema.sql) + esito e link.
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
    ), '[]'::jsonb)
  );
end;
$function$;

notify pgrst, 'reload schema';
