# EventBook

A small but complete event booking app: browse upcoming events, grab a seat, cancel if your plans change. Admins create and manage events and can see who's coming.

Built as an internship take-home. The emphasis is on getting the boring-but-important things right - the booking rules are enforced in the database and the API, not just hidden behind buttons in the UI.

```
Next.js (Vercel)  --REST/JSON-->  FastAPI (Render)  --SQLAlchemy-->  Supabase PostgreSQL
```

---

## Contents

1. [Tech stack](#1-tech-stack)
2. [Architecture & folder structure](#2-architecture--folder-structure)
3. [Prerequisites](#3-prerequisites)
4. [Local setup (Windows / PowerShell)](#4-local-setup-windows--powershell)
5. [Running the tests](#5-running-the-tests)
6. [Seed accounts](#6-seed-accounts)
7. [API overview](#7-api-overview)
8. [Deployment](#8-deployment)
9. [Design decisions](#9-design-decisions)
10. [Assumptions & known limitations](#10-assumptions--known-limitations)

---

## 1. Tech stack

| Layer     | Choice                                                                 |
| --------- | ---------------------------------------------------------------------- |
| Frontend  | Next.js 16 (App Router), TypeScript, Tailwind CSS v4                   |
| Backend   | Python 3.12+, FastAPI, Pydantic v2, SQLAlchemy 2.x, Alembic            |
| Database  | PostgreSQL (Supabase in production, any Postgres locally)              |
| Auth      | Argon2id password hashing, HS256 JWT in an HttpOnly cookie (own impl.) |
| Tests     | pytest + FastAPI TestClient against a real Postgres database           |

No Supabase Auth, no Next.js API routes, no ORMs on the frontend. The browser only ever talks to the FastAPI REST API.

## 2. Architecture & folder structure

```
eventbook/
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI app, CORS, CSRF guard, error envelope
│   │   ├── core/              # settings, security (hashing/JWT), exceptions
│   │   ├── db/session.py      # engine + session dependency
│   │   ├── models/            # SQLAlchemy models: User, Event, Booking
│   │   ├── schemas/           # Pydantic request/response models
│   │   ├── services/          # business rules live here (auth, events, bookings)
│   │   └── api/               # routers + auth dependencies
│   ├── alembic/               # migrations (0001_initial_schema)
│   ├── scripts/seed.py        # idempotent sample data
│   ├── tests/                 # pytest suite (25 tests)
│   ├── requirements.txt
│   ├── Procfile / .python-version
│   └── .env.example
├── frontend/
│   ├── src/app/               # routes (App Router)
│   │   ├── page.tsx           # home: listing, search, pagination
│   │   ├── events/[id]/       # event details + booking
│   │   ├── login/ register/   # auth
│   │   ├── bookings/          # my bookings
│   │   └── admin/             # dashboard, create/edit event, attendees
│   ├── src/components/        # Navbar, EventCard, forms, dialog, UI primitives
│   ├── src/context/           # AuthContext (current user)
│   ├── src/lib/               # api client, types, date helpers, useFetch hook
│   └── .env.example
├── render.yaml                # Render blueprint for the API (must be at repo root)
├── .gitignore
└── README.md
```

**Request flow**: a page component calls `src/lib/api.ts` → `fetch()` with `credentials: "include"` → FastAPI router → service function (business rules, transaction) → SQLAlchemy → PostgreSQL. Errors come back as `{"error": {"code", "message", "details?"}}` and the UI maps them to field errors or alerts.

## 3. Prerequisites

- **Node.js 20+** and npm
- **Python 3.12 or 3.13**
- **Git**
- A **PostgreSQL** database. Either:
  - a free [Supabase](https://supabase.com) project (recommended - same as production), or
  - a local PostgreSQL install.

## 4. Local setup (Windows / PowerShell)

### 4.1 Clone

```powershell
git clone https://github.com/<you>/eventbook.git
cd eventbook
```

### 4.2 Supabase database

1. Create a project at https://supabase.com (any region, remember the DB password).
2. **Project Settings → Database → Connection string → URI**. Pick the **Session pooler** (port 5432) version. It looks like:
   `postgresql://postgres.abcdefgh:[YOUR-PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`
3. That's the value for `DATABASE_URL` below. The app only needs this one string - no Supabase API keys are used anywhere.

> Local Postgres instead? `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/eventbook` after `CREATE DATABASE eventbook;`.

### 4.3 Backend

```powershell
cd backend

# virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1
# (if PowerShell blocks scripts: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned)

pip install -r requirements.txt

# config
Copy-Item .env.example .env
notepad .env        # set DATABASE_URL and a long random JWT_SECRET_KEY

# create tables
alembic upgrade head

# sample data (safe to run more than once)
python -m scripts.seed

# run the API -> http://localhost:8000  (docs at /docs)
uvicorn app.main:app --reload
```

Generate a secret with `python -c "import secrets; print(secrets.token_urlsafe(48))"`.

### 4.4 Frontend

Open a second terminal:

```powershell
cd frontend
npm install
Copy-Item .env.example .env.local      # NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 is already correct
npm run dev                             # -> http://localhost:3000
```

Log in with one of the [seed accounts](#6-seed-accounts) and you're in.

## 5. Running the tests

The booking logic depends on `SELECT ... FOR UPDATE` and a partial unique index, so the tests run against **real PostgreSQL**, not SQLite. Point them at a throwaway database - **every table is truncated between tests**.

```powershell
cd backend
.\.venv\Scripts\Activate.ps1

# create an empty test database first (Supabase: just use a second project, or local psql):
#   CREATE DATABASE eventbook_test;
$env:TEST_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/eventbook_test"

pytest -q
```

Latest run: **25 passed**. What's covered:

| Rule | Test |
| --- | --- |
| 1 No duplicate active bookings | `test_duplicate_active_booking_is_rejected`, `test_can_rebook_after_cancelling` |
| 2 Never overbook | `test_booking_full_event_is_rejected`, `test_concurrent_bookings_never_exceed_capacity` (20 threads race for 5 seats) |
| 3 No booking past events | `test_booking_past_event_is_rejected` |
| 4 No cancelling past events | `test_cancelling_past_event_booking_is_rejected` |
| 5 Only cancel your own | `test_cannot_cancel_someone_elses_booking` |
| 6 Cancellation frees a seat | `test_cancellation_frees_a_seat` |
| 7 Admin-only management | `test_admin_endpoints_reject_normal_users_and_anonymous` |
| 8 Capacity ≥ active bookings | `test_cannot_reduce_capacity_below_active_bookings` |
| 9 Deletion policy | `test_delete_policy` |
| Auth | registration ignores client `role`, duplicate email → 409, bad password → 401, CSRF header required, validation shape |
| Listing | server-side pagination, clamping, search, past events hidden, 422 on bad params |

Frontend checks: `npm run lint` and `npm run build` both pass cleanly.

## 6. Seed accounts

Defaults from `backend/.env.example` (override via `SEED_*` variables before seeding anything real):

| Role  | Email                 | Password      |
| ----- | --------------------- | ------------- |
| Admin | `admin@eventbook.dev` | `Admin12345!` |
| User  | `user@eventbook.dev`  | `User12345!`  |

The seed also creates 14 events relative to today (1 past, 1 sold out, 1 with a single seat left), ten filler attendees, and a booking history for the demo user (one upcoming, one past, one cancelled) so every state in the UI has something to show. Admins can **only** be created this way - public registration always produces a `user`.

## 7. API overview

Interactive docs: `http://localhost:8000/docs`. All routes are prefixed with `/api`. Auth is an HttpOnly cookie set by login/register; a `Authorization: Bearer <token>` header also works for curl/Postman.

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/events?page=1&page_size=9&search=` | – | Upcoming events, paginated + searched in SQL. Returns `items,total,page,page_size,total_pages`. |
| GET | `/events/{id}` | – | Event with `booked_seats`, `available_seats`, `is_full`, `is_past`. |
| POST | `/events/{id}/bookings` | user | Book one seat. 201, or 400/404/409. |
| GET | `/bookings/me` | user | Own bookings with `can_cancel` flag. |
| DELETE | `/bookings/{id}` | user | Soft-cancel own booking. |
| POST | `/auth/register` | – | Always creates role `user`. Sets cookie. |
| POST | `/auth/login` | – | Sets cookie. |
| POST | `/auth/logout` | – | Clears cookie. |
| GET | `/auth/me` | user | Current user (no password hash). |
| GET | `/admin/events?include_past=true` | admin | All events incl. past. |
| POST | `/admin/events` | admin | Create. |
| PATCH | `/admin/events/{id}` | admin | Partial update; capacity check. |
| DELETE | `/admin/events/{id}` | admin | 204, or 409 if bookings exist. |
| GET | `/admin/events/{id}/attendees` | admin | Attendee list + counts. |

Status codes: `400` business rule (past event etc.), `401` not logged in, `403` wrong role / not owner / missing CSRF header, `404` missing, `409` full / duplicate / capacity / has bookings / email taken, `422` validation, `500` generic (details only in server logs).

Quick curl test:

```powershell
curl -c cookies.txt -H "Content-Type: application/json" -d '{"email":"user@eventbook.dev","password":"User12345!"}' http://localhost:8000/api/auth/login
curl -b cookies.txt -H "X-Requested-With: XMLHttpRequest" -X POST http://localhost:8000/api/events/2/bookings
```

## 8. Deployment

Frontend and backend deploy independently. Order matters a little: deploy the API first so you know its URL, then the frontend, then come back and set `FRONTEND_ORIGIN` on the API.

### 8.1 Database (Supabase)

Already created in step 4.2. Nothing else to do - migrations run from the backend.

### 8.2 Backend → Render (free tier)

**Option A - Blueprint (fastest).** Render → *New* → *Blueprint* → select this repo. It reads `render.yaml` from the repo root, creates the `eventbook-api` service and prompts you for the two values it can't guess:

```
DATABASE_URL     = <Supabase pooler URI from step 4.2>
FRONTEND_ORIGIN  = https://<your-app>.vercel.app     (you can fill this in after step 8.3)
```

`JWT_SECRET_KEY` is auto-generated; `ENVIRONMENT`, `COOKIE_SECURE`, `COOKIE_SAMESITE` are preset for production.

**Option B - manual Web Service.** Same thing by hand:

| Setting | Value |
| --- | --- |
| Root directory | `backend` |
| Runtime | Python 3 |
| Build command | `pip install -r requirements.txt` |
| Start command | `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Health check path | `/health` |
| Env vars | `DATABASE_URL`, `JWT_SECRET_KEY`, `FRONTEND_ORIGIN`, `ENVIRONMENT=production`, `COOKIE_SECURE=true`, `COOKIE_SAMESITE=none` |

`alembic upgrade head` in the start command applies the schema on every deploy, so a fresh Supabase database is ready after the first boot. Check `https://<your-api>.onrender.com/health` returns `{"status":"ok"}` and `/docs` opens.

**Seeding production** - run once from your PC with the production URL:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
$env:DATABASE_URL = "<Supabase pooler URI>"
$env:SEED_ADMIN_PASSWORD = "<a real password>"
$env:SEED_USER_PASSWORD  = "<a real password>"
python -m scripts.seed
```

Railway / Fly.io / Koyeb work identically - the `Procfile` has the same start command. Either Supabase pooler URL (session 5432 or transaction 6543) works; prepared statements are disabled for PgBouncer compatibility.

### 8.3 Frontend → Vercel

1. Vercel → *Add New* → *Project* → import the GitHub repo.
2. **Root Directory: `frontend`** (click *Edit* next to it). Framework preset auto-detects Next.js; leave build/output defaults alone.
3. Environment variable: `NEXT_PUBLIC_API_BASE_URL` = `https://<your-api>.onrender.com` (no trailing slash).
4. Deploy. Copy the resulting `https://<your-app>.vercel.app` URL.
5. Back in Render, set `FRONTEND_ORIGIN` to that URL (add a custom domain here too if you use one, comma-separated). Render redeploys automatically.

Open the Vercel URL, log in with a seed account, book something. If the login appears to succeed but you're immediately logged out again, `FRONTEND_ORIGIN` doesn't match the exact Vercel origin or `COOKIE_SAMESITE`/`COOKIE_SECURE` aren't `none`/`true`.

### 8.4 Why the cookie settings matter

In production the frontend (`*.vercel.app`) and API (`*.onrender.com`) are different sites, so the auth cookie must be `SameSite=None; Secure` or browsers will drop it. Both hosts serve HTTPS, which `Secure` requires. CORS is restricted to `FRONTEND_ORIGIN` with `allow_credentials=true`, and the API additionally demands an `X-Requested-With` header on every write - a plain cross-site form post can't add custom headers, which is what blocks CSRF.

## 9. Design decisions

### Schema

```
users     id, name, email (unique), password_hash, role, created_at
events    id, title, description, starts_at (timestamptz), venue, total_seats (>=1), created_at, updated_at
bookings  id, user_id FK, event_id FK, status ('active'|'cancelled'), created_at, cancelled_at
```

Indexes: `events(starts_at, id)` for the listing order, `events(title)` for search, `bookings(event_id, status)` for seat counts, `bookings(user_id, created_at)` for "my bookings", and a **partial unique index** `bookings(user_id, event_id) WHERE status = 'active'` which is Rule 1 in the database itself.

**Availability is never stored.** `available_seats = total_seats - COUNT(active bookings)` is computed in SQL on every read, so there's no counter that can drift. Foreign keys are `ON DELETE RESTRICT` so a user or event with bookings can't be removed underneath them.

### Concurrency (Rule 2)

Every booking runs in one transaction that begins with `SELECT ... FROM events WHERE id = ? FOR UPDATE`. PostgreSQL queues all writers on that row, so when two people go for the last seat the second one waits, then re-counts and sees the event is full. Cancellation and admin capacity edits take the same lock, so the count they read is always current. The partial unique index is a second safety net for duplicates. `test_concurrent_bookings_never_exceed_capacity` fires 20 real HTTP requests from threads at a 5-seat event and asserts exactly 5 succeed.

### Time

All timestamps are `timestamptz`, compared against `datetime.now(timezone.utc)`. The API speaks ISO 8601 with offsets; the browser renders in the visitor's local zone. Naive datetimes sent to the admin API are treated as UTC.

### Auth

- Argon2id (`argon2-cffi`) for passwords.
- Access token = HS256 JWT containing only the user id, 24h expiry, stored in an HttpOnly cookie. Role is re-read from the DB on every request so changes apply instantly and nothing in the token can be tampered with to escalate.
- The `RegisterRequest` schema simply has no `role` field; extra JSON keys are ignored. The service hard-codes `UserRole.user`.
- Ownership for cancellation comes from the token's user, never the body or URL.
- Same "Invalid email or password" message whether the email exists or not.
- Nothing sensitive is logged; `500`s return a generic message and log the traceback server-side.
- Frontend route guards (`RequireAuth`) are purely UX. Every protected endpoint re-checks on the server.

Trade-off: a single 24h access token rather than access + refresh pairs. For a project of this size that keeps the auth code small and reviewable; a refresh flow would be the first thing to add for a real product.

### Event deletion policy (Rule 9)

An event with **any** booking record - active or cancelled - returns `409 event_has_bookings` and cannot be deleted. This keeps booking history intact and avoids orphaned rows. Events nobody has ever booked can be deleted. The admin UI disables the button when there are bookings, but the API enforces it regardless.

### Error format

Every error is `{"error": {"code": "snake_case_code", "message": "human text", "details": [...]?}}`. Stable `code`s let the frontend react (e.g. `capacity_below_bookings` goes straight onto the seats field) without string-matching messages.

## 10. Assumptions & known limitations

- "Upcoming" means `starts_at > now()`; an event that started a minute ago is "past" for booking and cancellation alike.
- Search is a case-insensitive substring match on title (`ILIKE`). Fine for this scale; full-text search would be the upgrade.
- One seat per user per event by design - there's no quantity field.
- No email verification, password reset, or rate limiting. All would be sensible next steps.
- Page size is capped at 50 server-side; out-of-range page numbers are clamped to the last page rather than returning an error.
- The tests need a Postgres database and can't run on SQLite (intentional - the locking and partial index are the point).
- Deployment configs are included and the build/test pipeline has been verified, but the app has not been deployed by me to Vercel/Render - follow section 8 with your own accounts.
