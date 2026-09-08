# Developer handover — 8 September 2026

## Product decision

LEOPA should suggest a complete prescription based on approved charting or a focused practitioner Q&A. Questions gather essential clinical information, not every form selection. The practitioner is the final prescriber. Proposals and accepted prescriptions must be distinct. No diagnoses or inferred clinical assessments should be generated.

## Implemented changes

- Replaced the competing consultation rule blocks with `assets/consultation_workflow.md`. Replaced the long, conflicting shared prompt with a short scope/behaviour prompt. Historical prompts are archived, not loaded.
- Kept the supplied clinical knowledge base and option catalog. Updated only the F.9 explanatory prose to match the agreed rigidity-level-first behaviour; the underlying product table is unchanged.
- Added a local whole-prescription acceptance action. It records a user acceptance message and a deterministic assistant summary containing the exact accepted RX block. No model call is made for acceptance.
- Derive current confirmation by comparing that summary to the exact previous snapshot. A model saying “confirmed,” silence, or a single field change is insufficient. Subsequent conversation messages invalidate confirmation. Older history remains visible, but incomplete or failed replies do not leave an old panel presented as current.
- Require complete structural RX snapshots: all sixteen fields must cover both sides, with no duplicate keys/sides, unknown keys, or multiple blocks. Open values may display but cannot be accepted. Fully empty/no-device snapshots cannot be accepted.
- Fixed canonical validation that previously allowed `116mm` because it contained `16mm`. Preserve supported fabrication prefixes and canonical Premium shell products.
- Fixed the editor's mismatch: a row labelled Both feet now applies to both feet, including when values differ. Cell edits remain side-specific. Added Enter/Space handling to the existing interactive row/cell controls.
- Consultation output budget is now 3,200 tokens instead of 900. This is a ceiling, not a target. Actual cost must be measured in live tests; old cost figures are not a forecast for this revision.
- Switched consultation streaming to newline-delimited JSON: `delta`, `complete`, or `error`. A clean transport EOF alone is not success. The handler checks model stop reason and RX completeness before emitting `complete`. The client discards a failed partial reply and shows a retry message, preventing acceptance of interrupted output.
- SOAP instructions/schema no longer permit AI-inferred assessment. Unknown/legacy inference provenance is discarded server-side. Diagnosis still relies on the supplied-source-only model instruction and practitioner review; this is not deterministic clinical source verification.
- SOAP generation from an RX-bearing history requires acceptance, and its prescription field is copied directly from the accepted snapshot. Other SOAP prose remains model-generated and needs practitioner review.
- New consultation exchanges clear old SOAP/documents. Charting edits withdraw downstream approval; edits to charting used by a confirmed prescription add a review-required message.
- Added API type checking to the build, a test runner using the existing TypeScript dependency, and `@types/node` for the server check. Added explicit Vercel asset inclusion for the runtime-read prompts.

## Protocol and deployment notes

Deploy frontend and backend together: the consultation stream wire format changed. Existing clients expecting plain text are not compatible with the new NDJSON response. SOAP, charting, template and document responses remain JSON with a `reply` field.

The app remains React/Vite with a Vercel-style Node serverless endpoint. No hosting migration, repository push, or deployment has been performed. `vercel.json` includes the runtime assets; verify it in a preview deployment before production. The included local Vite adapter now serves `/api/chat` for both development and built preview. `npm run build` produces `dist/` and `dist-server/`; `npm start` loads the latter handler. See START-HERE.txt. No secret credentials, vendor dependencies, generated build output, Git history, or local deployment metadata are included in the ZIP.

Authentication remains the existing browser-local account selection. This package does not add a database or authentication service, and the acceptance transcript can be edited by someone controlling that browser's data. Do not treat it as a tamper-resistant audit record.

Existing local data can still load, but historical conversations do not gain acceptance automatically. An old partial RX block may fail the stricter parser. Request a refreshed full proposal and accept it. Historical SOAP and documents are not retroactively revalidated or deleted on import; review them before reuse.

## Verification performed

- `npm test`: 16 tests passed. Includes complete/partial/malformed snapshots, side splits, canonical values, acceptance integrity, stale-state prevention, bold rendering, panel status, NDJSON framing and early EOF, mocked handler failure modes, SOAP acceptance and inference rejection.
- `npm run build`: five form-list checks, frontend TypeScript, server TypeScript and Vite production bundling passed.
- Tests use synthetic device values and a stubbed Anthropic SDK. They do not prove live model adherence or clinical appropriateness.
- No live-model testing, browser click-through, Vercel deployment, or multi-user data testing was performed. Complete `QA_CASES.md` with synthetic cases before release.

## Remaining backlog

1. Server-side authentication and clinic authorization, durable storage, backup/restore and migration from localStorage; rate/usage limits for the paid API.
2. Live model evaluation of full proposals, non-invented measurements, preserved practitioner choices, complaint-specific reasoning and prompt-injection handling. The supplied knowledge base is not clinically validated by this code update.
3. Source-grounded validation for assessment/diagnosis and a richer structured prescription schema for free-text posting, topcovers and modifications. The current panel validates only closed sets. Global acceptance does not assign per-field provenance badges.
4. Insurance forms: uploads currently transcribe PDF templates to text. They do not fill the original PDF layout or a DOCX template. Build against real clinic-supplied example forms and reusable mappings.
5. Knowledge base sections with `[LAB INPUT]` still need lab-approved content; do not fill these gaps from assumptions.
6. CSS consolidation after UI regression coverage. Existing cascade ordering was preserved to avoid unverified visual changes; the folder is cleaned, but historical styling debt is not claimed resolved.
7. Secure, versioned acceptance records and reliable downstream invalidation across patient demographics, imported backups, multiple tabs, and multi-user edits. The current implementation handles the consultation and charting paths changed in this handoff; it is not a complete server workflow engine.

## Packaging

The original upload remains untouched. Source was copied into a clean delivery folder. Excluded `.git`, `node_modules`, `dist`, `dist-server`, backup files and transient compiler/test output. Retained original specs and the Claude handover under `docs/archive/`, clearly marked historical. Start with the root README, not the archived task blocks.

## Local-runner follow-up

Added a loopback-only local adapter, Node/npm Windows launcher, and setup notes so the source package can be run without a Vercel account. Development uses Vite SSR loading of the existing handler; built preview imports the server bundle generated by `npm run build`. Both use the same domain prompts and validation code. `.env.local` is read server-side; credentials are not embedded into frontend assets. The Vercel deployment handler is unchanged. Local HTTP checks cover the built and development runners without making paid model calls. A live API key was not used.

Validation of the local runner: both `npm start` and `npm run dev` served the UI and loaded the API handler. Invalid JSON, missing API-key and cross-origin responses were checked over local HTTP. The Windows batch launcher was reviewed but was not executed on Windows; its underlying npm commands were tested here.
