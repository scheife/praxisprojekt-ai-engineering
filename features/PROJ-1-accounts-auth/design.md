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

> **Wie dieses Dokument zu lesen ist.** Alle Abschnitte bis einschließlich *Abdeckung* beschreiben
> den Entwurf **so, wie er nach dem `/refine` vom 28.08.2026 gilt** — das ist der Stand, gegen den
> `/build` baut. Die *Bauhistorie* am Ende hält fest, wie es dazu kam: welche Annahme sich beim
> Bauen als falsch erwiesen hat und welcher QA-Befund welche Entscheidung ausgelöst hat. Sie ist
> Begründung, nicht Bauanleitung.

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
Jeder festgehaltene Versuch hat:
- id            (fortlaufende Zahl, Primärschlüssel)
- kind          (Text, Pflicht, genau einer von: 'login' | 'signup', Vorgabe 'login')
- email         (Text, Pflicht, kleingeschrieben und ohne Randleerzeichen, höchstens 254 Zeichen)
- ip            (IP-Adresse, darf leer sein — leer heißt: keine vertrauenswürdig
                 erkennbare IP, siehe die Bedeutung darunter)
- attempted_at  (Zeitstempel mit Zeitzone, Pflicht, Vorgabe: jetzt)

Gehört: niemandem. Es ist eine Sicherheitsprotokollierung, kein Nutzerdatensatz.
Zugriff: aus dem Browser kein lesender. Row Level Security ist eingeschaltet und es gibt
         bewusst KEINE Policy — dazu keine Rechte für die öffentlichen Datenbankrollen.
         Gelesen und geschrieben wird ausschließlich durch die unten beschriebenen
         Datenbankfunktionen, die mit erhöhten Rechten laufen. Zwei davon sind für
         Abgemeldete aufrufbar, weil eine Anmeldung ohne Sitzung beginnt — mit den
         Folgen, die unter „Offene Punkte" stehen.
Aufbewahrung: 24 Stunden ab attempted_at, danach gelöscht (AC-16).
Indizes: (email, attempted_at absteigend), (ip, attempted_at absteigend),
         (kind, ip, attempted_at absteigend), (attempted_at)
```

**Was eine leere `ip` bedeutet, ist je Art verschieden** — das ist der Kern der Regeln unten:

| `kind` | Zeile mit IP | Zeile ohne IP |
|---|---|---|
| `login` | zählt in den Eimer dieser IP (AC-9) | zählt in **keinen** IP-Eimer; für diese Zeile gilt nur die Adress-Regel AC-8 |
| `signup` | zählt in den Eimer dieser IP (AC-17) | zählt in den **gemeinsamen** Eimer aller Versuche ohne IP (AC-17) |

Ein Eintrag pro Versuch statt eines mitgeführten Zählers: die Fenster-Rechnung („wie viele in
den letzten 15 Minuten") ist damit eine simple Abfrage, und die 24-Stunden-Löschung ist ein
Zeilenlöschen statt einer Zustandspflege. Festgehalten wird **jeder** Anmeldeversuch vor der
Prüfung der Zugangsdaten, nicht erst der gescheiterte — eine geglückte Anmeldung räumt ihre
Zeilen sofort wieder ab.

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
          Vor dem Anlegen läuft das Registrierungs-Tor (10 Versuche je Herkunft
          in 60 Minuten, AC-17).
  Ergebnis: Konto angelegt, Profilzeile durch den Trigger vorhanden, sofort angemeldet,
            Weiterleitung auf /.
  Abgelehnt wenn: gedrosselt, Format falsch, Passwort zu kurz oder zu lang, Adresse
                  bereits vergeben, oder die Person ist schon angemeldet.

- Anmelden (E-Mail, Passwort)
  Wer: jede:r Abgemeldete.
  Regeln: Vor dem Prüfen der Zugangsdaten läuft das Anmelde-Tor (5 Versuche je Adresse in
          15 Minuten, AC-8; dazu je IP, sofern eine vertrauenswürdig erkennbar ist, AC-9).
          Beim Anmelden gilt KEINE Mindestlänge für das Passwort — nur „nicht leer,
          höchstens 200 Zeichen". Sonst liefe ein kurzer Rateversuch an der Drosselung
          vorbei und das Formular verriete die Passwortregel (EC-7).
  Ergebnis: angemeldet, Zähler dieser Adresse gelöscht, Weiterleitung auf /.
  Abgelehnt wenn: gedrosselt, Zugangsdaten falsch, oder die Person ist schon angemeldet.
  Zeit: ein fehlgeschlagener Versuch wird auf mindestens 350 ms gestreckt (AC-18);
        ein geglückter nicht.

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

- Anmelde-Tor und Registrierungs-Tor (prüfen UND festhalten in einem Aufruf)
  Wer: der Server im Zuge einer Anmeldung bzw. Registrierung. Beide Aufrufe geschehen
       zwangsläufig ABGEMELDET — eine Anmeldung beginnt ohne Sitzung. Damit sind beide
       Tore für jede:n aufrufbar, der den öffentlichen Schlüssel hat; als bekannte,
       noch offene Schwäche unter „Offene Punkte" geführt.
  Warum ein Aufruf statt zwei: Eine getrennte „Zähler zurücksetzen"-Funktion müsste
       ebenfalls abgemeldet aufrufbar sein — und wäre damit der Schalter, mit dem sich
       die ganze Drosselung von außen abschalten ließe.

- Eigene Zähler zurücksetzen
  Wer: ausschließlich die angemeldete Person, ohne Argument — die Adresse kommt aus der
       Sitzung. Niemand kann fremde Zähler leeren. Räumt nur 'login'-Zeilen weg, sonst
       löste eine Anmeldung die Registrierungssperre auf.

- Zähler aufräumen (24-Stunden-Frist)
  Wer: niemand von außen — keinerlei Client-Recht. Aufgerufen vom geplanten Job und
       nebenbei von jedem Tor.

Grundsätzlich abgelehnt wird: jede Operation ohne Anmeldung, die eine verlangt, und jeder
Zugriff auf fremde Zeilen — von der Datenbank selbst, nicht erst vom Anwendungscode.
```

---

## Eingaberegeln und Fehlermeldungen

Geprüft wird **dreifach**: im Browser für die schnelle Rückmeldung, im Server Action als
verbindliche Prüfung (nur diese zählt), und in der Datenbank als letzte Instanz.

| Feld | Regel | Wo verbindlich |
|---|---|---|
| E-Mail (beide Formulare) | gültiges Format, höchstens 254 Zeichen, kleingeschrieben und randbereinigt | Schema-Prüfung im Server Action |
| Passwort **bei der Registrierung** | mindestens 10, höchstens 72 Zeichen, **keine Randbereinigung** | Server Action **und** Datenbank-Mindestlänge |
| Passwort **beim Anmelden** | nicht leer, höchstens 200 Zeichen — **keine Mindestlänge** | Schema-Prüfung im Server Action |

