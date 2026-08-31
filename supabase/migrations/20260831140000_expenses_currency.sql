-- PROJ-3 · T1 — Fremdwaehrung und eingefrorener Wechselkurs (AC-3, AC-16, AC-17, EC-8)
--
-- Additiv: Jede bestehende Zeile bleibt gueltig und wird zu einer Euro-Ausgabe (EC-8). PROJ-2
-- hat `amount_cents` als **Euro**-Betrag in ganzen Cent eingefuehrt; das bleibt so, und genau
-- dieses Feld traegt weiterhin jede Summe. Neu ist nur, dass es bei einer Fremdwaehrungsausgabe
-- ein beim Erfassen **errechneter** Wert ist.
--
-- Die Richtung des Kurses ist Absicht und keine Geschmacksfrage (design.md, TD-2):
-- gespeichert wird, **wie viele Einheiten der Fremdwaehrung ein Euro kostet** — die Richtung,
-- in der die EZB veroeffentlicht. Die Gegenrichtung verliert bei Waehrungen mit grossen Zahlen
-- Genauigkeit: gemessen rund 1 % Fehler bei IDR, weil der Kurs dort nur zwei signifikante
-- Stellen haette. Der Euro-Betrag entsteht deshalb durch **Division**.

-- ---------------------------------------------------------------------------
-- Die vier Felder
-- ---------------------------------------------------------------------------

alter table public.expenses
  -- Der ISO-4217-Code. Vorgabe `EUR`, damit bestehende Zeilen und jeder Einfuegevorgang ohne
  -- Waehrungsangabe genau das bleiben, was sie in PROJ-2 waren.
  add column currency text not null default 'EUR',

  -- Der eingegebene Betrag in **Hundertsteln seiner Waehrung**, fester Exponent 2 fuer jede
  -- Waehrung (design.md, TD-9). Eine Tabelle der Nachkommastellen je Waehrung waere eine
  -- zweite Wahrheit, die gepflegt werden muesste; JPY zeigt dafuer ",00".
  --
  -- Zunaechst NULL-bar angelegt, weil die bestehenden Zeilen erst befuellt werden muessen —
  -- ein `not null` ohne Vorgabewert wuerde hier scheitern.
  add column amount_original integer,

  -- Nur bei Fremdwaehrung gesetzt. numeric statt Gleitkomma: aus dieser Zahl entsteht ein
  -- Geldbetrag, und 20628.08 wie 0.85889 muessen beide exakt liegen (TD-3).
  add column rate_per_eur numeric(18, 8),

  -- Der Tag, fuer den der Kurs **tatsaechlich** gilt — nicht zwingend der Ausgabetag. An einem
  -- Samstag gilt der Freitagskurs, und dann steht hier der Freitag (AC-4).
  add column rate_date date;

-- ---------------------------------------------------------------------------
-- Bestandszeilen: Euro, Originalbetrag gleich Euro-Betrag (EC-8)
-- ---------------------------------------------------------------------------

update public.expenses
   set amount_original = amount_cents
 where amount_original is null;

alter table public.expenses
  alter column amount_original set not null;

-- ---------------------------------------------------------------------------
-- Was die Datenbank selbst garantiert
-- ---------------------------------------------------------------------------

-- Die 30 Waehrungen der EZB-Referenzkurse, wie der Kursdienst sie fuehrt. Als Pruefregel und
-- nicht als Enum — aus demselben Grund wie bei der Kategorie in PROJ-2 (dort TD-2): einen
-- Enum-Wert wieder loszuwerden ist in Postgres praktisch unmoeglich.
alter table public.expenses
  add constraint expenses_currency_known
    check (currency in (
      'AUD','BRL','CAD','CHF','CNY','CZK','DKK','EUR','GBP','HKD',
      'HUF','IDR','ILS','INR','ISK','JPY','KRW','MXN','MYR','NOK',
      'NZD','PHP','PLN','RON','SEK','SGD','THB','TRY','USD','ZAR'
    ));

-- Dieselben Grenzen wie fuer den Euro-Betrag in PROJ-2 (AC-5, AC-29), angewendet auf den
-- Originalbetrag: groesser 0 und hoechstens 9.999.999,99 (AC-17).
alter table public.expenses
  add constraint expenses_amount_original_range
    check (amount_original between 1 and 999999999);

-- Ein Kurs von 0 oder darunter ist kein Kurs. Die Anwendung wertet so etwas bereits als
-- Stoerung (EC-3); hier steht die zweite, unabhaengige Pruefung.
alter table public.expenses
  add constraint expenses_rate_positive
    check (rate_per_eur is null or rate_per_eur > 0);

-- Die tragende Zusicherung dieses Features (design.md, TD-8).
--
-- Entweder Euro — dann gibt es keinen Kurs, kein Kursdatum, und der Originalbetrag IST der
-- Euro-Betrag. Oder Fremdwaehrung — dann sind Kurs UND Kursdatum gesetzt.
--
-- Damit ist der Zustand "Fremdwaehrung ohne Kurs" **unmoeglich** statt unwahrscheinlich, und
-- zwar auch dann, wenn der Anwendungscode umgangen wird. Das ist die technische Entsprechung
-- der Produktentscheidung aus spec.md: es gibt keinen Zustand "Kurs wird nachgeholt", und
-- deshalb hat **jede** gespeicherte Ausgabe einen Euro-Wert — worauf sich jede Monatssumme
-- verlaesst.
alter table public.expenses
  add constraint expenses_currency_rate_consistent
    check (
      (    currency  = 'EUR'
       and rate_per_eur is null
       and rate_date   is null
       and amount_original = amount_cents)
      or
      (    currency <> 'EUR'
       and rate_per_eur is not null
       and rate_date   is not null)
    );

comment on column public.expenses.currency is
  'ISO-4217-Code der Waehrung, in der die Ausgabe getaetigt wurde. Vorgabe EUR. Anzeigename lebt im Code (src/lib/expenses/currencies.ts), damit eine Umbenennung keine gespeicherte Zeile anfasst.';

comment on column public.expenses.amount_original is
  'Der eingegebene Betrag in Hundertsteln seiner Waehrung, fester Exponent 2. Bei EUR gleich amount_cents.';

comment on column public.expenses.rate_per_eur is
  'Eingefrorener Kurs: wie viele Einheiten der Fremdwaehrung ein Euro kostet (EZB-Richtung). Euro-Betrag = amount_original / rate_per_eur. NULL bei EUR.';

comment on column public.expenses.rate_date is
  'Der Tag, fuer den rate_per_eur tatsaechlich gilt — an Wochenenden und Feiertagen der letzte Werktag davor, nicht zwingend spent_on (AC-4). NULL bei EUR.';
