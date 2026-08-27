# Datenmodell — auslage.

> Die app-weite Karte davon, **welche Daten dieses Produkt speichert und wie sie zusammenhängen** —
> der gemeinsame Bauplan, an den sich die Tabellen jedes Features halten.
>
> - Angelegt von `/init` (der erste ganzheitliche Durchgang: Entitäten + Beziehungen).
> - Verfeinert von `/architecture`, sobald ein Feature entworfen wird.
> - **Flughöhe:** Entitäten, Beziehungen und Zugehörigkeit stehen hier (Produktebene, für alle lesbar).
>   Spaltentypen, Indizes und die genauen Fremdschlüssel werden pro Feature im jeweiligen `design.md`
>   entschieden — nicht hier.

## Entitäten

| Entität | Was sie darstellt | Wem sie gehört / wer sie sieht |
|---|---|---|
| `profiles` | Das Konto einer Person in `auslage.` | die Person selbst |
| `expenses` | Eine einzelne Geschäftsausgabe | die Person, die sie angelegt hat |
| Kategorien | Feste Werteliste, nicht von Nutzer:innen verwaltet | für alle gleich, niemandem zugeordnet |
| `login_attempts` | Ein festgehaltener fehlgeschlagener Anmeldeversuch | niemandem — Sicherheitsprotokollierung, für keinen Client lesbar |

**Zu `profiles`:** Im MVP trägt die Tabelle wenig mehr als die Verknüpfung zum Konto. Sie ist trotzdem
da, weil `auth.users` in einem Schema liegt, das der Client nicht direkt abfragen soll, und weil PROJ-1
an ihr das RLS-Muster samt Signup-Trigger etabliert, das `expenses` danach eins zu eins kopiert. Spätere
Einstellungen (etwa eine Standardwährung) landen hier, ohne dass am Auth-Schema gearbeitet werden muss.

**Zu `login_attempts`** (eingeführt von PROJ-1): Die Tabelle gehört niemandem und hängt an keinem Profil
— sie hält fest, dass zu einer E-Mail-Adresse und einer IP-Adresse ein Anmeldeversuch fehlgeschlagen ist,
auch wenn die Adresse gar kein Konto hat. Sie ist die einzige Tabelle des Produkts, auf die **kein**
Client zugreifen kann: RLS ist an, es gibt bewusst keine Policy, und gelesen wird nur durch
Datenbankfunktionen mit erhöhten Rechten. Ihre Zeilen werden **nach 24 Stunden gelöscht** — die einzige
Entität mit einer eigenen Aufbewahrungsfrist. Details im `design.md` von PROJ-1, Rechtsgrundlage in
`docs/privacy.md`.

**Kategorien** sind eine feste Liste, keine verwaltbare Entität — eigene Kategorienverwaltung ist
ausdrücklich Non-Goal. Ob daraus ein Enum, ein Check-Constraint oder eine kleine Nachschlagetabelle
wird, entscheidet das `design.md` von PROJ-2.

Startvorschlag für die Liste (`/write-spec` darf sie anpassen):
Büromaterial · Software & Abos · Hardware & Geräte · Reise & Fahrt · Bewirtung · Fortbildung ·
Marketing & Werbung · Gebühren & Beiträge · Sonstiges

## Beziehungen

- Ein Profil hat viele Ausgaben.
- Jede Ausgabe gehört **genau einem** Profil.
- Jede Ausgabe trägt **genau eine** Kategorie aus der festen Liste.
- Eine Ausgabe hält **ihren eigenen Wechselkurs fest**. Es gibt keinen separaten Kurs-Datensatz und
  keine Kurs-Tabelle.
- `login_attempts` steht **außerhalb** dieser Kette: kein Fremdschlüssel, keine Zugehörigkeit, kein
  Bezug zu einem Profil. Die Verbindung besteht nur über die E-Mail-Adresse als Text, absichtlich lose.

## Die Modellierungsentscheidung, auf der das Produkt steht

**Der Wechselkurs wird auf der Ausgabe eingefroren**, zusammen mit dem Datum, zu dem er galt — nicht bei
jeder Anzeige neu geholt.

Ohne das passiert Folgendes: Im März wird eine Rechnung über 1.250 USD erfasst, die Monatsübersicht
zeigt 1.148,20 €. Im August steht im März plötzlich eine andere Summe, weil der Dollar sich bewegt hat.
Eine abgeschlossene Monatsübersicht muss stehen bleiben.

Nebeneffekt: Das Anzeigen der Liste braucht **null** API-Aufrufe. Nur das Anlegen einer
Fremdwährungsausgabe ruft frankfurter.app auf — deshalb braucht es auch keine Kurs-Cache-Tabelle.

## Zugriff

`profiles` und `expenses` sind über die angemeldete Nutzer-ID abgeriegelt — **zusätzlich** zur Prüfung im
Anwendungscode, nicht statt ihr. PROJ-1 legt dieses Muster an, PROJ-2 und PROJ-3 kopieren es.

`login_attempts` folgt der Gegenregel: RLS an, **keine** Policy, keine Rechte für die öffentlichen
Datenbankrollen. Wer nichts sehen darf, bekommt keine Policy, die etwas erlaubt.

## Skizze

```
auth.users                    Supabase Auth — E-Mail, Passwort-Hash
   └─ 1:1  profiles           Konto · Anker für spätere Einstellungen
              └─ 1:n  expenses
                        Betrag · Währung · eingefrorener Kurs + Kursdatum
                        Kategorie · Datum · Notiz
                              └─ Kategorie aus fester Werteliste

login_attempts                daneben, ohne Verbindung — E-Mail · IP · Zeitpunkt
                              kein Client-Zugriff · nach 24 Stunden gelöscht
```

---

_Lebendes Dokument. Wenn `/architecture` ein Feature entwirft, das eine Entität einführt oder ändert,
aktualisiert es zuerst diese Karte, damit spätere Features gegen ein zutreffendes Bild bauen._
