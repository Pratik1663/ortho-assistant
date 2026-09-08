# LEOPA — Session handover, 8 September 2026

Covers two working sessions: 4 September (clickable options) and 8 September
(prescription panel, cost work, and the change from interviewing to proposing).

---

## Where things stand

The Ask LEOPA consultation is now a **propose-first** flow. The practitioner
pastes a presentation or approves charting, LEOPA asks at most a few clinical
questions, then proposes the complete prescription in one reply. The
practitioner corrects what they disagree with, and the final summary is written
to be transcribed onto whatever form the clinic uses.

A **prescription panel** sits above the conversation showing every form field
for both feet, filling in as the build progresses.

Latest commit at time of writing: `9f23f61`. Deployed to
`ortho-blue.vercel.app` from `Pratik1663/ortho-assistant`.

---

## What was built

### Clickable options (4 September)

Markers in LEOPA's replies become interactive controls. The client strips them
from the visible text.

- `[[OPTIONS Field: A | B | C]]` renders chips under that question.
- `[[INPUT Field: unit]]` renders a small box beside it for a typed value.
- `[[RX ... ]]` carries the whole prescription state and drives the panel.

Answers stage as removable pills above the composer. Clicking a different
option for the same field replaces the pill rather than adding a second;
clicking the same one twice un-answers it. A reply asking exactly one question
auto-sends 1.2 seconds after the answer, with a cancellable strip replacing the
composer — click anywhere on it or press Escape to stop it. Multi-question
replies wait for Send.

`src/formOptions.ts` holds the canonical option sets and the marker parser.

### Canonical expansion

If LEOPA emits a subset of a known set, the client renders the full set. This
exists because of an observed bug: two identical requests returned `16/18/20mm`
and `9/12/14/16/18/20mm` for heel cup depth. A truncated subset is harder to
catch than an invented value, because every entry in it is real. Recognised sets
are never trimmed; unrecognised lists cap at eight.

### The prescription panel

`src/prescriptionState.ts` and `src/components/PrescriptionPanel.tsx`.

Two columns, left foot and right, sixteen fields in form order. Collapsed by
default with the counts in the header (`Prescription · 7 of 16 · L 0 · R 7`), so
asymmetry is visible without expanding it. Two columns rather than one list
because a left column filling up on a foot described as unremarkable is obvious
here and nearly invisible in prose.

Three states, and the difference between them is the point:

- **Set** — the value, in the form's own words.
- **Not ordered** — grey italic. Decided against.
- **Open** — genuinely blank. Nothing to read means nothing decided.

Values are validated against the form's own lists. Anything not on the form
renders red with a `!` marker and a tooltip; the header shows "2 to check".
Only fields with a single closed set are checked — posting, skives, topcover and
the list fields hold free text by design.

Rows and cells are clickable. Clicking a **row** changes the field (both feet
when they match); clicking a **cell** changes that foot alone, which is how a
matched pair comes apart. The open editor shows a badge reading Left foot, Right
foot or Both feet. Edits are sent as ordinary messages, so the conversation
stays the record.

LEOPA restates all sixteen fields every turn rather than sending changes. One
missed update in a diff model and the panel is quietly wrong, which is worse
than not having it.

### Orthotic style (knowledge base F.0)

The device style page was finally supplied and transcribed. Ten styles with
their shell, topcover, underlay and extras. Things not visible on the page that
Pratik confirmed:

- **Underlay means bottom cover.** Vinyl is each style's default, not a
  restriction — any of the five bottom covers can replace it.
- **Poly Pro is likewise a default**, overridable like anything else.
- **The Sport Performance heel post is neutral** — a base to work from.
- A style is a **starting point, not a package**. Everything it brings can be
  changed or removed.

This unblocked UCBL and Gait Plate.

### Cost work

A full build ran 40–47 cents before, and **20 cents** after the propose-first
change. Three changes contributed:

- **Conversation history is cached.** A breakpoint sits one turn back, so
  everything before the newest exchange is read at a fraction of the input
  price. One turn back rather than on the last, because the final turn changes
  every request and would never be reused. Below six messages it does nothing.
- **System blocks reordered.** The workflow rules were sitting after the varying
  blocks, outside the cached prefix, and being paid for in full every turn.
  They now sit with the knowledge base and the breakpoint comes after them.
- **Stale `[[RX]]` blocks stripped from history.** Measured at ~1,150 tokens per
  request on a twelve-turn build.

The propose-first flow did the most, by cutting turn count — history is resent
every turn, so twenty exchanges meant paying for the history twenty times.

Cache entries expire after five minutes, so an interrupted clinic session costs
more than a straight-through test run.

### Build-time form check

`scripts/check-form-options.mjs`, wired into `npm run build`. Reads the option
lists out of knowledge base Section F and compares them to the exported
constants in `formOptions.ts`. Five lists checked. Any divergence names the
exact value and fails the build.

A check rather than generation: generating would mean reshaping Section F into
something machine-readable, and that prose is written for LEOPA to read.

Verified both ways — passes on the real files, and catches a deleted `9mm`.

---

## Rules that exist because something went wrong

Each of these was added after observing the failure. They live in
`buildWorkflowBlock` in `api/chat.ts`, scoped to the consultation action so they
cannot leak into SOAP, documents or charting.

