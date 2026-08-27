# Vitest and Playwright — the concrete procedures

> **Applies when `.ai-eng-kit` → `stack.test` is `vitest` or `stack.e2e` is `playwright`.**
> If neither is, this file does not describe this project. Read `commands` for what this project
> actually runs, and never install a test framework into someone's project because this file
> describes one — that is a dependency decision, and it is theirs.

The principles live in `/qa` and `/e2e-tests`: what to test, what a passing test is worth, and that
an unverified check is never a pass. This is only how these two tools express them.

---

## Running the suites

_Reached from `/qa` step 5 and `/deploy`'s pre-flight._

```bash
npm test              # Vitest: unit and integration tests
npm run test:e2e      # Playwright: end-to-end browser tests
npm run test:all      # both
```

Prefer `commands.test` from `.ai-eng-kit` where it is set — it is what the project recorded, and it
stays right when the scripts are renamed.

## Installing the Playwright browser (once per machine)

_Reached from `/e2e-tests`, before the first run._

E2E tests drive a real browser, so the binary has to be there. Check before installing:

```bash
npx playwright install --dry-run 2>&1 | head -5
```

If it is **not** installed, tell the user before you start:

> "E2E tests run in a real browser. I'll install the Playwright browser now — it's a ~300 MB
> one-time download per machine."

Then: `npx playwright install chromium`

**This install belongs here and nowhere else.** `/qa` and `/verify-setup` never trigger it, which is
what keeps setup and the ordinary test loop fast. After cloning the repo it runs once.

## Where tests live

_Reached from `/qa` step 6 and `/verify-setup` check 5._

- **Unit and integration tests are co-located** next to the source file they cover —
  `src/hooks/useFeature.test.ts` beside `src/hooks/useFeature.ts`. A test that sits next to its
  subject gets read when the subject changes; one in a distant folder does not.
- **E2E specs live in `tests/`** as `*.spec.ts`, one per critical journey.

`package.json` carries the `test`, `test:e2e` and `test:all` scripts; `vitest.config.ts` and
`playwright.config.ts` carry the configuration.

## Writing a Vitest unit test

_Reached from `/qa` step 6._

- Mock only external dependencies — `localStorage`, `fetch`, the clock. Never mock the logic under
  test; a test that mocks its own subject passes for the wrong reason.
- Cover the happy path **and** the failure paths: corrupt input, empty state, a rejected promise.
- Run `npm test` to confirm they pass. "Should pass" is not "passes".
