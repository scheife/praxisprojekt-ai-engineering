import type { ExpenseFieldName } from '@/lib/validation/expense'

/**
 * Der Zustand, den die drei Ausgaben-Formulare von ihrer Server Action zurückbekommen.
 *
 * Er steht hier und **nicht** in `src/lib/actions/expenses.ts`: Eine `'use server'`-Datei darf
 * ausschließlich async-Funktionen exportieren — jeder andere Export bricht zur Laufzeit ab
 * („A 'use server' file can only export async functions, found object"). Der Typ allein wäre
 * unbedenklich, weil er beim Übersetzen verschwindet; der Ausgangswert `IDLE` ist es nicht.
 */
export type ExpenseFormState = {
  status: 'idle' | 'saved' | 'error'
  /** Fehler, der das ganze Formular betrifft — als Zeile über den Feldern. */
  formError?: string
  /** Fehler direkt am verursachenden Feld. */
  fieldErrors?: Partial<Record<ExpenseFieldName, string>>
  /** Der Monat **nach** dem Vorgang. Die Ansicht folgt ihm (AC-4, EC-11). */
  month?: string
  /**
   * Die Kennung dieses Vorgangs — beim Erfassen die Vorgangskennung, sonst die der Ausgabe.
   * Die Oberfläche erkennt daran, dass eine Antwort neu ist, statt zweimal auf dieselbe
   * zu reagieren.
   */
  token?: string
}

export const IDLE: ExpenseFormState = { status: 'idle' }
