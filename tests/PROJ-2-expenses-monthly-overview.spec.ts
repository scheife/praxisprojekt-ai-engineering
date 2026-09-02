import { test, expect, type Page } from '@playwright/test'

import { PASSWORD, clearThrottle, uniqueEmail } from './helpers'

/**
 * PROJ-2 — die kritischen Wege durch Ausgaben & Monatsübersicht.
 *
 * Fünf Journeys statt eines Tests je Acceptance Criterion: E2E-Tests sind langsam und teuer in
 * der Pflege, die Masse der AC-Abdeckung tragen die 164 Unit- und Integrationstests aus
 * `/build` und `/qa`. Hier steht nur, was niemals stillschweigend brechen darf.
 *
 * **Nicht abgedeckt, mit Absicht:** die Feldregeln und ihre Fehlermeldungen (AC-5 bis AC-10) —
 * sie hängen an einem einzigen Schema, das direkt geprüft wird; die Datenbankschicht von AC-24
 * und AC-25 — `/qa` hat sie mit zwei echten Konten gegen PostgREST geprüft, also am
 * Anwendungscode vorbei, wo kein Browser hinkommt; und Darstellungsdetails.
 *
 * Zwei dieser Journeys stehen hier, weil genau sie beim Bau gebrochen sind: Journey 2 (die
 * Erfassungszeile verlor ihr Datum beim Monatswechsel) und Journey 3 (nach `refresh()` war der
 * Dialog ausgehängt, bevor die Rückmeldung kam). Journey 4 hält den behobenen BUG-1 fest.
 */
const AKTION = { timeout: 30_000 }

test.beforeEach(() => {
  // Wie bei PROJ-1: Die Registrierungs-Drosselung zählt ohne erklärten Proxy alle Versuche
  // gemeinsam (AC-17, TD-23) — ohne diesen Reset sperrt sich die Suite selbst aus.
  clearThrottle()
})

/** Registriert ein frisches Konto über das Formular und landet angemeldet auf `/`. */
async function registriere(page: Page, tag: string): Promise<string> {
  const email = uniqueEmail(tag)
  await page.goto('/signup')
  await page.getByLabel('E-Mail-Adresse').fill(email)
  await page.getByLabel('Passwort').fill(PASSWORD)
  await page.getByRole('button', { name: 'Konto anlegen' }).click()
  await expect(page).toHaveURL('/', AKTION)
  return email
}

/** Füllt die dauerhaft sichtbare Erfassungszeile aus und schickt sie ab. */
async function erfasse(
  page: Page,
  werte: { betrag: string; kategorie: string; datum: string; notiz?: string },
): Promise<void> {
  await page.getByLabel('Betrag').fill(werte.betrag)
  await page.getByLabel('Kategorie').click()
  await page.getByRole('option', { name: werte.kategorie, exact: true }).click()
  await page.getByLabel('Datum').fill(werte.datum)
  if (werte.notiz !== undefined) await page.getByLabel('Notiz').fill(werte.notiz)
  await page.getByRole('button', { name: 'Erfassen' }).click()

  // Warten, bis der Vorgang durch ist. Das Leeren von Betrag und Notiz ist das Signal, dass
  // gespeichert wurde (AC-3) — tippt man vorher weiter, überschreibt genau dieses Aufräumen
  // die nächste Eingabe. Ein Mensch wartet ohnehin, bis die Zeile erscheint.
  await expect(page.getByLabel('Betrag')).toHaveValue('', AKTION)
}

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Die Gesamtsumme, wie sie über der Liste steht. */
function gesamtsumme(page: Page) {
  return page.locator('span.text-\\[32px\\]')
}

