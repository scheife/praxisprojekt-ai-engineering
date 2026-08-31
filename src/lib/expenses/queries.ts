import { createClient } from '@/lib/supabase/server'
import { monthBounds } from '@/lib/expenses/month'

/**
 * Die Leseseite: alle eigenen Ausgaben eines Monats und der älteste eigene Monat.
 *
 * Beide Abfragen tragen die Bedingung auf die eigene Nutzer-ID **im Anwendungscode** —
 * zusätzlich zu Row Level Security, nicht statt ihr. AC-24 verlangt die Datenbankschicht,
 * AC-25 die Anwendungsschicht; zwei unabhängige Prüfungen, weil früher oder später eine
 * davon umgangen wird.
 */

export type Expense = {
  id: string
  amount_cents: number
  category: string
  spent_on: string
  note: string | null
  created_at: string
}

/**
 * Die Zeilen eines Monats, absteigend nach Datum und bei gleichem Datum die zuletzt erfasste
 * zuerst (AC-11). Eine Abfrage, ein Index — die Summen rechnet `summarize()` aus denselben
 * Zeilen, es gibt keine zweite Abfrage für die Übersicht (design.md, TD-7).
 */
export async function listMonth(userId: string, month: string): Promise<Expense[]> {
  const { first, last } = monthBounds(month)
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('expenses')
    .select('id, amount_cents, category, spent_on, note, created_at')
    .eq('user_id', userId)
    .gte('spent_on', first)
    .lte('spent_on', last)
    .order('spent_on', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

/**
 * Der Monat der ältesten eigenen Ausgabe, oder `null`. Bedient die Rückwärtsgrenze aus AC-18.
 *
 * Wird bei **jedem** Aufbau neu bestimmt und nirgends gespeichert — deshalb rückt die Grenze
 * nach dem Löschen der letzten Ausgabe eines Monats von selbst nach (EC-8).
 */
export async function oldestMonth(userId: string): Promise<string | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('expenses')
    .select('spent_on')
    .eq('user_id', userId)
    .order('spent_on', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data ? data.spent_on.slice(0, 7) : null
}

/** Alle eigenen Ausgaben, in der Reihenfolge der Liste — die Grundlage des Exports (AC-27). */
export async function listAll(userId: string): Promise<Expense[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('expenses')
    .select('id, amount_cents, category, spent_on, note, created_at')
    .eq('user_id', userId)
    .order('spent_on', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}
