'use client'

import { useActionState } from 'react'

import { deleteAccount, type DeleteAccountState } from '@/lib/actions/account'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
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
          <form action={formAction}>
            <AlertDialogAction
              type="submit"
              disabled={pending}
              className="h-9 w-full bg-destructive font-grotesk text-destructive-foreground hover:bg-destructive/90"
            >
              {pending ? 'Wird gelöscht …' : 'Endgültig löschen'}
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
