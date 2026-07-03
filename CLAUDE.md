# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**رصد (Rasd)** — a personal finance / wealth management app (Arabic, RTL) covering wallets, expenses,
debts owed to/by contacts, recurring expenses, unified assets & investments, Zakat calculation,
reports, and reminders/events. Built and edited via **Lovable** (see `.lovable/`), backed by
**Lovable Cloud (Supabase)**, and shipped to Android via **Capacitor**.

## Commands

```bash
bun install          # install deps (bun.lock is the lockfile of record)
bun run dev           # vite dev server
bun run build          # production build
bun run build:dev      # dev-mode build
bun run preview        # preview a build
bun run lint            # eslint .
bun run format           # prettier --write .

# Android (Capacitor)
bun run android:add      # add android platform (first time only)
bun run android:assets    # generate icons/splash from resources/icon.png, resources/splash.png
bun run android:sync       # build + cap sync android
bun run android:open        # open Android Studio
bun run android:run          # sync + run on device/emulator
```

There is no test suite configured in this repo (no test script, no vitest/jest config).

## Architecture

### Stack
TanStack Start (file-based router, SSR) + React 19 + Vite + Tailwind v4 + shadcn/ui (Radix) +
TanStack Query + Supabase (Lovable Cloud) + Capacitor (Android wrapper).

### Routing (`src/routes/`)
File-based routing via TanStack Start — see `src/routes/README.md` for the naming conventions
(`$id` for dynamic segments, `{-$cat}` optional, `_layout` for layouts, `__root.tsx` as the app
shell). **Never** create `src/pages/` or Next/Remix-style paths. `routeTree.gen.ts` is
auto-generated — don't hand-edit it.

All authenticated pages live under `src/routes/_authenticated/` and are prefixed `app.*`
(e.g. `app.wallets.tsx` → `/app/wallets`). `_authenticated/route.tsx` is the shared shell: it
guards the whole subtree in `beforeLoad` (redirects to `/auth` if no Supabase session), renders the
sidebar/bottom-nav (`NAV` array — add new sections here), and wraps pages in `PageTransition`.

Top-level sections (see `NAV` in `_authenticated/route.tsx`): dashboard (`app.index`), people/debts
(`app.people`), wallets (`app.wallets`), expenses (`app.expenses`), recurring expenses
(`app.recurring`), investments/assets (`app.investments`), zakat (`app.zakat`), reports
(`app.reports`), events (`app.events`), contacts (`app.contacts`), settings (`app.settings`).

### Data layer
- `src/integrations/supabase/client.ts` — lazily-constructed browser Supabase client (proxy pattern
  so import-time doesn't require env vars). `types.ts` is **auto-generated** from the Supabase
  schema — never hand-edit it; regenerate after migrations.
- `src/integrations/supabase/auth-middleware.ts` / `client.server.ts` — also auto-generated;
  provide a `requireSupabaseAuth` TanStack Start server middleware that validates the `Authorization:
  Bearer` header and injects `{ supabase, userId, claims }` into server function context.
- For server-side logic prefer TanStack Start `createServerFn` (see `src/lib/api/example.functions.ts`)
  over Supabase Edge Functions. Files ending `.server.ts` are tree-shaken from the client bundle;
  module-level code in a normal `.ts` file still ships to the client even if only used in a handler.
- Database changes go through numbered SQL files in `supabase/migrations/`. All tables use
  row-level security keyed on `auth.uid() = user_id`.

### Domain model — unified Assets/Investments
The `investments` + `investment_transactions` tables act as a **unified asset ledger** (cars, real
estate, gold, stocks, crypto, funds, generic "custom" assets), not just financial investments.
Each transaction has a `tx_class`: `capex | opex | income | adjustment | personal_benefit | sale`.
- `src/lib/assets/calculator.ts` — pure function `computeAssetMetrics(asset, txs)` derives book
  value, market value, net cashflow, realized/unrealized P&L from the transaction list. This is the
  single source of truth for asset financials; don't recompute it inline elsewhere.
- `src/lib/assets/depreciation.ts` — depreciation schedules for book value.
- `src/lib/assets/zakat-asset.ts` — `computeAssetZakat()` layers Zakat-specific rules (market vs.
  book vs. custom valuation method, scope) on top of `computeAssetMetrics`, using
  `classifyAsset()` from `src/lib/zakat/engine.ts` for the zakatable/not-zakatable default. This
  module is read-only/analytical — it never writes transactions or balances.
- OpEx transactions on an asset are surfaced in `/app/expenses` (merged with regular `expenses` rows,
  tagged "من أصل: …") via a `tx_class = 'opex'` filter on `investment_transactions`.
- `src/lib/zakat/engine.ts` — pure Zakat utilities: Hijri/Gregorian haul-date math
  (`nextZakatDate`) and `classifyAsset()` (asset type + purpose → zakatable or not).

### Other core lib modules
- `src/lib/wallet-balance.ts` / `wallet-sync.ts` — wallet balance computation/reconciliation.
- `src/lib/backup/engine.ts` — full data export/import (backup/restore).
- `src/lib/events/engine.ts` — reminders/upcoming-events logic backing `/app/events` and the
  dashboard's `UpcomingEventsWidget`.
- `src/lib/statement.ts` / `export-statement.ts` — account statement generation/export (PDF via
  jspdf/jspdf-autotable, Excel via xlsx).
- `src/lib/ads/` — ad provider abstraction (`AdSlot` component reads from `ad-context.tsx`).

### Styling / UI conventions
- RTL-first Arabic UI. Layout uses logical properties (`ms-*`, `pe-*`, `inset-y-0 right-0`, etc.)
  rather than `left`/`right` physical classes — preserve this when touching layout.
  shadcn/ui primitives live in `src/components/ui/`; compose from there rather than reaching for
  raw Radix.
- Motion primitives (`src/components/motion/`: `FadeIn`, `StaggerGrid`, `PageTransition`,
  `Counter`) wrap `framer-motion` — reuse them for consistency instead of ad hoc animation.

### Mobile (Capacitor)
See `MOBILE_BUILD.md` for the full Android build/release flow. App id `app.lovable.rasd`. Icon/
splash source assets are `resources/icon.png` / `resources/splash.png`; run
`bun run android:assets` after changing them, never hand-edit generated Android res folders.
For a release build, comment out the `server` block in `capacitor.config.ts` (disables live reload
against the Lovable sandbox) before building the signed AAB.

### Vite config
`vite.config.ts` is intentionally minimal — `@lovable.dev/vite-tanstack-config` already wires up
TanStack Start/Router, React, Tailwind, tsconfig-paths, Nitro (Cloudflare target by default),
env injection, and dedupe. Don't re-add any of those plugins manually (see the comment at the top
of the file); pass extra config through `defineConfig({ vite: { ... } })` instead.
