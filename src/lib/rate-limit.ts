import { createClient } from '@/lib/supabase/server'

/**
 * Die Drosselung gegen automatisiertes Passwort-Raten.
 *
 * Die Zähler liegen in Postgres, nicht bei einem Cache-Dienst: kein zweites Konto, kein
 * weiterer Schlüssel, und die 24-Stunden-Löschung ist in derselben Datenbank nachweisbar,
 * in der sie entsteht (design.md, TD-4).
 *
 * Werte: 5 Versuche in 15 Minuten, getrennt je E-Mail-Adresse (AC-8) und je IP-Adresse (AC-9);
 * die IP-Regel greift nur, wenn eine IP vertrauenswürdig erkennbar ist — siehe `clientIpFrom`.
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
 *   Ergebnis ist `null`, und was das bedeutet, ist **je Tor verschieden** (AC-9 gegen AC-17):
 *   Beim **Anmelden** entfällt die IP-Regel dann ersatzlos — es bleibt die Regel je Adresse
 *   (AC-8), die auch ohne IP trägt. Ein gemeinsamer Zähler wäre hier kein Schutz, sondern ein
 *   Hebel: fünf Fehlversuche auf eine erfundene Adresse sperrten sonst jede echte Anmeldung
 *   für 15 Minuten (QA-Bericht, BUG-1 · design.md, TD-22).
 *   Beim **Registrieren** zählen alle Versuche ohne IP dagegen **gemeinsam** — dort gibt es
 *   keine Rückfallregel je Konto, weil jede Adresse neu ist, und ohne den gemeinsamen Eimer
 *   wäre das Anlegen von Konten wieder unbegrenzt (TD-23).
 * - **Mit `hops = n`** zählt der `n`-te Eintrag **von rechts**: den hat der eigene Proxy
 *   angehängt, alles links davon kann der Aufrufer frei erfinden und wird ignoriert. Dann
 *   greifen beide Regeln mit echter, getrennter IP und der Unterschied verschwindet.
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
 * Wie lange ein Tor-Aufruf höchstens dauern darf, bevor er als Störung gilt.
 *
 * **Warum es die Frist gibt (QA-Bericht Lauf 6, BUG-1):** Ohne sie wartet der Aufruf, bis der
 * HTTP-Client von sich aus aufgibt — gemessen **60 Sekunden** bei angehaltener Datenbank, vier
 * von vier Messungen. Die Meldung aus EC-4 kam am Ende zwar richtig, aber eine Minute zu spät:
 * hinter einem üblichen vorgelagerten Server mit 30- bis 60-Sekunden-Frist sähe die Person
 * statt der freundlichen Meldung einen Gateway-Fehler, und EC-4 hielte im Betrieb nicht mehr,
 * was es lokal hält.
 *
 * **Warum 2 Sekunden:** Das Tor macht einen einzigen Datenbank-Roundtrip — lokal einstellige
 * Millisekunden, auch eine ausgelastete gehostete Instanz antwortet weit darunter. 2 s ist
 * großzügig genug, dass eine langsame, aber gesunde Datenbank die Frist nie reißt, und kurz
 * genug, dass ein Ausfall in zwei Sekunden sichtbar wird statt in einer Minute.
 *
 * **Was die Frist nicht ist:** keine Antwortzeit-Zusage. AC-18 verlangt unter 500 ms für
 * *fehlgeschlagene Anmeldungen* bei arbeitender Datenbank — dort wird die Frist nie erreicht.
 * Greift sie, ist die Datenbank gestört, und dann gilt EC-4, nicht AC-18.
 */
const GATE_TIMEOUT_MS = 2000

