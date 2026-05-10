const STRATEGY = [
  { cat: '🛒 Supermarket / Groceries', best: 'BDO', bestColor: '#1d4ed8', why: 'SMAC/BDO pts → SM Supermarket credits · BNPL available', second: 'Metrobank (1pt/₱20)' },
  { cat: '🍽️ Dining / Restaurants', best: 'Metrobank', bestColor: '#3a86ff', why: '2x points on ALL dining · Buffet discounts (New World 50% off)', second: 'UnionBank (3x pts + Mireio 20% off)' },
  { cat: '👗 Fashion / Clothing', best: 'RCBC', bestColor: '#e63946', why: '5% rebate at all clothing shops worldwide', second: 'Metrobank (2x dept store)' },
  { cat: '🏬 Dept Store / SM', best: 'Metrobank', bestColor: '#3a86ff', why: '2x points on department stores', second: 'BDO (SMAC at SM)' },
  { cat: '📦 Online (Lazada/Shopee)', best: 'Metrobank', bestColor: '#3a86ff', why: '2x points on all online · Lazada/Shopee/PayPal qualified', second: 'UnionBank (3x on shopping)' },
  { cat: '🏠 Appliances (Abenson/SM)', best: 'Metrobank', bestColor: '#3a86ff', why: '0% instalment + up to ₱9,000 cashback (More With Zero promo)', second: 'BDO BNPL · BPI Flexipay' },
  { cat: '🔨 Renovation Materials', best: 'BDO', bestColor: '#1d4ed8', why: 'BNPL at AllHome, True Value, Wilcon · 3–36 months · Pay 4 months later', second: 'BPI (AllHome 0% installment)' },
  { cat: '🛋️ Furniture (Our Home)', best: 'EastWest', bestColor: '#2dc653', why: '0% up to 24 months at Our Home (min ₱70K) · 20% off Opulence Design', second: 'BDO BNPL (min ₱3K)' },
  { cat: '💻 Gadgets / Electronics', best: 'BPI', bestColor: '#c9184a', why: 'Lower-than-cash Apple price · FlexipayZero · Buy Now Pay 3 months later', second: 'Metrobank (More With Zero cashback)' },
  { cat: '🎓 Tuition / School', best: 'BDO', bestColor: '#1d4ed8', why: 'BNPL for tuition 3–36 months 0% · Payment Holiday up to 4 months', second: 'BPI FlexipayZero (up to 6 months)' },
  { cat: '✈️ Travel / Flights / Hotels', best: 'BPI', bestColor: '#c9184a', why: '1pt/₱20 → miles redemption · Lounge NAIA T1+T3 · ₱7K eGC promo active', second: 'RCBC (₱8K overseas rebate · 5x pts)' },
  { cat: '🌍 International / Overseas', best: 'RCBC', bestColor: '#e63946', why: '5x points overseas in-store & online · Up to ₱8,000 cash rebate', second: 'BDO (1.85% low FX fee)' },
  { cat: '⛽ Gas / Fuel', best: 'BDO', bestColor: '#1d4ed8', why: 'BDO rewards + SEAOIL/Unioil deals · BNPL available', second: 'Metrobank Titanium' },
  { cat: '💊 Medical / Hospital', best: 'BDO', bestColor: '#1d4ed8', why: 'BNPL for medical bills 0% · 30% off select services', second: 'BPI (0% installment medical)' },
  { cat: '📦 Big Purchase (0% Install)', best: 'Metrobank', bestColor: '#3a86ff', why: '0% + up to ₱9,000 cashback (More With Zero, register by Jun 30)', second: 'BDO BNPL · EastWest 24 months' },
];

export function renderBestCard(container) {
  container.innerHTML = `
    <div class="page-header">
      <h1>Best Card</h1>
      <span class="page-date">Swipe strategy by category</span>
    </div>
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r2);overflow:hidden;margin-bottom:var(--sp5);box-shadow:var(--shadow1)">
      <div style="overflow-x:auto">
        <table class="data-table" style="min-width:600px">
          <thead><tr>
            <th>Category</th>
            <th>Best Card</th>
            <th>Why</th>
            <th>2nd Choice</th>
          </tr></thead>
          <tbody>
            ${STRATEGY.map(r => `<tr>
              <td style="font-weight:500">${r.cat}</td>
              <td>
                <div style="display:inline-flex;align-items:center;gap:6px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--r1);padding:3px 8px;font-size:0.8rem">
                  <div style="width:7px;height:7px;border-radius:50%;background:${r.bestColor};flex-shrink:0"></div>
                  <span style="font-weight:600">${r.best}</span>
                </div>
              </td>
              <td style="font-size:0.8rem;color:var(--text2)">${r.why}</td>
              <td style="font-size:0.78rem;color:var(--muted)">${r.second}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
    <div style="background:rgba(196,98,45,0.08);border:1px solid rgba(196,98,45,0.25);border-radius:var(--r2);padding:var(--sp4);font-size:0.85rem;color:var(--text2);line-height:1.6">
      <strong style="color:var(--acc)">Golden Rule:</strong> Always pay the FULL balance by due date. At 3%/month (36%/year), a ₱100K balance costs ₱36,000/year in pure interest. Use 0% installments strategically — that's free credit. Your combined income of ₱559K/month means you can always pay in full — just plan your paydays right.
    </div>
  `;
}
