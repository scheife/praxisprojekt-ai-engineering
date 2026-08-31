/**
 * Die Währungen, in denen eine Ausgabe erfasst werden kann (AC-1).
 *
 * **Der Schlüssel steht in den Daten, der Anzeigename im Code** — dasselbe Muster wie bei den
 * Kategorien (`categories.ts`, PROJ-2 TD-2). Eine Umbenennung kostet damit keine einzige
 * gespeicherte Zeile.
 *
 * **Die Liste wird bewusst NICHT vom Kursdienst geholt** (design.md, TD-7). Würde sie beim
 * Aufbau der Seite abgerufen, hinge das Erfassungsformular an dessen Verfügbarkeit — und damit
 * **auch die Erfassung in Euro**, die den Dienst sonst nie braucht (AC-2). Die Liste der
 * EZB-Referenzwährungen ändert sich alle paar Jahre; ein Ausfall passiert häufiger.
 *
 * Es sind genau die 30 Währungen, die der Dienst führt; dieselben stehen als Prüfregel in
 * `supabase/migrations/20260831140000_expenses_currency.sql`. Weichen die beiden Listen
 * auseinander, gewinnt die Datenbank — sie lehnt ab, was der Code durchgelassen hat.
 */

/**
 * Reihenfolge nach Wahrscheinlichkeit, nicht nach Alphabet (AC-1): Euro als Vorgabe, dann die
 * drei Währungen, in denen ein österreichisches Kleingewerbe praktisch alles einkauft. Der Rest
 * folgt alphabetisch nach Code — bei 26 Einträgen ist das die einzige Ordnung, in der man
 * etwas wiederfindet.
 */
export const CURRENCIES = [
  { code: 'EUR', label: 'Euro' },
  { code: 'USD', label: 'US-Dollar' },
  { code: 'CHF', label: 'Schweizer Franken' },
  { code: 'GBP', label: 'Britisches Pfund' },

  { code: 'AUD', label: 'Australischer Dollar' },
  { code: 'BRL', label: 'Brasilianischer Real' },
  { code: 'CAD', label: 'Kanadischer Dollar' },
  { code: 'CNY', label: 'Chinesischer Renminbi Yuan' },
  { code: 'CZK', label: 'Tschechische Krone' },
  { code: 'DKK', label: 'Dänische Krone' },
  { code: 'HKD', label: 'Hongkong-Dollar' },
  { code: 'HUF', label: 'Ungarischer Forint' },
  { code: 'IDR', label: 'Indonesische Rupiah' },
  { code: 'ILS', label: 'Israelischer neuer Schekel' },
  { code: 'INR', label: 'Indische Rupie' },
  { code: 'ISK', label: 'Isländische Krone' },
  { code: 'JPY', label: 'Japanischer Yen' },
  { code: 'KRW', label: 'Südkoreanischer Won' },
  { code: 'MXN', label: 'Mexikanischer Peso' },
  { code: 'MYR', label: 'Malaysischer Ringgit' },
  { code: 'NOK', label: 'Norwegische Krone' },
  { code: 'NZD', label: 'Neuseeland-Dollar' },
  { code: 'PHP', label: 'Philippinischer Peso' },
  { code: 'PLN', label: 'Polnischer Złoty' },
  { code: 'RON', label: 'Rumänischer Leu' },
  { code: 'SEK', label: 'Schwedische Krone' },
  { code: 'SGD', label: 'Singapur-Dollar' },
  { code: 'THB', label: 'Thailändischer Baht' },
  { code: 'TRY', label: 'Türkische Lira' },
  { code: 'ZAR', label: 'Südafrikanischer Rand' },
] as const

export type CurrencyCode = (typeof CURRENCIES)[number]['code']

/** Die Vorbelegung der Erfassungszeile, und die einzige Währung ohne Kurs (AC-1, AC-2). */
export const DEFAULT_CURRENCY = 'EUR' satisfies CurrencyCode

/**
 * Wie viele Einträge oben stehen, bevor die alphabetische Liste beginnt. Die Oberfläche setzt
 * dort einen Trenner — die Zahl steht hier, damit sie nicht in einer Komponente versteckt ist
 * und beim Ändern der Liste übersehen wird.
 */
export const PINNED_CURRENCY_COUNT = 4

const LABELS = new Map<string, string>(CURRENCIES.map((c) => [c.code, c.label]))

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === 'string' && LABELS.has(value)
}

/** `'USD'` → `'US-Dollar'`. Unbekannte Codes geben sich selbst zurück, wie bei den Kategorien. */
export function currencyLabel(code: string): string {
  return LABELS.get(code) ?? code
}

/** Trägt diese Ausgabe einen Wechselkurs? Genau dann, wenn sie nicht in Euro ist. */
export function isForeign(code: string): boolean {
  return code !== DEFAULT_CURRENCY
}
