# PROJ-1 — Technisches Design: Konto & Anmeldung

<!-- Dies ist das technische Design (das WIE). Zwei Leser: die Produktseite (muss zustimmen) und
     /build (baut direkt dagegen). Kein Code — aber baureif genau.
     Der Vertrag (das WAS) steht in spec.md, die Aufgabenliste in tasks.md.
     Kein Status- oder Datumsfeld hier — der Status lebt ausschließlich in features/INDEX.md. -->

## Überblick in drei Sätzen

Anmeldung und Registrierung laufen **serverseitig über Server Actions** — das Formular schickt seine
Felder per POST an den Server, der Supabase Auth aufruft und danach weiterleitet. Der Zugriffsschutz
sitzt an **zwei unabhängigen Stellen**: eine schnelle Vorprüfung in `proxy.ts` für jede Anfrage und
eine echte Prüfung beim Auth-Server auf jeder geschützten Seite, plus Row Level Security in der
Datenbank als dritte, vom Anwendungscode unabhängige Schicht. Die Drosselung gegen Passwort-Raten
lebt als eigene Tabelle in Postgres, damit sie ohne externen Dienst und ohne zusätzlichen Zugang
funktioniert.

---

## Component Structure

```
Wurzel-Layout  (src/app/layout.tsx — von PROJ-1 aufgesetzt)
+-- lang="de", Dark-Klasse fest gesetzt (kein Theme-Umschalter)
+-- Schriften Space Grotesk + Open Sans über next/font/google
+-- Toaster (sonner, unten rechts)

/login   (öffentlich, kein App-Rahmen — zentrierte Karte auf leerem Grund)
+-- Wordmark
+-- Hinweiszeile (nur bei ?reason=session-expired / ?reason=deleted)
+-- Card „Anmelden"
|   +-- LoginForm  (Client-Komponente, Server Action als action)
|       +-- Sammelfehler-Zeile (über dem Formular, nur bei formularweitem Fehler)
|       +-- Feld E-Mail      (+ Feldfehler)
|       +-- Feld Passwort    (+ Feldfehler)
|       +-- Button „Anmelden" (während des Absendens deaktiviert)
+-- Link „Noch kein Konto? Konto anlegen"

/signup  (öffentlich, kein App-Rahmen)
+-- Wordmark
+-- Card „Konto anlegen"
|   +-- SignupForm  (Client-Komponente, Server Action als action)
|       +-- Sammelfehler-Zeile
|       +-- Feld E-Mail      (+ Feldfehler)
|       +-- Feld Passwort    (+ Feldfehler, Hilfetext „mindestens 10 Zeichen")
|       +-- Button „Konto anlegen" (während des Absendens deaktiviert)
+-- Link „Schon ein Konto? Anmelden"

/        (angemeldet — Platzhalter, den PROJ-2 durch die Ausgabenübersicht ersetzt)
+-- Wordmark
+-- Satz „Hier entstehen deine Ausgaben."
+-- Link „Konto"

/konto   (angemeldet, gehört PROJ-1)
+-- Wordmark
+-- Card „Konto"
|   +-- E-Mail-Adresse (nur Anzeige)
|   +-- LogoutButton  (Server Action, Button „Abmelden", variant outline)
+-- Card „Konto löschen"
    +-- Erklärsatz, was gelöscht wird
    +-- DeleteAccountDialog (Client-Komponente)
        +-- Button „Konto endgültig löschen" (variant destructive)
        +-- AlertDialog: Frage, Abbrechen, Bestätigen
```

**Wiederverwendbar für spätere Features:** `Wordmark`, die Abmelde-Server-Action und die
Sitzungsprüfung. Der `AppHeader` mit Monatswechsler gehört PROJ-2 und wird hier **nicht** gebaut —
PROJ-2 hängt seinen „Abmelden"-Eintrag an dieselbe Action und verlinkt `/konto`.

**Bereits vorhandene shadcn/ui-Bausteine** (werden benutzt, nie nachgebaut): `card`, `input`,
`label`, `button`, `form`, `alert-dialog`, `skeleton`, `sonner`.

---

## Routen und Zugriffsschutz

| Route | Abgemeldet | Angemeldet | Gerendert |
|---|---|---|---|
| `/login` | Formular | Weiterleitung auf `/` | dynamisch, `no-store` |
| `/signup` | Formular | Weiterleitung auf `/` | dynamisch, `no-store` |
| `/` | Weiterleitung auf `/login` | Platzhalterseite | dynamisch, `no-store` |
| `/konto` | Weiterleitung auf `/login` | Kontoseite | dynamisch, `no-store` |

**Zwei Prüfungen, nicht eine:**

1. **Vorprüfung in `proxy.ts`** (in Next.js 16 heißt die frühere `middleware.ts` so — die alte Datei
   ist abgekündigt). Sie läuft vor jeder Seitenanfrage, frischt die Sitzungs-Cookies auf und leitet
   anhand des Cookies um. Sie liest **nur das Cookie**, nie die Datenbank; sie ist schnell und
   deshalb bewusst nur eine Vorfilterung.
2. **Echte Prüfung auf jeder geschützten Seite und in jeder Server Action.** Eine gemeinsame Funktion
   holt die angemeldete Person beim Auth-Server ab — nicht aus dem Cookie. Nur so fällt auf, dass ein
   Konto gelöscht oder eine Sitzung entzogen wurde, obwohl das Cookie noch gültig aussieht (EC-5).
   Ohne Person: Weiterleitung auf `/login`.

