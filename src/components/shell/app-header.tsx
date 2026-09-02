import Link from 'next/link'

import { LogoutButton } from '@/components/account/logout-button'
import { MonthSwitcher } from '@/components/shell/month-switcher'
import { Wordmark } from '@/components/wordmark'

/**
 * Der Rahmen des angemeldeten Bereichs (docs/app-shell.md).
 *
 * Steht auf `/` **und** auf `/konto` — dort ohne Monatswechsler, weil es nichts zu wechseln
 * gibt. Er wird von jeder Seite selbst gerendert, nicht von einem gemeinsamen Layout: ein
 * Layout bekommt in Next.js 16 keine Adressparameter und könnte den angezeigten Monat gar
 * nicht kennen (design.md, TD-10).
 *
 * Abmelden ruft **dieselbe** Server Action wie PROJ-1 — keine zweite daneben.
 */
export function AppHeader({
  month,
  oldest,
}: {
  /** Fehlt der Monat, wird kein Wechsler gezeigt (auf `/konto`). */
  month?: string
  oldest?: string | null
}) {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-14 w-full max-w-[1180px] items-center gap-4 px-5">
        {/*
          **Kein `aria-label` mehr** (02.09.2026, AC-33): Es lautete „Zur Übersicht" — als es
          keinen sichtbaren Rückweg gab, war das ein Behelf. Seit `/konto` einen echten trägt,
          hießen **zwei** Links auf derselben Seite gleich und waren für Screenreader nicht
          unterscheidbar. Genau der Fehler, den PROJ-2 als BUG-3 schon einmal hatte, nur mit
          Links statt Schaltflächen. Ohne das Etikett heißt dieser Link nach seinem eigenen
          Text: „auslage." — die Wortmarke, was er ist.
        */}
        <Link href="/" className="shrink-0">
          <Wordmark className="text-xl" />
        </Link>

        <div className="flex flex-1 justify-center">
          {month && <MonthSwitcher month={month} oldest={oldest ?? null} />}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/konto"
            className="rounded-md px-2 py-1 font-grotesk text-[13px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Konto
          </Link>
          <LogoutButton />
        </div>
      </div>
    </header>
  )
}
