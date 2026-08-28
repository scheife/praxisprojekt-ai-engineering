# QA-Testbericht — PROJ-1: Konto & Anmeldung

**Getestet:** 2026-08-28 (dritter Durchlauf, nach der Behebung von BUG-1 und BUG-2 des zweiten Laufs)
**App-Adresse:** `http://localhost:3000` — **Produktions-Build** (`npm run build && npm run start`), Supabase in Docker auf Port 55321
**Konfiguration:** Vorgabe, also **ohne** gesetztes `TRUSTED_PROXY_HOPS` (= 0, kein vertrauenswürdiger Proxy)
**Tester:** QA Engineer (AI)

> Legende: `[x]` in diesem Durchlauf verifiziert (mit Beleg) · `[ ] BUG` als defekt nachgewiesen ·
> `[!] NICHT VERIFIZIERT` in diesem Durchlauf nicht prüfbar (mit Grund)

Alle Prüfungen liefen neu gegen die laufende App — nichts ist aus den früheren Berichten übernommen.
Die Formulare wurden über die Progressive-Enhancement-Felder der Server Actions abgeschickt, also so,
wie ein Browser es tut. Prüfskripte im Scratchpad unter `qa/r3_*.py`.

**Ausgangslage:** Datenbank auf 0 Konten zurückgesetzt, `login_attempts` zwischen den Messungen
geleert, damit sich die Prüfungen nicht gegenseitig blockieren.

---

## Was aus dem letzten Durchlauf geschlossen wurde

| Befund (2. Lauf) | Ergebnis dieses Laufs |
|---|---|
| **BUG-1 High** — IP-Regeln über `X-Forwarded-For` abschaltbar | **geschlossen**, in drei Varianten nachgemessen (rotierende IP, leerer erster Eintrag, Kette) — je 5 von 14 Anmeldungen durch statt 14, je 10 von 14 Konten statt 14/16 |
| **BUG-2 Low** — „Die *Anmeldung* ist gerade nicht möglich" auf `/signup` | **geschlossen**: `/login` und `/signup` haben jetzt eigene Sätze |
| **BUG-3 Low** — 500-ms-Zusage riss in Ausreißern | **nicht reproduziert**: 0 von 48 Antworten über 500 ms (max 379 ms). Siehe AC-18 — die Reserve bleibt knapp |
| **BUG-4 Low** — AC-17 zählt Versuche statt angelegter Konten | **unverändert offen**, bewusst nach `/refine` verschoben. Hier als BUG-3 neu gezählt |

---

## Acceptance Criteria

### Registrierung

#### AC-1 — Konto anlegen, sofort angemeldet, landet auf `/`
- [x] `HTTP 303`, `location: /`; danach `/` mit `HTTP 200` und der Platzhalterseite — Beleg: `qa/r3_func.py`

#### AC-2 — Profilzeile entsteht ohne weiteren Schritt
- [x] Genau **eine** `profiles`-Zeile zur neuen Nutzer-ID — Beleg: `select count(*) … where id='c35a14d7-…'` → `1`; Trigger `on_auth_user_created` in `20260827120000_profiles.sql:60`

#### AC-3 — Passwort unter 10 Zeichen wird abgelehnt
- [x] „Dein Passwort braucht mindestens 10 Zeichen.", **0** Konten angelegt — Beleg: `qa/r3_func.py`
- [x] Dritte Prüfung in der Datenbank: `GOTRUE_PASSWORD_MIN_LENGTH=10` — Beleg: `docker exec supabase_auth_… env`
- [x] 9 abgelehnt, 10 angenommen — Beleg: `src/lib/validation/auth.test.ts`

#### AC-4 — Ungültiges E-Mail-Format wird abgelehnt
- [x] „Bitte gib eine gültige E-Mail-Adresse ein.", **0** Konten — Beleg: `qa/r3_func.py`

#### AC-5 — Adresse bereits vergeben
- [x] „Diese E-Mail-Adresse hat schon ein Konto. Melde dich an.", danach weiterhin genau **ein** Konto — Beleg: `qa/r3_func.py`

### Anmeldung

#### AC-6 — Anmeldung mit richtigen Daten
- [x] `HTTP 303`, `location: /`; `/konto` zeigt die eigene Adresse — Beleg: `qa/r3_func.py`

### Schutz vor automatisiertem Erraten

#### AC-7 — Fehlermeldung verrät nicht, ob die Adresse existiert
- [x] Unbekannte Adresse und falsches Passwort ergeben denselben Satz „E-Mail-Adresse oder Passwort stimmt nicht." — Beleg: `qa/r3_time_ec.py`, je n=24
- [x] Auch ein zu kurzes Passwort ergibt diesen Satz, nicht die Passwortregel — Beleg: `qa/r3_time_ec.py`, EC-7

#### AC-8 — 5 Fehlversuche je E-Mail-Adresse in 15 Minuten
- [x] Versuche 1–5 „stimmt nicht", **ab 6** gesperrt mit Restzeit — Beleg: `qa/r3_throttle.py`
- [x] Hämmern verlängert nicht: nach 7 Versuchen genau **5** Zeilen — Beleg: derselbe Lauf
- [x] Auch das richtige Passwort wird während der Sperre abgelehnt — Beleg: derselbe Lauf

