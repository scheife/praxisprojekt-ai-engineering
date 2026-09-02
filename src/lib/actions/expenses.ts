'use server'

import { refresh } from 'next/cache'

import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { TIMEOUT_MESSAGE } from '@/lib/supabase/deadline'
import { currencyLabel, DEFAULT_CURRENCY, isForeign } from '@/lib/expenses/currencies'
import { formatAmount, formatDay } from '@/lib/expenses/format'
import { monthOf } from '@/lib/expenses/month'
import { fetchRate, toEuroCents } from '@/lib/expenses/rate'
import type { ExpenseFormState } from '@/lib/expenses/form-state'
import {
  createExpenseSchema,
  updateExpenseSchema,
  type ExpenseFieldName,
} from '@/lib/validation/expense'

/**
 * Erfassen, Ändern und Löschen einer Ausgabe.
 *
 * Jede Action prüft in dieser Reihenfolge: **Anmeldung** (`requireUser()` aus PROJ-1, fragt den
 * Auth-Server und nicht nur das Cookie), dann die **Feldregeln** aus dem einen Schema, dann die
 * **Zugehörigkeit** — als eigene Bedingung in der Anweisung, zusätzlich zu Row Level Security
 * (AC-24, AC-25).
 *
 * **Die Nutzer-ID steht nie im Formular.** Sie kommt aus der geprüften Sitzung; ein Feld, das
 * sie transportiert, wäre ein Feld, das sich fälschen ließe.
 *
 * Server Actions verschicken grundsätzlich per POST — dieselbe strukturelle Zusicherung wie
 * bei PROJ-1.
 */


/**
 * Ein Satz für „gibt es nicht mehr" **und** für „gehört jemand anderem" (EC-2).
 * Wer hier unterscheidet, plaudert die Existenz fremder Ausgaben aus.
 */
const GONE = 'Diese Ausgabe gibt es nicht mehr.'
const SAVE_FAILED =
  'Das Speichern hat gerade nicht geklappt. Bitte versuch es in einem Moment noch einmal.'
/**
 * Die Meldung, wenn Datenbank oder Auth-Server binnen zwei Sekunden nicht antworten (EC-4).
 *
 * Sie sagt ausdrücklich, dass es **nicht an der Eingabe** liegt — sonst sucht die Person den
 * Fehler bei sich und ändert Werte, die richtig waren. Die Eingaben bleiben dabei stehen, weil
 * die Action nichts leert, was sie nicht gespeichert hat.
 */
const UNREACHABLE_MESSAGE = TIMEOUT_MESSAGE
const DELETE_FAILED =
  'Das Löschen hat gerade nicht geklappt. Bitte versuch es in einem Moment noch einmal.'

const FIELDS: ExpenseFieldName[] = ['amount', 'currency', 'category', 'spentOn', 'note']

/**
 * Die beiden Kursmeldungen — und der Unterschied zwischen ihnen ist der Punkt (EC-4).
 *
 * Der Dienst antwortet auf „Datum außerhalb", „Währung damals nicht geführt" und „Code
 * unbekannt" einheitlich mit 404; unterscheidbar sind deshalb genau zwei Klassen. Die eine ist
 * **dauerhaft** und schickt die Person dorthin, wo sie etwas ändern kann; die andere ist
 * vorübergehend und bittet um Geduld. Eine Meldung, die einen Ausfall behauptet, wo keiner ist,
 * lässt jemanden zehn Minuten später dasselbe noch einmal versuchen.
 */
function noRateForDate(currency: string, spentOn: string): string {
  return (
    `Für ${currencyLabel(currency)} gibt es zum ${formatDay(spentOn)} keinen Kurs. ` +
    `Bitte prüf das Datum oder wähl eine andere Währung.`
  )
}

const RATE_UNAVAILABLE =
  'Der Wechselkurs ist gerade nicht abrufbar. Bitte versuch es in einem Moment noch einmal — ' +
  'oder trag den Betrag in Euro ein.'

