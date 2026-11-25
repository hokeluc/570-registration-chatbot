# Plan: Person 4 — React Frontend & UX for the Mines Registration Chatbot

## Context
The team is building an unofficial Mines advising chatbot (React → Flask → GPT agent loop with RAG over a Milvus-lite store + Minesflow JSON tools). The repo `570-registration-chatbot/` currently has only `vector_store/` (scraper, embeddings notebook, `store.db`, `reference/sources.json`). **There is no Flask backend yet**, so the frontend must be built against an agreed API contract and a mock, then swapped onto Person 1's real endpoints.

Requirements from the proposal that land on the frontend:
- Onboarding form first: entry year (term), expected grad year, major(s), track/focus area, minor, optional catalog year (inferred from entry term if blank).
- Profile lives only in session (React state + `sessionStorage`), no accounts, never ask for name/ID/grades; show a FERPA reminder.
- Chat UI that shows **citations with source URL + last-updated/accessed date** and catalog year.
- **Profile-update confirmation**: the agent can propose changes (e.g., "mark CSCI261 completed"); the student must accept/reject.
- Disclaimers: unofficial tool, verify with CASA, link to CASA advising request.
- Advisor email draft rendered nicely with a copy button (the bot never sends email).
- Deadlines: demo video **Dec 2**, final presentation Dec 3/8 → ~1 week.

## Branding (brand.mines.edu)
- Fonts (web guidance): **Open Sans** for body, headings, and nav (Google Fonts). Fallbacks: Helvetica Neue, Arial.
- Colors as CSS variables:
  - `--mines-dark-blue #21314D` (header, primary text on light)
  - `--mines-blaster-blue #09396C` (buttons, user bubbles)
  - `--mines-light-blue #879EC3`, `--mines-pale-blue #CFDCE9` (assistant bubbles, cards)
  - `--mines-colorado-red #CC4628` (warnings/accents only, ≤10%, never backgrounds)
  - `--mines-golden-tech #F1B91A` (small accents, never text)
  - `--mines-dark-gray #75757D` (secondary text), white backgrounds
- Do not use the official Mines logo/wordmark (this is an unofficial tool); use a text title like "Mines Registration Helper — unofficial".

## Tech choices
- **Vite + React + TypeScript** in `570-registration-chatbot/frontend/`.
- Plain CSS modules + a `theme.css` of brand tokens (no heavy UI lib).
- `react-markdown` for assistant messages (lists, links, email drafts).
- Vite dev proxy `/api → http://localhost:5000` so no CORS issues in dev.
- Mock API layer (`src/api/mock.ts`) toggled by `VITE_USE_MOCK=true` so you can build everything before Flask exists.

## API contract to agree on with Person 1 (do this first, day 1)
Put it in `docs/api-contract.md` and mirror it as TypeScript types in `src/api/types.ts`.

```
POST /api/chat
  req:  { profile: StudentProfile, messages: {role:"user"|"assistant", content:string}[] }  // last k messages
  res:  { reply: string,
          citations: { title, url, last_updated?: string, accessed?: string, catalog_year?: string }[],
          profile_updates: { field: string, op: "add"|"remove"|"set", value: any, reason: string }[],
          warnings?: string[] }           // e.g. "sources disagree"

GET /api/options          // majors, tracks, minors, catalog years (Person 3 / Minesflow data)
  res: { majors: {id,name,tracks:string[]}[], minors: string[], catalog_years: string[] }

StudentProfile = { entry_term: "Fall 2025", grad_year: 2029, catalog_year?: "2025-2026",
                   majors: string[], track?: string, minors: string[], completed_courses: string[] }
```
`citations` come from vector-store metadata (`source` + dates already captured by the scraper via WP `modified`) — confirm field names with Person 2. Until `/api/options` exists, ship a static fallback list of majors.

## Component structure (`frontend/src/`)
- `App.tsx` — routes between `Onboarding` and `Chat` based on whether a profile exists.
- `context/ProfileContext.tsx` — profile state, persisted to `sessionStorage` (cleared on tab close), `applyUpdate()`.
- `components/Onboarding.tsx` — multi-step form: (1) entry term + grad year, (2) major(s) + track, (3) minor(s) + optional catalog year + completed courses (optional), (4) review + privacy notice. Catalog year auto-inferred from entry term (Fall 2025 → 2025-2026), editable.
- `components/Header.tsx` — title, "Unofficial" badge, profile chip with Edit button, "Start over".
- `components/Chat.tsx` — message list, auto-scroll, input box, loading "thinking…" indicator, error/retry state.
- `components/MessageBubble.tsx` — markdown rendering; for assistant messages show `Sources` list (link + "updated YYYY-MM-DD") and any `warnings` in a red-accent callout.
- `components/ProfileUpdateCard.tsx` — Accept / Reject per proposed update; only Accept mutates the profile.
- `components/SuggestedPrompts.tsx` — starter chips (e.g., "What should my next semester look like?", "Prereqs for CSCI306?", "How do I book CASA advising?", "Draft an email to my advisor").
- `components/EmailDraft.tsx` (or detect fenced block) — copy-to-clipboard button.
- `components/Disclaimer.tsx` — persistent footer: unofficial, verify with CASA (link), don't enter name/ID/grades.
- `api/client.ts`, `api/mock.ts`, `api/types.ts`; `styles/theme.css`.

## Execution today (Nov 25)
0. Save this plan to `570-registration-chatbot/docs/frontend-plan.md` and the contract to `docs/api-contract.md`.
1. Do steps Day 1–4 below in one session: scaffold, theme, mock API, onboarding, chat, citations, profile-update cards, email copy, disclaimers, responsive pass. Verify with `npm run build` + `npm run dev`.
2. Left for later: Day 5 (real Flask integration + 10 test prompts), which is blocked on Person 1's backend.

## Step-by-step schedule (original breakdown)
1. **Day 1 (Nov 25–26):** scaffold Vite app, theme tokens + Google Fonts, write API contract and share with Person 1 & 3, build mock that returns fake citations + a fake profile update.
2. **Day 2:** Onboarding form + ProfileContext + sessionStorage + validation.
3. **Day 3:** Chat screen, MessageBubble with markdown + citations, loading/error states, suggested prompts.
4. **Day 4:** ProfileUpdateCard, email draft copy, disclaimer/FERPA reminders, responsive/mobile + keyboard/a11y pass (contrast check of brand colors).
5. **Day 5 (Nov 29–30):** integrate with real Flask (`VITE_USE_MOCK=false`), run the proposal's 10 test prompts through the UI, fix rendering issues; record demo Dec 1–2.

## Verification
- `npm run dev` with mock: complete onboarding → chat → see citations, accept a profile update, copy email draft; refresh keeps profile, closing tab clears it.
- With Flask running on :5000: same flow end-to-end; run test cases 1–10 from the proposal and confirm citations/warnings display (esp. #7 conflicting sources, #9 offering guess, #10 refusal).
- `npm run build` succeeds; check layout at 375px width; Lighthouse accessibility ≥ 90.
- Confirm no profile data in network calls other than `/api/*` and nothing in `localStorage`.
