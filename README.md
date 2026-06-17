# PetCare Backend

REST API for the PetCare platform — **PERN** stack (PostgreSQL · Express · React · Node) using **Prisma ORM**.

## Tech stack

| Concern        | Choice                          |
| -------------- | ------------------------------- |
| Runtime        | Node.js (ESM)                   |
| Framework      | Express 4                       |
| Database       | PostgreSQL                      |
| ORM            | Prisma                          |
| Auth           | JWT (access + refresh), bcrypt  |
| Validation     | Zod                             |
| Security       | helmet, cors, rate limiting     |

## Project structure

```
PetCareBack/
├── prisma/
│   ├── schema.prisma        # Data model
│   └── seed.js              # Demo data (admin / owner / vet, services, pet)
├── src/
│   ├── config/              # env loader + Prisma client
│   ├── middlewares/         # auth, validate, rate limit, error, 404
│   ├── utils/               # ApiError, ApiResponse, jwt, password, asyncHandler, logger
│   ├── modules/             # feature-first modules
│   │   ├── auth/            # register, login, refresh, logout, me
│   │   ├── users/           # admin user management
│   │   ├── pets/            # owner pets (scoped)
│   │   ├── vets/            # vet accounts + profiles
│   │   ├── services/        # service catalogue
│   │   └── appointments/    # bookings (role-scoped)
│   ├── routes/index.js      # mounts all module routers under /api/v1
│   ├── app.js               # express app (middleware + routes)
│   └── server.js            # bootstrap + graceful shutdown
├── .env.example
└── package.json
```

Each module follows the same layering: **routes → controller → service → Prisma**, with **validation** (Zod) at the edge. Business rules and authorization live in the service layer.

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

Create the database (once):

```bash
createdb petcare         # or: psql -c "CREATE DATABASE petcare;"
```

### 3. Run migrations + generate the client

```bash
npm run prisma:migrate   # creates tables, generates Prisma client
npm run db:seed          # optional: load demo data
```

### 4. Start the server

```bash
npm run dev              # nodemon, http://localhost:8081
```

Health check: `GET http://localhost:8081/health`

## API docs (Swagger)

Interactive OpenAPI docs are served once the app is running:

- Swagger UI: `http://localhost:8081/api/docs`
- Raw OpenAPI spec: `http://localhost:8081/api/docs.json`

Click **Authorize** and paste the `token` from a login/register response to try
authenticated endpoints. The spec is defined in [`src/config/swagger.js`](src/config/swagger.js).

## Authentication

- `POST /api/v1/auth/register` — self sign-up (PET_OWNER / VET)
- `POST /api/v1/auth/login` — returns `{ token, refreshToken, userType, user }`
- `POST /authenticate` — **alias of login** used by the existing frontend
- `POST /api/v1/auth/refresh` — exchange a refresh token for new tokens
- `POST /api/v1/auth/logout` — revoke the refresh token (auth required)
- `GET  /api/v1/auth/me` — current user (auth required)

Send the access token as `Authorization: Bearer <token>` on protected routes.

### Roles

`SUPER_ADMIN`, `ADMIN`, `VET`, `PET_OWNER`. Route access is enforced by the
`authenticate` + `authorize(...roles)` middleware and by per-resource ownership
checks in the service layer.

## API overview (all under `/api/v1`)

| Resource       | Routes                                                        | Notes                              |
| -------------- | ------------------------------------------------------------ | ---------------------------------- |
| `auth`         | register, login, refresh, logout, me                         | —                                  |
| `users`        | CRUD                                                          | admin only                         |
| `pets`         | CRUD                                                          | owners scoped to their own pets    |
| `vets`         | CRUD                                                          | read: any auth; write: admin       |
| `services`     | CRUD                                                          | read: any auth; write: admin       |
| `appointments` | CRUD + `PATCH /:id/status`                                    | role-scoped (owner / vet / admin)  |

All list endpoints support `?page=&limit=` and return `{ items, meta }`.

## Response shape

Success:

```json
{ "success": true, "message": "…", "data": { } }
```

Error:

```json
{ "success": false, "message": "…", "details": [ ] }
```

## Demo credentials (after `npm run db:seed`)

| Role        | Email                | Password   |
| ----------- | -------------------- | ---------- |
| SUPER_ADMIN | admin@petcare.test   | Admin@123  |
| PET_OWNER   | owner@petcare.test   | Owner@123  |
| VET         | vet@petcare.test     | Vet@1234   |

## Scripts

| Command                   | Description                          |
| ------------------------- | ------------------------------------ |
| `npm run dev`             | Start with nodemon                    |
| `npm start`               | Start (production)                    |
| `npm run prisma:migrate`  | Run dev migrations                    |
| `npm run prisma:deploy`   | Apply migrations (production)         |
| `npm run prisma:studio`   | Open Prisma Studio                    |
| `npm run db:seed`         | Seed demo data                        |
| `npm run lint`            | ESLint                                |
| `npm run format`          | Prettier                              |
