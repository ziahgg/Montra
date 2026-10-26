# Montra — Personal Finance

A mobile-first personal finance app built from the Montra Figma design: transactions, accounts, budgets, reports, savings goals, notifications and settings.

Montra is **local-first**. Everything is stored in this browser's IndexedDB. There is no server, no bank connection, no sync, no real authentication and no encryption. It's a portfolio project, not a production finance app.

| Home | Transactions | Add transaction | Budgets |
| --- | --- | --- | --- |
| ![Home](docs/screenshots/01-home.png) | ![Transactions](docs/screenshots/02-transactions.png) | ![Add transaction](docs/screenshots/04-add-transaction.png) | ![Budgets](docs/screenshots/05-budgets.png) |
| **Budget details** | **Reports** | **Goal details** | **Accounts** |
| ![Budget details](docs/screenshots/05b-budget-details-dining.png) | ![Reports](docs/screenshots/07-reports.png) | ![Goal details](docs/screenshots/09-goal-details-emergency-fund.png) | ![Accounts](docs/screenshots/10-accounts.png) |

<sub>The screenshots are the Figma design frames (the export at 1/3 scale). The running app reproduces their figures from the sample data.</sub>

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # Vitest: domain rules and seed reconciliation
npm run typecheck
npm run lint
npm run build
```

## Stack

- **Framework:** Next.js 16 (App Router, Cache Components) with React 19 and TypeScript in strict mode.
- **Styling and icons:** Tailwind CSS v4 with the Figma design tokens as CSS variables, plus `lucide-react` icons.
- **Charts:** hand-written SVG; there is no chart library.
- **Tests:** Vitest.

## Architecture

```
src/
  domain/      Pure TypeScript: no React, no browser APIs
    types.ts        Transaction, Account, Budget, SavingsGoal, AppNotification, Settings
    money.ts        Integer cents, parsing, formatting (true minus sign), per-currency sums
    dates.ts        Local "YYYY-MM-DDTHH:MM" strings, month/week ranges, formatters
    finance.ts      The only place totals are calculated (balances, budgets, reports, goals)
    validation.ts   Input rules shared by every form
    actions.ts      Pure state transitions: (data, input, ctx) → new data
  data/
    seed.ts         October 2026 sample data reconciled to the Figma figures
    storage.ts      IndexedDB load/save, validation, migration, corrupt-data backup
  state/
    store.tsx       React context: loads IndexedDB, applies actions, persists with a write queue
    format.ts       Formatters bound to the user's date-style preference
  components/   Design-system pieces (Button, Tag, Sheet, ConfirmDialog, Toast, BottomNav, charts…)
  screens/      One client component per screen
  app/          Thin route files; each renders a screen inside <Suspense>
```

**Data flow.** A screen calls `apply(action)`. The action validates its input and returns new data, or throws a `ValidationError` that the form shows inline. The store then saves the result to IndexedDB through a serialized queue. Stored records hold only facts: transactions, opening balances, limits and targets. Balances, budget spending and goal progress are always derived, so editing or deleting a transaction can never double-count it.

**Startup.** `Providers` waits for IndexedDB and shows a spinner until it's ready. First-time visitors go to `/welcome`. If the stored data is corrupt, it's backed up under `data:corrupt:<timestamp>` and the app starts again from the sample data. If IndexedDB is unavailable, the app runs in memory and the Profile screen warns that changes won't be kept.

## Calculation rules

- **Money:** amounts are integer minor units (cents) with a currency. Totals are always grouped by currency and never converted.
- **Account balance:** opening balance + income − expenses − transfers out + transfers in.
- **Net balance:** the sum of account balances per currency. Assets are the positive balances; owed is the negative ones (credit cards).
- **Income and expenses for a period:** only income and expense transactions count. Transfers, including savings contributions, are never income or spending.
- **Budgets:** spent = expenses in the budget's categories during its current period (a calendar month, or a Monday–Sunday week). The state is:
  - *near limit* at the alert threshold (80%);
  - *over budget* above 100%.

  The monthly summary counts each expense once, and per-day-left = remaining ÷ days left in the month.
- **Savings goals:**
  - A contribution is a real transfer into the goal's account, tagged with the goal.
  - Saved = the sum of those transfers; contributions can't exceed what's still needed.
  - The projected finish month comes from the monthly plan.
  - Milestone notifications fire at 25/50/75/100%.
- **Updating a balance** adjusts the account's opening balance, so a correction never shows up as income or spending.
- **Deleting a goal** keeps the money where it is; its contributions become plain transfers.

## Features

- **Transactions:**
  - Add, edit and delete expenses, income and transfers. Delete goes through a confirmation dialog and offers an Undo toast.
  - Search, filter by type, month, category and account, with daily groups and day totals.
  - Empty and no-results states.
- **Add transaction:** shows a live budget hint (for example "Dining is already $36.40 over budget"), validates every field inline, and uses a category picker sheet.
- **Budgets:**
  - A monthly summary, sorting, and browsing past months.
  - A details screen with weekly bars against the weekly limit, a 3-month insight and the matching transactions.
  - Create, edit (weekly or monthly, alert toggle) and delete.
- **Reports:**
  - Report periods: this month, last month, 3 or 6 months, this year, or a custom range.
  - A cash-flow line chart with month selection and month-over-month comparison.
  - A category donut and a spending-by-category details screen.
- **Savings:** a goal list, goal details with a progress ring and projection, an add-contribution sheet (presets, source account, new total), and create, edit and delete.
- **Accounts:** net balance, assets and owed; account details with money in and out for the month; update balance; rename and delete (only when unused); add account (type, currency, last 4 digits).
- **Notifications:** filters, Today / This week / Earlier groups, mark all as read, and tapping a notification opens its record. Budget alerts are generated automatically and deduplicated per budget per period.
- **Profile:**
  - Edit name and email, default currency, date format (US or international), budget alerts and dark mode.
  - Export data as JSON, reset sample data, and sign out.

## Differences from the design

- **Transfers:** the Add Transaction segmented control has a third **Transfer** option (the design shows only Expense and Income).
- **Delete:** the design's dialog says the delete "can't be undone"; Montra deletes and then offers **Undo** in the toast.
- **Sign in:** this only sets a local name and email. No password is collected or checked, and the passkey button isn't shown.
- **Unbuilt settings:** App passcode is shown as *Not available* and Face ID as *Coming soon*. Language is English only.
- **Avatar:** the profile shows the user's initials, not a photo.
- **Not implemented:** custom budget periods, the "Include in net balance" toggle for accounts, and share images.
- **Time-dependent text:** the clock is real. With today's date the app shows the same October 2026 figures as the design; on other dates, "Today", "days left" and similar labels move with the clock.

## Limitations

- Data lives in one browser profile only. Clearing site data deletes it; use **Export data** to keep a copy.
- There is no multi-currency conversion, no recurring transactions, no custom categories and no attachments.
- The app isn't production-ready: there's no auth, encryption, backup or sync, and no automated end-to-end tests. The UI was checked by hand in a browser.