**Warum das Anmeldeformular keine Mindestlänge prüft** (EC-7): Die Längenregel gehört zur *Vergabe*
eines Passworts, nicht zur *Prüfung* eines eingegebenen. Prüfte sie auch beim Anmelden, scheiterte
ein Rateversuch mit kurzem Passwort schon am Schema — er liefe damit **an der Drosselung vorbei** und
würde nicht gezählt. Zweitens plauderte das Formular so die Passwortregel aus, statt schlicht
„stimmt nicht" zu sagen.

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
| Anmeldung gedrosselt | „Zu viele Fehlversuche. Bitte versuche es in {n} Minuten erneut." | Sammelzeile auf `/login` |
| Registrierung gedrosselt | „Es wurden gerade zu viele Registrierungen versucht. Bitte versuche es in {n} Minuten erneut." | Sammelzeile auf `/signup` |
| Datenbank nicht erreichbar (Anmeldung) | „Die Anmeldung ist gerade nicht möglich. Bitte versuche es in einem Moment noch einmal." | Sammelzeile |
| Datenbank nicht erreichbar (Registrierung) | „Die Registrierung ist gerade nicht möglich. Bitte versuche es in einem Moment noch einmal." | Sammelzeile |
| Sitzung abgelaufen | „Deine Sitzung ist abgelaufen. Bitte melde dich erneut an." | Hinweiszeile über der Karte auf `/login` |
| Konto gelöscht | „Dein Konto ist gelöscht. Alles Gute!" | Hinweiszeile über der Karte auf `/login` |

Die Zeile zu den Zugangsdaten ist die wichtigste: **eine unbekannte Adresse und ein falsches Passwort
erzeugen denselben Satz** (AC-7). Der gleiche Text allein genügt aber nicht — die **Antwortzeit** muss
mitspielen, und sie tut es nicht von selbst: Supabase Auth prüft bei einem bestehenden Konto den
Passwort-Hash und antwortet bei einer unbekannten Adresse sofort. Deshalb die Untergrenze von 350 ms
für jeden Fehlschlag (AC-18, TD-20). Die Drosselung sitzt in beiden Fällen davor und zählt beide Fälle
gleich.

**Zur Registrierungsmeldung** (AC-17): Sie spricht von **Versuchen**, nicht von angelegten Konten —
gezählt werden Versuche, und ein Wortlaut, der etwas anderes behauptet, wäre schlicht unwahr. Sie
nennt auch **nicht** „diese Verbindung": ohne vertrauenswürdig erkennbare IP zählen alle Versuche
gemeinsam, und dann stammen sie gerade nicht aus derselben Verbindung.

**Anmelde- und Registrierungssperre klingen verschieden, die beiden Anmelde-Fälle nicht.** Ob die
Adress-Regel oder die IP-Regel gegriffen hat, ergibt auf `/login` denselben Satz — wer den
Unterschied sähe, wüsste mehr über das System als nötig.

Bei jedem Fehler leert das Formular das Passwortfeld und behält die E-Mail-Adresse (EC-4).

---

## Schutz vor automatisiertem Erraten

### Was Supabase Auth von sich aus tut — und was nicht

| Greift | Wert | Deckt nicht ab |
|---|---|---|
| Token-Anfragen, **pro IP**, nicht veränderbar | fest, von Supabase gesetzt | verteilte Angriffe über wechselnde IPs; Credential Stuffing; einen geduldigen Angriff auf ein einzelnes Konto |
| E-Mail-, OTP- und Passwort-Reset-Wege | `[auth.rate_limit]` in `config.toml` | in PROJ-1 nicht benutzt — es gibt keine Bestätigungsmail und keinen Reset |
| Anmelde- und Registrierungsanfragen | **existiert in diesem Stack nicht** | alles |

> **Die dritte Zeile ist eine Korrektur, keine Vermutung.** Der ursprüngliche Entwurf stützte sich
> auf ein Limit von 30 Anfragen pro 5 Minuten je IP (`sign_in_sign_ups`). QA hat nachgemessen:
> `GOTRUE_RATE_LIMIT_SIGN_IN_SIGN_UPS` ist im Auth-Container gar nicht gesetzt, der Schlüssel steht
> auch in `supabase/config.toml` unter `[auth.rate_limit]` nicht — und **40 von 40**
> Direktregistrierungen gingen durch. Für Anmeldung und Registrierung gibt es hier also **keinen
> Boden**. Was diese beiden Wege schützt, muss dieses Feature selbst bauen.

### Die zwei Tore

Beide arbeiten nach demselben Muster: **eine Datenbankfunktion, die prüft und den Versuch festhält,
in einem einzigen Aufruf.** Getrennte Funktionen bräuchten eine „Zähler zurücksetzen"-Funktion, die
abgemeldet aufrufbar sein müsste — und damit der Schalter wäre, der die Drosselung abschaltet.

| | **Anmelde-Tor** (AC-8, AC-9) | **Registrierungs-Tor** (AC-17) |
|---|---|---|
| Grenze | 5 Versuche in 15 Minuten | 10 Versuche in 60 Minuten |
| Schlüssel | E-Mail-Adresse **und** IP-Adresse, getrennt gezählt | nur die Herkunft (IP) |
| Ohne vertrauenswürdige IP | **nur** die Adress-Regel; die IP-Regel entfällt | **gemeinsamer Eimer** über alle Versuche |
| Zurückgesetzt durch | eine geglückte Anmeldung (nur eigene `login`-Zeilen) | nichts — läuft nur über die Zeit ab |

Ablauf einer Anmeldung:

1. Der Server ermittelt die IP der anfragenden Person — **nur, wenn ein vertrauenswürdiger Proxy
   erklärt ist** (TD-18). Sonst gibt es keine.
2. **Vor** dem Prüfen der Zugangsdaten fragt er das Tor: Sind in den letzten 15 Minuten mindestens
   5 Versuche **zu dieser Adresse** festgehalten? Oder, falls eine IP vorliegt, mindestens 5 **von
   dieser IP**? Wenn ja, wird abgelehnt, ohne dass Supabase Auth überhaupt gefragt wird.
3. Das Tor hält den Versuch im selben Aufruf fest — **unabhängig davon, ob die Adresse überhaupt ein
   Konto hat.** Sonst wäre die Drosselung selbst der Verräter (AC-7). Ein bereits gesperrter Versuch
   wird **nicht** mitgezählt, sonst verlängerte Hämmern die Sperre endlos.
4. Es liefert zugleich, in wie vielen Sekunden es wieder geht: Die Sperre endet, sobald der
   fünftjüngste Versuch aus dem 15-Minuten-Fenster fällt. Die Meldung nennt das in aufgerundeten
   Minuten (AC-8).
5. Gelingt die Anmeldung, werden die `login`-Zeilen zu dieser Adresse gelöscht — über eine Funktion
   **ohne Argument**, die die Adresse aus der Sitzung liest, damit niemand fremde Zähler leert.
