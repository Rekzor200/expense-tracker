<p align="center">
  <a href="https://github.com/Rekzor200/expense-tracker/releases">
    <img src="src/assets/github%20banner.png" alt="Expense Tracker banner" />
  </a>
</p>

# Expense Tracker

Expense Tracker is a fast, modern Windows desktop app for managing personal finances with privacy-first, local storage.

Track expenses and income, scan receipts with OCR, monitor budgets, and view clear monthly analytics in one place.

## Why People Use It

- Fast workflow for daily money tracking
- Clean dashboard for monthly clarity
- Local-first storage with offline support
- Built-in backup and restore
- No cloud account required

## Core Features

- Expense and income transactions
- Categories with monthly budgets
- Dashboard with totals, net, and category breakdown
- Advanced transaction search and filters
- Receipt upload + local OCR extraction + manual review
- Analytics with period comparison
- CSV export and JSON full backup/restore
- Light and dark themes

## Portfolio (Optional Beta)

An optional Portfolio module can be enabled in **Settings**:

- Track BTC, ETH, and SOL holdings manually
- Live-ish cached prices with offline fallback
- USD and RON valuation
- Stale-data indicator when network data is outdated

## Auto Updates

The app supports in-app updates on Windows.

- Open **Settings -> Updates**
- Use **Check for updates** anytime
- Optional startup auto-check (disabled by default)
- Updates require explicit user confirmation to install

## Download

Installers are published under GitHub Releases:

- [Latest Release](https://github.com/Rekzor200/expense-tracker/releases/latest)

## Privacy and Data

Your data stays on your machine.

- App data path: `%APPDATA%/com.expensetracker.app/`
- Database: `expense-tracker.db` (SQLite)
- Receipt images: `receipts/`

No wallet connection and no telemetry in this MVP.

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| Ctrl+K | Open command palette (Dashboard) |
| Enter | Save in focused modal form |
| Esc | Close active dialog/modal |

## For Contributors

### Tech Stack

- Tauri v2 (Windows desktop shell)
- React + TypeScript + Vite
- Tailwind + shadcn/ui + Radix
- SQLite via `@tauri-apps/plugin-sql`

### Local Development (Windows)

Prerequisites:

- Node.js `18+`
- Rust (`rustup`)
- Visual Studio Build Tools 2022 with C++ workload

Run:

```bash
npm install
npm run tauri dev
```

Build:

```bash
npm run tauri build
```

## License

MIT - see [LICENSE](LICENSE).
