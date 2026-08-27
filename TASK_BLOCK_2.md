# TASK BLOCK 2 — Real API integration (/api/chat)

Read MASTER_SPEC.md first if not already loaded this session. This task builds the serverless function that actually talks to Claude, using the real system prompt and knowledge base. No frontend wiring yet — that's Task 3.

## Objective
A working `/api/chat` endpoint that: accepts a message history, loads system_prompt.md and knowledge_base.md from `/assets`, substitutes the knowledge base into the `{{KNOWLEDGE_BASE}}` token, calls the real Anthropic API, and returns the reply. Testable directly (via curl or a REST client) without the UI.

## Steps
1. Move (do not copy-and-leave-duplicates) `system_prompt.md` and `knowledge_base.md` from the repo root into `/assets/` per the MASTER_SPEC structure, if they are not already there.
2. Install the Anthropic SDK: `npm install @anthropic-ai/sdk`
3. Create `.env.local` in the repo root with a placeholder line:
   ```
   ANTHROPIC_API_KEY=
   ```
   Leave the value empty — the owner will fill it in manually outside of Codex. Confirm `.env.local` is listed in `.gitignore`; add it if missing.
4. Create `/api/chat.ts` as a Vercel serverless function (Node runtime):
   - Reads `ANTHROPIC_API_KEY` from `process.env`. If missing, return HTTP 500 with `{error: "Server not configured"}` — do not throw an unhandled error.
   - Accepts POST only. Request body: `{messages: {role: "user"|"assistant", content: string}[]}`. Reject anything else with HTTP 400.
   - Reads `/assets/system_prompt.md` and `/assets/knowledge_base.md` from disk at request time (fs.readFileSync is fine for v1 — no caching optimization needed yet).
   - Builds the final system string: system_prompt.md content with the literal substring `{{KNOWLEDGE_BASE}}` replaced by the full knowledge_base.md content.
   - Calls the Anthropic Messages API: model `claude-sonnet-4-6`, `max_tokens: 1500`, the built `system` string, and the passed-through `messages` array.
   - On success: HTTP 200, `{reply: <the text content of the model's response>}`.
   - On any Anthropic API error: log the real error server-side (console.error), but return HTTP 502 with the generic `{error: "Something went wrong — try again"}` to the caller. Never leak the raw error, stack trace, or API key in the response body.
5. Do not touch `/src` in this task. Do not wire the frontend to this endpoint yet — that is Task 3.

## Acceptance criteria
- [ ] `@anthropic-ai/sdk` is in package.json dependencies
- [ ] `.env.local` exists with an empty `ANTHROPIC_API_KEY=` line and is git-ignored
- [ ] `/assets/system_prompt.md` and `/assets/knowledge_base.md` exist (moved, not duplicated elsewhere)
- [ ] `/api/chat.ts` compiles with zero TypeScript errors (`npm run build` still passes)
- [ ] Sending a malformed request (missing `messages`, or GET instead of POST) returns HTTP 400, not a crash
- [ ] With no API key set, a valid POST returns HTTP 500 with the generic message, not a crash or a leaked stack trace
- [ ] Code contains no hardcoded API key anywhere
- [ ] Git commit: `Task 2: real API integration via /api/chat`

## Out of scope for this task
Frontend changes, deployment, conversation persistence, patient context injection, prompt caching. Do not touch these.

## Note for the owner (not for Codex to act on)
Once this task is accepted, the owner runs the app locally with `vercel dev` (not `npm run dev`) so the `/api` route is actually served, pastes their real Anthropic API key into `.env.local`, and tests the endpoint before Task 3 wires up the UI.