6. Antwortet Supabase Auth seinerseits mit „zu viele Anfragen", zeigt die App dieselbe
   Drosselungsmeldung — die Person soll nicht zwei Erklärungen für dasselbe sehen.

Die Registrierung läuft gleich, mit ihren eigenen Werten und ohne Schritt 5.

### Warum die beiden Tore ohne IP verschieden reagieren

Das ist die Festlegung, die das `/refine` vom 28.08.2026 getroffen hat, und sie ist der Kern von
AC-9 und AC-17. Ohne erklärten Proxy hat **keine** Anfrage eine verwertbare IP — dann stellt sich für
jedes Tor die Frage, was der leere Schlüssel bedeuten soll:

- **Beim Anmelden entfällt die IP-Regel.** Ein gemeinsamer Eimer schützt hier nichts, sondern sperrt:
  QA hat gemessen, dass fünf Fehlversuche auf eine frei erfundene Adresse jede echte Anmeldung für
  15 Minuten blockieren — ein Denial of Service, den jede:r mit fünf Anfragen auslöst. Ein Zähler,
  der Angreifer und Nutzer:innen nicht unterscheiden kann, ist als Schutz wertlos und als Ausfall
  teuer. **AC-8 je Konto trägt auch ohne IP** — deshalb kostet der Verzicht hier nichts.
- **Beim Registrieren bleibt der gemeinsame Eimer.** Hier gibt es keine Rückfallregel je Konto, weil
  jede Adresse neu ist. Der gemeinsame Zähler ist das Einzige, was massenhaftes Anlegen und das
  Durchprobieren von Adressen (AC-5 verrät, ob eine Adresse ein Konto hat) begrenzt — und die
  Plattform liefert dafür nachweislich nichts. Der Preis ist bekannt und angenommen: ohne erkennbare
  IP sind es 10 Registrierungen je Stunde **für alle zusammen**. Das trifft niemanden, der bereits
  ein Konto hat.

Sobald die App hinter einem erklärten Proxy läuft, bekommen beide Tore wieder echte, getrennte IPs
und der Unterschied verschwindet.

### Woher die IP kommt (TD-18)

`x-forwarded-for` schreibt der **Aufrufer**, und Proxys hängen an, statt zu ersetzen — der erste
Eintrag ist deshalb im Regelfall genau der Wert, den ein Angreifer behauptet. Wer ihn als Schlüssel
nimmt, lässt sich die Drosselung vom Angreifer konfigurieren.

Deshalb entscheidet die **Umgebung**, nicht der Inhalt der Anfrage: `TRUSTED_PROXY_HOPS` sagt, wie
viele vertrauenswürdige Proxys vor der App stehen.

| Wert | Verhalten |
|---|---|
| `0` (Vorgabe, auch lokal) | `x-forwarded-for` wird **gar nicht gelesen**. Es gibt keine IP. |
| `n ≥ 1` | Es zählt der `n`-te Eintrag **von rechts** — den hat der eigene Proxy angehängt; alles links davon ist frei erfunden. Ist die Kette kürzer als `n`, gilt ersatzweise `x-real-ip`, sonst keine IP. |

Sicher als Vorgabe, ausdrücklich zu lockern. **Der Wert gehört nicht in den Browser** — bewusst ohne
`NEXT_PUBLIC_`-Präfix.

### Gleiche Antwortzeiten (AC-18)

Ein wortgleicher Meldungstext nützt nichts, wenn die Uhr die Antwort verrät. Gemessen ohne
Gegenmaßnahme: 153 ms für eine registrierte, 72 ms für eine unbekannte Adresse — die Wertebereiche
überlappten nicht, eine einzige Anfrage genügte zur Unterscheidung.

**Jeder fehlgeschlagene Anmeldeversuch wird deshalb auf mindestens 350 ms gestreckt** — nur die
Differenz wird geschlafen, nicht pauschal gewartet. Der Wert liegt über dem langsamen Pfad und unter
der 500-ms-Vorgabe aus `spec.md`. Geglückte Anmeldungen werden **nicht** gebremst: sie verraten
nichts, was die Person nicht ohnehin weiß.

**Warum die Zähler in Postgres liegen und nicht bei einem Cache-Dienst:** Sie überleben einen
Neustart, brauchen kein zweites Konto und keinen weiteren Schlüssel, und die 24-Stunden-Löschung ist
in derselben Datenbank nachweisbar, in der sie entstanden sind. Der Preis ist eine zusätzliche
Datenbankabfrage pro Versuch — indizierte Zählungen, die die Vorgabe von unter 500 ms nicht
gefährden.

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

**Kein Schutz der Tore selbst.** Beide Tore sind für die Rolle `anon` freigegeben, weil eine
Anmeldung ohne Sitzung beginnt — der Schlüssel dafür steckt in jedem Browser. Damit kann jede:r die
Zähler fremder Adressen und fremder IP-Töpfe füllen und so ein Konto aussperren (gemessen: fünf
anonyme Aufrufe für ein Konto, zehn für einen IP-Topf). Bewusst offen gelassen, siehe TD-25 und
„Offene Punkte" — vor dem ersten öffentlichen Zugang zu schließen.

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
| `TRUSTED_PROXY_HOPS` | **nein, und das ist wesentlich** | Wie viele vertrauenswürdige Proxys vor der App stehen. Vorgabe `0` = keiner, dann wird `x-forwarded-for` nicht gelesen (TD-18). Steuert, ob AC-9 überhaupt greift |

`TRUSTED_PROXY_HOPS` gehört mit Vorgabewert `0` und einer Zeile Erklärung in `.env.local.example` —
ohne `NEXT_PUBLIC_`-Präfix, sonst landet die Vertrauensgrenze im ausgelieferten JavaScript.

**Einen `service_role`-Schlüssel gibt es in dieser Anwendung weiterhin nicht** — der Schlüssel, der
Row Level Security aushebelt, ist nirgends im Projekt hinterlegt (siehe TD-6). Das ist auch der
Grund, warum die offene Frage zu den Toren (TD-25) nicht einfach mit ihm gelöst wird.

---

## Settings the user makes

**Keine.** Alles, was dieses Design an Auth-Einstellungen braucht, steht in `supabase/config.toml`
im Repo und ist damit eine normale Aufgabe für `/build`, kein Klick im Dashboard:

| Einstellung | Wert | Warum | → AC |
|---|---|---|---|
| Mindestlänge des Passworts | 10 | dritte, vom Anwendungscode unabhängige Prüfung | AC-3 |
| Abmeldung bei Untätigkeit / Zwangsabmeldung | 8 h / 24 h | macht EC-3 prüfbar, schützt geteilte Rechner | EC-3 |
| E-Mail-Bestätigung | aus | Produktentscheidung in `spec.md` | AC-1 |

