# Taskoraq

**A Jira-inspired project management workspace** with a drag-and-drop Kanban board, sprints, real-time updates and role-based access control. Built with the MERN stack and Socket.IO.

**[Live Demo](https://taskoraq-t4pl.vercel.app)**

<!--
SCREENSHOTS: after uploading your images to docs/screenshots/, delete this comment line and the closing line below.

![Kanban board](docs/screenshots/board.png)
![Backlog and sprints](docs/screenshots/backlog.png)
![Reports](docs/screenshots/reports.png)
-->

---

## Features

- **Kanban board**: drag-and-drop issues between columns with optimistic UI updates.
- **Backlog and sprints**: create, start and complete sprints. Only one sprint can be active per project, and dates are validated.
- **Issues and epics**: issue types, priorities, assignees, story points, due dates, auto-numbered keys (e.g. `WEB-12`), comments and file attachments.
- **Search, filters and pagination**: filter by status, assignee, epic, type and priority, with server-side search and sorting.
- **Reports and analytics**: sprint burndown, project progress and a dashboard. Data can be exported as CSV or PDF.
- **Real-time updates**: Socket.IO keeps boards and notifications in sync across users.
- **Auth and roles**: JWT authentication with three roles, **Admin**, **Co-admin** and **Viewer**, enforced on the server.
- **Team management**: admin-only user management, email invites (via SMTP) and an **audit log** of changes.

## Role permissions

| Role | Can do |
|---|---|
| **Admin** | Everything: users and roles, invites, audit log, project deletion |
| **Co-admin** | Create and edit issues, sprints, epics, comments and projects |
| **Viewer** | Read-only access |

Public sign-up always creates a Viewer. The first admin is created with a CLI command or a one-time setup secret, so nobody can claim admin on a fresh deployment.

## Tech stack

| Layer | Technologies |
|---|---|
| Frontend | React 18, Vite, Motion, react-icons, custom CSS, socket.io-client |
| Backend | Node.js (20+), Express, Socket.IO |
| Database | MongoDB with Mongoose |
| Auth and security | JWT (HS256), bcrypt password hashing, MongoDB-backed rate limiting, input validation, secure headers, authenticated file downloads |
| Files and email | Multer (attachments), Nodemailer (invites) |
| Testing | Vitest and Supertest (70+ backend tests) |
| Deployment | Vercel (frontend), Render (API), MongoDB Atlas |

## API overview

About 40 REST endpoints, all under `/api`. All routes except login, register and invite lookup require `Authorization: Bearer <token>`.

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/login`, `POST /auth/register`, `GET /auth/me`, `GET /auth/invite/:token` |
| Users (admin) | `GET/POST /users`, `PATCH/DELETE /users/:id` |
| Projects | `GET/POST /projects`, `PATCH/DELETE /projects/:id` |
| Sprints | `GET/POST /sprints`, `PATCH/DELETE /sprints/:id`, `POST /sprints/:id/start`, `POST /sprints/:id/complete` |
| Issues | `GET/POST /issues`, `GET/PATCH/DELETE /issues/:id`, `PUT /issues/:id/move` |
| Comments and files | `POST /issues/:id/comments`, `DELETE /issues/:id/comments/:commentId`, `POST/DELETE /issues/:id/attachments` |
| Other | `GET /notifications`, `GET /audit`, `GET/POST/DELETE /invites`, `GET /health` |

Example of the paginated issue list:

```
GET /api/issues?projectId=p1&status=To%20Do&q=login&sort=created&dir=desc&page=2&limit=25
-> { "items": [...], "total": 83, "page": 2, "limit": 25, "pages": 4 }
```

More detail is in [`backend/README.md`](backend/README.md).

## Getting started

### Prerequisites

- Node.js 20.19 or newer
- MongoDB, either local (`mongodb://127.0.0.1:27017`) or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster

### Run locally

```bash
git clone https://github.com/AnkitSoni-8/Taskoraq.git
cd Taskoraq

npm run setup     # installs frontend and backend dependencies and creates .env files
npm run dev       # starts the API (http://localhost:5000) and the web app (http://localhost:5173)
```

Edit `backend/.env` if your MongoDB is not on the default address. The key settings are:

| Variable | Purpose |
|---|---|
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Long random string used to sign tokens (required in production) |
| `CLIENT_ORIGIN` | Frontend URL allowed by CORS |
| `SMTP_*` | Optional, for real invite emails (otherwise the invite link is printed in the server console) |

### Demo accounts (development only)

In development the database is seeded with demo data. All demo users share the password `password123`.

| Email | Role |
|---|---|
| `ankit@example.com` | Admin |
| `riya@example.com` | Co-admin |
| `karan@example.com` | Viewer |

Production builds do not create demo users unless `SEED_DEMO=true` is set.

### Run the tests

```bash
cd backend/tests
npm install
npm test
```

The tests cover authentication, role permissions, issues, sprint transitions, ordering and pagination, and file uploads.

## Project structure

```
Taskoraq/
├── src/                  # React frontend (views, store, realtime, UI components)
│   └── views/            # Board, Backlog, Issues, Epics, Reports, Users, Audit, ...
├── backend/
│   ├── server.js         # Entry point (Express + Socket.IO)
│   ├── src/
│   │   ├── routes/       # auth, users, projects/sprints/issues, extras
│   │   ├── models/       # Mongoose models
│   │   └── ...           # auth middleware, validation, realtime, mailer
│   └── tests/            # Vitest + Supertest suites
├── docs/DEPLOYMENT.md    # Render + Atlas deployment guide
└── render.yaml           # Render blueprint
```

## Deployment

The frontend is deployed on Vercel and the API on Render with MongoDB Atlas. Step-by-step instructions, security settings and backup notes are in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Roadmap

- Docker setup and a GitHub Actions CI pipeline that runs the tests on every push
- End-to-end browser tests (Playwright)
- Keyboard shortcuts for faster issue creation

## Author

**Ankit Soni**: [GitHub](https://github.com/AnkitSoni-8)

Taskoraq is an independent learning project inspired by Jira. It is not affiliated with Atlassian.
