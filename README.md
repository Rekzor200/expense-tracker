# Expense Tracker v0.3.0

A modern Windows desktop app for personal finance visibility.

Track spending, income, receipts, and your crypto portfolio in one place, with local-first storage and a fast desktop UX.

## Why This App

- Built for speed: quick capture, clear monthly snapshots, practical analytics.
- Built for privacy: your data stays on your machine.
- Built for reliability: offline-first behavior with local caching and backup/restore.

## Highlights

- Expense and income tracking with categories and budgets.
- Dashboard with monthly totals, net balance, category breakdown, and budget signals.
- Transactions workspace with search, filters, edit/delete, and fast entry modal.
- Receipt OCR flow (local extraction via `tesseract.js`) with review before save.
- Analytics page with period comparisons and trend charts.
- Crypto Portfolio page (BTC, ETH, SOL):
  - Manual holdings input
  - Cached market pricing (USD/EUR) and EUR->RON conversion
  - USD/RON valuation toggle
  - Stale-data signaling for offline scenarios
- JSON full backup/restore and CSV export.
- Dark/light theme and polished desktop UI.

## Tech Stack

- Desktop shell: `Tauri v2` (Rust)
- Frontend: `React 19` + `TypeScript` + `Vite`
- Styling/UI: `Tailwind CSS v4` + `shadcn/ui` + `Radix`
- Charts: `Recharts`
- Storage: `SQLite` via `@tauri-apps/plugin-sql`
- OCR: `tesseract.js`

## Windows-Only Prerequisites

- Node.js `18+`
- Rust (`rustup`)
- Visual Studio Build Tools 2022 with **Desktop development with C++**

Optional custom install path for Build Tools:

```bash
vs_BuildTools.exe --installPath "E:\VS\2022\BuildTools"
```

## Run Locally

```bash
# install dependencies
npm install

# run desktop app in development
npm run tauri dev

# run unit tests
npm test

# build production installer (MSI/NSIS)
npm run tauri build
```

## Data Storage and Privacy

All app data is stored locally under:

- `%APPDATA%/com.messiah.expense-tracker/`
- SQLite database: `expense-tracker.db`
- Receipt images: `receipts/`

No wallet connections and no cloud sync in this MVP.

## Project Layout

```text
src/
  components/
  pages/              # dashboard, transactions, categories, portfolio, analytics, settings
  hooks/
  lib/
    db/               # schema, migrations, queries
    domain/           # shared types and calculations
    receipt/          # OCR + receipt image handling
    portfolio/        # crypto/FX fetch + cache + portfolio snapshot logic
src-tauri/
  src/                # Rust runtime + commands
  capabilities/       # Tauri v2 permission model
```

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| Ctrl+K | Open command palette (Dashboard only) |
| Enter | Save in focused modal form |

## Roadmap (Near Term)

- Stronger portfolio source redundancy for price feeds.
- Expanded validation and test coverage around backup/import.
- Additional insights and automation for recurring patterns.
