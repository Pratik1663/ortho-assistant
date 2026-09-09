# LEOPA — recurring problems

These are the failures that came back repeatedly across two working sessions,
not one-off bugs. Each is listed with what was actually observed, what was
tried, and where it stands. The pattern underneath most of them is the same and
is worth reading first.

---

## The pattern underneath most of this

**Prompt rules do not hold.** A rule is written, deployed, works once, and is
gone by the next run — or it holds for the case it was written for and fails on
the neighbouring one. This happened often enough to stop being a surprise.

Roughly six of the last ten fixes had to be rewritten in code after the prompt
version failed. `api/chat.ts` grew from 27k to 62k across one session, almost
entirely from rules added reactively, and the more rules accumulated the less
reliably any individual one fired. Three separate times a new rule broke
something an older rule had been covering.

The working conclusion: **anything safety-relevant belongs in code, not in the
prompt.** `src/prescriptionState.ts` is where the enforcement lives now.
`assets/consultation_workflow.md` should carry style and approach, not
guarantees.

The restructured build helped by consolidating 25k of rules into 4.6k, but it
did not change the underlying dynamic.

---

## 1. Values invented and presented as decided

The single most persistent problem, in at least five distinct forms:

- Asked for shell family and rigidity together, got "3DP", acknowledged it as
  **"3DP Semi-Rigid"** — inventing a value on a field it had just flagged as open
- Proposed **"heel lift 4mm"**, **"6mm"**, **"5mm bilateral"** with nothing in the
  notes about leg length or equinus
- Proposed **"intrinsic varus 2°"** when the practitioner supplied neither the
  kind nor the degrees
- Added a **Navicular Sweet Spot** after the practitioner answered a clinical
  question about navicular prominence — an answer about the foot treated as an
  order for the device
- Added a **Met Pad** twice with no forefoot complaint anywhere in the notes,
  once reasoning from a heel lift that was itself invented

Why it matters: an invented value reads exactly like a chosen one. The
practitioner has no way to tell which is which, and the reasoning offered
alongside it usually sounds right.

**Status.** Numbers and fabrication choices are now stripped in code
(`sanitisePrescription`, `sanitiseProse`) — a figure survives only if it appears
in something the practitioner typed. This works, and is verified by tests, but
**there is a known hole in the acceptance path** (see the handover brief).
Invented *indications* — the met pad case — are not addressed by this and remain
open.

---

## 2. Omissions that look identical to judgement

Sections were skipped and the summary reported them as decided:

- **Additions never asked about at all**, then reported as "Additions: None"
- **Forefoot posting and heel lifts skipped** — it asked about rearfoot posting
  and treated the section as finished
- **Orthotic width, extra cushioning and skid plate** never raised on one build
  that was nonetheless called complete
- **Heel hole dismissed with a forefoot argument** — grouped with met pads and
  neuroma pads under "no forefoot complaint", when heel hole is a rearfoot mod
  for focal plantar heel pain

Why it matters: silence and consideration produce identical output. The
practitioner cannot tell that thirteen additions were weighed and rejected from
a summary line reading "None".

**Status.** Largely addressed by listing all items explicitly with a read
against each, and structurally by the prescription panel where an untouched
field is visibly blank. The panel is the better fix — it exposes rather than
instructs.

---

## 3. Building a device for a foot with no pathology

A complete left device — flange, sweet spot, heel hole, archfill, heel cushion,
3° varus post, 2mm skive — was built for a foot the charting described as
unremarkable with ten clean single-leg heel raises. It was flagged twice in
passing ("I'll carry that forward", "happy to carry it if that's your read") and
then stated flatly in the summary as though it had always been the plan.

A second full-priced device that nobody wanted is a remake at full cost, and
nothing about it looks wrong in a summary line.

**Status.** Rules added: laterality comes from the presentation, unspecified
means bilateral, an excluded foot is recorded as "not ordered" from the first
reply rather than left blank. The two-column panel makes asymmetry visible at a
glance, which is the more reliable half of the fix.

---

## 4. Option lists silently truncated

Two identical requests returned different heel cup depth lists —
`16/18/20mm` and `9/12/14/16/18/20mm`. Section F.11 confirms six values, so the
short list was the failure.

This is harder to catch than an invented value, because every entry in the short
list is real. Nobody would question it without knowing the form.

The same thing happened with topcover: eight vinyl colours offered as though
they were the whole menu, silently removing every foam and fabric option.

**Status.** Fixed structurally. The client holds the canonical sets and expands
any recognised subset back to the full list; a recognised set is never trimmed.
`scripts/check-form-options.mjs` fails the build if the client lists and Section
F ever diverge.

---

## 5. Deferring instead of deciding

Repeatedly answered a form field with **"confirm with lab"** or
**"None proposed — confirm with the lab"**, then described the prescription as
complete in the same message. Most often on skid plate.

**Status.** Rule added naming the exact phrasings. Held on the most recent runs.
It is a prompt rule, so see the pattern above.

---

## 6. The same case producing different devices

Three runs of an identical presentation produced three materially different
builds: cast dressing Moderate / Moderate-Tight split / Moderate, posting kind
intrinsic / extrinsic / intrinsic, topcover length Full / 3-4 / Full, and three
different additions lists.

The practitioner's concern was exact: the first thing anyone testing the tool
does is run the same case twice, and two different prescriptions ends the
conversation.

The drift concentrated in fields where the form offers several defensible
answers and the presentation does not force one. The fields the presentation
genuinely determined stayed stable across all three runs.

**Status.** Temperature was unset (defaulting to 1.0) and is now 0.2. Defaults
written into the rules for the genuinely open fields — cast dressing Moderate,
topcover length Full Length. Cast dressing has since held across consecutive
runs. Posting kind is no longer chosen at all, which removes it as a source of
drift.

