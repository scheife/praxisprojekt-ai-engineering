---
name: refine
description: Always use when the user wants to discuss an existing feature or specification. Open an existing feature spec to improve, extend, or fundamentally challenge it. Pass the feature ID as argument (e.g. /refine PROJ-2).
argument-hint: "PROJ-X"
user-invocable: true
---

# Feature Spec Refiner

## Goal
Improve, extend, or fundamentally challenge an existing, live spec based on what the user tells you. Push back where the spec is weak, vague, or contradictory — refining means making the spec genuinely better, not rubber-stamping it.

## Before Starting
1. Read the feature spec `features/PROJ-X-*/spec.md` — understand the full current state. If `features/PROJ-X-*/design.md` and `features/PROJ-X-*/tasks.md` exist, skim them too — refining scope or design may invalidate them.
2. Read `features/INDEX.md` — understand dependencies, status, and context
3. Read `docs/PRD.md` — keep the project vision in mind

**If no argument was provided** (no PROJ-X ID given):
> "Which feature spec would you like to refine?" — list all existing features from INDEX.md.

**If the PROJ-X ID doesn't exist**: tell the user and list existing features.

## Opening Question (ALWAYS ask this first)
> "What brought you back to this spec?"

This answer determines everything. Listen carefully — it will tell you which of the three paths to take.

## Three Paths

### Path 1: Something Changed
*Trigger: "scope changed", "we got user feedback", "business logic is different", "stakeholder changed the requirements"*

Run a targeted interview on the affected areas only:
- What specifically changed?
- Which user stories are affected?
- Which acceptance criteria need to be updated or removed?
- Do any edge cases change?
- Do dependencies change?
- Does the Out of Scope section need updating? (something previously excluded is now included, or vice versa)

### Path 2: Implementation Revealed Gaps
*Trigger: "during implementation we found...", "the backend doesn't support...", "we didn't think about X scenario"*

Focus on making the spec tighter:
- What specific scenario was missing?
- Should this become a new acceptance criterion or edge case?
- Does this change any existing criteria?
- Are there related gaps we should close now while we're here?

### Path 3: Fundamental Challenge
*Trigger: "I'm not sure this feature is right", "maybe we should rethink this", "this might actually be two features"*

Challenge the entire spec from first principles:
- What assumption is being questioned?
- Is the user story still the right framing?
- Should this feature be split? If so, what are the two features?
- Should it be merged with another feature?
- What would the absolute minimal version of this feature look like?
- What moves to Out of Scope as a result of this challenge?

If the feature should be split: create the new feature folder (`features/PROJ-X-*/spec.md`) using the `/write-spec` workflow, and update `features/INDEX.md` accordingly.

## The Discovery Interview
Same as in `/init` and `/write-spec`:
- **One question at a time** — never list multiple questions
- **Always provide a recommended answer** — the user confirms or corrects it
- **Follow the conversation** — don't follow a fixed script
- **Explore codebase first** if it can answer a question
- **Stop when you have full clarity** on what needs to change

## After the Interview: Update the Spec

Make the changes to `features/PROJ-X-*/spec.md`. After saving, re-read the file to verify the changes are present.

If acceptance criteria are added, removed, or reworded, keep the AC-ID / EC-ID scheme intact: append new criteria with the next free ID (AC-N, EC-N), and do NOT renumber existing IDs — downstream `tasks.md` and `qa-report.md` reference them by ID.

**If this refinement brings personal data into the feature, consult `/dsgvo` — and say that you are doing it.**
This is the moment that otherwise slips through. The original spec may have been harmless, and the refinement is what adds the comment box, the file upload, the contact field, or the free-text note users will fill with information about themselves. `/write-spec` only ever sees a feature once; every later change comes through here. If nobody looks now, nobody looks at all.

Announce it, run `/dsgvo PROJ-X`, and add what it proposes as **new acceptance criteria with the next free AC-IDs** — never by rewriting existing ones:
> "What you're adding here means the feature now stores what people write about themselves. I'm running a data-protection check before I update the spec — it usually adds requirements around deletion and data export."

