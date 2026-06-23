# 🐾 PetCare — National Pet Registry & Animal-Health Platform

A civic-tech backend that turns scattered pet ownership into **structured, geo-tagged public-health data** — so local government (municipality / VDC / ward / community) can _count_, _plan_, and _act_, while pet owners and vets get real value in return.

> **The big idea**
> Every pet is registered once, by its owner, with a location. Every vet is registered too. Before any treatment or prescription, a vet looks up the pet by its **public code**. That single loop produces a trustworthy, location-aware census that governments can use to plan **vaccination drives, subsidies, and health campaigns** — and that owners experience as **reminders, care tips, and a portable health record** for their animals.

REST API built on the **PERN** stack (PostgreSQL · Express · React · Node) with **Prisma ORM**.

---

## Why this exists

The platform serves three stakeholders at once:

### 1. Pet owners

- Register **one or many** pets — across **different species** (dog, cat, bird, cattle, goat, …).
- Each pet gets a unique **registration code** + optional microchip ID.
- A portable **medical & vaccination history** that any registered vet can read.
- Timely **reminders**: vaccine due dates, deworming, checkups, and seasonal **care tips**.

### 2. Veterinarians & clinics

- Vets **register** and are tied to a **clinic** with a real location (scalable: many vets per clinic).
- Before treating or prescribing medicine/food, the vet **asks for the pet's code** and pulls up its record.
- Every treatment, prescription, and vaccination is **logged against the pet** — building its lifelong history.

### 3. Government / municipality / ward

- Registration is the **civic mandate**: each pet is tied to an **administrative area** (province → district → municipality → ward) and a **latitude/longitude**.
- Officials see **pet counts per place** for accurate planning.
- Plan **subsidised vaccines** and campaigns from real vaccination-coverage data.
- Identify under-served wards and target outreach.

```
 Owner registers pet ─► pet gets CODE + geo-location ─► tied to a WARD
        │                                                     │
        ▼                                                     ▼
 Vet asks CODE ─► logs treatment / vaccine ──────────►  Government dashboards
        │                                              (counts, coverage, subsidy
        ▼                                                planning, hot-spots)
 Owner gets reminders (vaccine / care tips)
```

---

## Tech stack

| Concern    | Choice                         |
| ---------- | ------------------------------ |
| Runtime    | Node.js (ESM)                  |
| Framework  | Express 4                      |
| Database   | PostgreSQL                     |
| ORM        | Prisma                         |
| Auth       | JWT (access + refresh), bcrypt |
| Validation | Zod                            |
| Security   | helmet, cors, rate limiting    |
| Docs       | Swagger / OpenAPI              |

---

## Data model

The schema (in [`prisma/schema.prisma`](prisma/schema.prisma)) is organised around the three-sided loop above.

### Core entities

| Model                  | Purpose                                                                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **User**               | One account for every actor. `role` ∈ `SUPER_ADMIN`, `ADMIN` (gov officer), `VET`, `PET_OWNER`. Carries a home `area` + lat/long.                            |
| **AdministrativeArea** | Self-referential hierarchy — `PROVINCE → DISTRICT → MUNICIPALITY → WARD`. The backbone of every "count per place" query.                                     |
| **Pet**                | The heart of the registry. Unique **`code`** (what vets ask for), optional `microchipId`, `species`, geo-location, `areaId`, `isRegistered`, `isSterilized`. |
| **Clinic**             | A physical veterinary location with address + lat/long. Many vets per clinic → scalable.                                                                     |
| **Vet**                | Vet profile (license, specialization, years) linked to a `User` and a `Clinic`.                                                                              |
| **Vaccination**        | Per-pet vaccine events: `vaccineName`, `doseNumber`, `status`, `administeredAt`, **`nextDueAt`** (drives reminders + subsidy planning), `isSubsidized`.      |
| **MedicalRecord**      | What a vet logs after verifying a pet by code: `diagnosis`, `treatment`, `medicine`, `diet`, `instructions`.                                                 |
| **Reminder**           | Owner-facing notifications: `VACCINE`, `CHECKUP`, `DEWORMING`, `CARE_TIP`, `GENERAL` over `PUSH` / `SMS` / `EMAIL`.                                          |
| **Service**            | Catalogue of clinic services (checkup, vaccination, grooming…).                                                                                              |
| **Appointment**        | Bookings linking owner ↔ pet ↔ vet ↔ service, with status workflow.                                                                                          |

