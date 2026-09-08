# LEOPA — developer handoff

LEOPA is a prescribing assistant for qualified practitioners. It suggests an orthotic prescription from approved charting or a focused Q&A. The practitioner reviews and accepts the device; LEOPA does not diagnose or act as the final prescriber.

This is the cleaned source package prepared on 8 September 2026 from the supplied `ortho-project.7z`. It is a development handoff, not a newly deployed release. Start with this README and `docs/DEVELOPER_HANDOVER.md`. Files in `docs/archive/` are historical context only and are not current specifications.

## Setup and run locally

Start with `START-HERE.txt`. On Windows, extract the ZIP, add your API key as described below, then double-click `START-LEOPA.cmd`. The launcher installs the locked dependencies, builds the frontend and local server handler, and starts the built app.

Use Node.js 22 or newer and npm. From the folder containing `package.json`:

```sh
npm ci
npm run build
npm start
```

Open http://127.0.0.1:4173 and keep the terminal open. Stop with Ctrl+C. For development with automatic reload, use `npm run dev` and open http://127.0.0.1:5173. Both modes include the local `/api/chat` runner; a Vercel account is not needed. The ports have separate browser storage, so use a consistent URL.

Copy `.env.example` to `.env.local`, add `ANTHROPIC_API_KEY=your_actual_key`, and restart the server. Do not use a `VITE_` variable or commit credentials. An active Anthropic account with credits is required for live replies. No key is supplied in this package. Without a key you can open the interface, but AI replies are unavailable.

`npm test` runs the deterministic regressions. The local runner listens on loopback and is intended for testing, not production clinic hosting. The existing Vercel endpoint remains available for developer-managed deployments.

The backend continues to use the existing `claude-sonnet-4-6` model. The development handoff to Codex does not change the app's AI provider.

## Current workflow

1. Supply approved charting, or describe the presentation in Ask LEOPA.
2. LEOPA asks a few clinically relevant questions only if needed and proposes the complete prescription.
3. The panel labels the build **Suggested prescription**. Change either foot or both; suggestions remain under review.
4. Click **Accept prescription** after resolving open or flagged fields. Acceptance saves the exact current snapshot in the conversation and immediately generates a complete summary, without a model call.
5. Generate and review SOAP notes, then prepare documents. The accepted prescription is copied into the SOAP prescription field directly.
6. A later consultation message reopens review and clears downstream SOAP/documents. Editing charting also invalidates downstream review.

Plain text confirmation does not silently approve the build; the dedicated acceptance action is the reliable route. This is whole-prescription acceptance, not a per-field approval system. Explicit field edits remain in the conversation record.

Charting-only SOAP remains available when no consultation has been started. Once a consultation is started, accept its prescription before generating SOAP from that conversation.

## Project map

| Location | Responsibility |
| --- | --- |
| `src/App.tsx` | Patient/workflow state, requests, local acceptance and downstream invalidation |
| `src/components/DoctorView.tsx` | Practitioner workspace and review controls |
| `src/components/PrescriptionPanel.tsx` | Left/right review, edits and acceptance |
| `src/prescriptionState.ts` | Snapshot parsing, canonical validation, summary and acceptance checks |
| `src/chatStream.ts` | Framed streaming reader; requires successful completion |
| `src/formOptions.ts` | Canonical menus and response marker parsing |
| `scripts/local-api.ts` | Local adapter for the existing endpoint in development and built preview |
| `api/chat.ts` | Anthropic handler, cache handling, stream validation, SOAP/documents |
| `assets/system_prompt.md` | Concise shared identity and behaviour |
| `assets/consultation_workflow.md` | Current propose-first workflow |
| `assets/knowledge_base.md` | Lab options and supplied domain knowledge |
| `tests/regression.test.cjs` | Deterministic regression and mocked-handler tests |
| `docs/QA_CASES.md` | Live-model and UI acceptance cases for developers |

## Validation and remaining work

The source passed 16 automated regression tests, the five form-option consistency checks, frontend and API TypeScript checks, and the Vite production build. Model calls in tests are mocked. No live Anthropic consultation, browser interaction session, or new deployment was performed.

Before clinic production, implement server-side authentication/authorization, durable clinic-isolated storage, and API usage controls. Existing accounts and records are browser-local; acceptance is a local workflow record, not a secure server audit trail. See the handover for the remaining backlog and migration concerns.
