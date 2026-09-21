-- Citazioni da citazioni_mindfulness.xlsx.
-- week_theme assegnato in ordine (2 per le settimane 1–2, 1 per le 3–8).
-- Per riassegnare: update quotes set week_theme = N where id = '...';

delete from quotes
where quote_text like '[ESEMPIO — sostituire%';

insert into quotes (author, book_title, quote_text, week_theme, language) values
  (
    'Thich Nhat Hanh',
    'La pace è ogni passo. Sentieri di consapevolezza nella vita quotidiana',
    'Il momento presente è pieno di gioia e felicità. Se sei attento, lo vedrai.',
    1, 'it'
  ),
  (
    'Thich Nhat Hanh',
    'Il miracolo della presenza mentale. Un manuale di meditazione',
    'Il respiro è il ponte che collega la vita alla coscienza, che unisce il corpo ai pensieri.',
    1, 'it'
  ),
  (
    'Thich Nhat Hanh',
    'Il miracolo della presenza mentale',
    'Cammina come se stessi baciando la terra con i tuoi piedi.',
    2, 'it'
  ),
  (
    'Thich Nhat Hanh',
    'L''arte di comunicare',
    'La via d''uscita è la via di dentro.',
    2, 'it'
  ),
  (
    'Jon Kabat-Zinn',
    'Dovunque tu vada, ci sei già. Capire la ricchezza del nostro presente',
    'Ovunque tu vada, ci sei già.',
    3, 'it'
  ),
  (
    'Jon Kabat-Zinn',
    'Vivere momento per momento',
    'Non puoi fermare le onde, ma puoi imparare a fare surf.',
    4, 'it'
  ),
  (
    'Jon Kabat-Zinn',
    'Riprendere i sensi',
    'La mindfulness significa essere svegli. Significa sapere cosa stai facendo.',
    5, 'it'
  ),
  (
    'Jon Kabat-Zinn',
    'Dovunque tu vada, ci sei già',
    'La consapevolezza non consiste nel cercare di andare da qualche parte, ma nel permettere a se stessi di essere esattamente dove si è.',
    6, 'it'
  ),
  (
    'Mark Williams',
    'Metodo Mindfulness. 56 giorni alla felicità',
    'La consapevolezza ci permette di catturare i pensieri negativi prima che ci trascinino in una spirale discendente.',
    7, 'it'
  ),
  (
    'Mark Williams',
    'Mindfulness. Al di là del pensiero, attraverso il pensiero',
    'La mindfulness non è una fuga dalla realtà, ma un incontro ravvicinato con essa, guidato dall''amore e dalla compassione.',
    8, 'it'
  );
