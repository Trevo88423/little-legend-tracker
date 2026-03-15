# Little Legend Tracker

A care tracker built for families with medically complex babies. Track medications, feeds, weight, and more — designed for sleep-deprived parents juggling syringes at 3am.

## Features

- **Medication Tracking** — Schedule meds by time slot, mark as given, track who administered what and when
- **Feeding Log** — Log bottle, tube, and breast feeds with daily totals
- **Weight Chart** — Track weight over time with a visual trend chart
- **Notes** — Timestamped care notes for handovers and hospital visits
- **Custom Trackers** — Track anything (nappies, temperature, oxygen levels)
- **PDF Reports** — Generate medication schedules, daily summaries, and weekly reports for doctors
- **Multi-Parent Sync** — Real-time sync between parents via family PIN system
- **PWA** — Install on your phone, works offline

## The Story

Built by parents of Matteo, a baby diagnosed with ALCAPA (Anomalous Left Coronary Artery from the Pulmonary Artery) — a rare congenital heart defect requiring open-heart surgery at 5 months old. Managing 6+ daily medications across two parents, hospital handovers, and specialist appointments demanded a better tool than spreadsheets and text messages.

Little Legend Tracker is that tool, now available for any family navigating the same journey.

## Tech Stack

- **Frontend:** React 18 + Vite, React Router v6
- **Backend:** Supabase (PostgreSQL, Auth, Realtime, Row Level Security)
- **PDF Generation:** jsPDF (client-side)
- **Hosting:** Vercel

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project

### Setup

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your Supabase URL and anon key

# Run database migration
# Copy contents of database/001_schema.sql into Supabase SQL Editor and execute

# Start dev server
npm run dev
```

### Environment Variables

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anonymous/public key |

## Project Structure

```
src/
├── components/
│   ├── auth/          # ProtectedRoute
│   ├── dashboard/     # DashboardView
│   ├── medications/   # MedsView
│   ├── feeding/       # FeedingView
│   ├── weight/        # WeightView, canvas chart
│   ├── notes/         # NotesView
│   ├── trackers/      # TrackersView, custom tracker cards
│   ├── history/       # HistoryView, activity log
│   ├── settings/      # SettingsView, med management
│   ├── reports/       # ReportsView, PDF generation
│   └── layout/        # LoadingScreen
├── contexts/          # AuthContext, FamilyContext, TrackerContext
├── hooks/             # useNotifications, usePWA, useOfflineQueue
├── lib/               # supabase client, utils, constants, pdfGenerator
├── pages/             # Landing, Login, Signup, JoinFamily, TrackerApp, etc.
├── styles/            # CSS (variables, tracker, auth, landing)
└── App.jsx            # Router setup
database/
└── 001_schema.sql     # Full schema with RLS policies
```

## Multi-Tenant Architecture

All data is isolated by `family_id` + `child_id`. Row Level Security (RLS) policies ensure users can only access their own family's data. The `user_belongs_to_family()` helper function checks membership on every query.

## License

MIT
