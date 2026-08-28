'use client'

import { useActionState } from 'react'

import { deleteAccount, type DeleteAccountState } from '@/lib/actions/account'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

const EMPTY: DeleteAccountState = {}

/**
 * Kontolöschung mit Bestätigungsdialog (AC-15, Art. 17 DSGVO).
 *
 * Bewusst ein Formular mit `useActionState` statt einer Klick-Funktion: der Fehlerfall
 * landet dann als Zustand im Dialog, statt über einen Umweg als Toast. Gelingt die
 * Löschung, leitet die Action auf `/login?reason=deleted` weiter — dieser Dialog sieht
 * also nur den Fehlerfall.
 *
 * Ohne JavaScript ist die Löschung nicht erreichbar: Der Dialoginhalt wird erst beim
 * Öffnen gerendert. Das ist bei einer Aktion, die eine ausdrückliche Bestätigung
 * verlangt, vertretbar.
 */
export function DeleteAccountDialog() {
  const [state, formAction, pending] = useActionState(deleteAccount, EMPTY)

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" className="h-9 font-grotesk">
          Konto löschen
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-grotesk">
            Konto endgültig löschen?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Dein Konto und alles, was daran hängt, wird gelöscht. Das lässt sich nicht
            rückgängig machen, und anmelden kannst du dich danach nicht mehr.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {state.formError && (
          <p role="alert" className="text-[13px] text-destructive">
            {state.formError}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending} className="h-9 font-grotesk">
            Abbrechen
          </AlertDialogCancel>
          {/*
            Bewusst ein gewöhnlicher Button und NICHT `AlertDialogAction`.

            `AlertDialogAction` ist bei Radix ein `Dialog.Close`: sein Klick-Handler ist
            `composeEventHandlers(props.onClick, () => onOpenChange(false))`, schließt also
            den Dialog. Da dieses Formular **innerhalb** von `AlertDialogContent` liegt,
            wurde es dabei ausgehängt, bevor React das Absenden verarbeiten konnte — der
            Knopf löste überhaupt nichts aus, und der Dialog verschwand, als wäre gelöscht
            worden (QA-Bericht, BUG-4: null Anfragen, Konto blieb bestehen).

            Ohne `Close` bleibt der Dialog offen, solange die Action läuft: erst zeigt er
            „Wird gelöscht …", dann leitet die Action auf `/login?reason=deleted` weiter.
            Das ist zugleich die Voraussetzung dafür, dass `state.formError` überhaupt je
            sichtbar wird — vorher war der Dialog beim Eintreffen des Fehlers längst zu.
          */}
          <form action={formAction}>
            <Button
              type="submit"
              variant="destructive"
              disabled={pending}
              className="h-9 w-full font-grotesk"
            >
              {pending ? 'Wird gelöscht …' : 'Endgültig löschen'}
            </Button>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
