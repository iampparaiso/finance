# Finance OS — Cash Tracker, Smart Alerts & Bug Fixes
**Spec date:** 2026-05-12  
**Status:** Approved for implementation

---

## 1. Overview

This spec covers three categories of work:

1. **Bug fixes** — Three frontend modules are broken due to a misuse of the `api.js` `get()` return value
2. **Cash on Hand system** — Full cash tracking: top-ups, deductions, CC bill payments, loan debits, renovation cash payments
3. **Smart alerts & intelligence** — Card payability alerts, net cash flow alerts, cash runway projection, payday allocation prompt, installment relief timeline, CC payment priority queue

The north star: the app should tell the Paraiso household — at a glance, at any moment — whether they are financially healthy, in danger, or in trouble. No mental math required.

---

## 2. Bug Fixes

### Root Cause
`api.js` `get()` returns `json.data` directly (the raw array or object). Three modules incorrectly treat the return value as a `{ ok, data }` wrapper.

### Affected Modules

| File | Broken behavior | Fix |
|---|---|---|
| `spend-log.js` | Card dropdown always empty; transactions never display (always shows "No expenses logged yet") | Use returned array directly — remove `.ok` / `.data` checks |
| `cards.js` | Unbilled charges always ₱0 on all cards; SpendLog data never read | Use returned array directly |
| `income.js` | Dashboard data resolves to empty object; obligations = ₱0, net = ₱559K | Use returned object directly |

### Fix Pattern (same in all three)
```js
// WRONG (current)
const res = await get('getCards');
const cards = (res.ok && res.data) ? res.data : [];

// CORRECT
const cards = await get('getCards') || [];
```

---

## 3. Data Layer

### 3.1 New Sheet: `CashLog`
Columns: `Timestamp, Date, Type, Amount, RunningBalance, Notes, LinkedID, AddedBy`

`Type` enum:
- `topup` — cash added (payday, bonus, gift, sale, refund, other)
- `spend_cash` — cash purchase logged via Spend Log
- `pay_card` — CC bill payment
- `loan_debit` — bank loan auto-debit recorded
- `reno_cash` — renovation expense paid in cash

`LinkedID` — optional reference: card ID for `pay_card`, loan ID for `loan_debit`

### 3.2 New Config Key
`cash_on_hand` — numeric, initialized to `0`. User sets opening balance via first "Add Cash" entry. This is the authoritative running balance; `CashLog` is the audit trail.

### 3.3 New/Updated Backend Actions

#### `addCash` (POST) — NEW
```
body: { date, amount, source, notes }
source: 'payday' | 'bonus' | 'gift' | 'sale' | 'refund' | 'other'
```
- Reads current `cash_on_hand` from Config
- Computes new balance = current + amount
- Appends to CashLog (Type = `topup`)
- Updates Config `cash_on_hand` = new balance
- Returns: `{ success, newBalance }`
- The Payday Allocation Prompt (Section 6.2) is computed client-side from data already in memory — no server round-trip needed

#### `payCreditCard` (POST) — NEW
```
body: { cardId, amount, date, notes }
```
- Reads current card Balance from CreditCards
- Computes new card balance = max(0, Balance - amount)
- Updates card: `Balance = newBalance`, and if `newBalance <= 0` sets `PastDue = false`
- Reads current `cash_on_hand` from Config
- Deducts: `cash_on_hand -= amount`
- Appends to CashLog (Type = `pay_card`, LinkedID = cardId)
- Updates Config `cash_on_hand`
- Returns: `{ success, newCashBalance, newCardBalance, pastDueCleared }`

#### `payLoanDebit` (POST) — NEW
```
body: { loanId, date, notes }
```
- Looks up loan by ID in BankLoans — reads `MonthlyPayment`
- Deducts from `cash_on_hand`
- Appends to CashLog (Type = `loan_debit`, LinkedID = loanId)
- Updates Config `cash_on_hand`
- Returns: `{ success, newCashBalance, amountDebited }`

#### `getCashLog` (GET) — NEW
- Returns all CashLog rows + current `cash_on_hand` from Config