test('Journey 1: Erfassen, Summen und Filter — der Weg, für den man die App öffnet (AC-1, AC-3, AC-11 bis AC-16)', async ({
  page,
}) => {
  await registriere(page, 'j1')
  const heute = iso(new Date())

  // AC-12 — ein leerer Monat zeigt einen ausformulierten Satz, keine leere Tabelle.
  await expect(page.getByText('ist noch nichts erfasst.')).toBeVisible(AKTION)

  // AC-1 — erfassen, und die Zeile steht ohne Neuladen in der Liste.
  await erfasse(page, { betrag: '29,00', kategorie: 'Software & Abos', datum: heute, notiz: 'Hosting' })
  await expect(page.getByRole('cell', { name: 'Hosting' })).toBeVisible(AKTION)

  // AC-3 — Betrag und Notiz sind geleert, Kategorie und Datum stehen, der Fokus ist zurück
  // im Betragsfeld. Das ist die Regel, die das Nachtragen im Sekundentakt erst ermöglicht.
  await expect(page.getByLabel('Betrag')).toHaveValue('')
  await expect(page.getByLabel('Notiz')).toHaveValue('')
  await expect(page.getByLabel('Datum')).toHaveValue(heute)
  // **Die Kategorie war hier nie geprüft** — und genau sie fiel nach dem Speichern auf „Wählen"
  // zurück, seit es dieses Feature gibt. Aufgedeckt hat es erst `/e2e-tests` von PROJ-3, wo
  // derselbe Fehler die Währung traf und aus einem Dollar-Beleg still einen Euro-Beleg machte.
  // Die eine fehlende Zusicherung war die, auf die es ankam.
  await expect(page.getByLabel('Kategorie')).toHaveText('Software & Abos')
  await expect(page.getByLabel('Betrag')).toBeFocused()

  // AC-13, AC-16 — die Gesamtsumme steht hervorgehoben und stimmt ohne Neuladen.
  await expect(gesamtsumme(page)).toHaveText('29,00 €', AKTION)

  await erfasse(page, { betrag: '12,50', kategorie: 'Bewirtung', datum: heute, notiz: 'Kaffee' })
  await expect(page.getByRole('cell', { name: 'Kaffee' })).toBeVisible(AKTION)
  await expect(gesamtsumme(page)).toHaveText('41,50 €', AKTION)

  // AC-11 — beide Zeilen stehen mit Datum, Kategorie, Notiz und Betrag in der Liste,
  // die zuletzt erfasste zuerst.
  const zeilen = page.locator('tbody tr')
  await expect(zeilen).toHaveCount(2)
  await expect(zeilen.first()).toContainText('Kaffee')
  await expect(zeilen.last()).toContainText('Hosting')

  // AC-14 — je belegter Kategorie eine Zeile mit Summe und Prozentanteil, absteigend.
  const software = page.getByRole('button', { name: /Software & Abos/ })
  const bewirtung = page.getByRole('button', { name: /Bewirtung/ })
  await expect(software).toContainText('29,00 €')
  await expect(software).toContainText('70 %')
  await expect(bewirtung).toContainText('12,50 €')
  await expect(bewirtung).toContainText('30 %')

  // AC-15 — ein Klick filtert die Liste, ein zweiter hebt den Filter wieder auf. Die
  // Gesamtsumme bleibt dabei ungefiltert: sie ist der Maßstab, gegen den gefiltert wird.
  await bewirtung.click()
  await expect(bewirtung).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('cell', { name: 'Kaffee' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Hosting' })).toBeHidden()
  await expect(gesamtsumme(page)).toHaveText('41,50 €')

  await bewirtung.click()
  await expect(bewirtung).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByRole('cell', { name: 'Hosting' })).toBeVisible()
})

test('Journey 2: Der Monat steht in der Adresse und die Ansicht folgt der Ausgabe (AC-2, AC-4, AC-17 bis AC-19)', async ({
  page,
}) => {
  await registriere(page, 'j2')

  const heute = new Date()
  const laufend = iso(heute).slice(0, 7)
  const vormonatTag = new Date(heute.getFullYear(), heute.getMonth() - 1, 15)
  const vormonat = iso(vormonatTag).slice(0, 7)

  // AC-2 — im laufenden Monat ist heute vorbelegt.
  await expect(page.getByLabel('Datum')).toHaveValue(iso(heute), AKTION)

  // AC-4 — eine Ausgabe mit einem Datum aus einem anderen Monat behält ihr Datum, und die
  // Ansicht wechselt mit. Ohne das verschwände die eben erfasste Ausgabe unsichtbar — genau
  // der Moment, in dem sie ein zweites Mal eingetragen wird.
  await erfasse(page, {
    betrag: '80,00',
    kategorie: 'Reise & Fahrt',
    datum: iso(vormonatTag),
    notiz: 'Bahnfahrt',
  })
  await expect(page).toHaveURL(`/?monat=${vormonat}`, AKTION)
  await expect(page.getByRole('cell', { name: 'Bahnfahrt' })).toBeVisible()

  // AC-3 im Zusammenspiel mit AC-2: Das eingegebene Datum bleibt stehen, weil es im nun
  // angezeigten Monat liegt. (Diese Zusicherung war beim Bau gebrochen — ein `key` an der
  // Suspense-Grenze hat den Teilbaum bei jedem Wechsel neu aufgebaut.)
  await expect(page.getByLabel('Datum')).toHaveValue(iso(vormonatTag))

  // AC-18 — im Vormonat geht es vorwärts, aber nicht weiter zurück; der inaktive Pfeil bleibt
  // sichtbar und erklärt sich für Screenreader.
  await expect(page.getByRole('link', { name: /^Weiter zu / })).toBeVisible()
  await expect(page.getByRole('link', { name: /^Zurück zu / })).toHaveCount(0)
  await expect(page.getByText('Weiter zurück geht es nicht — davor hast du nichts erfasst.')).toBeAttached()

  // AC-17 — der Monat übersteht ein Neuladen, weil er in der Adresse steht.
  await page.reload()
  await expect(page.getByRole('cell', { name: 'Bahnfahrt' })).toBeVisible(AKTION)

  // AC-17 — vorwärts in den laufenden Monat, und der Zurück-Button führt zurück in den Vormonat.
  await page.getByRole('link', { name: /^Weiter zu / }).click()
  await expect(page).toHaveURL(`/?monat=${laufend}`, AKTION)
  await expect(page.getByText('ist noch nichts erfasst.')).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('cell', { name: 'Bahnfahrt' })).toBeVisible(AKTION)

  // AC-18 — im laufenden Monat ist der Vorwärtspfeil inaktiv, aber sichtbar.
  await page.goto(`/?monat=${laufend}`)
  await expect(page.getByRole('link', { name: /^Weiter zu / })).toHaveCount(0)
  await expect(page.getByText('Weiter geht es nicht — das ist der laufende Monat.')).toBeAttached()

  // AC-19 — eine Monatsangabe, die es nicht gibt, führt zum laufenden Monat statt zu einer
  // Fehlerseite.
  await page.goto('/?monat=2026-13')
  await expect(page.getByText('ist noch nichts erfasst.')).toBeVisible(AKTION)
  await page.goto('/?monat=voelliger-unsinn')
  await expect(page.getByText('ist noch nichts erfasst.')).toBeVisible(AKTION)
})