### How geography enables the census

Each `Pet` carries both a precise `latitude`/`longitude` **and** a link to a `WARD`-level `AdministrativeArea`. Because areas form a tree, a single ward count rolls up to municipality → district → province for free. Lat/long powers map visualisations and "nearest vet" lookups.

> **Scaling note:** location is stored as plain `Float` columns today (indexed by area). For heavy radius / nearest-neighbour queries, upgrade the columns to **PostGIS `geography`** + a GiST index — the model is already shaped for it.

---

## Project structure

```
PetCareBack/
├── prisma/
│   ├── schema.prisma        # Data model (registry + clinical + geo + reminders)
│   ├── migrations/          # Versioned SQL migrations
│   └── seed.js              # Demo data: areas, clinic, users, pet+code, vaccination, reminder
├── src/
│   ├── config/              # env loader, Prisma client, Swagger spec, uploads
│   ├── middlewares/         # auth, validate, rate limit, error, 404
│   ├── utils/               # ApiError, ApiResponse, jwt, password, asyncHandler, logger, petCode
│   ├── integrations/        # external service clients (mail, whatsapp, google, push)
│   ├── modules/             # feature-first modules (routes → controller → service → Prisma)
│   │   ├── auth/            # register, login, OTP, OAuth, password reset/change
│   │   ├── users/           # admin user management
│   │   ├── pets/            # owner pets (scoped)
│   │   ├── vets/            # vet accounts + profiles
│   │   ├── services/        # service catalogue
│   │   ├── appointments/    # bookings (role-scoped)
│   │   ├── records/ vaccinations/ reminders/ areas/ stats/
│   │   ├── chat/           # messaging, calls, groups
│   │   ├── emailTemplates/ # editable transactional-email templates
│   │   └── admin/          # Control Panel: settings + mounts admin sub-routers
│   ├── socket/             # Socket.IO server (chat, calls, presence)
│   ├── jobs/               # scheduled jobs (e.g. chat-retention sweep)
│   ├── routes/index.js     # mounts all module routers under /api/v1
│   ├── app.js              # express app (middleware + routes)
│   └── server.js           # bootstrap + graceful shutdown
├── .env.example
└── package.json
```

