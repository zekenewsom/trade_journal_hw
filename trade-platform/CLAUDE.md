# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Development Commands

### Core Commands
- `pnpm install` - Install dependencies for all packages
- `pnpm dev` - Start development server with Turbo
- `pnpm build` - Build all packages and apps
- `pnpm lint` - Run ESLint across all packages
- `pnpm type-check` - Run TypeScript type checking

### Database Commands
- `pnpm db:generate` - Generate Drizzle migrations
- `pnpm db:migrate` - Run pending migrations
- `pnpm db:push` - Push schema directly (dev only)
- `pnpm db:studio` - Open Drizzle Studio GUI

## Architecture Overview

This is a **pnpm monorepo** using **Turborepo** for build orchestration.

### Package Structure

```
trade-platform/
├── apps/
│   └── web/                      # Next.js 14 App Router
│       └── src/
│           ├── app/              # Route handlers and pages
│           ├── components/       # React components
│           ├── lib/              # Utilities
│           └── trpc/             # tRPC client setup
│
├── packages/
│   ├── api/                      # tRPC routers
│   │   └── src/routers/          # Individual routers (trades, analytics, etc.)
│   │
│   ├── core/                     # Business logic (SHARED)
│   │   └── src/
│   │       ├── pnl/              # FIFO P&L calculations
│   │       ├── financial/        # Decimal.js utilities
│   │       ├── validation/       # Zod schemas
│   │       └── analytics/        # Analytics calculations
│   │
│   ├── db/                       # Database layer
│   │   └── src/
│   │       ├── schema/           # Drizzle schema definitions
│   │       └── client.ts         # Database client
│   │
│   └── integrations/             # CEX/DEX adapters (Phase 2+)
```

### Key Architecture Patterns

#### tRPC API Layer
- **Type-safe API**: End-to-end type safety from database to frontend
- **Router Organization**: Separate routers per domain (trades, analytics, imports)
- **Procedures**: Query for reads, mutation for writes
- **Context**: Contains db client and user session

#### Database Layer (Drizzle ORM)
- **Schema Location**: `packages/db/src/schema/`
- **Multi-tenancy**: All tables have `org_id` for organization isolation
- **Migrations**: Use `pnpm db:generate` then `pnpm db:migrate`
- **Types**: Export inferred types from schema definitions

#### Business Logic (Core Package)
- **Financial Precision**: Always use Decimal.js for money calculations
- **FIFO P&L**: `packages/core/src/pnl/` - ported from Electron app
- **Validation**: Zod schemas in `packages/core/src/validation/`
- **Shared Types**: `packages/core/src/types/` for cross-package types

#### Frontend (Next.js 14)
- **App Router**: All routes in `apps/web/src/app/`
- **Server Components**: Default for pages, use 'use client' sparingly
- **tRPC Integration**: Server-side via `@/trpc/server`, client via `@/trpc/react`
- **Shadcn/ui**: Pre-built accessible components

## Critical Integration Points

### Adding a New Feature

1. **Database Schema**:
   - Add table in `packages/db/src/schema/`
   - Export from `packages/db/src/schema/index.ts`
   - Run `pnpm db:generate && pnpm db:push`

2. **API Router**:
   - Create router in `packages/api/src/routers/`
   - Add to root router in `packages/api/src/root.ts`
   - Define Zod input schemas

3. **Frontend**:
   - Create page in `apps/web/src/app/`
   - Use tRPC hooks: `api.routerName.procedureName.useQuery()`

### P&L Calculations

**CRITICAL**: Always use the core package functions for financial calculations.

```typescript
// CORRECT
import { calculateTradePnlFifo } from "@trade-platform/core/pnl";
import { add, subtract, multiply, divide } from "@trade-platform/core/financial";

// WRONG - Never use native JS arithmetic for money
const pnl = sellPrice - buyPrice; // Floating point errors!
```

### Validation

Use Zod schemas from core for all user input:

```typescript
import { tradeInputSchema, transactionInputSchema } from "@trade-platform/core/validation";
```

## Styling Conventions

- **Tailwind CSS**: Primary styling approach
- **Shadcn/ui**: Use for all standard UI components
- **Dark Theme**: Default and only theme (dark mode only)
- **CSS Variables**: Theme tokens in `globals.css`

## Environment Variables

Required for development:
- `DATABASE_URL` - Supabase PostgreSQL connection string
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `AUTH0_SECRET` - Auth0 session secret (generate with `openssl rand -hex 32`)
- `AUTH0_BASE_URL` - Your app URL (http://localhost:3000 for dev)
- `AUTH0_ISSUER_BASE_URL` - Auth0 tenant URL
- `AUTH0_CLIENT_ID` - Auth0 client ID
- `AUTH0_CLIENT_SECRET` - Auth0 client secret

See `.env.example` for full list.

## Testing

- **Core Package**: Unit tests with Vitest for P&L calculations
- **API**: Integration tests for tRPC procedures
- **E2E**: Playwright for critical user flows (planned)

## Common Tasks

### Adding a new database table
1. Create schema file in `packages/db/src/schema/`
2. Add relations if needed
3. Export from `packages/db/src/schema/index.ts`
4. Run `pnpm db:push` (dev) or `pnpm db:generate && pnpm db:migrate` (prod)

### Adding a new API endpoint
1. Create or modify router in `packages/api/src/routers/`
2. Define input schema with Zod
3. Implement procedure (query or mutation)
4. Use from frontend: `api.router.procedure.useQuery()` or `.useMutation()`

### Adding a new page
1. Create folder in `apps/web/src/app/`
2. Add `page.tsx` (server component by default)
3. Add `loading.tsx` for suspense fallback if needed
4. Use layout from parent or create new `layout.tsx`

## Performance Considerations

- **Server Components**: Use by default, only add 'use client' when needed
- **Data Fetching**: Fetch data in server components when possible
- **Streaming**: Use `<Suspense>` for progressive loading
- **Query Optimization**: Use Drizzle's query builder for efficient JOINs

## Security Notes

- **Input Validation**: All tRPC procedures validate input with Zod
- **Auth**: Auth0 handles authentication, middleware protects routes
- **Multi-tenancy**: Always filter by `org_id` in database queries
- **Secrets**: Never commit `.env.local`, use `.env.example` as template
