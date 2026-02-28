# Expense Tracker

A Windows desktop app for tracking personal expenses and income. Built with Tauri v2, React, TypeScript, and SQLite.

## Features

- Track expenses and income with categories
- Dashboard with monthly summary, charts, and budget progress
- Receipt upload with local OCR (tesseract.js — no cloud required)
- Analytics with daily trends, category breakdowns, and period comparisons
- CSV export and JSON backup/restore
- Command palette (Ctrl+K) for quick actions
- Light/dark theme
- Fully offline — all data stored locally in SQLite

## Tech Stack

- **Desktop**: Tauri v2 (Rust backend, WebView frontend)
- **Frontend**: React 19, TypeScript 5.8, Vite 7
- **Styling**: Tailwind CSS v4, shadcn/ui (Radix primitives)
- **Charts**: Recharts
- **Database**: SQLite via tauri-plugin-sql
- **OCR**: tesseract.js v7 (Romanian + English)
- **Currency**: RON (Romanian Leu)

## Prerequisites

- **Node.js** 18+
- **Rust** (install via [rustup](https://rustup.rs/))
- **Visual Studio Build Tools 2022** with "Desktop development with C++" workload
  - If C: drive is low on space, install to another drive:
    ```
    vs_BuildTools.exe --installPath "E:\VS\2022\BuildTools"
    ```

## Setup

```bash
# Clone and install dependencies
git clone <repo-url>
cd expense-tracker
npm install

# Run in development mode (opens Tauri window)
npm run tauri dev

# Run tests
npm test

# Build for production (creates installer in src-tauri/target/release/bundle/)
npm run tauri build
```

## Project Structure

```
src/
  components/       # React components (ui/, reactbits/, layout, modals)
  pages/            # Dashboard, Transactions, Categories, Analytics, Settings
  hooks/            # useMonth, useTheme
  lib/
    db/             # SQLite schema, migrations, CRUD operations
    domain/         # Types, calculations, currency formatting
    receipt/        # OCR extraction, receipt text parser, image storage
src-tauri/
  src/              # Rust backend (plugin registration)
  capabilities/     # Tauri v2 permission scoping
```

## Data Storage

All data is stored locally in SQLite at Tauri's app data directory:
- **Windows**: `%APPDATA%/com.messiah.expense-tracker/`
- Database: `expense-tracker.db`
- Receipt images: `receipts/` subdirectory

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+K | Open command palette |
| Enter | Save transaction (when modal is open) |
