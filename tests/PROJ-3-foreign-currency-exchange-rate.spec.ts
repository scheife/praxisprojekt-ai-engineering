import { test, expect, type Locator, type Page } from '@playwright/test'

import { PASSWORD, clearThrottle, uniqueEmail } from './helpers'

/**
 * PROJ-3 — die kritischen Wege durch Fremdwährung & Wechselkurs.
 *
 * Drei Journeys statt eines Tests je Acceptance Criterion. Die Masse der Abdeckung tragen die
 * 214 Unit- und Integrationstests aus `/build` und `/qa`; hier steht nur, was niemals
 * stillschweigend brechen darf.
 *
 * **Journey 1 ist der Grund, warum es diese Datei gibt.** Der QA-Bericht führt genau eine
 * ernsthafte Lücke: Radix füllt das versteckte native Auswahlfeld erst im Browser, serverseitig
 * steht dort nichts. Der Euro-Weg ist durch PROJ-2s Journey 1 gedeckt — der Weg „Fremdwährung
 * auswählen und erfassen" war es nicht. Ein still nach Euro gekippter Dollar-Beleg wäre ein
 * unsichtbarer Fehler in jeder Monatssumme.
 *
 * **Nicht abgedeckt, mit Absicht:** der CSV-Export (AC-19) — `/qa` hat die neun Spalten gegen die
 * echte Datei geprüft, und der Download-Weg selbst hängt an PROJ-2s Journey 4; die Feldregeln
 * (AC-17, AC-18) und die Kursfehlerklassen (EC-2, EC-3) — sie hängen an Schema und Kursmodul und
 * sind dort direkt geprüft; Darstellungsdetails.
 *
 * **Zur Robustheit gegen einen fremden Dienst:** Die Journeys benutzen ein **abgeschlossenes**
 * Datum. Der EZB-Kurs eines vergangenen Tages ändert sich nie mehr, und die Anwendung speichert
 * ihn dauerhaft zwischen. Trotzdem steht hier **kein fest verdrahteter Euro-Betrag**: Geprüft
 * wird, dass die drei auf der Seite angezeigten Zahlen zueinander passen —
 * `Originalbetrag ÷ Kurs = Euro-Betrag`. Das ist strenger als ein Vergleich mit einer Konstante,
 * weil es AC-8 wirklich nachrechnet, und es hält, wenn sich Kurse ändern.
 */
const AKTION = { timeout: 30_000 }

/** Ein abgeschlossener Werktag: sein Kurs steht für immer fest. */
const KURSTAG = '2026-08-17'
const KURSMONAT = '2026-08'

test.beforeEach(() => {
  // Wie bei PROJ-1 und PROJ-2: Die Registrierungs-Drosselung zählt ohne erklärten Proxy alle
  // Versuche gemeinsam (PROJ-1 AC-17) — ohne diesen Reset sperrt sich die Suite selbst aus.
  clearThrottle()
})

async function registriere(page: Page, tag: string): Promise<string> {
  const email = uniqueEmail(tag)
  await page.goto('/signup')
  await page.getByLabel('E-Mail-Adresse').fill(email)
  await page.getByLabel('Passwort').fill(PASSWORD)
  await page.getByRole('button', { name: 'Konto anlegen' }).click()
  await expect(page).toHaveURL('/', AKTION)
  return email
}

/**
 * Wählt eine Währung im Auswahlfeld — der Weg, den nur ein Browser gehen kann.
 *
 * `scope` ist die Seite oder der Dialog; die Auswahlliste selbst hängt Radix immer an den
 * Dokumentkörper, sie wird deshalb über `page` gesucht und nie im Dialog.
 */
async function waehleWaehrung(page: Page, scope: Page | Locator, code: string) {
  await scope.getByLabel('Währung').click()

  // **Über die Tastatur, nicht per Klick.** Die Liste hat 30 Einträge; auf einem Telefonbildschirm
  // scrollt Radix beim Öffnen zur ausgewählten Position und blendet Bildlaufschalter ein. Ein Klick
  // auf einen Eintrag wartet dann in WebKit endlos darauf, dass er „stabil" wird. Die Schnellsuche
  // von Radix springt direkt zum Eintrag — das ist auch der Weg, den eine Person am Telefon geht.
  await page.keyboard.type(code)
  await expect(page.getByRole('option', { name: new RegExp(`^${code}`) })).toHaveAttribute(
    'data-highlighted',
    '',
    { timeout: 10_000 },
  )
  await page.keyboard.press('Enter')
  await expect(scope.getByLabel('Währung')).toHaveText(new RegExp(`^${code}`), { timeout: 10_000 })
}

/**
 * Füllt die Erfassungszeile inklusive Währung und schickt sie ab.
 *
 * **Reihenfolge mit Bedacht:** Erst die beiden Auswahlfelder, dann die Textfelder. Die Auswahl
 * läuft über die Tastatur, und getippte Zeichen haben in WebKit vereinzelt ein zuvor gefülltes
 * Betragsfeld wieder geleert — die Erfassung scheiterte dann an „Bitte gib einen Betrag ein."
 * statt an dem, was der Test prüfen wollte. Vor dem Absenden wird deshalb noch einmal
 * nachgesehen, dass wirklich dasteht, was dastehen soll.
 */