- **A choice is an order, not a proposal.** LEOPA objected to Archfill and Arch
  Cookie together, the practitioner asked twice, and it left Archfill out of the
  build entirely. It may now say its piece once and must then order what was
  asked for. An item the practitioner added can never appear as not ordered.
- **An answer about the foot is not an order for the device.** Asked whether the
  navicular was prominent, got "prominent", and added a Navicular Sweet Spot
  nobody selected. Clinical answers inform what is offered; they never place the
  order.
- **Only what they actually said.** Asked for shell family and rigidity
  together, got "3DP", and acknowledged it as "3DP Semi-Rigid" — inventing a
  value on a field it had just flagged as open.
- **Rigidity is a level, not a material.** Poly and 3DP are how the lab makes the
  shell, not a clinical choice. Propose the level only. EVA and the Premium
  carbons are different — those are materials that behave differently, worth
  raising when the presentation calls for one.
- **Laterality comes from the presentation.** A complete left device was built
  on a foot with ten clean single-leg heel raises. Unspecified means bilateral;
  what makes a build unilateral is being told so. An excluded foot is recorded
  as `none` across every field from the first reply, so the panel shows a grey
  column rather than blanks.
- **Zero means different things.** `0°` rearfoot post is a real neutral post and
  orderable. `0mm` skive is no skive, and is written as "none" in summaries so a
  number does not invite the lab to build one.
- **No diagnosing the interface.** LEOPA told the practitioner the panel "may
  not be loading on your end". It cannot see their screen.
- **Never mention the `[[RX]]` block.** It once opened with "Starting the block
  now and I'll fill it in as we go."

---

## Open items

**Emphasis is not working.** Recommendations should render bold — the rule sits
in its own top-level section and the client renders `**bold**` via a minimal
parser in `MessageList.tsx`. It worked once, over-applied (all thirteen items
bold, which defeats the purpose), was corrected to mark only recommended items,
and in the most recent run showed nothing at all. Needs diagnosis rather than
another rule.

**Form questions still leak.** The rule is: ask about the foot, never about the
form. The last run still asked "Puff or Poron, which material do you want?" — a
field it should have proposed.

**Verify the summary fix.** `9f23f61` requires the summary to be written the
moment nothing is outstanding, rather than answering "Noted." and waiting. Not
yet tested.

**The prompt is carrying work that code should do.** `api/chat.ts` grew from
27k to 62k across these sessions, roughly eighteen rule blocks, all added
reactively. Rules compete — three times a new rule broke something an older one
covered. Consolidation is needed, but needs a test suite first or there is no
way to tell whether the rewrite broke anything.

**No test suite.** `LEOPA_TEST_SUITE.md` is from August and meaningless now.
Around twenty commits verified entirely by reading transcripts. A regression is
currently indistinguishable from a bad day.

**`styles.css` has eleven appended blocks.** `.option-chips` is defined three
times, `.rx-panel` twice. Works because later rules win; hard to reason about.

**localStorage is still the only persistence.** One cleared browser and a
clinic's records are gone.

---

## The insurance form filler (scoped, not started)

Clinics send prescriptions to insurers on **their own forms**, which differ per
clinic. LEOPA's Documents stage currently outputs text on a blank background.
The ask is for it to fill the clinic's actual form.

There is an upload section in the app already; unclear what happens after
upload.

Three file types, three approaches:

- **Fillable PDF** — named fields. Read them, map to LEOPA's values, populate.
  Reliable.
- **Word template** — placeholders replaced. Easy.
- **Flat PDF or scan** — an image of paper. Needs OCR to find labels, then
  coordinate placement. Error-prone, and checkboxes are the worst case: a tick
  one row off changes the meaning while looking correctly filled.

Recommended approach: a **one-time mapping per clinic**, roughly twenty minutes
of setup, reusable forever. For scans, show the filled form for correction once
and save that correction as the mapping. Worth checking first whether clinics
have the original digital file, since that removes the problem entirely.

Needs one real form of each type to build against.

---

## Working practices

- One change deployed and tested before the next begins.
- `.bak` before every overwrite; byte counts verified before every copy.
- `npm run build` before pushing; the form check now runs as part of it.
- Vercel function logs checked before any diagnosis. A `400
  invalid_request_error` that looked like a panel crash turned out to be **zero
  account credits** — check the balance before debugging.
- Downloads land as `chat (N).ts`. Picking "newest by timestamp" has twice
  grabbed a stale file; the copy commands now verify the byte count before
  overwriting.
- Long PowerShell commands get truncated on paste and leave the shell at `>>`.
  Ctrl+C, then run it in shorter pieces.

---

## Files

| Path | What it is |
|---|---|
| `api/chat.ts` | Serverless handler; all behaviour rules in `buildWorkflowBlock` |
| `assets/knowledge_base.md` | The form and the clinical reasoning; runtime-read |
| `src/formOptions.ts` | Canonical option sets and marker parser |
| `src/prescriptionState.ts` | Prescription fields, `[[RX]]` parser, validation |
| `src/components/PrescriptionPanel.tsx` | Two-column panel |
| `src/components/MessageList.tsx` | Renders chips, inline inputs, bold |
| `src/components/Composer.tsx` | Staged answer pills, auto-send strip |
| `src/components/DoctorView.tsx` | Wires the above together |
| `scripts/check-form-options.mjs` | Build-time form/code consistency check |
| `src/styles.css` | All styling; eleven appended blocks, needs consolidation |
