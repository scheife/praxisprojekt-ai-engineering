'use client'

import { Fragment, useActionState, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { createExpense } from '@/lib/actions/expenses'
import { IDLE } from '@/lib/expenses/form-state'
import { CATEGORIES } from '@/lib/expenses/categories'
import {
  CURRENCIES,
  DEFAULT_CURRENCY,
  PINNED_CURRENCY_COUNT,
} from '@/lib/expenses/currencies'
import { formatMonthLabel } from '@/lib/expenses/format'
import { monthOf } from '@/lib/expenses/month'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

/**
 * Die Erfassungszeile (AC-1 bis AC-9, AC-28, AC-29, AC-30).
 *
 * Sie steht **dauerhaft sichtbar** über der Liste, statt hinter einem Knopf zu warten: Das PRD
 * verspricht eine Ausgabe in unter 30 Sekunden, und ein Dialog kostet pro Ausgabe einen Klick
 * und einen Kontextwechsel (Produktentscheidung der Spec).
 *
 * Die vier Felder liegen im Browserzustand, damit nach einem Fehler nichts verloren geht (EC-4).
 */
export function ExpenseComposer({
  month,
  defaultDate,
}: {
  /** Der angezeigte Monat. */
  month: string
  /** Die Vorbelegung des Datums für diesen Monat, vom Server in Europe/Vienna gerechnet (AC-2). */
  defaultDate: string
}) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(createExpense, IDLE)

  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  /**
   * Die Währung wird nach dem Erfassen **nicht** zurückgesetzt (AC-6) — sie verhält sich wie
   * Kategorie und Datum, nicht wie Betrag und Notiz. Wer einen Stapel Dollar-Belege eintippt,
   * wählt sie einmal. Der Rücksetz-Effekt weiter unten fasst sie deshalb bewusst nicht an.
   */
  const [currency, setCurrency] = useState<string>(DEFAULT_CURRENCY)
  const [spentOn, setSpentOn] = useState(defaultDate)
  const [note, setNote] = useState('')
  const [clientToken, setClientToken] = useState(() => crypto.randomUUID())

  const amountRef = useRef<HTMLInputElement>(null)
  const handledToken = useRef<string | undefined>(undefined)

  /**
   * Die eine Regel, die AC-2 und AC-3 zusammen erfüllt: Das eingegebene Datum bleibt stehen,
   * **solange es im angezeigten Monat liegt**; sonst fällt es auf die Vorbelegung zurück.
   *
   * Nach einer Erfassung, die die Ansicht mitgezogen hat (AC-4), liegt es im nun angezeigten
   * Monat und bleibt. Nach einem Monatswechsel über die Pfeile liegt es außerhalb — dann
   * greift die Vorbelegung. Ohne diese Regel widersprächen sich AC-2 und AC-3.
   */
  const [seenMonth, setSeenMonth] = useState(month)
  if (month !== seenMonth) {
    setSeenMonth(month)
    if (monthOf(spentOn) !== month) setSpentOn(defaultDate)
  }

  useEffect(() => {
    if (state.status !== 'saved' || !state.token) return
    // Auf dieselbe Antwort nicht zweimal reagieren.
    if (handledToken.current === state.token) return
    handledToken.current = state.token

    // Betrag und Notiz leeren, Kategorie und Datum stehen lassen, Fokus zurück ins
    // Betragsfeld — Belege werden gebündelt nachgetragen (AC-3).
    setAmount('')
    setNote('')
    setClientToken(crypto.randomUUID())
    amountRef.current?.focus()

    // Die Ausgabe behält ihr Datum, die Ansicht folgt ihr (AC-4). Ohne den Wechsel würde die
    // eben erfasste Ausgabe unsichtbar verschwinden — der Moment, in dem sie ein zweites Mal
    // eingetragen wird.
    if (state.month && state.month !== month) {
      toast(`Erfasst — die Ansicht steht jetzt auf ${formatMonthLabel(state.month)}.`)
      router.push(`/?monat=${state.month}`)
    }
  }, [state, month, router])

  const fieldError = state.status === 'error' ? state.fieldErrors : undefined
  const errorCount = fieldError ? Object.keys(fieldError).length : 0

  return (
    <form
      action={formAction}
      noValidate
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
    >
      {state.status === 'error' && state.formError && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[13px] text-destructive"
        >
          {state.formError}
        </p>
      )}
      {errorCount > 1 && (
        <p role="alert" className="text-[13px] text-destructive">
          Bitte schau dir die markierten Felder an.
        </p>
      )}

      <input type="hidden" name="clientToken" value={clientToken} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[7rem_6rem_minmax(8rem,1fr)_9.5rem] lg:grid-cols-[7rem_6rem_10.5rem_9.5rem_minmax(0,1fr)_auto]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="amount" className={LABEL}>
            Betrag
          </Label>
          <Input
            id="amount"
            name="amount"
            ref={amountRef}
            inputMode="decimal"
            autoComplete="off"
            placeholder="24,90"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            aria-invalid={Boolean(fieldError?.amount)}
            aria-describedby={fieldError?.amount ? 'amount-error' : undefined}
            className="h-9 text-right tabular-nums"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="currency" className={LABEL}>
            Währung
          </Label>
          {/* Steht direkt neben dem Betrag, weil es ihn liest: „1.250,00" heißt erst etwas,
              wenn danebensteht, worin. Bei EUR — der Vorbelegung — wird kein Kurs geholt und
              gar kein fremder Dienst aufgerufen (AC-2). */}
          <Select name="currency" value={currency} onValueChange={setCurrency}>
            <SelectTrigger
              id="currency"
              aria-invalid={Boolean(fieldError?.currency)}
              aria-describedby={fieldError?.currency ? 'currency-error' : undefined}
              className="h-9 w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((item, index) => (
                <Fragment key={item.code}>
                  {index === PINNED_CURRENCY_COUNT && <SelectSeparator />}
                  <SelectItem value={item.code}>
                    <span className="tabular-nums">{item.code}</span>
                    <span className="ml-2 text-muted-foreground">{item.label}</span>
                  </SelectItem>
                </Fragment>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="category" className={LABEL}>
            Kategorie
          </Label>
          {/* Radix liefert bei gesetztem `name` ein verstecktes natives Feld mit — das Formular
              schickt die Kategorie also auch ohne eigenen Umweg mit. */}
          <Select name="category" value={category} onValueChange={setCategory}>
            <SelectTrigger
              id="category"
              aria-invalid={Boolean(fieldError?.category)}
              aria-describedby={fieldError?.category ? 'category-error' : undefined}
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
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="spentOn" className={LABEL}>
            Datum
          </Label>
          {/* Das native Datumsfeld liefert den Kalender des Systems, kennt die
              deutschsprachige Schreibweise von sich aus und ist am Telefon schneller zu
              bedienen als alles Nachgebaute (design.md, TD-14). */}
          <Input
            id="spentOn"
            name="spentOn"
            type="date"
            value={spentOn}
            onChange={(event) => setSpentOn(event.target.value)}
            aria-invalid={Boolean(fieldError?.spentOn)}
            aria-describedby={fieldError?.spentOn ? 'spentOn-error' : undefined}
            className="h-9"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="note" className={LABEL}>
            Notiz
          </Label>
          <Input
            id="note"
            name="note"
            autoComplete="off"
            placeholder="Wofür?"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            aria-invalid={Boolean(fieldError?.note)}
            aria-describedby={
              fieldError?.note ? 'note-error note-hint' : 'note-hint'
            }
            className="h-9"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={`${LABEL} hidden lg:block`} aria-hidden="true">
            &nbsp;
          </span>
          {/* Während des Absendens gesperrt — der zweite Klick wird gar nicht erst
              abgeschickt. Geht trotzdem eine zweite Anfrage durch, hält die
              Vorgangskennung (EC-1). */}
          <Button type="submit" disabled={isPending} className="h-9 font-grotesk">
            {isPending ? 'Moment …' : 'Erfassen'}
          </Button>
        </div>
      </div>

      {/* Dauerhaft sichtbar, nicht erst im Fehlerfall (AC-28, Art. 5 Abs. 1 lit. c DSGVO). */}
      <p id="note-hint" className="text-[13px] text-muted-foreground">
        Keine Namen anderer Personen und nichts Sensibles wie Gesundheitsangaben — eine kurze
        Beschreibung reicht.
      </p>

      {fieldError && (
        <div className="flex flex-col gap-1 text-[13px] text-destructive">
          {fieldError.amount && <p id="amount-error">{fieldError.amount}</p>}
          {fieldError.currency && <p id="currency-error">{fieldError.currency}</p>}
          {fieldError.category && <p id="category-error">{fieldError.category}</p>}
          {fieldError.spentOn && <p id="spentOn-error">{fieldError.spentOn}</p>}
          {fieldError.note && <p id="note-error">{fieldError.note}</p>}
        </div>
      )}
    </form>
  )
}
