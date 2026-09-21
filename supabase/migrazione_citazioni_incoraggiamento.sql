-- Email di incoraggiamento con citazione, dopo «Registra la pratica di oggi».
-- Trigger: INSERT su log_pratica con tipo = 'giorno' (salva_annotazione_giorno).
-- Eseguire nell'SQL editor. Poi:
--   supabase functions deploy invia-incoraggiamento-pratica --no-verify-jwt
-- Secret: RESEND_API_KEY, opzionale RESEND_FROM o EMAIL_FROM, ENCOURAGEMENT_SECRET.
--
-- Webhook (Dashboard Supabase → Database → Webhooks):
--   Tabella: public.log_pratica
--   Eventi: INSERT
--   URL: https://<ref>.supabase.co/functions/v1/invia-incoraggiamento-pratica
--   Header: x-webhook-secret = valore di ENCOURAGEMENT_SECRET
--   Header: Content-Type = application/json
-- La funzione ignora gli insert che non sono tipo = 'giorno'.

create table if not exists quotes (
  id uuid primary key default gen_random_uuid(),
  author text not null,
  book_title text not null,
  quote_text text not null,
  week_theme int not null check (week_theme between 1 and 8),
  language text not null default 'it',
  active boolean not null default true,
  created_at timestamptz default now()
);

create table if not exists quote_sent_log (
  id uuid primary key default gen_random_uuid(),
  utente_id uuid not null references utenti(id) on delete cascade,
  quote_id uuid not null references quotes(id) on delete cascade,
  week_number int not null check (week_number between 1 and 8),
  practice_date date not null default current_date,
  sent_at timestamptz default now(),
  unique (utente_id, practice_date)
);

create index if not exists idx_quote_sent_log_participant_week
  on quote_sent_log (utente_id, week_number, sent_at);

create index if not exists idx_quotes_week_active
  on quotes (week_theme, active);

alter table quotes enable row level security;
alter table quote_sent_log enable row level security;

revoke all on table quotes from anon, authenticated, public;
revoke all on table quote_sent_log from anon, authenticated, public;
grant all on table quotes to service_role;
grant all on table quote_sent_log to service_role;

-- Giorno 1–56 e settimana 1–8, stessa ancora usata da ciclo_del_partecipante.
create or replace function calendario_pratica_utente(
  p_utente_id uuid,
  p_giorno date default current_date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_inizio date;
  v_giorno date := coalesce(p_giorno, current_date);
  v_delta int;
begin
  select
    case
      when i.ciclo_id is null and i.modalita_fruizione = 'remoto'
        then coalesce(i.data_inizio_pratica, v_giorno)
      else c.data_inizio
    end
    into v_inizio
  from iscrizioni i
  left join cicli c on c.id = i.ciclo_id
  where i.utente_id = p_utente_id
  order by i.data_iscrizione desc
  limit 1;

  if v_inizio is null then
    v_inizio := v_giorno;
  end if;

  v_delta := v_giorno - v_inizio;

  return jsonb_build_object(
    'data_inizio', v_inizio,
    'giorno_percorso', greatest(1, least(56, v_delta + 1)),
    'settimana', greatest(1, least(8, (v_delta / 7) + 1))
  );
end;
$$;

-- Una citazione del tema, mai ripetuta nella stessa settimana; se finite, la meno recente.
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
  with inedite as (
    select q.id, q.author, q.book_title, q.quote_text, q.week_theme
    from quotes q
    where q.week_theme = v_sett
      and q.active = true
      and not exists (
        select 1
        from quote_sent_log l
        where l.quote_id = q.id
          and l.utente_id = p_utente_id
          and l.week_number = v_sett
      )
    order by random()
    limit 1
  ),
  riuso as (
    select q.id, q.author, q.book_title, q.quote_text, q.week_theme
    from quotes q
    join (
      select l.quote_id, max(l.sent_at) as ultimo_invio
      from quote_sent_log l
      where l.utente_id = p_utente_id
        and l.week_number = v_sett
      group by l.quote_id
    ) l on l.quote_id = q.id
    where q.week_theme = v_sett
      and q.active = true
      and not exists (select 1 from inedite)
    order by l.ultimo_invio asc
    limit 1
  )
  select i.id, i.author, i.book_title, i.quote_text, i.week_theme from inedite i
  union all
  select r.id, r.author, r.book_title, r.quote_text, r.week_theme from riuso r
  limit 1;
end;
$$;

revoke all on function calendario_pratica_utente(uuid, date) from public;
revoke all on function scegli_citazione(uuid, int) from public;
grant execute on function calendario_pratica_utente(uuid, date) to service_role;
grant execute on function scegli_citazione(uuid, int) to service_role;

insert into quotes (author, book_title, quote_text, week_theme, language)
select
  '[Autore esempio]',
  '[Titolo esempio]',
  '[ESEMPIO — sostituire con citazione reale] La pratica si costruisce un giorno alla volta.',
  1,
  'it'
where not exists (
  select 1 from quotes where quote_text like '[ESEMPIO — sostituire%'
);

insert into quotes (author, book_title, quote_text, week_theme, language)
select
  '[Autore esempio]',
  '[Titolo esempio]',
  '[ESEMPIO — sostituire con citazione reale] Tornare al respiro, ancora, senza fretta.',
  1,
  'it'
where (select count(*) from quotes where quote_text like '[ESEMPIO — sostituire%') < 2;
