const DEALS = [
  // APPLIANCES
  {bank:'Metrobank',color:'#3a86ff',cat:'appliances',title:'0% Installment + ₱9,000 Cashback',store:'Abenson / Electroworld / SM Appliance',desc:'Register for More With Zero promo in Metrobank app. Get up to ₱9,000 cashback on 0% installment spend. Register BEFORE Jun 30!',expiry:'2026-06-30'},
  {bank:'BPI',color:'#c9184a',cat:'appliances',title:'0% Installment up to 24 months',store:'Abenson, Electroworld, Robinsons Appliances, AllHome',desc:'FlexipayZero at Abenson/Electroworld (min ₱18K) or FlexipayZero online at abenson.com. Buy Now Pay 3 months Later available.',expiry:'2026-12-31'},
  {bank:'BDO',color:'#1d4ed8',cat:'appliances',title:'Buy Now Pay Later — 0% up to 36 months',store:'25,000+ partner merchants incl. SM Appliance',desc:'Pay for appliances in 3,6,9,12,18,24,36 months 0% interest. Payment Holiday: first payment up to 4 months later! Min ₱3,000 purchase.',expiry:'2026-12-31'},
  {bank:'RCBC',color:'#e63946',cat:'appliances',title:'0% EasyTerms + Shop Now Pay Later',store:'Abenson, AbensonHome, Electroworld, Automatic Centre',desc:'0% installment at 3,6,12,24 months. First billing up to 3 months later. Valid at all branches nationwide.',expiry:'2026-12-31'},
  {bank:'EastWest',color:'#2dc653',cat:'appliances',title:'0% Installment up to 24 months',store:'Abenson, Electroworld, partner appliance stores',desc:'0% interest installment for appliances and gadgets at partner merchants.',expiry:'2026-12-31'},
  // RENOVATION
  {bank:'BDO',color:'#1d4ed8',cat:'renovation',title:'Buy Now Pay Later at Hardware & Home Stores',store:'AllHome, True Value, hardware stores nationwide',desc:'0% installment at home improvement stores. Min ₱3,000. Terms 3–36 months. Payment Holiday: pay first installment up to 4 months later.',expiry:'2026-12-31'},
  {bank:'BPI',color:'#c9184a',cat:'renovation',title:'0% Installment at AllHome & Home Stores',store:'AllHome, Wilcon Depot partner merchants',desc:'FlexipayZero for home improvement needs. Available for renovation materials and fixtures.',expiry:'2026-12-31'},
  {bank:'RCBC',color:'#e63946',cat:'renovation',title:'0% Solar + 10% Off — Home Renovation',store:'Solar panel partners nationwide',desc:'0% installment for solar panel installation + 10% discount.',expiry:'2026-12-31'},
  {bank:'Metrobank',color:'#3a86ff',cat:'renovation',title:'0% Installment at Home Stores + ₱9K Cashback',store:'Partner home improvement merchants',desc:'0% installment on renovation materials. Register for More With Zero to get up to ₱9,000 cashback.',expiry:'2026-06-30'},
  // FURNITURE
  {bank:'EastWest',color:'#2dc653',cat:'furniture',title:'0% Installment up to 24 months at Our Home',store:'Our Home (nationwide branches)',desc:'Min ₱70,000 purchase for 0% 24-month installment. Perfect for full furniture sets or living room upgrades.',expiry:'2026-12-31'},
  {bank:'EastWest',color:'#2dc653',cat:'furniture',title:'20% Off at Opulence Design Concept',store:'Opulence Design Concept',desc:'20% off on premium home brands including Versace Home, Swarovski, Jonathan Adler.',expiry:'2026-12-31'},
  {bank:'BDO',color:'#1d4ed8',cat:'furniture',title:'BNPL at Our Home & Furniture Stores',store:'Our Home, furniture partner stores',desc:'Buy Now Pay Later for furniture. Min ₱3,000. Terms 3–36 months. First payment up to 4 months later.',expiry:'2026-12-31'},
  {bank:'BPI',color:'#c9184a',cat:'furniture',title:'0% Installment at Furniture Stores',store:'AbensonHOME, partner furniture merchants',desc:'FlexipayZero for home furniture. Up to 24 months 0%. Min purchase ₱18,000.',expiry:'2026-12-31'},
  // GADGETS
  {bank:'BPI',color:'#c9184a',cat:'gadgets',title:'Lower-Than-Cash Price on Apple Products',store:'Apple authorized resellers nationwide',desc:'Get Apple products at lower than cash price with BPI Signature. Plus 0% installment. Check Oh My Deals! (OMD!) app.',expiry:'2026-05-31'},
  {bank:'Metrobank',color:'#3a86ff',cat:'gadgets',title:'2x Points + 0% + ₱9K Cashback at Gadget Stores',store:'Abenson, Electroworld, online gadget stores',desc:'Earn 2x points on all online purchases. Plus register for More With Zero: up to ₱9,000 cashback. Redeem by Jun 30.',expiry:'2026-06-30'},
  {bank:'BDO',color:'#1d4ed8',cat:'gadgets',title:'BNPL for Gadgets — 36 months',store:'25,000+ partner gadget stores',desc:'Buy Now Pay Later on smartphones, laptops, tablets. Up to 36 months 0%. Payment Holiday: up to 4 months.',expiry:'2026-12-31'},
  {bank:'RCBC',color:'#e63946',cat:'gadgets',title:'0% EasyTerms at Gadget Stores + SNPL',store:'Abenson, Electroworld, Automatic Centre',desc:'0% installment on gadgets for 3, 6, 12, 24 months. Shop Now Pay Later available.',expiry:'2026-12-31'},
  // TUITION
  {bank:'BDO',color:'#1d4ed8',cat:'tuition',title:'BNPL for School Tuition — 0% up to 36 months',store:'Partner schools and universities',desc:'Pay tuition in flexible installments 3–36 months with 0% interest. Payment Holiday: defer first payment up to 4 months. Min ₱3,000.',expiry:'2026-12-31'},
  {bank:'BPI',color:'#c9184a',cat:'tuition',title:'FlexipayZero for Tuition — up to 6 months',store:'Partner schools, Abenson (school supplies)',desc:'Pay tuition fees via BPI FlexipayZero up to 6 months at 0% interest.',expiry:'2026-12-31'},
  {bank:'Metrobank',color:'#3a86ff',cat:'tuition',title:'0% Installment for Education',store:'Partner educational institutions',desc:'0% installment for tuition payments. Register for More With Zero promo for potential cashback.',expiry:'2026-12-31'},
  // GROCERIES
  {bank:'BDO',color:'#1d4ed8',cat:'groceries',title:'BDO Points → SMAC at SM Supermarket',store:'SM Supermarket, SM Hypermarket, Savemore',desc:'Transfer BDO Rewards Points to SMAC for SM shopping credits. Best grocery card for SM shoppers.',expiry:'2026-12-31'},
  {bank:'Metrobank',color:'#3a86ff',cat:'groceries',title:'1 pt per ₱20 + Grocery Promos',store:'SM Supermarket and partner grocery stores',desc:'Earn Metrobank points on grocery spend. Check Metrobank app for current grocery partner promos.',expiry:'2026-06-30'},
  {bank:'UnionBank',color:'#ff8c00',cat:'groceries',title:'3x Points on Grocery Shopping',store:'Supermarkets and grocery stores nationwide',desc:'Earn 3x non-expiring UnionBank rewards points at grocery stores. Redeem for cash credits, GCs, or miles.',expiry:'2026-12-31'},
  // DINING
  {bank:'UnionBank',color:'#ff8c00',cat:'dining',title:'20% Off Buffet at Mireio, Raffles Makati',store:'Mireio at Raffles Makati',desc:'20% off lunch and dinner buffet (daily). Min 2 diners, max 10. Prior reservation required. Valid Apr 14–Nov 30, 2026.',expiry:'2026-11-30'},
  {bank:'UnionBank',color:'#ff8c00',cat:'dining',title:'20% Off at Spectrum, Fairmont Makati',store:'Spectrum at Fairmont Makati',desc:'20% off lunch and dinner buffet. Min 2 diners, max 10. Prior reservation required.',expiry:'2026-11-30'},
  {bank:'Metrobank',color:'#3a86ff',cat:'dining',title:'50% Off Buffet — Cafe 1228, New World Makati',store:'Cafe 1228, New World Makati Hotel',desc:'50% off lunch and dinner buffet. Min 2, max 20 diners. Max discount ₱800. Reserve: (02) 8811-6888. Until Jun 30.',expiry:'2026-06-30'},
  {bank:'BPI',color:'#c9184a',cat:'dining',title:'50% Off Lunch Buffet — Shangri-La Manila',store:'Shangri-La Manila, Crowne Plaza Seven Corners',desc:'50% off lunch buffet (Mon–Fri). Min 2 diners, max 8. Also 50% off at Crowne Plaza Manila Galleria. Until Jun 30.',expiry:'2026-06-30'},
  {bank:'BPI',color:'#c9184a',cat:'dining',title:"50% Off at Burger Beast, Nono's, Cibo",store:"Burger Beast, Nono's, Kitchen by Coffee Bean, Cibo",desc:'50% off at these popular restaurants. Valid until July 31, 2026.',expiry:'2026-07-31'},
  {bank:'RCBC',color:'#e63946',cat:'dining',title:'Free Seafood Jambalaya at Burgoo',store:'Burgoo restaurants',desc:'Free Seafood Jambalaya for min ₱1,000 food spend + 1 drink. Dine-in and takeout. Until Oct 15, 2026.',expiry:'2026-10-15'},
  {bank:'RCBC',color:'#e63946',cat:'dining',title:'25% Off at California Pizza Kitchen',store:'CPK — Shangri-La Plaza, Festival, Poblacion, Eastwood',desc:'25% off total bill for min ₱3,000 spend (max ₱5,000). Dine-in and takeout.',expiry:'2026-12-31'},
  {bank:'EastWest',color:'#2dc653',cat:'dining',title:'50% Off at Stoned Steaks',store:'Stoned Steaks',desc:'50% discount for min ₱5,000 dine-in bill. Discount capped at ₱5,000. April 6–June 30, 2026.',expiry:'2026-06-30'},
  {bank:'EastWest',color:'#2dc653',cat:'dining',title:'50% Off at California Pizza Kitchen',store:'CPK selected branches',desc:'50% off food and beverage for min ₱3,000. Max discount ₱2,500. One EastWest Mastercard per transaction.',expiry:'2026-05-29'},
  // SHOPPING
  {bank:'RCBC',color:'#e63946',cat:'shopping',title:'5% Rebate at ALL Clothing Shops Worldwide',store:'Zara, H&M, Uniqlo, Bershka + all fashion brands',desc:'5% cash rebate at any local or international clothing shop — automatic on RCBC Visa Infinite. Use for ALL fashion purchases, no minimum.',expiry:'2026-12-31'},
  {bank:'Metrobank',color:'#3a86ff',cat:'shopping',title:'2x Points on Department Stores',store:'SM Department Store, Robinsons Department, Landmark',desc:'Earn 2x Metrobank Titanium rewards points on all department store purchases.',expiry:'2026-12-31'},
  {bank:'EastWest',color:'#2dc653',cat:'shopping',title:'20% Off at Oxy Originals Shoes',store:'Oxy Originals (online: oxyoriginals.ph + stores)',desc:'20% off all purchases, no minimum spend. Use promo code EWPERKS online or present card in-store.',expiry:'2026-06-30'},
  {bank:'BPI',color:'#c9184a',cat:'shopping',title:'Up to ₱7,000 eGC — Visa Shop Anywhere',store:'All merchants (straight + installment)',desc:'Register via OMD! app now (ends Jun 30). Spend with BPI Signature to earn up to ₱7,000 eGCs + ₱2,000 bonus. REGISTER TODAY!',expiry:'2026-06-30'},
  // ONLINE
  {bank:'Metrobank',color:'#3a86ff',cat:'online',title:'2x Points on ALL Online Purchases',store:'Lazada, Shopee, Zalora, PayPal, any online store',desc:'Earn 2x Metrobank Titanium points on every online purchase. Best card for online shopping.',expiry:'2026-12-31'},
  {bank:'UnionBank',color:'#ff8c00',cat:'online',title:'3x Points on Online Shopping',store:'Shopee, Lazada, online merchants',desc:'Earn 3x non-expiring UnionBank rewards points on online shopping. Redeem for cash credits, Cebu Pacific miles.',expiry:'2026-12-31'},
  {bank:'RCBC',color:'#e63946',cat:'online',title:'3x Points on Local Online + 5x Overseas Online',store:'All local and international online merchants',desc:'3x points on local online purchases. 5x points on overseas online shopping.',expiry:'2026-12-31'},
  {bank:'BDO',color:'#1d4ed8',cat:'online',title:'Shopee Sale — Up to 20% Off Select Items',store:'Shopee Philippines',desc:'Up to 20% off on fashion, electronics, and home appliances on Shopee. Plus eCommerce Purchase Protection up to US$200.',expiry:'2026-05-31'},
];

