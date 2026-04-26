# Rove

A mobile-first vocal check-in app. Record short clips, get pitch-range analysis, track progress over time.

## Stack

- **Mobile**: React Native + Expo (TypeScript)
- **Backend**: FastAPI (Python) for DSP / pitch analysis
- **Database & Auth**: Supabase (Postgres, Auth, Storage, Realtime)

## Project Structure

```
rove/
├── apps/
│   ├── mobile/          # Expo app
│   └── api/             # FastAPI service (pitch detection)
├── supabase/
│   ├── migrations/      # SQL schema migrations
│   └── seed.sql         # Initial prompt data
└── package.json         # Yarn workspace root
```

## Setup

### Prerequisites

- Node 20+
- Yarn
- Python 3.10+ with [`uv`](https://github.com/astral-sh/uv)
- A Supabase project (hosted or local)
- Expo Go on a physical device (recommended for audio recording)

### 1. Environment files

```bash
cp apps/mobile/.env.example apps/mobile/.env
cp apps/api/.env.example apps/api/.env
```

Fill in the Supabase URL and keys from your project's API settings.

### 2. Database

In the Supabase dashboard SQL editor, run each file in order:

1. `supabase/migrations/20240101000000_initial_schema.sql`
2. `supabase/migrations/20240102000000_add_indexes.sql`
3. `supabase/migrations/20240103000000_cascade_deletes.sql`
4. `supabase/seed.sql`

Or use `psql`:
```bash
psql "$DATABASE_URL" -f supabase/migrations/20240101000000_initial_schema.sql
# repeat for each file
```

### 3. Install dependencies

```bash
yarn install                                      # mobile deps
cd apps/api && uv sync && cd -                    # API deps
```

## Running

**Mobile (Expo)**
```bash
yarn mobile
```
Scan the QR code with Expo Go on your iPhone.

**API**
```bash
yarn api
```
Runs on `http://localhost:8000`.

For the mobile app to reach the API on a device, set `EXPO_PUBLIC_FASTAPI_URL` to your machine's LAN IP (e.g. `http://192.168.1.42:8000`) in `apps/mobile/.env`.

## Auth

Email + password. New signups receive a confirmation email; existing users log in directly.

## Lint

```bash
yarn eslint
```
