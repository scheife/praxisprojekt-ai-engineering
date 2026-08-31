import { z } from 'zod'

import { isCategoryKey } from '@/lib/expenses/categories'
import { EARLIEST_DAY, todayInVienna } from '@/lib/expenses/month'

/**
 * Die verbindliche Prüfung einer Ausgabe — für das Erfassen **und** für den Änderungsdialog
 * (AC-21). Ein Schema, eine Quelle, dieselben Meldungen; die Formulare verzichten wie bei
 * PROJ-1 auf die browsereigene Prüfung.
 *
 * Sie läuft nur auf dem Server (AC-25). „Heute" wird deshalb hier bestimmt, in Europe/Vienna,
 * und nie aus der Uhr des Browsers gelesen (EC-6).
 *
 * **Das Schema wird je Anfrage gebaut, nicht einmal beim Laden des Moduls.** Sonst fröre der
 * Serverprozess „heute" beim Start ein, und nach Mitternacht wäre der laufende Tag plötzlich
 * Zukunft.
 */

/** 9.999.999,99 € — dieselbe Grenze wie `expenses_amount_cents_range` (AC-29). */
export const AMOUNT_MAX_CENTS = 999_999_999

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Betrag lesen (AC-5, AC-6). Gelesen wird ein **Text**, nicht eine Zahl:
 *
 * 1. Leerzeichen (auch geschützte) und `€` entfernen.
 * 2. Kommen Komma **und** Punkt vor, ist das rechteste der beiden das Dezimaltrennzeichen;
 *    jedes Vorkommen des anderen ist Tausendertrennzeichen und fällt weg.
 * 3. Kommt nur eines vor, ist es das Dezimaltrennzeichen — `1284,50` und `1284.50` ergeben
 *    denselben Wert. Mehr als einmal: ungültig.
 * 4. Übrig bleiben müssen Ziffern mit höchstens zwei Nachkommastellen.
 *
 * Das Ergebnis sind **ganze Cent**. Der Weg über Zeichenketten statt über `parseFloat` ist
 * Absicht: `24.99 * 100` ist in Gleitkomma 2498.9999999999995 (design.md, TD-1).
 */
function toCents(raw: string, fail: (message: string) => void): number | typeof z.NEVER {
  const cleaned = raw.replace(/[\s\u00a0\u202f\u20ac]/g, '')
  if (cleaned === '') {
    fail('Bitte gib einen Betrag ein.')
    return z.NEVER
  }

  const unreadable = 'Bitte gib den Betrag als Zahl ein, zum Beispiel 24,90.'
  const lastComma = cleaned.lastIndexOf(',')
  const lastDot = cleaned.lastIndexOf('.')

  let normalized = cleaned
  if (lastComma >= 0 && lastDot >= 0) {
    const decimal = lastComma > lastDot ? ',' : '.'
    const group = decimal === ',' ? '.' : ','
    normalized = cleaned.split(group).join('')
    if (normalized.split(decimal).length > 2) {
      fail(unreadable)
      return z.NEVER
    }
    normalized = normalized.replace(decimal, '.')
  } else if (lastComma >= 0 || lastDot >= 0) {
    const decimal = lastComma >= 0 ? ',' : '.'
    if (cleaned.split(decimal).length > 2) {
      fail(unreadable)
      return z.NEVER
    }
    normalized = cleaned.replace(decimal, '.')
  }

  // Das Minus wird bewusst mitgelesen, statt an dieser Stelle als „nicht lesbar" zu gelten:
  // ein negativer Betrag ist lesbar, nur nicht erlaubt — und verdient seine eigene Meldung.
  const match = /^(-?)(\d+)(?:\.(\d*))?$/.exec(normalized)
  if (!match) {
    fail(unreadable)
    return z.NEVER
  }

  const [, sign, whole, fraction = ''] = match
  if (fraction.length > 2) {
    fail('Höchstens zwei Nachkommastellen — zum Beispiel 24,90.')
    return z.NEVER
  }

  const cents = Number(whole) * 100 + Number((fraction + '00').slice(0, 2))
  const value = sign === '-' ? -cents : cents

  if (value <= 0) {
    fail('Der Betrag muss größer als 0 sein.')
    return z.NEVER
  }
  if (value > AMOUNT_MAX_CENTS) {
    fail('Der Betrag darf höchstens 9.999.999,99 € sein.')
    return z.NEVER
  }
  return value
}

/** Ist die Zeichenkette ein Datum, das es wirklich gibt? `2026-02-31` ist keines. */
function isRealDay(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false
  const date = new Date(`${day}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === day
}

/** Die vier Felder einer Ausgabe — identisch beim Erfassen und beim Ändern (AC-21). */
export function expenseFieldsSchema(now: Date = new Date()) {
  const today = todayInVienna(now)

  return z.object({
    /** Der geprüfte Betrag in **ganzen Cent**. */
    amount: z.string().transform((raw, ctx) =>
      toCents(raw, (message) => ctx.addIssue({ code: 'custom', message })),
    ),

    category: z
      .string()
      .min(1, 'Bitte wähl eine Kategorie.')
      // Über die Oberfläche nicht erreichbar — fängt den direkten Aufruf ab. Die Datenbank
      // lehnt ihn zusätzlich ab (AC-10).
      .refine(isCategoryKey, 'Diese Kategorie gibt es nicht.'),

    spentOn: z.string().transform((raw, ctx) => {
      if (!isRealDay(raw)) {
        ctx.addIssue({ code: 'custom', message: 'Bitte gib ein Datum ein.' })
        return z.NEVER
      }
      if (raw > today) {
        ctx.addIssue({
          code: 'custom',
          message: 'Das Datum darf nicht in der Zukunft liegen.',
        })
        return z.NEVER
      }
      if (raw < EARLIEST_DAY) {
        ctx.addIssue({
          code: 'custom',
          message: 'Das Datum liegt zu weit zurück — prüf bitte die Jahreszahl.',
        })
        return z.NEVER
      }
      return raw
    }),

    // Leer ist immer zulässig (AC-9) und wird als „fehlt" gespeichert, nicht als leerer Text.
    note: z
      .string()
      .trim()
      .max(200, 'Die Notiz darf höchstens 200 Zeichen haben.')
      .transform((value) => (value === '' ? null : value)),
  })
}

/** Erfassen: die vier Felder plus die Vorgangskennung des Erfassungsvorgangs (EC-1). */
export function createExpenseSchema(now: Date = new Date()) {
  return expenseFieldsSchema(now).extend({
    clientToken: z.string().regex(UUID, 'Ungültige Vorgangskennung.'),
  })
}

/** Ändern: die vier Felder plus die Kennung der Ausgabe. */
export function updateExpenseSchema(now: Date = new Date()) {
  return expenseFieldsSchema(now).extend({
    id: z.string().regex(UUID, 'Diese Ausgabe gibt es nicht mehr.'),
  })
}

export type ExpenseFields = z.infer<ReturnType<typeof expenseFieldsSchema>>
export type ExpenseFieldName = 'amount' | 'category' | 'spentOn' | 'note'