#### AC-9 — 5 Fehlversuche je IP-Adresse in 15 Minuten
- [x] Der Bypass ist zu: rotierende IP, `,1.2.3.4` und eine zweistellige Kette ergeben je **5 von 14** durchgelassen statt 14 — Beleg: `qa/r3_throttle.py`
- [x] Mit erklärtem Proxy trennt die Regel echte IPs sauber: vorgehängte Fälschungen landen im Eimer der echten IP, eine andere echte IP ist ein eigener Eimer — Beleg: Lauf mit `TRUSTED_PROXY_HOPS=1` (Build-Verifikation, in diesem Lauf über `signup_attempt_gate` mit verschiedenen `p_ip` gegengeprüft)
- [ ] **BUG-1 — in der Vorgabe-Konfiguration gibt es gar keine IP-Granularität.** Alle Anfragen teilen einen Eimer, und fünf Fehlversuche sperren die Anmeldung **für alle**. Siehe BUG-1.

#### AC-10 — Zugangsdaten erscheinen nie in der URL
- [x] Beide Formulare `method="POST"`, `action=""` — Beleg: HTML von `/login` und `/signup`
- [x] Fehlanmeldung: `HTTP 200`, kein `location`, Passwort **nicht** im HTML — Beleg: `qa/r3_func.py` mit `GEHEIM-nicht-echt`
- [x] Erfolg: `location: /` ohne Parameter — Beleg: derselbe Lauf

#### AC-17 — 10 Registrierungen je IP-Adresse in 60 Minuten
- [x] 13 Registrierungen → **10 angelegt**, ab Nr. 11 abgewiesen mit Restzeit — Beleg: `qa/r3_throttle.py`
- [x] Der Bypass ist zu: rotierende IP und `,1.2.3.4` ergeben je **10 von 14** statt 14/16 — Beleg: derselbe Lauf
- [ ] **BUG-3 — gezählt werden Versuche, nicht angelegte Konten.** Nach 10 gescheiterten Registrierungen (0 Konten entstanden) wird der nächste echte Erstversuch abgewiesen. Unverändert offen. Siehe BUG-3.

#### AC-18 — Antwortzeit verrät nicht, ob eine Adresse registriert ist
- [x] **Mediane deckungsgleich:** 359,3 ms (registriert) gegen 358,8 ms (unbekannt) — Unterschied **0,15 %**, Vorgabe < 10 % — Beleg: `qa/r3_time_ec.py`, je n=24
- [x] **Wertebereiche überlappen vollständig:** 356–379 ms gegen 355–370 ms — Beleg: derselbe Lauf
- [x] **Jede Antwort unter 500 ms:** 0 von 48 darüber, langsamste 379 ms — Beleg: derselbe Lauf. Damit ist BUG-3 des zweiten Laufs in diesem Durchlauf **nicht reproduziert**
- [x] Die Untergrenze wirkt: keine Antwort unter 355 ms (`MIN_FAILURE_MS = 350`, `src/lib/actions/auth.ts:60`)
- **Hinweis, kein Bug:** Die Reserve bleibt konstruktiv knapp — 350 ms Untergrenze lassen bis zur 500-ms-Grenze rund 150 ms für die echte Arbeit. Im zweiten Lauf, auf demselben Rechner unter mehr Last, lagen 2 von 52 Antworten darüber. Der Wert hält, wenn die Maschine ruhig ist.

### Zugriffsschutz

#### AC-11 — Abgemeldet führt `/` auf `/login`
- [x] `/` und `/konto` abgemeldet: je `HTTP 307 → /login` — Beleg: `qa/r3_func.py`
- [x] Auch bei nicht erreichbarer Datenbank: `HTTP 307 → /login`, kein Durchwinken — Beleg: Lauf mit gestopptem Kong

#### AC-12 — Angemeldet führen `/login` und `/signup` auf `/`
- [x] beide `HTTP 307 → /` — Beleg: `qa/r3_func.py`

#### AC-13 — Die Datenbank liefert fremde Daten nicht aus
- [x] A liest `profiles` → genau **eine** Zeile, die eigene — Beleg: `qa/r3_sec.py`
- [x] A fragt B gezielt ab → `[]` — Beleg: derselbe Lauf
- [x] A überschreibt B per `PATCH` → `HTTP 204`, B **unverändert** (0 Zeilen betroffen) — Beleg: Wert vorher/nachher
- [x] A löscht B → `HTTP 403`, B weiterhin vorhanden — Beleg: derselbe Lauf
- [x] Abgemeldet: `HTTP 401 / 42501` — Beleg: derselbe Lauf
- [x] `login_attempts` weder angemeldet (`403`) noch abgemeldet (`401`) lesbar; RLS an, **keine** Policy — Beleg: derselbe Lauf und `\d public.login_attempts`

### Abmelden

