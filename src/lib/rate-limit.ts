import { createClient } from '@/lib/supabase/server'

/**
 * Die Drosselung gegen automatisiertes Passwort-Raten.
 *
 * Die Zähler liegen in Postgres, nicht bei einem Cache-Dienst: kein zweites Konto, kein
 * weiterer Schlüssel, und die 24-Stunden-Löschung ist in derselben Datenbank nachweisbar,
 * in der sie entsteht (design.md, TD-4).
 *
 * Werte: 5 Versuche in 15 Minuten, getrennt je E-Mail-Adresse und je IP-Adresse (AC-8, AC-9).
 * Prüfen und Festhalten passieren in **einem** Datenbankaufruf — eine getrennte
 * „zurücksetzen"-Funktion, die der Browser aufrufen könnte, würde die ganze Drosselung
 * wertlos machen.
 */

export type GateResult =
  | { state: 'allowed' }
  | { state: 'blocked'; retryAfterMinutes: number }
  | { state: 'unavailable' }

/**
 * Die IP der anfragenden Person aus den Kopfzeilen.
 *
 * Im lokalen Betrieb ohne vorgelagerten Server gibt es keine — dann greift nur die
 * Adress-Regel, statt alle Anfragen in einen gemeinsamen Topf zu werfen und die
 * Entwicklung nach fünf Tippfehlern auszusperren (design.md, TD-14).
 */
export function clientIpFrom(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    // Bei mehreren Einträgen ist der erste die ursprüngliche Person.
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  return headers.get('x-real-ip')?.trim() || null
}

/** Restsekunden in aufgerundete Minuten — „in 0 Minuten" wäre keine Auskunft. */
export function retryAfterMinutes(seconds: number): number {
  return Math.max(1, Math.ceil(seconds / 60))
}

/**
 * Prüft die Sperre und hält den Versuch fest. Wird **vor** der Prüfung der Zugangsdaten
 * aufgerufen — auch für Adressen, zu denen es gar kein Konto gibt, sonst verriete das
 * Einsetzen der Drosselung, welche Adresse existiert (AC-7).
 */
export async function passLoginGate(
  email: string,
  ip: string | null,
): Promise<GateResult> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('login_attempt_gate', {
    p_email: email,
    p_ip: ip,
  })

  // Ist die Datenbank nicht erreichbar, wird nicht durchgewinkt. Eine Drosselung, die bei
  // einer Störung aussetzt, ist genau dann weg, wenn sie gebraucht wird.
  if (error) return { state: 'unavailable' }

  const row = Array.isArray(data) ? data[0] : data
  if (!row) return { state: 'unavailable' }

  const { blocked, retry_after_seconds } = row as {
    blocked: boolean
    retry_after_seconds: number
  }

  return blocked
    ? { state: 'blocked', retryAfterMinutes: retryAfterMinutes(retry_after_seconds) }
    : { state: 'allowed' }
}

/**
 * Prüft und zählt Registrierungsversuche — 10 je IP-Adresse in 60 Minuten.
 *
 * Nötig, weil das Limit, auf das sich das Design stützte, in diesem Stack nicht existiert:
 * `GOTRUE_RATE_LIMIT_SIGN_IN_SIGN_UPS` ist im Auth-Container nicht gesetzt, und 40 von 40
 * Direktregistrierungen gingen durch. Ein CAPTCHA bleibt die stärkere Maßnahme und ist in
 * `spec.md` bewusst zurückgestellt; das hier schließt nur die Lücke.
 *
 * Anders als beim Anmelden zählt hier **nur die IP**: Die Adresse ist bei jeder Registrierung
 * eine neue und taugt nicht als Schlüssel.
 */
export async function passSignupGate(
  email: string,
  ip: string | null,
): Promise<GateResult> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('signup_attempt_gate', {
    p_email: email,
    p_ip: ip,
  })

  if (error) return { state: 'unavailable' }

  const row = Array.isArray(data) ? data[0] : data
  if (!row) return { state: 'unavailable' }

  const { blocked, retry_after_seconds } = row as {
    blocked: boolean
    retry_after_seconds: number
  }

  return blocked
    ? { state: 'blocked', retryAfterMinutes: retryAfterMinutes(retry_after_seconds) }
    : { state: 'allowed' }
}

/**
 * Setzt die Zähler des **eigenen** Kontos nach erfolgreicher Anmeldung zurück.
 * Ohne Argument: die Adresse kommt aus der Sitzung, damit niemand fremde Zähler löschen kann.
 * Schlägt das fehl, bleibt eine Handvoll Zeilen liegen, die nach 24 Stunden ohnehin
 * verschwinden — kein Grund, eine geglückte Anmeldung daran scheitern zu lassen.
 */
export async function clearOwnLoginAttempts(): Promise<void> {
  const supabase = await createClient()
  await supabase.rpc('clear_own_login_attempts')
}
