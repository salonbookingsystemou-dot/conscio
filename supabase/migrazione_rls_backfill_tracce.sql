-- Il report del backfill è rimasto in public senza RLS ed è esposto a PostgREST.
-- Resta consultabile dall'SQL editor; anon e authenticated non lo leggono.

alter table backfill_collegamenti_tracce enable row level security;
revoke all on table backfill_collegamenti_tracce from anon, authenticated, public;