test('Journey 3: Ändern und Löschen, ohne dass eine Ausgabe still verschwindet (AC-20 bis AC-23, EC-11)', async ({
  page,
}) => {
  await registriere(page, 'j3')

  const heute = new Date()
  const laufend = iso(heute).slice(0, 7)
  const vormonatTag = new Date(heute.getFullYear(), heute.getMonth() - 1, 10)
  const vormonat = iso(vormonatTag).slice(0, 7)

  await erfasse(page, { betrag: '29,00', kategorie: 'Software & Abos', datum: iso(heute), notiz: 'Hosting' })
  await expect(gesamtsumme(page)).toHaveText('29,00 €', AKTION)

  // AC-20 — der Dialog öffnet mit dem gespeicherten Stand.
  await page.getByRole('button', { name: 'Ändern' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Betrag')).toHaveValue('29,00')
  await expect(dialog.getByLabel('Datum')).toHaveValue(iso(heute))
  await expect(dialog.getByLabel('Notiz')).toHaveValue('Hosting')

  // AC-20 — nach dem Speichern zeigen Liste und Summen den neuen Stand.
  await dialog.getByLabel('Betrag').fill('35,00')
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByRole('cell', { name: '35,00 €' })).toBeVisible(AKTION)
  await expect(gesamtsumme(page)).toHaveText('35,00 €', AKTION)

  // EC-11 — eine Änderung, die die Ausgabe in einen anderen Monat schiebt, zieht die Ansicht
  // mit und sagt es. (Beim Bau war das stumm: nach `refresh()` war der Dialog ausgehängt,
  // bevor sein Effect laufen konnte.)
  await page.getByRole('button', { name: 'Ändern' }).click()
  await page.getByRole('dialog').getByLabel('Datum').fill(iso(vormonatTag))
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect(page).toHaveURL(`/?monat=${vormonat}`, AKTION)
  await expect(page.getByText(/liegt jetzt im/)).toBeVisible(AKTION)
  await expect(page.getByRole('cell', { name: '35,00 €' })).toBeVisible()

  // Der verlassene Monat steht danach korrekt auf leer.
  await page.goto(`/?monat=${laufend}`)
  await expect(page.getByText('ist noch nichts erfasst.')).toBeVisible(AKTION)

  // AC-22 — die Bestätigung nennt die betroffene Ausgabe, und „Abbrechen" lässt alles stehen.
  await page.goto(`/?monat=${vormonat}`)
  await page.getByRole('button', { name: 'Löschen' }).click()
  const bestaetigung = page.getByRole('alertdialog')
  await expect(bestaetigung).toContainText('35,00 €')
  await expect(bestaetigung).toContainText('Software & Abos')
  await bestaetigung.getByRole('button', { name: 'Abbrechen' }).click()
  await expect(page.getByRole('cell', { name: '35,00 €' })).toBeVisible()

  // AC-23 — bestätigt wird gelöscht, eine Rückmeldung sagt es, und die Summen stimmen.
  await page.getByRole('button', { name: 'Löschen' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Löschen' }).click()
  await expect(page.getByText('Ausgabe gelöscht.')).toBeVisible(AKTION)
  await expect(page.getByText('ist noch nichts erfasst.')).toBeVisible(AKTION)
  await expect(gesamtsumme(page)).toHaveText('0,00 €')
})

test('Journey 4: Die eigenen Daten als CSV mitnehmen (AC-27, EC-10)', async ({ page }) => {
  const email = await registriere(page, 'j4')
  const heute = iso(new Date())

  await erfasse(page, { betrag: '29,00', kategorie: 'Software & Abos', datum: heute, notiz: 'Hosting' })
  await expect(page.getByRole('cell', { name: 'Hosting' })).toBeVisible(AKTION)

  // EC-10 — ein Semikolon in der Notiz darf die Spalten nicht verrutschen lassen.
  await erfasse(page, { betrag: '42,50', kategorie: 'Bewirtung', datum: heute, notiz: 'Rechnung; storniert' })
  // Regressionswache für BUG-1: eine Notiz, die mit `=` beginnt, ist für uns Text — für jede
  // Tabellenkalkulation wäre sie eine Formel, wenn sie unbegrenzt in der Datei landet.
  await erfasse(page, { betrag: '9,00', kategorie: 'Gebühren & Beiträge', datum: heute, notiz: '=Rest aus Juli' })
  await expect(page.getByRole('cell', { name: '=Rest aus Juli' })).toBeVisible(AKTION)

  await page.goto('/konto')
  const download = page.waitForEvent('download')
  await page.getByRole('link', { name: 'Ausgaben als CSV herunterladen' }).click()
  const datei = await download

  expect(datei.suggestedFilename()).toMatch(/^auslage-export-\d{4}-\d{2}-\d{2}\.csv$/)

  const stream = await datei.createReadStream()
  const teile: Buffer[] = []
  for await (const teil of stream) teile.push(teil as Buffer)
  const csv = Buffer.concat(teile).toString('utf8')

  // Kopfblock, Spaltenüberschriften, BOM und CRLF.
  expect(csv.startsWith('﻿')).toBe(true)
  expect(csv).toContain(`Konto;${email}`)
  expect(csv).toContain('Datum;Kategorie;Betrag (EUR);Notiz;Erfasst am')
  expect(csv).toContain('\r\n')

  // Kategorie als deutscher Anzeigename, Betrag mit Dezimalkomma und ohne Währungszeichen.
  expect(csv).toContain(';Software & Abos;29,00;Hosting;')

  // EC-10 — das Semikolon wird begrenzt.
  expect(csv).toContain(';"Rechnung; storniert";')

  // BUG-1 — die Formel bekommt ihre Textmarkierung und steht nirgends unbegrenzt.
  expect(csv).toContain(`;"'=Rest aus Juli";`)
  expect(csv).not.toContain(';=Rest aus Juli;')
})

test('Journey 5: Niemand sieht die Zahlen einer anderen Person (AC-24)', async ({ browser }) => {
  const kontextA = await browser.newContext()
  const kontextB = await browser.newContext()
  const seiteA = await kontextA.newPage()
  const seiteB = await kontextB.newPage()

  try {
    await registriere(seiteA, 'j5a')
    await registriere(seiteB, 'j5b')

    const heute = iso(new Date())
    await erfasse(seiteA, {
      betrag: '1.234,50',
      kategorie: 'Hardware & Geräte',
      datum: heute,
      notiz: 'Geheimes Notebook',
    })
    await expect(seiteA.getByRole('cell', { name: 'Geheimes Notebook' })).toBeVisible(AKTION)

    // B sieht in der Liste nichts von A — und auch keine Summe.
    await seiteB.reload()
    await expect(seiteB.getByText('ist noch nichts erfasst.')).toBeVisible(AKTION)
    await expect(seiteB.getByText('Geheimes Notebook')).toHaveCount(0)
    await expect(gesamtsumme(seiteB)).toHaveText('0,00 €')

    // Auch nicht über einen Monat in der Adresse, den A benutzt.
    await seiteB.goto(`/?monat=${heute.slice(0, 7)}`)
    await expect(seiteB.getByText('Geheimes Notebook')).toHaveCount(0)

    // Und auch nicht über den Export — der ist der breiteste Weg an Daten heran.
    await seiteB.goto('/konto')
    const download = seiteB.waitForEvent('download')
    await seiteB.getByRole('link', { name: 'Ausgaben als CSV herunterladen' }).click()
    const stream = await (await download).createReadStream()
    const teile: Buffer[] = []
    for await (const teil of stream) teile.push(teil as Buffer)
    const csv = Buffer.concat(teile).toString('utf8')

    expect(csv).not.toContain('Geheimes Notebook')
    expect(csv).not.toContain('1234,50')
    // Der Kopfblock gehört B, nicht A.
    expect(csv).toContain('Datum;Kategorie;Betrag (EUR);Notiz;Erfasst am')

    // A sieht seine Ausgabe unverändert.
    await seiteA.reload()
    await expect(seiteA.getByRole('cell', { name: 'Geheimes Notebook' })).toBeVisible(AKTION)
  } finally {
    await kontextA.close()
    await kontextB.close()
  }
})

/**
 * Journey 6 — der Kalender, der Rückweg und die lesbare Notiz (AC-31 bis AC-34).
 *
 * Ergänzt am 02.09.2026 aus der Rückmeldung am laufenden Stand. Drei Dinge, die alle nur im
 * Browser sichtbar sind: Der Kalender ist reine Client-Interaktion, der Rückweg ist eine Frage
 * der Erkennbarkeit, und ob die Notiz lesbar ist, entscheidet sich an der ausgelieferten Farbe.
 */
test('Journey 6: Kalender, Rückweg und lesbare Notiz (AC-31 bis AC-34)', async ({ page }) => {
  await registriere(page, 'j6')

  const datum = page.getByLabel('Datum')
  const heute = new Date()

  // --- AC-31: der Kalender ist ein ZWEITER Weg, nicht der einzige --------------------------
  // Erst tippen — das Feld muss tippbar bleiben, sonst kostet jeder Beleg zwei Klicks mehr.
  await datum.fill('2026-08-15')
  await expect(datum).toHaveValue('2026-08-15')

  // AC-32: der Wochentag steht am Feld, ohne dass man den Kalender öffnet. Der 15.08.2026 ist
  // ein Samstag — genau der Fall, an dem PROJ-3 den Kurs des Vortags nimmt (dort AC-4).
  await expect(page.getByText('Sa', { exact: true })).toBeVisible(AKTION)

  // Und jetzt derselbe Wert über den Kalender.
  await page.getByRole('button', { name: 'Kalender öffnen' }).click()
  await page.getByRole('button', { name: 'Montag, 17. August 2026' }).click()
  await expect(datum).toHaveValue('2026-08-17')
  await expect(page.getByText('Mo', { exact: true })).toBeVisible(AKTION)

  // EC-14: Tage nach heute stehen gar nicht erst im Kalender.
  await page.getByRole('button', { name: 'Kalender öffnen' }).click()
  const morgen = new Date(heute.getTime() + 24 * 3600 * 1000)
  const morgenLabel = new Intl.DateTimeFormat('de-AT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(morgen)
  await expect(page.getByRole('button', { name: morgenLabel })).toHaveCount(0)
  await page.keyboard.press('Escape')

  // --- AC-34: die Notiz ist nicht mehr die blasseste Spalte der Zeile ----------------------
  await erfasse(page, {
    betrag: '24,90',
    kategorie: 'Büromaterial',
    datum: iso(heute),
    notiz: 'Druckerpapier',
  })

  const zeile = page.getByRole('row').filter({ hasText: 'Druckerpapier' })
  const farbe = (text: string) =>
    zeile
      .getByText(text, { exact: true })
      .evaluate((el) => getComputedStyle(el).color)

  // Gemessen statt behauptet: Die Notiz trug `--muted-foreground` und war damit blasser als
  // Kategorie und Datum daneben. Formal war das über der Kontrastgrenze — falsch war die
  // Einstufung. Geprüft wird deshalb die Gleichheit mit der Kategorie, nicht ein Farbwert.
  expect(await farbe('Druckerpapier')).toBe(await farbe('Büromaterial'))

  // --- AC-33: der Rückweg von /konto ------------------------------------------------------
  await page.goto('/konto')
  const zurueck = page.getByRole('link', { name: 'Zur Übersicht' })
  await expect(zurueck).toBeVisible(AKTION)
  await zurueck.click()
  await expect(page).toHaveURL('/', AKTION)
})
