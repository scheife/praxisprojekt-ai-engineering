'use server'

import { refresh } from 'next/cache'

import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { monthOf } from '@/lib/expenses/month'
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
const DELETE_FAILED =
  'Das Löschen hat gerade nicht geklappt. Bitte versuch es in einem Moment noch einmal.'

const FIELDS: ExpenseFieldName[] = ['amount', 'category', 'spentOn', 'note']

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
  return {
    amount: String(formData.get('amount') ?? ''),
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
  const user = await requireUser()

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

  const { amount, category, spentOn, note } = parsed.data
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('expenses')
    .insert({
      user_id: user.id,
      amount_cents: amount,
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
  const user = await requireUser()

  const id = String(formData.get('id') ?? '')
  const parsed = updateExpenseSchema().safeParse({ ...formValues(formData), id })

  if (!parsed.success) {
    const fieldErrors = fieldErrorsFrom(parsed.error.issues)
    if (Object.keys(fieldErrors).length === 0) {
      return { status: 'error', formError: GONE }
    }
    return { status: 'error', fieldErrors }
  }

  const { amount, category, spentOn, note } = parsed.data
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('expenses')
    .update({ amount_cents: amount, category, spent_on: spentOn, note })
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
  const user = await requireUser()

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