/** Was aus Währung, Betrag und Datum an Kurswerten in die Zeile geht. */
type Priced = {
  amount_cents: number
  amount_original: number
  currency: string
  rate_per_eur: number | null
  rate_date: string | null
}

/**
 * Rechnet einen eingegebenen Betrag in die Spalten der Zeile um — der einzige Ort, an dem das
 * passiert, damit Erfassen und Ändern nicht auseinanderlaufen können.
 *
 * Bei **Euro** kein Außenkontakt und kein Kurs (AC-2, AC-16): Der eingegebene Betrag ist der
 * Euro-Betrag, und beide Beträge sind gleich — genau das, was die Prüfregel der Datenbank
 * verlangt.
 *
 * Bei **Fremdwährung** wird entweder ein mitgegebener Kurs weiterverwendet (`reuse`, wenn beim
 * Ändern weder Währung noch Datum sich bewegt haben — AC-13) oder ein neuer geholt.
 */
async function price(
  amount: number,
  currency: string,
  spentOn: string,
  reuse?: { ratePerEur: number; rateDate: string },
): Promise<{ ok: true; row: Priced } | { ok: false; message: string }> {
  if (!isForeign(currency)) {
    return {
      ok: true,
      row: {
        amount_cents: amount,
        amount_original: amount,
        currency: DEFAULT_CURRENCY,
        rate_per_eur: null,
        rate_date: null,
      },
    }
  }

  let ratePerEur: number
  let rateDate: string

  if (reuse) {
    ;({ ratePerEur, rateDate } = reuse)
  } else {
    const lookup = await fetchRate(currency, spentOn)
    if (lookup.state === 'no-rate-for-date') {
      return { ok: false, message: noRateForDate(currency, spentOn) }
    }
    if (lookup.state === 'unavailable') {
      return { ok: false, message: RATE_UNAVAILABLE }
    }
    ;({ ratePerEur, rateDate } = lookup)
  }

  const converted = toEuroCents(amount, ratePerEur)

  // Die zweite Hälfte der Grenzprüfung (AC-18): Der Betrag war in seiner eigenen Währung
  // zulässig, der umgerechnete ist es nicht. Die Meldung nennt den umgerechneten Wert, sonst
  // wirkt die Ablehnung willkürlich.
  if (converted.state === 'above-maximum') {
    return {
      ok: false,
      message:
        `Das sind umgerechnet ${formatAmount(converted.amountCents)} — ` +
        `höchstens 9.999.999,99 € sind möglich.`,
    }
  }
  if (converted.state === 'below-minimum') {
    return {
      ok: false,
      message: 'Umgerechnet ergibt das weniger als 0,01 € — bitte prüf Betrag und Währung.',
    }
  }

  return {
    ok: true,
    row: {
      amount_cents: converted.amountCents,
      amount_original: amount,
      currency,
      rate_per_eur: ratePerEur,
      rate_date: rateDate,
    },
  }
}

/** Feldfehler aus dem Schema in die Form bringen, die das Formular anzeigt. */
function fieldErrorsFrom(
  issues: readonly { path: PropertyKey[]; message: string }[],
): NonNullable<ExpenseFormState['fieldErrors']> {
  const fieldErrors: NonNullable<ExpenseFormState['fieldErrors']> = {}
  for (const issue of issues) {
    const field = issue.path[0] as ExpenseFieldName
    if (FIELDS.includes(field) && !fieldErrors[field]) fieldErrors[field] = issue.message
  }
  return fieldErrors
}

function formValues(formData: FormData) {
  const currency = formData.get('currency')
  return {
    amount: String(formData.get('amount') ?? ''),
    // Fehlt das Feld ganz, gilt Euro — damit bleibt jeder Weg aus PROJ-2 gültig (EC-8).
    currency: currency === null ? undefined : String(currency),
    category: String(formData.get('category') ?? ''),
    spentOn: String(formData.get('spentOn') ?? ''),
    note: String(formData.get('note') ?? ''),
  }
}

