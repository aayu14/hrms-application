HRMS Backend Scaffold

Quick start (development):

1. Copy `.env.example` to `.env` and set `DATABASE_URL`.

2. Install dependencies (if running locally):

```bash
cd backend
npm install
```

Run using Docker Compose (recommended):

```bash
# from project root (d:\\New folder\\hrms v2)
docker-compose up --build
```

This will start a Postgres database and the backend service. The backend will run migrations (`migrations/001_initial_schema.sql`) automatically before starting.

Endpoints:
- `GET /api/:collection` - list rows (limited)
- `GET /api/:collection/:id` - get row
- `POST /api/:collection` - create
- `PUT /api/:collection/:id` - update
- `DELETE /api/:collection/:id` - delete
- `POST /api/migrate/local-data` - import JSON export (admin only)

Authentication & Metrics
- `POST /api/auth/login` - login with `email` and `password`, returns JWT
- Protected endpoints require `Authorization: Bearer <token>` header
- `GET /api/metrics` - Prometheus metrics (default metrics + counters)

Notes:
- This scaffold is intentionally minimal. For production, add authentication, validation, prepared statements with column binding, input sanitization, comprehensive error handling, migrations using a proper tool (Flyway/Knex), and test coverage.
