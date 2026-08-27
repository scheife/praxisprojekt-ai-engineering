'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { deleteAccount } from '@/lib/actions/account'
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

/**
 * Kontolöschung mit Bestätigungsdialog (AC-15, Art. 17 DSGVO).
 *
 * Gelingt sie, leitet die Action auf `/login` weiter — dieser Dialog sieht den Erfolg
 * also nie, nur den Fehlerfall.
 */
export function DeleteAccountDialog() {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const confirm = () => {
    startTransition(async () => {
      const result = await deleteAccount()
      if (result?.formError) {
        setOpen(false)
        toast.error(result.formError)
      }
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
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
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending} className="h-9 font-grotesk">
            Abbrechen
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              // Der Dialog soll sich nicht schließen, bevor die Löschung durch ist —
              // sonst steht die Person vor einer Seite, die noch die alten Daten zeigt.
              event.preventDefault()
              confirm()
            }}
            disabled={pending}
            className="h-9 bg-destructive font-grotesk text-destructive-foreground hover:bg-destructive/90"
          >
            {pending ? 'Wird gelöscht …' : 'Endgültig löschen'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
