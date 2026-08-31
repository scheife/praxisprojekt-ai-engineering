/**
 * Die neun Kategorien — die einzige Quelle für Auswahlfeld, Liste, Übersicht, Export und
 * Prüfregel.
 *
 * In der Datenbank steht ein **stabiler englischer Schlüssel**, in der Oberfläche der
 * deutsche Anzeigename. Damit lässt sich eine Kategorie umbenennen, ohne eine einzige
 * gespeicherte Zeile anzufassen (design.md, TD-2). Die Reihenfolge hier ist die Reihenfolge
 * im Auswahlfeld — sie folgt `docs/data-model.md`, nicht dem Alphabet.
 *
 * Wird die Liste geändert, muss die Prüfregel `expenses_category_known` in einer **neuen**
 * Migration mitgezogen werden: eine bereits eingespielte Migration wird nie bearbeitet.
 */
export const CATEGORIES = [
  { key: 'office_supplies', label: 'Büromaterial' },
  { key: 'software', label: 'Software & Abos' },
  { key: 'hardware', label: 'Hardware & Geräte' },
  { key: 'travel', label: 'Reise & Fahrt' },
  { key: 'hospitality', label: 'Bewirtung' },
  { key: 'education', label: 'Fortbildung' },
  { key: 'marketing', label: 'Marketing & Werbung' },
  { key: 'fees', label: 'Gebühren & Beiträge' },
  { key: 'other', label: 'Sonstiges' },
] as const

export type CategoryKey = (typeof CATEGORIES)[number]['key']

const LABELS = new Map<string, string>(CATEGORIES.map((c) => [c.key, c.label]))

/** Ist der Wert einer der neun Schlüssel? Die Prüfung, die AC-10 im Anwendungscode spiegelt. */
export function isCategoryKey(value: unknown): value is CategoryKey {
  return typeof value === 'string' && LABELS.has(value)
}

/**
 * Der deutsche Anzeigename zu einem Schlüssel.
 *
 * Fällt auf den Schlüssel selbst zurück, falls je eine Zeile mit einem Schlüssel auftaucht,
 * den der Code nicht mehr kennt — dann steht dort etwas Unschönes statt gar nichts. Der Fall
 * ist offen und in `design.md` unter *Offene Punkte* benannt (Entfernen einer Kategorie).
 */
export function categoryLabel(key: string): string {
  return LABELS.get(key) ?? key
}
