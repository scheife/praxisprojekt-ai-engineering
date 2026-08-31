'use client'

import { useState } from 'react'
import { toast } from 'sonner'

import { deleteExpense } from '@/lib/actions/expenses'
import { IDLE } from '@/lib/expenses/form-state'
import { categoryLabel } from '@/lib/expenses/categories'
import { formatAmount, formatDay } from '@/lib/expenses/format'
import type { Expense } from '@/lib/expenses/queries'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

/**
 * Löschen mit Bestätigung (AC-22, AC-23).
 *
 * Der Dialog **nennt die betroffene Ausgabe** mit Betrag, Kategorie und Datum — bei einer
 * Liste gleich aussehender Zeilen ist „Wirklich löschen?" allein keine Bestätigung, sondern
 * ein Ratespiel. Dasselbe Muster wie die Kontolöschung in PROJ-1, dieselbe Komponente.
 *
 * **Das Ergebnis wird im Absendeweg behandelt, nicht in einem `useEffect`.** Die Action ruft
 * nach dem Löschen `refresh()`; damit verschwindet die Zeile — und diese Komponente hängt in
 * der Zeile. Ein Effect käme nie mehr zum Zug, weil die Komponente vorher ausgehängt ist, und
 * die von AC-23 verlangte Rückmeldung bliebe aus. Die Fortsetzung nach dem `await` läuft
 * dagegen weiter, ganz gleich, ob die Komponente noch im Baum steht.
 */
export function DeleteExpenseDialog({ expense }: { expense: Expense }) {
  const [open, setOpen] = useState(false)
  const [isPending, setPending] = useState(false)
  const [formError, setFormError] = useState<string | undefined>(undefined)

  async function submit(formData: FormData) {
    setPending(true)
    setFormError(undefined)

    const result = await deleteExpense(IDLE, formData)

    if (result.status === 'saved') {
      setOpen(false)
      toast('Ausgabe gelöscht.')
      return
    }

    setFormError(result.formError)
    setPending(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          className="h-8 px-2 font-grotesk text-[13px] text-muted-foreground hover:text-destructive"
        >
          Löschen
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-grotesk">Diese Ausgabe löschen?</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="tabular-nums">{formatAmount(expense.amount_cents)}</span>
            {' · '}
            {categoryLabel(expense.category)}
            {' · '}
            <span className="tabular-nums">{formatDay(expense.spent_on)}</span>
            {expense.note ? ` · ${expense.note}` : ''}
            <br />
            Das lässt sich nicht rückgängig machen.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {formError && (
          <p role="alert" className="text-[13px] text-destructive">
            {formError}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending} className="h-9 font-grotesk">
            Abbrechen
          </AlertDialogCancel>
          {/*
            Bewusst ein gewöhnlicher Button in einem eigenen Formular und NICHT
            `AlertDialogAction`: das ist bei Radix ein `Dialog.Close` und hängt das Formular
            aus, bevor React das Absenden verarbeiten kann — derselbe Fehler, den PROJ-1 als
            BUG-4 gefunden hat. Ohne `Close` bleibt der Dialog offen, solange die Action läuft,
            und der Fehlerfall („gibt es nicht mehr", EC-2) wird überhaupt erst sichtbar.
          */}
          <form action={submit}>
            <input type="hidden" name="id" value={expense.id} />
            <Button
              type="submit"
              variant="destructive"
              disabled={isPending}
              className="h-9 w-full font-grotesk"
            >
              {isPending ? 'Wird gelöscht …' : 'Löschen'}
            </Button>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