Each module is self-contained and follows the same layering: **routes → controller → service → Prisma**, with **Zod validation** at the edge (`*.validation.js`). Business rules and authorization live in the service layer. Cross-cutting clients for third-party APIs live under `integrations/` (kept distinct from a module's domain `*.service.js`).

---

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# edit DATABASE_URL and the JWT secrets
```

`DATABASE_URL` format:

```
postgresql://<user>:<password>@localhost:5432/petcare?schema=public
```

> The credentials must match a real PostgreSQL role. If you hit
> `P1000 Authentication failed`, set the password to match your `.env`:
> `sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"`

Create the database (once):

```bash
createdb petcare      # or: sudo -u postgres psql -c "CREATE DATABASE petcare;"
```

### 3. Run migrations + seed

```bash
npm run prisma:migrate   # apply migrations + generate the Prisma client
npm run db:seed          # optional: load demo data (areas, clinic, users, pet, vaccine, reminder)
```

### 4. Start the server

```bash
npm run dev              # nodemon, http://localhost:8081
```

Health check: `GET http://localhost:8081/health`

---

## API docs (Swagger)

Once the app is running:

- **Swagger UI:** `http://localhost:8081/api/docs`
- **Raw OpenAPI spec:** `http://localhost:8081/api/docs.json`

Click **Authorize** and paste the `token` from a login/register response to try authenticated endpoints.

---

## Authentication

| Method & path                | Description                              |
| ---------------------------- | ---------------------------------------- |
| `POST /api/v1/auth/register` | Self sign-up (`PET_OWNER` / `VET`)       |
| `POST /api/v1/auth/login`    | Returns `{ token, refreshToken, user }`  |
| `POST /api/v1/auth/refresh`  | Exchange a refresh token for new tokens  |
| `POST /api/v1/auth/logout`   | Revoke the refresh token (auth required) |
| `GET  /api/v1/auth/me`       | Current user (auth required)             |

Send the access token as `Authorization: Bearer <token>` on protected routes.

### Roles

`SUPER_ADMIN`, `ADMIN` (government/municipality officer), `VET`, `PET_OWNER`. Access is enforced by the `authenticate` + `authorize(...roles)` middleware and per-resource ownership checks in the service layer.

---

## API overview (all under `/api/v1`)

### ✅ Implemented

| Resource            | Routes                                  | Notes                                                                                                |
| ------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `auth`              | register, login, refresh, logout, me    | —                                                                                                    |
| `users`             | CRUD                                    | admin only                                                                                           |
| `pets`              | CRUD                                    | owners scoped to their own pets; **auto-generated `code`** on create, inherits owner's area/location |
| `pets/lookup/:code` | `GET`                                   | **Vet-facing** — pet + owner + vaccinations + records by code. Vets/admin only                       |
| `vaccinations`      | list, create, update, delete            | vets/admin write; owners read their pets'                                                            |
| `records`           | list, create, delete                    | vets/admin log diagnosis / treatment / medicine / diet                                               |
| `reminders`         | list, create, `PATCH /:id/read`, delete | per-user inbox with `unread` count                                                                   |
| `areas`             | list, create                            | administrative hierarchy; read: any auth, write: admin                                               |
| `stats/overview`    | `GET`                                   | **Government** — totals, vaccine coverage, subsidy reach, species mix. Admin only                    |
| `stats/by-area`     | `GET ?level=&parentId=`                 | **Government** — pet count + coverage per area. Admin only                                           |
| `vets`              | CRUD                                    | read: any auth; write: admin                                                                         |
| `services`          | CRUD                                    | read: any auth; write: admin                                                                         |
| `appointments`      | CRUD + status workflow                  | role-scoped (owner / vet / admin)                                                                    |

All list endpoints support `?page=&limit=` and return `{ items, meta }`.

### 🛣️ Roadmap (still to build)

| Planned            | What it adds                                                                            |
| ------------------ | --------------------------------------------------------------------------------------- |
| `clinics` CRUD     | Manage clinic profiles + locations; "find nearest vet".                                 |
| Reminder scheduler | Cron job reading `Vaccination.nextDueAt` → generates & dispatches reminders (SMS/push). |
| GeoJSON feed       | `stats` endpoint returning map overlays for the government dashboard.                   |
| PostGIS upgrade    | Fast radius / nearest-vet search once data grows.                                       |

---

## Response shape

Success:

```json
{ "success": true, "message": "…", "data": {} }
```

Error:

```json
{ "success": false, "message": "…", "details": [] }
```

---

## Demo credentials (after `npm run db:seed`)

| Role        | Email           | Password  |
| ----------- | --------------- | --------- |
| SUPER_ADMIN | admin@gmail.com | P@ssw0rd |
| PET_OWNER   | owner@gmail.com | P@ssw0rd|
| VET         | vet@gmail.com   | P@ssw0rd  |

Sample registered pet code: **`NP-PET-REX01`** (try the vet lookup flow against it).

---

## Scripts

| Command                  | Description                   |
| ------------------------ | ----------------------------- |
| `npm run dev`            | Start with nodemon            |
| `npm start`              | Start (production)            |
| `npm run prisma:migrate` | Run dev migrations            |
| `npm run prisma:deploy`  | Apply migrations (production) |
| `npm run prisma:studio`  | Open Prisma Studio            |
| `npm run db:seed`        | Seed demo data                |
| `npm run lint`           | ESLint                        |
| `npm run format`         | Prettier                      |

---

## Suggested next steps

1. **Pet code generator** — generate a collision-free, human-readable `code` (e.g. `NP-PET-XXXXX`) on pet creation.
2. **Vet lookup endpoint** — `GET /pets/lookup/:code` returning pet + vaccination + medical history (vets only).
3. **Reminder scheduler** — a cron job that reads `Vaccination.nextDueAt` and creates `Reminder` rows, then dispatches via SMS/push.
4. **Government dashboard endpoints** — aggregate counts grouped by `AdministrativeArea`.
5. **PostGIS upgrade** — for fast radius / nearest-vet search once data grows.
6. **Photo uploads** — wire `Pet.photoUrl` and `User` avatars to object storage.
