import type { Metadata } from 'next'
import Link from 'next/link'

import { requireUser } from '@/lib/auth'
import { DeleteAccountDialog } from '@/components/account/delete-account-dialog'
import { AppHeader } from '@/components/shell/app-header'
import { UnavailableNotice } from '@/components/shell/unavailable-notice'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export const metadata: Metadata = { title: 'Konto · auslage.' }

/**
 * Der angemeldete Bereich für die eigene Adresse und die Kontolöschung — **gehört PROJ-1**.
 *
 * PROJ-2 ergänzt genau zwei Dinge (docs/app-shell.md): den gemeinsamen Header (ohne
 * Monatswechsler, weil es hier keinen Monat zu wechseln gibt) und die Karte „Deine Daten
 * mitnehmen" mit der Route `/konto/export`. Zugriffsschutz und die beiden Karten von PROJ-1
 * bleiben unangetastet.
 */
export default async function KontoPage() {
  const session = await requireUser()

  // Wie auf `/` (EC-12): kein Weiterleiten, wenn die Anmeldung nicht feststellbar ist. Hier
  // kommt hinzu, dass die E-Mail-Adresse aus genau der Sitzung stammt, die nicht zu lesen war —
  // die Karte hätte nichts zu zeigen.
  if (session.state === 'unavailable') {
    return (
      <>
        <AppHeader />
        <main className="mx-auto flex w-full max-w-[560px] flex-col gap-6 px-5 py-10">
          <UnavailableNotice />
        </main>
      </>
    )
  }

  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-[560px] flex-col gap-6 px-5 py-10">
        <Card>
          <CardHeader>
            <CardTitle className="font-grotesk text-xl">Konto</CardTitle>
          </CardHeader>
          {/* Bewusst **ohne** Abmelde-Knopf (AC-19): Der steht seit PROJ-2 im gemeinsamen
              Header, und der ist auf beiden angemeldeten Seiten da. Zwei gleich benannte
              Schaltflächen auf einer Seite sind für Screenreader nicht unterscheidbar
              (design.md, TD-27). Was bleibt, ist die Frage, für die es diese Karte gibt:
              mit welchem Konto bin ich hier. */}
          <CardContent>
            <div className="flex flex-col gap-1">
              <span className="font-grotesk text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                E-Mail-Adresse
              </span>
              <span>{session.user.email}</span>
            </div>
          </CardContent>
        </Card>

        {/* PROJ-2 · AC-27 — Art. 15 und Art. 20 DSGVO. Die Datei entsteht bei jedem Abruf neu
            und liegt nirgends herum. Ein echter Link, kein Knopf mit Skript: der Browser lädt
            die Antwort selbst herunter. */}
        <Card>
          <CardHeader>
            <CardTitle className="font-grotesk text-xl">Deine Daten mitnehmen</CardTitle>
            <CardDescription>
              Eine Datei mit allen deinen Ausgaben — Datum, Kategorie, Betrag, Notiz und
              Erfassungszeitpunkt — dazu deine E-Mail-Adresse und dein Registrierungsdatum.
              Sie öffnet sich in jeder Tabellenkalkulation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="h-9 font-grotesk">
              <Link href="/konto/export" prefetch={false}>
                Ausgaben als CSV herunterladen
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-grotesk text-xl">Konto löschen</CardTitle>
            <CardDescription>
              Entfernt dein Konto und alle Daten, die daran hängen. Danach ist die Anmeldung
              mit dieser Adresse nicht mehr möglich.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DeleteAccountDialog />
          </CardContent>
        </Card>
      </main>
    </>
  )
}