async function erfasse(
  page: Page,
  werte: { betrag: string; waehrung?: string; kategorie: string; datum: string; notiz?: string },
): Promise<void> {
  if (werte.waehrung) await waehleWaehrung(page, page, werte.waehrung)
  await page.getByLabel('Kategorie').click()
  await page.getByRole('option', { name: werte.kategorie, exact: true }).click()

  await page.getByLabel('Betrag').fill(werte.betrag)
  await page.getByLabel('Datum').fill(werte.datum)
  if (werte.notiz !== undefined) await page.getByLabel('Notiz').fill(werte.notiz)

  await expect(page.getByLabel('Betrag')).toHaveValue(werte.betrag)
  await page.getByRole('button', { name: 'Erfassen' }).click()
}

/** Eine deutschsprachige Zahl wie `1.078,24` als Zahl. */
function zahl(text: string): number {
  return Number(text.replaceAll('.', '').replace(',', '.'))
}

/**
 * Liest die drei Zahlen einer Fremdwährungszeile aus der Betragszelle — Euro-Betrag,
 * Originalbetrag und Kurs — plus das ausgewiesene Kursdatum.
 */
async function leseBetragszelle(page: Page) {
  // Erst warten, dass die Zeile wirklich da ist. Ohne das liest der Test auf einem
  // langsameren Motor ins Leere, statt auf das Erscheinen der Ausgabe zu warten.
  const zelle = page.locator('tbody tr').first().locator('td').nth(3)
  await expect(zelle).toBeVisible(AKTION)
  const text = await zelle.innerText()
  const euro = /([\d.]+,\d{2})\s*€/.exec(text)
  const original = /([\d.]+,\d{2})\s*([A-Z]{3})/.exec(text)
  const kurs = /1\s*€\s*=\s*([\d.,]+)\s*([A-Z]{3})/.exec(text)
  const kursdatum = /Kurs vom (\d{2}\.\d{2}\.\d{4})/.exec(text)
  return {
    text,
    euro: euro ? zahl(euro[1]) : null,
    original: original ? zahl(original[1]) : null,
    waehrung: original?.[2] ?? null,
    kurs: kurs ? zahl(kurs[1]) : null,
    kursWaehrung: kurs?.[2] ?? null,
    kursdatum: kursdatum?.[1] ?? null,
  }
}

test('Journey 1: Eine Ausgabe in Fremdwährung erfassen und nachrechnen können (AC-1, AC-3, AC-6, AC-7, AC-8, AC-9)', async ({
  page,
}) => {
  await registriere(page, 'p3j1')

  // Auf den Monat des Kurstags stellen, damit das Datum im angezeigten Monat liegt und die
  // Ansicht nicht wegen PROJ-2 AC-4 springt.
  await page.goto(`/?monat=${KURSMONAT}`)

  // AC-1 — das Auswahlfeld ist da und mit EUR vorbelegt.
  await expect(page.getByLabel('Währung')).toHaveText(/EUR/, AKTION)

  // AC-1, AC-3 — USD auswählen und erfassen. Genau dieser Weg war bisher unbewiesen: Das
  // versteckte native Feld füllt Radix erst hier im Browser.
  await erfasse(page, {
    betrag: '1250,00',
    waehrung: 'USD',
    kategorie: 'Software & Abos',
    datum: KURSTAG,
    notiz: 'Jahreslizenz',
  })
  await expect(page.getByLabel('Betrag')).toHaveValue('', AKTION)

  // AC-6 — die Währung bleibt für den nächsten Beleg stehen, anders als Betrag und Notiz.
  await expect(page.getByLabel('Währung')).toHaveText(/USD/)
  await expect(page.getByLabel('Notiz')).toHaveValue('')

  // AC-7 — die Zeile führt den Euro-Betrag als Hauptzahl und darunter Original, Kurs und
  // Kursdatum.
  await expect(page.locator('tbody tr')).toHaveCount(1, AKTION)
  const zeile = await leseBetragszelle(page)
  expect(zeile.waehrung, `Betragszelle: ${zeile.text}`).toBe('USD')
  expect(zeile.original).toBe(1250)
  expect(zeile.kursWaehrung).toBe('USD')
  expect(zeile.kursdatum).toBe('17.08.2026')

  // AC-8 — **die eigentliche Zusicherung:** Die angezeigten Zahlen rechnen sich auf.
  // Originalbetrag geteilt durch Kurs ergibt den angezeigten Euro-Betrag. Kein fest
  // verdrahteter Wert — das prüft die Umrechnung, nicht eine Konstante.
  expect(zeile.kurs).toBeGreaterThan(0)
  expect(zeile.euro).toBeCloseTo(zeile.original! / zeile.kurs!, 1)

  // Der Dollar ist nicht der Euro: Wäre die Währung still nach EUR gekippt — der Fehler, gegen
  // den diese Journey geschrieben ist —, stünde hier 1.250,00 €.
  expect(zeile.euro).not.toBe(1250)

  // AC-9 — die Monatssumme ist der Euro-Betrag, nicht der Originalbetrag.
  const summe = page.locator('span.text-\\[32px\\]')
  await expect(summe).toHaveText(
    `${zeile.euro!.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €`,
    AKTION,
  )

  // AC-9 — eine Euro-Ausgabe daneben bleibt einzeilig, und die Summe addiert beide in Euro.
  await erfasse(page, {
    betrag: '42,90',
    waehrung: 'EUR',
    kategorie: 'Büromaterial',
    datum: KURSTAG,
    notiz: 'Druckerpapier',
  })
  await expect(page.locator('tbody tr')).toHaveCount(2, AKTION)
  const erwartet = zeile.euro! + 42.9
  await expect(summe).toHaveText(
    `${erwartet.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €`,
    AKTION,
  )
})