#### `logSpend` (POST) — UPDATED
- Existing behavior unchanged for card purchases
- **If `cardId` is empty (cash purchase):**
  - Deducts amount from `cash_on_hand`
  - Appends to CashLog (Type = `spend_cash`)
  - Updates Config `cash_on_hand`

#### `logRenovation` (POST) — UPDATED
- Existing behavior: writes to Renovation sheet
- **If `paymentMethod = 'cash'`:**
  - Deducts amount from `cash_on_hand`
  - Appends to CashLog (Type = `reno_cash`)
  - Updates Config `cash_on_hand`
- **If `paymentMethod = 'card'` and `cardId` is provided:**
  - Also writes a mirrored entry to SpendLog with `Category = 'Renovation'` and the provided `cardId`
  - This makes the charge appear automatically in the card's Unbilled Charges section

#### `getDashboard` (GET) — UPDATED
- Include `cashOnHand` from Config
- Include `installments` data for client-side alert computation
- Include `cashLog` (last 30 days) for runway computation on Dashboard

#### Setup.gs — UPDATED
- Add `CashLog` sheet creation in `setupSheets()`
- Add `cash_on_hand = 0` to Config initial data

---

## 4. Cash on Hand System — UI

### 4.1 Cash Tracker Widget (Spend Log tab, top of page)

Displayed above the log form, always visible.

**Layout:**
```
┌──────────────────────────────────────────────────────┐
│  CASH ON HAND                                        │
│  ₱142,500                [+ Add Cash]  [Pay Card ▾]  │
│  ████████████░░░░  [green/yellow/red bar]             │
│                                                      │
│  Scheduled Debits This Month                         │
│  BPI Auto Loan    ₱41,154   due 10th  [Mark Debited] │
│  BPI Housing Loan ₱119,008  due 20th  [Mark Debited] │
│                                                      │
│  Recent activity  [see all]                          │
│  May 12 · Paulo 30th payday     +₱275,000            │
│  May 11 · Jollibee lunch         -₱850               │
│  May 10 · BPI Auto debit        -₱41,154             │
└──────────────────────────────────────────────────────┘
```

**Color thresholds:**
- Green: ≥ ₱100,000
- Yellow: ₱50,000 – ₱99,999
- Red: < ₱50,000

**Scheduled Debits section:** Shows BPI Auto (₱41,154, due 10th) and BPI Housing (₱119,008, due 20th) only for debits not yet recorded this month (checked against CashLog). "Mark Debited" button calls `payLoanDebit` in one tap.

**Recent activity:** Last 5 CashLog entries, color-coded (+/−), with type label.

### 4.2 Add Cash Modal
Fields: Date · Amount · Source (payday/bonus/gift/sale/refund/other) · Notes  
On submit: calls `addCash` → on success, shows Payday Allocation Prompt if source = `payday` (see Section 6.2).

### 4.3 Pay Card Modal
Triggered by [Pay Card ▾] dropdown — shows all 6 cards with their current balance.  
Fields: Card (pre-selected from dropdown) · Amount · Date · Notes  
Shows: "Balance after payment: ₱X" computed live as user types.  
On submit: calls `payCreditCard` → refreshes cash tracker and card data.

---

## 5. Alert System

Alerts are computed client-side from data already fetched. Shown at the top of both **Dashboard** and **Spend Log**. Dismissed per session (reappear on reload if condition still true).

### Alert 1 — Overdue Cards (hardest red)
**Triggers:** Any card where `PastDue = true`  
**Display:**
> ⛔ OVERDUE: EastWest ₱24,572 · UnionBank ₱80,462 — tap to pay

Tapping a card name opens the Pay Card modal pre-filled for that card.  
**Resolves automatically** when `payCreditCard` sets `PastDue = false`.

### Alert 2 — Card Payability

**Formula per card:**
```
cardExposure = Balance + unbilledSpendLogCharges(since last cut) + activeMonthlyInstallments
```
Where `activeMonthlyInstallments` = sum of `MonthlyAmount` for all Installments rows where `CardID = card.ID` and `Status = 'active'`.

**Total exposure** = sum across all 6 cards.

