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
 * Notwendig wegen BUG-1 aus dem QA-Bericht: Solange kein vertrauenswürdiger Proxy erklärt
 * ist, teilen sich **alle** Anfragen einen einzigen Zähler-Eimer. Ohne diesen Reset würde
 * die Suite sich selbst aussperren — die Registrierung ist auf 10 Konten je Stunde für die
 * gesamte App begrenzt, und diese Suite legt acht an (vier Journeys × zwei Projekte).
 *
 * Das versteckt den Fehler nicht: Keine der vier Journeys prüft die Drosselung. AC-8, AC-9
 * und AC-17 sind bewusst NICHT Teil dieser Suite, weil dort ein offener High-Befund liegt.
 * Sobald BUG-1 behoben ist, wird dieser Reset überflüssig.
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
