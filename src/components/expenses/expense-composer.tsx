'use client'

import {
  Fragment,
  useActionState,
  useEffect,
  useRef,
  useState,
} from 'react'
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
import { DateField } from '@/components/expenses/date-field'
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
 * Die Kennung, über die die sichtbaren Felder zum Formular gehören, **ohne in ihm zu liegen**.
 *
 * HTML erlaubt das seit jeher: Ein Feld mit `form="…"` wird mitgeschickt, egal wo es im Dokument
 * steht. Genau darauf beruht die Lösung von BUG-2 und BUG-5 (Begründung am `<form>` unten).
 */
const FORM_ID = 'expense-composer'

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
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      {/**
        * **Das Formular umschließt die Felder nicht — es steht neben ihnen.**
        *
        * Zwei Zusicherungen stehen hier gegeneinander, und beide sind hart:
        *
        * 1. **`action={formAction}` ist Pflicht** (BUG-5 aus `/qa`). Nur damit steht
        *    `method="POST"` im ausgelieferten Markup. Ein Formular ohne `method` sendet nativ per
        *    **GET** — Betrag, Kategorie, Datum und die Notiz landen dann in der Adresszeile und
        *    von dort im Browserverlauf, in Server-Protokollen und in `Referer`-Kopfzeilen
        *    (`.claude/rules/security.md` → *Sensitive Data in URLs*). Der frühere Ausweg über
        *    `onSubmit` hat genau das verloren.
        * 2. **Die Auswahl darf das Speichern überleben** (BUG-2, AC-6 und PROJ-2 AC-3). React 19
        *    setzt ein Formular nach einer Server Action zurück. Radix hängt zu **jedem** `Select`,
        *    dessen Trigger in einem Formular liegt, ein unkontrolliertes natives Auswahlfeld ein —
        *    unabhängig von `name` — und reicht dessen `change` über `onValueChange` in den
        *    React-Zustand zurück. Beim Zurücksetzen fällt dieses Feld auf seine **erste** Option:
        *    Währung auf EUR, Kategorie auf „Wählen".
        *
        * Beides zusammen geht nur, wenn die `Select`-Trigger **nicht im Formular liegen**. Dann
        * ist Radix' `isFormControl` falsch, das native Auswahlfeld entsteht gar nicht erst, und es
        * gibt nichts, was zurückgesetzt werden könnte. Die sichtbaren Felder gehören über
        * `form={FORM_ID}` trotzdem dazu und werden mitgeschickt.
        *
        * **Verworfen:** das `reset`-Ereignis abzufangen. Es ist zwar abbrechbar, aber React setzt
        * die Felder auch dann zurück — nachgemessen im Browser: `defaultPrevented=true`, und
        * unmittelbar danach trotzdem `change → EUR`. Eine Behebung, die nur meistens greift, ist
        * hier keine.
        */}
      <form id={FORM_ID} action={formAction} noValidate hidden>
        <input type="hidden" name="clientToken" value={clientToken} />
        <input type="hidden" name="category" value={category} />
        <input type="hidden" name="currency" value={currency} />
      </form>

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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[7rem_6rem_minmax(8rem,1fr)_9.5rem] lg:grid-cols-[7rem_6rem_10.5rem_9.5rem_minmax(0,1fr)_auto]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="amount" className={LABEL}>
            Betrag
          </Label>
          <Input
            id="amount"
            name="amount"
            form={FORM_ID}
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
          <Select value={currency} onValueChange={setCurrency}>
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
                    {/* Das Leerzeichen ist kein Versehen: Ohne es lautet der zugängliche
                        Name „USDUS-Dollar" und ein Screenreader liest ein Wortmonster vor
                        (BUG-4 aus `/e2e-tests`). */}
                    <span className="tabular-nums">{item.code}</span>{' '}
                    <span className="text-muted-foreground">{item.label}</span>
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
          {/* Die Kategorie geht über das versteckte Feld oben ins Formular, nicht über `name`
              am `Select` (Begründung dort). */}
          <Select value={category} onValueChange={setCategory}>
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
          {/* Tippen bleibt, der Kalender kommt daneben — beide Wege schreiben denselben Wert
              durch dasselbe `onChange` (AC-31, AC-32; design.md TD-35, TD-38). */}
          <DateField
            id="spentOn"
            form={FORM_ID}
            value={spentOn}
            onChange={setSpentOn}
            invalid={Boolean(fieldError?.spentOn)}
            describedBy={fieldError?.spentOn ? 'spentOn-error' : undefined}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="note" className={LABEL}>
            Notiz
          </Label>
          <Input
            id="note"
            name="note"
            form={FORM_ID}
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
          <Button
            type="submit"
            form={FORM_ID}
            disabled={isPending}
            className="h-9 font-grotesk"
          >
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
    </div>
  )
}
