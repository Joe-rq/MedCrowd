# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MedCrowd (众医议) — A2A health consultation platform for the SecondMe A2A Hackathon. Users submit health questions through their AI agent, which queries multiple other users' AI agents in parallel, validates responses, and synthesizes a structured consensus report.

## Monorepo Structure

- `web/` — Next.js 16 full-stack application (App Router)
- `docs/` — PRD, deployment, optimization roadmap, submission docs

All development happens in `web/`. There is no separate backend service.

## Commands

```bash
# Development
cd web && npm run dev          # Start dev server

# Build & verify
cd web && npm run build        # Production build
cd web && npm run verify       # lint + build + smoke test

# Testing
cd web && npm run test         # vitest run (NOT watch mode)

# Linting
cd web && npm run lint         # eslint
```

## Tech Stack

- **Framework**: Next.js 16 (App Router, React 19, TypeScript 5)
- **Styling**: Tailwind CSS 4
- **Auth**: SecondMe OAuth 2.0 + iron-session (encrypted cookies)
- **AI**: SecondMe Chat API (SSE streaming)
- **Storage**: File-based JSON (`web/data/medcrowd.db.json`) — ephemeral on Vercel
- **Testing**: Vitest 3 (pool: forks, maxForks: 4, maxConcurrency: 2)
- **Deploy target**: Vercel serverless

## Architecture

### Request Flow

```
User question → Safety check → Triage classification → Select agents (max 5)
→ Parallel SecondMe chat queries → Validate responses → Build summary → Report
```

### Core Modules (`web/src/lib/`)

| Module | Responsibility |
|--------|---------------|
| `engine.ts` | A2A consultation orchestration (`runConsultation`, `queryAgent`) |
| `secondme.ts` | SecondMe OAuth & Chat API client |
| `db.ts` | In-memory JSON file persistence (users, consultations, agent responses) |
| `summary.ts` | Report synthesis (consensus, divergence, preparation extraction) |
| `act.ts` | Health question triage/intent classification |
| `validator.ts` | Response validation (length, dedup, boilerplate detection) |
| `safety.ts` | High-risk keyword filtering (self-harm, emergency) |
| `session.ts` | iron-session management, OAuth state CSRF |

### API Routes (`web/src/app/api/`)

| Route | Method | Purpose |
|-------|--------|---------|
| `auth/login` | GET | Initiate OAuth |
| `auth/callback` | GET | OAuth callback |
| `auth/logout` | GET | Clear session |
| `auth/session` | GET | Current session info |
| `consultation` | POST | Start multi-agent consultation |
| `consultation/[id]` | GET | Poll consultation status |
| `act/triage` | POST | Classify question intent |

### Key Data Types

- **ConsultationRecord**: status flows `PENDING → CONSULTING → DONE | FAILED`
- **ReportSummary**: `consensus[]`, `divergence[]`, `preparation[]`, `needDoctorConfirm[]`, `costRange?`, `riskWarning`, `agentResponses[]`
- **UserRecord**: includes `consultable` flag and `circuitBreakerUntil` for error backoff

### Pages (`web/src/app/`)

- `/` — Landing/login
- `/ask` — Question submission with triage display
- `/report/[id]` — Full consultation report
- `/share/[id]` — Public share preview (limited info, CTA to login)

## Environment Variables

Required in `web/.env.local`:
```
SECONDME_CLIENT_ID
SECONDME_CLIENT_SECRET
SECONDME_REDIRECT_URI
SECONDME_API_BASE_URL          # https://app.mindos.com/gate/lab
SECONDME_OAUTH_URL             # https://go.second.me/oauth/
SESSION_SECRET                 # ≥32 chars
OAUTH_STATE_STRICT             # true/false
NEXT_PUBLIC_BASE_URL           # Public app URL for share links
```

## Known Issues (per docs/OPTIMIZATION.md)

1. **Vercel persistence broken**: `fs.writeFileSync` doesn't survive cold starts — needs migration to Vercel KV
2. **A2A interaction is fan-out only**: No agent-to-agent reaction round yet
3. **Report fields incomplete**: `divergence`, `costRange`, `needDoctorConfirm` often empty/hardcoded
4. **CORS config contradictory**: `Allow-Origin: *` with `Allow-Credentials: true`
5. **`next.config.ts` has `output: 'standalone'`**: Intended for Docker, may conflict with Vercel

## Path Alias

`@/*` maps to `web/src/*` in TypeScript imports.
