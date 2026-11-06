------------------------------------------------------------------------------
-- T2 si apre alla fine dell'ottava settimana, non all'inizio (6/11/2026)
--
-- Prima: T2 aperto dal primo giorno della settimana 8. Siccome un questionario
-- aperto e non compilato blocca Settimana, Storico e Check-in, la persona non
-- poteva più praticare nell'ultima settimana (Gruppo pilota 18/9 - 6/11:
-- la settimana 8 coincide con l'ultimo giorno del ciclo).
--
-- Ora: T2 si apre il giorno dopo la fine della pratica, cioè il primo giorno
-- tra  fine del ciclo + 1  e  inizio + 56 (giorno dopo la settimana 8), e resta
-- aperto fino a 14 giorni dopo la fine come prima.
------------------------------------------------------------------------------

create or replace function public.apertura_t2(p_inizio date, p_fine date)
returns date
language sql
immutable
set search_path to 'public'
as $function$
  select case
    when p_inizio is null and p_fine is null then null
    when p_inizio is null then p_fine + 1
    else least(coalesce(p_fine, p_inizio + 62) + 1, p_inizio + 56)
  end;
$function$;

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
      apertura_t2(p_inizio, p_fine) is not null
      and current_date between apertura_t2(p_inizio, p_fine)
                           and coalesce(p_fine, p_inizio + 62) + 14
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
        when 'T2' then 'Dalla fine della settimana 8 a due settimane dopo la fine'
        else 'Da 4 a 8 settimane dopo la fine del percorso'
      end,
      'apre_il', case v_tp when 'T2' then v_apre_t2 when 'T3' then v_rif + 28 end,
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
