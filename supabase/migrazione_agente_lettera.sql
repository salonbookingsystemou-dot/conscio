-- Agente redazionale della lettera settimanale (docs/brief_agente_lettera.md).
-- Dipende da migrazione_lettera.sql (iscritti_lettera, lettere_inviate).
-- Nessun dato dei partecipanti: fonti, bozze e notizie già viste.
-- Lo script (GitHub Actions) usa il service role; il facilitatore legge e scrive via RLS.

create table if not exists fonti_lettera (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  dominio text not null unique,
  rss text,
  area text not null check (area in ('italia','mondo')),
  tipo text not null check (tipo in ('ricerca','universita','istituzione','divulgazione','eventi')),
  peso int not null default 2 check (peso between 1 and 3),
  attiva boolean not null default true,
  escluso boolean not null default false,
  nota text
);

create table if not exists bozze_lettera (
  id uuid primary key default gen_random_uuid(),
  settimana date not null unique,           -- lunedì della settimana
  oggetto text not null,
  introduzione text,
  voci jsonb not null default '[]'::jsonb,  -- [{ sezione, titolo, sunto, perche_conta, tipo_studio, fonte, data, url, verifica, nota_verifica }]
  pratica_settimana text,                   -- campo libero per Dimitri, l'agente lo lascia vuoto
  meditazione jsonb,                        -- { slug, titolo, descrizione, durata_minuti, autore, voce, miniatura_url, sfondo_url }
  stato text not null default 'da_rivedere'
    check (stato in ('da_rivedere','programmata','bloccata','in_invio','inviata','scartata')),
  invio_previsto_il timestamptz,
  motivo_fermo text,                        -- perché non è partita da sola
  resoconto jsonb,                          -- candidati trovati/scartati, chiamate, costo stimato, errori
  lettera_inviata_id uuid unique references lettere_inviate(id) on delete set null,
  creata_il timestamptz not null default now(),
  aggiornata_il timestamptz not null default now()
);

create table if not exists notizie_lettera (
  url_hash text primary key,                -- sha256 dell'URL normalizzato
  url text not null,
  titolo text,
  fonte text,
  pubblicata_il date,
  esito text not null check (esito in ('usata','scartata')),
  motivo text,
  bozza_id uuid references bozze_lettera(id) on delete set null,
  visto_il timestamptz not null default now()
);

create index if not exists notizie_lettera_visto_il on notizie_lettera (visto_il);

alter table impostazioni_sito add column if not exists invio_automatico boolean not null default true;

-- aggiornata_il segue ogni modifica (anche quelle del facilitatore dalla scheda).
create or replace function tocca_bozza_lettera()
returns trigger
language plpgsql
as $$
begin
  new.aggiornata_il := now();
  return new;
end;
$$;

drop trigger if exists bozze_lettera_aggiornata on bozze_lettera;
create trigger bozze_lettera_aggiornata
  before update on bozze_lettera
  for each row execute function tocca_bozza_lettera();

alter table fonti_lettera enable row level security;
alter table bozze_lettera enable row level security;
alter table notizie_lettera enable row level security;

drop policy if exists "facilitatore gestisce fonti lettera" on fonti_lettera;
create policy "facilitatore gestisce fonti lettera" on fonti_lettera
  for all using (is_facilitatore()) with check (is_facilitatore());

drop policy if exists "facilitatore gestisce bozze lettera" on bozze_lettera;
create policy "facilitatore gestisce bozze lettera" on bozze_lettera
  for all using (is_facilitatore()) with check (is_facilitatore());

drop policy if exists "facilitatore legge notizie lettera" on notizie_lettera;
create policy "facilitatore legge notizie lettera" on notizie_lettera
  for select using (is_facilitatore());

revoke all on fonti_lettera, bozze_lettera, notizie_lettera from anon;
grant select, insert, update, delete on fonti_lettera, bozze_lettera to authenticated;
grant select on notizie_lettera to authenticated;

-- L'interruttore «Invio automatico» si cambia dalla scheda: il facilitatore aggiorna già impostazioni_sito via RLS.

-- Pulizia: le notizie già viste servono solo a non ripetersi. Dopo 6 mesi si tolgono.
create or replace function pulisci_notizie_lettera()
returns int
language sql
security definer
set search_path = public
as $$
  with tolte as (
    delete from notizie_lettera where visto_il < now() - interval '6 months' returning 1
  )
  select count(*)::int from tolte;
$$;

revoke all on function pulisci_notizie_lettera() from public;

