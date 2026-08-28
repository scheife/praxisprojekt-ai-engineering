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
 * Wie viele vertrauenswürdige Proxys zwischen Aufrufer und App stehen.
 *
 * `0` (die Vorgabe) heißt: keiner. Dann stammt `x-forwarded-for` vom Aufrufer selbst und
 * wird **nicht gelesen** — siehe `clientIpFrom`. Läuft die App später hinter genau einem
 * Reverse Proxy, ist der Wert `1`.
 *
 * Bewusst ohne `NEXT_PUBLIC_`-Präfix: der Wert gehört auf den Server und darf nicht mit
 * dem Bundle in den Browser wandern.
 */
const TRUSTED_PROXY_HOPS = Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? '0', 10)

/**
 * Die IP der anfragenden Person — aber nur, wenn sie überhaupt vertrauenswürdig sein kann.
 *
 * **Warum das nicht einfach der erste Eintrag ist (QA-Bericht, BUG-1):** `x-forwarded-for`
 * schreibt der Aufrufer, und Proxys **hängen an**, statt zu ersetzen. Der erste Eintrag ist
 * damit im Regelfall genau der Wert, den der Angreifer behauptet. Wer ihn als Schlüssel
 * nimmt, lässt sich die Drosselung vom Angreifer selbst konfigurieren: eine andere IP je
 * Anfrage, und AC-9 wie AC-17 sind ausgeschaltet (gemessen: 14 von 14 Anmeldeversuchen
 * durch, 16 von 16 Konten angelegt).
 *
 * Deshalb gilt jetzt:
 * - **Ohne vertrauenswürdigen Proxy** (`hops = 0`) wird der Kopf gar nicht gelesen. Das
 *   Ergebnis ist `null` — und `null` ist seit der Migration `20260828120000` ein **eigener
 *   Eimer**, kein Freifahrtschein: alle Anfragen ohne erkennbare IP zählen gemeinsam.
 *   Lokal ist das exakt das bisherige Verhalten, wo sich ohnehin alle Anfragen `::1`
 *   teilten — nur ohne die Umgehung.
 * - **Mit `hops = n`** zählt der `n`-te Eintrag **von rechts**: den hat der eigene Proxy
 *   angehängt, alles links davon kann der Aufrufer frei erfinden und wird ignoriert.
 *
 * Der Parameter existiert, damit die Regel testbar ist, ohne an der Umgebung zu drehen.
 */
export function clientIpFrom(
  headers: Headers,
  hops: number = TRUSTED_PROXY_HOPS,
): string | null {
  if (!Number.isFinite(hops) || hops < 1) return null

  const chain = (headers.get('x-forwarded-for') ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)

  // Zu kurze Kette heißt: der eigene Proxy hat nicht angehängt, was er sollte. Dann lieber
  // keine IP als eine erfundene — der gemeinsame Eimer fängt es auf.
  if (chain.length >= hops) return chain[chain.length - hops] ?? null

  // Ein Proxy, der `x-forwarded-for` nicht setzt, setzt oft `x-real-ip`. Auch das gilt nur,
  // wenn überhaupt einer vor der App steht.
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
