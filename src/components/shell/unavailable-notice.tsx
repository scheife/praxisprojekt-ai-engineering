'use client'

import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'

/**
 * Der Nicht-erreichbar-Zustand des Rahmens (EC-4, EC-12, `docs/app-shell.md` → Seitenmuster).
 *
 * Er ist **weder** der Leerzustand („hier steht noch nichts") **noch** ein Feldfehler: Beide
 * behaupten, die App habe die Lage verstanden. Hier hat sie es ausdrücklich nicht — sie konnte
 * Datenbank oder Auth-Server binnen zwei Sekunden nicht erreichen und sagt genau das.
 *
 * Er steht an der Stelle des Inhalts, während Kopfzeile und Rahmen stehen bleiben. Das ist der
 * Unterschied zwischen „ein Teil lädt gerade nicht" und „die App ist abgestürzt".
 */
export function UnavailableNotice() {
  const router = useRouter()

  return (
    <div
      role="alert"
      className="rounded-xl border border-dashed border-border px-5 py-10 text-center"
    >
      <p className="font-grotesk text-[15px] font-medium">
        Wir erreichen deine Daten gerade nicht.
      </p>
      <p className="mx-auto mt-1 max-w-prose text-[13px] text-muted-foreground">
        Das liegt nicht an dir — versuch es in einem Moment noch einmal.
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
