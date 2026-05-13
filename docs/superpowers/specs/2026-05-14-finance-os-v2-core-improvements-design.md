# Finance OS v2 — Core Improvements
**Date:** 2026-05-14  
**Status:** Approved  
**Scope:** Bug fixes, Cards enhancements, Bulk spend logging, UX/performance polish  
**Out of scope:** SOA Drive Sync (pinned for later)

---

## 1. Bug Fixes

### 1a. Past Due Flag Not Clearing After Payment

**Problem:** `payCreditCard` in `API.gs` only clears `PastDue = false` when `newCardBal <= 0`. Partial payments leave the flag set even after the user has settled.

**Fix:**
- `API.gs` — `payCreditCard` action: remove the `<= 0` condition. Always set `PastDue = false` on any payment.
- `cards.js` — `openUpdateSOAModal`: add a JS event listener on the Balance input. When the value is typed to `0`, auto-uncheck the Past Due checkbox.

**Affected files:** `appsscript/API.gs`, `frontend/js/cards.js`

---

### 1b. Groceries Category Missing

**Fix:** Add `'Groceries'` to the `CATEGORIES` array in `spend-log.js` between `'Food'` and `'Transport'`.

**Affected files:** `frontend/js/spend-log.js`

---

### 1c. Inline Notes Editing on Spend Log

**Problem:** Notes cell shows auto-estimated due date when blank (e.g. "Due ~May 31"). No way to correct it without deleting and re-adding the entry.

**Fix:**
- Add a pencil (✏) icon button next to each Notes cell in the spend log table.
- Clicking it replaces the Notes cell content with an `<input>` pre-filled with current notes.
- Pressing Enter or blurring the input calls a new `updateSpend` backend action.
- On success: update the cell in-place without a full page refresh.

**New backend action:** `updateSpend` (doPost)
- Accepts: `{ id: Timestamp, notes: string }`
- Finds the row in SpendLog by Timestamp, updates the Notes column.
- Returns: `{ success: true }`

**Affected files:** `appsscript/API.gs`, `frontend/js/spend-log.js`

---

## 2. Cards Enhancements

### 2a. Active Installments Per Card

**Problem:** The Cards tab has no visibility into active installments per card. The Installments tab is separate, so a card that looks paid may still be carrying monthly installment commitments.

**Fix:**
- `renderCards()`: add `get('getInstallments')` as a third parallel fetch.
- `_cardRow()`: filter installments where `i.CardID` matches `c.ID` (case-insensitive) and `i.Status === 'active'`.
- Render a new collapsible section in the card's expanded detail block:

```
── Active Installments ──────────────────────────
  Ref7 Home Renovation     ₱12,500/mo   4 mo left
  Samsung S24 Ultra         ₱4,167/mo   8 mo left
  ─────────────────────────────────────────────
  Total installment load   ₱16,667/mo
```

- Cards with no active installments: section is hidden (no empty state).
- CardID matching: compare `i.CardID.toLowerCase()` against `c.ID.toLowerCase()` — installments use the same ID string as the CreditCards sheet.

**Affected files:** `frontend/js/cards.js`

---

### 2b. Available Credit — From SOA, Not Calculated

**Problem:** Available credit is currently calculated as `Limit - Balance`, which doesn't reflect actual bank-reported availability (pending holds, etc.). Misleading.

**Fix:**
- Add `AvailableCredit` column to `CreditCards` sheet (blank by default).
- `openUpdateSOAModal`: add a third input field — **Available Credit (₱)** — between Balance and Due Date. Pre-filled from `card.AvailableCredit` if set.
- `updateCard` POST: include `AvailableCredit` in the updates object.
- `_cardRow()` utilization bar label:
  - If `c.AvailableCredit` is set → show `"₱X available (from SOA)"` in normal text
  - If not set → show `"₱X available (est.)"` in muted/italic style
- Card detail grid: add an `Available Credit` row using the same fallback logic.

**Affected files:** `appsscript/API.gs` (updateCard already handles arbitrary updates — no change needed), `frontend/js/cards.js`  
**Sheet change:** Add `AvailableCredit` column to `CreditCards` tab manually or via `Setup.gs`.

---

## 3. Bulk Spend Logging

### 3a. Queue UI

The Spend Log form gets two action buttons:

| Button | Behaviour |
|--------|-----------|
| **Add to Queue** | Appends entry to in-memory queue array. Clears Description, Amount, Notes. Keeps Category and Card selection sticky. No API call. |
| **Save Now** | Existing single-entry immediate save. For one-off logging. |

Queue panel renders below the form once the first item is added:

```
── Queued (3 items) ──────────────────────────────────────
  May 14  Puregold groceries   Groceries  UnionBank  ₱2,840  ✕
  May 14  Grab to office       Transport  Cash       ₱185    ✕
  May 13  Makati Med consult   Health     BPI        ₱3,500  ✕
  ──────────────────────────────────────────────────────
                        Total  ₱6,525
         [ Submit All (3 items) ]  [ Clear Queue ]
```

- ✕ on each row removes it from the queue (no API call).
- "Submit All" is disabled when queue is empty.
- "Clear Queue" empties the queue with a confirmation prompt.
- Navigating away from Spend Log with a non-empty queue triggers: *"You have N unsaved items in queue. Leave anyway?"*
- On successful submit: queue clears, single page refresh.

### 3b. New Backend Action — `bulkLogSpend`

**Location:** `appsscript/API.gs` (doPost)

**Request:** `{ action: 'bulkLogSpend', token, entries: [ { date, description, amount, category, cardId, notes }, ... ] }`

