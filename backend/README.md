# Taskoraq - Backend (Node.js + Express + MongoDB)

    cd backend
    npm install
    cp .env.example .env     # edit MONGO_URI if needed
    npm run dev              # http://localhost:5000

MongoDB zaroori hai - koi hidden in-memory fallback nahi hai (data chupke se kho jata tha). Do options:
1. **Local**: MongoDB Community Server install karke start karo (default `mongodb://127.0.0.1:27017`).
2. **Atlas (free)**: cluster banao -> Network Access me apna IP allow karo -> connection string `backend/.env` me `MONGO_URI=mongodb+srv://<user>:<pass>@<cluster>/taskoraq` rakho. Docs: https://www.mongodb.com/docs/atlas/

Connect na ho paye to server saaf steps print karke exit karta hai. Development me pehli baar demo data auto-seed hota hai; **production me demo users nahi bante** (`SEED_DEMO=true` ke bina) aur frontend ke demo quick-login buttons production build me nahi dikhte.

## Login & roles
Demo users (password `password123`): ankit@example.com = **Admin**, riya@example.com / sahil@example.com = **Co-admin**, karan@example.com / priya@example.com = **Viewer**.
Public sign-up hamesha **Viewer** banata hai (khali database par pehla user bhi). Admin sirf in tareekon se bante hain:
1. `ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=long-password npm run create-admin` (server par, backend folder me) - ya
2. `.env` me `ADMIN_SETUP_SECRET` (16+ chars) daalo aur ek baar `POST /api/auth/setup-admin` ({name,email,password,setupSecret}); admin ban jaye to secret hata do, endpoint tab bhi 409 deta hai, 404 jab secret set na ho - ya
3. Maujooda admin "Users & roles" page se role badle.
Attachments (`/api/uploads/<file>`) ab login ke bina nahi khulti; frontend token ke saath fetch karke download karta hai.

| Role | Kya kar sakta hai |
|---|---|
| Admin | sab kuch: users/roles, project delete, reset |
| Co-admin | issues, sprints, epics, comments, project create/settings (create/edit/delete) |
| Viewer | sirf dekhna (read-only) |

Har request par `Authorization: Bearer <token>` chahiye; permission server par bhi check hoti hai (UI hide karna sirf convenience hai).
`.env` me `JWT_SECRET` zaroor badlo.

## API
| Method | Route | Kaam |
|---|---|---|
| POST | /api/auth/login, /register | login / sign-up (token milta hai) |
| GET | /api/auth/me | current user |
| GET/POST | /api/users | list / add user (admin) |
| PATCH/DELETE | /api/users/:id | role, name, password / remove (admin) |
| GET | /api/bootstrap | users, projects, sprints, issues ek saath |
| POST | /api/reset | demo data restore |
| GET/POST | /api/projects | list / create |
| PATCH/DELETE | /api/projects/:id | update / delete (issues + sprints bhi delete) |
| GET/POST | /api/sprints | list (`?projectId=`) / create |
| PATCH/DELETE | /api/sprints/:id | update / delete |
| POST | /api/sprints/:id/start, /complete | sprint start / complete (`moveTo`) |
| GET/POST | /api/issues | list (filters) / create (WEB-1 style number auto) |
| GET/PATCH/DELETE | /api/issues/:id | read / update / delete |
| PUT | /api/issues/:id/move | board drag & drop (`status`, `beforeId`) |
| POST/DELETE | /api/issues/:id/comments[/:commentId] | comments |


## Issue list API (pagination)
`GET /api/issues` - bina paging params ke purane jaisa plain array. `page`, `limit`, `q`, `sort`, `dir` dene par:

    GET /api/issues?projectId=p1&status=To%20Do&q=login&sort=created&dir=desc&page=2&limit=25
    -> { "items": [...], "total": 83, "page": 2, "limit": 25, "pages": 4 }

`limit` 1-200 (default 50). `q` = summary me search (case-insensitive) ya key jaise `WEB-12`. `sort` = order | created | number | summary | priority | status. Filters: projectId, sprintId, status, assigneeId, epicId, type, priority. (`/api/bootstrap` abhi bhi poora data deta hai - UI isi par chalta hai.)

## Board ordering & dates
`PUT /api/issues/:id/move` position sirf *usi project + target status* ke issues ke beech calculate hota hai; galat `beforeId` (dusra project/column, khud, unknown) = 400. Dates (`start`, `end`, `dueDate`, `startDate`) real calendar dates honi chahiye (`2026-02-30` reject, leap day `2028-02-29` ok).
