# Noti Server

NestJS API for Noti: Better Auth (email/password), Postgres + Drizzle, sync, DeepSeek AI, clipper, and export.

## Setup

1. Start Postgres (Docker Desktop required):

```bash
docker compose up -d
```

Or point `DATABASE_URL` at any Postgres 17 instance.

2. Copy env and install:

```bash
cp .env.example .env
npm install
```

3. Apply schema:

```bash
npm run db:push
# or: npm run db:migrate
```

4. Run:

```bash
npm run start:dev
```

API listens on `http://localhost:3000`. Better Auth routes are under `/api/auth/*`.

## Endpoints

| Area | Routes |
|------|--------|
| Auth | `/api/auth/*` (Better Auth) |
| Notes | `GET/POST /notes`, `PATCH/DELETE /notes/:id`, backlinks, versions, graph, tags |
| Sync | `POST /sync/push`, `GET /sync/pull?since=` |
| AI | `POST /ai/summarize/:noteId`, `/ai/suggest-tags/:noteId`, `/ai/ask` (SSE) |
| Clipper | `POST /clipper` `{ url }` |
| Export | `GET /export?format=json\|markdown` |

Set `DEEPSEEK_API_KEY` for AI features.
