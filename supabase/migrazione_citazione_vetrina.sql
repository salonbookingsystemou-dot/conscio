-- Citazione in testa a /ascolta: una al giorno, uguale per tutti.
-- La tabella quotes resta chiusa ad anon (serve all'email di incoraggiamento):
-- la vetrina legge solo testo, autore e libro attraverso questa RPC.
-- Eseguire nell'SQL editor. Non tocca scegli_citazione né quote_sent_log.

create or replace function vetrina_citazione()
returns table (author text, book_title text, quote_text text)
language sql
stable
security definer
set search_path = public
as $$
  with attive as (
    select q.author, q.book_title, q.quote_text,
           row_number() over (order by q.id) - 1 as n,
           count(*) over () as totale
    from quotes q
    where q.active = true and q.language = 'it'
  )
  select a.author, a.book_title, a.quote_text
  from attive a
  where exists (select 1 from impostazioni_sito i where i.id = 1 and i.vetrina_attiva)
    and a.n = mod((current_date - date '2026-01-01'), a.totale);
$$;

revoke all on function vetrina_citazione() from public;
grant execute on function vetrina_citazione() to anon, authenticated;
