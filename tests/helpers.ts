import { execFileSync } from 'node:child_process'

/**
 * Hilfsmittel für die E2E-Journeys von PROJ-1.
 *
 * Die Tests fahren einen echten Browser, prüfen aber an zwei Stellen auch die Datenbank —
 * dort, wo der Browser nicht hinsieht: „ist die Profilzeile entstanden" (AC-2) und
 * „ist wirklich genau EIN Konto entstanden" (EC-1). Beides ist über die Oberfläche nicht
 * beobachtbar und wäre sonst nur behauptet.
 */

const CONTAINER = process.env.SUPABASE_DB_CONTAINER ?? 'supabase_db_praxisprojekt-ai-engineering'

/** Alle Testkonten dieser Suite tragen diese Domain — nichts anderes wird angefasst. */
export const TEST_DOMAIN = 'e2e.example.com'
export const PASSWORD = 'passwort1234'

export function uniqueEmail(tag: string): string {
  const random = Math.random().toString(36).slice(2, 10)
  return `${tag}-${Date.now().toString(36)}-${random}@${TEST_DOMAIN}`
}

function psql(sql: string): string {
  try {
    return execFileSync(
      'docker',
      ['exec', CONTAINER, 'psql', '-U', 'postgres', '-d', 'postgres', '-t', '-A', '-c', sql],
      { encoding: 'utf8' },
    ).trim()
  } catch (error) {
    throw new Error(
      `Die lokale Supabase-Datenbank ist nicht erreichbar (Container "${CONTAINER}").\n` +
        'Läuft der Stack? `npx supabase start`. Ein anderer Containername lässt sich über\n' +
        'die Umgebungsvariable SUPABASE_DB_CONTAINER setzen.\n' +
        `Ursprünglicher Fehler: ${(error as Error).message}`,
    )
  }
}

/**
 * Leert die Drosselungs-Zähler.
 *
 * **Dieser Reset bleibt dauerhaft nötig — bitte nicht entfernen.** Die frühere Begründung
 * („nur solange BUG-1 offen ist") gilt seit dem `/refine` vom 28.08.2026 nicht mehr, der
 * Reset selbst aber sehr wohl, und zwar aus einem anderen Grund:
 *
 * - **Anmelden:** Ohne erklärten Proxy entfällt die IP-Regel ersatzlos (AC-9, TD-22). Hier
 *   sperrt sich die Suite also nicht mehr selbst aus — dafür bräuchte es den Reset nicht.
 * - **Registrieren:** Hier zählen alle Versuche ohne erkennbare IP weiterhin **gemeinsam**,
 *   und das ist Absicht (AC-17, TD-23) — es gibt keine Rückfallregel je Konto, die den
 *   Schutz sonst trüge. Die Grenze von 10 Registrierungen je Stunde gilt damit für die
 *   gesamte App, und diese Suite legt acht Konten an (vier Journeys × zwei Projekte). Zwei
 *   Läufe in derselben Stunde laufen ohne Reset in die eigene Sperre.
 *
 * Das versteckt nichts: Keine der vier Journeys prüft die Drosselung. AC-8, AC-9 und AC-17
 * werden von den Unit-Tests und von `/qa` gegen die Datenbankfunktionen geprüft, wo sich die
 * Zähler gezielt und ohne Nebenwirkung auf andere Tests füllen lassen.
 */
export function clearThrottle(): void {
  psql('delete from public.login_attempts;')
}

/** Räumt die Konten weg, die frühere Läufe dieser Suite angelegt haben. */
export function deleteTestAccounts(): number {
  const before = Number(psql(`select count(*) from auth.users where email like '%@${TEST_DOMAIN}';`))
  psql(`delete from auth.users where email like '%@${TEST_DOMAIN}';`)
  return before
}

/** Wie viele Konten es zu dieser Adresse gibt. Für EC-1: es muss genau eines sein. */
export function countAccounts(email: string): number {
  return Number(psql(`select count(*) from auth.users where email = lower('${email}');`))
}

/** Wie viele Profilzeilen zu dieser Adresse gehören (AC-2 — der Trigger). */
export function countProfiles(email: string): number {
  return Number(
    psql(
      `select count(*) from public.profiles p
         join auth.users u on u.id = p.id
        where u.email = lower('${email}');`,
    ),
  )
}
