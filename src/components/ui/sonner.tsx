"use client"

import {
  CircleCheck,
  Info,
  LoaderCircle,
  OctagonX,
  TriangleAlert,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheck className="h-4 w-4" />,
        info: <Info className="h-4 w-4" />,
        warning: <TriangleAlert className="h-4 w-4" />,
        error: <OctagonX className="h-4 w-4" />,
        loading: <LoaderCircle className="h-4 w-4 animate-spin" />,
      }}
      toastOptions={{
        /**
         * **Der Schatten kommt als Inline-Stil, nicht als Klasse** (BUG-13, 02.09.2026).
         *
         * Sonner bringt ein eigenes Stylesheet mit und setzt darin
         * `[data-sonner-toast][data-styled="true"] { box-shadow: … }` — Spezifität (0,2,0).
         * Eine Tailwind-Klasse mit `group-[…]`-Variante kommt dagegen nicht an: v4 schreibt den
         * Gruppenteil in `:where()`, das **null** Spezifität hat, sodass am Ende nur die eine
         * Klasse zählt (0,1,0). Die Klasse stand da und war wirkungslos — gemessen, nicht
         * vermutet: `rgba(0,0,0,.1) 0 4px 12px` statt des Werts aus `docs/design-system.md` §6.1.
         *
         * `toastOptions.style` ist Sonners dokumentierter Weg dafür, und ein Inline-Stil schlägt
         * jede Stylesheet-Regel — ohne `!important`, das die nächste Anpassung nur schwerer
         * machen würde. Der Wert bleibt derselbe Token wie bei Popover und Dialog.
         */
        style: { boxShadow: "var(--shadow-float)" },
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
