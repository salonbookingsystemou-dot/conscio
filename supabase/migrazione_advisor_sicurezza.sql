-- Avvisi del Security Advisor che non sono l'accesso voluto dell'app.
-- Il partecipante entra col codice, senza account: quelle funzioni restano
-- eseguibili da anon. Qui si chiudono solo gli accessi non usati dall'app.

alter function settimana_per_questionari(date) set search_path = public;
alter function timepoint_in_finestra(text, integer, date, date) set search_path = public;

revoke all on function settimana_per_questionari(date) from public, anon, authenticated;
revoke all on function timepoint_in_finestra(text, integer, date, date) from public, anon, authenticated;

-- Solo service role (email di fine pratica, ritiro automatico).
revoke all on function calendario_pratica_utente(uuid, date) from public, anon, authenticated;
revoke all on function scegli_citazione(uuid, integer) from public, anon, authenticated;
revoke all on function ritira_inattivo(uuid) from public, anon, authenticated;
grant execute on function calendario_pratica_utente(uuid, date) to service_role;
grant execute on function scegli_citazione(uuid, integer) to service_role;
grant execute on function ritira_inattivo(uuid) to service_role;

-- Chiamate solo da altre funzioni, non dall'API.
revoke all on function assicura_ciclo_contenuto(uuid) from public, anon, authenticated;
revoke all on function avvia_orologio_pratica(uuid, date) from public, anon, authenticated;
revoke all on function esercizio_del_percorso(uuid, uuid) from public, anon, authenticated;
revoke all on function codice_partecipante_valido(text) from public, anon, authenticated;
revoke all on function ha_compilato_timepoint(text, text) from public, anon, authenticated;
revoke all on function partecipante_e_idoneo(text) from public, anon, authenticated;
revoke all on function salva_log_pratica(text, date, integer, text, text, uuid, text, text) from public, anon, authenticated;
revoke all on function elimina_partecipante(text) from public, anon, authenticated;

-- Pannello facilitatore: resta authenticated, non anon.
revoke all on function candidati_inattivita_remoto() from public, anon;
revoke all on function candidati_ritiro_inattivita() from public, anon;
revoke all on function email_destinatari_ciclo(uuid, boolean, boolean) from public, anon;
revoke all on function imposta_esito_screening(uuid, text) from public, anon;
revoke all on function log_pratica_pseudonimi() from public, anon;
revoke all on function risposte_pseudonime() from public, anon;
revoke all on function ritira_partecipante(text) from public, anon;
revoke all on function separa_email_cicli_conclusi(integer) from public, anon;
revoke all on function assegna_iscrizione_a_ciclo(uuid, uuid) from public, anon;
revoke all on function imposta_modalita_fruizione(uuid, text) from public, anon;

grant execute on function candidati_inattivita_remoto() to authenticated, service_role;
grant execute on function candidati_ritiro_inattivita() to authenticated, service_role;
grant execute on function email_destinatari_ciclo(uuid, boolean, boolean) to authenticated;
grant execute on function imposta_esito_screening(uuid, text) to authenticated;
grant execute on function log_pratica_pseudonimi() to authenticated;
grant execute on function risposte_pseudonime() to authenticated;
grant execute on function ritira_partecipante(text) to authenticated;
grant execute on function separa_email_cicli_conclusi(integer) to authenticated;
grant execute on function assegna_iscrizione_a_ciclo(uuid, uuid) to authenticated;
grant execute on function imposta_modalita_fruizione(uuid, text) to authenticated;

-- Ascolto tramite URL pubblico; niente elenco di tutti i file.
drop policy if exists "lettura pubblica tracce" on storage.objects;

notify pgrst, 'reload schema';