/**
 * Das Geheimnis, das App und Datenbank teilen (TD-26, QA-Bericht Lauf 6 BUG-2).
 *
 * **Wozu:** Eine Anmeldung beginnt ohne Sitzung, also muss die App die Tore mit dem
 * **öffentlichen** Schlüssel aufrufen — und der steckt in jedem Browser. Vorher genügten
 * damit fünf anonyme Aufrufe, um ein fremdes Konto 15 Minuten zu sperren. Das Recht lässt
 * sich nicht entziehen (die App braucht es selbst), also entscheidet nicht mehr das Recht,
 * sondern das Wissen: Wer das Geheimnis nicht kennt, kommt am Tor nicht vorbei.
 *
 * Bewusst ohne `NEXT_PUBLIC_`-Präfix — mit diesem Präfix landete der Wert im Bundle und
 * damit genau bei denen, gegen die er schützt.
 *
 * Fehlt er, wird **nicht** stillschweigend durchgewunken: Der leere Wert passt nicht zum
 * hinterlegten Abdruck, die Datenbank lehnt ab, und die Anmeldung scheitert hörbar. Das ist
 * die entschiedene Variante — eine vergessene Einrichtung fällt sofort auf, statt still die
 * Lücke offen zu lassen.
 *
 * Bei jedem Aufruf gelesen statt einmal beim Laden: Das macht die Regel prüfbar, ohne an der
 * Umgebung des ganzen Testlaufs zu drehen — derselbe Grund, aus dem `clientIpFrom` seine
 * `hops` als Parameter nimmt.
 */
function gateSecret(): string {
  return process.env.GATE_SECRET ?? ''
}

/**
 * Ruft ein Tor auf und übersetzt die Antwort — für beide Tore identisch.
 *
 * Beide fallen bei jeder Störung **zu**, nicht auf: eine Drosselung, die bei einem Fehler
 * durchwinkt, ist genau dann weg, wenn sie gebraucht wird. Das gilt für einen Datenbankfehler,
 * für eine leere Antwort und für die abgelaufene Frist gleichermaßen — ein Abbruch durch
 * `AbortSignal` kommt beim Supabase-Client als gewöhnlicher `error` zurück, nicht als Ausnahme.
 */
async function passGate(
  fn: 'login_attempt_gate' | 'signup_attempt_gate',
  email: string,
  ip: string | null,
): Promise<GateResult> {
  const secret = gateSecret()

  if (!secret) {
    // Kein nutzerseitiger Text, sondern eine Zeile fürs Server-Log: Ohne diesen Hinweis
    // sähe man nur „Anmeldung gerade nicht möglich" und suchte den Fehler an der Datenbank.
    console.error(
      '[rate-limit] GATE_SECRET ist nicht gesetzt — die Drosselungs-Tore lehnen deshalb ' +
        'jeden Aufruf ab. Wert in .env.local eintragen und mit private.set_gate_secret() ' +
        'in der Datenbank hinterlegen (design.md, TD-26).',
    )
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .rpc(fn, { p_secret: secret, p_email: email, p_ip: ip })
    .abortSignal(AbortSignal.timeout(GATE_TIMEOUT_MS))

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
 * Prüft die Sperre und hält den Versuch fest. Wird **vor** der Prüfung der Zugangsdaten
 * aufgerufen — auch für Adressen, zu denen es gar kein Konto gibt, sonst verriete das
 * Einsetzen der Drosselung, welche Adresse existiert (AC-7).
 */
export async function passLoginGate(
  email: string,
  ip: string | null,
): Promise<GateResult> {
  return passGate('login_attempt_gate', email, ip)
}

/**
 * Prüft und zählt Registrierungsversuche — 10 je IP-Adresse in 60 Minuten.
 *
 * Nötig, weil das Limit, auf das sich das Design stützte, in diesem Stack nicht existiert:
 * `GOTRUE_RATE_LIMIT_SIGN_IN_SIGN_UPS` ist im Auth-Container nicht gesetzt, und 40 von 40
 * Direktregistrierungen gingen durch. Ein CAPTCHA bleibt die stärkere Maßnahme und ist in
 * `spec.md` bewusst zurückgestellt; das hier schließt nur die Lücke.
 *
 * Anders als beim Anmelden zählt hier **nur die Herkunft**: Die Adresse ist bei jeder
 * Registrierung eine neue und taugt nicht als Schlüssel. Und anders als beim Anmelden zählen
 * Versuche **ohne** erkennbare IP hier **gemeinsam**, statt aus der Regel zu fallen — es gibt
 * keine Rückfallregel je Konto, die den Schutz sonst trüge (AC-17, TD-23). Der Preis ist
 * bekannt: ohne erklärten Proxy sind es 10 Registrierungen je Stunde für alle zusammen.
 */
export async function passSignupGate(
  email: string,
  ip: string | null,
): Promise<GateResult> {
  return passGate('signup_attempt_gate', email, ip)
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
