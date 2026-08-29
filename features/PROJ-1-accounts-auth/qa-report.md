# QA-Bericht — PROJ-1: Konto & Anmeldung

**Getestet:** 2026-08-29 (siebter Durchlauf, nach der Behebung von BUG-1 und BUG-2 aus Lauf 6)
**Gemessen gegen:** Produktions-Build (`npm run build && npm run start`), lokaler Supabase-Stack auf Port 55321
**Grundlage:** `spec.md` (18 AC, 7 EC) in der Fassung vom 28.08.2026 · `design.md` nach `/architecture`, inkl. TD-26

> **Wie geprüft wurde.** Die Server Actions wurden über den echten Formularweg aufgerufen — GET der
> Seite, die versteckten `$ACTION_*`-Felder auslesen, multipart-POST auf dieselbe URL, ohne
> `Next-Action`-Kopf. Weiterleitungen wurden **nicht** gefolgt, damit Status, `Location` und
> `Set-Cookie` roh sichtbar bleiben. Datenbankfunktionen wurden zusätzlich direkt geprüft, wo eine
> IP frei übergeben werden musste.
>
> **Der Server wurde bewusst OHNE `GATE_SECRET` auf der Kommandozeile gestartet.** Nur so ist
> nachweisbar, dass der Wert tatsächlich aus `.env.local` kommt — das war der offene Punkt T36.

---

## Was dieser Durchlauf gegenüber dem letzten ändert

| Befund aus Lauf 6 | Stand jetzt |
|---|---|
| **BUG-2 Medium** — die Drosselungs-Tore sind unauthentifiziert aufrufbar; fünf anonyme Aufrufe sperren ein fremdes Konto | **geschlossen** (TD-26). Zehn anonyme Aufrufe hinterlassen **null** Zeilen, und die echte Anmeldung derselben Adresse geht danach durch (HTTP 303). Stand seit Lauf 4 offen |
| **BUG-1 Low** — bei nicht erreichbarer Datenbank dauert die Antwort 60 Sekunden | **geschlossen.** Vier Messungen in zwei Ausfallvarianten: **2,03–2,05 s** statt 60 s |
| **`T24` / `T36` — die `[user]`-Aufgaben** | **T36 erstmals verifiziert:** das Geheimnis kommt aus `.env.local`. `T24` bleibt offen, siehe *Not Verified* |
| — | **Neu gemessen: BUG-1 Low** — die 500-ms-Zusage aus AC-18 reißt bei der ersten Anfrage nach einem Serverstart (717 ms) und vereinzelt unter Last |

---

## Acceptance Criteria

### Registrierung

- [x] **AC-1** — gültige Daten → HTTP 303, `Location: /`, Sitzungs-Cookie `sb-127-auth-token` gesetzt · *Evidenz: Formular-POST auf `/signup`*
- [x] **AC-2** — Profilzeile entsteht ohne weiteren Schritt · *Evidenz: `left join public.profiles` über beide in diesem Lauf angelegten Konten → je `true`*
- [x] **AC-3** — Passwort mit 8 Zeichen → „Dein Passwort braucht mindestens 10 Zeichen." am Feld, kein Konto
- [x] **AC-4** — kaputtes E-Mail-Format → „Bitte gib eine gültige E-Mail-Adresse ein." am Feld, kein Konto
- [x] **AC-5** — vergebene Adresse → „Diese E-Mail-Adresse hat schon ein Konto. Melde dich an.", kein zweites Konto

### Anmeldung

- [x] **AC-6** — richtige Zugangsdaten → HTTP 303, `Location: /`, Sitzungs-Cookie gesetzt; `/konto` zeigt danach die eigene Adresse

### Schutz vor automatisiertem Erraten

