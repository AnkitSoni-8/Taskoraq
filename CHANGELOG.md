# Changelog (bug fixes & security)

## Rename to Taskoraq
- Old project name replaced by **Taskoraq** everywhere: tab title, meta description, UI brand constant, invite e-mail, READMEs, docs, `package.json` / lockfile names, `.env.example`, default database name (`taskoraq`), browser storage keys (`taskoraq-token`, `taskoraq-v1`, `taskoraq-bg`), test/upload temp names.
- Existing local installs keep their data: if `MONGO_URI` is not set and the `taskoraq` database is empty while an older database ("sprintflow" / "jira-clone") has users, the server keeps using the older one. Browser tabs just need one fresh login.

`package.json` (root + backend), `npm --prefix backend` scripts aur `npm i` flow bilkul unchanged hain. Koi nayi dependency add nahi hui.

## Verify kiya (pass)
- Frontend: `npm install` + `vite build` OK. Backend: `npm install`, startup, MongoDB connect, seed OK.
- Browser test (headless Chromium): login/logout/reload, viewer read-only, Board drag & drop, Issue modal edits, Create issue, Backlog quick-add, sprint start/complete, Reports, Settings, Projects create/delete, Users page.
- API test: roles/permissions, validation, sprint flow, epic delete, rate limit.

## Bugs fixed
| Area | Bug | Fix |
|---|---|---|
| Startup | `.env` sirf current folder se load hota tha; env load order fragile | `backend/src/env.js` - `.env` hamesha `backend/` se, sabse pehle load |
| Startup | Port busy / startup error par unhandled crash | Saaf error message + clean exit |
| Login | Email/password string na ho (e.g. `{"email":{"$ne":1}}`) to 500 | 400 "Email and password are required" |
| Login | Register me email format check nahi tha ("nope" accept hota tha) | Email regex check, name/password type + length check |
| Issues | Blank summary ("   ") se issue ban jata tha | Summary trim + required + max 255 |
| Issues | Invalid type/status/points par 500 + internal error text | Ab 400 + readable message (Mongoose ValidationError/CastError -> 400, duplicate -> 409) |
| Issues | Failed create par issue number (WEB-n) waste ho jata tha (gap) | Pehle validate, phir counter increment |
| Issues | Dusre project ka sprint/epic issue se link ho sakta tha | sprintId / epicId same project ke hone chahiye; issue apna epic nahi ho sakta |
| Issues | Client-sent `id` collide/overwrite kar sakta tha | Id sirf tab accept jab well-formed aur unused ho, warna server banata hai |
| Issues | PATCH se `reporterId` / `doneAt` overwrite ho sakte the | Dono protected |
| Issues | Move API invalid status par 500 | 400 "Invalid status" |
| Comments | Koi bhi staff kisi ka bhi comment delete kar sakta tha | Sirf author ya admin; text max 5000 |
| Backlog/Sprint | Ek project me multiple active sprints start ho jaate the | 409 "Complete the active sprint before starting another one." |
| Backlog/Sprint | Start sprint par dates validate nahi hoti thi (end < start chal jata tha) | Dates required (YYYY-MM-DD) aur end >= start |
| Backlog/Sprint | Future/closed sprint bhi "complete" ho jata tha; closed sprint dobara complete karne par issues dobara move hote the | Sirf active sprint complete hota hai; sirf planned sprint start hota hai |
| Backlog/Sprint | `moveTo` kisi bhi sprint id par chala jata tha | Sirf same project ka planned sprint |
| Sprint | PATCH se `state` bypass karke seedha badal sakte the | PATCH sirf name/goal/start/end; state sirf start/complete se |
| Projects | Project key validate nahi hoti thi ("A B!" ban jata tha); duplicate key PATCH par DB internals ke saath 500 | Key `^[A-Z]{2,6}$` (UI jaisi rule); PATCH me allow-list (key change nahi) |
| Reports | Sprint ke pehle din burndown "actual" line dikhti hi nahi thi (single point) | Current point par marker dot |
| Issue modal | Closed sprint wale issue ka Sprint dropdown galat "Backlog" dikhata tha | Current sprint option me rehta hai |
| UI | Login ke baad data aane tak fake demo records flash hote the; reset par bhi | Empty state jab tak server data na aaye |
| UI | Favicon 404 console error | Inline empty favicon |

