-- Prova della conferma dell'email (4/11/2026). Da lanciare DOPO migrazione_conferma_email.sql.
-- Non lascia traccia: il blocco finisce sempre con un errore voluto («ESITO_TEST …») e
-- Postgres annulla tutto quello che ha scritto. Il testo dell'errore è il resoconto.
-- Atteso: norm1=abc@gmail.com norm2=mario.rossi+x@libero.it non_confermati_dopo_backfill=0
-- nuovo_non_confermato=true duplicato=EMAIL_GIA_ISCRITTA gmail_dup=EMAIL_GIA_ISCRITTA
-- per_email={…"codice":"MBSR-TESTZZ03","confermata":false,"ha_iscrizione":true} conferma1=true
-- conferma2=false cancellati=1 rimasti=MBSR-TESTZZ01,MBSR-TESTZZ05 iscrizioni_zz03=0 limite_vecchio_tolto=true
do $t$
declare
  r text := '';
  s text;
  v jsonb;
  b boolean;
  n int;
  vid uuid;
begin
  r := r || ' norm1=' || public.normalizza_email('  A.B.c+news@GoogleMail.com ');
  r := r || ' norm2=' || public.normalizza_email('Mario.Rossi+x@Libero.IT');
  select count(*) into n from utenti where email_confermata_il is null;
  r := r || ' non_confermati_dopo_backfill=' || n;
  v := iscrivi_partecipante('prova.conferma@example.com', null, 'MBSR-TESTZZ01', true, false, true);
  select (email_confermata_il is null)::text into s from utenti where codice_partecipante = 'MBSR-TESTZZ01';
  r := r || ' nuovo_non_confermato=' || s;
  begin
    perform iscrivi_partecipante('PROVA.CONFERMA@example.com', null, 'MBSR-TESTZZ02', true, false, true);
    r := r || ' duplicato=NO';
  exception when others then r := r || ' duplicato=' || sqlerrm; end;
  v := iscrivi_partecipante('ab.cd@gmail.com', null, 'MBSR-TESTZZ03', true, false, true);
  begin
    perform iscrivi_partecipante('abcd+spam@googlemail.com', null, 'MBSR-TESTZZ04', true, false, true);
    r := r || ' gmail_dup=NO';
  exception when others then r := r || ' gmail_dup=' || sqlerrm; end;
  select row_to_json(p)::text into s from partecipante_per_email('A.B.C.D@gmail.com') p;
  r := r || ' per_email=' || coalesce(s, 'nessuno');
  b := conferma_email_partecipante('mbsr-testzz01');
  r := r || ' conferma1=' || b;
  b := conferma_email_partecipante('MBSR-TESTZZ01');
  r := r || ' conferma2=' || b;
  update utenti set creato_il = now() - interval '8 days'
    where codice_partecipante in ('MBSR-TESTZZ01', 'MBSR-TESTZZ03');
  v := iscrivi_partecipante('con.log@example.com', null, 'MBSR-TESTZZ05', true, false, true);
  update utenti set creato_il = now() - interval '8 days'
    where codice_partecipante = 'MBSR-TESTZZ05' returning id into vid;
  insert into log_pratica (utente_id, tipo) values (vid, 'informale');
  n := pulisci_iscrizioni_non_confermate();
  r := r || ' cancellati=' || n;
  select string_agg(codice_partecipante, ',' order by codice_partecipante) into s
    from utenti where codice_partecipante like 'MBSR-TESTZZ%';
  r := r || ' rimasti=' || coalesce(s, '');
  select count(*) into n from iscrizioni i join utenti u on u.id = i.utente_id
    where u.codice_partecipante = 'MBSR-TESTZZ03';
  r := r || ' iscrizioni_zz03=' || n;
  insert into limiti_richieste (azione, chiave, n, finestra_inizio) values ('prova_vecchia', 'x', 1, now() - interval '2 days');
  perform pulisci_limiti_richieste();
  r := r || ' limite_vecchio_tolto=' || (not exists (select 1 from limiti_richieste where azione = 'prova_vecchia'));
  raise exception 'ESITO_TEST %', r;
end;
$t$;