- [x] **AC-7** — unbekannte Adresse und falsches Passwort ergeben denselben Satz „E-Mail-Adresse oder Passwort stimmt nicht." · *Evidenz: beide Wege einzeln, Meldungsmengen identisch und einelementig*
- [x] **AC-8** — 5 Fehlversuche je Adresse in 15 Min → der 6. abgelehnt mit „Zu viele Fehlversuche. Bitte versuche es in 15 Minuten erneut." · *Evidenz: 7 Formular-POSTs; danach unverändert 5 Zeilen — und nach 25 weiteren Versuchen immer noch 5, Weiterhämmern verlängert also nichts*
- [x] **AC-9** — die IP-Regel greift nur hinter erklärtem Proxy; ohne ihn trägt allein AC-8 · *Evidenz vierteilig:*
  - *(a) 5 Fehlversuche auf erfundene Adressen sperren eine echte Anmeldung **nicht** → HTTP 303*
  - *(b) mit `p_ip` direkt: 5 Adressen von `203.0.113.7` → 6. Aufruf `(t, 899)`; andere IP kommt durch*
  - *(c) ohne IP (`p_ip = NULL`): 7 Aufrufe auf 7 Adressen → **kein einziger** gesperrt, kein gemeinsamer Eimer*
  - *(d) gefälschter `X-Forwarded-For` mit wechselnder IP: `ip`-Spalte bleibt leer, gesperrt wird erst der 6. Versuch über die Adress-Regel*
- [x] **AC-10** — beide Formulare tragen `method="POST"`; keine Zugangsdaten in einer URL
- [x] **AC-17** — 10 Registrierungsversuche je Herkunft in 60 Min, **gezählt werden Versuche** · *Evidenz: 12 POSTs auf eine bereits vergebene Adresse — kein neues Konto, Versuch 11 und 12 gesperrt mit „Es wurden gerade zu viele Registrierungen versucht. Bitte versuche es in 60 Minuten erneut."; 10 gezählte `signup`-Zeilen*
- [x] **AC-18** — Antwortzeiten ununterscheidbar · *Evidenz: 15 Messungen je Gruppe, Zähler vor jeder geleert → Median **362 ms gegen 362 ms = 0,00 %** Abweichung, Bereiche 357–404 und 357–459 ms überlappen, 0 von 30 ≥ 500 ms*
  - ⚠️ **Die Zusage „unter 500 ms je Antwort" hält aber nicht durchgehend:** die erste Anfrage nach einem Serverstart braucht 717 ms, und unter Nebenläufigkeit traten vor dem Aufwärmen 7 von 36 Antworten über 500 ms auf (Maximum 952 ms). Nach dem Aufwärmen: 0 von 48, Maximum 464 ms. → **BUG-1**, und zwar am Vertrag, nicht am Seitenkanal: der Schutz, um den es AC-18 geht, ist voll erfüllt

### Zugriffsschutz

- [x] **AC-11** — abgemeldet: `/` und `/konto` → HTTP 307, `Location: /login`
- [x] **AC-12** — angemeldet: `/login` und `/signup` → HTTP 307, `Location: /`; geschützte Seiten liefern demselben Cookie 200
- [x] **AC-13** — Konto A bekommt die Daten von B auch an der Datenbank-Schnittstelle vorbei nicht · *Evidenz mit zwei echten Konten und ihren JWTs: A liest `profiles` → nur die eigene Zeile; gezielte Abfrage auf Bs ID → `[]`; UPDATE → `[]`; DELETE → `permission denied`; `login_attempts` auch angemeldet → HTTP 403; ohne Anmeldung → HTTP 401*

### Abmelden

- [x] **AC-14** — Abmelden → HTTP 303 auf `/login?reason=signed-out`, Cookie geleert; geschützte Seiten tragen `Cache-Control: no-store, must-revalidate` · *Evidenz: Formular-POST + `curl -I`; Zurück-Button durch E2E Journey 3*
  - *Nachgeprüft: das **alte** Cookie liefert danach HTTP 200, aber **keinen** geschützten Inhalt — im Rumpf steht `NEXT_REDIRECT;replace;/login?reason=session-expired`, weder Adresse noch „Konto löschen". Der 200er ist die Streaming-Antwort von Next.js, nicht ausgelieferter Inhalt*

### Kontolöschung und Aufbewahrung

