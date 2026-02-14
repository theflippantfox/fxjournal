# FX Trading Journal

## Overview
A trading journal application built with SvelteKit for tracking forex/crypto/indices trades. Users can log trades, view analytics, manage accounts and instruments, and review performance through a dashboard.

## Tech Stack
- **Frontend/Backend**: SvelteKit (Svelte 5) with Vite
- **Styling**: Tailwind CSS 4
- **Database**: SQLite via better-sqlite3 + Drizzle ORM
- **Package Manager**: pnpm
- **Adapter**: @sveltejs/adapter-node (for production deployment)

## Project Structure
- `src/routes/` - SvelteKit routes (dashboard, journal, log, accounts, analytics, calendar, settings)
- `src/routes/api/` - API endpoints (accounts, trades, instruments, active-account)
- `src/lib/server/` - Server-side code (storage.ts for JSON file storage, db/ for Drizzle/SQLite)
- `src/lib/stores/` - Svelte stores for state management
- `src/lib/components/` - Reusable UI components
- `static/` - Static assets

## Environment Variables
- `SQLITE_URL` - Path to the SQLite database file (default: `local.db`)

## Data Storage
The app uses two storage mechanisms:
1. **SQLite** (via Drizzle ORM) - for tasks table
2. **JSON files** (in `src/lib/server/data/`) - for trades, accounts, instruments, and active-account

## Running
- **Dev**: `pnpm dev` (runs on port 5000)
- **Build**: `pnpm build`
- **Production**: `node build`

## Recent Changes
- Configured for Replit environment (port 5000, allowed hosts)
- Renamed DATABASE_URL to SQLITE_URL (DATABASE_URL is reserved by Replit runtime)
- Switched from adapter-auto to adapter-node for deployment
- Approved better-sqlite3 native builds in pnpm config
