---
name: starter-kit-migration
description: Convert feature documentation from the AI Coding Starter Kit into this kit's folder structure - one file per feature becomes spec.md, design.md and qa-report.md, with stable AC-IDs. Run once after upgrading a Starter Kit project, before /init.
user-invocable: true
---

# Starter Kit Migration

## Goal
Move feature documentation from the AI Coding Starter Kit's one-file-per-feature layout into this kit's folder-per-feature structure, so the rest of the workflow can actually work on it.

Why the split matters, rather than being a matter of taste:

- `spec.md` is **read-only during `/build`** — it is the contract. That is impossible while the same file also holds the QA report, which `/qa` must write to.
- Every acceptance criterion needs a **stable ID** (`AC-1`, `AC-2`, …). The chain **AC → Task → Test** is what `/tasks`, `/build` and `/qa` navigate by. Starter Kit criteria are prose checkboxes with no IDs, so nothing downstream can reference them.
- `/architecture` refines `design.md` while `/qa` writes `qa-report.md`. In one file they overwrite each other's context.

**Convert what is there. Invent nothing.** Every line you write must come from the old file. Where something is missing, it stays missing and you say so — a plausible-looking spec that nobody wrote is worse than an obviously incomplete one.

## When to run
Once, after the kit was added to a Starter Kit project (`npx create-ai-eng-app add`), and **before `/init`**. `/init` asks what to build *next*; that question is easier to answer once the existing features are in this kit's shape.

## Before Starting — three checks, in order
1. **Is this a Starter Kit layout?** There must be at least one `features/PROJ-*.md` file **directly in `features/`** (not inside a folder). If there is none, stop: "Nothing to migrate — this project's features are already in folder structure." Do not go looking for other things to convert.
2. **Was it migrated already?** If `features/PROJ-*/spec.md` folders already exist for the same IDs, do **not** migrate a second time — never merge on top of the first run.

   One repair is allowed in that case, and only this one: if the project's working language is not English and those specs still carry **English headings**, offer to translate the headings only. Say what it will and will not touch (headings yes, content and IDs no), do it after the user agrees, and stop. This is for projects migrated before the heading rule existed; everything else about an already-migrated project is `/refine`'s job.
3. **Read the working language** from the canonical memory file → Key Conventions and run the whole session in it, including the report.

   **Content and headings are not the same thing here.** The Starter Kit ships English headings, and its users write German (or whatever their language is) underneath them — so its feature files are already half-translated, and copying them verbatim carries that straight into the new structure.

   - **Content — verbatim, never touched.** User stories, acceptance criteria, decisions, QA results. Rewriting them risks changing what they mean, and you are not the author.
   - **Headings — translated into the working language.** You are the **first author of these new files**, which is exactly the situation `/init` is in with the scaffolded documents: a document must not end up as an English skeleton with content in another language. `/write-spec` requires the whole spec to be in one language, headings included, so leaving them English produces a document the next skill will flag as drift.

   Leave alone regardless of language: `AC-`/`EC-` IDs, `PROJ-X` identifiers, file names, HTML comments, code and paths.

## Step 1 — Inventory, then STOP
Read `features/INDEX.md` and every `features/PROJ-*.md`. For each feature, record which sections carry real content and which are still a placeholder (`_To be added by /architecture_` and its siblings count as **empty**).

Present a table and **end your turn with an approval question**. Nothing is written before the user answers.

```
PROJ-1  User Authentication   Deployed   spec ✓  design ✓  qa ✓   → 3 files
PROJ-3  Kanban Board          Planned    spec ✓  design –  qa –   → 1 file
PROJ-5  Task-Kommentare       Roadmap    no file                  → nothing to do
```

Say plainly what will happen to the old files (moved to `.ai-eng-kit-backup/features/`, never deleted) and ask for the go-ahead.

## Step 2 — Per feature, write the folder
Create `features/PROJ-X-name/` using the **same slug the old file had**, so links stay predictable.

### `spec.md` — always, when the old file exists
Take these sections over in this order: `Dependencies`, `User Stories`, `Out of Scope`, `Acceptance Criteria`, `Edge Cases`, `Technical Requirements`, `Open Questions`, `Decision Log`. The Starter Kit uses the same headings, so the structure is a move, not a rewrite — the **body of each section is verbatim**, the **heading is in the working language** (see check 3).

Three changes, and only these three:

- **Give every acceptance criterion a stable ID**, numbered in the order they already stand:
  `- [ ] Angenommen …` → `- [ ] **AC-1** — Angenommen …`
  Keep the checkbox state as it is. Do the same for edge cases if the spec template in this project uses `EC-` IDs.