Alle vier Routen werden **pro Anfrage** gerendert und mit `Cache-Control: no-store` ausgeliefert.
Damit holt der Zurück-Button nach dem Abmelden keine Seite aus dem Verlauf zurück (AC-14).

---

## Data Model

### `profiles` — das Konto in `auslage.`

```
Jedes Profil hat:
- id            (UUID, Primärschlüssel, identisch mit der Nutzer-ID in auth.users,
                 Fremdschlüssel auf auth.users mit Löschweitergabe)
- created_at    (Zeitstempel mit Zeitzone, Pflicht, Vorgabe: jetzt)

Gehört: genau einer Person — der, deren Konto es ist.
Zugriff: Lesen und Ändern nur die eigene Zeile (Vergleich der Zeilen-ID mit der angemeldeten
         Nutzer-ID). Kein Anlegen aus dem Browser (macht der Trigger), kein Löschen aus dem
         Browser (passiert über die Löschweitergabe).
Aufbewahrung: bis zur Kontolöschung. Kein automatischer Ablauf.
```

**Keine E-Mail-Spalte.** Die Adresse steht in `auth.users` und wird für die Anzeige auf `/konto` aus
der Sitzung gelesen. Eine Kopie wäre eine zweite Wahrheit, die auseinanderläuft.

**Angelegt wird die Zeile von einem Datenbank-Trigger**, der bei jedem neuen Eintrag in `auth.users`
feuert (AC-2). Der Trigger läuft mit erhöhten Rechten und schreibt nichts außer der ID.

### `login_attempts` — die Zähler der Drosselung

```
Jeder festgehaltene Fehlversuch hat:
- id            (fortlaufende Zahl, Primärschlüssel)
- email         (Text, Pflicht, kleingeschrieben und ohne Randleerzeichen, höchstens 254 Zeichen)
- ip            (IP-Adresse, darf leer sein — leer heißt: die Anfrage kam ohne erkennbare IP)
- attempted_at  (Zeitstempel mit Zeitzone, Pflicht, Vorgabe: jetzt)

Gehört: niemandem. Es ist eine Sicherheitsprotokollierung, kein Nutzerdatensatz.
Zugriff: aus dem Browser gar keiner. Row Level Security ist eingeschaltet und es gibt
         bewusst KEINE Policy — dazu keine Rechte für die öffentlichen Datenbankrollen.
         Gelesen und geschrieben wird ausschließlich durch die drei unten beschriebenen
         Datenbankfunktionen, die mit erhöhten Rechten laufen.
Aufbewahrung: 24 Stunden ab attempted_at, danach gelöscht (AC-16).
Indizes: (email, attempted_at absteigend), (ip, attempted_at absteigend), (attempted_at)
```

