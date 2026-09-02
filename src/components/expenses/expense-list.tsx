'use client'

import { categoryLabel } from '@/lib/expenses/categories'
import {
  formatAmount,
  formatDay,
  formatForeignAmount,
  formatMonthLabel,
  formatRate,
} from '@/lib/expenses/format'
import type { Expense } from '@/lib/expenses/queries'
import { DeleteExpenseDialog } from '@/components/expenses/delete-expense-dialog'
import { EditExpenseDialog } from '@/components/expenses/edit-expense-dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

/**
 * Die Liste des Monats (AC-11, AC-12, AC-22).
 *
 * Sortierung kommt aus der Abfrage: absteigend nach Datum, bei gleichem Datum die zuletzt
 * erfasste zuerst. Hier wird nichts nachsortiert — eine zweite Sortierregel wäre eine zweite
 * Wahrheit.
 */
export function ExpenseList({
  expenses,
  month,
}: {
  expenses: readonly Expense[]
  month: string
}) {
  if (expenses.length === 0) return <EmptyState month={month} />

  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[34rem]">
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">Datum</TableHead>
            <TableHead className="w-40">Kategorie</TableHead>
            <TableHead>Notiz</TableHead>
            <TableHead className="w-56 text-right">Betrag</TableHead>
            <TableHead className="w-36 text-right">
              <span className="sr-only">Aktionen</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {expenses.map((expense) => (
            <TableRow key={expense.id}>
              <TableCell className="tabular-nums">{formatDay(expense.spent_on)}</TableCell>
              <TableCell>{categoryLabel(expense.category)}</TableCell>
              {/* Die Notiz steht wie Datum und Kategorie, nicht gedämpft (AC-34). Sie war als
                  Meta-Text eingestuft — formal über der Kontrastgrenze, aber die Rangfolge war
                  verkehrt: Sie ist der einzige Text der Zeile, den die Person selbst geschrieben
                  hat. Die Fremdwährungs-Beizeile unten bleibt gedämpft; sie ist wirklich
                  Nebeninformation, und der Unterschied wird dadurch erst sichtbar. */}
              <TableCell className="max-w-0 truncate">
                {expense.note ?? ''}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatAmount(expense.amount_cents)}
                {/* Nur Fremdwährungszeilen bekommen die Beizeile — eine Euro-Ausgabe sieht aus
                    wie vor PROJ-3 (AC-7, EC-8). Der Euro-Betrag bleibt die Hauptzahl, weil er
                    die Monatssumme trägt; darunter steht, woraus er entstanden ist, damit die
                    Umrechnung ohne Klick nachrechenbar ist (AC-8). */}
                {expense.rate_per_eur !== null && expense.rate_date !== null && (
                  <span className="mt-0.5 block text-[12px] font-normal leading-snug text-muted-foreground">
                    {formatForeignAmount(expense.amount_original, expense.currency)}
                    <span className="block">
                      {formatRate(expense.rate_per_eur, expense.currency)}
                      {' · Kurs vom '}
                      {formatDay(expense.rate_date)}
                    </span>
                  </span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <EditExpenseDialog expense={expense} month={month} />
                  <DeleteExpenseDialog expense={expense} />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/**
 * Der Leerzustand (AC-12) — ausformuliert statt einer leeren Tabelle. Die Erfassungszeile
 * darüber bleibt bedienbar; hier steht nur, was fehlt und was als Nächstes zu tun ist.
 */
export function EmptyState({ month }: { month: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border px-5 py-10 text-center">
      <p className="font-grotesk text-[15px] font-medium">
        Für {formatMonthLabel(month)} ist noch nichts erfasst.
      </p>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Trag deine erste Ausgabe oben ein — Betrag, Kategorie, Datum, fertig.
      </p>
    </div>
  )
}
