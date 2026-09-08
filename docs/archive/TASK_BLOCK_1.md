# TASK BLOCK 1 — Scaffold + Chat UI (mocked)

Read MASTER_SPEC.md first. This task builds the app shell with a fake response. No API calls, no secrets, no assets loaded yet.

## Objective
A running local app with a clean chat interface: the user types a message, it appears in the conversation, and a mocked assistant reply appears after a short delay.

## Steps
1. Scaffold: `npm create vite@latest` → React + TypeScript, in the repo root per MASTER_SPEC structure. Enable strict mode in tsconfig. Create the `/assets` and `/api` directories now (empty placeholder file in `/api` is fine, e.g. `.gitkeep`).
2. Initialize git. Create `.gitignore` per spec section 3.
3. Build the chat UI in `/src`:
   - `App.tsx` — holds `messages` state: `{role: "user" | "assistant", content: string}[]`, and a `pending` boolean.
   - `components/MessageList.tsx` — renders the conversation. User messages right-aligned, assistant messages left-aligned, visually distinct (background color difference is enough). Auto-scroll to the newest message.
   - `components/Composer.tsx` — textarea + Send button. Enter sends, Shift+Enter makes a newline. Disabled while `pending` is true. Empty/whitespace-only messages are not sent.
   - `components/Header.tsx` — app title "Orthotic Prescription Assistant" and directly under it, in smaller muted text, this exact notice (verbatim, do not reword):
     "Fabrication decision support for licensed clinicians. Not diagnostic advice. Do not enter patient names or identifiers."
4. Mock behavior: on send, append the user message, set `pending`, and after 600ms append an assistant message with the literal content `SAMPLE RESPONSE`. (Per spec rule 4.1: no invented clinical text anywhere.)
5. While `pending`, show a simple "thinking" indicator in the message list (three dots or the word "…").
6. Styling in `styles.css`: neutral, professional, readable. Max content width ~800px centered, comfortable font size (16px+), adequate spacing. No component libraries.

## Acceptance criteria
- [ ] `npm run dev` starts with zero TypeScript errors and zero console errors
- [ ] Typing a message and pressing Enter shows it in the thread; `SAMPLE RESPONSE` appears ~600ms later
- [ ] Shift+Enter inserts a newline instead of sending
- [ ] Send is blocked while pending and for empty input
- [ ] The header notice text matches the spec string exactly
- [ ] The literal string `SAMPLE RESPONSE` is the only assistant text anywhere in the code
- [ ] `git log` shows one commit: `Task 1: scaffold and chat UI with mocked response`

## Out of scope for this task
API route, asset files, Anthropic integration, deployment, auth, conversation persistence. Do not touch these.