Ein Eintrag pro Fehlversuch statt eines mitgeführten Zählers: die Fenster-Rechnung („wie viele in
den letzten 15 Minuten") ist damit eine simple Abfrage, und die 24-Stunden-Löschung ist ein
Zeilenlöschen statt einer Zustandspflege.

**Was hier bewusst nicht steht:** kein User-Agent, keine Nutzer-ID, kein Passwort, kein Hinweis
darauf, ob die Adresse überhaupt ein Konto hat. Das Minimum, das die Regel braucht — mehr wäre eine
Protokollierung von Anmeldeverhalten, und die will dieses Produkt nicht führen.

Beide Tabellen liegen im Schema `public`. Das Datenmodell in `docs/data-model.md` ist entsprechend
ergänzt.

---

## Behaviors & Access

```
Operationen:

- Konto anlegen (E-Mail, Passwort)
  Wer: jede:r Abgemeldete.
  Regeln: E-Mail muss ein gültiges Format haben (höchstens 254 Zeichen, wird auf
          Kleinschreibung normalisiert und randbereinigt); Passwort mindestens 10 und
          höchstens 72 Zeichen, wird NICHT beschnitten.
  Ergebnis: Konto angelegt, Profilzeile durch den Trigger vorhanden, sofort angemeldet,
            Weiterleitung auf /.
  Abgelehnt wenn: Format falsch, Passwort zu kurz oder zu lang, Adresse bereits vergeben,
                  oder die Person ist schon angemeldet.

- Anmelden (E-Mail, Passwort)
  Wer: jede:r Abgemeldete.
  Regeln: Vor dem Prüfen der Zugangsdaten läuft die Drosselungsprüfung (siehe unten).
  Ergebnis: angemeldet, Zähler dieser Adresse gelöscht, Weiterleitung auf /.
  Abgelehnt wenn: gedrosselt, Zugangsdaten falsch, oder die Person ist schon angemeldet.

- Abmelden
  Wer: jede angemeldete Person, nur für die eigene Sitzung.
  Ergebnis: Sitzung beendet, Cookies entfernt, Weiterleitung auf /login.

- Eigenes Profil lesen
  Wer: die Person selbst. Liefert ausschließlich die eigene Zeile — auch bei einer Anfrage,
       die den Anwendungscode umgeht.

- Konto löschen
  Wer: die angemeldete Person, ausschließlich das eigene Konto.
  Regeln: nur nach Bestätigung im Dialog.
  Ergebnis: Eintrag in auth.users gelöscht; Profilzeile und alle abhängigen Daten laufen über
            die Löschweitergabe mit; die Drosselungs-Zeilen zu dieser Adresse werden entfernt;
            Sitzungen und Auffrischungs-Token verfallen; Weiterleitung auf /login mit Bestätigung.
  Abgelehnt wenn: nicht angemeldet.

- Drosselung prüfen / Fehlversuch festhalten / Zähler aufräumen
  Wer: nur der Server im Zuge einer Anmeldung; für den Browser gibt es keinen Weg dorthin.

Grundsätzlich abgelehnt wird: jede Operation ohne Anmeldung, die eine verlangt, und jeder
Zugriff auf fremde Zeilen — von der Datenbank selbst, nicht erst vom Anwendungscode.
```

---

## Eingaberegeln und Fehlermeldungen

Geprüft wird **dreifach**: im Browser für die schnelle Rückmeldung, im Server Action als
verbindliche Prüfung (nur diese zählt), und in der Datenbank als letzte Instanz.

| Feld | Regel | Wo verbindlich |
|---|---|---|
| E-Mail | gültiges Format, höchstens 254 Zeichen, kleingeschrieben und randbereinigt | Schema-Prüfung im Server Action |
| Passwort | mindestens 10, höchstens 72 Zeichen, **keine Randbereinigung** | Server Action **und** Datenbank-Mindestlänge |

Die Obergrenze von 72 Zeichen ist keine Willkür: das Hash-Verfahren hinter Supabase Auth
berücksichtigt nur die ersten 72 Bytes. Ohne Grenze würde ein längeres Passwort still gekürzt — und
zwei verschiedene Passwörter würden auf dasselbe Konto passen. Lieber eine sichtbare Regel.

**Randleerzeichen im Passwort bleiben erhalten**, bei Registrierung wie Anmeldung, ohne Ausnahme
(EC-6). Nur die E-Mail wird normalisiert.

### Die Meldungen, wortwörtlich

| Anlass | Text | Wo |
|---|---|---|
| Falsche Zugangsdaten **oder** unbekannte Adresse | „E-Mail-Adresse oder Passwort stimmt nicht." | Sammelzeile über dem Formular |
| Adresse schon vergeben | „Diese E-Mail-Adresse hat schon ein Konto. Melde dich an." | Sammelzeile, mit Link auf `/login` |
| E-Mail-Format | „Bitte gib eine gültige E-Mail-Adresse ein." | am E-Mail-Feld |
| Passwort zu kurz | „Dein Passwort braucht mindestens 10 Zeichen." | am Passwortfeld |
| Passwort zu lang | „Dein Passwort darf höchstens 72 Zeichen haben." | am Passwortfeld |
| Gedrosselt | „Zu viele Fehlversuche. Bitte versuche es in {n} Minuten erneut." | Sammelzeile |
| Datenbank nicht erreichbar | „Die Anmeldung ist gerade nicht möglich. Bitte versuche es in einem Moment noch einmal." | Sammelzeile |
| Sitzung abgelaufen | „Deine Sitzung ist abgelaufen. Bitte melde dich erneut an." | Hinweiszeile über der Karte auf `/login` |
| Konto gelöscht | „Dein Konto ist gelöscht. Alles Gute!" | Hinweiszeile über der Karte auf `/login` |

Die erste Zeile ist die wichtigste: **eine unbekannte Adresse und ein falsches Passwort erzeugen
denselben Satz** (AC-7). Auch die Antwortzeit ist vergleichbar — Supabase Auth rechnet bei einer
unbekannten Adresse absichtlich einen Vergleich gegen einen Blindwert, damit die Dauer nichts
verrät. Die Drosselung sitzt in beiden Fällen davor und zählt beide Fälle gleich.

Bei jedem Fehler leert das Formular das Passwortfeld und behält die E-Mail-Adresse (EC-4).

---

## Schutz vor automatisiertem Erraten

### Was Supabase Auth von sich aus tut — und was nicht

| Greift | Wert | Deckt nicht ab |
|---|---|---|
| Anmelde- und Registrierungsanfragen, **pro IP** | 30 in 5 Minuten (`sign_in_sign_ups`) | ein geduldiger Angriff auf ein einzelnes Konto: 8.640 Rateversuche pro Tag |
| Token-Anfragen, **pro IP**, nicht veränderbar | fest | verteilte Angriffe über wechselnde IPs; Credential Stuffing |

Das ist der Boden, nicht die Antwort. Die eigene Drosselung liegt darüber.

### Die eigene Drosselung

**Werte: 5 Fehlversuche in 15 Minuten — je E-Mail-Adresse und je IP-Adresse, getrennt gezählt.**

Ablauf einer Anmeldung:

1. Der Server ermittelt die IP der anfragenden Person aus dem `x-forwarded-for`-Kopf (erster
   Eintrag) oder ersatzweise `x-real-ip`.
2. **Vor** dem Prüfen der Zugangsdaten fragt er die Datenbankfunktion: Sind in den letzten 15
   Minuten mindestens 5 Fehlversuche **zu dieser Adresse** festgehalten? Oder mindestens 5 **von
   dieser IP**? Wenn ja, wird der Versuch abgelehnt, ohne dass Supabase Auth überhaupt gefragt wird.
3. Die Funktion liefert zugleich, in wie vielen Sekunden es wieder geht: Die Sperre endet, sobald
   der fünftjüngste Versuch aus dem 15-Minuten-Fenster fällt. Die Meldung nennt diesen Wert in
   aufgerundeten Minuten (AC-8).
4. Schlägt die Anmeldung fehl, hält der Server einen Fehlversuch fest — **unabhängig davon, ob die
   Adresse überhaupt ein Konto hat.** Sonst wäre die Drosselung selbst der Verräter.
5. Gelingt die Anmeldung, werden alle Zeilen zu dieser Adresse gelöscht.
6. Antwortet Supabase Auth seinerseits mit „zu viele Anfragen", zeigt die App dieselbe
   Drosselungsmeldung — die Person soll nicht zwei verschiedene Erklärungen für dasselbe sehen.

**Beide Fälle — Adresse gesperrt und IP gesperrt — ergeben denselben Satz.** Wer den Unterschied
sähe, wüsste mehr über das System als nötig.

**Fehlt die IP** — im lokalen Betrieb ohne vorgelagerten Server ist der `x-forwarded-for`-Kopf
schlicht nicht gesetzt —, greift nur die Adress-Regel, und der Versuch wird ohne IP festgehalten.
Damit läuft die lokale Entwicklung nicht in eine Sperre, die alle Testkonten gemeinsam betrifft.
AC-9 wird deshalb gegen die Datenbankfunktion mit einer übergebenen IP geprüft, nicht durch
Klicken im lokalen Browser.

**Warum die Zähler in Postgres liegen und nicht bei einem Cache-Dienst:** Sie überleben einen
Neustart, brauchen kein zweites Konto und keinen weiteren Schlüssel, und die 24-Stunden-Löschung ist
in derselben Datenbank nachweisbar, in der sie entstanden sind. Der Preis ist eine zusätzliche
Datenbankabfrage pro Anmeldeversuch — zwei indizierte Zählungen, die die Vorgabe von unter 500 ms
aus `spec.md` nicht gefährden.

### Die 24-Stunden-Löschung (AC-16)

Zwei Wege, die sich gegenseitig absichern:

- **Ein geplanter Datenbank-Job** löscht stündlich alles, was älter als 24 Stunden ist. Die dafür
  nötige Erweiterung `pg_cron` ist im lokalen Stack vorhanden und vorgeladen — geprüft, nicht
  angenommen.
- **Jede Drosselungsprüfung räumt nebenbei auf.** Damit hält die Regel auch dann, wenn der Job
  einmal nicht läuft.

Die Löschung ist damit als Funktion aufrufbar und dadurch prüfbar, ohne 24 Stunden zu warten.

### Was bewusst fehlt

**Kein CAPTCHA.** In `spec.md` als offener Punkt festgehalten: Es bräuchte ein Konto bei einem
Anbieter und einen Schlüssel, und das Formular ist ohne Deployment ohnehin nur lokal erreichbar.
Das Risiko dabei ist klar benannt: Automatisiertes Anlegen von Konten ist mit den Werten oben nicht
verhindert, sondern nur verlangsamt. Vor dem ersten öffentlichen Zugang nachzuholen — es ist ein
Schalter in Supabase plus ein Widget im Formular, kein Umbau.

**Keine Prüfung auf geleakte Passwörter.** Supabase bietet den Abgleich gegen bekannte
Datenlecks an, aber nur in kostenpflichtigen Tarifen. Für ein lokal laufendes Prüfungsprojekt keine
sinnvolle Ausgabe; vor einem echten Start neu zu bewerten.

**Keine Zwei-Faktor-Authentifizierung** — in `spec.md` außerhalb des Umfangs, und für ein Produkt
ohne Zahlungsdaten und ohne echte Beträge angemessen.

---

## Sitzung

| Einstellung | Wert | Warum |
|---|---|---|
| Gültigkeit des Zugangs-Tokens | 1 Stunde (Vorgabe) | wird im Hintergrund automatisch aufgefrischt |
| Auffrischungs-Token rotieren | an (Vorgabe) | ein abgefangenes Token ist nach einmaligem Gebrauch wertlos |
| Abmeldung bei Untätigkeit | 8 Stunden | ein geteilter Rechner bleibt nicht über Nacht offen |
| Zwangsabmeldung | 24 Stunden | begrenzt, wie lange eine gestohlene Sitzung nutzbar ist |

Die letzten beiden machen EC-3 überhaupt erst prüfbar: Ohne eine Grenze läuft eine Sitzung faktisch
nie ab. Läuft sie ab, führt die nächste Aktion auf `/login` **mit** dem Hinweis „Deine Sitzung ist
abgelaufen" — nicht in eine stumme Fehlermeldung.

---

## Zustände je Seite

Nach dem Seitenmuster aus `docs/app-shell.md`:

- **Laden:** `/konto` zeigt an der Stelle der E-Mail-Adresse ein Skeleton in `--muted`. Die
  Formulare zeigen keinen Ladezustand, sondern einen deaktivierten Button mit dem Text „Moment …",
  solange abgeschickt wird.
- **Leer:** kommt in PROJ-1 nicht vor — jede Seite hat immer Inhalt.
- **Fehler:** Feldfehler direkt am Feld in `--destructive`, formularweite Fehler als eine Zeile über
  dem Formular. Beides zusammen, wenn beides zutrifft.
- **Rückmeldung:** Toast unten rechts nach dem Abmelden und nach dem Löschen — dort, wo die Person
  nach der Weiterleitung ankommt.
- **Barrierefreiheit:** jedes Feld hat ein sichtbares Label; Fehlertexte sind dem Feld zugeordnet,
  damit Screenreader sie vorlesen; jedes bedienbare Element hat einen sichtbaren Fokus.

---

## Was PROJ-1 am gemeinsamen Fundament aufsetzt

PROJ-1 ist das erste Feature mit Oberfläche und legt deshalb an, was danach alle benutzen:

- **Wurzel-Layout** — `lang="de"`, Dark fest gesetzt, Seitentitel „auslage.", die beiden Schriften
  über `next/font/google` (ausgeliefert von der eigenen Domain, kein Aufruf zu Google im Browser).
- **Farb-Tokens** in `globals.css` nach `docs/design-system.md`.
- **`Wordmark`** — die Wortmarke mit olivem Punkt.
- **Sicherheits-Header** in der Next-Konfiguration: `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: origin-when-cross-origin`,
  `Strict-Transport-Security` mit `includeSubDomains`.
- **Supabase-Clients** — der bisherige Browser-Client in `src/lib/supabase.ts` wird durch ein Paar
  ersetzt: einen für den Browser, einen für den Server, beide sitzungsfähig.

**Nicht** von PROJ-1: `AppHeader`, `PageHeader`, Monatswechsler. Die gehören PROJ-2.

---

## Dependencies

- **`@supabase/ssr`** — neu zu installieren. Verbindet Supabase Auth mit serverseitig gerenderten
  Seiten: legt die Sitzung in Cookies statt im Browser-Speicher ab, damit der Server weiß, wer
  anfragt. Ohne dieses Paket gibt es keinen serverseitigen Zugriffsschutz, sondern nur einen im
  Browser — und der ist keiner.
- Bereits vorhanden und wiederverwendet: `@supabase/supabase-js`, `zod`, `react-hook-form`,
  `@hookform/resolvers`, `sonner`, die shadcn/ui-Bausteine.
- **Kein** `@upstash/ratelimit`, **kein** `@upstash/redis` — die Drosselung braucht sie nicht.

### Umgebungsvariablen

| Variable | Erreicht den Browser? | Zweck |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ja, so gewollt | Adresse der lokalen Supabase-Instanz |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ja, so gewollt | öffentlicher Schlüssel; genau deshalb muss RLS sitzen |

**Neue Variablen kommen nicht dazu.** Insbesondere existiert in dieser Anwendung **kein**
`service_role`-Schlüssel — der Schlüssel, der Row Level Security aushebelt, ist nirgends im Projekt
hinterlegt (siehe Entscheidung TD-6).

---

## Settings the user makes

**Keine.** Alles, was dieses Design an Auth-Einstellungen braucht, steht in `supabase/config.toml`
im Repo und ist damit eine normale Aufgabe für `/build`, kein Klick im Dashboard:

| Einstellung | Wert | Warum | → AC |
|---|---|---|---|
| Mindestlänge des Passworts | 10 | dritte, vom Anwendungscode unabhängige Prüfung | AC-3 |
| Abmeldung bei Untätigkeit / Zwangsabmeldung | 8 h / 24 h | macht EC-3 prüfbar, schützt geteilte Rechner | EC-3 |
| Anmelde- und Registrierungslimit pro IP | unverändert (30 / 5 Min) | die eigene Drosselung ist strenger | AC-8, AC-9 |
| E-Mail-Bestätigung | aus | Produktentscheidung in `spec.md` | AC-1 |

Nach dem Ändern von `supabase/config.toml` muss der lokale Stack neu gestartet werden, sonst gilt
weiter der alte Wert.

**Erst relevant, falls später ein gehostetes Projekt entsteht** — heute keine Aufgabe, weil das PRD
kein Deployment vorsieht: CAPTCHA aktivieren, Prüfung auf geleakte Passwörter (kostenpflichtig),
Region `eu-central-1`, Auftragsverarbeitungsvertrag mit Supabase, Aufbewahrungsdauer der
Auth-Protokolle. Die `[auth]`-Abschnitte aus `config.toml` lassen sich mit `supabase config push`
auf ein verknüpftes Projekt übertragen — die Werte oben müssten also nicht neu geklickt werden.

---

## Technical Decisions

| Nr. | Entscheidung | Begründung | Alternative erwogen | Abwägung | Datum |
|---|---|---|---|---|---|
| TD-1 | Anmeldung und Registrierung über Server Actions, nicht über ein Formular im Browser | Ein Server Action verschickt grundsätzlich per POST. Damit können E-Mail und Passwort gar nicht erst in der Adresszeile landen — AC-10 ist strukturell erfüllt statt durch Sorgfalt | Client-Formular, das Supabase direkt aufruft | Kein optimistisches Tippgefühl, ein Server-Roundtrip mehr; dafür eine ganze Fehlerklasse ausgeschlossen | 2026-08-27 |
| TD-2 | Zugriffsschutz an zwei Stellen: Vorprüfung in `proxy.ts` **und** echte Prüfung auf jeder geschützten Seite | Die Vorprüfung liest nur ein Cookie und ist schnell, weiß aber nicht, ob das Konto noch existiert. Die Seitenprüfung fragt den Auth-Server. Erst zusammen decken sie EC-5 ab | Nur die Vorprüfung — der verbreitete Kurzschluss | Eine zusätzliche Auth-Abfrage pro geschützter Seite; dafür fällt ein gelöschtes Konto sofort auf statt erst nach einer Stunde | 2026-08-27 |
| TD-3 | Die Datei heißt `proxy.ts`, nicht `middleware.ts` | Next.js 16 hat `middleware.ts` abgekündigt und umbenannt; die Funktion ist unverändert | `middleware.ts` wie in fast allen Anleitungen | Ältere Tutorials passen nicht mehr wörtlich — das ist der Preis dafür, nicht auf einer abgekündigten Datei aufzubauen | 2026-08-27 |
| TD-4 | Drosselungszähler als Tabelle in Postgres | Kein zusätzliches Konto, kein weiterer Schlüssel, funktioniert im lokalen Docker-Stack genauso wie später gehostet. Die 24-Stunden-Löschung ist dort nachweisbar, wo die Daten liegen | Upstash Redis, wie im Framework-Pack beschrieben | Eine Datenbankabfrage mehr pro Anmeldeversuch, und kein Schutz vor Anfragen, die den Server gar nicht erreichen; dafür null externe Abhängigkeit | 2026-08-27 |
| TD-5 | Die Zähler-Tabelle hat RLS an und **keine einzige Policy**; Zugriff nur über Funktionen mit erhöhten Rechten | Der öffentliche Schlüssel steckt in jedem Browser. Ohne Policy antwortet die Tabelle niemandem, der über die Datenschnittstelle kommt | Eine Lese-Policy für Angemeldete | Zum Nachsehen braucht es Supabase Studio; dafür kann niemand die Sicherheitsprotokolle von außen abfragen | 2026-08-27 |
| TD-6 | Kontolöschung über eine Datenbankfunktion mit erhöhten Rechten, die ausschließlich das **eigene** Konto löscht — nicht über die Admin-Schnittstelle | Die Admin-Schnittstelle bräuchte den `service_role`-Schlüssel in der Anwendung. Dieser Schlüssel hebelt Row Level Security komplett aus; existiert er nicht, kann er auch nicht verwechselt, geloggt oder versehentlich veröffentlicht werden | `SUPABASE_SERVICE_ROLE_KEY` als serverseitige Variable plus Admin-Aufruf | Die Löschlogik lebt in der Datenbank statt im Anwendungscode und ist dort etwas weniger sichtbar; dafür gibt es den gefährlichsten Schlüssel des Projekts schlicht nicht | 2026-08-27 |
| TD-7 | Die Profilzeile entsteht durch einen Datenbank-Trigger, nicht im Registrierungs-Code | Ein Trigger kann nicht vergessen und nicht umgangen werden — auch nicht von einem Konto, das später anders angelegt wird. AC-2 hängt sonst an der Disziplin des Aufrufers | Einfügen direkt im Server Action nach erfolgreicher Registrierung | Ein Fehler im Trigger lässt die Registrierung mit einer generischen Datenbankmeldung scheitern; der Trigger bleibt deshalb minimal und schreibt nur die ID | 2026-08-27 |
| TD-8 | `profiles` führt keine E-Mail-Spalte | Die Adresse steht in `auth.users`. Eine Kopie müsste bei jeder Änderung mitgezogen werden und wäre nach der ersten vergessenen Stelle falsch | E-Mail in `profiles` spiegeln, für einfachere Abfragen | Die Anzeige auf `/konto` liest die Sitzung statt der Tabelle; dafür gibt es nur eine Wahrheit | 2026-08-27 |
| TD-9 | Doppelklick-Schutz durch einen während des Absendens deaktivierten Button, Eindeutigkeit durch die Datenbank | EC-1 löst der deaktivierte Button: der zweite Klick wird nie abgeschickt. EC-2 löst die Eindeutigkeit der E-Mail in `auth.users`: treffen zwei Registrierungen gleichzeitig ein, gewinnt genau eine, die andere bekommt die Meldung aus AC-5 | Sperre im Anwendungscode oder ein eigenes Merkmal | Zwei Mechanismen statt einem — der eine für die Bedienung, der andere für die Datenintegrität. Nur der zweite hält auch unter echter Gleichzeitigkeit | 2026-08-27 |
| TD-10 | Passwortlänge 10 bis 72 Zeichen, ohne Randbereinigung | Das Hash-Verfahren berücksichtigt nur die ersten 72 Bytes; ohne Grenze würde still gekürzt und zwei verschiedene Passwörter würden auf dasselbe Konto passen. Randleerzeichen bleiben erhalten, damit Registrierung und Anmeldung identisch rechnen (EC-6) | Keine Obergrenze; Passwort beim Anmelden randbereinigen | Wer ein sehr langes Passwort nutzt, sieht eine Regel statt einer stillen Kürzung — das ist die ehrlichere Variante | 2026-08-27 |
| TD-11 | Geschützte Seiten werden pro Anfrage gerendert und mit `Cache-Control: no-store` ausgeliefert | Ohne diesen Kopf zeigt der Zurück-Button nach dem Abmelden die alte Seite aus dem Verlauf. AC-14 verlangt ausdrücklich das Gegenteil | Nur die Weiterleitung beim Abmelden | Geschützte Seiten sind nicht zwischenspeicherbar — bei vier Seiten ohne messbare Folge | 2026-08-27 |
| TD-12 | Fehlversuche werden auch für unbekannte Adressen festgehalten | Zählte die Drosselung nur echte Konten, verriete ihr Einsetzen, welche Adresse existiert — genau das, was AC-7 verhindern soll | Nur echte Konten zählen, spart Zeilen | Etwas mehr Daten, die aber nach 24 Stunden verschwinden; dafür bleibt die Aussage der Meldung wertlos für Angreifer | 2026-08-27 |
| TD-13 | 24-Stunden-Löschung über einen geplanten Job **und** eine nebenbei laufende Bereinigung bei jeder Prüfung | Der Job erledigt es auch ohne Verkehr, die Bereinigung auch ohne Job. AC-16 hängt damit nicht an einer einzelnen Komponente. `pg_cron` ist im lokalen Stack vorhanden — nachgesehen, nicht vermutet | Nur der Job; oder nur die Bereinigung | Zwei Wege, die dasselbe tun; dafür gibt es keine Konstellation, in der die Frist still reißt | 2026-08-27 |
| TD-14 | Fehlt die IP im Anfragekopf, greift nur die Adress-Regel | Im lokalen Betrieb ohne vorgelagerten Server gibt es keine IP. Würde man ersatzweise alle Anfragen in einen Topf werfen, sperrte sich die Entwicklung nach fünf Tippfehlern selbst aus | Ersatzwert für fehlende IPs vergeben | AC-9 wird gegen die Datenbankfunktion mit übergebener IP geprüft statt durch Klicken; im Betrieb hinter einem Server ist der Kopf immer gesetzt | 2026-08-27 |
| TD-15 | Farb-Tokens als deckende HSL-Tripel im shadcn-Schema | Beantwortet die in `docs/design-system.md` §10 offen gelassene Frage. Das Scaffold erwartet Tripel; sie umzustellen wäre ein Eingriff in jedes Bauteil, bevor das erste Feature steht | `@theme inline` auf volle Farbwerte umstellen, damit Alpha-Rahmen erhalten bleiben | Rahmen auf Karten wirken minimal anders als in der Quelle; dafür bleibt das Standardschema unangetastet und PROJ-2 baut auf etwas Bekanntem auf | 2026-08-27 |
| TD-16 | Kein CAPTCHA, keine Prüfung auf geleakte Passwörter, keine Zwei-Faktor-Authentifizierung | So in `spec.md` entschieden: CAPTCHA bräuchte ein Anbieterkonto, die Leak-Prüfung einen kostenpflichtigen Tarif, 2FA ist außerhalb des Umfangs | Alle drei aktivieren | **Benanntes Risiko:** Automatisiertes Anlegen von Konten ist nur verlangsamt, nicht verhindert, und ein anderswo geleaktes Passwort wird hier akzeptiert. Vor dem ersten öffentlichen Zugang nachzuholen | 2026-08-27 |
| TD-17 | `/konto` als eigener angemeldeter Bereich für Abmelden und Kontolöschung | Der Header gehört laut `docs/app-shell.md` PROJ-2 und existiert beim Bau von PROJ-1 noch nicht. Ein eigener Bereich hält AC-14 und AC-15 dauerhaft prüfbar, statt sie später umziehen zu müssen | Beides auf die Platzhalter-Startseite; oder den Header vorziehen | Eine Zeile mehr in `docs/app-shell.md`; dafür hängt PROJ-1 nicht an PROJ-2, und die Kontolöschung hat auch später einen Platz | 2026-08-27 |

---

## Abdeckung: jedes Kriterium hat eine Stelle

| AC / EC | Wo es erfüllt wird |
|---|---|
| AC-1 | Registrierungs-Server-Action: Schema-Prüfung, Anlegen, sofortige Anmeldung, Weiterleitung auf `/` |
| AC-2 | Datenbank-Trigger auf `auth.users` (TD-7) |
| AC-3 | Schema-Prüfung im Server Action + Mindestlänge in `supabase/config.toml` |
| AC-4 | Schema-Prüfung im Server Action, Fehler am E-Mail-Feld |
| AC-5 | Eindeutigkeit der E-Mail in `auth.users`, Meldung „schon ein Konto" |
| AC-6 | Anmelde-Server-Action, Weiterleitung auf `/` |
| AC-7 | Eine einzige Fehlermeldung für beide Fälle; Drosselung zählt auch unbekannte Adressen (TD-12) |
| AC-8 | Drosselungsprüfung, Regel je E-Mail-Adresse, Restzeit in Minuten in der Meldung |
| AC-9 | Drosselungsprüfung, Regel je IP-Adresse (Prüfung gegen die Datenbankfunktion, TD-14) |
| AC-10 | Server Actions verschicken per POST (TD-1) |
| AC-11 | Vorprüfung in `proxy.ts` + Seitenprüfung auf `/` |
| AC-12 | Vorprüfung in `proxy.ts` für `/login` und `/signup` |
| AC-13 | Row Level Security auf `profiles`, Vergleich der Zeilen-ID mit der angemeldeten Nutzer-ID |
| AC-14 | Abmelde-Server-Action + `Cache-Control: no-store` auf geschützten Seiten (TD-11) |
| AC-15 | Bestätigungsdialog auf `/konto` + Datenbankfunktion mit Löschweitergabe (TD-6) |
| AC-16 | Geplanter Job + Bereinigung bei jeder Prüfung (TD-13) |
| EC-1 | Deaktivierter Button während des Absendens (TD-9) |
| EC-2 | Eindeutigkeit der E-Mail in `auth.users` (TD-9) |
| EC-3 | Seitenprüfung leitet auf `/login?reason=session-expired`; Sitzungsgrenzen machen es prüfbar |
| EC-4 | Fehlerbehandlung im Server Action, Sammelmeldung, geleertes Passwortfeld, POST statt URL |
| EC-5 | Seitenprüfung fragt den Auth-Server, nicht das Cookie (TD-2) |
| EC-6 | Passwort wird nirgends randbereinigt (TD-10) |

---

## Open Questions

- [ ] Die Sitzungsgrenzen (Untätigkeit 8 h, Zwangsabmeldung 24 h) sind lokal in `config.toml`
      gesetzt. Ob ein gehostetes Projekt sie im kostenlosen Tarif ebenfalls annimmt, ist erst zu
      prüfen, wenn ein solches Projekt entsteht — betrifft dann EC-3.
- [ ] `pg_cron` ist im lokalen Stack vorhanden. In einem gehosteten Projekt muss die Erweiterung
      einmalig aktiviert werden, bevor der Aufräum-Job dort läuft.

_Die offenen Punkte aus `spec.md` (CAPTCHA, Signup-Enumeration, § 132 BAO, Aufbewahrung der
Auth-Protokolle) bleiben offen und werden von diesem Design nicht beantwortet — TD-16 nennt das
Risiko der ersten beiden ausdrücklich._

---

## Notizen aus dem Bau

_Angefügt von `/build`. Das Design oben ist der Entwurf, das hier die Stellen, an denen die
Umsetzung davon abweicht — damit die Dokumente nicht auseinanderlaufen._

### Die Drosselung hat zwei Funktionen statt drei — und das ist eine Sicherheitskorrektur

Der Entwurf beschrieb **prüfen**, **festhalten** und **aufräumen** als drei Funktionen, dazu ein
Zurücksetzen nach erfolgreicher Anmeldung. Beim Bauen zeigte sich, dass das ein Loch hat: Der
Server ruft diese Funktionen **abgemeldet** auf, sie müssen also für die Rolle `anon` freigegeben
sein — und `anon` ist der Schlüssel, der in jedem Browser steckt. Eine freigegebene
„Zähler zurücksetzen"-Funktion hätte jede:r direkt aufrufen können; die Drosselung wäre Dekoration
gewesen.

Gebaut ist deshalb:

- **`login_attempt_gate(email, ip)`** — prüft **und** hält den Versuch fest, in einem Aufruf,
  bevor die Zugangsdaten geprüft werden. Die einzige abgemeldet aufrufbare Funktion. Ein bereits
  gesperrter Versuch wird nicht mitgezählt, sonst verlängert Hämmern die Sperre endlos.
- **`clear_own_login_attempts()`** — nimmt **kein Argument** und liest die Adresse aus dem
  angemeldeten Konto. Nur für `authenticated`. Niemand kann fremde Zähler zurücksetzen.
- **`cleanup_login_attempts()`** — unverändert, ohne jedes Client-Recht.

Alle Acceptance Criteria bleiben unverändert erfüllt. Der Zähler zählt jetzt *Versuche* statt
*Fehlversuche* — praktisch dasselbe, weil eine geglückte Anmeldung sofort aufräumt.

### TD-14 war falsch: lokal gibt es sehr wohl eine IP

Der Entwurf nahm an, im lokalen Betrieb ohne vorgelagerten Server sei kein
`x-forwarded-for`-Kopf gesetzt und die IP-Regel greife deshalb nicht. Beim Durchstich stand in
jeder Zeile `::1`. Der Kopf ist also da, und **AC-9 ist lokal durch die Oberfläche prüfbar** —
besser als gedacht.

Die Kehrseite steht dafür fest: Weil beide Regeln bei 5 Versuchen in 15 Minuten liegen und lokal
alle Anfragen von `::1` kommen, greift beim Testen mit mehreren Konten **die IP-Regel zuerst**.
Wer AC-8 isoliert prüfen will, muss die Zähler zwischendurch leeren oder die Datenbankfunktion
direkt mit einer eigenen IP aufrufen. Das ist kein Fehler, sondern genau das, was AC-9 verlangt —
aber es ist eine Falle für `/qa`.

Die Vorkehrung für den Fall *ohne* IP bleibt im Code: Fehlt der Kopf, greift nur die Adress-Regel.

### Kleinere Festlegungen

- **Rückmeldungen:** „Sitzung abgelaufen" und „Konto gelöscht" stehen als Hinweiszeile über der
  Karte auf `/login` (so wie in der Meldungstabelle oben). Nur das Abmelden ist ein Toast — eine
  flüchtige Bestätigung gehört nicht über ein Formular, in das man gerade wieder tippen will.
- **Steuerelementhöhe 36px** wird über `className` an den Elementen dieses Features gesetzt, nicht
  in den shadcn-Bausteinen. Die gehören zum Rahmen, und der gehört PROJ-2 — dort ist der richtige
  Ort, den Wert einmal zentral zu setzen.
- **Toast-Fläche** ist derzeit `--background` statt `--popover`, weil das der ausgelieferte Zustand
  von `src/components/ui/sonner.tsx` ist. Ein Token-Tausch für PROJ-2, kein Eingriff hier.
- **Keine Client-Validierung.** Die Zod-Prüfung läuft nur auf dem Server, die Formulare tragen
  `noValidate`. Eine zweite Stelle mit denselben Regeln ist die erste, die beim Ändern vergessen
  wird. Die Meldungen kommen aus einer Quelle.
- **`/konto` bekam zusätzlich ein `loading.tsx`** mit den Skeletons, die das Seitenmuster verlangt.
- **Die Kontolöschung ist ohne JavaScript nicht erreichbar**, weil der Dialoginhalt erst beim
  Öffnen gerendert wird. Bei einer Aktion, die eine ausdrückliche Bestätigung verlangt, ist das
  vertretbar — es heißt aber, dass die Verdrahtung des Buttons nur im Browser prüfbar ist. Die
  Datenbankfunktion dahinter ist es nicht: die wurde über die Schnittstelle verifiziert.
- **ESLint prüfte bisher auch `docs/`** — gitignoriertes Referenzmaterial mit eigenen Verstößen.
  Dadurch war `npm run lint` schon vor diesem Feature rot. `docs/**` steht jetzt in den
  `ignores` der ESLint-Konfiguration.