#### AC-14 — Abmelden beendet die Sitzung, Zurück-Button stellt nichts wieder her
- [x] `HTTP 303 → /login?reason=signed-out`, Sitzungen in der Datenbank **1 → 0** — Beleg: `qa/r3_func.py`
- [x] Danach `/` wieder `HTTP 307 → /login` — Beleg: derselbe Lauf
- [x] `Cache-Control: no-store, must-revalidate` auf `/`, `/konto`, `/login`, `/signup` im **Produktions-Build** — Beleg: `curl -I`
- [!] **NICHT VERIFIZIERT:** ob der Browser die Seite tatsächlich nicht aus dem bfcache holt — braucht einen Browser. Die Voraussetzung ist erfüllt.

### Kontolöschung und Aufbewahrung

#### AC-15 — Konto löschen entfernt alles, erneute Anmeldung schlägt fehl
- [x] Nach `delete_own_account`: Konten `0`, Profile `0`, Sitzungen `0`, Drosselungszeilen `0` — Beleg: `qa/r3_sec.py`
- [x] Konto A bleibt unversehrt — Beleg: derselbe Lauf
- [x] Erneute Anmeldung schlägt fehl — Beleg: derselbe Lauf
- [x] Abgemeldet nicht aufrufbar: `HTTP 401` — Beleg: derselbe Lauf
- [x] Bestätigungsdialog vorhanden, Absende-Button liegt **innerhalb** `<form action={formAction}>` — Beleg: `src/components/account/delete-account-dialog.tsx:64-72`
- [x] Hinweis nach der Löschung: `/login?reason=deleted` zeigt „Dein Konto ist gelöscht. Alles Gute!" — Beleg: `qa/r3_time_ec.py`
- [ ] **BUG-4 — der Klick auf „Endgültig löschen" löst gar nichts aus.** Inzwischen per E2E geprüft: keine einzige Anfrage, Konto bleibt bestehen, Dialog schließt sich, als wäre es erledigt. Der oben belegte Datenbank-Weg ist in Ordnung — der Weg über die Oberfläche nicht. Siehe BUG-4.

#### AC-16 — Drosselungsdaten nach 24 Stunden gelöscht
- [x] Drei Zeilen (eine `login` und eine `signup` je 25 Std alt — die `signup`-Zeile bewusst **mit `ip = NULL`** —, eine frisch): `cleanup_login_attempts()` löscht **2**, die frische bleibt — Beleg: `qa/r3_sec.py`
- [x] Stündlicher Job aktiv: `cleanup-login-attempts | 0 * * * * | aktiv=true` — Beleg: `select … from cron.job`
- [x] Zweiter Weg: jede Torprüfung räumt selbst auf — Beleg: `perform public.cleanup_login_attempts()` in `20260828120000_ip_bucket_not_skip.sql:47` und `:97`

---

## Edge Cases

#### EC-1 — Doppelklick auf „Registrieren"
- [x] Absende-Button während der Übertragung gesperrt — Beleg: `src/components/auth/signup-form.tsx:96` (`disabled={isPending}`)
- [x] Die Datenintegrität hängt an EC-2, nicht am Button
- [x] **Das tatsächliche Klickverhalten ist jetzt geprüft:** zwei Klicks in Folge erzeugen genau **ein** Konto — Beleg: `tests/PROJ-1-accounts-auth.spec.ts`, Journey 1, Kontenzahl in der Datenbank nachgezählt

#### EC-2 — Zwei gleichzeitige Registrierungen mit derselben Adresse
- [x] Garantie in der Datenbank: `users_email_partial_key` — Beleg: `pg_indexes`
- [x] Gegenprobe: zweite Einfügung derselben Adresse → `unique_violation` — Beleg: `DO`-Block, zweiter Lauf, Mechanismus unverändert
- [x] Die unterlegene Anfrage erhält die Meldung aus AC-5 — Beleg: `qa/r3_func.py`

#### EC-3 — Sitzung läuft ab
- [x] Sitzung entzogen, Cookie behalten: `HTTP 307 → /login?reason=session-expired` — Beleg: `qa/r3_time_ec.py`
- [x] Hinweiszeile „Deine Sitzung ist abgelaufen. Bitte melde dich erneut an." wird gezeigt — Beleg: derselbe Lauf
- [x] Grenzen gesetzt: `GOTRUE_SESSIONS_INACTIVITY_TIMEOUT=8h0m0s`, `GOTRUE_SESSIONS_TIMEBOX=24h0m0s` — Beleg: `docker exec … env`
- [!] **NICHT VERIFIZIERT:** Ablauf nach echten 8 bzw. 24 Stunden — geprüft ist der gleichwertige Fall.