**Ein Anmelde- und Registrierungslimit gibt es hier nicht einzustellen.** Der Schlüssel
`sign_in_sign_ups` existiert in diesem Stack nicht — nachgemessen, siehe oben. Genau deshalb sind
AC-8, AC-9 und AC-17 vollständig selbst gebaut und hängen an keiner Plattform-Einstellung.

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
| TD-14 | ~~Fehlt die IP im Anfragekopf, greift nur die Adress-Regel~~ — **überholt, ersetzt durch TD-22 und TD-23** | Die Begründung war falsch: lokal *war* ein `x-forwarded-for` gesetzt (`::1`). Das Ergebnis gilt heute wieder — aber nur fürs Anmelden und aus einem anderen Grund; fürs Registrieren gilt das Gegenteil | — | siehe TD-22 / TD-23 | 2026-08-27 |
| TD-15 | Farb-Tokens als deckende HSL-Tripel im shadcn-Schema | Beantwortet die in `docs/design-system.md` §10 offen gelassene Frage. Das Scaffold erwartet Tripel; sie umzustellen wäre ein Eingriff in jedes Bauteil, bevor das erste Feature steht | `@theme inline` auf volle Farbwerte umstellen, damit Alpha-Rahmen erhalten bleiben | Rahmen auf Karten wirken minimal anders als in der Quelle; dafür bleibt das Standardschema unangetastet und PROJ-2 baut auf etwas Bekanntem auf | 2026-08-27 |
| TD-16 | Kein CAPTCHA, keine Prüfung auf geleakte Passwörter, keine Zwei-Faktor-Authentifizierung | So in `spec.md` entschieden: CAPTCHA bräuchte ein Anbieterkonto, die Leak-Prüfung einen kostenpflichtigen Tarif, 2FA ist außerhalb des Umfangs | Alle drei aktivieren | **Benanntes Risiko:** Automatisiertes Anlegen von Konten ist nur verlangsamt, nicht verhindert, und ein anderswo geleaktes Passwort wird hier akzeptiert. Vor dem ersten öffentlichen Zugang nachzuholen | 2026-08-27 |
| TD-17 | `/konto` als eigener angemeldeter Bereich für Abmelden und Kontolöschung | Der Header gehört laut `docs/app-shell.md` PROJ-2 und existiert beim Bau von PROJ-1 noch nicht. Ein eigener Bereich hält AC-14 und AC-15 dauerhaft prüfbar, statt sie später umziehen zu müssen | Beides auf die Platzhalter-Startseite; oder den Header vorziehen | Eine Zeile mehr in `docs/app-shell.md`; dafür hängt PROJ-1 nicht an PROJ-2, und die Kontolöschung hat auch später einen Platz | 2026-08-27 |
| TD-18 | `x-forwarded-for` wird nur mit ausdrücklich erklärtem Proxy gelesen: `TRUSTED_PROXY_HOPS` (Vorgabe `0`), dann der `n`-te Eintrag **von rechts** | Einem selbst geschriebenen Kopf sieht man nicht an, ob er echt ist. Die Vertrauensgrenze muss aus der Umgebung kommen, nicht aus dem Inhalt der Anfrage. Vorher nahm der Code den ersten Eintrag — den schreibt der Angreifer (gemessen: 14 von 14 Anmeldeversuchen durch, 16 von 16 Konten angelegt) | Weiter den ersten Eintrag nehmen und nur leere Einträge abfangen | Sicher als Vorgabe, ausdrücklich zu lockern. Ohne erklärten Proxy gibt es keine IP-Granularität — was TD-22 und TD-23 je Tor unterschiedlich auffangen | 2026-08-28 |
| TD-19 | Der Bestätigungsknopf im Löschdialog ist ein gewöhnlicher `Button type="submit"`, kein `AlertDialogAction` | `AlertDialogAction` ist bei Radix ein `Close`: der Klick schloss den Dialog und hängte das darin liegende Formular aus, bevor React das Absenden verarbeiten konnte — die Löschung löste **nichts** aus | Formular aus dem Dialog herausziehen und per `form="…"` anbinden; oder die Action aus `onClick` aufrufen | Der Dialog bleibt offen, solange gelöscht wird, und zeigt „Wird gelöscht …". Erst dadurch kann ein Fehler überhaupt sichtbar werden — vorher war der Fehlerzweig toter Code | 2026-08-28 |
| TD-20 | Jeder **fehlgeschlagene** Anmeldeversuch braucht mindestens 350 ms | Der gleiche Meldungstext nützt nichts, wenn die Uhr die Antwort verrät: gemessen 153 ms für eine registrierte, 72 ms für eine unbekannte Adresse, ohne Überlappung. Die frühere Annahme, Supabase rechne gegen einen Blindwert, war falsch | Kein Ausgleich; oder eine feste Wartezeit für alle Antworten | Nachher 375 gegen 374 ms (0,2 %), Wertebereiche überlappen. Geglückte Anmeldungen bleiben ungebremst. Unter Last gibt es Ausreißer über 500 ms — reine Arbeitszeit, nicht die Untergrenze (siehe Offene Punkte) | 2026-08-28 |
| TD-21 | Die Registrierung bekommt ein **eigenes** Tor: 10 Versuche je Herkunft in 60 Minuten | Das Limit, auf das sich der Entwurf stützte, existiert in diesem Stack nicht (40 von 40 Direktregistrierungen gingen durch). Ohne eigene Grenze ist das Anlegen von Konten unbegrenzt automatisierbar | Auf die Plattform vertrauen; oder sofort ein CAPTCHA einbauen | 10 je Stunde lässt eine Person, eine Familie oder ein kleines Büro durch und stoppt Massenanlage sofort. Ein CAPTCHA bleibt die stärkere Maßnahme und ist weiter offen (TD-16) | 2026-08-28 |
| TD-22 | **Beim Anmelden entfällt die IP-Regel, wenn keine vertrauenswürdige IP vorliegt** — kein gemeinsamer Eimer | Ein Zähler, der Angreifer und Nutzer:innen nicht unterscheiden kann, ist als Schutz wertlos und als Ausfall teuer: QA hat gemessen, dass fünf Fehlversuche auf eine erfundene Adresse **jede** echte Anmeldung 15 Minuten lang blockieren. AC-8 je Konto trägt auch ohne IP | Gemeinsamer Eimer für alle Anfragen ohne IP (der Zustand vor dem `/refine`) | Ohne erklärten Proxy gibt es beim Anmelden keinen IP-Schutz mehr — bewusst, weil er dort nur ein Denial-of-Service-Hebel war. Mit `TRUSTED_PROXY_HOPS ≥ 1` greift AC-9 wieder voll | 2026-08-28 |
| TD-23 | **Beim Registrieren bleibt der gemeinsame Eimer**, auch ohne erkennbare IP | Hier gibt es keine Rückfallregel je Konto — jede Adresse ist neu. Der gemeinsame Zähler ist das Einzige, was massenhaftes Anlegen und das Durchprobieren von Adressen (AC-5) begrenzt, und die Plattform liefert nachweislich keinen Boden | Die Regel wie beim Anmelden entfallen lassen — hieße: gar kein Schutz | Ohne erkennbare IP sind es 10 Registrierungen je Stunde für **alle zusammen**. Trifft niemanden, der schon ein Konto hat; ein zweites Konto am selben Tag geht dann eventuell nicht | 2026-08-28 |
| TD-24 | Die Drosselungsmeldung der Registrierung spricht von **Versuchen** und nennt nicht „diese Verbindung" | Gezählt werden Versuche — der Code tat das ohnehin. Eine Meldung, die von „angelegten Konten" spricht, wäre unwahr; und ohne erkennbare IP stammen die Versuche gerade **nicht** aus derselben Verbindung | Den Code auf „nur Erfolge zählen" umbauen, damit der alte Wortlaut stimmt | Wer AC-5 nutzt, um Adressen durchzuprobieren, läuft jetzt in dieselbe Sperre — das war der ausschlaggebende Nebennutzen. Der Wortlaut gibt nach, nicht der Code | 2026-08-28 |
| TD-25 | Die beiden Tore bleiben vorerst für `anon` aufrufbar — **mit benanntem Risiko** | Eine Anmeldung beginnt ohne Sitzung; das Recht lässt sich nicht entziehen, weil die App es selbst braucht. Prüfen und Festhalten zu trennen verlagert das Problem nur, und die Datenbank kann nicht erkennen, ob der Aufruf von der App kommt | Ein Geheimnis, das App und Datenbank teilen und das nicht im Repo liegt (`service_role` scheidet nach TD-6 aus) | **Benanntes Risiko:** Fünf anonyme Aufrufe sperren ein fremdes Konto, zehn einen IP-Topf. Die Kontosperre ist ohnehin über das Formular auslösbar — neu ist nur das Sperren fremder IP-Töpfe. Vor dem ersten öffentlichen Zugang zu schließen | 2026-08-28 |

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
| AC-7 | Eine einzige Fehlermeldung für beide Fälle; Drosselung zählt auch unbekannte Adressen (TD-12); gleiche Antwortzeit über TD-20 |
| AC-8 | Anmelde-Tor, Regel je E-Mail-Adresse, Restzeit in Minuten in der Meldung |
| AC-9 | Anmelde-Tor, Regel je IP-Adresse — greift nur mit erklärtem Proxy (TD-18); ohne ihn trägt allein AC-8 (TD-22) |
| AC-10 | Server Actions verschicken per POST (TD-1) |
| AC-11 | Vorprüfung in `proxy.ts` + Seitenprüfung auf `/` |
| AC-12 | Vorprüfung in `proxy.ts` für `/login` und `/signup` |
| AC-13 | Row Level Security auf `profiles`, Vergleich der Zeilen-ID mit der angemeldeten Nutzer-ID |
| AC-14 | Abmelde-Server-Action + `Cache-Control: no-store` auf geschützten Seiten (TD-11) |
| AC-15 | Bestätigungsdialog auf `/konto` (Bestätigungsknopf nach TD-19) + Datenbankfunktion mit Löschweitergabe (TD-6) |
| AC-16 | Geplanter Job + Bereinigung bei jedem Tor-Aufruf (TD-13) — für `login`- **und** `signup`-Zeilen |
| AC-17 | Registrierungs-Tor: 10 Versuche je Herkunft in 60 Minuten (TD-21); gemeinsamer Eimer ohne IP (TD-23); Meldung spricht von Versuchen (TD-24) |
| AC-18 | Untergrenze von 350 ms für jeden fehlgeschlagenen Anmeldeversuch (TD-20) |
| EC-1 | Deaktivierter Button während des Absendens (TD-9) |
| EC-2 | Eindeutigkeit der E-Mail in `auth.users` (TD-9) |
| EC-3 | Seitenprüfung leitet auf `/login?reason=session-expired`; Sitzungsgrenzen machen es prüfbar |
| EC-4 | Fehlerbehandlung im Server Action, Sammelmeldung, geleertes Passwortfeld, POST statt URL |
| EC-5 | Seitenprüfung fragt den Auth-Server, nicht das Cookie (TD-2) |
| EC-6 | Passwort wird nirgends randbereinigt (TD-10) |
| EC-7 | Beim Anmelden gilt keine Mindestlänge — kurze Rateversuche laufen ins Tor statt am Schema zu scheitern, und die Meldung nennt die Passwortregel nicht |