- **Drop the `## Status:` line.** The contract carries no status — `features/INDEX.md` is the single record, and a second copy only drifts.
- **Record where the file came from**, as a blockquote directly under the `# PROJ-X: …` heading, in the project's working language:

  > Migrated from the AI Coding Starter Kit. This feature was built before the AC → Task → Test
  > chain existed, so it has no `tasks.md` and its AC-IDs appear in no task. `/refine PROJ-X`
  > brings it into the chain properly.

  This line is **not decoration and must not be dropped**. `/audit` and `/cleanup` read it: without it, every acceptance criterion of a working, deployed feature is reported as "has no task", and a page of red findings that are all wrong teaches the user to stop reading the report. Keep the marker sentence in English exactly as written above (`Migrated from the AI Coding Starter Kit`) so the other skills can find it; the explanation after it follows the working language.

### `design.md` — only when `## Tech Design` has real content
Take its subsections over as they are. Then append what point 1 of the migration decision covers:

- From the old `## Deployment` section, carry over only what is **specific to this project** — the environment variables it names, the production URL, anything hand-written about how this app goes live — under a heading `## Deployment (carried over from the Starter Kit)`.
- **Drop the generic checklist** (pre-deployment checks, rollback steps, post-deploy verification). `/deploy` in this kit ships a fuller one, and two competing checklists is how the wrong one gets followed.
- If `## Deployment` holds nothing project-specific, add nothing at all.

### `qa-report.md` — only when `## QA Test Results` has real content
Carry the results over and **key them to the AC-IDs you just assigned**. The Starter Kit's report refers to criteria by their prose, so match each result to its criterion by text.

**Where a result cannot be matched to a criterion, say so explicitly** — a line like `Not attributable to an AC-ID (from the Starter Kit report): …`. Never quietly drop it and never guess an ID to make the report look tidy.

### `tasks.md` — never
There is no source for it. The Starter Kit has no `/tasks` step, and reconstructing tasks from a finished design would be fiction that `/build` would never work through. Leave it out; the final report says why.

### Empty sections
If `## Tech Design` or `## QA Test Results` is still a placeholder, **create no file**. `/architecture` and `/qa` write them at the right moment; an empty placeholder is noise that later reads as "someone started this".

## Step 3 — Update `features/INDEX.md`
Repoint the Spec column from the file to the folder:
`[PROJ-1-user-authentication.md](PROJ-1-user-authentication.md)` → `[features/PROJ-1-user-authentication/](features/PROJ-1-user-authentication/)`

Change **nothing else** in the table — not the status values, not the dates, not the "Next Available ID", not rows whose Spec column is `–` (a feature at Roadmap has no file and needs none).

One thing outside the table does need attention: the **status legend and the surrounding headings**. The installer replaces the Starter Kit's legend with this kit's, and it can only lay down the English original — a scaffolder cannot translate. So if the working language is not English, put the legend and the headings of `features/INDEX.md` into it, exactly as you did for the specs. Leave the **status values themselves in English** (`Roadmap`, `Planned`, `Deployed`, …): they are identifiers that `/write-spec`, `/build` and `/deploy` read and write, not prose.

## Step 4 — Move the old files aside
Move every migrated `features/PROJ-*.md` to `.ai-eng-kit-backup/features/`. **Move, never delete** — this is the user's product documentation, and the conversion is only as good as the reading that produced it.

## Step 5 — Report, including what it does not give them
State per feature what was written. Then the part that is easy to leave out and matters most:

> The AC-IDs for features that are already built are **new labels**. They appear in no task and no test, because none existed when the feature was built. The structure is now right and the chain is nominal, not real — `/refine PROJ-X` is what makes it real for a feature you come back to.

Also name:
- any QA result you could not attribute to an AC-ID,
- any feature you skipped and why,
- that `tasks.md` was deliberately not created, and that `/audit` knows this and will not report it as drift.

## What NOT to do
- Do NOT write a single sentence that was not in the old file — no filling gaps, no "improving" a spec while moving it.
- Do NOT translate **content**. Headings are the exception and the only one (check 3).
- Do NOT touch `docs/PRD.md`, the app code, or anything outside `features/` and the backup folder.
- Do NOT create `tasks.md`, and do NOT create empty `design.md` / `qa-report.md`.
- Do NOT delete the old files.
- Do NOT change status values — status belongs to `features/INDEX.md` and `/deploy` owns it.

## Handoff
_Say this in the project's working language. The quote is the **content**, not the wording — translate it; only command names (`/tasks`), feature IDs and file paths stay as they are. An English closing line under a German document is the half-translated output the working-language rule forbids._
> "Your feature documentation is now in this kit's structure. Run `/init` next — it records what this project is and how it runs, and then we plan what comes after **[first feature at Roadmap or Planned]**."

## Git Commit
Offer one commit for the whole migration, and let the user decide:
`docs: migrate feature documentation to AI Engineering Kit structure`
Never commit without asking — the user may want to review the split first, which is exactly the right instinct.
