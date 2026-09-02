'use client'

import { Fragment, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { updateExpense } from '@/lib/actions/expenses'
import { IDLE, type ExpenseFormState } from '@/lib/expenses/form-state'
import { CATEGORIES } from '@/lib/expenses/categories'
import {
  CURRENCIES,
  PINNED_CURRENCY_COUNT,
} from '@/lib/expenses/currencies'
import { formatMonthLabel } from '@/lib/expenses/format'
import type { Expense } from '@/lib/expenses/queries'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DateField } from '@/components/expenses/date-field'
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
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const LABEL =
  'font-grotesk text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground'

/** Cent zurück in die Schreibweise, die im Betragsfeld steht. */
function toAmountField(minorUnits: number): string {
  return (minorUnits / 100).toFixed(2).replace('.', ',')
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

  // **Der Originalbetrag**, nicht der Euro-Betrag: Wer 1.250,00 USD erfasst hat, muss im
  // Dialog 1.250,00 sehen und nicht die umgerechneten 1.078,24. Bei einer Euro-Ausgabe sind
  // beide ohnehin gleich (design.md, TD-12).
  const [amount, setAmount] = useState(() => toAmountField(expense.amount_original))
  const [currency, setCurrency] = useState<string>(expense.currency)
  const [category, setCategory] = useState(expense.category)
  const [spentOn, setSpentOn] = useState(expense.spent_on)
  const [note, setNote] = useState(expense.note ?? '')

  /**
   * Die Kennung, über die die sichtbaren Felder zum Formular gehören, **ohne in ihm zu liegen** —
   * dasselbe Muster wie in der Erfassungszeile, aus demselben Grund (Begründung am `<form>` unten).
   */
  const formId = `edit-expense-${expense.id}`

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
      // **Der Originalbetrag**, nicht der Euro-Betrag (BUG-1 aus `/e2e-tests`): Bei
      // 1.250,00 USD stand hier zuvor 1078,24 — wer dann irgendetwas speicherte,
      // schrieb diesen Euro-Betrag als Dollar-Betrag zurück und verkleinerte die
      // Ausgabe still. Die Initialisierung oben war schon richtig; diese zweite
      // Stelle war übersehen worden.
      setAmount(toAmountField(expense.amount_original))
      setCurrency(expense.currency)
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

        <div className="flex flex-col gap-4">
          {/**
            * **Das Formular umschließt die Felder nicht — es steht neben ihnen.**
            *
            * Dasselbe Muster wie in der Erfassungszeile, und hier aus einem Grund, der erst beim
            * Nachmessen sichtbar wurde: React 19 setzt ein Formular nach der Action zurück — auch
            * bei einer Client-Funktion wie `submit`. Radix hängt zu jedem `Select`, dessen Trigger
            * in einem Formular liegt, ein unkontrolliertes natives Auswahlfeld ein und reicht
            * dessen `change` über `onValueChange` in den React-Zustand zurück.
            *
            * Beim Speichern **mit Erfolg** fiel das nicht auf: Der Dialog schließt. Auf dem
            * **Fehlerweg** bleibt er offen — und dort sprang die eben gewählte Währung auf die
            * gespeicherte zurück, während die Meldung noch von der gewählten sprach. Wer dann
            * erneut auf „Speichern" drückte, schrieb still eine andere Währung als die, die er
            * gewählt hatte. Dieselbe Klasse wie BUG-1 aus `/e2e-tests`, nur eine Ebene später.
            *
            * Liegen die Trigger außerhalb des Formulars, entsteht das native Auswahlfeld gar nicht
            * erst. Die sichtbaren Felder gehören über `form={formId}` trotzdem dazu.
            */}
          <form id={formId} action={submit} noValidate hidden>
            <input type="hidden" name="id" value={expense.id} />
            <input type="hidden" name="category" value={category} />
            <input type="hidden" name="currency" value={currency} />
          </form>

          {formError && (
            <p
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[13px] text-destructive"
            >
              {formError}
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_6rem_minmax(0,1fr)]">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`amount-${expense.id}`} className={LABEL}>
                Betrag
              </Label>
              <Input
                id={`amount-${expense.id}`}
                name="amount"
                form={formId}
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
              <Label htmlFor={`currency-${expense.id}`} className={LABEL}>
                Währung
              </Label>
              {/* Ändert sich hier etwas — oder am Datum —, holt die Action einen neuen Kurs
                  (AC-12). Bleibt beides stehen und nur der Betrag ändert sich, bleibt der
                  eingefrorene Kurs unangetastet (AC-13). Umstellung auf EUR entfernt ihn
                  (AC-16). */}
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger
                  id={`currency-${expense.id}`}
                  aria-invalid={Boolean(fieldError?.currency)}
                  className="h-9 w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((item, index) => (
                    <Fragment key={item.code}>
                      {index === PINNED_CURRENCY_COUNT && <SelectSeparator />}
                      <SelectItem value={item.code}>
                        <span className="tabular-nums">{item.code}</span>{' '}
                        <span className="text-muted-foreground">{item.label}</span>
                      </SelectItem>
                    </Fragment>
                  ))}
                </SelectContent>
              </Select>
              {fieldError?.currency && (
                <p className="text-[13px] text-destructive">{fieldError.currency}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`spentOn-${expense.id}`} className={LABEL}>
                Datum
              </Label>
              {/* **Derselbe** Baustein wie in der Erfassungszeile — nicht ein zweiter daneben.
                  Daran hängt EC-15: Ein über den Kalender gesetztes Datum muss denselben Weg
                  nehmen wie ein getipptes, sonst bliebe bei einer Fremdwährungsausgabe der Kurs
                  des alten Datums stehen (PROJ-3, AC-12). Der Fehler wäre unsichtbar. */}
              <DateField
                id={`spentOn-${expense.id}`}
                form={formId}
                value={spentOn}
                onChange={setSpentOn}
                invalid={Boolean(fieldError?.spentOn)}
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
            <Select value={category} onValueChange={setCategory}>
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
              form={formId}
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
            <Button
              type="submit"
              form={formId}
              disabled={isPending}
              className="h-9 font-grotesk"
            >
              {isPending ? 'Moment …' : 'Speichern'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