---

## Offene Punkte

- [ ] **Die Tore sind für jede:n mit dem öffentlichen Schlüssel aufrufbar** (TD-25). Fünf anonyme
      Aufrufe sperren ein fremdes Konto, zehn einen IP-Topf. Der Weg dorthin ist ein Geheimnis, das
      App und Datenbank teilen und das nicht im Repo liegt — `service_role` scheidet nach TD-6 aus.
      Vor dem ersten öffentlichen Zugang zu schließen. Kontext: `qa-report.md`, BUG-2.
- [ ] **AC-18 verlangt „unter 500 ms je Antwort", unter Last gibt es Ausreißer darüber.** Die
      Untergrenze aus TD-20 verursacht sie nicht — bei 509 ms echter Arbeit wird gar nicht mehr
      geschlafen. Das ist eine Frage an den Vertrag, nicht an den Code: entweder eine Toleranz in
      AC-18 (etwa ein Perzentil statt eines Maximums) oder eine Messung gegen den Produktions-Build
      als verbindliche Bedingung. Gehört in ein `/refine`.
- [ ] Die Sitzungsgrenzen (Untätigkeit 8 h, Zwangsabmeldung 24 h) sind lokal in `config.toml`
      gesetzt. Ob ein gehostetes Projekt sie im kostenlosen Tarif ebenfalls annimmt, ist erst zu
      prüfen, wenn ein solches Projekt entsteht — betrifft dann EC-3.
- [ ] `pg_cron` ist im lokalen Stack vorhanden. In einem gehosteten Projekt muss die Erweiterung
      einmalig aktiviert werden, bevor der Aufräum-Job dort läuft.

_Die offenen Punkte aus `spec.md` (CAPTCHA, Signup-Enumeration, § 132 BAO, Aufbewahrung der
Auth-Protokolle, Nachziehen von `docs/privacy.md`) bleiben offen und werden von diesem Design nicht
beantwortet — TD-16 nennt das Risiko der ersten beiden ausdrücklich._

---

## Was dieser Durchgang ändert

_Das Feature ist bereits gebaut. Gegenüber dem Stand im Repo ändert das `/refine` vom 28.08.2026
**genau zwei Dinge** — alles andere oben beschreibt, was schon steht._

