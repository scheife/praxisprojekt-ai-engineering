import { AMOUNT_MAX_CENTS } from '@/lib/validation/expense'
import { todayInVienna } from '@/lib/expenses/month'

/**
 * Der Wechselkurs — Abruf und Umrechnung (AC-3 bis AC-5, AC-8, EC-2 bis EC-6).
 *
 * Dies ist die **einzige** Stelle des Produkts mit Außenkontakt. Sie läuft ausschließlich auf
 * dem Server: Ein Abruf aus dem Browser schickte die IP-Adresse der erfassenden Person an einen
 * fremden Dienst, und `spec.md` sagt ausdrücklich zu, dass nichts Personenbezogenes die
 * Anwendung verlässt (design.md, TD-6). Hinaus gehen nur ein Datum und zwei Währungscodes.
 */

/**
 * **Nicht `api.frankfurter.app`** — die alte Adresse antwortet mit HTTP 301 auf diese hier
 * (gemessen am 31.08.2026, design.md TD-1). Die Zieladresse steht fest im Code, und
 * Weiterleitungen werden **nicht** verfolgt: Wer einer Weiterleitung automatisch folgt, lässt
 * einen fremden Dienst bestimmen, wohin die eigenen Aufrufe gehen. Zieht der Dienst erneut um,
 * fällt das hier als Fehler auf, statt still woandershin zu zeigen.
 */
const BASE_URL = 'https://api.frankfurter.dev/v1'

/**
 * Wie lange auf den Kurs gewartet wird, bevor der Abruf als Störung gilt (EC-2).
 *
 * Ein einzelner GET gegen einen Dienst, der seine Antworten selbst zum Zwischenspeichern
 * freigibt. 5 Sekunden sind großzügig genug, dass eine langsame Verbindung nicht grundlos
 * scheitert, und kurz genug, dass die Erfassung nicht hängt. PROJ-1 nutzt für die Datenbank
 * 2 Sekunden — über das offene Netz ist mehr angemessen (design.md, TD-5).
 */
const TIMEOUT_MS = 5000

export type RateLookup =
  /** Kurs gefunden. `rateDate` ist der Tag, für den er **tatsächlich** gilt (AC-4). */
  | { state: 'ok'; ratePerEur: number; rateDate: string }
  /** Für diese Währung gibt es zu diesem Datum keinen Kurs. **Dauerhaft** — Warten hilft nicht. */
  | { state: 'no-rate-for-date' }
  /** Der Dienst ist gerade nicht erreichbar oder antwortet unbrauchbar. **Vorübergehend.** */
  | { state: 'unavailable' }

/**
 * Holt den Kurs zu einem Tag — als **„1 EUR = X Fremdwährung"**.
 *
 * **Warum diese Richtung** (design.md, TD-2): Die Gegenrichtung kommt auf feste
 * Nachkommastellen gerundet an und behält bei Währungen mit großen Zahlen nur zwei
 * signifikante Stellen. Gemessen: 10.000.000 IDR ergäben 480,00 € statt 484,78 € — rund 1 %
 * Fehler, allein aus der Rundung. Diese Richtung ist zugleich die, in der die EZB veröffentlicht
 * und in der Europa Kurse liest.
 *
 * **Zwei Fehlerklassen, nicht drei** (TD-4): Der Dienst antwortet auf „Datum außerhalb",
 * „Währung damals nicht geführt" und „Code unbekannt" einheitlich mit HTTP 404 — er
 * unterscheidet diese Fälle nicht, und dieser Code erfindet die Unterscheidung nicht.
 *
 * @param currency ISO-4217-Code der Fremdwährung. `EUR` gehört hier nie hinein — eine
 *   Euro-Ausgabe ruft diese Funktion gar nicht erst auf (AC-2).
 * @param day Das Ausgabedatum als `YYYY-MM-TT`.
 */