**Thresholds vs `cash_on_hand`:**
- Yellow: totalExposure > 70% of cash_on_hand
- Red: totalExposure > cash_on_hand

**Display (red example):**
> ⚠ Card obligations (₱312,450) exceed cash on hand (₱142,500) — ₱169,950 short

**Display (yellow example):**
> ○ Card obligations at 84% of cash on hand — consider paying down before next cycle

### Alert 3 — Net Cash Flow (two signals)

**Signal A — Immediate cash burn:**
```
cashSpendThisMonth = sum of CashLog entries (type: spend_cash | reno_cash | pay_card | loan_debit) since start of month
cashReceivedThisMonth = sum of CashLog entries (type: topup) since start of month
```
- Yellow: cashSpend > 80% of cashReceived
- Red: cashSpend > cashReceived ("Spending more cash than you're bringing in this month")

**Signal B — Card debt building:**
```
cardSpendThisMonth = sum of SpendLog entries (cardId not empty) since start of month
fixedObligations = loans + bills + subs + installments (from getDashboard)
```
- Yellow: (fixedObligations + cardSpendThisMonth) within ₱50K of monthly income (₱559K)
- Red: (fixedObligations + cardSpendThisMonth) > monthly income ("New card charges this month will exceed income capacity")

Both signals are labeled distinctly so the user knows which is cash-today vs card-building-debt.

---

## 6. Smart Features

### 6.1 Cash Runway Projection

**Location:** Inside the Cash Tracker widget, below the balance bar.

**Computation:**
```
dailyBurnRate = sum of CashLog outflows (spend_cash + reno_cash) over last 14 days / 14
daysUntilZero = cash_on_hand / dailyBurnRate
projectedZeroDate = today + daysUntilZero
```

Note: excludes `pay_card` and `loan_debit` from burn rate — those are scheduled events, not spending velocity.

**Display:**
> At current pace (₱4,200/day), cash covers ~34 days · until ~Jun 15

**Edge cases:**
- If no spend data yet (< 3 days): show "Not enough data yet"
- If dailyBurnRate = 0: show "No recent cash spending"
- If daysUntilZero > 60: show "60+ days" (no false precision)

### 6.2 Payday Allocation Prompt

**Trigger:** After a successful `addCash` call where `source = 'payday'`

**Computation (mirrors `safeToSpend()` in calendar.js):**
Finds next payday after today. Lists all bills, loan debits, and CC due dates between now and that next payday. Sums them as "committed."

**Display (modal or inline):**
```
₱275,000 received — Paulo 30th payday

Before next payday (Joeann 10th):
  BPI Auto Loan due 10th       ₱41,154
  EastWest past due (pay now)  ₱24,572
  Maynilad due 1st              ₱2,000
  Globe due 1st                 ₱1,599
  ──────────────────────────────────────
  Committed                    ₱69,325
  Free to spend                ₱205,675
```

This fires once per payday add. User can dismiss it.

### 6.3 Installment Relief Timeline

**Location:** New section on the Installments tab (and summarized on Dashboard).

**Computation:** For each active installment with `MonthsRemaining > 0`, compute end month = today + MonthsRemaining.

**Display (Dashboard — compact):**
```
Upcoming Relief
  Jun 2026   UnionBank ₱2,250/mo    ends
  Jun 2026   UnionBank ₱16,953/mo   ends
  Jul 2026   UnionBank ₱21,862/mo   ends  
  Jul 2026   EastWest  ₱24,388/mo   ends
```
Month they end, amount freed, card. Sorted by soonest first.

**Running total:** "After Jul 2026: ₱65,453/mo freed from installments"

### 6.4 CC Payment Priority Queue

**Location:** New section on the Cards tab, above the individual card rows. Also referenced in Alert 1.

**Sort order:**
1. Past-due cards (PastDue = true) — sorted by balance desc
2. Cards with balance due within 7 days — sorted by due date asc
3. Cards with balance due within 30 days — sorted by due date asc
4. Cards with no current balance — not shown

