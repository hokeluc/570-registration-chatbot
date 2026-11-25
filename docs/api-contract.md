# Frontend ↔ Backend API Contract (draft)

Proposed by the frontend (Person 4). Person 1 (Flask) and Person 3 (Minesflow) need to confirm it or suggest changes.
TypeScript mirror: `frontend/src/api/types.ts`. Keep both in sync.

The React dev server proxies `/api/*` to `http://localhost:5000`, so Flask needs no CORS setup in development.

---

## `POST /api/chat`

The frontend sends the whole session profile and the last 10 chat turns with every request. The backend is stateless, so it stores no conversation history (see the privacy plan).

### Request
```json
{
  "profile": {
    "entry_term": "Fall 2025",
    "grad_year": 2029,
    "catalog_year": "2025-2026",
    "majors": ["Computer Science"],
    "track": "Data Science",
    "minors": ["Mathematics"],
    "completed_courses": ["CSCI101", "MATH111"]
  },
  "messages": [
    { "role": "user", "content": "What are the prereqs for CSCI306?" }
  ]
}
```
- `messages` is oldest first, and the last item is always the new user question.
- `catalog_year` is always filled in. The frontend infers it from `entry_term` (Fall Y → `Y-(Y+1)`, Spring/Summer Y → `(Y-1)-Y`) unless the student overrides it.
- `track` may be missing.

### Response (`200`)
```json
{
  "reply": "**CSCI306** requires CSCI210 and one of CSCI220 or CSCI262.",
  "citations": [
    {
      "title": "CSCI306 – Course Catalog",
      "url": "https://catalog.mines.edu/...",
      "last_updated": "2025-06-12",
      "accessed": "2025-11-20",
      "catalog_year": "2025-2026"
    }
  ],
  "profile_updates": [
    {
      "field": "completed_courses",
      "op": "add",
      "value": "MATH111",
      "reason": "You said you've taken MATH111."
    }
  ],
  "warnings": ["Sources disagree on the credit total. See both below."]
}
```
| Field | Notes |
|---|---|
| `reply` | Markdown. Lists, tables, bold and links all render. **Put an advisor email in a fenced block tagged `email`** (` ```email … ``` `) so the UI shows it as a draft with a Copy button. |
| `citations` | Comes from the vector-store chunk metadata (`source` URL plus the WordPress `modified` date / scrape date) and from the Minesflow tools. `title` and `url` are required. Dates are ISO `YYYY-MM-DD`. Deduplicate by URL. |
| `profile_updates` | Changes the agent *proposes*. The student clicks Accept or No thanks, and only accepted changes reach the profile sent with the next request. `field` is one of `completed_courses`, `majors`, `minors`, `track`, `catalog_year`, `grad_year`, `entry_term`. `op` is `add`/`remove` for the list fields and `set` for single values. |
| `warnings` | Optional. Each one shows as a red-accent callout above the reply. Use it for conflicting sources (test case 7) and for guesses about course offerings (test case 9). |

**Privacy:** the frontend holds back messages that look like they contain a CWID, grade, name or contact info (`frontend/src/lib/privacy.ts`), and messages it redacted arrive with placeholders such as `[grade removed]`. Students can still choose "send anyway" for possible grades or names, and someone could call the API directly, so the backend should **not** log message text. The system prompt should tell the model never to ask for names, IDs or grades.

Missing `citations`, `profile_updates` or `warnings` count as empty. On a non-2xx status the UI shows a "Try again" button.

---

## `GET /api/options` (Person 3)

Fills the onboarding dropdowns. Implemented in `backend/options.py` (Flask blueprint `options.bp`; `backend/app.py` is a dev runner).

- `majors` and `tracks` come from `backend/minesflow/minesflow_export/index.json`, filtered by `catalog_metadata.json` (`major_granting`). Track names drop the `Track` suffix and the `CS + ` prefix, and the base CSCI track is `General`. Majors are named to match the 21 Mines undergraduate majors (for example Minesflow's "Engineering Design And Society" is served as "Design Engineering"). Minesflow's one Civil Engineering major is split into Civil, Construction and Environmental Engineering, each with a single `General` track. Quantum Systems Engineering has no Minesflow data, so it is served with `tracks: []`.
- `minors` and `catalog_years` are static lists in `backend/options_fallback.json`. Minesflow has neither. Keep them equal to `frontend/src/api/fallbackOptions.ts` (a test checks this).
- Minesflow holds one current snapshot, so `catalog_year` does not change which curriculum is loaded.
- Run the dev runner with `PORT=5001 python backend/app.py` if macOS AirPlay Receiver already holds port 5000.

If the endpoint is unreachable, the UI uses the placeholder list in `frontend/src/api/fallbackOptions.ts`.

```json
{
  "majors": [
    { "id": "csci", "name": "Computer Science", "tracks": ["General", "Data Science", "Robotics & Intelligent Systems"] }
  ],
  "minors": ["Mathematics", "Economics"],
  "catalog_years": ["2023-2024", "2024-2025", "2025-2026"]
}
```
`profile.majors` and `profile.track` hold the `name` strings from this response, so the backend can match them against the Minesflow files.