export async function fetchRate(currency: string, day: string): Promise<RateLookup> {
  const url = `${BASE_URL}/${day}?base=EUR&symbols=${currency}`

  let response: Response
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: 'error',
      // Abgeschlossene Tage sind unveränderlich und werden dauerhaft wiederverwendet; der
      // laufende Tag NICHT (design.md, TD-11). Der EZB-Kurs von heute erscheint erst am
      // Nachmittag — würde die Vormittagsantwort festgehalten, bekämen alle weiteren
      // Erfassungen dieses Tages den Vortageskurs, über ein Wochenende bis zu drei Tage alt.
      cache: isCompletedDay(day) ? 'force-cache' : 'no-store',
    })
  } catch {
    // Netzwerkfehler, abgelaufene Frist, verweigerte Weiterleitung — alles vorübergehend.
    return { state: 'unavailable' }
  }

  // 404 heißt: für diese Kombination aus Währung und Datum gibt es keinen Kurs. Ein zweiter
  // Versuch ändert daran nichts, und die Meldung darf keinen Ausfall behaupten (EC-4).
  if (response.status === 404) return { state: 'no-rate-for-date' }
  if (!response.ok) return { state: 'unavailable' }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    return { state: 'unavailable' }
  }

  return readRate(body, currency)
}

/**
 * Liest Kurs und Kursdatum aus der Antwort — getrennt vom Abruf, damit die Auswertung ohne
 * Netz prüfbar ist.
 *
 * Fehlt die angefragte Währung in einer sonst gültigen Antwort, gilt dasselbe wie bei 404:
 * Für diesen Tag gibt es sie nicht. Ein unbrauchbarer **Wert** dagegen — 0, negativ, keine
 * Zahl — ist eine Störung und nie ein Kurs (EC-3): Eine Ausgabe mit unsinnigem Euro-Wert darf
 * nicht entstehen.
 */
export function readRate(body: unknown, currency: string): RateLookup {
  if (typeof body !== 'object' || body === null) return { state: 'unavailable' }

  const { rates, date } = body as { rates?: unknown; date?: unknown }

  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { state: 'unavailable' }
  }
  if (typeof rates !== 'object' || rates === null) return { state: 'unavailable' }

  if (!(currency in (rates as Record<string, unknown>))) {
    return { state: 'no-rate-for-date' }
  }

  const rate = (rates as Record<string, unknown>)[currency]
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
    return { state: 'unavailable' }
  }

  return { state: 'ok', ratePerEur: rate, rateDate: date }
}

/** Liegt der Tag vor dem heutigen in Wien? Nur dann ist sein Kurs unveränderlich. */
export function isCompletedDay(day: string, now: Date = new Date()): boolean {
  return day < todayInVienna(now)
}

/**
 * Der umgerechnete Betrag wird **auch bei einer Ablehnung** mitgegeben: AC-18 verlangt, dass die
 * Meldung den umgerechneten Wert nennt. Ohne ihn wirkt die Ablehnung eines zulässig aussehenden
 * Betrags willkürlich — „9.999.999,99 sind erlaubt, deine 500.000 nicht" erklärt sich erst,
 * wenn dabeisteht, dass daraus 12 Millionen Euro geworden wären.
 */
export type Conversion =
  | { state: 'ok'; amountCents: number }
  /** Umgerechnet weniger als ein Cent — wird abgelehnt statt still auf null gerundet (EC-5). */
  | { state: 'below-minimum'; amountCents: number }
  /** Umgerechnet über 9.999.999,99 € — dieselbe Grenze wie in PROJ-2 (AC-18). */
  | { state: 'above-maximum'; amountCents: number }

/**
 * Rechnet einen Fremdwährungsbetrag in Euro-Cent um (AC-8, AC-18, EC-5).
 *
 * Beide Beträge stehen in Hundertsteln ihrer Währung, deshalb ist der Quotient unmittelbar der
 * Euro-Betrag in Cent — es braucht keinen Umweg über Kommazahlen.
 *
 * Gerundet wird kaufmännisch auf ganze Cent. Ein Betrag größer null wird dabei **nie zu null**:
 * Ergibt die Umrechnung weniger als einen halben Cent, ist das eine Ablehnung und keine Null,
 * sonst entstünde eine Ausgabe über 0,00 €, die in jeder Summe unsichtbar bliebe.
 */
export function toEuroCents(amountOriginal: number, ratePerEur: number): Conversion {
  const amountCents = Math.round(amountOriginal / ratePerEur)

  if (amountCents < 1) return { state: 'below-minimum', amountCents }
  if (amountCents > AMOUNT_MAX_CENTS) return { state: 'above-maximum', amountCents }

  return { state: 'ok', amountCents }
}
