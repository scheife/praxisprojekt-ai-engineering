import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { DEADLINE_CLIENT_OPTIONS, isUnreachable } from '@/lib/supabase/deadline'

/**
 * Die Vorprüfung vor jeder Seitenanfrage.
 *
 * In Next.js 16 heißt die frühere `middleware.ts` `proxy.ts` — die alte Datei ist
 * abgekündigt (design.md, TD-3).
 *
 * Zwei Aufgaben: die Sitzungs-Cookies auffrischen, solange die Antwort noch offen ist, und
 * anhand des Cookies umleiten. Sie liest **nur das Cookie**, nie die Datenbank; sie ist
 * schnell und deshalb bewusst nur eine Vorfilterung. Die echte Prüfung sitzt auf jeder
 * geschützten Seite (`src/lib/auth.ts`, design.md, TD-2).
 */

/** Erreichbar, ohne angemeldet zu sein. */
const PUBLIC_ROUTES = ['/login', '/signup']

/**
 * Geschützte Antworten dürfen nicht im Verlauf liegen bleiben — sonst holt der
 * Zurück-Button nach dem Abmelden die alte Seite zurück (AC-14, TD-11).
 */
function noStore(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'no-store, must-revalidate')
  return response
}

export async function proxy(request: NextRequest) {
  // Vor dem Auffrischen merken: War überhaupt eine Sitzung da? Schlägt das Auffrischen
  // fehl, räumt der Client die Cookies weg, und danach lässt sich „nie angemeldet" nicht
  // mehr von „Sitzung abgelaufen" unterscheiden (EC-3).
  const hadSessionCookie = request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith('sb-'))

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Dieselbe Frist wie auf den Seiten. Sie ist hier besonders wichtig: Die Vorprüfung läuft
      // vor **jeder** Anfrage, und ohne Frist hängt sie, bevor irgendeine Seite rendern kann —
      // gemessen wurden 50,4 Sekunden (EC-4).
      ...DEADLINE_CLIENT_OPTIONS,
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
          for (const [key, value] of Object.entries(headers)) {
            response.headers.set(key, value)
          }
        },
      },
    },
  )

  // Früh aufrufen: Ein Auffrischen, das erst nach dem Abschicken der Antwort fertig wird,
  // kann seine Cookies nicht mehr loswerden.
  const { data, error } = await supabase.auth.getClaims()

  // **Nicht feststellbar: durchlassen, nicht umleiten** (EC-12, design.md TD-29).
  //
  // Ist der Auth-Server nicht erreichbar, weiß die Vorprüfung nicht, wer da ist. Früher fiel
  // `signedIn` dann auf `false` und sie leitete auf `/login?reason=session-expired` — eine
  // Behauptung über die Sitzung, die nie geprüft wurde, und eine Seite, die denselben
  // Auth-Server braucht.
  //
  // **Das schwächt den Zugriffsschutz nicht.** Die Vorprüfung war nie die Zugriffskontrolle,
  // sondern eine Vorfilterung (TD-2): Die echte Prüfung sitzt auf jeder geschützten Seite, kommt
  // zum selben Ergebnis und zeigt statt der Daten den Nicht-erreichbar-Zustand. Zu holen sind
  // ohnehin keine — steht der Weg zur Datenbank, liefert auch Row Level Security nichts.
  // Fail-open hier, fail-closed auf der Seite dahinter.
  if (error && isUnreachable(error)) return noStore(response)

  const signedIn = Boolean(data?.claims?.sub)

  const { pathname } = request.nextUrl
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname)

  /** Leitet um und nimmt die aufgefrischten Cookies mit. */
  const redirectTo = (path: string, reason?: string) => {
    const url = request.nextUrl.clone()
    url.pathname = path
    url.search = ''
    if (reason) url.searchParams.set('reason', reason)

    const redirect = NextResponse.redirect(url)
    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie)
    }
    return noStore(redirect)
  }

  // Abgemeldet: erreichbar sind nur /login und /signup (AC-11).
  // War vorher eine Sitzung da, ist sie abgelaufen — das sagt die Seite dann auch (EC-3).
  if (!signedIn && !isPublicRoute) {
    return redirectTo('/login', hadSessionCookie ? 'session-expired' : undefined)
  }

  // Angemeldet: /login und /signup führen zurück auf / (AC-12).
  if (signedIn && isPublicRoute) {
    return redirectTo('/')
  }

  return noStore(response)
}

export const config = {
  matcher: [
    /*
     * Alles außer den statischen Auslieferungen. Für die Anmeldung soll die Vorprüfung
     * bewusst auf allen Seiten laufen, nicht nur auf den geschützten.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
