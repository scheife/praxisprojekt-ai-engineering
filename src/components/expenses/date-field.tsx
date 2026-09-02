'use client'

import { CalendarDays } from 'lucide-react'
import { de } from 'react-day-picker/locale'
import { useState } from 'react'

import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { formatWeekday, formatWeekdayLong } from '@/lib/expenses/format'
import { EARLIEST_DAY, todayInVienna } from '@/lib/expenses/month'

/**
 * Das Datumsfeld — **ein** Baustein für die Erfassungszeile **und** den Änderungsdialog
 * (AC-31, AC-32, EC-14, EC-15; design.md TD-35 bis TD-39).
 *
 * **Warum einer und nicht zwei — das ist die Garantie hinter EC-15** (TD-38): Der Änderungsdialog
 * gehört PROJ-2, aber PROJ-3 hängt daran. Ändert sich dort das Datum, wird der Wechselkurs neu
 * geholt (PROJ-3, AC-12). Zwei getrennt verdrahtete Kalender driften auseinander, und der Fehler
 * wäre eine Ausgabe mit dem Kurs des **alten** Datums — richtig aussehend, still falsch. Ein
 * Baustein macht das Auseinanderlaufen unmöglich, nicht bloß unwahrscheinlich.
 *
 * **Zwei Wege zum selben Wert** (AC-31): Getippt und geklickt laufen beide durch dasselbe
 * `onChange` mit demselben `YYYY-MM-TT`. Es gibt keinen zweiten Pfad, den man vergessen könnte.
 *
 * **Der Kalender ist eine Bequemlichkeit, nie die Kontrolle** (TD-37): Er blendet unzulässige Tage
 * aus und begrenzt das Blättern — aber AC-7 (kein Zukunftsdatum) und AC-30 (nichts vor 2000)
 * werden weiterhin auf dem Server geprüft. Wer das Formular direkt anspricht, sieht keinen Kalender.
 */
export function DateField({
  id,
  form,
  value,
  onChange,
  invalid,
  describedBy,
}: {
  id: string
  /** Zugehörigkeit zum Formular, wenn das Feld außerhalb davon liegt (BUG-5, Erfassungszeile). */
  form?: string
  /** Der Tag als `YYYY-MM-TT` — dieselbe Schreibweise, die gespeichert wird. */
  value: string
  onChange: (day: string) => void
  invalid?: boolean
  describedBy?: string
}) {
  const [open, setOpen] = useState(false)
  const heute = todayInVienna()

  /**
   * Der Wochentag muss auch **vorgelesen** werden (AC-32, BUG-8).
   *
   * Sichtbar steht die Kurzform „Sa" — sie ist `aria-hidden`, weil ein Screenreader sie sonst
   * als zusammenhangloses Buchstabenpaar hinter dem Datum ausspricht. Ausgeschrieben gehört sie
   * dagegen in die **Beschreibung des Feldes**: Dann liest die Hilfstechnik „Datum, 15.08.2026,
   * Samstag" statt nur des Datums. AC-32 verlangt den Wochentag „ohne den Kalender zu öffnen" —
   * und der Kalender ist genau der Umweg, der hier sonst übrig bliebe.
   */
  const weekdayId = `${id}-weekday`
  const describedByAll =
    [describedBy, value ? weekdayId : undefined].filter(Boolean).join(' ') || undefined

  return (
    <div className="relative">
      {/*
        Das Feld bleibt `type="date"` und damit tippbar (TD-35). Ausgeblendet wird nur sein
        **eigener** Kalenderknopf: Neben unserem stünden sonst zwei Symbole für dieselbe Aufgabe.
        Unter iOS lässt sich ein solches Feld nicht tippen — dort öffnet ein Antippen das Walzenrad
        des Systems, und der Kalender daneben ist der einzige Weg, der den Wochentag zeigt.
      */}
      <Input
        id={id}
        name="spentOn"
        form={form}
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={invalid}
        aria-describedby={describedByAll}
        min={EARLIEST_DAY}
        max={heute}
        className="h-9 pr-20 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-inner-spin-button]:hidden"
      />

      {/*
        Dieselbe Auskunft für Hilfstechnik, ausgeschrieben und außerhalb des Bildes. `sr-only`
        statt `hidden`: Ein ausgeblendetes Element wird auch nicht vorgelesen, und dann wäre
        nichts gewonnen.
      */}
      {value && (
        <span id={weekdayId} className="sr-only">
          {formatWeekdayLong(value)}
        </span>
      )}

      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center gap-1 pr-1">
        {/* Der Wochentag, berechnet und nie gespeichert (AC-32, TD-39). Sichtbar in der
            Kurzform, vorgelesen wird die ausgeschriebene oben. */}
        <span
          aria-hidden
          className="text-[13px] tabular-nums text-muted-foreground"
        >
          {value ? formatWeekday(value) : ''}
        </span>

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            {/*
              `type="button"` steht hier ausdrücklich: Weder der shadcn-Button noch die
              Tagesknöpfe setzen es, und ein Knopf ohne `type` **schickt das Formular ab**.
              Genau diese Sorte Nebenwirkung war BUG-5.
            */}
            <button
              type="button"
              aria-label="Kalender öffnen"
              className="pointer-events-auto rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <CalendarDays className="size-4" aria-hidden />
            </button>
          </PopoverTrigger>

          <PopoverContent align="end" className="w-auto p-0">
            <Calendar
              mode="single"
              locale={de}
              selected={vonTag(value)}
              defaultMonth={vonTag(value) ?? vonTag(heute)}
              onSelect={(tag) => {
                if (!tag) return
                onChange(zuTag(tag))
                setOpen(false)
              }}
              /*
                Die Grenzen wirken zweifach (TD-37): `startMonth`/`endMonth` begrenzen das
                Blättern — sonst ist man mit zwei Klicks im Jahr 1850 —, `hidden` blendet die
                Tage außerhalb des Bereichs aus. Ein Tag, den man anklicken kann und der danach
                abgelehnt wird, ist eine Falle (EC-14).
              */
              startMonth={vonTag(EARLIEST_DAY)}
              endMonth={vonTag(heute)}
              hidden={{ before: vonTag(EARLIEST_DAY)!, after: vonTag(heute)! }}
              autoFocus
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}

/**
 * `2026-08-15` → `Date` in **Ortszeit**.
 *
 * Bewusst aus den Bestandteilen gebaut und nicht über `new Date('2026-08-15')`: Letzteres liest
 * den Text als UTC-Mitternacht, und westlich von Greenwich zeigt der Kalender dann den Vortag an.
 * `react-day-picker` vergleicht in Ortszeit, also wird auch in Ortszeit gebaut.
 */
function vonTag(day: string): Date | undefined {
  if (!day) return undefined
  const [jahr, monat, tag] = day.split('-').map(Number)
  if (!jahr || !monat || !tag) return undefined
  return new Date(jahr, monat - 1, tag)
}

/** Der Rückweg: `Date` → `2026-08-15`, ebenfalls in Ortszeit und ohne `toISOString()`. */
function zuTag(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`
}
