# Fix & Flow

Production-grade Facebook Marketplace automation system with multi-account posting, proxy rotation, content scheduling, and inbox automation.

## Tech Stack

- **Backend:** Node.js, Express, TypeScript
- **Automation:** Playwright
- **Database:** PostgreSQL
- **Queue:** Redis + BullMQ
- **Frontend:** Next.js, Tailwind CSS
- **Infrastructure:** Docker

## Project Structure

```
fix-and-flow/
├── apps/
│   ├── backend/     # Express API + workers
│   └── frontend/    # Next.js admin dashboard
├── packages/
│   ├── shared/      # Shared utilities
│   └── types/       # Shared TypeScript types
└── infrastructure/
    └── docker/      # Dockerfiles
```

## Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose (optional)
- PostgreSQL 16+
- Redis 7+

### Setup

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start infrastructure (PostgreSQL + Redis)
docker compose up -d postgres redis

# Run database migrations
npm run db:migrate

# Start infrastructure and development servers
npm run dev
```

- Backend API: http://localhost:4000
- Frontend Dashboard: http://localhost:3000

### Docker (full stack)

```bash
docker compose up -d --build
```

## Development Phases (Completed)

| Phase | Scope | Status |
|-------|--------|--------|
| **1** | Backend, PostgreSQL, Redis, migrations, cities/leads schema, PM2 | ✅ |
| **2** | Playwright posting (login, images, marketplace flow, ban detection) | ✅ |
| **3** | Proxy assignment, health checks, rotation, account verification | ✅ |
| **4** | BullMQ scheduler, daily reset, create-post jobs, retry logic | ✅ |
| **5** | Inbox scraping, auto-reply, lead conversion from messages | ✅ |
| **6** | Full admin dashboard with live CRUD for all modules | ✅ |

## API Highlights

| Endpoint | Description |
|----------|-------------|
| `POST /accounts/:id/verify` | Verify account via Playwright, save cookies |
| `POST /accounts/:id/assign-proxy` | Assign or auto-assign proxy |
| `POST /proxies/:id/health-check` | Test proxy connectivity |
| `POST /proxies/rotate` | Rotate proxy for an account |
| `POST /posts/:id/execute` | Run Playwright posting job |
| `POST /inbox/check/:accountId` | Scrape inbox + auto-reply |
| `POST /leads/:id/convert` | Mark lead as converted |
| `GET /cities` | Manage target cities |

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Postgres, Redis, backend, and frontend in development |
| `npm run dev:backend` | Start backend only |
| `npm run dev:frontend` | Start frontend only |
| `npm run build` | Build all packages |
| `npm run start:pm2` | Start backend with PM2 (production) |
| `npm run db:migrate` | Run database migrations |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |

## Architecture

The backend follows **Clean Architecture** with feature-based modules:

- **Controllers** — HTTP request handling
- **Services** — Business logic
- **Repositories** — Data access layer
- **Jobs** — BullMQ background workers
- **Posting** — Playwright automation engine

## Environment Variables

See `.env.example` for all configuration options.

## License

Private — All rights reserved.
# fix-and-flow-automation