test('Journey 2: Die Währung einer Ausgabe ändern — der Kurs zieht mit (AC-11, AC-12, AC-16)', async ({
  page,
}) => {
  await registriere(page, 'p3j2')
  await page.goto(`/?monat=${KURSMONAT}`)

  await erfasse(page, {
    betrag: '1250,00',
    waehrung: 'USD',
    kategorie: 'Software & Abos',
    datum: KURSTAG,
    notiz: 'Jahreslizenz',
  })
  await expect(page.getByLabel('Betrag')).toHaveValue('', AKTION)
  const vorher = await leseBetragszelle(page)

  // AC-11 — der Dialog öffnet mit der gespeicherten Währung **und dem Originalbetrag**. Beim
  // Bau stand hier zeitweise der umgerechnete Euro-Betrag; wer dann speicherte, hätte 1.078,24
  // Dollar erfasst statt 1.250,00.
  await page.getByRole('button', { name: 'Ändern' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Betrag')).toHaveValue('1250,00')
  await expect(dialog.getByLabel('Währung')).toHaveText(/USD/)

  // AC-12 — Währungswechsel holt einen neuen Kurs zum selben Tag.
  await waehleWaehrung(page, dialog, 'CHF')
  await page.getByRole('button', { name: 'Speichern' }).click()

  await expect(page.locator('tbody tr td').nth(3)).toContainText('CHF', AKTION)
  const nachher = await leseBetragszelle(page)
  expect(nachher.waehrung).toBe('CHF')
  expect(nachher.original).toBe(1250)
  expect(nachher.kursdatum).toBe('17.08.2026')
  // Der Kurs ist ein anderer, also auch der Euro-Betrag — und er rechnet sich weiterhin auf.
  expect(nachher.kurs).not.toBe(vorher.kurs)
  expect(nachher.euro).toBeCloseTo(nachher.original! / nachher.kurs!, 1)

  // AC-16 — Umstellung auf EUR entfernt Kurs und Kursdatum; der eingegebene Betrag **ist**
  // dann der Euro-Betrag.
  await page.getByRole('button', { name: 'Ändern' }).click()
  await waehleWaehrung(page, page.getByRole('dialog'), 'EUR')
  await page.getByRole('button', { name: 'Speichern' }).click()

  const euroZeile = page.locator('tbody tr td').nth(3)
  await expect(euroZeile).toHaveText('1.250,00 €', AKTION)
  await expect(euroZeile).not.toContainText('Kurs vom')
  await expect(euroZeile).not.toContainText('CHF')
})

test('Journey 3: Ohne Kurs entsteht keine Ausgabe, und die Eingaben bleiben stehen (AC-5, EC-4)', async ({
  page,
}) => {
  await registriere(page, 'p3j3')

  // Den Brasilianischen Real gab es in den EZB-Referenzkursen im Jahr 2000 noch nicht. Der
  // Dienst antwortet mit 404 — das ist die **dauerhafte** Fehlerklasse, kein Ausfall.
  await page.goto('/?monat=2000-01')
  await erfasse(page, {
    betrag: '100,00',
    waehrung: 'BRL',
    kategorie: 'Reise & Fahrt',
    datum: '2000-01-03',
    notiz: 'Flug',
  })

  // AC-5 — die Meldung nennt Währung und Datum und schickt die Person dorthin, wo sie etwas
  // ändern kann.
  const meldung = page.getByText(/keinen Kurs/)
  await expect(meldung).toBeVisible(AKTION)
  await expect(meldung).toContainText('Brasilianischer Real')
  await expect(meldung).toContainText('03.01.2000')

  // EC-4 — und sie behauptet **keinen** vorübergehenden Ausfall. Ein zweiter Versuch hilft hier
  // nicht, also darf die Meldung ihn auch nicht nahelegen.
  await expect(meldung).not.toContainText('nicht abrufbar')

  // AC-5 — es entsteht keine Zeile, und die Eingaben gehen nicht verloren.
  await expect(page.locator('tbody tr')).toHaveCount(0)
  await expect(page.getByLabel('Betrag')).toHaveValue('100,00')
  await expect(page.getByLabel('Notiz')).toHaveValue('Flug')
  await expect(page.getByLabel('Währung')).toHaveText(/BRL/)
})
