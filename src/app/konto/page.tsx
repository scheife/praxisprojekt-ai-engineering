import type { Metadata } from 'next'
import Link from 'next/link'

import { requireUser } from '@/lib/auth'
import { DeleteAccountDialog } from '@/components/account/delete-account-dialog'
import { LogoutButton } from '@/components/account/logout-button'
import { AppHeader } from '@/components/shell/app-header'
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
 * Der angemeldete Bereich für Abmelden und Kontolöschung — **gehört PROJ-1**.
 *
 * PROJ-2 ergänzt genau zwei Dinge (docs/app-shell.md): den gemeinsamen Header (ohne
 * Monatswechsler, weil es hier keinen Monat zu wechseln gibt) und die Karte „Deine Daten
 * mitnehmen" mit der Route `/konto/export`. Zugriffsschutz und die beiden Karten von PROJ-1
 * bleiben unangetastet.
 */
export default async function KontoPage() {
  const user = await requireUser()

  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-[560px] flex-col gap-6 px-5 py-10">
        <Card>
          <CardHeader>
            <CardTitle className="font-grotesk text-xl">Konto</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <span className="font-grotesk text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                E-Mail-Adresse
              </span>
              <span>{user.email}</span>
            </div>
            <LogoutButton />
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
