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
│           │   ├── (dashboard)/  # Protected dashboard routes
│           │   │   ├── analytics/    # Analytics dashboard
│           │   │   ├── trades/       # Trade list and detail views
│           │   │   ├── integrations/ # CEX/DEX connections
│           │   │   └── settings/     # User settings
│           │   └── api/          # API routes (tRPC, auth)
│           ├── components/       # React components (shadcn/ui)
│           ├── lib/              # Utilities (formatting, cn)
│           └── trpc/             # tRPC client setup
│
├── packages/
│   ├── api/                      # tRPC routers
│   │   └── src/routers/
│   │       ├── trades.ts         # Trade CRUD, P&L calculations
│   │       ├── transactions.ts   # Transaction management
│   │       ├── analytics.ts      # Analytics aggregation
│   │       ├── integrations.ts   # CEX/DEX sync
│   │       ├── strategies.ts     # Trading strategy management
│   │       └── emotions.ts       # Trade emotion tracking
│   │
│   ├── core/                     # Business logic (SHARED)
│   │   └── src/
│   │       ├── pnl/              # FIFO P&L calculations
│   │       ├── financial/        # Decimal.js arithmetic utilities
│   │       ├── validation/       # Zod schemas for all inputs
│   │       ├── analytics/        # Analytics engine (institutional metrics)
│   │       └── types.ts          # Shared TypeScript types
│   │
│   ├── db/                       # Database layer
│   │   └── src/
│   │       ├── schema/           # Drizzle schema definitions
│   │       │   ├── trades.ts     # Trades and transactions
│   │       │   ├── users.ts      # Users and organizations
│   │       │   ├── strategies.ts # Strategy definitions
│   │       │   ├── emotions.ts   # Emotion tracking
│   │       │   └── integrations.ts # Exchange connections
│   │       └── client.ts         # Database client
│   │
│   └── integrations/             # CEX/DEX adapters
│       └── src/
│           └── hyperliquid/      # Hyperliquid DEX integration
│               ├── client.ts     # API client
│               └── transformer.ts # Data transformation
│
└── tooling/                      # Shared configs (ESLint, TypeScript, Tailwind)
```

## Key Technical Patterns

### Multi-Tenancy
- All data is isolated by `org_id` (organization ID)
- Users belong to organizations via `org_members` table
- Every database query MUST filter by `org_id` for security
- The `getUserOrgId()` helper in routers handles org lookup from Auth0 user ID

### FIFO P&L Calculation
- Located in `packages/core/src/pnl/index.ts`
- Uses Decimal.js for financial precision (never native JS arithmetic)
- Key functions:
  - `calculateTradePnlFifo()` - Main P&L calculator
  - `shouldCloseTrade()` - Determines if trade is fully closed
  - `calculateOpenPositionSize()` - Calculates remaining open quantity
- Trade status is auto-fixed in `trades.list` query to ensure consistency

### Analytics Engine
- Located in `packages/core/src/analytics/index.ts`
- Calculates institutional-grade metrics:
  - **Risk-adjusted returns**: Sharpe ratio, Sortino ratio, Calmar ratio
  - **Performance ratios**: Profit factor, expectancy, payoff ratio, Kelly criterion
  - **Drawdown analysis**: Max drawdown, average drawdown, drawdown periods
  - **Trade statistics**: Win rate, streaks, duration metrics
  - **Volatility metrics**: Return volatility, downside deviation, Ulcer index
  - **Time-based breakdowns**: By month, day of week, hour of day

### Database Schema (Drizzle ORM)
Key tables:
- `users` - Auth0 user records
- `organizations` - Multi-tenant organizations
- `org_members` - User-organization relationships
- `trades` - Trade records with metadata
- `transactions` - Individual buy/sell transactions
- `strategies` - Trading strategy definitions
- `emotions` - Emotion tracking for trades
- `integration_connections` - CEX/DEX API credentials

### tRPC API Layer
- Type-safe from database to frontend
- Protected procedures require Auth0 session
- Router organization:
  - `trades` - Trade list, detail, status recalculation
  - `transactions` - Add/edit/delete transactions
  - `analytics` - Aggregated analytics with filters
  - `integrations` - List connections, sync, import
  - `strategies` - CRUD for strategies
  - `emotions` - Emotion definitions

## Critical Code Patterns

### Financial Arithmetic
**ALWAYS use Decimal.js utilities from core package:**

```typescript
// CORRECT
import { toDecimal, add, subtract, multiply, divide, toString } from "@trade-platform/core/financial";
const total = add(toDecimal(price), toDecimal(fee));

