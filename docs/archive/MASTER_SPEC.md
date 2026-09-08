# MASTER SPEC — Orthotic Prescription Assistant
### Standing instructions for Codex. Read this at the start of every session. Do not deviate from it without an explicit instruction in a task block.

## 1. What this project is
A web chat application where clinicians who prescribe custom foot orthoses (pedorthists, chiropodists, podiatrists, physicians) consult an AI assistant that behaves like an experienced orthotic lab technician. The assistant helps translate a clinician-identified problem into device modifications. It does not diagnose.

## 2. Stack (fixed — do not substitute)
- Frontend: Vite + React 18 + TypeScript (strict mode)
- Styling: plain CSS modules or a single global stylesheet. No Tailwind, no UI component libraries unless a task block says so.
- Backend: Vercel serverless functions (directory: `/api`), Node 20, TypeScript
- LLM: Anthropic Messages API, model `claude-sonnet-4-6`, called ONLY from the serverless function
- No server-side database in v1 (patient records use browser localStorage per section 7.4). No auth in v1. No state libraries (React useState/useReducer only).

## 3. Repository structure (create exactly this; add files only where task blocks say)
```
/                     — repo root
  /src                — React app
    /components       — one component per file
    App.tsx
    main.tsx
    styles.css
  /api
    chat.ts           — the ONLY place the Anthropic API is called
  /assets
    system_prompt.md  — provided file. NEVER edit, summarize, reformat, or "improve".
    knowledge_base.md — provided file. NEVER edit, summarize, reformat, or "improve".
  .env.local          — ANTHROPIC_API_KEY=... (never committed)
  .gitignore          — must include .env.local, node_modules, dist
  package.json
  vercel.json         — only if needed
```

## 4. HARD RULES (violating any of these is a failed task)
1. **Domain content is read-only.** `system_prompt.md` and `knowledge_base.md` are finished clinical assets supplied by the owner. Codex loads them as-is at runtime (read file → string). Codex never edits them, never paraphrases them, never generates its own clinical/orthotic content anywhere in the app — including placeholder text, example questions, or mock responses. If placeholder clinical text is needed, use the literal string "SAMPLE RESPONSE" and nothing more.
2. **The Anthropic API key exists only server-side.** It is read from `process.env.ANTHROPIC_API_KEY` inside `/api/chat.ts`. It must never appear in any file under `/src`, never be sent to the browser, never be committed. The frontend talks only to `/api/chat`.
3. **One task block at a time.** Complete only what the current task block asks. Do not refactor other files, do not add features "while you're at it", do not install dependencies not named in the task block.
4. **TypeScript strict, no `any`** unless truly unavoidable, and then commented why.
5. **Git checkpoint per task.** After the acceptance criteria pass, commit with message `Task N: <short description>`. Never commit `.env.local`.
6. **Patient data stays client-side.** Patient records exist only in browser localStorage (section 7.4). The patient display name must never be sent to `/api/chat` or appear in any server-bound payload — only the clinical context fields travel. The serverless function must remain stateless and store nothing.

## 5. Runtime behavior (reference for all tasks)
- Frontend keeps the conversation as an array of `{role: "user" | "assistant", content: string}`.
- On send: POST the full message array to `/api/chat`.
- `/api/chat.ts`: reads both asset files, builds `system` = system_prompt.md with the literal token `{{KNOWLEDGE_BASE}}` replaced by the full contents of knowledge_base.md, then calls the Anthropic Messages API with `{model, max_tokens: 1500, system, messages}`. Returns `{reply: string}` on success, `{error: string}` with proper status codes on failure.
- Errors shown to the user must be generic ("Something went wrong — try again"), never raw API errors.

## 6. Working protocol
- The owner (Pratik) pastes numbered TASK BLOCKS. Each has: objective, files to create/modify, and acceptance criteria.
- If a task block conflicts with this spec, stop and say so instead of guessing.
- If something is ambiguous, choose the simplest interpretation consistent with this spec and note the assumption in one line.

## 7. Application structure (target UI — built across task blocks)

### Layout
- **Left sidebar:** patient list (alphabetical, searchable), a "+ New Patient" button at top, and a pinned "Quick Q&A" entry above the patient list.
- **Main panel:** the chat workspace for whatever is selected (a patient, or Quick Q&A).
- **Header:** app title + the standing notice (wording per section 7.4).

### Patient creation (manual)
"+ New Patient" opens a small form. Fields — all optional except display name:
- Display name / label (free text — clinician's choice; initials encouraged)
- Age, Weight (+ unit), Shoe size, Footwear type, Activity level (free text)
- Notes (free text — e.g., standing assessment findings)
Saving creates a patient file and opens its workspace.

### Per-patient workspace
- Shows the patient's context fields in a compact card at top (editable).
- Below it: one or more consultation threads (a "New consultation" button starts a fresh chat; old threads remain readable). Each thread is an independent conversation with the assistant.
- When a message is sent from a patient workspace, the app automatically prepends the patient's CONTEXT (age, weight, shoe size, footwear, activity, notes — NEVER the display name) to the conversation sent to `/api/chat`, so the clinician doesn't retype it.

### Quick Q&A
- A single ongoing chat with no patient context attached. For general fabrication questions ("when do I use an L-shape cutout?").

### 7.4 Patient data handling (design decision — do not deviate)
- All patient records live ONLY in the browser's localStorage on the clinician's device. No patient data is ever stored server-side, and the serverless function stores nothing.
- The display name is a local label only: it must NEVER be included in any request to `/api/chat` or to Anthropic. Only the clinical context fields travel.
- Header notice text (verbatim): "Fabrication decision support for licensed clinicians. Not diagnostic advice. Patient files are stored only on this device. Use initials or labels rather than full names."
- Provide an "Export / Import data" function (JSON download/upload) so clinicians can back up or move devices.

## 8. Build order (task blocks will follow this sequence)
1. Scaffold + basic chat UI, mocked (TASK BLOCK 1 — unchanged)
2. `/api/chat.ts` serverless function + asset loading + real Anthropic call
3. Wire frontend to backend; conversation history
4. Sidebar + patient creation + localStorage persistence + per-patient threads + Quick Q&A
5. Patient context injection into chat requests
6. Export/import, error states, polish
7. Vercel deployment
Auth, server-side accounts, and multi-device sync are v2 — only via explicit task blocks.

## 9. Definition of done for the whole v1
A deployed Vercel app where a clinician can create patient files (stored locally), hold multi-turn consultations per patient with clinical context auto-attached, use Quick Q&A for general questions, and export/import their data — with the assistant answering from the knowledge base per system_prompt.md and no secrets or patient names ever leaving the device. Auth, logging, and feedback buttons are v2 and arrive only via task blocks.