## Security fixes
- **Hardcoded JWT secret**: production me `JWT_SECRET` missing/placeholder/32 char se chhota ho to server start hi nahi hota; dev me warning. JWT algorithm HS256 pinned (sign + verify).
- **CORS**: `CLIENT_ORIGIN` na ho to pehle *har origin* allowed tha; ab default `http://localhost:5173`.
- **Brute force**: login par 20 attempts / 15 min per IP, register par 10 / hour (429 + Retry-After). Unknown email par bhi bcrypt compare (timing se user enumeration kam).
- **Mass assignment**: Project/Sprint/Issue update par fields allow-list / protected list.
- **Input validation**: har jagah type check (string), length limits, password max 72 (bcrypt limit), email format.
- **Error leakage**: production me 500 par internal message nahi jata; malformed JSON -> 400, bada body -> 413.
- **Headers**: `X-Powered-By` off; `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` set.
- **Demo accounts**: `NODE_ENV=production` par demo users (public password) seed nahi hote jab tak `SEED_DEMO=true` na ho.
- `.gitignore` (root) add: `node_modules`, `dist`, `.env`.

## Pehle "chhod diya" tha, ab fix
- **npm audit (frontend)**: Vite 5 -> **Vite 8.3.5**, `@vitejs/plugin-react` -> 6.1.2. `npm audit` ab **0 vulnerabilities**, build OK. Vite 8 ko Node >= 20.19 chahiye (`engines` me likha hai). Config/scripts me koi change nahi.
- **Rate limiter**: in-memory ki jagah **MongoDB-backed** (TTL index, koi nayi dependency nahi). Ab multiple server instances aur restart ke baad bhi limit shared rehti hai. Reverse proxy ke peeche chalao to `TRUST_PROXY=true` set karo (real client IP ke liye).

## Note
- Demo password `password123` sirf development ke liye hai; `.env.example` me `JWT_SECRET` badalna zaroori hai.

## P0 security fixes + automated tests
| Issue | Pehle | Ab |
|---|---|---|
| Admin takeover | Khali production DB par pehla registrant admin ban jata tha | Public register hamesha Viewer. Admin: `npm run create-admin` (server par) ya `ADMIN_SETUP_SECRET` + `/api/auth/setup-admin` (sirf jab koi admin na ho) ya admin promotion |
| Public uploads | `/api/uploads` `express.static` se, auth se pehle serve hota tha | Static folder hata diya. `GET /api/uploads/:name` login mangta hai, file kisi real attachment ki honi chahiye, forced download + nosniff + CSP sandbox + no-store |
| `/api/reset` in production | Admin reset se saare users delete + public demo accounts ban sakte the | Production me 403 (jab tak `SEED_DEMO=true` na ho) |
| Upload bugs | 5 MB se bada file 500 deta tha; ajeeb extension wali file ka naam bad ho sakta tha; file delete race | 413 + saaf message; extension sanitise; delete/cleanup awaited |
| Tests | Koi automated test nahi | `backend/tests` (Vitest + supertest + asli in-memory MongoDB): 53 tests |

Tests chalane ke liye: `cd backend/tests && npm install && npm test` (pehli baar MongoDB binary download hota hai). Coverage: login, registration security, admin setup, role permissions, issue creation, sprint transitions, file upload/download, notifications, audit log. Browser e2e (Playwright) abhi nahi hai.

---
# v3 - review fixes (#8-#12)
`backend/package.json` / `npm --prefix backend` scripts unchanged; koi dependency add/remove nahi.

