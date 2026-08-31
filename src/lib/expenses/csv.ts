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

/** Ein Feld nach RFC 4180 begrenzen — nur dort, wo es nötig ist. */
function field(value: string): string {
  if (/[";\r\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`
  return value
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
