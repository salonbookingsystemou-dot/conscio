-- migrazione_checkin_storico.sql
-- Proposta, NON ANCORA APPLICATA in produzione (vedi docs/brief_andamento_checkin.md).
-- Aggiunge una RPC di sola lettura per lo storico dei check-in del partecipante
-- (checkin_del_partecipante resta invariata: restituisce solo la settimana corrente).

create or replace function public.checkin_storico_del_partecipante(p_codice text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_utente_id uuid;
  v_consenso timestamptz;
  v_ciclo uuid;
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

  select p.ciclo_id into v_ciclo
  from periodo_del_partecipante(v_utente_id) p;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'settimana', k.settimana,
        'stress', k.stress,
        'sonno', k.sonno,
        'presenza_quotidiana', k.presenza_quotidiana,
        'ostacoli', k.ostacoli,
        'creato_il', k.creato_il
      )
      order by k.settimana
    )
    from checkin_settimanali k
    where k.utente_id = v_utente_id
      and k.ciclo_id is not distinct from v_ciclo
  ), '[]'::jsonb);
end;
$function$;

-- Nota: esperienza_difficile e nota_difficile restano fuori da questa RPC.
-- Sono per il facilitatore, non servono allo storico personale e la nota
-- in particolare non deve tornare al client per nessuna via diversa da
-- quella già prevista (esporta_dati_del_partecipante).
--
-- Nessun grant esplicito: come le altre RPC `security definer` di questo
-- file (checkin_del_partecipante, salva_checkin), resta eseguibile di
-- default — verifica comunque i privilegi effettivi prima di applicare.
