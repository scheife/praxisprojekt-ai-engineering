/**
 * Die Frist auf jeden Aufruf an Datenbank und Auth-Server (EC-4, EC-12).
 *
 * **Warum ein eigenes Modul und nicht `server.ts`:** `proxy.ts` braucht dieselbe Frist, darf aber
 * `next/headers` nicht mitziehen — das holt sich `server.ts` für die Cookies. Ein kleines
 * gemeinsames Modul ist der einzige Weg, **eine** Zahl an **beide** Clients zu geben.
 *
 * Gemessen wurde, was ohne diese Frist passiert: Bei angehaltener Datenbank antwortete die
 * Erfassung nach **50,4 Sekunden** mit HTTP 500 und ohne Text — und das bloße Laden der Seite
 * ebenso. Es fehlte nicht die Meldung, es fehlte der Punkt, an dem die App aufgibt.
 */

/**
 * Zwei Sekunden — dieselbe Zahl, die die Drosselungs-Tore aus PROJ-1 tragen
 * (`rate-limit.ts`, `GATE_TIMEOUT_MS`), statt einer zweiten daneben. Sie liegt beim Doppelten
 * dessen, was `spec.md` als Obergrenze zusagt („keine über 1 Sekunde" bei bis zu 300 Ausgaben).
 */
export const DEADLINE_MS = 2000

/**
 * Die Markierung, an der ein **Nichterreichen** später wiedererkannt wird.
 *
 * Sie steht hier, statt die Fehlerobjekte der Bibliotheken zu beschnüffeln: Der Datenbankpfad
 * liefert bei Fristablauf ein blankes Objekt ohne `name` und mit leerem `code` — nachgemessen, und
 * kein Merkmal, auf dem man eine Zusicherung aufbauen möchte. Wer den Fehler **auslöst**, weiß
 * dagegen sicher, was passiert ist.
 */
const UNREACHABLE = 'auslage/unreachable'

/**
 * `fetch` mit Frist. Bricht ein vom Aufrufer mitgegebenes Abbruchsignal mit ab.
 */
function deadlineFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const signals = [AbortSignal.timeout(DEADLINE_MS)]
  if (init?.signal) signals.push(init.signal)

  return fetch(input, { ...init, signal: AbortSignal.any(signals) }).catch((cause: unknown) => {
    const reason = cause instanceof Error ? cause.message : String(cause)
    throw new Error(`${UNREACHABLE}: ${reason}`, { cause })
  })
}

/**
 * Die Optionen, die **beide** Clients bekommen — der in `server.ts` und der in `proxy.ts`.
 *
 * `global.fetch` gilt laut Supabase-Dokumentation für **alle** Aufrufe des Clients, Auth
 * eingeschlossen. Genau das wird gebraucht: Eine Frist je Abfrage (`abortSignal`) träfe nur die
 * Datenbank und ließe ausgerechnet den Auth-Aufruf aus, der in `proxy.ts` vor jeder Anfrage steht.
 *
 * **`db.retry: false` ist kein Beiwerk.** Seit `supabase-js` 2.102.0 wiederholt der Client
 * Netzwerkfehler bei Datenbankabfragen von sich aus, mit wachsenden Wartezeiten (Vorgabe `true`);
 * installiert ist 2.112.4. Bliebe das an, wäre die Frist **je Versuch** wirksam und die zugesagten
 * zwei Sekunden in Wahrheit ein Vielfaches — EC-4 wäre still gebrochen, weil niemand die Summe der
 * Versuche misst. Es gilt: ein Versuch, eine Frist (design.md, TD-28).
 */
export const DEADLINE_CLIENT_OPTIONS = {
  global: { fetch: deadlineFetch },
  db: { retry: false },
} as const

/**
 * War das ein **Nichterreichen** — oder eine **Antwort**?
 *
 * Der Unterschied trägt EC-12: Eine beantwortete Ablehnung („diese Sitzung gilt nicht") ist etwas
 * anderes als ein abgebrochener Netzaufruf („wir wissen es nicht"). Nur das Erste darf zur
 * Anmeldung führen. Derselbe Schnitt, den PROJ-3 beim Kursdienst zieht: dauerhaft gegen
 * vorübergehend.
 *
 * Zwei Quellen, beide nötig:
 * - die eigene Markierung aus `deadlineFetch` — Frist abgelaufen oder Netzfehler;
 * - `AuthRetryableFetchError` aus der Auth-Bibliothek. Sie vergibt ihn für geworfene
 *   `fetch`-Fehler **und** für 5xx, und kommentiert ihn selbst mit „infrastructure errors …
 *   should not cause session invalidation". Genau diese Lesart wird hier gebraucht.
 */
export function isUnreachable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false

  const { name, message } = error as { name?: unknown; message?: unknown }
  if (name === 'AuthRetryableFetchError') return true

  return typeof message === 'string' && message.includes(UNREACHABLE)
}
