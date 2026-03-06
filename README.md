# Trading Journal Pro

A professional trading journal with **Supabase** database and **Gemini AI** analysis.

---

## Quick Start

### 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the contents of `SUPABASE_SCHEMA.sql`
3. This creates all tables and pre-loads 43 instruments

### 2. Set up Gemini

1. Get an API key at [Google AI Studio](https://aistudio.google.com)

### 3. Configure environment

Copy `.env.example` to `.env` and fill in your keys:

```bash
cp .env.example .env
```

```env
PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJh...
GEMINI_API_KEY=AIza...
```

### 4. Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Features

- **Dashboard** — Key metrics, monthly P&L, recent trades
- **Trade Log** — Full CRUD with auto-calculated P&L, R:R, outcomes
- **Analytics** — Gemini-powered 9-module AI analysis, plan adherence, emotion/condition breakdown
- **Advanced Analytics** — Sharpe, Sortino, Calmar, Monte Carlo (1,000 sims), Kelly Criterion, MAE/MFE, equity curve
- **Calendar** — Visual daily P&L calendar view
- **Settings** — Multi-account management, strategy builder with checklists

## Technology Stack

- **Frontend**: SvelteKit 2 + TypeScript + TailwindCSS
- **Database**: Supabase (PostgreSQL)
- **AI**: Google Gemini 1.5 Flash
- **Deployment**: Any Node.js host (Vercel, Railway, Fly.io)

## Deployment

```bash
npm run build
# Deploy the build/ folder to your Node.js host
```

For Vercel, install `@sveltejs/adapter-vercel` instead of `adapter-node`.