| # | Problem | Fix |
|---|---|---|
| 8 | Production me demo login buttons dikhte the par demo accounts seed nahi hote | Buttons ab sirf `npm run dev` ya `VITE_DEMO_LOGIN=true` build me. Normal `vite build` bundle me demo text/password hai hi nahi (verified). Real login + sign-up form production me. Production me shared-password accounts nahi bante (seed gate pehle se) |
| 9 | Server `mongodb-memory-server` import karta tha jo backend dependency nahi thi | Hidden fallback hata diya. Connect fail par step-by-step message (local / Atlas) + exit. Tests ka `mongodb-memory-server` `backend/tests` me hi (waisa hi); `TEST_MONGO_URI` se existing MongoDB par bhi tests chal sakte hain |
| 10 | Issue list me pagination nahi | `GET /issues?page&limit&q&sort&dir` -> `{items,total,page,limit,pages}`; limit max 200; search (summary / `WEB-12`); stable sort (`id` tie-breaker); operator-injection (`status[$ne]`) block; naye compound indexes. Bina params ke purana array response (UI/tests safe) |
| 11 | Move route me neighbour query project/status filter ke bina | Position sirf same project + target status me; invalid `beforeId` (unknown / dusra project / dusra column / khud) = 400; float precision khatam hone par column renumber |
| 12 | Sprint dates sirf regex se check hoti thi | `isValidDate` (real calendar, leap year); start, PATCH sprint (stored value ke against order check bhi), aur issue `dueDate`/`startDate` par lagu |

Tests: 77 me se 75 pass. Naye tests: dates (6 invalid + leap/boundary + PATCH + issue dates), move/ordering (7), pagination/search/sort/limits/5,000-issue speed (7).
Do purane tests (`parallel creates ... unique numbers`, `comments ... can be removed`) mere sandbox me fail hue kyunki wahan real MongoDB nahi, FerretDB (MongoDB-compatible emulator) tha: wo concurrent `$inc` ko atomic nahi karta aur `$pull` ko multi-field subdocument par query ki jagah equality maanta hai. Code real MongoDB ke liye sahi hai - par ye 2 tests apne machine par real MongoDB ya `npm test` se confirm kar lena.

---
# v4 - Taskoraq rebrand
`backend/package.json`, `npm --prefix backend` scripts, DB name (`jira-clone`) aur storage keys unchanged (rename karne se existing data/login toot jaate).

- **Name**: Taskoraq (top bar, login, invite e-mail, READMEs).
- **Logo**: custom SVG - indigo gradient tile, "S" flow-line + sprint dot (`Logo` in `src/ui.jsx`).
- **Tab title**: `Taskoraq • Agile Workspace`. **Favicon**: `public/favicon.svg` (same artwork) + `theme-color`.
- **Fonts**: Sora (headings, brand, numbers) + Inter (body/UI), Google Fonts.
- **Palette**: indigo/blue (`#6366f1 / #4f46e5 / #3730a3`, sky accent), tinted light + dark themes; gradient buttons, glow and dot-grid/spotlight styling inspired by Aceternity UI's look (Aceternity components themselves are React + Tailwind + CSS-in-JS snippets, so only the visual language was adopted - no code copied, no Tailwind dependency added).

## v4.1 - Taskoraq name everywhere (nothing breaks)
- `name` in root / backend / tests `package.json` (+ lockfiles) -> `taskoraq`, `taskoraq-backend`, `taskoraq-backend-tests`. Scripts, dependencies and `npm --prefix backend` untouched.
- Default database name -> `taskoraq`. **Existing installs keep working**: if `MONGO_URI` is not set and the old `jira-clone` database already has users while `taskoraq` is empty, the server keeps using `jira-clone` (logged at startup). An explicit `MONGO_URI` in your `.env` is never changed. Same logic in `npm run create-admin`.
- Browser storage keys -> `taskoraq-token`, `taskoraq-v1`, `taskoraq-bg`; the old `jira-*` keys are read once and migrated, so open sessions stay logged in. JWT secret / tokens / passwords are unaffected.
- Test DB / temp upload names renamed (`taskoraq-test`, `taskoraq-uploads-`).