| # | Änderung | Wo | → AC / TD |
|---|---|---|---|
| 1 | **Das Anmelde-Tor darf ohne verwertbare IP keinen gemeinsamen Eimer mehr bilden.** Heute zählt es mit `a.ip is not distinct from p_ip`, wodurch alle Anfragen ohne IP zusammen gezählt werden — fünf Fehlversuche sperren jede Anmeldung. Die IP-Regel muss wieder übersprungen werden, wenn keine IP vorliegt. Das **Registrierungs-Tor bleibt unverändert** bei `is not distinct from` | neue Migration in `supabase/migrations/`, nur `login_attempt_gate` | AC-9 · TD-22, TD-23 |
| 2 | **Die Drosselungsmeldung der Registrierung wird umformuliert.** Heute: „Von dieser Verbindung wurden gerade viele **Konten angelegt** …". Neu: „Es wurden gerade zu viele **Registrierungen versucht**. Bitte versuche es in {n} Minuten erneut." | `src/lib/actions/auth.ts` | AC-17 · TD-24 |

Dazu zwei Kleinigkeiten, die den Vertrag nicht berühren: `TRUSTED_PROXY_HOPS` gehört als
dokumentierte Platzhalter-Zeile in `.env.local.example`, und die Kommentare in
`src/lib/rate-limit.ts` beschreiben beim Anmelde-Tor noch die alte Eimer-Semantik.

**Nicht zu ändern:** `clientIpFrom` (TD-18 gilt unverändert), das Registrierungs-Tor, die 350-ms-
Untergrenze, die Kontolöschung.

---

## Bauhistorie

_Wie es zum Stand oben kam: Notizen aus `/build` und die Behebung der QA-Befunde, in der Reihenfolge
ihres Entstehens. **Begründung, nicht Bauanleitung** — wo eine Notiz hier dem Entwurf oben
widerspricht, gilt oben. Die vollständigen Messwerte stehen in `qa-report.md`._

### Notizen aus dem Bau

#### Die Drosselung hat zwei Funktionen statt drei — und das ist eine Sicherheitskorrektur

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

#### TD-14 war falsch: lokal gibt es sehr wohl eine IP

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

#### Kleinere Festlegungen

- **Rückmeldungen:** „Sitzung abgelaufen" und „Konto gelöscht" stehen als Hinweiszeile über der
  Karte auf `/login` (so wie in der Meldungstabelle oben). Nur das Abmelden ist ein Toast — eine
  flüchtige Bestätigung gehört nicht über ein Formular, in das man gerade wieder tippen will.
- **Wortmarke auf `text-4xl` (36px)**, einheitlich auf allen fünf Stellen — `/login`, `/signup`,
  `/`, `/konto` und dessen `loading.tsx`. Vorher `text-2xl` (24px), was neben der Kartenüberschrift
  (`text-xl`, 20px) kaum auffiel: das erste Element der Seite sah aus wie eine zweite Überschrift.
  **Bewusste Abweichung von der Skala** in `docs/design-system.md` §4.2, die bei 32px endet — die
  Skala ist dort ausdrücklich als „App-Maßstab, dicht" für Fließtext und Überschriften beschrieben;
  die Wortmarke ist ein Logo und steht außerhalb davon. Das `loading.tsx` von `/konto` trägt
  denselben Wert, sonst springt die Wortmarke beim Fertigladen.
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

---

### Nachtrag: Behebung der QA-Befunde

_Angefügt nach dem QA-Durchlauf vom 27.08.2026. Alles hier wurde gegen einen
**Produktions-Build** (`next build && next start`) verifiziert, nicht gegen `next dev` — siehe
den ersten Punkt, warum das den Unterschied macht._

#### BUG-1 war ein Fehlbefund — gemessen am falschen Server

QA meldete, geschützte Seiten trügen `no-cache` statt des in TD-11 festgelegten `no-store`.
Gemessen wurde gegen `next dev`. Im Produktions-Build tragen `/` und `/konto`
`no-store, must-revalidate` — genau den Wert, den `src/proxy.ts` setzt. TD-11 hält also.

Der Versuch, den Kopf zusätzlich über `next.config.ts` → `headers()` zu setzen, wurde wieder
zurückgenommen: Die Regel greift zwar (mit einem Testkopf nachgewiesen), aber Next.js
überschreibt `Cache-Control` bei gerenderten Seiten — im Dev-Modus mit `no-cache`, in der
Produktion mit dem Wert aus dem Proxy. Zusätzliche Konfiguration hätte nichts bewirkt.

**Die Lehre für kommende Prüfungen:** Kopfzeilen und Zwischenspeicher-Verhalten sind gegen
`next start` zu messen, nicht gegen `next dev`.

#### BUG-2 — die Antwortzeit verrät nichts mehr

Jeder **fehlgeschlagene** Anmeldeversuch braucht jetzt mindestens **350 ms**
(`MIN_FAILURE_MS` in `src/lib/actions/auth.ts`). Vorher lagen die Zeiten für eine bekannte und
eine unbekannte Adresse vollständig auseinander (153 gegen 72 ms, ohne Überlappung), weil
Supabase Auth bei einem bestehenden Konto den Passwort-Hash prüft und bei einer unbekannten
Adresse sofort antwortet. Die Annahme im Abschnitt „Die Meldungen, wortwörtlich", Supabase
rechne gegen einen Blindwert, war falsch.

Nachher: **375 gegen 374 ms**, 0,2 % Unterschied, Wertebereiche vollständig überlappend.
Die langsamste Antwort lag bei 417 ms und damit unter der Vorgabe aus `spec.md`
(Anmeldung in unter 500 ms).

Geglückte Anmeldungen werden **nicht** gebremst — sie verraten nichts, was die Person nicht
ohnehin weiß.

#### BUG-3 — die Registrierung hat jetzt eine eigene Drosselung

Das Design stützte sich auf Supabase' `sign_in_sign_ups` (30 pro 5 Minuten je IP). QA hat
nachgewiesen, dass es diesen Schutz hier nicht gibt: `GOTRUE_RATE_LIMIT_SIGN_IN_SIGN_UPS`
existiert im Auth-Container gar nicht, 40 von 40 Direktregistrierungen gingen durch.

Neu: **`signup_attempt_gate(email, ip)`** — **10 Registrierungen je IP-Adresse in 60 Minuten**,
nach demselben Muster wie das Anmelde-Tor (prüfen und festhalten in einem Aufruf, damit es keine
vom Browser aufrufbare Rücksetzfunktion braucht). Nur je IP: die Adresse ist bei jeder
Registrierung eine neue und taugt nicht als Schlüssel.

Die Tabelle `login_attempts` trägt dafür eine Spalte `kind` (`login` | `signup`). Das
Zurücksetzen nach erfolgreicher Anmeldung räumt nur `login`-Zeilen weg — sonst löste sich eine
Registrierungssperre dadurch auf, dass sich jemand anmeldet.

**Ein CAPTCHA ersetzt das nicht.** Es bleibt die stärkere Maßnahme und in `spec.md` bewusst
zurückgestellt; diese Drosselung schließt nur die Lücke, die das Design offen gelassen hat.

> **Offen: `spec.md` kennt dieses Verhalten noch nicht.** Der Vertrag hat kein Acceptance
> Criterion für die Registrierungs-Drosselung — er ist während `/build` schreibgeschützt.
> Nachzuholen mit `/refine PROJ-1`.