When you present the updated spec, **point those criteria out by ID** and say where they came from, so the user can tell their own product decisions apart from legal obligations. Questions only a lawyer can answer go into Open Questions, not into an AC.

If the refinement changes nothing about personal data, skip it silently — do not perform a ritual check on a copy fix.

**If this refinement changes scope or technical design** (Path 1, Path 2, or Path 3): flag that `design.md` and `tasks.md` may now be stale. Recommend re-running `/architecture` and then `/tasks`, since `tasks.md` is derived from the design and the AC-IDs. Set the feature status back to `Architected` (or `Planned`) in `features/INDEX.md` if it had already moved past that point.

### Maintain the Decision Log and Open Questions

**Close resolved Open Questions:**
For any `- [ ]` items in Open Questions that are now answered, mark them as `- [x]` and add a brief resolution note:
```
- [x] Should we support bulk delete? → No, deferred to P1 (2026-05-19)
```

**Log new decisions:**
Any decision made during this refinement session belongs in the Decision Log. Product decisions go in the Product Decisions table in `spec.md` (Decision | Rationale | Date). Technical decisions go in the Technical Decisions table in `design.md` (Decision | Rationale | Alternative considered | Trade-off | Date). Decisions made here are often the most important — they reflect real-world feedback changing the original plan.

**Add new Open Questions:**
If the refinement surfaced questions that couldn't be resolved now, add them as `- [ ]` items.

## Update Tracking Files
- Update `features/INDEX.md` if the description, the status, or the priority / dependencies (the Build order line) changed — it is the one place the feature map lives; `docs/PRD.md` carries no feature table
- Update `docs/data-model.md` if this refinement adds, removes, or reshapes an **entity, relationship, or ownership** — keep the app-wide map accurate at product altitude (no column types). If the data shape changed, this usually also means `/architecture` should re-run to redesign the feature's schema against the updated map.
- Update `docs/app-shell.md` if this refinement changes the **frame** — a new or removed top-level area, a different layout region, what an auth state sees, or a new shared page pattern. If you are refining the shell's *owning* feature, that map is the picture of what you just changed; keep them in step. If you are refining any other feature and find yourself changing the shell, that's the owner's contract — say so and refine there instead.

## Checklist Before Completion
- [ ] Opening question asked and path determined
- [ ] All interview questions resolved
- [ ] `spec.md` updated and verified (re-read after editing)
- [ ] AC-IDs / EC-IDs preserved (existing IDs not renumbered; new ones appended)
- [ ] Out of Scope updated if scope boundaries changed
- [ ] If the refinement brought personal data into the feature: `/dsgvo PROJ-X` run (announced beforehand), its criteria added as new AC-IDs and pointed out to the user as coming from the data-protection check
- [ ] Resolved Open Questions marked as `- [x]` with resolution note
- [ ] New decisions logged (Product → `spec.md`, Technical → `design.md`) with rationale
- [ ] If scope/design changed: flagged that `/architecture` and `/tasks` may need to re-run
- [ ] New Open Questions added if anything remains unresolved
- [ ] `features/INDEX.md` updated if status or dependencies changed
- [ ] `features/INDEX.md` updated if the description or the Build order changed
- [ ] `docs/data-model.md` updated if an entity/relationship/ownership changed
- [ ] `docs/app-shell.md` updated if the frame changed (area, region, auth state, page pattern) — or the change routed to the shell's owning feature
- [ ] User has reviewed the changes

## Handoff
_Say this in the project's working language. The quote is the **content**, not the wording — translate it; only command names (`/tasks`), feature IDs and file paths stay as they are. An English closing line under a German document is the half-translated output the working-language rule forbids._
Depends on the path taken:
- Path 1 or 2 (spec only, design unaffected): "Spec updated. Continue with the next step in your workflow."
- Path 1 or 2 (scope/design changed): "Spec updated. The design and tasks may now be stale — run `/architecture`, then `/tasks` to regenerate them before building."
- Path 3 (split): "New spec created for PROJ-X. Run `/architecture` to design the technical approach."

## Git Commit
```
feat(PROJ-X): Refine feature specification — [brief reason]
```