/**
 * Ausgabe anlegen (AC-1, AC-4, EC-1).
 *
 * Der Doppelklick wird von der Eindeutigkeitsregel `(user_id, client_token)` abgefangen: beide
 * Anfragen tragen dieselbe Vorgangskennung, die Datenbank lässt nur eine Zeile entstehen, und
 * die zweite liest die Ablehnung als „schon erledigt" und meldet **Erfolg**. Genau eine
 * Ausgabe, kein Fehler.
 */
export async function createExpense(
  _prevState: ExpenseFormState,
  formData: FormData,
): Promise<ExpenseFormState> {
  const session = await requireUser()
  // EC-12: Ist die Anmeldung nicht feststellbar, wird nichts geschrieben und nichts behauptet.
  if (session.state === 'unavailable') {
    return { status: 'error', formError: UNREACHABLE_MESSAGE }
  }
  const { user } = session

  const clientToken = String(formData.get('clientToken') ?? '')
  const parsed = createExpenseSchema().safeParse({ ...formValues(formData), clientToken })

  if (!parsed.success) {
    const fieldErrors = fieldErrorsFrom(parsed.error.issues)
    // Eine ungültige Vorgangskennung ist kein Feldfehler — sie kann nur am Formular vorbei
    // entstehen und bekommt deshalb die formularweite Meldung.
    if (Object.keys(fieldErrors).length === 0) {
      return { status: 'error', formError: SAVE_FAILED }
    }
    return { status: 'error', fieldErrors }
  }

  const { amount, currency, category, spentOn, note } = parsed.data

  // Der Kurs kommt **nach** den Eingaberegeln und **vor** der Datenbank (design.md, TD-13):
  // Ein ungültiger Betrag löst so keinen Aufruf des fremden Dienstes aus, und ein Kursproblem
  // kann nie als Datenbankproblem erscheinen (EC-9). Scheitert er, entsteht keine Zeile —
  // die Werte bleiben im Formular stehen (AC-5).
  const priced = await price(amount, currency, spentOn)
  if (!priced.ok) return { status: 'error', formError: priced.message }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('expenses')
    .insert({
      user_id: user.id,
      ...priced.row,
      category,
      spent_on: spentOn,
      note,
      client_token: parsed.data.clientToken,
    })
    .select('spent_on')
    .single()

  if (error) {
    // 23505 = Verletzung der Eindeutigkeit. Derselbe Vorgang ist schon zu einer Zeile
    // geworden; es gibt nichts zu tun und nichts zu melden (EC-1).
    if (error.code === '23505') {
      const { data: existing } = await supabase
        .from('expenses')
        .select('spent_on')
        .eq('user_id', user.id)
        .eq('client_token', parsed.data.clientToken)
        .maybeSingle()

      if (existing) {
        refresh()
        return { status: 'saved', month: monthOf(existing.spent_on), token: clientToken }
      }
    }
    return { status: 'error', formError: SAVE_FAILED }
  }

  refresh()
  return { status: 'saved', month: monthOf(data.spent_on), token: clientToken }
}

/**
 * Ausgabe ändern (AC-20, AC-21, EC-3, EC-11).
 *
 * Alle vier Felder gehen in **einer** Anweisung; es gibt kein Lesen-Ändern-Zurückschreiben und
 * damit keine Stelle, an der sich zwei Stände mischen könnten. Betrifft die Anweisung keine
 * Zeile, gibt es die Ausgabe nicht mehr — oder sie gehört jemand anderem (EC-2). Beides
 * derselbe Satz. **Nie ein Upsert:** eine gelöschte Ausgabe darf hier nicht wieder entstehen.
 */
