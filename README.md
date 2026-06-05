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

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Postgres, Redis, backend, and frontend in development |
| `npm run dev:backend` | Start backend only |
| `npm run dev:frontend` | Start frontend only |
| `npm run build` | Build all packages |
| `npm run start` | Start production backend |
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
