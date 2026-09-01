-- Frase di apertura del sito: una sola riga, lettura pubblica, scrittura solo facilitatore.

create table if not exists splash_sito (
  id smallint primary key default 1 check (id = 1),
  frase text not null,
  cta text not null default 'Prosegui',
  aggiornato_il timestamptz not null default now()
);

insert into splash_sito (id, frase, cta)
values (1, 'La pratica comincia qui, in questo momento.', 'Prosegui')
on conflict (id) do nothing;

alter table splash_sito enable row level security;

drop policy if exists "lettura pubblica splash" on splash_sito;
create policy "lettura pubblica splash" on splash_sito
  for select using (true);

drop policy if exists "facilitatore aggiorna splash" on splash_sito;
create policy "facilitatore aggiorna splash" on splash_sito
  for update using (is_facilitatore()) with check (is_facilitatore());

grant select on splash_sito to anon, authenticated;
grant update on splash_sito to authenticated;