-- Fonti iniziali, controllate il 18/10/2026: feed RSS di Mindful.org, Greater Good e ANSA Salute rispondono;
-- quello della Harvard Gazette no (resta la ricerca sul dominio). Lo script le controlla a ogni esecuzione (feed che risponde, dominio raggiungibile)
-- e scrive nel resoconto quelle che non rispondono; il facilitatore le spegne o le corregge dalla scheda.
-- Le università italiane entrano spente: si accendono dopo aver controllato che pubblichino sul tema.
insert into fonti_lettera (nome, dominio, rss, area, tipo, peso, attiva, nota) values
  ('PubMed', 'pubmed.ncbi.nlm.nih.gov', null, 'mondo', 'ricerca', 3, true, 'Interrogata con E-utilities, non con RSS'),
  ('Mindfulness (Springer)', 'link.springer.com', 'https://link.springer.com/search.rss?facet-journal-id=12671', 'mondo', 'ricerca', 3, true, 'Feed da controllare alla prima esecuzione'),
  ('JAMA Network', 'jamanetwork.com', null, 'mondo', 'ricerca', 3, true, 'Ricerca limitata al dominio'),
  ('Nature', 'nature.com', null, 'mondo', 'ricerca', 3, true, 'Ricerca limitata al dominio (anche Scientific Reports)'),
  ('The Lancet', 'thelancet.com', null, 'mondo', 'ricerca', 3, true, 'Ricerca limitata al dominio'),
  ('Cochrane', 'cochrane.org', null, 'mondo', 'ricerca', 3, true, 'Ricerca limitata al dominio'),
  ('Oxford Mindfulness Centre', 'oxfordmindfulness.org', null, 'mondo', 'universita', 3, true, null),
  ('Brown University Mindfulness Center', 'brown.edu', null, 'mondo', 'universita', 3, true, 'Ricerca su brown.edu/public-health/mindfulness'),
  ('UMass Center for Mindfulness', 'umassmed.edu', null, 'mondo', 'universita', 2, true, null),
  ('Center for Healthy Minds', 'centerhealthyminds.org', null, 'mondo', 'universita', 3, true, null),
  ('Greater Good Science Center', 'greatergood.berkeley.edu', 'https://greatergood.berkeley.edu/rss', 'mondo', 'universita', 2, true, null),
  ('Mind & Life Institute', 'mindandlife.org', null, 'mondo', 'istituzione', 2, true, null),
  ('UCLA Mindful Awareness Research Center', 'uclahealth.org', null, 'mondo', 'universita', 2, true, 'Ricerca su uclahealth.org/programs/marc'),
  ('UC San Diego Center for Mindfulness', 'cih.ucsd.edu', null, 'mondo', 'universita', 2, true, null),
  ('Harvard Gazette', 'news.harvard.edu', null, 'mondo', 'universita', 2, true, 'Feed non raggiungibile il 18/10: ricerca limitata al dominio'),
  ('Stanford CCARE', 'ccare.stanford.edu', null, 'mondo', 'universita', 2, true, null),
  ('Bangor University CMRP', 'bangor.ac.uk', null, 'mondo', 'universita', 2, true, 'Centre for Mindfulness Research and Practice'),
  ('University of Exeter', 'exeter.ac.uk', null, 'mondo', 'universita', 2, true, 'Mood Disorders Centre'),
  ('Mindful.org', 'mindful.org', 'https://www.mindful.org/feed/', 'mondo', 'divulgazione', 2, true, null),
  ('The Guardian', 'theguardian.com', null, 'mondo', 'divulgazione', 1, true, 'Ricerca limitata al dominio'),
  ('The New York Times', 'nytimes.com', null, 'mondo', 'divulgazione', 1, true, 'Ricerca limitata al dominio'),
  ('BBC', 'bbc.com', null, 'mondo', 'divulgazione', 1, true, 'Ricerca limitata al dominio'),
  ('Associazione Italiana Mindfulness', 'mindfulnessitalia.it', null, 'italia', 'istituzione', 3, false, 'Dominio non confermato il 18/10: accendere dopo il controllo'),
  ('Istituto Italiano per la Mindfulness', 'iimindfulness.it', null, 'italia', 'istituzione', 3, false, 'Dominio non confermato il 18/10: accendere dopo il controllo'),
  ('ANSA Salute', 'ansa.it', 'https://www.ansa.it/canale_saluteebenessere/notizie/saluteebenessere_rss.xml', 'italia', 'divulgazione', 2, true, null),
  ('Corriere della Sera · Salute', 'corriere.it', null, 'italia', 'divulgazione', 1, true, 'Ricerca limitata al dominio'),
  ('la Repubblica · Salute', 'repubblica.it', null, 'italia', 'divulgazione', 1, true, 'Ricerca limitata al dominio'),
  ('Università di Padova', 'unipd.it', null, 'italia', 'universita', 2, false, 'Da controllare: notizie sul tema'),
  ('Università di Milano-Bicocca', 'unimib.it', null, 'italia', 'universita', 2, false, 'Da controllare: notizie sul tema'),
  ('Sapienza Università di Roma', 'uniroma1.it', null, 'italia', 'universita', 2, false, 'Da controllare: notizie sul tema'),
  ('Università di Torino', 'unito.it', null, 'italia', 'universita', 2, false, 'Da controllare: notizie sul tema'),
  ('Università di Firenze', 'unifi.it', null, 'italia', 'universita', 2, false, 'Da controllare: notizie sul tema'),
  ('Università di Pisa', 'unipi.it', null, 'italia', 'universita', 2, false, 'Da controllare: notizie sul tema'),
  ('Università Cattolica', 'unicatt.it', null, 'italia', 'universita', 2, false, 'Da controllare: notizie sul tema'),
  ('Università di Bologna', 'unibo.it', null, 'italia', 'universita', 2, false, 'Da controllare: notizie sul tema')
on conflict (dominio) do nothing;

notify pgrst, 'reload schema';
