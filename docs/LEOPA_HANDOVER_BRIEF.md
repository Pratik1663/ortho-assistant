# LEOPA — handover brief

Continuing work on the LEOPA prescription assistant. The restructured build has
been adopted onto branch `gpt-rebuild` and is working; what follows is what was
changed on top of it, what was verified, and the one confirmed bug still open.

Nothing here is speculative — every claim below was either observed in a live
run against the Vercel preview or reproduced in the container.

---

## Repository

- Repo: `Pratik1663/ortho-assistant`
- Working branch: `gpt-rebuild` (production `main` is still the older build)
- Latest commit: `3ae386a` — "Sanitise prose figures; cast dressing default is symmetric"
- Preview deploys automatically from the branch; production is untouched
- `npm test` → 20 passing, `npm run build` → clean

Local path on the developer's machine: `C:\Users\alipsey\Desktop\ortho-project`

---

## THE OPEN BUG — diagnosed, not yet fixed

**Symptom.** A confirmed prescription contained `Heel lift: Left — 5mm
bilateral; Right — 5mm bilateral`. The practitioner never gave the figure 5.
Invented numeric values are supposed to be stripped.

**Diagnosis (reproduced in isolation).** The sanitiser works. Given the RX line
`heel_lift @B = 5mm bilateral` and a conversation where no figure was supplied:

```
parsed  heel_lift: { status: 'set', value: '5mm bilateral' }
cleaned heel_lift: { status: 'set', value: 'bilateral' }
```

The problem is that the acceptance path never calls it:

```ts
// src/prescriptionState.ts:276
export function acceptanceReply(content: string): string | null {
  const state = parsePrescriptionState(content)   // <- raw, unsanitised
  if (!state || !canAcceptPrescription(state)) return null
  return `Practitioner-confirmed prescription\n${prescriptionSummary(state)}\n\n${content.match(RX_BLOCK)![0]}`
}
```

`sanitisePrescription` is applied only in `currentPrescription` (which feeds the
panel). So the panel shows the cleaned value and the confirmed summary shows the
raw one. The summary is the document the practitioner transcribes from, so it is
the worse of the two places to be wrong.

**Suggested fix.** `acceptanceReply` needs the conversation in order to sanitise,
so its signature has to change:

```ts
export function acceptanceReply(content: string, messages: RxMessage[]): string | null
```

Callers to update:
- `src/App.tsx:708` — has the message list to hand
- `src/prescriptionState.ts:415` — inside `currentPrescription`, also has it

Careful with the second one: `currentPrescription` compares
`acceptanceReply(previous.content) === last.content` to decide whether a
prescription was genuinely confirmed. If sanitisation is applied at acceptance
time but the stored confirmed message was produced before the change, that
comparison will stop matching and previously accepted prescriptions will read as
unconfirmed. Worth checking against the "acceptance preserves exact snapshot"
and "silence, edits, and a model claim cannot confirm a proposal" tests, which
exist precisely to protect that path.

A regression test for this belongs alongside the two sanitiser tests at the end
of `tests/regression.test.cjs`.

---

## What was changed on top of the adopted build

### 1. Deployment fix (required — the build was broken without it)

Vercel compiles `api/` with `node16` module resolution, which needs explicit
`.js` extensions on relative imports. Two were missing, and the deploy
"succeeded" while the function never compiled — every reply came back as
"The reply was interrupted."

- `api/chat.ts` → `from '../src/prescriptionState.js'`
- `src/prescriptionState.ts` → `from './formOptions.js'`

`scripts/run-tests.mjs` transpiles to `.cjs` and rewrites relative requires, so
its regex needed to tolerate the suffix:

```js
.replace(/require\("(\.[^"]+?)(?:\.js)?"\)/g, 'require("$1.cjs")')
```

The local build does not catch this class of error — only the Vercel build log
does. Worth checking there after any change to imports in `api/`.

### 2. Duplicate list keys no longer fail closed

Observed: LEOPA emitted `additions @B = ...` twice in one block, splitting a
list across two lines. The parser rejected the whole prescription, and an
otherwise sound reply was discarded over a formatting slip.

`MERGEABLE_FIELDS = new Set(['shell_mods', 'additions'])` — repeats of those two
are merged. Everything else still fails closed on a repeat, because a second
`heel_cup` line is a contradiction rather than a continuation. Covered by a test.

### 3. Open fields no longer block acceptance

`canAcceptPrescription` previously required all sixteen fields settled. A
practitioner who deliberately leaves posting open is ordering no post, and
blocking them forces a value nobody wanted. Now it requires only that nothing is
*invalid* and that something was ordered. Two tests were renamed to match the
new intent rather than deleted.

### 4. The sanitiser (`sanitisePrescription`, `sanitiseProse`)

This is the important one. Six separate attempts to fix these three things
through prompt wording all failed — the rules were added, deployed, and lost on
the next run. They are now enforced in code, where the prompt cannot override
them.

Stripped unless the practitioner supplied it:
- **Numeric values** in `rearfoot_posting`, `heel_skive`, `heel_lift`. A figure
  survives only if it appears in a user turn. "Intrinsic varus 2°" → "varus".
