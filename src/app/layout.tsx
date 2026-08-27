import type { Metadata } from 'next'
import { Open_Sans, Space_Grotesk } from 'next/font/google'

import { Toaster } from '@/components/ui/sonner'
import './globals.css'

// next/font lädt die Dateien beim Build mit und liefert sie von der eigenen Domain aus —
// kein Runtime-Request zu Google, keine Font-Binaries im Repo (docs/design-system.md §4.1).
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
})

const openSans = Open_Sans({
  subsets: ['latin'],
  variable: '--font-open-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'auslage.',
  description:
    'Geschäftsausgaben in Sekunden erfassen und je Monat sehen, wohin das Geld gegangen ist.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    // Dark ist der Auslieferungszustand und steht fest — es gibt keinen Theme-Umschalter
    // (docs/design-system.md §1).
    <html
      lang="de"
      className={`dark ${spaceGrotesk.variable} ${openSans.variable}`}
    >
      <body>
        {children}
        <Toaster theme="dark" position="bottom-right" />
      </body>
    </html>
  )
}
