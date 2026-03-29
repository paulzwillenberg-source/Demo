# PMIP — Personal Media Intelligence Platform

A sovereign, personalised media intelligence layer that aggregates, analyses, and synthesises the news that matters.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | Node.js / Express (TypeScript) |
| Database | PostgreSQL + Prisma ORM |
| AI | Anthropic Claude (sonnet-4-6 / haiku-4-5) |
| Email | Resend |
| Scheduling | node-cron |

## Quick Start

### 1. Install dependencies

```bash
cd pmip
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and fill in your API keys
```

Minimum required for local development (mock data works without API keys):
```
SESSION_TOKEN=any-random-string
```

For full functionality:
```
ANTHROPIC_API_KEY=sk-ant-...        # AI summarisation + briefings
DATABASE_URL=postgresql://...        # PostgreSQL connection
RESEND_API_KEY=re_...               # Email delivery
BRIEFING_EMAIL=you@example.com      # Where briefings are sent
KALSHI_API_KEY=...                  # Prediction market data (optional)
GMAIL_CLIENT_ID=...                 # Newsletter ingestion (optional)
GMAIL_CLIENT_SECRET=...
GMAIL_REFRESH_TOKEN=...
```

### 3. Database setup (optional — app runs on mock data without it)

```bash
cd backend
npm run db:migrate
npm run db:generate
```

### 4. Run

```bash
# From pmip/ root — runs both frontend and backend
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- Health check: http://localhost:3001/health

## Features

- **Home Feed** — Two-column card grid, reverse chronological, all sources
- **Topic Filter Bar** — Dynamic cluster tags with hot-topic 🔥 indicators
- **Story Panel** — Right slide-over with AI summary (narrative, key points, why it matters, what to watch)
- **Prediction Markets** — Kalshi contracts matched to stories inline
- **Newsletter Reader** — Gmail OAuth ingestion, original HTML preserved
- **Macro Briefing** — Quadri-daily (06:00/12:00/18:00/00:00) + email delivery
- **Save & Share** — Star stories, share to WhatsApp
- **Dark Mode** — Full dark mode via CSS variables, persisted to localStorage

## Architecture

```
pmip/
├── backend/
│   ├── src/
│   │   ├── index.ts          # Express server
│   │   ├── config.ts         # Environment config
│   │   ├── routes/           # API route handlers
│   │   ├── services/         # Business logic (ingest, summarize, cluster, briefing, kalshi, email)
│   │   └── jobs/             # Cron jobs (ingest every 5min, cluster every 15min, briefing quadri-daily)
│   └── prisma/
│       └── schema.prisma     # Data model
└── frontend/
    └── src/
        ├── components/
        │   ├── layout/       # Sidebar, TopBar, TopicFilterBar
        │   ├── feed/         # FeedCard, FeedGrid, StoryPanel
        │   ├── briefing/     # BriefingModal
        │   ├── newsletter/   # NewsletterPanel
        │   └── kalshi/       # KalshiContracts
        ├── stores/           # Zustand state store
        └── lib/              # API client + types
```

## Development Notes

- Without API keys configured, the app runs on realistic mock data (20 sources, 20 stories across 8 topic clusters)
- The mock briefing and Kalshi contracts are pre-populated for immediate UI exploration
- Dark mode preference and sidebar state persist to localStorage
- The frontend proxies `/api/*` to the backend in dev mode via Vite's proxy config
