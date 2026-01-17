# Trade Analytics Platform

An institutional-grade web-based trade analytics platform for tracking, analyzing, and journaling trades across multiple asset classes and exchanges.

## Features

- **Multi-Asset Support**: Crypto, stocks, options, futures, forex
- **FIFO P&L Calculations**: Precise profit/loss tracking using Decimal.js
- **Real-time Analytics**: Win rate, drawdown, equity curves, performance by strategy
- **Import Support**: Manual entry, Excel/CSV, CEX/DEX integrations
- **Dark Theme**: GitHub-inspired dark UI

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 (App Router) |
| API | tRPC |
| Database | Supabase (PostgreSQL) + Drizzle ORM |
| Auth | Auth0 |
| Hosting | Vercel + Supabase |
| Jobs | Inngest |
| Storage | AWS S3 |

---

## Getting Started

### Prerequisites

- **Node.js 20+** - [Download](https://nodejs.org/)
- **pnpm 9+** - Install with `npm install -g pnpm`
- **Supabase account** - [Sign up free](https://supabase.com)
- **Auth0 account** - [Sign up free](https://auth0.com)

---

## Step 1: Clone and Install

```bash
# Clone the repository
git clone <repo-url>
cd trade-platform

# Install dependencies
pnpm install
```

---

## Step 2: Set Up Supabase (Database)

### 2.1 Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **"New Project"**
3. Enter a project name (e.g., `trade-platform`)
4. Set a secure database password (save this!)
5. Select a region close to you
6. Click **"Create new project"** and wait for setup (~2 minutes)

### 2.2 Get Your Database Connection String

1. In your Supabase project, go to **Settings** (gear icon) → **Database**
2. Scroll to **Connection string** section
3. Select **URI** tab
4. Copy the connection string - it looks like:
   ```
   postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
   ```
5. Replace `[YOUR-PASSWORD]` with the password you set in step 2.1

### 2.3 Get Your Supabase API Keys

1. Go to **Settings** → **API**
2. Copy these values:
   - **Project URL** (e.g., `https://abcdefgh.supabase.co`)
   - **anon public** key (starts with `eyJ...`)

---

## Step 3: Set Up Auth0 (Authentication)

### 3.1 Create an Auth0 Application

1. Go to [auth0.com](https://auth0.com) and sign in
2. In the dashboard, go to **Applications** → **Applications**
3. Click **"+ Create Application"**
4. Enter name: `Trade Platform`
5. Select **"Regular Web Applications"**
6. Click **"Create"**

### 3.2 Configure Application Settings

In your new application's **Settings** tab:

1. **Basic Information** - Copy these values:
   - **Domain** (e.g., `your-tenant.auth0.com`)
   - **Client ID**
   - **Client Secret**

2. **Application URIs** - Set these values:

   | Field | Value |
   |-------|-------|
   | Allowed Callback URLs | `http://localhost:3000/api/auth/callback` |
   | Allowed Logout URLs | `http://localhost:3000` |
   | Allowed Web Origins | `http://localhost:3000` |

3. Scroll down and click **"Save Changes"**

### 3.3 Generate Auth0 Secret

Run this command in your terminal to generate a secure secret:

```bash
openssl rand -hex 32
```

Copy the output (64 character hex string).

---

## Step 4: Configure Environment Variables

### 4.1 Create Environment File

```bash
cp .env.example apps/web/.env.local
```

### 4.2 Fill in Your Credentials

Open `apps/web/.env.local` and fill in all values:

```bash
# ===========================================
# Supabase (PostgreSQL Database)
# ===========================================
# From Step 2.2 - Your connection string with password filled in
DATABASE_URL="postgresql://postgres.[project-ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres"

# From Step 2.3 - Your Supabase project URL
NEXT_PUBLIC_SUPABASE_URL="https://[project-ref].supabase.co"

# From Step 2.3 - Your Supabase anon key
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..."

# ===========================================
# Auth0 Authentication
# ===========================================
# From Step 3.3 - The 64-char hex string you generated
AUTH0_SECRET="your-generated-secret-here"

# Your app URL (use localhost for development)
AUTH0_BASE_URL="http://localhost:3000"

# From Step 3.2 - Your Auth0 domain with https://
AUTH0_ISSUER_BASE_URL="https://your-tenant.auth0.com"

# From Step 3.2 - Your Auth0 Client ID
AUTH0_CLIENT_ID="your-client-id"

# From Step 3.2 - Your Auth0 Client Secret
AUTH0_CLIENT_SECRET="your-client-secret"

# ===========================================
# App Configuration
# ===========================================
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

---

## Step 5: Initialize Database

Push the database schema to Supabase:

```bash
pnpm db:push
```

You should see output confirming tables were created.

---

## Step 6: Start Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

Click **"Sign In"** to authenticate via Auth0.

---

## Development Commands

```bash
pnpm dev          # Start all apps in development mode
pnpm build        # Build all apps for production
pnpm lint         # Run linting
pnpm type-check   # Run TypeScript checks
pnpm db:generate  # Generate Drizzle migrations
pnpm db:migrate   # Run migrations
pnpm db:push      # Push schema to database (dev)
pnpm db:studio    # Open Drizzle Studio GUI
```

---

## Project Structure

```
trade-platform/
├── apps/
│   ├── web/                      # Next.js 14 application
│   │   ├── src/app/              # App Router pages
│   │   ├── src/components/       # React components
│   │   └── src/lib/              # Utilities
│   └── mobile/                   # React Native (Phase 5)
│
├── packages/
│   ├── api/                      # tRPC routers
│   ├── db/                       # Drizzle schema & queries
│   ├── core/                     # Business logic (FIFO P&L, analytics)
│   ├── integrations/             # CEX/DEX adapters (Phase 2+)
│   └── ui/                       # Shared components
│
└── tooling/                      # Shared configs
```

---

## Troubleshooting

### "Invalid credentials" when pushing to database
- Double-check your `DATABASE_URL` password
- Make sure you're using the **pooler** connection string (port 6543)

### Auth0 callback error
- Verify `http://localhost:3000/api/auth/callback` is in your Auth0 Allowed Callback URLs
- Check that `AUTH0_ISSUER_BASE_URL` includes `https://`

### "Module not found" errors
- Run `pnpm install` again
- Delete `node_modules` and `.turbo` folders, then reinstall

### Database tables not created
- Run `pnpm db:push` again
- Check Supabase dashboard → Table Editor to verify tables exist

---

## Deploying to Production

### Vercel Deployment

1. Push your code to GitHub
2. Import the repository in [Vercel](https://vercel.com)
3. Set the **Root Directory** to `apps/web`
4. Add all environment variables from `.env.local`
5. Update Auth0 URLs to your production domain:
   - `AUTH0_BASE_URL` → `https://yourdomain.com`
   - Add `https://yourdomain.com/api/auth/callback` to Auth0 Allowed Callback URLs
   - Add `https://yourdomain.com` to Auth0 Allowed Logout URLs

---

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-4) - Complete
- [x] Monorepo setup (Turborepo, pnpm)
- [x] Next.js 14 with App Router
- [x] Supabase PostgreSQL with Drizzle ORM
- [x] Auth0 authentication
- [x] tRPC API
- [x] FIFO P&L calculator
- [x] Manual trade entry
- [x] Trade list and detail views
- [x] Dark theme

### Phase 2: Import + DEX (Weeks 5-8)
- [ ] Excel/CSV file upload
- [ ] Provider-specific parsers
- [ ] Duplicate detection
- [ ] Hyperliquid integration
- [ ] Polymarket integration
- [ ] Kalshi integration
- [ ] Analytics dashboard

### Phase 3: CEX + Full Analytics (Weeks 9-12)
- [ ] Binance API integration
- [ ] Coinbase OAuth integration
- [ ] Full analytics suite (Sharpe, Sortino, VaR)
- [ ] Performance grouping
- [ ] P&L heatmap calendar
- [ ] Automated sync scheduling

### Phase 4: Traditional Brokers (Weeks 13-16)
- [ ] E*Trade OAuth integration
- [ ] Schwab OAuth integration
- [ ] PWA support
- [ ] Performance optimization
- [ ] Production deployment

### Phase 5: Mobile (Post-Launch)
- [ ] React Native + Expo
- [ ] Push notifications
- [ ] App Store submission

---

## License

Private - All rights reserved.