// WRONG - Never use native JS arithmetic for money
const total = price + fee; // Floating point errors!
```

### Trade Status Logic
Trade status is determined by transaction analysis, not stored values:

```typescript
import { shouldCloseTrade } from "@trade-platform/core/pnl";

// Returns true if open position size is effectively zero
const isClosed = shouldCloseTrade(transactions, tradeDirection);
```

The `trades.list` router auto-fixes mismatched statuses.

### Input Validation
All user inputs are validated with Zod schemas:

```typescript
import { tradeInputSchema, transactionInputSchema } from "@trade-platform/core/validation";
```

## Frontend Patterns

### Page Structure
- Server components by default (no 'use client' directive)
- Client components only for interactivity (forms, modals, filters)
- Data fetching in server components via `api.router.procedure()`

### tRPC Usage
```typescript
// Server component
import { api } from "@/trpc/server";
const trades = await api.trades.list();

// Client component
import { api } from "@/trpc/react";
const { data: trades, isLoading } = api.trades.list.useQuery();
```

### Styling
- Tailwind CSS for all styling
- shadcn/ui components in `src/components/ui/`
- Dark theme only (GitHub-inspired)
- CSS variables for theme tokens in `globals.css`

### Formatting Utilities
Located in `apps/web/src/lib/format.ts`:
- `formatCurrency()` - Format money values
- `formatDate()` - Format dates consistently
- `formatNumber()` - Format numbers with options
- `formatPercent()` - Format percentages
- `formatDuration()` - Format time durations

## Integration Architecture

### Adding a New Exchange Integration

1. **Create adapter in `packages/integrations/src/<exchange>/`**:
   - `client.ts` - API client with authentication
   - `transformer.ts` - Transform exchange data to standard format

2. **Add to integrations router**:
   - Add sync function in `packages/api/src/routers/integrations.ts`
   - Handle credential storage and trade import

3. **Update UI**:
   - Add exchange option in integrations page
   - Add connection form with required credentials

### Current Integrations
- **Hyperliquid**: DEX integration via public API
  - Fetches fills (trades) by wallet address
  - Transforms to standard transaction format
  - Supports incremental sync (since last timestamp)

## Common Development Tasks

### Adding a New Database Table
1. Create schema in `packages/db/src/schema/<table>.ts`
2. Add relations if needed
3. Export from `packages/db/src/schema/index.ts`
4. Run `pnpm db:push` (dev) or `pnpm db:generate && pnpm db:migrate` (prod)

### Adding a New API Endpoint
1. Create/modify router in `packages/api/src/routers/`
2. Define input schema with Zod
3. Implement procedure (query or mutation)
4. Add to root router if new file
5. Use from frontend: `api.router.procedure.useQuery()` or `.useMutation()`

### Adding a New Page
1. Create folder in `apps/web/src/app/(dashboard)/`
2. Add `page.tsx` (server component by default)
3. Add `loading.tsx` for suspense fallback
4. Use layout from parent or create new `layout.tsx`

### Adding New Analytics Metrics
1. Add type definition in `packages/core/src/types.ts` (AnalyticsData interface)
2. Implement calculation in `packages/core/src/analytics/index.ts`
3. Update analytics router if needed
4. Display in analytics dashboard

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

## Security Notes

- **Input Validation**: All tRPC procedures validate input with Zod
- **Auth**: Auth0 handles authentication, middleware protects routes
- **Multi-tenancy**: Always filter by `org_id` in database queries
- **Secrets**: Never commit `.env.local`, use `.env.example` as template
- **API Keys**: Integration credentials stored encrypted in database

## Performance Considerations

- **Server Components**: Use by default, only add 'use client' when needed
- **Data Fetching**: Fetch data in server components when possible
- **Streaming**: Use `<Suspense>` for progressive loading
- **Query Optimization**: Use Drizzle's query builder for efficient JOINs
- **Decimal.js**: Used for precision but has performance overhead - acceptable for financial accuracy

## Known Issues / Technical Debt

- Unrealized P&L requires price feeds (not yet implemented)
- Excel/CSV import not yet implemented
- Some TypeScript strict mode issues in db/integrations packages
- Integration sync is manual (Inngest scheduled jobs planned)
