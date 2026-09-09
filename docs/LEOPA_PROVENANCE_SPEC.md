# LEOPA — provenance layer

A design for the underlying problem, rather than another patch for one of its
symptoms.

---

## The problem, stated once

Every recurring failure in this project is the same act performed on a different
surface. LEOPA fills a gap in what the practitioner told it with something
clinically plausible, and then treats that thing as established.

The list, all of which have been observed live:

| What was invented | How it surfaced |
|---|---|
| Rigidity level | "3DP" answered → acknowledged as "3DP Semi-Rigid" |
| Heel lift height | "4mm", "6mm", "5mm bilateral", with nothing about equinus in the notes |
| Posting kind and degrees | "Intrinsic varus 2°" with neither supplied |
| A modification | Navicular Sweet Spot added after a clinical question was answered |
| An indication | Met Pad twice, with no forefoot complaint anywhere in the notes |
| A symptom | "Is the heel pain focal or diffuse?" — heel pain never mentioned |

Each has been fixed separately. The sanitiser handles invented values. The
acceptance gate handles acting on unanswered questions. Neither touches invented
*indications*, and neither touches questions built on assumed findings — so
those two are still open, and something adjacent will surface next.

The fixes that held were the ones written in code. The fixes written as prompt
rules were lost, usually within one or two runs. That should be taken as
settled: **prompt wording cannot carry a guarantee.**

---

## What the fix is

LEOPA declares what it believes and where each belief came from. The client
verifies the declaration and refuses to let an unverified belief become an
order.

Three rules, all enforceable in code:

1. **A finding claimed as stated must actually appear in a practitioner turn.**
   If it cannot be found, it is demoted to inferred rather than trusted.
2. **An inferred finding cannot justify an order.** A modification whose
   indication rests only on inference may be *offered*, with its reasoning, but
   it does not enter the build until the practitioner confirms the finding.
3. **A characterising question requires its subject to be stated.** "Focal or
   diffuse" presupposes heel pain. If heel pain is not in the stated set, the
   only permitted question is whether it exists.

None of these judge clinical correctness. They verify provenance. LEOPA can
still propose a wrong device; it cannot propose one built on something nobody
said.

---

## Mechanism

### The findings block

Alongside the existing `[[RX ...]]` block, LEOPA emits a findings block. Same
handling: stripped from the visible reply, parsed by the client, never mentioned
in prose.

```
[[FINDINGS
insertional_heel_pain = stated | "heel pain first thing in the morning"
windlass_positive = stated | "windlass test positive bilaterally"
pronation = inferred | windlass-positive with fascial loading pattern
equinus = unknown
forefoot_overload = unknown
]]
```

Three states, and the distinction between the second and third matters:

- **stated** — the practitioner said it. The quoted fragment is the evidence.
- **inferred** — LEOPA concluded it. Legitimate reasoning, not established fact.
- **unknown** — no basis either way. Distinct from inferred: unknown means
  nothing has been concluded, inferred means something has been concluded
  without confirmation.

The vocabulary of finding keys is fixed, defined in one place alongside the form
fields. An unrecognised key fails closed, exactly as unknown RX keys already do.

### Verification

`verifyFindings(findings, messages)` runs on every parse:

- For each `stated` finding, search the practitioner's turns for the quoted
  evidence. Not found, or the quote does not appear verbatim in a user turn →
  demote to `inferred`.
- Findings the practitioner confirms by answering a chip question are promoted
  to `stated`, with the answer as evidence.

This is the same technique as `practitionerFigures` in the existing sanitiser —
the one fix that has held without exception. It works because it checks the
conversation rather than trusting the model's account of the conversation.

### Indications

Each shell modification and addition declares which findings justify it. This
belongs in the knowledge base next to the item, since it is clinical content
rather than behaviour:

```
### Met Pad
Indicated by: forefoot_overload | met_head_pain | plantar_plate_stress
```

