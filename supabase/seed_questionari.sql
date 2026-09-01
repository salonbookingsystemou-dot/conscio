-- Seed PSS-10 e FFMQ-I.
-- Eseguire dopo schema.sql (progetto nuovo) oppure dopo migrazione_questionari.sql.
-- Idempotente: cancella e ricrea solo gli item di questi due questionari.

insert into questionari (nome, timepoint) values
  ('PSS-10', null),
  ('FFMQ-I', null)
on conflict (nome) do nothing;

-- PSS-10: traduzione italiana di Andrea Fossati (2010), dal file
-- italian_pss_10_with_info.doc fornito per questo progetto.
-- Scoring (Cohen): invertire item 4, 5, 7, 8 (0↔4) e sommare. Range 0–40.
delete from item
where questionario_id = (select id from questionari where nome = 'PSS-10');

insert into item (questionario_id, ordine, testo, scala, inverso, sottoscala)
select q.id, v.ordine, v.testo, 'likert_0_4', v.inverso, v.sottoscala
from questionari q
cross join (values
  (1, $t$Nell'ultimo mese, con che frequenza si è sentito fuori di sé poiché è avvenuto qualcosa di inaspettato?$t$, false, null),
  (2, $t$Nell'ultimo mese, con che frequenza ha avuto la sensazione di non essere in grado di avere controllo sulle cose importanti della sua vita?$t$, false, null),
  (3, $t$Nell'ultimo mese, con che frequenza si è sentito nervoso o "stressato"?$t$, false, null),
  (4, $t$Nell'ultimo mese, con che frequenza si è sentito fiducioso sulla sua capacità di gestire i suoi problemi personali?$t$, true, null),
  (5, $t$Nell'ultimo mese, con che frequenza ha avuto la sensazione che le cose andassero come diceva lei?$t$, true, null),
  (6, $t$Nell'ultimo mese, con che frequenza ha avuto la sensazione di non riuscire a star dietro a tutte le cose che doveva fare?$t$, false, null),
  (7, $t$Nell'ultimo mese, con che frequenza ha avvertito di essere in grado di controllare ciò che la irrita nella sua vita?$t$, true, null),
  (8, $t$Nell'ultimo mese, con che frequenza ha sentito di padroneggiare la situazione?$t$, true, null),
  (9, $t$Nell'ultimo mese, con che frequenza è stato arrabbiato per cose che erano fuori dal suo controllo?$t$, false, null),
  (10, $t$Nell'ultimo mese, con che frequenza ha avuto la sensazione che le difficoltà si stavano accumulando a un punto tale per cui non poteva superarle?$t$, false, null)
) as v(ordine, testo, inverso, sottoscala)
where q.nome = 'PSS-10';

-- FFMQ-I: item italiani forniti da
-- https://pinofiore.altervista.org/fiveFacet/fiveFacet.html
-- Scoring (Baer / Giovannini et al. 2014): scala 1–5, item inversi
-- 3, 5, 8, 10, 12, 13, 14, 16, 17, 18, 22, 23, 25, 28, 30, 34, 35, 38, 39.
-- Subscale: osservare (8), descrivere (8), agire_con_consapevolezza (8),
-- non_giudicare (8), non_reagire (7). Totale = somma delle cinque.
delete from item
where questionario_id = (select id from questionari where nome = 'FFMQ-I');

insert into item (questionario_id, ordine, testo, scala, inverso, sottoscala)
select q.id, v.ordine, v.testo, 'likert_1_5', v.inverso, v.sottoscala
from questionari q
cross join (values
  (1, $t$Quando cammino, noto con proposito le sensazioni del mio corpo che si muove.$t$, false, 'osservare'),
  (2, $t$Sono bravo a trovare le parole per descrivere i miei sentimenti.$t$, false, 'descrivere'),
  (3, $t$Mi critico quando ho emozioni irrazionali o inappropriate.$t$, true, 'non_giudicare'),
  (4, $t$Avverto i miei sentimenti ed emozioni senza dover reagire a loro.$t$, false, 'non_reagire'),
  (5, $t$Quando faccio qualcosa, la mia mente vaga e sono facilmente distratto.$t$, true, 'agire_con_consapevolezza'),
  (6, $t$Quando faccio una doccia o un bagno, sono consapevole delle sensazioni dell'acqua sul mio corpo.$t$, false, 'osservare'),
  (7, $t$Posso facilmente esprimere le mie convinzioni, opinioni e aspettative in parole.$t$, false, 'descrivere'),
  (8, $t$Non presto attenzione a quello che faccio perché sogno ad occhi aperti, mi preoccupo, oppure sono distratto.$t$, true, 'agire_con_consapevolezza'),
  (9, $t$Osservo i miei sentimenti senza perdermi in loro.$t$, false, 'non_reagire'),
  (10, $t$Penso che non dovrei sentirmi così.$t$, true, 'non_giudicare'),
  (11, $t$Noto come cibi e bevande influenzano i miei pensieri, le sensazioni corporee e le emozioni.$t$, false, 'osservare'),
  (12, $t$È difficile per me trovare le parole per descrivere quello che penso.$t$, true, 'descrivere'),
  (13, $t$Sono facilmente distratto.$t$, true, 'agire_con_consapevolezza'),
  (14, $t$Credo che alcuni dei miei pensieri siano anormali o cattivi e non dovrei pensare in questo modo.$t$, true, 'non_giudicare'),
  (15, $t$Presto attenzione alle sensazioni, come il vento nei miei capelli o il sole sulla mia faccia.$t$, false, 'osservare'),
  (16, $t$Ho problemi a pensare alle parole giuste per esprimere ciò che provo.$t$, true, 'descrivere'),
  (17, $t$Esprimo giudizi sul fatto che i miei pensieri possano essere buoni o cattivi.$t$, true, 'non_giudicare'),
  (18, $t$Trovo difficile rimanere concentrato su ciò che sta accadendo nel presente.$t$, true, 'agire_con_consapevolezza'),
  (19, $t$Quando ho pensieri o immagini angoscianti, "faccio un passo indietro" e sono consapevole del pensiero o dell'immagine senza esserne sopraffatto.$t$, false, 'non_reagire'),
  (20, $t$Presto attenzione ai suoni, come gli orologi che ticchettano, il cinguettio degli uccelli o le macchine che passano.$t$, false, 'osservare'),
  (21, $t$In situazioni difficili, posso fermarmi senza reagire immediatamente.$t$, false, 'non_reagire'),
  (22, $t$Quando ho una sensazione nel mio corpo, è difficile per me descriverla perché non riesco a trovare le parole giuste.$t$, true, 'descrivere'),
  (23, $t$Mi sembra di "agire automaticamente" senza molta consapevolezza di ciò che sto facendo.$t$, true, 'agire_con_consapevolezza'),
  (24, $t$Quando ho pensieri o immagini angoscianti, mi sento calmo subito dopo.$t$, false, 'non_reagire'),
  (25, $t$Penso che non dovrei pensare ciò che penso normalmente.$t$, true, 'non_giudicare'),
  (26, $t$Noto gli odori e gli aromi delle cose.$t$, false, 'osservare'),
  (27, $t$Anche quando mi sento terribilmente turbato, posso trovare il modo di esprimerlo.$t$, false, 'descrivere'),
  (28, $t$Passo velocemente da un'attività all'altra senza essere veramente attento ad esse.$t$, true, 'agire_con_consapevolezza'),
  (29, $t$Quando ho pensieri o immagini angoscianti riesco a notarli senza reagire.$t$, false, 'non_reagire'),
  (30, $t$Penso che alcune delle mie emozioni siano cattive o inappropriate e non dovrei avvertirle.$t$, true, 'non_giudicare'),
  (31, $t$Noto gli elementi visivi presenti nell'arte o nella natura, come colori, forme, trame o motivi di luce e ombra.$t$, false, 'osservare'),
  (32, $t$La mia tendenza naturale è di mettere le mie esperienze in parole.$t$, false, 'descrivere'),
  (33, $t$Quando ho pensieri o immagini angoscianti, li noto e li lascio andare.$t$, false, 'non_reagire'),
  (34, $t$Faccio automaticamente lavori o compiti senza essere consapevole di quello che sto facendo.$t$, true, 'agire_con_consapevolezza'),
  (35, $t$Quando ho pensieri o immagini angoscianti, mi giudico buono o cattivo in relazione al contenuto dei pensieri o delle immagini.$t$, true, 'non_giudicare'),
  (36, $t$Presto attenzione a come le mie emozioni influenzano i miei pensieri e il mio comportamento.$t$, false, 'osservare'),
  (37, $t$Di solito riesco a descrivere con molti dettagli come mi sento al momento.$t$, false, 'descrivere'),
  (38, $t$Mi trovo a fare le cose senza prestare attenzione.$t$, true, 'agire_con_consapevolezza'),
  (39, $t$Disapprovo me stesso quando ho idee irrazionali.$t$, true, 'non_giudicare')
) as v(ordine, testo, inverso, sottoscala)
where q.nome = 'FFMQ-I';
