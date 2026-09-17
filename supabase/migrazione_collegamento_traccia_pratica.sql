-- Collegamento reale pratica formale ↔ traccia (FK), backfill per nome,
-- e blocco dell'eliminazione se la traccia è ancora usata.
--
-- Non rende traccia_id NOT NULL e non rimuove esercizi.traccia_audio:
-- quelli restano da confermare dopo aver letto il report.
--
-- Report: select * from backfill_collegamenti_tracce;
-- Non risolte: select * from backfill_collegamenti_tracce
--   where esito in ('nessuna_corrispondenza', 'nome_ambiguo');

alter table esercizi add column if not exists traccia_id uuid;

create index if not exists esercizi_traccia_id_idx on esercizi(traccia_id);

drop table if exists backfill_collegamenti_tracce;
create table backfill_collegamenti_tracce (
  esercizio_id uuid primary key,
  tipo text,
  descrizione text,
  traccia_audio_legacy text,
  numero_settimana int,
  ciclo_nome text,
  traccia_id uuid,
  esito text not null,
  creato_il timestamptz not null default now()
);

insert into backfill_collegamenti_tracce (
  esercizio_id, tipo, descrizione, traccia_audio_legacy,
  numero_settimana, ciclo_nome, traccia_id, esito
)
select
  e.id,
  e.tipo,
  e.descrizione,
  e.traccia_audio,
  l.numero_settimana,
  c.nome_ciclo,
  e.traccia_id,
  case
    when e.traccia_id is not null then 'gia_collegata'
    else 'in_attesa'
  end
from esercizi e
left join lezioni l on l.id = e.lezione_id
left join cicli c on c.id = l.ciclo_id
where lower(coalesce(e.tipo, '')) in ('formale', 'a_casa');

-- 1) URL legacy (anche con ?card= o hash), solo se ancora senza FK.
with url_match as (
  select e.id as esercizio_id, t.id as traccia_id
  from esercizi e
  join tracce t
    on regexp_replace(
         split_part(trim(coalesce(e.traccia_audio, '')), '#', 1),
         '[?&]card=[^&]*',
         '',
         'g'
       ) = regexp_replace(
         split_part(trim(coalesce(t.url, '')), '#', 1),
         '[?&]card=[^&]*',
         '',
         'g'
       )
  where e.traccia_id is null
    and lower(coalesce(e.tipo, '')) in ('formale', 'a_casa')
    and nullif(trim(e.traccia_audio), '') is not null
)
update esercizi e
set traccia_id = u.traccia_id
from url_match u
where e.id = u.esercizio_id;

update backfill_collegamenti_tracce b
set traccia_id = e.traccia_id,
    esito = 'collegata_per_url'
from esercizi e
where b.esercizio_id = e.id
  and b.esito = 'in_attesa'
  and e.traccia_id is not null;

-- 2) Nome pratica ↔ titolo traccia (case-insensitive, trim).
--    Un solo titolo corrispondente: collega. Più titoli: non indovinare.
with candidati as (
  select
    e.id as esercizio_id,
    t.id as traccia_id,
    count(*) over (partition by e.id) as n
  from esercizi e
  join tracce t
    on lower(trim(t.titolo)) = lower(trim(e.descrizione))
  where e.traccia_id is null
    and lower(coalesce(e.tipo, '')) in ('formale', 'a_casa')
    and nullif(trim(e.descrizione), '') is not null
)
update esercizi e
set traccia_id = c.traccia_id
from candidati c
where e.id = c.esercizio_id
  and c.n = 1;

update backfill_collegamenti_tracce b
set traccia_id = e.traccia_id,
    esito = 'collegata_per_nome'
from esercizi e
where b.esercizio_id = e.id
  and b.esito = 'in_attesa'
  and e.traccia_id is not null;

update backfill_collegamenti_tracce b
set esito = 'nome_ambiguo'
where b.esito = 'in_attesa'
  and exists (
    select 1
    from tracce t
    where lower(trim(t.titolo)) = lower(trim(coalesce(b.descrizione, '')))
    group by lower(trim(t.titolo))
    having count(*) > 1
  );

update backfill_collegamenti_tracce b
set esito = 'nessuna_corrispondenza'
where b.esito = 'in_attesa';

-- Vincolo: non si elimina una traccia ancora collegata a una pratica.
do $$
declare
  nome text;
begin
  select c.conname into nome
  from pg_constraint c
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
  where c.conrelid = 'esercizi'::regclass
    and c.contype = 'f'
    and a.attname = 'traccia_id'
  limit 1;

  if nome is not null then
    execute format('alter table esercizi drop constraint %I', nome);
  end if;
end $$;

alter table esercizi
  add constraint esercizi_traccia_id_fkey
  foreign key (traccia_id) references tracce(id) on delete restrict;

-- Riepilogo (compare nel SQL editor).
select esito, count(*) as n
from backfill_collegamenti_tracce
group by esito
order by esito;

select
  esercizio_id,
  ciclo_nome,
  numero_settimana,
  descrizione,
  traccia_audio_legacy,
  esito
from backfill_collegamenti_tracce
where esito in ('nessuna_corrispondenza', 'nome_ambiguo')
order by ciclo_nome, numero_settimana, descrizione;
