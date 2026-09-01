-- Chiude gli insert pubblici e applica il tetto posti.
-- Poi crea il ciclo pilota e le 8 settimane + giornata intensiva.

drop policy if exists "iscrizione pubblica" on utenti;
drop policy if exists "iscrizione pubblica ciclo" on iscrizioni;

create or replace function iscrivi_partecipante(
  p_email text,
  p_ciclo_id uuid,
  p_codice text,
  p_consenso_a boolean,
  p_consenso_b boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_utente_id uuid;
  v_posti int;
  v_iscritti int;
begin
  if coalesce(p_consenso_a, false) is not true then
    raise exception 'CONSENSO_A_OBBLIGATORIO';
  end if;

  if p_email is null or trim(p_email) = '' then
    raise exception 'EMAIL_MANCANTE';
  end if;

  if p_codice is null or trim(p_codice) = '' then
    raise exception 'CODICE_MANCANTE';
  end if;

  perform 1 from cicli where id = p_ciclo_id and stato = 'reclutamento' for update;
  if not found then
    raise exception 'CICLO_NON_DISPONIBILE';
  end if;

  select posti_totali into v_posti from cicli where id = p_ciclo_id;
  select count(*) into v_iscritti from iscrizioni where ciclo_id = p_ciclo_id;

  if v_iscritti >= coalesce(v_posti, 0) then
    raise exception 'CICLO_PIENO';
  end if;

  if exists (
    select 1
    from utenti u
    join iscrizioni i on i.utente_id = u.id
    where i.ciclo_id = p_ciclo_id
      and lower(trim(u.email)) = lower(trim(p_email))
  ) then
    raise exception 'EMAIL_GIA_ISCRITTA';
  end if;

  insert into utenti (
    codice_partecipante, email, ruolo, stato_screening,
    consenso_modulo_a, consenso_modulo_b
  ) values (
    trim(p_codice), trim(p_email), 'partecipante', 'in_valutazione',
    true, coalesce(p_consenso_b, false)
  ) returning id into v_utente_id;

  insert into iscrizioni (utente_id, ciclo_id, esito_screening)
  values (v_utente_id, p_ciclo_id, 'in_attesa');

  return jsonb_build_object('ok', true, 'codice', trim(p_codice));
exception
  when unique_violation then
    raise exception 'CODICE_DUPLICATO';
end;
$$;

revoke all on function iscrivi_partecipante(text, uuid, text, boolean, boolean) from public;
grant execute on function iscrivi_partecipante(text, uuid, text, boolean, boolean) to anon, authenticated;

insert into cicli (nome_ciclo, data_inizio, data_fine, stato, posti_totali)
select 'Ciclo pilota', '2026-09-15', '2026-11-10', 'reclutamento', 8
where not exists (select 1 from cicli where nome_ciclo = 'Ciclo pilota');

insert into lezioni (ciclo_id, numero_settimana, tema, pratiche_formali, pratiche_informali, materiali)
select c.id, v.numero_settimana, v.tema, v.pratiche_formali, v.pratiche_informali, v.materiali
from cicli c
cross join (values
  (1, 'Autopilota e body scan',
   'Body scan guidato.',
   'Portare attenzione a un’attività quotidiana (es. lavarsi i denti, fare il caffè).',
   'Registrazione body scan, se disponibile.'),
  (2, 'Gestire gli ostacoli',
   'Body scan; breve pratica seduta sul respiro.',
   'Pausa consapevole in un momento di difficoltà o fretta.',
   NULL),
  (3, 'Respiro e movimento consapevole',
   'Yoga consapevole o stretching lento; pratica seduta.',
   'Camminata consapevole per qualche minuto.',
   NULL),
  (4, 'Restare presenti nello stress',
   'Pratica seduta più lunga; body scan.',
   'Notare i segnali del corpo quando arriva pressione o urgenza.',
   NULL),
  (5, 'Permettere e accettare',
   'Pratica seduta con ciò che è presente, senza spingere via.',
   'Un momento al giorno in cui si lascia spazio a un’emozione, senza agire subito.',
   NULL),
  (6, 'I pensieri non sono fatti',
   'Pratica seduta: osservare i pensieri che vanno e vengono.',
   'Quando un pensiero si ripete, nominarlo in silenzio («pianificazione», «giudizio») e tornare al respiro.',
   NULL),
  (7, 'Prendersi cura di sé',
   'Combinazione di pratiche già incontrate, scelta in autonomia.',
   'Una piccola azione concreta che sostiene la pratica (orario, luogo, promemoria).',
   NULL),
  (8, 'Cosa resta della pratica',
   'Pratica seduta; ripresa del body scan.',
   'Scrivere come si intende continuare dopo le otto settimane.',
   NULL),
  (9, 'Giornata intensiva',
   'Sequenza di body scan, seduta, movimento e camminata, in silenzio.',
   'Pasti e pause in consapevolezza.',
   'Si svolge di solito intorno alla sesta settimana.')
) as v(numero_settimana, tema, pratiche_formali, pratiche_informali, materiali)
where c.nome_ciclo = 'Ciclo pilota'
  and not exists (
    select 1 from lezioni l
    where l.ciclo_id = c.id and l.numero_settimana = v.numero_settimana
  );

insert into esercizi (lezione_id, tipo, descrizione)
select l.id, 'a_casa',
  case l.numero_settimana
    when 1 then 'Body scan almeno 6 giorni su 7.'
    when 2 then 'Body scan e 10–15 minuti di respiro, a giorni alterni.'
    when 3 then 'Movimento consapevole e pratica seduta, a giorni alterni.'
    when 4 then 'Pratica formale quotidiana; annotare un momento di stress.'
    when 5 then 'Pratica seduta quotidiana.'
    when 6 then 'Pratica seduta quotidiana; notare i pensieri ricorrenti.'
    when 7 then 'Scegliere e mantenere una pratica formale ogni giorno.'
    when 8 then 'Pratica formale e nota su come continuare.'
    when 9 then 'Partecipare alla giornata intensiva, se prevista.'
  end
from lezioni l
join cicli c on c.id = l.ciclo_id
where c.nome_ciclo = 'Ciclo pilota'
  and not exists (select 1 from esercizi e where e.lezione_id = l.id);