At parse time, any modification in the RX block whose indications are not
satisfied by at least one `stated` finding is moved out of the build and into a
proposed set. It still appears — with its reasoning and the finding it would
need — but as something to accept, not something ordered.

The met pad case becomes impossible: `forefoot_overload` is `unknown`, so the
met pad cannot be in the build. It can be offered, which is the right outcome,
because sometimes it genuinely is worth raising.

### Questions

Characterising questions declare their subject:

```
[[OPTIONS Heel pain character | requires: insertional_heel_pain: Focal | Diffuse]]
```

If the required finding is not `stated`, the client suppresses the question and
shows the prerequisite instead — "Is there insertional heel pain?" — as a
two-option chip. Answer yes and the characterising question appears.

This is the piece that most needs to be in code rather than prompt. A question
carrying a false premise reads as diligence, which is why it has survived every
rule written against it.

---

## What the practitioner sees

The prescription panel gains a findings section above the sixteen fields:

```
Findings
  Insertional heel pain      stated
  Windlass positive          stated
  Pronation                  inferred — not confirmed
  Equinus                    not established

Proposed, pending a finding
  Met Pad          would need: forefoot overload      [Add anyway]
```

Two things this gives that no amount of prose can. The practitioner can see at a
glance what LEOPA is treating as true, and can correct a wrong inference before
it shapes the build. And anything resting on an inference is visibly separate
from the build rather than sitting inside it looking settled.

**Add anyway** is deliberate. The practitioner can always override — they may
know something they did not write down. The point is that overriding is a
decision they make, not a default they fail to notice.

---

## Build order

Each step is independently useful and independently testable. Do not do them all
at once.

**1. Findings block, parsed and displayed, changing nothing.** LEOPA emits it,
the panel shows it, nothing is gated. This alone surfaces how often findings are
inferred rather than stated, which is worth knowing before anything is built on
top of it.

**2. Verification.** Demote unfounded `stated` claims to `inferred`. Still no
gating. Watch how often demotion fires — if it fires constantly, the evidence
format needs work before it can gate anything.

**3. Indications, and the proposed set.** Modifications without a stated
indication move out of the build. This is the step that fixes the met pad.

**4. Question prerequisites.** This is the step that fixes the heel pain
question, and the one most likely to need iteration on the marker format.

Stop after any step that proves troublesome. Steps 1 and 2 have value on their
own.

---

## Tests to write alongside

Following the pattern of the existing suite, which has been the most reliable
part of this project:

- A `stated` finding with no matching practitioner turn is demoted
- A finding confirmed by a chip answer is promoted, with the answer as evidence
- A modification whose indications are unmet does not appear in the RX build
- The same modification does appear in the proposed set, with its missing finding
- A characterising question whose subject is not stated is suppressed
- The prerequisite question appears in its place
- Accepting with items in the proposed set does not silently include them
- **Add anyway** moves an item into the build and records the override
- An unrecognised finding key fails closed
- Existing acceptance and sanitisation behaviour is unchanged throughout

---

## What this does not do

It verifies provenance, not clinical correctness. It cannot tell you a
semi-rigid shell is the right call, or that 16mm is a sensible heel cup depth
for this patient. It tells you that nothing in the build rests on something
nobody said.

That is a smaller claim than it might appear, and it is the right one. The
practitioner brings the clinical judgement. What they cannot do is audit twenty
paragraphs of plausible prose for the one sentence that was invented — and that
is the job this does.

---

## Cost and honest risk

A session or two. It touches the prompt format, the parser, the panel, and the
knowledge base indications.

The main risk is the findings block being emitted unreliably, the same way the
RX block was dropped mid-conversation until its instruction was moved to the end
of the prompt. Mitigation: build step 1 first and watch it before relying on it.

The second risk is friction. If too many modifications land in the proposed set,
the practitioner starts clicking **Add anyway** without reading, and the
safeguard becomes a formality. Watch the rate. If it is high, the indications in
the knowledge base are too strict rather than the practitioner being careless.
