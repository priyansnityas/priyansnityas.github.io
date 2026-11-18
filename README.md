# Pocket Ledger

A small, offline-first personal finance app. It has no account, server, analytics, or paid service. Transactions, people, accounts, and reminders stay in the browser on this device using IndexedDB, with a localStorage fallback.

## Run locally

Service workers require a secure origin. For offline/PWA behavior, serve this folder from localhost:

1. Open a terminal in this `outputs` folder.
2. Run `python -m http.server 8000` (or use any static file server).
3. Visit `http://localhost:8000`.

Opening `index.html` directly also shows the app, but service-worker installation is unavailable from a `file://` URL.

## Try it on a phone

Put the folder on a computer reachable from the phone and serve it over HTTPS (or use localhost on the phone). Open the URL in the phone browser, then choose **Add to Home Screen** / **Install app** from the browser menu. A simple LAN HTTP server may display the page, but browsers generally require HTTPS for installation and offline caching.

The service worker caches the app shell after its first successful load. App data is local to the browser profile, so clearing site data removes it. Choose Auto, Light, or Dark in Settings. Auto follows the device color preference.

## Phase 1 onboarding and Quick Add

The first-run tour explains Credit, Debit, and per-person Udhar. It can be replayed from **Settings → How it works**. **Try demo data** adds clearly marked sample transactions; **Remove demo data** removes only those samples. Your real records are left alone.

On Entry, type a short description such as `chai 20 cash`, `Rahul ne 2000 aapya`, or `salary 25000 sbi`, then choose **Review**. Check or edit the preview and choose **Confirm and save** to create the entry. The parser and keyword dictionaries are local files under `src/ai/`; nothing is sent to a service. If you paste a bank/UPI SMS, the raw message is not saved unless you check **Save original SMS text in note**. Confirming a Daily Expense category teaches a local merchant rule; remove rules in Settings.

Legacy transactions that need an account are migrated by adding the matching account ID while preserving their other fields. This migration is idempotent and does not delete transaction rows.

## Accounts and balance safety

Manage Cash and bank, wallet, or other accounts in **Settings → Accounts** (also linked from the Dashboard). Set an opening balance to record money that was already in the account before using Pocket Ledger. Current balances are calculated from opening balances and the dated transaction history by `src/data/accountBalances.js`; transfers move money between accounts without changing the overall balance. Debit entries, transfers, edits, deletes, recurring confirmations, and opening-balance changes are checked against the full dated history. If imported legacy data already has a negative balance, the app preserves it, shows **Data check needed**, and blocks changes that would make the account's lowest balance worse.

Run the offline test suite with `npm test` (Node.js required). It covers Quick Add language and amount cases, legacy data migration, and UI wiring for onboarding, demo controls, and preview-before-save.

## Phase 2 smart features

Smart Insights, budgets, recurrence schedules, and forecasts run from local data with deterministic rules. **Smart Insights** shows up to five rule-based cards; dismissals are tied to a data fingerprint. **Budgets** are monthly limits for a category or all Daily Expenses. **Recurring entries** create due drafts on app open, and each draft must be confirmed before it becomes a transaction. The dashboard forecast uses average daily income and Daily Expense with a ±15% flow band.

The new IndexedDB stores are added through a versioned upgrade. Existing transaction records are not cleared. Backups now include budgets, recurrence templates, and unconfirmed recurring drafts. Use **More → Budgets** and **More → Recurring entries** to manage these features. The relevant calculation tests live under `tests/` and run with `node --test tests/*.test.js`.

## Phase 3 reminders, statements, and protected backups

On an Outstanding person detail, save an optional phone number and credit limit. **Remind on WhatsApp**, **Send SMS**, and **Copy message** use an editable local template. You can choose English, Hindi/Hinglish, or Gujarati and optionally include your UPI ID/name. Reminder sends are recorded on that person. The Entry screen warns before a Udhar Given entry exceeds their limit.

Person and account statements can be printed or shared as text. They include the opening balance, dated entries, running balance, final balance, and generated date. Encrypted export uses browser Web Crypto (PBKDF2 and AES-GCM); imports check the backup checksum. Keep the passphrase somewhere safe: it cannot be recovered if lost. Plain JSON export remains available. Message settings and UPI details are included in backups.

The experimental assistant is off by default. In a compatible browser, enable it under **Settings → Advanced assistant**. It may suggest Quick Add fields for review. It is never given the ledger and never computes amounts. If the browser does not expose its built-in model, these optional controls remain unavailable; no model is downloaded by Pocket Ledger.