- [x] **AC-15** — Löschung entfernt Konto und Profil, erneute Anmeldung schlägt fehl · *Evidenz: A löscht sich per RPC → HTTP 204; **B bleibt bestehen**; erneute Anmeldung als A → `invalid_credentials`. Die Funktion nimmt kein Argument und ist für `anon` gesperrt. Dialogweg durch E2E Journey 4*
- [x] **AC-16** — Zeilen älter als 24 h werden gelöscht, `login` **und** `signup` · *Evidenz: drei Zeilen eingefügt (2× 25 h alt, 1× 1 h) → nach `cleanup_login_attempts()` bleibt nur die frische. `pg_cron`-Job `cleanup-login-attempts | 0 * * * *` vorhanden*

**18 von 18 Acceptance Criteria erfüllt** — mit dem benannten Vorbehalt zur 500-ms-Zusage in AC-18.

---

## Edge Cases

- [x] **EC-1** — Doppelklick erzeugt genau ein Konto · *Evidenz: zwei gleichzeitige Registrierungen → 1 Konto. Der eigentliche Schutz ist der gesperrte Knopf (`disabled={isPending}`, `signup-form.tsx:96`), belegt durch E2E Journey 1*
- [x] **EC-2** — beim Rennen gewinnt genau eine Registrierung, die andere erhält die Meldung aus AC-5 · *Evidenz: 3 Rennen mit gemeinsamer Barriere → jedes Mal ein 303 und ein „Diese E-Mail-Adresse hat schon ein Konto."; je Adresse genau 1 Zeile in `auth.users`*
- [x] **EC-3** — Sitzungsgrenzen gesetzt (`timebox = "24h"`, `inactivity_timeout = "8h"`, `config.toml:277,279`); die Hinweiszeilen für `session-expired` und `deleted` erscheinen
- [x] **EC-4** — bei angehaltener Datenbank erscheint je Weg eine eigene, verständliche Meldung; das Passwort taucht in der Antwort nicht auf · *Evidenz: `docker pause` in zwei Varianten (DB + Auth, und nur DB) → `/login` und `/signup` je mit eigener Meldung, **in 2,03–2,05 s** statt 60 s; kein Konto angelegt; die Registrierung behauptet nicht fälschlich „schon ein Konto"*
- [x] **EC-5** — nach dem Löschen im ersten Tab liefert der zweite keinen geschützten Inhalt mehr, sondern die Weiterleitung auf `/login?reason=session-expired`. Kein Absturz
- [x] **EC-6** — Randleerzeichen im Passwort werden bei Registrierung und Anmeldung identisch behandelt · *Evidenz: Registrierung mit `"  MitLeerzeichen1  "` → 303; Anmeldung **mit** → 303; **ohne** → abgelehnt*
- [x] **EC-7** — kurze Rateversuche zählen zur Drosselung, die Meldung nennt die Passwortregel nicht · *Evidenz: Anmeldung mit `abc` → „E-Mail-Adresse oder Passwort stimmt nicht." und eine gezählte Zeile*

**7 von 7 Edge Cases erfüllt.**

---

## Security Audit

- [x] **Die Drosselungs-Tore sind nicht mehr fremdsteuerbar (BUG-2 aus Lauf 6, geschlossen)** — der Angriff, der vorher ein Konto 15 Minuten sperrte, läuft jetzt vollständig ins Leere · *Evidenz, sechs Wege:*
  - *10 anonyme Aufrufe gegen eine bekannte Adresse → **0 Zeilen** in `login_attempts`; die echte Anmeldung danach → HTTP 303*
  - *geratenes Geheimnis → HTTP 401 · Registrierungs-Tor ebenso → HTTP 401*
  - *die alte zweiargumentige Signatur existiert nicht mehr → `PGRST202`*
  - *`private.gate_secret` über die Schnittstelle → HTTP 404 · `set_gate_secret` → `PGRST202`*
  - *auch **angemeldet** (nicht nur `anon`) ohne Geheimnis → HTTP 403*