> **Offen: `docs/privacy.md` beschreibt nur die Anmelde-Drosselung.** Es werden jetzt auch
> Registrierungsversuche mit IP-Adresse festgehalten (dieselben 24 Stunden, dieselbe
> Rechtsgrundlage). Nachzuziehen mit `/dsgvo`.

#### BUG-4 — die Längenregel gilt nicht mehr beim Anmelden

`loginSchema` prüfte dieselbe Mindestlänge wie `signupSchema`. Das hatte zwei Folgen: Ein
Rateversuch mit einem zu kurzen Passwort scheiterte schon an der Schema-Prüfung und lief damit
**an der Drosselung vorbei** — 30 solche Versuche ergaben null gezählte Zeilen —, und das
Anmeldeformular plauderte die Passwortregel aus, statt schlicht „stimmt nicht" zu sagen.

Beim Anmelden gilt jetzt nur noch: nicht leer, höchstens 200 Zeichen. Die Längenregel gehört
zur **Vergabe** eines Passworts, nicht zur Prüfung eines eingegebenen. Nachgemessen: 5 kurze
Versuche werden gezählt, der 6. ist gesperrt, und die Meldung lautet „E-Mail-Adresse oder
Passwort stimmt nicht."

#### BUG-5 — toter Browser-Client entfernt

`src/lib/supabase/client.ts` wurde von nichts importiert. Entfernt; PROJ-2 legt ihn an, wenn
es ihn braucht.

---

### Nachtrag: Behebung von BUG-1 und BUG-2 aus dem zweiten QA-Durchlauf (28.08.2026)

#### BUG-1 — die IP-Regeln gehörten dem Aufrufer

**Der Befund.** `clientIpFrom` nahm den **ersten** Eintrag aus `x-forwarded-for`. Diesen Kopf
schreibt aber der Aufrufer, und Proxys **hängen an**, statt zu ersetzen — der erste Eintrag ist
deshalb im Regelfall genau der Wert, den ein Angreifer behauptet. Zwei Wege liefen daran vorbei:

| Weg | vorher | jetzt |
|---|---|---|
| je Anfrage eine andere IP behaupten | 14 von 14 Anmeldeversuchen durch, 16 von 16 Konten angelegt | 5 durch, 10 angelegt |
| Kopf `,1.2.3.4` (leerer erster Eintrag) | 14 von 14 durch, 14 von 14 angelegt | 5 durch, 10 angelegt |

Der zweite Weg war der schlimmere: Ein leerer erster Eintrag ließ `clientIpFrom` auf `null`
fallen, und `null` bedeutete in **beiden** Toren „Regel überspringen". Ein einziger statischer
Kopf schaltete AC-9 und AC-17 vollständig ab.

**Die Behebung hat zwei Hälften — keine genügt allein.**

*In der Datenbank* (`20260828120000_ip_bucket_not_skip.sql`): „keine erkennbare IP" ist jetzt ein
**eigener Eimer**, kein Freifahrtschein. Aus `if p_ip is not null then …` wurde
`a.ip is not distinct from p_ip`. Wer ohne verwertbare IP kommt, wird mit allen anderen zusammen
gezählt. Der frühe Ausstieg in `signup_attempt_gate` ist ersatzlos weg.

*In der Anwendung* (`src/lib/rate-limit.ts`): Der Kopf wird nur noch gelesen, wenn ein
vertrauenswürdiger Proxy davorsteht, und dann zählt der `n`-te Eintrag **von rechts** — den hat
der eigene Proxy angehängt, alles links davon ist frei erfunden und wird ignoriert.

**Warum das lokal nichts ändert.** Ohne vorgelagerten Server teilten sich bisher schon alle
Anfragen die IP `::1` und damit einen Eimer. Künftig heißt derselbe Eimer `null`. Die Sorge aus
TD-14, die Entwicklung sperre sich nach fünf Tippfehlern selbst aus, traf also ohnehin nie zu —
die Notiz „TD-14 war falsch: lokal gibt es sehr wohl eine IP" weiter oben hatte das bereits
festgehalten.

#### TD-18: Der Kopf `x-forwarded-for` gilt nur mit ausdrücklich erklärtem Proxy

| | |
|---|---|
| **Entscheidung** | `TRUSTED_PROXY_HOPS` (Vorgabe `0`) sagt, wie viele vertrauenswürdige Proxys vor der App stehen. Bei `0` wird `x-forwarded-for` **gar nicht gelesen**; bei `n` zählt der `n`-te Eintrag von rechts |
| **Begründung** | Es gibt keinen Weg, einem selbst geschriebenen Kopf anzusehen, ob er echt ist. Die Vertrauensgrenze muss deshalb aus der Umgebung kommen, nicht aus dem Inhalt der Anfrage. Sicher als Vorgabe, ausdrücklich zu lockern |
| **Alternative erwogen** | Weiter den ersten Eintrag nehmen und nur leere Einträge abfangen — hätte Variante B geschlossen und Variante A offen gelassen |
| **Abwägung** | Ohne erklärten Proxy teilen sich alle Anfragen einen Eimer: fünf Fehlversuche von irgendwem sperren die IP-Regel für alle. Das ist derselbe Zustand wie bisher lokal und der Preis dafür, dass niemand mehr aus seinem Eimer herausspringt. Sobald die App hinter einem Proxy läuft, macht `TRUSTED_PROXY_HOPS=1` daraus wieder echte, getrennte IPs |
| **Datum** | 2026-08-28 |

**Der Wert gehört nicht in den Browser** — bewusst ohne `NEXT_PUBLIC_`-Präfix.

#### BUG-2 — die Registrierung sprach von einer „Anmeldung"

`UNAVAILABLE` war eine Konstante für beide Wege. Auf `/signup` las man dadurch bei gestoppter
Datenbank „Die **Anmeldung** ist gerade nicht möglich." Jetzt gibt es `LOGIN_UNAVAILABLE` und
`SIGNUP_UNAVAILABLE`.

#### Nicht behoben, mit Begründung

