'use client'

import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { TIMEOUT_HINT, TIMEOUT_TITLE } from '@/lib/supabase/deadline'

/**
 * Der Zeitüberschreitungs-Zustand des Rahmens (EC-4, EC-12, EC-13, `docs/app-shell.md`).
 *
 * Er ist **weder** der Leerzustand („hier steht noch nichts") **noch** ein Feldfehler: Beide
 * behaupten, die App habe die Lage verstanden. Hier hat sie es ausdrücklich nicht — **und genau
 * deshalb sagt sie auch nicht, woran es lag.** Sie hat zwei Sekunden gewartet und aufgegeben;
 * ob die Gegenstelle steht, nur langsam ist oder die Antwort bloß unterwegs verloren ging, hat
 * sie nicht geprüft. Der Wortlaut liegt deshalb in `deadline.ts` (EC-13, TD-34).
 *
 * Er steht an der Stelle des Inhalts, während Kopfzeile und Rahmen stehen bleiben. Das ist der
 * Unterschied zwischen „ein Teil lädt gerade nicht" und „die App ist abgestürzt".
 *
 * Hieß bis zum 02.09.2026 `UnavailableNotice` — eine Komponente, die „unavailable" heißt, während
 * ihr Vertrag ihr genau diese Behauptung verbietet, ist eine Falle für die nächste Person (TD-33).
 */
export function TimeoutNotice() {
  const router = useRouter()

  return (
    <div
      role="alert"
      className="rounded-xl border border-dashed border-border px-5 py-10 text-center"
    >
      <p className="font-grotesk text-[15px] font-medium">{TIMEOUT_TITLE}</p>
      <p className="mx-auto mt-1 max-w-prose text-[13px] text-muted-foreground">
        {TIMEOUT_HINT}
      </p>
      {/* **Kein automatischer Neuversuch.** Ein Versuch alle paar Sekunden schickt einer ohnehin
          überlasteten Gegenstelle zusätzliche Anfragen und verändert die Seite unter den Händen
          der Person. Wer es erneut versuchen will, drückt darauf. */}
      <Button
        variant="outline"
        onClick={() => router.refresh()}
        className="mt-5 h-9 font-grotesk"
      >
        Erneut versuchen
      </Button>
    </div>
  )
}