**Better idea, not yet built:** precedent. Same patient returns and gets their
own build back; similar presentations stay close to what that clinic previously
accepted. Two cautions — it must learn only from *accepted* builds and
practitioner *edits*, never from LEOPA's own proposals, or it trains on itself;
and records live in browser localStorage per device, so there is no durable
history to learn from yet.

---

## 7. Overriding the practitioner

The practitioner clicked Add on Archfill, then typed "also add arch fill". LEOPA
objected that Archfill and Arch Cookie were redundant, and left Archfill out of
the build entirely. It appeared under "not ordered" in the summary.

Asked for twice and still missing is the worst outcome this tool can produce,
because the practitioner believes it is on the prescription.

**Status.** Rule added: a choice is an order, not a proposal. It may object
once, then it orders what was asked for. An item the practitioner added can
never appear as not ordered.

---

## 8. Too many questions, then too few

Swung between extremes. Early builds ran to twenty-plus exchanges filling a form
the practitioner then fills again on their own system. After the change to
propose-first, one run asked two questions *before* proposing, then asked
topcover family, colour and thickness as three separate turns — five turns for
something that should have been one proposal plus a correction.

**Status.** Restructured to: one short round of clinical questions about the
foot, then the complete proposal. Form-field questions are forbidden — topcover
colour is one click to change, and asking about it costs more of the
practitioner's time than getting it wrong would. Cost dropped from 40–47 cents
per build to about 20.

---

## 9. Commentary where values belong

Summary field values arrived carrying advice and conditions:

- `Rearfoot posting: 2° varus intrinsic (consider 3° if more collapse noted)`
- `Shell modifications: Fascial Accommodation (if arch contact tender — pending Q2)`

The summary is transcribed onto a lab form. A line requiring interpretation gets
typed wrong.

**Status.** Rule added. **Still recurring** — observed again on a recent run.
Probably needs the same treatment as the invented figures: strip parenthetical
conditions from field values in code rather than asking.

---

## 10. Emphasis never worked reliably

Recommendations were supposed to render bold so the practitioner could scan for
LEOPA's view. This went through four states: not appearing at all, then applied
to every item in a list (which defeats the purpose entirely — if everything is
bold, nothing stands out), then corrected to mark only recommended items, then
absent again on a later run.

Never diagnosed properly. The client-side renderer works; whether the model
emits the markers is the variable.

**Status.** Open.

---

## 11. Interface mechanics leaking into the conversation

- Opened a reply with **"Starting the block now and I'll fill it in as we go"** —
  narrating an internal mechanism the practitioner should never hear about
- Told the practitioner **"the prescription panel may not be loading on your
  end"** — it cannot see their screen and has no basis for that claim
- Emitted `@R` inside an `[[INPUT ...]]` label, mixing two marker formats
- Rendered chips with no labels, leaving a column of identical anonymous buttons

**Status.** Rules added for the first two. The chip labelling was fixed in code
— the field name is in the marker, so it renders regardless of what the model
writes around it.

---

## 12. Questions that presuppose a finding the notes do not contain

Observed on the most recent run. Given a presentation with no mention of heel
pain anywhere, LEOPA asked:

> "Is the heel pain focal (one sharp spot you can press) or diffuse across the
> whole heel?"

Plantar fasciitis with a positive windlass usually does involve insertional heel
pain, so the inference is clinically reasonable. But the notes never said so.
The question treats heel pain as established and asks the practitioner to
characterise it, and once they answer, the assumption has been confirmed by
their own answer rather than by anything they actually reported.

The right shape is two steps: is there insertional heel pain — and only if yes,
is it focal or diffuse.

**Why this one keeps coming back.** It is the same failure as the invented
rigidity level and the invented heel lift, but every guard built so far
addresses the *assertion* form only. The sanitiser strips values LEOPA states
that the practitioner never gave. The question gate blocks *acting* on an
unanswered question. Neither stops it *asking* a question built on an
assumption.

A question is also the perfect disguise for it. Stating "he has focal heel pain"
would look wrong immediately. Asking which kind of heel pain it is looks like
diligence, while carrying the same unfounded premise.

**Suggested framing, if this is addressed with a rule.** State it as a shape
rather than a case, since case-specific rules have not generalised: *before
asking the practitioner to characterise something, check that they told you it
exists.* Characterising questions — focal or diffuse, tender or not, which
interspace, how severe — all presuppose the thing being characterised. If the
notes do not establish it, the first question is whether it is there at all.

**Status.** Open, and recurring. Worth considering whether it can be caught in
code the way the values were, though a question is harder to validate than a
field value.


---

## Infrastructure problems worth knowing

**Zero API credits looked exactly like a code fault.** A `400
invalid_request_error` was chased through a panel rollback and twenty minutes of
debugging before the runtime log revealed the account balance was empty. Always
read the Vercel runtime log before theorising.

**The local build passes while the Vercel build fails.** Vercel compiles `api/`
with `node16` module resolution and needs explicit `.js` extensions on relative
imports. The deployment reported success while the function never compiled, and
every reply came back "The reply was interrupted." Check the Vercel build log
after touching imports in `api/`.

**Stale downloads.** Files arrive as `chat (14).ts`, `files (37).zip`. Selecting
"newest by timestamp" grabbed a previous version at least twice, once
overwriting a good file with an older one. Verify byte counts before copying.

**PowerShell truncates long pasted commands** and leaves the shell at a `>>`
continuation prompt. Ctrl+C, then run in shorter pieces.

**An API key was found sitting in `.env.local` on the Desktop.** Not in git
history, but worth a periodic check that keys are not loose in working folders.
