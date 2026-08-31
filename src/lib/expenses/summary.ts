import { categoryLabel } from '@/lib/expenses/categories'

/**
 * Die Monatsrechnung — eine reine Funktion ohne Datenbank und ohne Oberfläche (AC-13, AC-14).
 *
 * Gesamtsumme und Kategoriesummen entstehen aus **denselben** Zeilen und werden in ganzen Cent
 * gerechnet. Deshalb ergeben die Kategoriesummen exakt die Gesamtsumme; nur die Prozentwerte
 * dürfen sich auf 99 % oder 101 % addieren, weil jeder für sich gerundet wird (EC-7).
 */

export type SummaryRow = { category: string; amountCents: number }

export type CategorySum = {
  category: string
  label: string
  amountCents: number
  /** Kaufmännisch gerundeter Anteil an der Gesamtsumme — nur für die Anzeige. */
  percent: number
}

export type MonthSummary = {
  totalCents: number
  categories: CategorySum[]
}

export function summarize(rows: readonly SummaryRow[]): MonthSummary {
  const totalCents = rows.reduce((sum, row) => sum + row.amountCents, 0)

  const byCategory = new Map<string, number>()
  for (const row of rows) {
    byCategory.set(row.category, (byCategory.get(row.category) ?? 0) + row.amountCents)
  }

  const categories = [...byCategory.entries()]
    .map(([category, amountCents]) => ({
      category,
      label: categoryLabel(category),
      amountCents,
      percent: totalCents === 0 ? 0 : Math.round((amountCents * 100) / totalCents),
    }))
    // Absteigend nach Betrag; bei gleichem Betrag entscheidet der Anzeigename alphabetisch,
    // damit die Reihenfolge zwischen zwei Aufbauten stabil bleibt.
    .sort((a, b) => b.amountCents - a.amountCents || a.label.localeCompare(b.label, 'de'))

  // Kategorien ohne Betrag erscheinen gar nicht (AC-14) — sie stehen hier ohnehin nicht,
  // weil die Karte nur aus vorhandenen Zeilen entsteht.
  return { totalCents, categories }
}
