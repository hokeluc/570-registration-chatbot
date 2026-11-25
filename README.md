# Mines Registration Chatbot

An **unofficial** degree-planning assistant for Colorado School of Mines undergraduates. Students give their entry term, major, track and catalog year, then ask questions about requirements, prerequisites, flowcharts and advising. Answers come from public Mines documents and Minesflow data, and each answer cites its source and how recent that source is.

> Not an official Mines tool. Students should always confirm their plans with their CASA advisor.

## Architecture
```
React frontend  ──POST /api/chat──▶  Flask backend (agent loop)
                                        ├── document search tool ──▶ Milvus-lite vector store
                                        └── Minesflow tools ──▶ structured JSON (flowcharts, prereqs)
```
See [docs/api-contract.md](docs/api-contract.md) for the request and response format.

## Repo layout
| Folder | Owner | Status |
|---|---|---|
| `frontend/` | Person 4: React UI and UX | Done against the mock backend |
| `backend/` | Person 1: Flask agent loop | _Not started_ |
| `vector_store/` | Person 2: scraping, embeddings, document search | Vector store built |
| _(TBD)_ | Person 3: Minesflow data and structured tools | _Not started_ |
| `docs/` | Shared: API contract, plans | |

---

## Frontend
React + TypeScript + Vite, using Mines brand colors and the Open Sans font. Full details are in [frontend/README.md](frontend/README.md).

**Requires:** Node.js 18 or newer (`node -v`).

```bash
cd frontend
npm install        # first time only
npm run dev        # open the link it prints, e.g. http://localhost:5173
```

- By default the frontend uses a **mock backend** and shows a "Demo data" badge, so you can run it without Flask.
- To use the real backend, start Flask on port 5000 and create `frontend/.env.local` containing `VITE_USE_MOCK=false`. Then restart `npm run dev`.
- Flow: a 4-step onboarding (entry term, grad year, major/track, minors, catalog year, completed courses) leads into the chat. Chat replies show sources with dates, warnings, Accept/Reject cards for profile updates, and email drafts with a Copy button.

## Backend
_Person 1: add setup and run steps here._

## Vector store / document search
_Person 2: add setup and run steps here (scraper, `creating_embeddings.ipynb`, `store.db`)._

## Minesflow tools
_Person 3: add setup and run steps here._

---

## Privacy
- The app never asks for a name, CWID or grades.
- The student profile lasts only for the browser session.
- No conversation history is stored.
- API keys go in `.env`, which is git-ignored. Never commit them.
