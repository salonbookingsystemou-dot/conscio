-- La scelta non resta chiusa nel tema della settimana: con una sola
-- citazione per tema, dal secondo giorno usciva sempre la stessa.
-- Ruota su tutte le citazioni attive, senza ripetere l'ultima inviata.

create or replace function scegli_citazione(
  p_utente_id uuid,
  p_settimana int
)
returns table (
  id uuid,
  author text,
  book_title text,
  quote_text text,
  week_theme int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sett int := greatest(1, least(8, coalesce(p_settimana, 1)));
begin
  return query
  with invii as (
    select l.quote_id, max(l.sent_at) as ultimo_invio
    from quote_sent_log l
    where l.utente_id = p_utente_id
    group by l.quote_id
  ),
  ultima as (
    select l.quote_id
    from quote_sent_log l
    where l.utente_id = p_utente_id
    order by l.sent_at desc
    limit 1
  ),
  attive as (
    select count(*)::int as n
    from quotes
    where active = true
  )
  select q.id, q.author, q.book_title, q.quote_text, q.week_theme
  from quotes q
  left join invii i on i.quote_id = q.id
  cross join attive a
  where q.active = true
    and (
      a.n < 2
      or not exists (
        select 1 from ultima u where u.quote_id = q.id
      )
    )
  order by
    case
      when i.ultimo_invio is null and q.week_theme = v_sett then 0
      when i.ultimo_invio is null then 1
      else 2
    end,
    i.ultimo_invio asc nulls first,
    random()
  limit 1;
end;
$$;
