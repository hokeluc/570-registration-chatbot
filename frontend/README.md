# Frontend: Mines Registration Helper

React + TypeScript + Vite. Branded with Mines colors and the brand site's web font, Open Sans, for body text and headings.

## Run it
You need **Node.js 18 or newer** (check with `node -v`; install it from https://nodejs.org if needed).

From the repo root:
```bash
cd frontend
npm install        # first time only, or after package.json changes
npm run dev        # prints a link such as http://localhost:5173
```
Open the link it prints. If port 5173 is busy, Vite picks the next free port (5174, ...). Press Ctrl+C to stop.
By default the app uses a **mock backend** (`src/api/mock.ts`), and a "Demo data" badge appears in the header. Words that trigger the different mock responses: `prereq`, `email`, `offered`, `CASA`, `I've taken MATH111`, and `fail` (shows the error state).

## Connect to Flask
1. Start the backend on port 5000 with `POST /api/chat` (and `GET /api/options`), following [`../docs/api-contract.md`](../docs/api-contract.md).
2. Create `frontend/.env.local` containing:
   ```
   VITE_USE_MOCK=false
   ```
3. Restart `npm run dev`. Vite proxies `/api` to `localhost:5000`.

## Layout
| Path | What it does |
|---|---|
| `src/api/types.ts` | Request/response types (mirror of the API contract) |
| `src/api/client.ts` | `sendChat`, `fetchOptions`, plus the mock toggle |
| `src/api/mock.ts` | Fake responses for development |
| `src/api/fallbackOptions.ts` | Placeholder majors/minors list used until `/api/options` exists |
| `src/context/ProfileContext.tsx` | Student profile, kept in `sessionStorage` (cleared when the tab closes) |
| `src/components/Onboarding.tsx` | 4-step intake: entry term, grad year, major/track, minors, catalog year, completed courses |
| `src/components/Chat.tsx` | Conversation, sends the last 10 turns plus the profile |
| `src/components/MessageBubble.tsx` | Markdown replies, sources with dates, warnings |
| `src/components/ProfileUpdateCard.tsx` | Accept or reject changes the agent proposes for the profile |
| `src/components/EmailDraft.tsx` | Renders ```` ```email ```` blocks with a Copy button |
| `src/styles/theme.css` | Brand tokens (`--mines-*`) and all styles |

## Privacy
- The UI never asks for a name, CWID or grades, and it reminds students not to enter them.
- The profile is kept in `sessionStorage` only. Chat history is kept in memory only and is lost on refresh.
- This is an unofficial tool, so it doesn't use the Mines logo or wordmark.