export async function updateExpense(
  _prevState: ExpenseFormState,
  formData: FormData,
): Promise<ExpenseFormState> {
  const session = await requireUser()
  // EC-12: Ist die Anmeldung nicht feststellbar, wird nichts geschrieben und nichts behauptet.
  if (session.state === 'unavailable') {
    return { status: 'error', formError: UNREACHABLE_MESSAGE }
  }
  const { user } = session

  const id = String(formData.get('id') ?? '')
  const parsed = updateExpenseSchema().safeParse({ ...formValues(formData), id })

  if (!parsed.success) {
    const fieldErrors = fieldErrorsFrom(parsed.error.issues)
    if (Object.keys(fieldErrors).length === 0) {
      return { status: 'error', formError: GONE }
    }
    return { status: 'error', fieldErrors }
  }

  const { amount, currency, category, spentOn, note } = parsed.data
  const supabase = await createClient()

  // Der gespeicherte Stand, **bevor** irgendetwas entschieden wird (design.md, TD-10). Nur er
  // beantwortet verlässlich, ob sich Währung oder Datum bewegt haben — was das Formular
  // mitschickt, sagt darüber nichts, und ein verstecktes Feld wäre vom Browser beeinflussbar.
  // Die Abfrage ist zugleich die Zugehörigkeitsprüfung, die es ohnehin braucht.
  const { data: current, error: readError } = await supabase
    .from('expenses')
    .select('currency, spent_on, rate_per_eur, rate_date')
    .eq('id', parsed.data.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (readError) return { status: 'error', formError: SAVE_FAILED }
  if (!current) {
    refresh()
    return { status: 'error', formError: GONE }
  }

  // Der Kurs hängt an genau zwei Angaben. Bleiben beide stehen, bleibt auch der Kurs stehen und
  // nur der Euro-Betrag wird neu gerechnet (AC-13) — eine korrigierte Rechnungssumme darf den
  // historischen Kurs nicht verschieben. Kategorie und Notiz lösen gar nichts aus (AC-14).
  const rateStillValid =
    currency === current.currency &&
    spentOn === current.spent_on &&
    current.rate_per_eur !== null &&
    current.rate_date !== null

  const priced = await price(
    amount,
    currency,
    spentOn,
    rateStillValid
      ? { ratePerEur: Number(current.rate_per_eur), rateDate: current.rate_date! }
      : undefined,
  )
  // Scheitert der Neuabruf, bleibt die gespeicherte Zeile **vollständig** unverändert (AC-15):
  // Bis hierher wurde nichts geschrieben.
  if (!priced.ok) return { status: 'error', formError: priced.message }

  const { data, error } = await supabase
    .from('expenses')
    // Alle Felder in **einer** Anweisung — es gibt keine Stelle, an der sich die Währung des
    // einen Tabs mit dem Kurs eines anderen mischen könnte (EC-7).
    .update({ ...priced.row, category, spent_on: spentOn, note })
    .eq('id', parsed.data.id)
    .eq('user_id', user.id)
    .select('spent_on')

  if (error) return { status: 'error', formError: SAVE_FAILED }
  if (!data || data.length === 0) {
    // Auf Stand bringen: der Tab, der hier hängt, zeigt einen Stand, den es nicht mehr gibt.
    refresh()
    return { status: 'error', formError: GONE }
  }

  refresh()
  return { status: 'saved', month: monthOf(data[0].spent_on), token: id }
}

/** Ausgabe löschen (AC-23, EC-2). Ebenfalls über die Zahl der betroffenen Zeilen. */
export async function deleteExpense(
  _prevState: ExpenseFormState,
  formData: FormData,
): Promise<ExpenseFormState> {
  const session = await requireUser()
  // EC-12: Ist die Anmeldung nicht feststellbar, wird nichts geschrieben und nichts behauptet.
  if (session.state === 'unavailable') {
    return { status: 'error', formError: UNREACHABLE_MESSAGE }
  }
  const { user } = session

  const id = String(formData.get('id') ?? '')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
    .select('spent_on')

  if (error) return { status: 'error', formError: DELETE_FAILED }
  if (!data || data.length === 0) {
    refresh()
    return { status: 'error', formError: GONE }
  }

  refresh()
  return { status: 'saved', month: monthOf(data[0].spent_on), token: id }
}
