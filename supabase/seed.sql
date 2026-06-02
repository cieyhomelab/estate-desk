-- Seed: 20 testowych ogłoszeń EstateDesk
-- Zamień wartość _uid na rzeczywiste auth.users.id zalogowanego agenta.
-- Trigger seed_listing_documents_on_insert automatycznie doda domyślną checklistę.
--
-- Użycie w Supabase Studio:
--   SQL Editor → wklej, zmień _uid, uruchom
-- Użycie przez CLI:
--   supabase db execute --file supabase/seed.sql

DO $$
DECLARE
  _uid uuid := 'REPLACE-WITH-USER-ID'; -- ← wstaw auth.users.id

  ids uuid[] := ARRAY[
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()
  ];
BEGIN

  -- -------------------------------------------------------------------------
  -- listings (20 wierszy)
  -- [1..12]  sprzedaż aktywna
  -- [13..14] sprzedaż zamknięta (status = 'done')
  -- [15..18] najem okazjonalny aktywny
  -- [19..20] najem okazjonalny zamknięty (status = 'done')
  -- -------------------------------------------------------------------------
  INSERT INTO public.listings (
    id, user_id, type, status,
    address, owner_name, owner_phone, owner_email,
    asking_price, commission_percent, checklist_override,
    notary_name, notary_city, transaction_date, transaction_notes, closed_at,
    created_at, updated_at
  ) VALUES
    -- 1
    (ids[1],  _uid, 'sale', 'active',
     'ul. Puławska 18/4, 02-512 Warszawa (Mokotów)',
     'Jan Kowalski',        '+48 601 234 567', 'jan.kowalski@example.com',
     850000.00, 2.50, false, null, null, null, null, null,
     now() - interval '45 days', now() - interval '45 days'),

    -- 2
    (ids[2],  _uid, 'sale', 'active',
     'ul. Kasprzaka 29/11, 01-234 Warszawa (Wola)',
     'Anna Wiśniewska',     '+48 602 345 678', 'anna.wisniewska@example.com',
     520000.00, 2.00, false, null, null, null, null, null,
     now() - interval '38 days', now() - interval '38 days'),

    -- 3
    (ids[3],  _uid, 'sale', 'active',
     'ul. Fieldorfa 7, 30-046 Kraków (Bronowice)',
     'Piotr Nowak',         '+48 603 456 789', 'piotr.nowak@example.com',
     1200000.00, 2.00, false, null, null, null, null, null,
     now() - interval '30 days', now() - interval '30 days'),

    -- 4
    (ids[4],  _uid, 'sale', 'active',
     'ul. Ślężna 140/3, 53-111 Wrocław (Krzyki)',
     'Maria Zielińska',     '+48 604 567 890', 'maria.zielinska@example.com',
     620000.00, 2.50, false, null, null, null, null, null,
     now() - interval '25 days', now() - interval '25 days'),

    -- 5
    (ids[5],  _uid, 'sale', 'active',
     'ul. Trakt Św. Wojciecha 220, 80-001 Gdańsk (Kokoszki)',
     'Tomasz Wójcik',       '+48 605 678 901', 'tomasz.wojcik@example.com',
     380000.00, 3.00, false, null, null, null, null, null,
     now() - interval '20 days', now() - interval '20 days'),

    -- 6
    (ids[6],  _uid, 'sale', 'active',
     'ul. Głogowska 55/8, 60-702 Poznań (Grunwald)',
     'Katarzyna Kowalczyk', '+48 606 789 012', 'k.kowalczyk@example.com',
     780000.00, 2.00, false, null, null, null, null, null,
     now() - interval '18 days', now() - interval '18 days'),

    -- 7
    (ids[7],  _uid, 'sale', 'active',
     'ul. Złota 44/12A, 00-120 Warszawa (Śródmieście)',
     'Marek Lewandowski',   '+48 607 890 123', 'marek.lewandowski@example.com',
     2100000.00, 1.50, false, null, null, null, null, null,
     now() - interval '15 days', now() - interval '15 days'),

    -- 8
    (ids[8],  _uid, 'sale', 'active',
     'al. Kościuszki 78/5, 90-441 Łódź (Śródmieście)',
     'Agnieszka Kamińska',  '+48 608 901 234', 'a.kaminska@example.com',
     410000.00, 3.00, false, null, null, null, null, null,
     now() - interval '14 days', now() - interval '14 days'),

    -- 9
    (ids[9],  _uid, 'sale', 'active',
     'ul. Kobierzyńska 153, 30-382 Kraków (Krowodrza)',
     'Robert Dąbrowski',    '+48 609 012 345', 'r.dabrowski@example.com',
     950000.00, 2.50, false, null, null, null, null, null,
     now() - interval '12 days', now() - interval '12 days'),

    -- 10
    (ids[10], _uid, 'sale', 'active',
     'ul. Orłowska 12/2, 81-522 Gdynia (Orłowo)',
     'Joanna Mazur',        '+48 510 123 456', 'joanna.mazur@example.com',
     720000.00, 2.00, false, null, null, null, null, null,
     now() - interval '10 days', now() - interval '10 days'),

    -- 11
    (ids[11], _uid, 'sale', 'active',
     'ul. Nabycińska 21/9, 53-677 Wrocław (Fabryczna)',
     'Michał Szymański',    '+48 511 234 567', 'm.szymanski@example.com',
     390000.00, 3.00, false, null, null, null, null, null,
     now() - interval '7 days', now() - interval '7 days'),

    -- 12
    (ids[12], _uid, 'sale', 'active',
     'ul. Sarmacka 5/6, 02-972 Warszawa (Wilanów)',
     'Ewa Wojciechowska',   '+48 512 345 678', 'ewa.wojciechowska@example.com',
     1850000.00, 1.50, false, null, null, null, null, null,
     now() - interval '5 days', now() - interval '5 days'),

    -- 13 (sprzedaż zamknięta)
    (ids[13], _uid, 'sale', 'done',
     'ul. Praska 23/1, 30-328 Kraków (Dębniki)',
     'Krzysztof Kubiak',    '+48 513 456 789', 'k.kubiak@example.com',
     680000.00, 2.50, true,
     'Marta Jankowska', 'Kraków', '2026-05-20',
     'Transakcja przebiegła sprawnie. Klient uiścił całość ceny w dniu podpisania.',
     now() - interval '13 days',
     now() - interval '60 days', now() - interval '13 days'),

    -- 14 (sprzedaż zamknięta)
    (ids[14], _uid, 'sale', 'done',
     'ul. Półwiejska 38/7, 61-888 Poznań (Stare Miasto)',
     'Natalia Woźniak',     '+48 514 567 890', 'n.wozniak@example.com',
     540000.00, 2.00, true,
     'Zbigniew Pawlik', 'Poznań', '2026-05-15',
     'Kupujący finansowany kredytem hipotecznym BNP Paribas. Wypłata po wpisie hipoteki.',
     now() - interval '18 days',
     now() - interval '70 days', now() - interval '18 days'),

    -- 15 (najem aktywny)
    (ids[15], _uid, 'occasional-rental', 'active',
     'ul. Grochowska 187/4, 04-357 Warszawa (Praga Południe)',
     'Adam Kaczmarek',      '+48 515 678 901', 'adam.kaczmarek@example.com',
     3800.00, null, false, null, null, null, null, null,
     now() - interval '22 days', now() - interval '22 days'),

    -- 16 (najem aktywny)
    (ids[16], _uid, 'occasional-rental', 'active',
     'ul. Józefa 14/3, 31-056 Kraków (Kazimierz)',
     'Monika Piotrowska',   '+48 516 789 012', 'm.piotrowska@example.com',
     2900.00, null, false, null, null, null, null, null,
     now() - interval '17 days', now() - interval '17 days'),

    -- 17 (najem aktywny)
    (ids[17], _uid, 'occasional-rental', 'active',
     'ul. Świdnicka 32/8, 50-068 Wrocław (Stare Miasto)',
     'Paweł Grabowski',     '+48 517 890 123', 'p.grabowski@example.com',
     4500.00, null, false, null, null, null, null, null,
     now() - interval '11 days', now() - interval '11 days'),

    -- 18 (najem aktywny)
    (ids[18], _uid, 'occasional-rental', 'active',
     'ul. Grunwaldzka 112/6, 80-244 Gdańsk (Wrzeszcz)',
     'Karolina Michalak',   '+48 518 901 234', 'k.michalak@example.com',
     3200.00, null, false, null, null, null, null, null,
     now() - interval '8 days', now() - interval '8 days'),

    -- 19 (najem zamknięty)
    (ids[19], _uid, 'occasional-rental', 'done',
     'ul. Romualda Traugutta 5/2, 02-786 Warszawa (Ursynów)',
     'Łukasz Pawlak',       '+48 519 012 345', 'l.pawlak@example.com',
     2600.00, null, true, null, null, '2026-05-10',
     'Umowa podpisana na 12 miesięcy. Kaucja 2 × czynsz przekazana właścicielowi.',
     now() - interval '23 days',
     now() - interval '50 days', now() - interval '23 days'),

    -- 20 (najem zamknięty)
    (ids[20], _uid, 'occasional-rental', 'done',
     'ul. Dąbrowskiego 15/5, 60-839 Poznań (Jeżyce)',
     'Aleksandra Krawczyk', '+48 520 123 456', 'a.krawczyk@example.com',
     3900.00, null, true, null, null, '2026-05-05',
     'Najem okazjonalny – akt notarialny sporządzony u notariusza w Poznaniu.',
     now() - interval '28 days',
     now() - interval '55 days', now() - interval '28 days');


  -- -------------------------------------------------------------------------
  -- price_history
  -- Każde ogłoszenie sprzedaży ma ≥1 wpis; najem ma 1 (czynsz = asking_price).
  -- Zamknięte ogłoszenia pokazują historię negocjacji cenowej.
  -- -------------------------------------------------------------------------
  INSERT INTO public.price_history (listing_id, price, set_at) VALUES
    -- 1 – Mokotów
    (ids[1],  880000.00, now() - interval '45 days'),
    (ids[1],  860000.00, now() - interval '30 days'),
    (ids[1],  850000.00, now() - interval '10 days'),
    -- 2 – Wola
    (ids[2],  535000.00, now() - interval '38 days'),
    (ids[2],  520000.00, now() - interval '14 days'),
    -- 3 – Bronowice
    (ids[3], 1250000.00, now() - interval '30 days'),
    (ids[3], 1200000.00, now() - interval '10 days'),
    -- 4 – Krzyki
    (ids[4],  640000.00, now() - interval '25 days'),
    (ids[4],  620000.00, now() - interval '8 days'),
    -- 5 – Kokoszki
    (ids[5],  380000.00, now() - interval '20 days'),
    -- 6 – Grunwald
    (ids[6],  800000.00, now() - interval '18 days'),
    (ids[6],  780000.00, now() - interval '5 days'),
    -- 7 – Śródmieście
    (ids[7], 2200000.00, now() - interval '15 days'),
    (ids[7], 2100000.00, now() - interval '3 days'),
    -- 8 – Łódź
    (ids[8],  410000.00, now() - interval '14 days'),
    -- 9 – Krowodrza
    (ids[9],  980000.00, now() - interval '12 days'),
    (ids[9],  950000.00, now() - interval '4 days'),
    -- 10 – Orłowo
    (ids[10], 740000.00, now() - interval '10 days'),
    (ids[10], 720000.00, now() - interval '2 days'),
    -- 11 – Fabryczna
    (ids[11], 390000.00, now() - interval '7 days'),
    -- 12 – Wilanów
    (ids[12], 1900000.00, now() - interval '5 days'),
    (ids[12], 1850000.00, now() - interval '1 day'),
    -- 13 – Dębniki (zamknięta)
    (ids[13], 710000.00, now() - interval '60 days'),
    (ids[13], 695000.00, now() - interval '45 days'),
    (ids[13], 680000.00, now() - interval '20 days'),
    -- 14 – Poznań Stare Miasto (zamknięta)
    (ids[14], 560000.00, now() - interval '70 days'),
    (ids[14], 545000.00, now() - interval '40 days'),
    (ids[14], 540000.00, now() - interval '25 days'),
    -- 15 – Praga Południe (najem)
    (ids[15],   3800.00, now() - interval '22 days'),
    -- 16 – Kazimierz (najem)
    (ids[16],   3000.00, now() - interval '17 days'),
    (ids[16],   2900.00, now() - interval '5 days'),
    -- 17 – Wrocław Stare Miasto (najem)
    (ids[17],   4500.00, now() - interval '11 days'),
    -- 18 – Gdańsk Wrzeszcz (najem)
    (ids[18],   3400.00, now() - interval '8 days'),
    (ids[18],   3200.00, now() - interval '2 days'),
    -- 19 – Ursynów (najem zamknięty)
    (ids[19],   2700.00, now() - interval '50 days'),
    (ids[19],   2600.00, now() - interval '30 days'),
    -- 20 – Poznań Jeżyce (najem zamknięty)
    (ids[20],   3900.00, now() - interval '55 days');


  -- -------------------------------------------------------------------------
  -- contacts (kupujący / najemcy powiązani z wybranymi ogłoszeniami)
  -- -------------------------------------------------------------------------
  INSERT INTO public.contacts (listing_id, name, phone, email, role) VALUES
    -- ogłoszenie 1 – Mokotów (dwoje zainteresowanych)
    (ids[1],  'Bartosz Wierzbicki',   '+48 601 111 001', 'b.wierzbicki@example.com',   'kupujący'),
    (ids[1],  'Sylwia Jankowska',     '+48 601 111 002', 's.jankowska@example.com',     'kupujący'),
    -- ogłoszenie 3 – Bronowice
    (ids[3],  'Marcin Olszewski',     '+48 601 222 001', 'm.olszewski@example.com',     'kupujący'),
    -- ogłoszenie 7 – Śródmieście
    (ids[7],  'Diana Kowalczyk',      '+48 601 333 001', 'd.kowalczyk@example.com',     'kupujący'),
    (ids[7],  'Filip Nowak',          '+48 601 333 002', 'f.nowak@example.com',          'kupujący'),
    -- ogłoszenie 9 – Krowodrza
    (ids[9],  'Beata Krawczyk',       '+48 601 444 001', 'b.krawczyk@example.com',      'kupujący'),
    -- ogłoszenie 12 – Wilanów
    (ids[12], 'Radosław Adamczyk',    '+48 601 555 001', 'r.adamczyk@example.com',      'kupujący'),
    -- ogłoszenie 13 – Dębniki (zamknięta – kupujący finalizujący)
    (ids[13], 'Grzegorz Maj',         '+48 601 666 001', 'g.maj@example.com',            'kupujący'),
    -- ogłoszenie 14 – Poznań Stare Miasto (zamknięta)
    (ids[14], 'Paulina Szymańska',    '+48 601 777 001', 'p.szymanska@example.com',     'kupujący'),
    -- ogłoszenie 15 – Praga Południe (najem)
    (ids[15], 'Kamil Bąk',            '+48 601 888 001', 'k.bak@example.com',            'najemca'),
    -- ogłoszenie 16 – Kazimierz (najem)
    (ids[16], 'Renata Wysocka',       '+48 601 999 001', 'r.wysocka@example.com',        'najemca'),
    (ids[16], 'Tomasz Wysocki',       '+48 601 999 002', 't.wysocki@example.com',        'najemca'),
    -- ogłoszenie 17 – Wrocław (najem)
    (ids[17], 'Julia Kowalska',       '+48 602 111 001', 'j.kowalska@example.com',       'najemca'),
    -- ogłoszenie 19 – Ursynów (najem zamknięty)
    (ids[19], 'Mateusz Zawadzki',     '+48 602 222 001', 'm.zawadzki@example.com',       'najemca'),
    -- ogłoszenie 20 – Poznań Jeżyce (najem zamknięty)
    (ids[20], 'Olga Lis',             '+48 602 333 001', 'o.lis@example.com',            'najemca');


  -- -------------------------------------------------------------------------
  -- transaction_snapshots (tylko zamknięte ogłoszenia)
  -- -------------------------------------------------------------------------
  INSERT INTO public.transaction_snapshots (
    listing_id, user_id,
    asking_price, commission_percent, tax_rate, agency_percent,
    brutto, agency_amount, gross_income, tax_amount, agent_net,
    notary_name, notary_city, transaction_date,
    snapshot_at
  ) VALUES
    -- 13 – Dębniki (sprzedaż)
    (ids[13], _uid,
     680000.00, 2.50, 23.00, 50.00,
     17000.00, 8500.00, 8500.00, 1955.00, 6545.00,
     'Marta Jankowska', 'Kraków', '2026-05-20',
     now() - interval '13 days'),
    -- 14 – Poznań Stare Miasto (sprzedaż)
    (ids[14], _uid,
     540000.00, 2.00, 23.00, 50.00,
     10800.00, 5400.00, 5400.00, 1242.00, 4158.00,
     'Zbigniew Pawlik', 'Poznań', '2026-05-15',
     now() - interval '18 days');

END $$;