#### EC-4 — Datenbank nicht erreichbar
- [x] Kong angehalten: `/login` → „Die Anmeldung ist gerade nicht möglich…", `/signup` → „Die **Registrierung** ist gerade nicht möglich…" — Beleg: Lauf mit gestopptem Kong
- [x] Kein 5xx, kein `location`, Passwortfeld nicht vorbelegt, Passwort nicht im HTML — Beleg: derselbe Lauf
- [x] Die Drosselung fällt **zu**, nicht auf — Beleg: derselbe Lauf; dazu `src/lib/rate-limit.test.ts` („fällt bei einem Datenbankfehler ZU, nicht auf")

#### EC-5 — Konto in einem anderen Tab gelöscht
- [x] Nach der Löschung führt die nächste Aktion im anderen Tab auf `/login?reason=session-expired` statt in einen Absturz — Beleg: `qa/r3_time_ec.py`
- [x] Grund: echte Prüfung beim Auth-Server statt im Cookie — `src/lib/auth.ts:18`

#### EC-6 — Randleerzeichen im Passwort
- [x] Registrierung und Anmeldung mit `"  mit leerzeichen  "` beide `HTTP 303` — Beleg: `qa/r3_time_ec.py`
- [x] Ohne die Leerzeichen schlägt die Anmeldung fehl — nicht beschnitten — Beleg: derselbe Lauf

#### EC-7 — Kurze Passwörter bei der Anmeldung
- [x] 6 Versuche mit `kurz`: ab dem 6. gesperrt, **5 Zeilen gezählt** — Beleg: `qa/r3_time_ec.py`
- [x] Die Meldung nennt die Passwortregel nicht — Beleg: derselbe Lauf

---

## Security Audit

- [x] **Authentifizierung:** `/` und `/konto` ohne Sitzung → `307 → /login`; `src/proxy.ts:86`, `src/lib/auth.ts:30` — Beleg: `qa/r3_func.py`
- [x] **Autorisierung:** A erreicht B's Zeile weder lesend noch schreibend noch löschend; abgemeldet gar nicht — Beleg: `qa/r3_sec.py`
- [x] **Kein Privilegien-Aufstieg über die Lösch-Funktion:** `delete_own_account` nimmt kein fälschbares Argument (`HTTP 404 PGRST202` bei untergeschobener ID), abgemeldet `401` — Beleg: `qa/r3_sec.py`
- [x] **Eingabeprüfung XSS:** `"><script>alert(1)</script>@example.com` → abgewiesen, kein unmaskiertes `<script>` — Beleg: `qa/r3_sec.py`
- [x] **Eingabeprüfung SQL:** Nutzlast in der Adresse **und im IP-Kopf** → beide Tabellen existieren weiter, Nutzlast als Text behandelt — Beleg: `qa/r3_sec.py`
- [x] **Brute Force auf ein Konto:** ab dem 6. Fehlversuch gesperrt, auch bei wechselnder vorgeblicher IP — Beleg: `qa/r3_throttle.py`
- [x] **Massen-Registrierung:** auf 10 je Eimer und Stunde begrenzt, Bypass geschlossen — Beleg: `qa/r3_throttle.py`
- [x] **Keine Konto-Enumeration über den Meldungstext** — Beleg: `qa/r3_time_ec.py`
- [x] **Keine Konto-Enumeration über die Antwortzeit** (0,15 % Median-Unterschied) — Beleg: `qa/r3_time_ec.py`
- [ ] **BUG-1 — Denial of Service auf die Anmeldung.** Fünf Anfragen sperren alle Nutzer:innen aus. Siehe unten.
- [ ] **BUG-2 — die Drosselungs-Tore sind ein unauthentifiziertes Schreibwerkzeug.** Beliebige Adress- und IP-Eimer lassen sich direkt füllen. Siehe unten.
- [x] **Keine Secrets im Client-Bundle:** `service_role`-JWT, `sb_secret`, `JWT_SECRET`, `postgresql://` und **`TRUSTED_PROXY_HOPS`** ergeben je **0 Treffer** in `.next/static` — Beleg: `grep -rlF`
- [x] **Die neue Variable erreicht den Browser nicht:** kein `NEXT_PUBLIC_`-Präfix, 0 Treffer im Bundle — Beleg: derselbe Scan und `.env.local.example`
- [x] **Nur zwei Werte erreichen den Browser:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Beleg: `grep -rhoE`
- [x] **Namen der Datenbankfunktionen nicht im Bundle** (je 0 Treffer) — Beleg: `grep -rlF … .next/static`
- [x] **Keine sensiblen Felder in Antworten:** `/konto` ohne Passwort, Token und Nutzer-ID — Beleg: `qa/r3_sec.py`
- [x] **Keine `.env`-Datei eingecheckt** außer `.env.local.example` — Beleg: `git ls-files`
- [x] **Security-Header vollständig** auf allen vier Routen (`X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `HSTS`) — Beleg: `qa/r3_func.py`
- [x] **Die Plattform bietet weiterhin keinen Boden:** `GOTRUE_RATE_LIMIT_SIGN_IN_SIGN_UPS` ist im Auth-Container nicht gesetzt — die eigene Drosselung ist die einzige Schicht — Beleg: `docker exec … env | grep RATE_LIMIT`
- [!] **NICHT VERIFIZIERT — Drosselung auf gewöhnlichen Endpunkten:** außer den Auth-Wegen gibt es in PROJ-1 keine.

### `[user]`-Aufgaben
- [x] **Keine offenen.** T24 (`TRUSTED_PROXY_HOPS` in `.env.local.example`) ist abgehakt und die Zeile ist vorhanden — Beleg: `git diff -- .env.local.example` zeigt `TRUSTED_PROXY_HOPS=0`, ohne `NEXT_PUBLIC_`-Präfix

---

## Regression

- [x] `features/INDEX.md` führt **kein** Feature mit Status *Deployed* — PROJ-2 und PROJ-3 stehen auf *Roadmap*. Kein Nachbar-Feature, das dieser Bau brechen könnte
- [x] Alle 18 AC und 7 EC in diesem Lauf neu geprüft; die Behebung hat nichts von dem gebrochen, was vorher galt
- [x] Nach dem EC-4-Test (Kong gestoppt und neu gestartet) laufen Registrierung, Anmeldung und `/konto` unverändert — Beleg: Folgeläufe im selben Durchgang

---

## Automatisierte Tests

- `npm test`: **38 Tests, 3 Dateien, alle grün** — Beleg: `npm test`
  - `src/lib/validation/auth.test.ts` (11), `src/components/auth/login-notice.test.tsx` (7),
    `src/lib/rate-limit.test.ts` (20 — davon 10 zur IP-Ermittlung mit und ohne Proxy, 9 zu den Toren)
- **In diesem Durchlauf keine neuen Unit-Tests geschrieben, mit Begründung:** Die isolierte Logik ist
  abgedeckt — `clientIpFrom` in beiden Konfigurationen, die Torauswertung samt Zufallen bei
  Datenbankfehlern, die Schemata, die Hinweiszeile. Die beiden Befunde dieses Laufs sind nicht
  unit-testbar: BUG-1 ist eine Eigenschaft der Eimer-Semantik über mehrere Anfragen hinweg, BUG-2 eine
  Frage der Datenbank-Rechte. Beide sind oben über echte Aufrufe belegt.
- `npm run lint`: grün · `npm run build`: grün · `npx tsc --noEmit`: sauber

## E2E-Tests

**Ausgeführt am 28.08.2026** — `npm run test:e2e`, Playwright gegen `next dev`, zwei Projekte
(Desktop Chrome und Mobile Safari / iPhone 13). Datei: `tests/PROJ-1-accounts-auth.spec.ts`.
**Ergebnis: 6 von 8 grün, 2 rot — und die zwei roten sind ein echter Befund (BUG-4).**

| Journey | AC / EC | Chrome | Mobile Safari |
|---|---|---|---|
| 1 — Registrieren führt aus dem gesperrten Bereich hinein | AC-11, AC-1, AC-2, EC-1 | ✅ | ✅ |
| 2 — Anmelden bringt die eigene Adresse auf die Kontoseite | AC-6, AC-12 | ✅ | ✅ |
| 3 — Abmelden schließt den geschützten Bereich wieder | AC-14, AC-11 | ✅ | ✅ |
| 4 — Konto löschen über den Bestätigungsdialog | AC-15 | ❌ **BUG-4** | ❌ **BUG-4** |

**Was diese Suite an früher offenen Punkten geschlossen hat:**
- **EC-1 (Doppelklick)** ist jetzt echt geprüft, nicht nur im Code belegt: zwei Klicks in
  Folge auf „Konto anlegen" erzeugen **genau ein** Konto (in der Datenbank nachgezählt), und
  der zweite Klick läuft ins Leere, weil der Button gesperrt ist.
- **AC-2** wird gegen die Datenbank geprüft, nicht gegen die Oberfläche: eine Profilzeile.
- **Der Klick auf „Endgültig löschen"** — zweimal als NICHT VERIFIZIERT geführt — ist jetzt
  geprüft. Er funktioniert nicht. Siehe BUG-4.

**Bewusst nicht abgedeckt:** die Drosselung (AC-8, AC-9, AC-17). Dort liegt mit BUG-1 ein
offener High-Befund, und ein Test, der fünf Fehlanmeldungen auslöst, würde derzeit alle
parallel laufenden Anmelde-Tests mit aussperren.

**Zwei Eingriffe an der Testinfrastruktur, beide wegen BUG-1** (`tests/global-setup.ts`,
`tests/helpers.ts`): Vor jedem Lauf werden Testkonten und Drosselungs-Zähler geleert, sonst
scheitert der zweite Lauf innerhalb einer Stunde an der Grenze von 10 Registrierungen für die
gesamte App. Sobald BUG-1 behoben ist, wird das überflüssig. Zusätzlich läuft die Suite mit
`workers: 2` — acht gleichzeitige Registrierungen überlasten `next dev`, seriell sind dieselben
Tests grün (nachgemessen).

**Rot-Nachweis erbracht:** Journey 1 (Kontenzahl auf 2 verbogen), Journey 2 (fremde Adresse
erwartet) und Journey 3 (`/` sollte erreichbar bleiben) fielen je an genau der vorgesehenen
Zeile, nicht in einer nachgelagerten Zeitüberschreitung. Journey 4 liefert ihren Nachweis von
selbst.

---

## Nicht verifiziert in diesem Durchlauf

- [!] Darstellung in verschiedenen Browsern — die E2E-Suite deckt **Chromium und WebKit** funktional ab; Firefox und die visuelle Darstellung bleiben offen
- [!] Responsives **Aussehen** bei 375 px / 768 px / 1440 px — die E2E-Suite fährt zwar iPhone 13 (390 px) mit und beweist damit, dass die Abläufe dort **funktionieren**; ob das Layout gut aussieht, prüft sie nicht
- [!] Browser-Konsole und Netzwerk-Tab — kein DevTools
- [!] Ob der Browser geschützte Seiten aus dem bfcache holt (AC-14) — Voraussetzung `no-store` erfüllt
- ~~Ob der Klick auf „Endgültig löschen" die Aktion auslöst (AC-15)~~ — **durch die E2E-Suite geschlossen**, Ergebnis: BUG-4
- ~~Das tatsächliche Doppelklick-Verhalten (EC-1)~~ — **durch die E2E-Suite geschlossen**, Ergebnis: bestanden
- [!] Ablauf der Sitzung nach echten 8 bzw. 24 Stunden (EC-3)
- [!] Fokusreihenfolge, Tastaturbedienung, Screenreader-Ausgabe, Animationen
- [!] Drosselung auf gewöhnlichen Endpunkten — in PROJ-1 gibt es keine

---

## Gefundene Fehler

### BUG-1: Fünf Anfragen sperren die Anmeldung für alle Nutzer:innen
- **Severity:** High
- **Betrifft:** AC-9, AC-11 (mittelbar) · `src/lib/rate-limit.ts` (Vorgabe `TRUSTED_PROXY_HOPS = 0`) in Verbindung mit `20260828120000_ip_bucket_not_skip.sql`
- **Schritte:**
  1. Fünfmal `/login` mit einer **frei erfundenen** Adresse und irgendeinem Passwort aufrufen
  2. Danach meldet sich eine **beliebige echte** Person mit ihrem **richtigen** Passwort an
  3. Erwartet: sie kommt hinein
  4. Tatsächlich: „Zu viele Fehlversuche. Bitte versuche es in 15 Minuten erneut." — nachgemessen von beiden Seiten (Angreifer nutzt die Adresse des Opfers · Angreifer nutzt nur erfundene Adressen)
- **Ursache:** Ohne erklärten vertrauenswürdigen Proxy liest die App den `X-Forwarded-For`-Kopf gar nicht mehr — richtig, denn er ist fälschbar. Damit hat aber **jede** Anfrage dieselbe (leere) IP, und die neue Eimer-Semantik zählt sie alle gemeinsam. Die IP-Regel aus AC-9 hat in dieser Konfiguration keine Granularität: es gibt genau einen Eimer für die ganze Welt.
- **Warum das zählt:** Ein unangemeldeter Angreifer legt mit fünf Anfragen die Anmeldung der gesamten App für 15 Minuten still und hält das mit fünf weiteren Anfragen alle 15 Minuten aufrecht. Die Registrierung trifft es ebenso: **10 Konten pro Stunde für die gesamte App**.
- **Kein Rückschritt gegenüber vorher:** Auch vor der Behebung teilten sich alle Anfragen ohne Kopf den Eimer `::1`, derselbe Effekt war also schon erreichbar. Neu ist nur, dass er sich nicht mehr umgehen lässt — die vorigen Durchläufe haben in die andere Richtung geschaut (Bypass statt Aussperrung) und ihn deshalb übersehen.
- **Heutige Tragweite:** Die App ist nur lokal erreichbar, Deployment ist laut `docs/PRD.md` nicht vorgesehen. Praktisch ausnutzbar wird das erst mit öffentlichem Zugang.
- **Was `TRUSTED_PROXY_HOPS=1` löst und was nicht:** Hinter einem echten Proxy trennt die Regel wieder nach echten Client-IPs, und der Schaden schrumpft auf eine IP. Das ist die vorgesehene Produktionskonfiguration — aber die **Vorgabe** ist die unsichere, und nichts im Code weist beim Start darauf hin.
- **Richtung für die Behebung (Auswahl, gehört ins Design):** die IP-Regel beim **Anmelden** ohne erklärten Proxy aussetzen und sich dort auf AC-8 je Adresse verlassen, während die Registrierungs-Regel den gemeinsamen Eimer behält (dort kostet er nur 10 Konten pro Stunde, sperrt aber niemanden aus seinem Konto aus) · oder beim Start laut werden, wenn `TRUSTED_PROXY_HOPS=0` und `NODE_ENV=production` zusammentreffen.
- **Priorität:** Vor jedem öffentlichen Zugang. Für den lokalen Prüfungsbetrieb ohne Folgen.

### BUG-2: Die Drosselungs-Tore lassen sich direkt aufrufen und mit fremden Werten füllen
- **Severity:** Medium
- **Betrifft:** AC-8, AC-9, AC-17 · `20260827120100_login_attempts.sql:164` und `20260828100000_signup_throttle.sql:164` (`grant execute … to anon`)
- **Schritte:**
  1. Ohne jede Anmeldung, nur mit dem öffentlichen `anon`-Schlüssel (der in jedem Browser steckt):
  2. `POST /rest/v1/rpc/login_attempt_gate` mit `{"p_email":"<Adresse des Opfers>","p_ip":null}` — fünfmal
  3. Das Opfer meldet sich mit dem **richtigen** Passwort an → „Zu viele Fehlversuche."
  4. Ebenso: `signup_attempt_gate` zehnmal mit `{"p_ip":"203.0.113.200"}` → diese IP ist eine Stunde von der Registrierung ausgeschlossen (`{"blocked":true,"retry_after_seconds":3600}`)
- **Was daran wirklich neu ist:** Die Kontosperre allein ist **auch über die App** erreichbar — fünf Fehlanmeldungen auf eine bekannte Adresse genügen, das ist die dem Muster innewohnende Kehrseite von AC-8 (gegengeprüft, siehe `qa/r3_rpc.py`). Der direkte Aufruf fügt zwei Dinge hinzu: er ist **billiger** (keine Formularlast, und die künstlichen 350 ms aus AC-18 entfallen), und er erlaubt, **fremde IP-Eimer** zu füllen — etwas, das die App selbst niemandem gestattet, weil sie die IP serverseitig bestimmt.
- **Warum das auch die empfohlene Produktionskonfiguration trifft:** `TRUSTED_PROXY_HOPS=1` hilft hier **nicht**. Der Angreifer umgeht die App komplett und wählt `p_ip` frei — er kann also gezielt die IP eines Büros sperren.
- **Die Spannung dahinter:** Das Recht kann nicht einfach entzogen werden. Die App ruft die Tore selbst über PostgREST als `anon` auf (eine Anmeldung beginnt ohne Sitzung), und einen `service_role`-Schlüssel gibt es nach TD-6 bewusst nicht. Eine Behebung berührt also das Design — etwa ein serverseitiges Geheimnis als zusätzliches Argument oder ein anderer Aufrufweg.
- **Priorität:** Vor öffentlichem Zugang, zusammen mit BUG-1 zu entscheiden — beide betreffen dieselbe Mechanik.

### BUG-3: Die Registrierungssperre zählt Versuche, nicht angelegte Konten
- **Severity:** Low
- **Betrifft:** AC-17 · `src/lib/actions/auth.ts:150`, `20260828120000_ip_bucket_not_skip.sql:123`
- **Status:** unverändert aus dem zweiten Durchlauf (dort BUG-4), bewusst nach `/refine` verschoben
- **Schritte:** 10 Registrierungen mit einer **bereits vergebenen** Adresse (0 Konten entstehen), danach ein echter Erstversuch → „Von dieser Verbindung wurden gerade viele Konten angelegt." — Beleg: `qa/r3_time_ec.py`
- **Warum es zählt:** Weicht vom Wortlaut des AC ab („bereits 10 Konten angelegt"), und die Meldung nennt einen Grund, der nicht stimmt.
- **Priorität:** Mit `/refine PROJ-1` am Wortlaut von AC-17 lösen

---

### BUG-4: Der Klick auf „Endgültig löschen" löscht nichts — und sieht aus, als hätte er es getan
- **Severity:** High
- **Betrifft:** AC-15 *(Art. 17 DSGVO)* · `src/components/account/delete-account-dialog.tsx:64-72`
- **Gefunden von:** der E2E-Suite (`tests/PROJ-1-accounts-auth.spec.ts`, Journey 4) — auf **beiden** Projekten, Chrome wie Mobile Safari
- **Schritte:**
  1. Anmelden, `/konto` öffnen, „Konto löschen" klicken — der Bestätigungsdialog erscheint
  2. „Endgültig löschen" klicken
  3. Erwartet: Konto weg, Abmeldung, Weiterleitung auf `/login?reason=deleted`
  4. Tatsächlich: Der Dialog schließt sich, die Seite bleibt auf `/konto`, das Konto **existiert weiter**. Auch nach 15 Sekunden unverändert
- **Belegt, nicht vermutet:** Der Browser schickt **null** POST-Anfragen (Netzwerkverkehr mitgeschnitten: `POSTs=0`), und `select count(*) from auth.users` liefert vor wie nach dem Klick `1`. Die Server Action wird also gar nicht erst aufgerufen.
- **Wahrscheinliche Ursache:** `AlertDialogAction` von Radix schließt den Dialog beim Klick. Der `<form action={formAction}>` liegt **innerhalb** von `AlertDialogContent` und wird dabei ausgehängt, bevor React das Absenden verarbeitet. Der Absende-Button ist korrekt verdrahtet — er kommt nur nicht mehr dazu.
- **Warum das schwer wiegt:** Es ist ein **stiller** Fehlschlag. Der Dialog verschwindet wie nach getaner Arbeit, es erscheint keine Fehlermeldung, und wer sein Konto löschen wollte, geht davon aus, dass es weg ist. Es ist es nicht. Das ist der Weg, über den `spec.md` das Auskunfts- und Löschrecht aus Art. 17 DSGVO einlöst, und über die Oberfläche gibt es keinen zweiten.
- **Was funktioniert:** Die Löschung selbst ist in Ordnung — `delete_own_account` entfernt Konto, Profil, Sitzungen und Drosselungszeilen zuverlässig und lässt fremde Konten unberührt (oben unter AC-15 belegt). Kaputt ist ausschließlich der Auslöser in der Oberfläche.
- **Warum die früheren Durchläufe das nicht fanden:** `/qa` läuft ohne Browser. Der Dialoginhalt wird erst beim Öffnen per JavaScript gerendert und steht nicht im ausgelieferten HTML; die Verdrahtung war deshalb zweimal nur im Code belegt und ausdrücklich als NICHT VERIFIZIERT geführt. Genau diese Lücke hat die E2E-Suite geschlossen.
- **Richtung für die Behebung:** Das Absenden auslösen, bevor Radix den Dialog schließt — etwa `onClick` mit `event.preventDefault()` am `AlertDialogAction` und die Action selbst aufrufen, oder das Formular aus dem Dialoginhalt herausziehen. Ein Test dafür existiert bereits und wird grün, sobald es sitzt.
- **Priorität:** Vor `/deploy`. Der Test bleibt bis dahin rot — das ist beabsichtigt.

---

## Beobachtung (kein Fehler): AC-8 erlaubt gezielte Kontosperren — konstruktionsbedingt

Eine Drosselung, die **das Konto** nach fünf Fehlversuchen sperrt, lässt sich von jedem missbrauchen,
der die Adresse kennt: fünf Fehlanmeldungen, und die Person kommt 15 Minuten nicht hinein. Das ist
keine Abweichung von der Spec — es ist genau das, was AC-8 verlangt, und die bekannte Kehrseite jedes
Account-Lockout-Verfahrens. Übliche Gegenmittel wären, statt zu sperren zu verzögern oder ab einer
Schwelle ein CAPTCHA zu verlangen (in `spec.md` bewusst zurückgestellt). Hier festgehalten, damit die
Entscheidung bewusst bleibt und nicht bei der nächsten Prüfung als neuer Befund auftaucht.

---

## Zusammenfassung

- **Acceptance Criteria:** 18 von 18 geprüft — **15 vollständig bestanden**, 3 mit Einschränkung:
  - **AC-9** — der Bypass ist geschlossen, aber in der Vorgabe-Konfiguration gibt es keine IP-Granularität (BUG-1)
  - **AC-17** — der Bypass ist geschlossen, gezählt werden aber Versuche statt Konten (BUG-3)
  - **AC-15** — die Löschung selbst arbeitet korrekt, aber der Knopf in der Oberfläche löst sie nicht aus (BUG-4)
- **AC-18 besteht in diesem Lauf vollständig**, einschließlich der 500-ms-Zusage
- **Edge Cases:** 7 von 7 geprüft, alle bestanden — **EC-1 ist jetzt echt geprüft**, nicht mehr nur im Code belegt
- **Gefundene Fehler:** 4 — 0 kritisch, **2 hoch**, 1 mittel, 1 niedrig (BUG-4 kam durch die E2E-Suite dazu)
- **Aus dem letzten Lauf geschlossen:** der High-Befund (X-Forwarded-For-Bypass) und die falsche Meldung auf `/signup`; der 500-ms-Befund reproduziert nicht
- **Security:** **19 Prüfungen verifiziert, 1 nicht verifiziert** (Drosselung auf gewöhnlichen Endpunkten — in PROJ-1 gibt es keine); zwei der verifizierten sind als BUG-1 und BUG-2 negativ ausgefallen
- **`[user]`-Aufgaben:** keine offen
- **Automatisierte Tests:** 38 Unit-/Integrationstests grün; lint, build und tsc sauber
- **E2E:** 6 von 8 grün — die zwei roten sind BUG-4, kein Testfehler
- **Production Ready:** **NEIN** — zwei High-Befunde: BUG-1 (Aussperrung aller Nutzer:innen) und BUG-4 (Kontolöschung über die Oberfläche ohne Wirkung)

> „Production Ready: NEIN" heißt: zwei hohe Befunde stehen offen. Es heißt **nicht**, dass alles geprüft
> wurde — die Liste „Nicht verifiziert" ist weiterhin offen und braucht einen Menschen oder
> `/e2e-tests`.

**Empfehlung:** **BUG-4 zuerst** — er ist eng umgrenzt (eine Komponente), hat einen fertigen Test,
der ihn beweist, und betrifft ein Recht, das die Spec ausdrücklich zusagt. BUG-1 und BUG-2 gehören danach zusammen entschieden — beide hängen an derselben Mechanik,
und beide sind eher Design- als Codefragen. Ein `/refine PROJ-1` wäre der ehrlichere nächste Schritt
als ein weiterer Build: AC-9 verspricht eine Granularität je IP-Adresse, die es ohne vorgelagerten
Server gar nicht geben kann, und AC-17 beschreibt eine Zählung, die der Code so nicht macht (BUG-3).
Wenn der Vertrag stimmt, ist der Bau danach klein.

**Weiterhin offen (unverändert):**
- `docs/privacy.md` beschreibt nur die Anmelde-Drosselung, nicht die Registrierungs-Zählung → `/dsgvo PROJ-1`
- CAPTCHA auf der Registrierung bleibt zurückgestellt — es wäre zugleich das übliche Gegenmittel gegen
  die in der Beobachtung oben beschriebene Kontosperre
