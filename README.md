# Noti

Offline-first multi-user notes app.

- **App/** — Expo SDK 58 (iOS, Android, web) with on-device SQLite + FTS5
- **Server/** — NestJS + Postgres + Better Auth + DeepSeek AI

## Features

- Create / edit / soft-delete notes with instant FTS search and quick capture
- Markdown edit/preview, tags, checklists + Tasks tab
- Pin / archive, focus mode, dark mode (system), export/import (JSON & Markdown)
- Command palette, templates, daily notes
- `[[wiki-links]]`, backlinks, version history, graph view
- Offline-first sync (push/pull with tombstones)
- DeepSeek: summarize, suggest tags, ask-your-notes (Postgres FTS retrieval)
- Reminders, encrypted notes (client-side AES-GCM), web clipper, voice recording (transcription deferred)

## Quick start

### Server

```bash
cd Server
# Start Postgres (Docker) or set DATABASE_URL
cp .env.example .env
npm install
npm run db:push
npm run start:dev
```

### App

```bash
cd App
cp .env.example .env
# EXPO_PUBLIC_API_URL=http://localhost:3000
npm install
npx expo start
```

Sign in from **Settings** to enable sync and AI. Local notes work fully offline without an account.

## Design

UI tokens follow a Notes & Writing / Minimal Swiss direction (warm paper cream, indigo accent, Inter/system type). Skills live under `App/.cursor/skills/`.
"# Noti" 