**Behaviour:**
- Validates all entries first (rejects batch if any entry is missing required fields).
- Loops through entries applying identical logic to `logSpend` for each: SpendLog append, CashLog entry + cash deduction for cash entries.
- Atomic: if any entry throws, returns error and nothing is written.
- Returns: `{ success: true, count: N, ids: [timestamp1, timestamp2, ...] }`

**Affected files:** `appsscript/API.gs`, `frontend/js/spend-log.js`

---

## 4. UX / Performance / Polish

### 4a. Tab Caching

**Location:** `frontend/js/api.js`

Add a module-level cache map: `Map<action, { data, fetchedAt }>`. TTL: 60 seconds.

- `get(action)`: if cache hit and age < 60s, return cached data synchronously (no fetch).
- `post(action, body)`: after successful post, invalidate cache keys related to the action:
  - `logSpend` / `bulkLogSpend` / `deleteSpend` / `updateSpend` → invalidate `getSpendLog`, `getDashboard`
  - `updateCard` → invalidate `getCards`, `getDashboard`
  - `addCash` / `payCreditCard` / `payLoanDebit` → invalidate `getDashboard`, `getCashLog`

Result: returning to a recently-visited tab is instant. First visit per session still fetches fresh.

### 4b. Skeleton Loading Screens

Replace all `<div class="loading-spinner">Loading...</div>` instances with shimmer skeleton screens that match the shape of the content:

- **Cards tab:** 3 ghost card outlines with shimmer animation
- **Spend Log:** ghost table with 5 shimmer rows
- **Dashboard:** ghost stat boxes in a 2×2 grid

Add `.skeleton` and `.shimmer` CSS classes to `app.css`. Shimmer uses a `background: linear-gradient(90deg, ...)` with `@keyframes` animation.

### 4c. Tab Transition Animation

In `app.js`, when switching tabs add/remove a `.tab-entering` class on the content container:

```css
.tab-entering {
  animation: tabEnter 150ms ease-out forwards;
}
@keyframes tabEnter {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

Card expand/collapse: replace instant toggle with `max-height` transition (0 → auto via JS-measured height).

### 4d. Toast Notification System

Add a `toast.js` module exporting `showToast(message, type)` where `type` is `'success'` | `'error'` | `'info'`.

- Toast element appended to `<body>`, positioned `bottom-right`, slides in via CSS animation.
- Success: green, auto-dismisses after 3 seconds.
- Error: red, stays until dismissed (close button).
- Replaces all inline `msg.textContent = ...` patterns in `cards.js`, `spend-log.js`, modals.

### 4e. Micro-interactions

| Element | Behaviour |
|---------|-----------|
| Stat numbers (Dashboard, Cards) | Count-up animation from 0 on first render, 300ms ease-out |
| Delete row (Spend Log, Renovation) | Row fades out over 200ms before DOM removal |
| Pay Card / Submit All button | Shows "✓ Done" for 800ms before triggering refresh |
| Past Due badge | Single pulse animation on page load (not looping) |
| Stat cards | Subtle `transform: translateY(-2px)` + shadow on hover |

### 4f. Dashboard Personality

Add a single contextual greeting line below the Dashboard `<h1>`, computed from live data:

| Condition (evaluated in order) | Text |
|--------------------------------|------|
| Past due cards exist | `"Heads up — a couple of cards need attention."` |
| Cash runway < 30 days | `"Cash is running lean this cycle."` |
| Hour >= 23 or hour < 5 | `"Late night budgeting? Respect."` |
| Obligations > 60% of income | `"Heavy month. Making it work."` |
| Hour < 12 | `"Good morning. You're on top of it."` |
| Hour < 18 | `"Afternoon check-in. Looking solid."` |
| Default | `"Evening. Numbers are in check."` |

Style: `font-size: 0.85rem`, `color: var(--muted)`, no emoji.

### 4g. Responsiveness Fixes

- Stat grid: enforce `grid-template-columns: 1fr 1fr` at max-width 480px (prevents awkward single-column blowout).
- Cards detail grid: stack to single column below 400px.
- Queue panel on mobile: horizontal scroll on the queued items table; Submit button pinned to bottom of the panel.
- Active nav tab: add a 2px bottom-border accent in `var(--accent)` color alongside the existing bold text.

---

## Deployment Sequence

1. **Backend first:** Add `updateSpend` and `bulkLogSpend` to `API.gs`. Run `deploy.ps1`. Update `config.js` with new URL. Push.
2. **Sheet change:** Manually add `AvailableCredit` column to `CreditCards` tab in Google Sheets.
3. **Frontend:** All JS/CSS changes. Bump SW cache version (`finance-os-v5` → `finance-os-v6`). Push.
4. **Post-deploy:** DevTools → Application → Service Workers → Update, then Ctrl+Shift+R.
5. **Fix Makati Med entry:** Use new inline notes edit on the spend log row.

---

## Files Changed

| File | Changes |
|------|---------|
| `appsscript/API.gs` | Add `updateSpend`, `bulkLogSpend` actions; fix `payCreditCard` PastDue logic |
| `frontend/js/api.js` | Add 60s cache layer |
| `frontend/js/cards.js` | Installments section, AvailableCredit display, SOA modal field, PastDue auto-uncheck |
| `frontend/js/spend-log.js` | Groceries category, inline notes edit, queue UI, bulk submit |
| `frontend/js/toast.js` | New module — toast notification system |
| `frontend/js/dashboard.js` | Personality greeting line |
| `frontend/js/app.js` | Tab transition animation |
| `frontend/css/app.css` | Skeleton shimmer, transitions, micro-interaction styles, responsiveness fixes |
| `frontend/sw.js` | Bump cache version to `finance-os-v6` |
