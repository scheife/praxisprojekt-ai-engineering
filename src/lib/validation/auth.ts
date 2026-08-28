import { z } from 'zod'

/**
 * Die verbindliche Prüfung für Anmeldung und Registrierung.
 *
 * Sie läuft nur auf dem Server. Eine zweite Prüfung im Browser wäre bequemer, aber sie
 * wäre auch eine zweite Stelle, an der dieselben Regeln stehen — und die erste, die beim
 * Ändern vergessen wird. Die Formulare verzichten deshalb auch auf die Browser-eigene
 * Prüfung (`noValidate`), damit die Meldungen aus einer Quelle kommen.
 */

/** Die längste zulässige E-Mail-Adresse nach RFC 5321. */
const EMAIL_MAX = 254

/**
 * bcrypt berücksichtigt nur die ersten 72 Bytes. Ohne Obergrenze würde ein längeres
 * Passwort still gekürzt — und zwei verschiedene Passwörter würden auf dasselbe Konto
 * passen. Lieber eine sichtbare Regel (design.md, TD-10).
 */
export const PASSWORD_MIN = 10
export const PASSWORD_MAX = 72

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Bitte gib eine gültige E-Mail-Adresse ein.')
  .max(EMAIL_MAX, 'Bitte gib eine gültige E-Mail-Adresse ein.')
  .email('Bitte gib eine gültige E-Mail-Adresse ein.')

/**
 * Das Passwort wird **nicht** randbereinigt — weder bei der Registrierung noch bei der
 * Anmeldung. Führende und nachgestellte Leerzeichen gehören zum Passwort, und beide Wege
 * müssen identisch rechnen (EC-6).
 */
const newPassword = z
  .string()
  .min(PASSWORD_MIN, `Dein Passwort braucht mindestens ${PASSWORD_MIN} Zeichen.`)
  .max(PASSWORD_MAX, `Dein Passwort darf höchstens ${PASSWORD_MAX} Zeichen haben.`)

/**
 * Beim **Anmelden** gilt die Längenregel bewusst nicht.
 *
 * Sie gehört zur Vergabe eines Passworts, nicht zur Prüfung eines eingegebenen. Stünde sie
 * hier, hätte das zwei Folgen, die beide falsch sind: Ein zu kurzer Rateversuch würde schon
 * an der Schema-Prüfung scheitern und damit **an der Drosselung vorbeilaufen**, ohne gezählt
 * zu werden (AC-8) — und das Anmeldeformular würde die Passwortregel ausplaudern, statt
 * schlicht „stimmt nicht" zu sagen (AC-7).
 *
 * Die Obergrenze bleibt, damit die Eingabe begrenzt ist; zu lange Eingaben sind dann einfach
 * falsche Passwörter.
 */
const submittedPassword = z
  .string()
  .min(1, 'Bitte gib dein Passwort ein.')
  .max(200, 'E-Mail-Adresse oder Passwort stimmt nicht.')

export const loginSchema = z.object({ email, password: submittedPassword })
export const signupSchema = z.object({ email, password: newPassword })

export type LoginInput = z.infer<typeof loginSchema>
export type SignupInput = z.infer<typeof signupSchema>