The IndexedDB transaction store now adds date, person, account, and type indexes. Dashboard monthly summaries reuse indexed month rows and cached aggregates, while long person histories render in batches. A synthetic 20,000-entry performance check is part of the Node test suite.

Run unit and data tests with `npm run test:all`. The Playwright smoke tests are in `tests/e2e/`; install test dependencies with `npm install`, install Chromium, Firefox, and WebKit with `npx playwright install chromium firefox webkit`, then run `npx playwright test --workers=1`. They cover onboarding, demo data, Quick Add, reminder links, plain/encrypted backup import/export, theme contrast, startup defaults, and the cached offline shell.

## Included screens

Dashboard, Entry, Outstanding (person balances, history, quick actions, settlement, and sharing), Investment history, Reminders, Reports, and Settings are implemented. Settings includes accounts, editable categories and investment kinds, language, theme, PIN lock, backup and restore, and storage information. Reports includes summary, category, monthly trend, account, person, and investment views with CSV export, print/PDF, and share/copy actions.

## Reminder notifications and backups

Pocket Ledger checks pending reminders when the app opens, returns to the foreground, and while it remains open. It can show browser notifications when permission is granted. Fully background notifications while a PWA is closed are not guaranteed without a server or operating-system scheduling support. Use **Add to phone calendar** to download an `.ics` event with an alert; the calendar import is the reliable backup for system reminders.

## Investment records and savings

Use **Add existing investment** to record holdings you owned before starting Pocket Ledger. These holdings and current-value snapshots are non-cash records: they do not change account balances, credit, debit, or monthly income. New Investment entries are cash debits. **Sell / Redeem** records the proceeds as a cash credit and records the redeemed cost; only proceeds above that cost count as income, while proceeds below cost are a realized loss. Investment Profit is income without reducing cost, and legacy Investment Loss remains a non-cash loss. The Dashboard and Reports show **Savings = Income − Daily Expense**, with investment buys shown separately; “Left in hand after investing” subtracts investment buys from that savings figure. Existing Investment entries keep their original cash effect unless explicitly converted from the investment detail screen; conversion adds an audit note and restores that original debit to the account balance.

Use **More → Settings → Backup and Restore** to export a JSON backup. It includes accounts (including opening balances), people, reminders, categories, investment kinds, settings, and every transaction, including transfers and investment records. PIN hashes are not included. Import supports replacing current data (a safety backup is downloaded first) or merging while skipping duplicate IDs. Pocket Ledger displays a reminder when no backup has been made in the last 30 days. Keep the downloaded file somewhere safe; app data is otherwise stored only in the current browser profile.

The optional four-digit PIN is salted and hashed with SHA-256 in this browser and is not a substitute for device encryption. Five incorrect attempts trigger a 30-second delay. On supported browsers, **Request persistent storage** requests that the browser not evict the app's local data automatically; it cannot protect data if the user clears browser storage or loses the device.

Reports can be filtered by period, account, transaction type, category, person, and whether Udhar should be included. CSV export is generated locally. Print / Save PDF opens the browser's print dialog, and Share uses the device share sheet when available or copies report text.

## Sample outstanding test cases

Run these as manual checks from the Entry screen. Start with a fresh browser profile or remove the earlier transactions first.

| Step | Entry | Expected outstanding for Rahul |
| --- | --- | --- |
| 1 | Debit → Udhar Given → ₹2,000 → add Rahul → Save | You will receive ₹2,000 |
| 2 | Credit → Udhar Received Back → ₹500 → Rahul → Save | You will receive ₹1,500 |
| 3 | Credit → Udhar Received Back → ₹1,500 → Rahul → Save | Settled (₹0) |

Udhar transactions are included in the month credit/debit summary. A repayment greater than the current outstanding prompts before saving and can be overridden.

## Files

- `index.html` — Entry screen structure
- `css/style.css` — Responsive light/dark styling
- `js/app.js` — Form behavior, validation, summaries, and recent entries
- `js/db.js` — IndexedDB storage with a localStorage fallback
- `js/translations.js` — English UI strings in one object for future translations
- `manifest.json`, `service-worker.js`, `assets/icon.svg` — Install and offline support

## QA checks

Run the offline syntax, asset, and test checks with `npm run test:all`. Run the Playwright browser smoke with `npm install`, then `npx playwright install chromium firefox webkit`, followed by `npx playwright test --workers=1`. The smoke covers Chromium, Firefox, WebKit, and mobile device emulations; offline reload is checked in Chromium. Backups larger than 50 MiB are rejected before import to avoid unbounded local file processing.
