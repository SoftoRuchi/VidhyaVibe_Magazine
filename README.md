# Magazine Subscription & Distribution — Monorepo

Enterprise-grade monorepo scaffold for a Magazine Subscription + Physical Distribution Platform.

Tech stack:

- Next.js 14 (App Router) + TypeScript (strict)
- Ant Design
- Prisma (MySQL)
- Node.js (Express) backend — modular clean architecture
- Redis
- S3-compatible object storage (MinIO/S3)

Monorepo layout:

- apps/web
- apps/admin
- services/api
- packages/db
- packages/ui
- packages/config

Features:

- ESLint, Prettier, Husky, lint-staged
- Env validation (Zod)
- Provider adapter pattern for storage/cache/db
- Docker + Docker Compose + Nginx reverse proxy

See docs in each package for usage and bootstrapping.

## Quick start

```bash
# Install dependencies (from repo root)
pnpm install

# Build all packages
pnpm run build

# Run API (requires DATABASE_URL)
DATABASE_URL='mysql://user:pass@127.0.0.1:3306/magazine' pnpm run dev:api

# Run web app
pnpm run dev:web

# Prisma (from packages/db)
cd packages/db

# Generate Prisma client
pnpm run generate

# Apply migrations (uses ../../.env)
pnpm run migrate:deploy
```

Copy `.env.example` to `.env` and set `DATABASE_URL` for the API. Run `pnpm run migrate:deploy` in `packages/db` to apply migrations.

Optional JWT vars in `.env` (or dev defaults are used):

```env
JWT_ACCESS_SECRET=dev-access-secret-min-10-chars
JWT_REFRESH_SECRET=dev-refresh-secret-min-10-chars
JWT_ACCESS_EXPIRES=15m
PORT=2034
```

# Run Admin (http://localhost:3000 — proxies /api to API on PORT, default 2034)

pnpm --filter apps-admin dev

Production manual deploy (fix ChunkLoadError / blank page): see `deployment/DEPLOY-MANUAL.md`.