**Display:**
```
Pay These First
  1. ⛔ EastWest ••5002       ₱24,572   OVERDUE      [Pay Now]
  2. ⛔ UnionBank ••5021      ₱80,462   OVERDUE      [Pay Now]
  3.    BPI Signature         ₱106,329  due May 27   [Pay Now]
  4.    RCBC Visa Infinite    ₱12,108   due Jun 3    [Pay Now]
```

"Pay Now" opens the Pay Card modal pre-filled for that card.

---

## 7. Renovation Module Updates

### 7.1 New Field: CardID
Add `CardID` dropdown to the Renovation log form — same 6-card list as Spend Log, plus "Cash" and "Other."

### 7.2 Updated `logRenovation` backend
- If `paymentMethod = 'cash'`: deduct from `cash_on_hand`, append `reno_cash` to CashLog
- If `paymentMethod = 'card'` and `cardId` provided: write mirrored SpendLog entry (`Category = 'Renovation'`, `cardId`) so the charge auto-appears in the card's Unbilled Charges section on the Cards tab
- Renovation sheet still gets its own entry regardless (for the Renovation module's own tracking)

---

## 8. Dashboard Enhancements

- **Cash on Hand stat card** — 5th stat card, color-coded green/yellow/red, shows runway days below balance
- **Alert banners** — above stat grid: Overdue (Alert 1), Payability (Alert 2), Cash Flow (Alert 3 signals A and B)
- **Installment Relief** — compact timeline section, below obligations breakdown
- **getDashboard** updated to return `cashOnHand`, `cashLog` (last 30 days), `installments` for client-side computation

---

## 9. Scope Table

| File | Change type | Summary |
|---|---|---|
| `frontend/js/spend-log.js` | Fix + major feature | api.js bug fix · Cash Tracker widget · Add Cash modal · Pay Card modal · Alert banners · Runway projection · Payday allocation prompt |
| `frontend/js/cards.js` | Fix + feature | api.js bug fix · CC Payment Priority Queue section |
| `frontend/js/income.js` | Fix | api.js bug fix |
| `frontend/js/dashboard.js` | Feature | Cash on Hand stat card · Alert banners · Installment Relief timeline |
| `frontend/js/renovation.js` | Feature | CardID dropdown · updated logRenovation call |
| `frontend/js/installments.js` | Feature | Installment Relief Timeline section |
| `appsscript/API.gs` | Feature | `addCash`, `payCreditCard`, `payLoanDebit`, `getCashLog` · updated `logSpend`, `logRenovation`, `getDashboard` |
| `appsscript/Setup.gs` | Feature | `CashLog` sheet · `cash_on_hand` Config key |

---

## 10. Simulation & Testing Requirements

After implementation, a full simulation must be run to verify all financial logic. This is not UI smoke testing — it is a correctness verification of every computed value.

### 10.1 Bug Fix Verification
- Confirm card dropdown shows all 6 cards
- Confirm SpendLog transactions display correctly
- Confirm Cards tab shows real unbilled charges (not ₱0)
- Confirm Income tab shows real obligations (not ₱0)

### 10.2 Cash Tracker Simulation
Run the following sequence and verify running balance at each step:

| Step | Action | Expected cash_on_hand |
|---|---|---|
| 0 | Initial state | ₱0 |
| 1 | Add Cash: Paulo 30th payday ₱275,000 | ₱275,000 |
| 2 | Log cash spend: grocery ₱3,500 | ₱271,500 |
| 3 | Pay Card: EastWest ₱24,572 (full) | ₱246,928 |
| 4 | Mark Loan Debit: BPI Auto ₱41,154 | ₱205,774 |
| 5 | Log reno cash: tiles ₱18,000 | ₱187,774 |
| 6 | Add Cash: bonus ₱50,000 | ₱237,774 |
| 7 | Pay Card: BPI partial ₱60,000 | ₱177,774 |

Verify: CashLog has 7 entries, types match, RunningBalance column is accurate at each row.

### 10.3 PastDue Resolution
- Step 3 above: after paying EastWest in full → verify `PastDue = false` on EastWest card
- Verify Alert 1 no longer includes EastWest
- Pay UnionBank partially (₱40,000 of ₱80,462) → verify `PastDue` stays `true`

### 10.4 Alert 2 — Card Payability Logic
Using known data (as of 2026-05-12):

```
Card exposures (approximate):
  RCBC:       Balance ₱12,108  + unbilled ~₱0    + installment ₱0      = ₱12,108
  EastWest:   Balance ₱24,572  + unbilled ~₱0    + installment ₱24,388 = ₱48,960
  UnionBank:  Balance ₱80,462  + unbilled ~₱0    + installment ₱41,065 = ₱121,527
  BPI:        Balance ₱106,329 + unbilled ~₱0    + installment ₱19,362 = ₱125,691
  Metrobank:  Balance ₱0       + unbilled ~₱0    + installment ₱0      = ₱0
  BDO:        Balance ₱0       + unbilled ~₱0    + installment ₱0      = ₱0
  ─────────────────────────────────────────────────────────────────────────────
  Total exposure: ~₱308,286
```

Simulate with `cash_on_hand = ₱177,774` (from simulation above):  
- totalExposure (₱308,286) > cash_on_hand (₱177,774) → Alert 2 should be RED  
- Deficit should display as ~₱130,512

Simulate with `cash_on_hand = ₱500,000`:  
- totalExposure (₱308,286) / 500,000 = 62% → below 70% threshold → no alert

Simulate with `cash_on_hand = ₱380,000`:  
- totalExposure (₱308,286) / 380,000 = 81% → above 70% → Alert 2 YELLOW

### 10.5 Alert 3 — Net Cash Flow Logic
Simulate a month where:
- cashReceived = ₱275,000 (one payday only)
- cashSpend = ₱240,000 (pay_card + spend_cash + loan_debit entries)
- Signal A: 240,000 / 275,000 = 87% → RED (> 80%)

Simulate a month where:
- cardSpendThisMonth = ₱180,000 new swipes
- fixedObligations = ₱407,000
- combined = ₱587,000 > ₱559,000 income → Signal B RED

### 10.6 Cash Runway Projection
Simulate 14 days of CashLog with spend_cash + reno_cash entries totaling ₱58,800:
- dailyBurnRate = ₱58,800 / 14 = ₱4,200/day
- cash_on_hand = ₱177,774
- daysUntilZero = 177,774 / 4,200 = ~42 days
- Verify display: "At current pace (₱4,200/day), cash covers ~42 days"

### 10.7 Payday Allocation Prompt
Add cash with source = `payday`, amount = ₱275,000, date = May 30.
Verify prompt shows:
- Next payday = Joeann 10th (June 10)
- Committed items = all bills/loans due Jun 1–10
- Free to spend = ₱275,000 minus committed

### 10.8 Installment Relief Timeline
Verify end-month computations:
- UnionBank ₱2,250 (11 months remaining from ~May 2026) → ends ~Apr 2027
- EastWest ₱24,388 (2 months remaining) → ends ~Jul 2026
- UnionBank ₱16,953 (1 month remaining) → ends ~Jun 2026
- UnionBank ₱21,862 (2 months remaining) → ends ~Jul 2026

Verify "total freed after Jul 2026" sums correctly.

### 10.9 CC Payment Priority Queue
Verify sort order with current data:
1. EastWest (PastDue=true) — should be first
2. UnionBank (PastDue=true) — should be second
3. BPI (due May 27, 15 days away) — third
4. RCBC (due Jun 3) — fourth
5. Metrobank, BDO (Balance=0) — not shown

After paying EastWest in full (Step 3 of cash simulation):
- EastWest should drop out of the priority queue
- Verify queue re-orders correctly

### 10.10 Renovation Card Mirroring
Log a renovation expense: ₱50,000, PaymentMethod = card, CardID = EastWest.
Verify:
- Renovation sheet has the entry
- SpendLog also has a mirrored entry with Category='Renovation', CardID='eastwest'
- EastWest Unbilled Charges section on Cards tab shows the ₱50,000

---

## 11. Out of Scope (this spec)
- Emergency fund integration with "going broke" projection
- Net worth snapshot (assets vs liabilities)
- Spend category trending (month-over-month)
- "Can I buy this?" quick calculator
- Background triggers for automatic loan debit recording
- Moving the cash tracker to its own tab