- **BUG-3** (AC-18: „unter 500 ms je Antwort" reißt in Ausreißern). Die Untergrenze von 350 ms
  verursacht die Ausreißer **nicht**: `notFasterThanFloor` schläft nur die Differenz, und bei
  509 ms echter Arbeit schläft es gar nicht mehr. Sie zu senken änderte an genau den Antworten
  nichts, die über 500 ms lagen. Die Ausreißer sind reine Arbeitszeit unter Last. Damit ist das
  eine Frage an den Vertrag (`/refine` auf AC-18), nicht an den Code.
- **BUG-4** (die Registrierungssperre zählt Versuche statt angelegter Konten). Betrifft den
  Wortlaut von AC-17 und gehört deshalb zuerst in ein `/refine`.

---

### Nachtrag: Behebung von BUG-4 aus dem E2E-Durchlauf (28.08.2026)

**Der Befund.** Der Knopf „Endgültig löschen" im Bestätigungsdialog löste **nichts** aus: keine
einzige Anfrage ging hinaus, das Konto blieb bestehen — und der Dialog schloss sich, als wäre es
erledigt. Ein stiller Fehlschlag auf genau dem Weg, über den `spec.md` das Löschrecht aus
Art. 17 DSGVO einlöst.

**Die Ursache, in der Quelle nachgelesen statt vermutet.** `AlertDialogAction` ist bei Radix ein
`DialogPrimitive.Close` (`node_modules/@radix-ui/react-alert-dialog/dist/index.mjs:85`), und dessen
Klick-Handler ist `composeEventHandlers(props.onClick, () => context.onOpenChange(false))`. Der Klick
schließt also den Dialog. Weil das `<form action={formAction}>` **innerhalb** von
`AlertDialogContent` liegt, wurde es dabei ausgehängt, bevor React das Absenden verarbeiten konnte.

**Warum `e.preventDefault()` keine Lösung gewesen wäre:** Es hätte zwar Radix' Schließen unterbunden
(`composeEventHandlers` prüft `defaultPrevented`), zugleich aber das Absenden des Formulars selbst
verhindert — der Knopf ist ein `type="submit"`.

#### TD-19: Der Bestätigungsknopf ist ein gewöhnlicher Button, kein `AlertDialogAction`

| | |
|---|---|
| **Entscheidung** | Im Löschdialog steht `<Button type="submit" variant="destructive">` statt `AlertDialogAction` |
| **Begründung** | Der Dialog darf sich nicht schließen, solange die Action läuft — sonst verschwindet das Formular unter ihr |
| **Alternative erwogen** | Das Formular aus dem Dialoginhalt herausziehen und den Knopf über `form="..."` anbinden; oder die Action aus einem `onClick` heraus aufrufen statt über ein Formular |
| **Abwägung** | Der Dialog bleibt jetzt offen, solange gelöscht wird, und zeigt „Wird gelöscht …". Das ist nicht nur hinnehmbar, sondern die Voraussetzung dafür, dass `state.formError` überhaupt je sichtbar wird — vorher war der Dialog beim Eintreffen eines Fehlers längst zu, der im Bauteil vorgesehene Fehlerfall also toter Code |
| **Datum** | 2026-08-28 |

#### Zwei Nebenwirkungen des neuen `tests/`-Verzeichnisses

- **Vitest sammelte die Playwright-Datei ein** und brach mit „Playwright Test did not expect
  test.beforeEach() to be called here" ab — `npm test` war rot bei 38 grünen Tests. `vitest.config.ts`
  sammelt jetzt ausdrücklich nur `src/**`.
- **Die E2E-Suite braucht `workers: 2` und `timeout: 90s`.** Acht gleichzeitige Registrierungen
  überlasten `next dev`, und eine Journey durchläuft mehrere Seiten und Server Actions. Beides ist
  Testumgebung, nicht Produktverhalten: dieselben Tests sind seriell grün, und die Antwortzeiten
  misst `/qa` gegen den Produktions-Build.

---

### Nachtrag: Was das `/refine` vom 28.08.2026 entschieden hat

Der zweite QA-Durchlauf ließ drei Befunde offen, weil sie nicht dem Code galten, sondern dem
Vertrag. Das `/refine` hat sie entschieden; dieses Design ist oben entsprechend nachgezogen.

| Befund | Entscheidung | Folge für den Code |
|---|---|---|
| **BUG-1 High** — ohne erklärten Proxy sperren fünf Anfragen die Anmeldung für alle | AC-9 gilt nur noch hinter einem erklärten Proxy; ohne ihn trägt beim Anmelden allein AC-8, und **kein** Anmeldeversuch wandert in einen gemeinsamen Zähler (TD-22) | eine Migration: `login_attempt_gate` überspringt die IP-Regel ohne IP wieder |
| **BUG-3 Low** — AC-17 zählt Versuche, nicht angelegte Konten | Der Wortlaut gibt nach, nicht der Code: AC-17 zählt ausdrücklich Versuche, und die Meldung sagt das auch (TD-24). Ausschlaggebend war der Nebennutzen — sonst ließe sich über AC-5 unbegrenzt durchprobieren, wer hier ein Konto hat | eine neue Formulierung in `src/lib/actions/auth.ts` |
| **BUG-2 Medium** — die Tore sind anonym aufrufbar | Bleibt vorerst, mit benanntem Risiko (TD-25). Kein billiger Ausweg: Das Recht lässt sich nicht entziehen, Trennen verlagert nur, und die Datenbank erkennt den Aufrufer nicht. Es braucht ein geteiltes Geheimnis außerhalb des Repos | keine — als offener Punkt geführt, fällig vor öffentlichem Zugang |

**Die Asymmetrie zwischen AC-9 und AC-17 ist der Kern dieser Runde** und keine Inkonsequenz: Beim
Anmelden gibt es mit AC-8 eine Rückfallregel je Konto, beim Registrieren nicht. Ein gemeinsamer
Zähler ist deshalb dort ein Ausfall und hier der einzige Schutz.

---

### Nachtrag: Bau der Ebenen 9 und 10 (28.08.2026)

Umgesetzt wie in „Was dieser Durchgang ändert" beschrieben, ohne Abweichung vom Entwurf.

**Nachgewiesen gegen die Datenbankfunktionen**, mit Gegenprobe (alter Funktionsstand in einer
Transaktion wiederhergestellt, Befund reproduziert, `rollback`):

| Prüfung | Ergebnis |
|---|---|
| AC-9 / TD-22 — sechs Fehlversuche ohne IP auf erfundene Adressen | echte Anmeldung kommt durch (`blocked = f`). **Gegenprobe:** alter Stand sperrt sie 900 s lang |
| AC-8 — fünf Versuche auf dieselbe Adresse, ohne IP | sechster gesperrt, Restzeit 900 s |
| AC-9 mit erklärtem Proxy — fünf Adressen von `203.0.113.7` | sechste Adresse derselben IP gesperrt; andere IP kommt durch |
| AC-17 / TD-23 — zehn Registrierungsversuche ohne IP | elfter gesperrt, Restzeit 3600 s (gemeinsamer Eimer unverändert) |

`npm run lint` sauber · `npm test` 45 Tests grün · `npm run build` erfolgreich ·
`npm run test:e2e` 8 von 8 grün, Chrome und Mobile Safari.

**Eine Beobachtung für `/qa`, nicht in diesem Durchgang verursacht:** Der Produktions-Build weist
`/signup` als statisch vorgerendert aus (`○`), während die Routentabelle oben für alle vier Routen
„dynamisch, `no-store`" führt. Sicherheitsrelevant ist das nicht — die Seite trägt keine
Nutzerdaten, und die Weiterleitung aus AC-12 sitzt in `proxy.ts`, das für jede Anfrage läuft. Die
Tabelle und der Build widersprechen sich hier trotzdem; das gehört geprüft und entweder korrigiert
oder in der Tabelle festgehalten.