- [x] **Das Geheimnis erreicht den Browser nicht** — Wert 0 Treffer in `.next/static`, 0 Treffer in allen 20 vom `/login` ausgelieferten JS-Dateien, 0 Treffer in `supabase/`, `src/` und `features/`. Die 2 Treffer von `GATE_SECRET` in `.next/server` sind der Variablenname im Server-Code, nicht der Wert
- [x] **Authentifizierungs-Umgehung** — geschützte Routen ohne Sitzung → 307 auf `/login`, kein Inhalt
- [x] **Autorisierung über Kontogrenzen** — siehe AC-13; der gezielte Zugriff auf eine fremde ID liefert `[]` statt eines Fehlers, der die Existenz verriete
- [x] **Zugriff ohne jede Anmeldung** — `profiles` und `login_attempts` antworten dem öffentlichen Schlüssel mit HTTP 401
- [x] **`delete_own_account` ist nicht anonym aufrufbar** — `has_function_privilege('anon', …)` → `false`
- [x] **Injection** — 5 Nutzlasten an **beide** Wege, darunter `x'; drop table public.login_attempts;--` und eine, die gezielt `private.set_gate_secret()` unterzuschieben versucht · *Evidenz: alle scheitern an der Schema-Prüfung, kein Konto entsteht, `login_attempts` existiert unverändert, **das hinterlegte Geheimnis ist unverändert**, Rückschreibung ins Formular escaped*
- [x] **Brute Force auf Zugangsdaten** — 6. Anmeldeversuch gesperrt, 11. Registrierungsversuch gesperrt; nach 25 Versuchen unverändert 5 gezählte Zeilen
- [x] **Kontoexistenz wird nicht verraten (Anmeldung)** — gleiche Meldung *und* gleiche Antwortzeit, siehe AC-7 und AC-18
- [x] **Massenhaftes Anlegen von Konten** — durch AC-17 begrenzt, auch ohne erkennbare IP (TD-23)
- [x] **Weitere Secrets im Bundle** — kein `service_role`, kein `sb_secret`, kein JWT-Secret, auch nicht als Base64-Fragment (je 0 Treffer in `.next/static`)
- [x] **Zugangsdaten in der URL** — beide Formulare POSTen
- [x] **Sicherheits-Header** — alle vier Header auf allen vier Routen (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: origin-when-cross-origin`, `Strict-Transport-Security … includeSubDomains`)
- [x] **`.env`-Dateien im Repo** — nur `.env.local.example` ist versioniert
- [!] **Drosselung gewöhnlicher Endpunkte** — NOT VERIFIED: PROJ-1 hat außer den Auth-Wegen keine eigenen Endpunkte (`find src/app -name 'route.ts'` → 0 Treffer)

**14 Prüfungen verifiziert, 1 NOT VERIFIED.** Erstmals seit Lauf 3 ist **keine** davon negativ ausgefallen.

---

## Automatisierte Tests

- **Unit- und Integrationstests:** `npm test` → **72 Tests in 5 Dateien, alle grün** (vorher 63).
  Die 9 neuen stammen aus dem `/build`-Lauf und decken beide Behebungen ab: dass die Frist eine
  **echte** Frist ist, dass das Geheimnis aus der Umgebung mitgeht, dass ein fehlender Wert zum
  leeren Text wird statt zu `undefined`, und dass die Ablehnung der Datenbank als Störung gilt.
  Der Rot-Nachweis dazu ist im Build-Bericht geführt — er hat dort **einen zu schwachen Test
  aufgedeckt**: die erste Fassung prüfte nur, *dass* ein `AbortSignal` mitgeht, und blieb grün, als
  die Frist testweise entfernt wurde. Die Tests horchen jetzt direkt auf `AbortSignal.timeout`.
- **Lint:** `npm run lint` ohne Befund.
- **Build:** `npm run build` erfolgreich.
- **Neue Tests in diesem QA-Lauf:** keine. Die Abdeckung wurde geprüft, nicht ergänzt — die beiden
  Behebungen sind bereits testseitig abgesichert, und die eine verbleibende Lücke lässt sich in
  Vitest nicht schließen (siehe *Beobachtung ohne Bug-Status*).

## E2E Tests

**8 von 8 grün** (Chromium und Mobile Safari, 1,3 min) — als Regression gegen den Produktions-Server.
Journeys: Registrieren · Anmelden · Abmelden inkl. Zurück-Button · Konto löschen über den Dialog.

## Regression

`features/INDEX.md` führt **kein** Feature mit Status *Deployed*; PROJ-2 und PROJ-3 stehen auf
*Roadmap*. Die Regression von PROJ-1 gegen sich selbst ist oben abgedeckt: alle 18 AC und 7 EC in
diesem Lauf neu geprüft, 72 Unit-Tests, 8 E2E.

**Besonders geprüft, weil die Behebung tief in den Auth-Pfad eingreift:** Die Tore verlangen jetzt
ein zusätzliches Argument, und beide alten Signaturen wurden gelöscht. Nachgewiesen ist deshalb
nicht nur, dass der Angriff scheitert, sondern auch, dass **die App selbst weiterhin zählen darf** —
AC-8 sperrt beim 6. Versuch, AC-17 beim 11., und der Abschluss-Durchstich (Registrieren → Kontoseite
→ Anmelden) läuft durch.

---

## Not Verified In This Run

- [!] **`T24` (`[user]`): die Zeile `TRUSTED_PROXY_HOPS=0` in `.env.local.example`** — die Datei ist für Claude nicht lesbar (Zugriff verweigert), der Haken stammt aus einem früheren Lauf. **Die Schutzwirkung selbst ist verifiziert**: ohne gesetzte Variable gilt die sichere Vorgabe `0`, und der gefälschte `X-Forwarded-For` wurde nachweislich ignoriert. Dasselbe gilt für die Platzhalter-Zeile `GATE_SECRET` — dass der **Wert** in `.env.local` steht, ist dagegen erstmals belegt (T36).
- [!] **Ein vollständiger Neuaufbau der Datenbank** (`supabase db reset`) — nicht ausgeführt, weil er das lokale Demokonto und das hinterlegte Geheimnis löschen würde. Die neue Migration ist als Einzelschritt sauber eingespielt (`migration list` führt alle sieben), aber die Kette von null wurde in diesem Lauf nicht durchgespielt.
- [!] **Wie die Seiten aussehen** — der Schein hinter der Auth-Karte und die Wortmarkengröße sind als CSS und Markup geprüft, nicht als Bild.
- [!] **Darstellung auf verschiedenen Bildschirmbreiten** (375 / 768 / 1440 px) — kein Viewport in `/qa`.
- [!] **Andere Browser als Chromium und WebKit** — Firefox ist in keiner Suite konfiguriert.
- [!] **Alles, was die Entwicklerwerkzeuge braucht** — Konsolenausgaben im Browser, Netzwerk-Tab, berechnete Stile.
- [!] **Rein clientseitige Interaktionen** — Fokusführung im Löschdialog, Tastaturbedienung, Animationen.
- [!] **Der tatsächliche Ablauf der Sitzung nach 8 bzw. 24 Stunden** (EC-3) — geprüft sind die gesetzten Werte und die Hinweiszeile, nicht das Verstreichen der Zeit.
- [!] **Drosselung gewöhnlicher Endpunkte** — PROJ-1 hat keine.

---

## Bugs

### BUG-1: Die 500-ms-Zusage aus AC-18 hält nicht bei kaltem Server und nicht unter Last

- **Severity:** Low · **Status:** offen · **Betrifft:** AC-18 · Vertragsfrage, kein Codefehler
- **Was passiert:** AC-18 schließt mit „bei weiterhin unter 500 ms je Antwort". Das hält im
  eingeschwungenen Zustand mühelos (30 serielle Messungen: Maximum 459 ms; 48 Messungen unter Last
  nach dem Aufwärmen: Maximum 464 ms, **0** über der Grenze). Es hält **nicht**:
  - bei der **ersten Anfrage nach einem Serverstart**: gemessen **717 ms**, danach sofort 361 ms;
  - **unter Nebenläufigkeit vor dem Aufwärmen**: 7 von 36 Antworten ≥ 500 ms, Maximum 952 ms.
- **Reproduktion:** Server neu starten, danach seriell fehlgeschlagene Anmeldungen absetzen —
  Anfrage 1 liegt über 500 ms, Anfrage 2 bis 10 bei ~370 ms.
- **Ursache:** Kaltstart des Servers, nicht die Untergrenze aus TD-20. Die 350-ms-Schwelle schläft
  nur, solange noch Zeit übrig ist; bei 717 ms echter Arbeit tut sie gar nichts mehr. Sie zu senken
  änderte an den Ausreißern nichts.
- **Ausdrücklich nicht die Ursache: die Behebungen aus diesem Durchgang.** Der eingeschwungene
  Zustand liegt bei 362 ms und damit im selben Bereich wie in Lauf 6 (361/358 ms) — die zusätzliche
  Prüfung des Geheimnisses kostet nichts Messbares, weil die 350-ms-Untergrenze sie ohnehin
  überdeckt.
- **Warum nur Low, obwohl eine Zahl im Vertrag gerissen wird:** Der **Schutzzweck** von AC-18 ist
  voll erfüllt — die Antwortzeiten für registrierte und unbekannte Adressen sind mit 0,00 %
  Abweichung ununterscheidbar. Der Kaltstart trifft beide Gruppen gleichermaßen und verrät nichts.
  Was reißt, ist eine Leistungszusage, kein Sicherheitsmerkmal.
- **Wohin das gehört:** `/refine PROJ-1`. Der Punkt steht schon als offene Frage in `design.md` und
  wurde in Lauf 4 als BUG-3 gemeldet; Lauf 6 hat ihn nicht reproduziert, dieser Lauf schon. Zwei
  saubere Auswege: ein Perzentil statt eines Maximums in AC-18, oder die Messung ausdrücklich am
  eingeschwungenen Produktions-Build festmachen.

---

## Beobachtung ohne Bug-Status

**Die Kontosperre aus AC-8 bleibt für jede:n auslösbar, der eine E-Mail-Adresse kennt** — über das
Anmeldeformular, fünf Absendungen. Das ist keine Lücke in der Umsetzung, sondern eine Eigenschaft der
Regel selbst: Wer je Konto drosselt, gibt jedem die Möglichkeit, dieses Konto 15 Minuten zu
blockieren. **Neu ist seit TD-26 nur, dass es nicht mehr billiger geht als über das Formular** — der
direkte RPC-Weg ist zu. Die Gegenmaßnahme wäre ein CAPTCHA; es steht in `spec.md` als offene Frage.

**Eine Testlücke, die sich in Vitest nicht schließen lässt.** Die eigentliche Sicherheitszusage von
TD-26 — dass ein abgelehnter Aufruf **keine Zeile** in `login_attempts` schreibt — ist eine
Eigenschaft der Datenbankfunktion, nicht des Anwendungscodes. In diesem Lauf ist sie live
nachgewiesen (10 Angriffsaufrufe → 0 Zeilen), aber kein automatischer Test bewacht sie: Vitest
ersetzt den Supabase-Client, und die E2E-Suite deckt die Drosselung bewusst nicht ab. Ein
dauerhafter Wächter bräuchte einen Testweg gegen die echte Datenbank, den das Projekt heute nicht
hat. Gehört dem Produkt vorgelegt, nicht still im Code gelöst.

---

## Summary

- **Acceptance Criteria:** **18 von 18 erfüllt** — mit dem benannten Vorbehalt zur 500-ms-Zusage in AC-18
- **Edge Cases:** **7 von 7 erfüllt**
- **Bugs:** 0 Critical · 0 High · 0 Medium · **1 Low** (BUG-1, Vertragsfrage an AC-18)
- **Geschlossen und in diesem Lauf bestätigt:** BUG-2 (Medium, seit Lauf 4 offen) und BUG-1 (Low) aus Lauf 6
- **Security:** **14 Prüfungen verifiziert, 1 NOT VERIFIED** — erstmals seit Lauf 3 keine negativ
- **Tests:** 72 Unit-/Integrationstests grün · 8 von 8 E2E grün · Lint und Build grün
- **Production Ready:** **JA** — kein Critical-, High- oder Medium-Befund, und alle 18 AC wurden in
  diesem Lauf gegen die laufende Anwendung ausgeführt.

**Das „JA" ist eine Aussage über gefundene Fehler, nicht über vollständige Abdeckung.** Ein
Low-Befund steht offen, und die Liste unter *Not Verified In This Run* ist nicht leer — insbesondere
wurde **nicht geprüft, wie die Seiten aussehen**, weder auf verschiedenen Bildschirmbreiten noch in
anderen Browsern, und ein vollständiger Neuaufbau der Datenbank aus den Migrationen wurde bewusst
nicht durchgespielt.