- **Intrinsic / extrinsic** — a fabrication choice the prescriber makes on the
  form, not a clinical one.
- **Poly / 3DP / Poly Pro** — how the lab makes the shell, not what is being
  prescribed. "Semi-Rigid (Poly)" → "Semi-Rigid".

Two details worth preserving if this is refactored:

- Invalid values are cleaned *before* re-validating. "Semi-Rigid (Poly)" fails
  validation precisely because of the part that should be removed, so skipping
  invalid values (as the first version did) missed the main case.
- A field stripped to nothing becomes `open`, not `none`. Not-ordered and
  not-yet-decided are different things and the panel shows them differently.

`sanitiseProse` applies the same rule to the visible reply, because a reply
saying "heel lift 6mm bilaterally" while the summary called it open is worse
than either alone. It is deliberately narrow: only figures adjacent to those
three field names, and only single figures — a range survives, since "2 to 4mm
depending on correction" is exactly what should be offered. Heel cup depths and
material thicknesses are untouched.

### 5. Temperature 0.2

Not previously set, so it was running at the default of 1.0. Three runs of an
identical case produced three materially different devices — different cast
dressings, topcover lengths, posting kinds and additions. The practitioner's
concern was direct: the first thing anyone testing the tool does is run the same
case twice, and two different prescriptions ends the conversation.

0.2 rather than 0 was a deliberate choice — the practitioner did not want fully
deterministic output. The comment in `api/chat.ts` says which way to move it and
why.

### 6. Workflow rules (`assets/consultation_workflow.md`)

- Numeric values given as **ranges with the reason the range moves**, never a
  single figure the practitioner did not supply.
- **Rigidity is a level alone.** Never "Semi-Rigid (Poly)".
- **Defaults where nothing decides**: cast dressing Moderate on both feet,
  topcover length Full Length. Cast dressing specifically must not be varied
  between sides to express that one foot is worse.
- **No deferring to the lab.** "Confirm with lab" is not an answer to skid plate
  or anything else.
- **Anything being waited on carries a marker.** A bare table of open fields
  leaves the practitioner typing two-word answers.
- **Summary field values carry a value and nothing else** — no advice, no
  conditions.

---

## Verified working (live runs against the preview)

- Full proposal in one reply covering all sixteen fields
- Accept button → deterministic confirmed summary built from the RX block, not
  model-rewritten
- Cast dressing held at Moderate/Moderate across consecutive runs (it had
  drifted in four of five runs before)
- Posting rendered as "varus, degrees open" with a 2–4° range offered in prose
- Intrinsic/extrinsic correctly left to the practitioner, with a useful note on
  the trade-off in a boot
- A supplied figure ("2") was used exactly
- Clinical questions rendered as clickable options rather than a table

---

## Still open, beyond the bug above

**Conditions inside summary field values.** Observed:
`Shell modifications: Fascial Accommodation (if arch contact tender — pending
Q2)`. The summary is transcribed onto a lab form; a line requiring
interpretation gets typed wrong. There is a rule against this and it lost.
Likely needs the same treatment as the figures — strip parenthetical conditions
from field values in code rather than asking.

**Invented indications.** A met pad has appeared twice with no forefoot
complaint anywhere in the notes, reasoned in one case from a heel lift that was
itself invented. Harder to address structurally than a stray number, since the
item is a legitimate form option; probably a knowledge-base indication check
rather than a parser rule.

**Prompt rules keep losing.** Six of the last ten fixes had to be moved into
code after the prompt version failed on the next run. The working assumption
should now be that anything safety-relevant belongs in `prescriptionState.ts`,
not `consultation_workflow.md`.

**Cost.** A full build ran 40–47 cents before the propose-first flow and about
20 cents after. History caching, prompt caching and stale-RX-block stripping are
all in place in `api/chat.ts`.

**Not yet merged to `main`.** The rebuild has only ever run on the preview.

---

## Ideas discussed, not started

**Precedent.** The practitioner's own suggestion, and the better long-term
answer to consistency than temperature: same patient returns and gets their own
build back; similar presentations stay close to what that clinic has accepted
before. Two cautions raised — it must learn from *accepted* builds and
practitioner *edits*, never from LEOPA's own proposals, or it trains on itself;
and records currently live in browser localStorage per device, so there is no
durable history to learn from until that changes.

**Insurance form filling.** Clinics send prescriptions to insurers on their own
forms, which differ per clinic. Documents currently outputs text on a blank
background. Fillable PDFs and Word templates are straightforward (named fields,
one-time mapping per clinic); flat scans need OCR and coordinate placement and
are error-prone, with checkboxes the worst case.

---

## Working practices that matter here

- Verify byte counts before copying files — picking "newest by timestamp" from
  Downloads has grabbed a stale file more than once.
- `npm test` and `npm run build` before every push.
- Check the **Vercel build log**, not just the local build, after touching
  `api/` imports.
- When a reply fails, get the runtime log before theorising. A `400
  invalid_request_error` that looked like a code fault turned out to be **zero
  account credits**.