export function renderDeals(container) {
  let activeFilter = 'all';

  const FILTERS = [
    {key:'all', label:'All'},
    {key:'appliances', label:'🏠 Appliances'},
    {key:'renovation', label:'🔨 Renovation'},
    {key:'furniture', label:'🛋️ Furniture'},
    {key:'gadgets', label:'💻 Gadgets'},
    {key:'groceries', label:'🛒 Groceries'},
    {key:'dining', label:'🍽️ Dining'},
    {key:'shopping', label:'🛍️ Shopping'},
    {key:'online', label:'📦 Online'},
    {key:'tuition', label:'🎓 Tuition'},
  ];

  container.innerHTML = `
    <div class="page-header">
      <h1>Deals</h1>
      <span class="page-date">Curated for your 6 cards</span>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:var(--sp5)" id="deal-filters">
      ${FILTERS.map(f => `<button class="deal-filter${f.key==='all'?' active':''}" data-cat="${f.key}">${f.label}</button>`).join('')}
    </div>
    <div id="deals-grid"></div>
  `;

  function renderGrid() {
    const filtered = activeFilter === 'all' ? DEALS : DEALS.filter(d => d.cat === activeFilter);
    const now = new Date();
    document.getElementById('deals-grid').innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:var(--sp4)">
        ${filtered.map(d => {
          const exp = new Date(d.expiry);
          const daysLeft = Math.ceil((exp - now) / (1000*60*60*24));
          const expiryClass = daysLeft < 0 ? 'danger' : daysLeft <= 14 ? 'warn' : 'muted';
          const expiryText = daysLeft < 0 ? 'Expired' : daysLeft <= 14 ? `Expires in ${daysLeft}d` : `Expires ${exp.toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'})}`;
          return `
            <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r2);padding:var(--sp4);display:flex;flex-direction:column;gap:var(--sp2);box-shadow:var(--shadow1)">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <div style="display:flex;align-items:center;gap:var(--sp2)">
                  <div style="width:8px;height:8px;border-radius:50%;background:${d.color};flex-shrink:0"></div>
                  <span style="font-size:0.75rem;color:var(--muted2)">${d.bank}</span>
                </div>
                ${daysLeft >= 0 && daysLeft <= 14 ? '<span class="badge warn">USE SOON</span>' : ''}
              </div>
              <div style="font-weight:700;font-size:0.9rem;line-height:1.3">${d.title}</div>
              <div style="font-size:0.75rem;color:${d.color};font-weight:500">${d.store}</div>
              <div style="font-size:0.8rem;color:var(--text2);line-height:1.5;flex:1">${d.desc}</div>
              <div style="font-size:0.7rem" class="${expiryClass}">${expiryText}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  document.getElementById('deal-filters').addEventListener('click', e => {
    const btn = e.target.closest('[data-cat]');
    if (!btn) return;
    activeFilter = btn.dataset.cat;
    document.querySelectorAll('.deal-filter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderGrid();
  });

  renderGrid();
}
