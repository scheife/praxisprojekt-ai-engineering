import { categoryLabel } from '@/lib/expenses/categories'
import { formatAmountPlain, formatDay, formatTimestamp } from '@/lib/expenses/format'
import type { Expense } from '@/lib/expenses/queries'

/**
 * Die Export-Datei (AC-27, EC-10).
 *
 * Sie ist für Menschen und für Steuerberater:innen, nicht für unseren Code — deshalb steht
 * die Kategorie als deutscher Anzeigename darin und nicht als Schlüssel.
 *
 * Die Regeln, an denen ein CSV sonst scheitert:
 * - **Semikolon** als Trennzeichen, nicht Komma: bei Zahlen mit Dezimalkomma ist alles andere
 *   eine Falle.
 * - **BOM** am Anfang, damit Excel die Umlaute nicht zerlegt.
 * - **CRLF** als Zeilenende und Feldbegrenzung nach RFC 4180: ein Feld mit Semikolon,
 *   Anführungszeichen oder Zeilenumbruch kommt in Anführungszeichen, enthaltene
 *   Anführungszeichen werden verdoppelt (EC-10).
 * - **Betrag ohne Tausenderpunkt und ohne Währungszeichen** — so liest ihn jede
 *   Tabellenkalkulation mit deutschsprachigen Einstellungen als Zahl.
 */

const BOM = '\ufeff'
const CRLF = '\r\n'

/**
 * Zeichen, bei denen eine Tabellenkalkulation den Zellinhalt als **Formel** liest.
 *
 * `=` und `+` beginnen eine Formel, `-` ebenso (als Vorzeichen), `@` ruft in Excel eine
 * Funktion auf, und Tabulator wie Wagenrücklauf können den Beginn verschieben.
 */
const FORMEL_ANFANG = /^[=+\-@\t\r]/

/**
 * Ein Feld für die Datei aufbereiten — zwei getrennte Aufgaben in einer Funktion.
 *
 * **1. Begrenzen nach RFC 4180**, damit die Spalten nicht verrutschen (EC-10).
 *
 * **2. Einer Formel den Anfang nehmen.** Eine Notiz wie `-50% Rabatt Parkhaus` oder
 * `=Rest aus Juli` ist für uns Text, für Excel, LibreOffice und Numbers aber eine Formel:
 * angezeigt wird dann `#NAME?` statt der Notiz — AC-27 verspricht das Gegenteil, nämlich eine
 * Datei, die sich „ohne Nacharbeit" öffnen lässt. In der Form `=cmd|' /C calc'!A0` ist es
 * darüber hinaus der bekannte CSV-Injection-Weg, und `design.md` nennt Steuerberater:innen
 * ausdrücklich als Empfänger dieser Datei — Schreiber und Öffner sind also nicht zwingend
 * dieselbe Person.
 *
 * **Begrenzen allein hilft dagegen nicht.** Die Tabellenkalkulation entfernt die
 * Anführungszeichen zuerst und sieht die Formel danach. Was hilft, ist das vorangestellte
 * **Hochkomma** — die übliche Textmarkierung, die die gängigen Programme beim Anzeigen
 * schlucken. Zusätzlich wird das Feld begrenzt, damit im Datei-Inhalt sichtbar ist, dass hier
 * bewusst etwas voransteht.
 */
function field(value: string): string {
  const entschaerft = FORMEL_ANFANG.test(value) ? `'${value}` : value
  if (entschaerft !== value || /[";\r\n]/.test(entschaerft)) {
    return `"${entschaerft.replaceAll('"', '""')}"`
  }
  return entschaerft
}

function row(values: string[]): string {
  return values.map(field).join(';')
}

export function buildCsv(
  account: { email: string; registeredAt: string },
  expenses: readonly Expense[],
): string {
  const lines = [
    row(['Konto', account.email]),
    row(['Registriert am', formatDay(account.registeredAt.slice(0, 10))]),
    '',
    row(['Datum', 'Kategorie', 'Betrag (EUR)', 'Notiz', 'Erfasst am']),
    ...expenses.map((expense) =>
      row([
        formatDay(expense.spent_on),
        categoryLabel(expense.category),
        formatAmountPlain(expense.amount_cents),
        expense.note ?? '',
        formatTimestamp(expense.created_at),
      ]),
    ),
  ]

  // Wer noch keine Ausgabe hat, bekommt Kopfblock und Spaltenüberschriften — eine leere
  // Auskunft ist auch eine Auskunft.
  return BOM + lines.join(CRLF) + CRLF
}

/** `auslage-export-2026-08-31.csv` */
export function csvFilename(today: string): string {
  return `auslage-export-${today}.csv`
}
