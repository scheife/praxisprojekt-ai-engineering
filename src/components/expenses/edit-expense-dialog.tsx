'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { updateExpense } from '@/lib/actions/expenses'
import { IDLE, type ExpenseFormState } from '@/lib/expenses/form-state'
import { CATEGORIES } from '@/lib/expenses/categories'
import { formatMonthLabel } from '@/lib/expenses/format'
import type { Expense } from '@/lib/expenses/queries'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const LABEL =
  'font-grotesk text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground'

/** Cent zurück in die Schreibweise, die im Betragsfeld steht. */
function toAmountField(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}

/**
 * Ändern einer Ausgabe (AC-20, AC-21, EC-11).
 *
 * Der Dialog öffnet mit dem **gespeicherten** Stand und schickt beim Speichern alle vier
 * Felder — die Action schreibt sie in einer Anweisung, es entsteht also keine Mischung aus
 * zwei Ständen (EC-3). Es gelten dieselben Regeln und dieselben Meldungen wie beim Erfassen,
 * weil beide Wege durch dasselbe Schema gehen (AC-21).
 *
 * **Das Ergebnis wird im Absendeweg behandelt, nicht in einem `useEffect`** — aus demselben
 * Grund wie beim Löschen: Verschiebt die Änderung die Ausgabe in einen anderen Monat, ist die
 * Zeile nach `refresh()` weg und mit ihr dieser Dialog. Ein Effect liefe nie, und genau der
 * Fall, den EC-11 beschreibt, bliebe stumm.
 */
export function EditExpenseDialog({ expense, month }: { expense: Expense; month: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, setPending] = useState(false)
  const [formError, setFormError] = useState<string | undefined>(undefined)
  const [fieldError, setFieldError] = useState<ExpenseFormState['fieldErrors']>(undefined)

  const [amount, setAmount] = useState(() => toAmountField(expense.amount_cents))
  const [category, setCategory] = useState(expense.category)
  const [spentOn, setSpentOn] = useState(expense.spent_on)
  const [note, setNote] = useState(expense.note ?? '')

  async function submit(formData: FormData) {
    setPending(true)
    setFormError(undefined)
    setFieldError(undefined)

    try {
      const result = await updateExpense(IDLE, formData)

      if (result.status === 'saved') {
        setOpen(false)
        // Verschiebt die Änderung die Ausgabe in einen anderen Monat, folgt die Ansicht mit —
        // sonst verschwände sie kommentarlos aus der Liste (EC-11).
        if (result.month && result.month !== month) {
          toast(`Gespeichert — die Ausgabe liegt jetzt im ${formatMonthLabel(result.month)}.`)
          router.push(`/?monat=${result.month}`)
        }
        return
      }

      setFormError(result.formError)
      setFieldError(result.fieldErrors)
    } finally {
      // **Auch auf dem Erfolgsweg** zurücksetzen, und deshalb in `finally`.
      //
      // Bleibt die Ausgabe im selben Monat, bleibt ihre Zeile stehen — diese Komponente hängt
      // in der Zeile und wird also **nicht** ausgehängt. Ohne das Zurücksetzen behielte sie
      // `isPending` für immer: beim nächsten Öffnen hieße „Speichern" dauerhaft „Moment …",
      // und die Ausgabe wäre bis zum Neuladen der Seite nicht mehr änderbar (BUG-5).
      // Verschiebt die Änderung sie dagegen in einen anderen Monat, verschwindet die Zeile —
      // dann fiel es nicht auf, was genau der Grund war, warum der Fehler den häufigen Fall traf.
      setPending(false)
    }
  }

  /** Beim Öffnen wieder auf den gespeicherten Stand — nicht auf den letzten Tippversuch. */
  function onOpenChange(next: boolean) {
    if (next) {
      setAmount(toAmountField(expense.amount_cents))
      setCategory(expense.category)
      setSpentOn(expense.spent_on)
      setNote(expense.note ?? '')
      setFormError(undefined)
      setFieldError(undefined)
    }
    setOpen(next)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="h-8 px-2 font-grotesk text-[13px]">
          Ändern
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-grotesk">Ausgabe ändern</DialogTitle>
          <DialogDescription>
            Es gelten dieselben Regeln wie beim Erfassen.
          </DialogDescription>
        </DialogHeader>

        <form action={submit} noValidate className="flex flex-col gap-4">
          <input type="hidden" name="id" value={expense.id} />

          {formError && (
            <p
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[13px] text-destructive"
            >
              {formError}
            </p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`amount-${expense.id}`} className={LABEL}>
                Betrag
              </Label>
              <Input
                id={`amount-${expense.id}`}
                name="amount"
                inputMode="decimal"
                autoComplete="off"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                aria-invalid={Boolean(fieldError?.amount)}
                className="h-9 text-right tabular-nums"
              />
              {fieldError?.amount && (
                <p className="text-[13px] text-destructive">{fieldError.amount}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`spentOn-${expense.id}`} className={LABEL}>
                Datum
              </Label>
              <Input
                id={`spentOn-${expense.id}`}
                name="spentOn"
                type="date"
                value={spentOn}
                onChange={(event) => setSpentOn(event.target.value)}
                aria-invalid={Boolean(fieldError?.spentOn)}
                className="h-9"
              />
              {fieldError?.spentOn && (
                <p className="text-[13px] text-destructive">{fieldError.spentOn}</p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`category-${expense.id}`} className={LABEL}>
              Kategorie
            </Label>
            <Select name="category" value={category} onValueChange={setCategory}>
              <SelectTrigger
                id={`category-${expense.id}`}
                aria-invalid={Boolean(fieldError?.category)}
                className="h-9 w-full"
              >
                <SelectValue placeholder="Wählen" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((item) => (
                  <SelectItem key={item.key} value={item.key}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldError?.category && (
              <p className="text-[13px] text-destructive">{fieldError.category}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`note-${expense.id}`} className={LABEL}>
              Notiz
            </Label>
            <Input
              id={`note-${expense.id}`}
              name="note"
              autoComplete="off"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              aria-invalid={Boolean(fieldError?.note)}
              aria-describedby={`note-hint-${expense.id}`}
              className="h-9"
            />
            <p id={`note-hint-${expense.id}`} className="text-[13px] text-muted-foreground">
              Keine Namen anderer Personen und nichts Sensibles wie Gesundheitsangaben.
            </p>
            {fieldError?.note && (
              <p className="text-[13px] text-destructive">{fieldError.note}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setOpen(false)}
              className="h-9 font-grotesk"
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={isPending} className="h-9 font-grotesk">
              {isPending ? 'Moment …' : 'Speichern'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
