import { fmt } from './ui.jsx'

function calcOffers(p) {
  const arv = parseFloat(p.arv)||0
  const reno = (p.repair_items||[]).reduce((s,r)=>s+(parseFloat(r.cost)||0),0)
  const commCashPct = (parseFloat(p.comm_cash_pct)||9)/100
  const commListPct = (parseFloat(p.comm_list_pct)||6)/100
  const profitPct = (parseFloat(p.profit_margin)||15)/100
  const profit = p.profit_override ? parseFloat(p.profit_override) : arv*profitPct
  const asisDisc = (parseFloat(p.asis_pct)||50)/100
  const asisValue = p.asis_override ? parseFloat(p.asis_override) : arv-(asisDisc*reno)
  const holdCashPct = (parseFloat(p.hold_cash_pct)||0.75)/100
  const holdCashMo = parseFloat(p.hold_cash_months)||6
  const cashOffer = p.cash_offer_override ? parseFloat(p.cash_offer_override) : arv-reno-(commCashPct*arv)-(holdCashPct*holdCashMo*arv)-profit
  const holdOpt2Pct = (parseFloat(p.hold_opt2_pct)||0.5)/100
  const holdOpt2Mo = parseFloat(p.hold_opt2_months)||3
  const opt2Comm = commListPct*asisValue
  const opt2Holding = holdOpt2Pct*holdOpt2Mo*arv
  const opt2Net = asisValue-opt2Comm-opt2Holding
  const holdOpt3Pct = (parseFloat(p.hold_opt3_pct)||0.5)/100
  const holdOpt3Mo = parseFloat(p.hold_opt3_months)||6
  const opt3Comm = commListPct*arv
  const opt3Holding = holdOpt3Pct*holdOpt3Mo*arv
  const opt3Net = arv-reno-opt3Comm-opt3Holding
  return { arv, reno, cashOffer, asisValue, opt2Comm, opt2Holding, opt2Net, opt3Comm, opt3Holding, opt3Net, commListPct, holdOpt2Mo, holdOpt3Mo }
}

function fmtNeg(n) {
  return '−$' + Math.round(Math.abs(n)).toLocaleString('en-US')
}

function pageHeader(address) {
  return `
    <div class="pg-header">
      <img src="/nhc-logo.svg" alt="NHC Logo" />
      <div class="pg-brand">
        <h2>NEW HOME COLLECTIVE</h2>
        <p>Real Estate Solutions · Fast, Fair, Honest</p>
      </div>
      ${address ? `<div class="pg-header-address">New Home Collective · ${address}</div>` : ''}
    </div>
    <div class="pg-stripe">
      <span class="s1"></span><span class="s2"></span><span class="s3"></span><span class="s4"></span><span class="s5"></span>
    </div>
  `
}

const CSS = `
  :root {
    --blue:   #2D6FAF;
    --green:  #3B6D11;
    --gold:   #B8892A;
    --orange: #D97825;
    --red:    #c0392b;
  }

  #proposal-root * { box-sizing: border-box; margin: 0; padding: 0; }
  #proposal-root {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    background: #e8eaed;
    padding: 24px 0 48px;
    min-height: 100%;
    min-width: 900px;
  }

  .proposal-page {
    background: #fff;
    color: #111;
    width: 8.5in;
    height: 11in;
    margin: 0 auto 24px;
    padding: 0.45in 0.55in 0.45in;
    box-shadow: 0 4px 24px rgba(0,0,0,0.15);
    position: relative;
    font-family: 'Helvetica Neue', Arial, sans-serif;
    overflow: hidden;
  }

  /* ── HEADER ── */
  .pg-header {
    border: 1.5px solid var(--blue);
    border-radius: 6px;
    padding: 10px 18px;
    display: flex;
    align-items: center;
    gap: 14px;
    position: relative;
  }
  .pg-header img { width: 52px; height: 52px; flex-shrink: 0; object-fit: contain; }
  .pg-brand h2 { font-size: 17px; font-weight: 700; color: var(--blue); letter-spacing: 0.3px; line-height: 1.1; }
  .pg-brand p  { font-size: 11px; color: #888; font-style: italic; margin-top: 3px; }
  .pg-header-address { position: absolute; top: 10px; right: 18px; font-size: 9.5px; color: #888; font-style: italic; }

  .pg-stripe { height: 12px; margin: 4px 0 0; display: flex; }
  .pg-stripe span { display: block; height: 100%; }
  .pg-stripe .s1 { background: var(--blue);   flex: 25; }
  .pg-stripe .s2 { background: var(--green);  flex: 24; }
  .pg-stripe .s3 { background: var(--gold);   flex: 24; }
  .pg-stripe .s4 { background: var(--orange); flex: 13; }
  .pg-stripe .s5 { background: var(--red);    flex: 13; }

  /* ── PAGE 1 TITLE ── */
  .pg-title    { font-size: 34px; font-weight: 800; color: var(--blue); text-align: center; letter-spacing: 0.5px; margin-top: 16px; margin-bottom: 4px; line-height: 1.1; }
  .pg-address  { text-align: center; font-size: 16px; font-weight: 700; color: #111; margin-bottom: 3px; }
  .pg-subtitle { text-align: center; font-size: 12px; font-style: italic; color: #555; line-height: 1.5; }

  /* ── SECTION HEADINGS ── */
  .pg-section-title { font-size: 17px; font-weight: 700; color: var(--blue); margin: 16px 0 8px; }

  /* ── VALUATION BOX ── */
  .pg-valuation { border: 1px solid #d0d7e0; border-radius: 4px; padding: 10px 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .pg-val-cell .label { font-size: 11px; color: #888; margin-bottom: 2px; }
  .pg-val-cell .num   { font-size: 26px; font-weight: 800; color: var(--blue); line-height: 1.1; }

  /* ── REPAIR TABLE ── */
  .pg-reno-intro { font-size: 11.5px; font-style: italic; color: #555; margin-bottom: 6px; }
  .pg-reno-table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
  .pg-reno-table th { background: var(--blue); color: #fff; padding: 7px 14px; text-align: left; font-weight: 700; }
  .pg-reno-table th:last-child { text-align: right; }
  .pg-reno-table td { padding: 5px 14px; border-bottom: 1px solid #eee; }
  .pg-reno-table td:last-child { text-align: right; font-weight: 600; }
  .pg-reno-table tr:nth-child(even) td { background: #f9f9f9; }
  .pg-reno-table .total-row td { background: var(--blue); color: #fff; font-weight: 700; border: none; padding: 8px 14px; }

  /* ── OPTION BOXES ── */
  .pg-intro-text { font-size: 12px; color: #333; line-height: 1.5; margin-bottom: 14px; }

  .pg-option-box { border: 1px solid #d0d7e0; border-radius: 4px; overflow: hidden; margin-bottom: 14px; }
  .pg-option-header { color: #fff; padding: 9px 16px; }
  .pg-option-box.green-o  .pg-option-header { background: var(--green); }
  .pg-option-box.blue-o   .pg-option-header { background: var(--blue); }
  .pg-option-box.orange-o .pg-option-header { background: var(--orange); }
  .opt-title { font-size: 13px; font-weight: 700; letter-spacing: 0.3px; }
  .opt-sub   { font-size: 11px; font-style: italic; opacity: 0.95; margin-top: 2px; }

  .pg-option-body { padding: 12px 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; background: #fff; }

  .pg-option-left { font-size: 11.5px; line-height: 1.55; }
  .price-label { font-size: 11px; color: #666; margin-bottom: 1px; }
  .price-num   { font-size: 22px; font-weight: 800; color: var(--blue); line-height: 1.1; margin-bottom: 6px; }
  .less-title  { font-weight: 700; margin-bottom: 3px; color: #333; font-size: 11.5px; }
  .less-line   { display: flex; justify-content: space-between; margin-bottom: 2px; color: var(--red); font-size: 11.5px; }
  .net-line    { margin-top: 6px; padding-top: 5px; border-top: 1px solid #ddd; font-weight: 700; color: var(--blue); display: flex; justify-content: space-between; font-size: 12px; }

  .pg-option-right { font-size: 11.5px; border-left: 1px solid #eee; padding-left: 20px; }
  .right-title { font-weight: 700; color: var(--blue); margin-bottom: 6px; font-size: 12px; }
  .pg-option-right ul { list-style: none; padding: 0; }
  .pg-option-right li { padding-left: 12px; position: relative; margin-bottom: 4px; line-height: 1.4; color: #333; }
  .pg-option-right li::before { content: '•'; position: absolute; left: 0; color: #555; }

  /* ── COMPARISON TABLE ── */
  .pg-comp-table { width: 100%; border-collapse: collapse; font-size: 12.5px; margin-top: 4px; }
  .pg-comp-table th { background: var(--blue); color: #fff; padding: 11px 16px; text-align: left; font-weight: 700; }
  .pg-comp-table td { padding: 12px 16px; border-bottom: 1px solid #eee; }
  .pg-comp-table td:first-child { font-weight: 700; }
  .pg-comp-table tr:nth-child(even) td { background: #f9f9f9; }

  /* ── CTA ── */
  .pg-cta { text-align: center; margin-top: 36px; padding-top: 24px; border-top: 1px solid #ddd; }
  .pg-cta h3 { font-size: 18px; font-weight: 700; color: var(--blue); margin-bottom: 6px; }
  .pg-cta p  { font-size: 12px; font-style: italic; color: #555; }

  /* ── FOOTER BOX ── */
  .pg-footer-box { border: 1.5px solid var(--blue); border-radius: 4px; padding: 12px 18px; display: flex; align-items: center; gap: 14px; margin-top: 20px; }
  .pg-footer-box img { width: 44px; height: 44px; flex-shrink: 0; object-fit: contain; }
  .pg-footer-box h2  { font-size: 14px; font-weight: 700; color: var(--blue); }
  .pg-footer-box p   { font-size: 11px; color: #888; font-style: italic; margin-top: 2px; }

  /* ── PAGE NUMBER ── */
  .pg-page-num { position: absolute; bottom: 0.28in; left: 0; right: 0; text-align: center; font-size: 10px; color: #aaa; }

  /* ── PRINT ── */
  @media print {
    @page { margin: 0; size: letter; }
    body * { visibility: hidden; }
    #proposal-print-wrap, #proposal-print-wrap * { visibility: visible; }
    #proposal-print-wrap { position: fixed; top: 0; left: 0; width: 100%; }
    .no-print { display: none !important; }
    #proposal-root { background: white; padding: 0; }
    .proposal-page {
      box-shadow: none; margin: 0;
      width: 100%; height: 100vh;
      overflow: hidden;
      page-break-after: always;
    }
    .proposal-page:last-child { page-break-after: auto; }
  }
`

export default function ProposalModal({ property, onClose }) {
  if (!property) return null
  const d = calcOffers(property)
  const address = property.address || '— Address Not Entered —'
  const repairs = (property.repair_items||[]).filter(r => (r.name || r.cost) && parseFloat(r.cost) > 0)

  const bedsBaths = [property.beds && `${property.beds} Bed`, property.baths && `${property.baths} Bath`].filter(Boolean).join(' · ')
  const sqft = property.sqft ? `${parseInt(property.sqft).toLocaleString('en-US')} sq ft` : ''
  const commPct = (d.commListPct*100).toFixed(1).replace(/\.0$/,'')

  const repairRows = repairs.map(r =>
    `<tr><td>${r.name}</td><td>$${Math.round(parseFloat(r.cost)||0).toLocaleString('en-US')}</td></tr>`
  ).join('')

  const html = `
    <!-- ══ PAGE 1: Cover + Valuation + Repairs ══ -->
    <div class="proposal-page">
      ${pageHeader('')}

      <h1 class="pg-title">CASH OFFER PROPOSAL</h1>
      <div class="pg-address">${address}</div>
      ${bedsBaths ? `<div class="pg-subtitle">${bedsBaths}</div>` : ''}
      ${sqft      ? `<div class="pg-subtitle">${sqft}</div>` : ''}

      <div class="pg-section-title">Property Valuation</div>
      <div class="pg-valuation">
        <div class="pg-val-cell">
          <div class="label">After Renovation Value</div>
          <div class="num">$${Math.round(d.arv).toLocaleString('en-US')}</div>
        </div>
        <div class="pg-val-cell">
          <div class="label">As-Is Market Value</div>
          <div class="num">$${Math.round(d.asisValue).toLocaleString('en-US')}</div>
        </div>
      </div>

      ${repairs.length > 0 ? `
      <div class="pg-section-title">Renovation Breakdown</div>
      <div class="pg-reno-intro">Estimated repairs required to bring the property to retail condition:</div>
      <table class="pg-reno-table">
        <thead><tr><th>Item</th><th>Cost</th></tr></thead>
        <tbody>${repairRows}</tbody>
        <tfoot><tr class="total-row"><td>TOTAL ESTIMATED REPAIRS</td><td>$${Math.round(d.reno).toLocaleString('en-US')}</td></tr></tfoot>
      </table>
      ` : ''}

      <div class="pg-page-num">New Home Collective · Page 1 of 3</div>
    </div>

    <!-- ══ PAGE 2: Three-Option Offer ══ -->
    <div class="proposal-page">
      ${pageHeader(address)}

      <div class="pg-section-title" style="margin-top:14px;">Three-Option Offer</div>
      <p class="pg-intro-text">We're offering you three paths forward. Each one fits a different priority — speed, net amount, or maximum upside. Here's how they compare side by side.</p>

      <!-- Option 1: Cash Offer -->
      <div class="pg-option-box green-o">
        <div class="pg-option-header">
          <div class="opt-title">OPTION 1 — CASH OFFER</div>
          <div class="opt-sub">Fast, As-Is, No Hassle</div>
        </div>
        <div class="pg-option-body">
          <div class="pg-option-left">
            <div class="price-label">Purchase Price</div>
            <div class="price-num" style="color:var(--green);">$${Math.round(d.cashOffer).toLocaleString('en-US')}</div>
            <div class="net-line" style="color:var(--green);"><span>Net to Seller:</span><span>$${Math.round(d.cashOffer).toLocaleString('en-US')}</span></div>
          </div>
          <div class="pg-option-right">
            <div class="right-title">Highlights</div>
            <ul>
              <li>Close in 2–3 weeks</li>
              <li>No repairs required</li>
              <li>No commissions, no fees</li>
              <li>Quick, clean sale</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Option 2: As-Is Listing -->
      <div class="pg-option-box blue-o">
        <div class="pg-option-header">
          <div class="opt-title">OPTION 2 — AS-IS LISTING</div>
          <div class="opt-sub">Sell on the Open Market</div>
        </div>
        <div class="pg-option-body">
          <div class="pg-option-left">
            <div class="price-label">List Price</div>
            <div class="price-num">$${Math.round(d.asisValue).toLocaleString('en-US')}</div>
            <div class="less-title">Less Costs:</div>
            <div class="less-line"><span>Commission (${commPct}%):</span><span>${fmtNeg(d.opt2Comm)}</span></div>
            <div class="less-line"><span>Holding (${d.holdOpt2Mo} mo):</span><span>${fmtNeg(d.opt2Holding)}</span></div>
            <div class="net-line"><span>Net to Seller:</span><span>~$${Math.round(d.opt2Net).toLocaleString('en-US')}</span></div>
          </div>
          <div class="pg-option-right">
            <div class="right-title">Considerations</div>
            <ul>
              <li>2–3 month timeline</li>
              <li>Showings &amp; negotiation required</li>
              <li>Inspection / financing risk</li>
              <li>Carrying costs while listed</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Option 3: Full Retail -->
      <div class="pg-option-box orange-o">
        <div class="pg-option-header">
          <div class="opt-title">OPTION 3 — FULL RETAIL (After Renovation)</div>
          <div class="opt-sub">Renovate First, Then List at Top of Market</div>
        </div>
        <div class="pg-option-body">
          <div class="pg-option-left">
            <div class="price-label">Projected Sale Price</div>
            <div class="price-num">$${Math.round(d.arv).toLocaleString('en-US')}</div>
            <div class="less-title">Less Costs:</div>
            <div class="less-line"><span>Repairs:</span><span>${fmtNeg(d.reno)}</span></div>
            <div class="less-line"><span>Commission (${commPct}%):</span><span>${fmtNeg(d.opt3Comm)}</span></div>
            <div class="less-line"><span>Holding (${d.holdOpt3Mo} mo):</span><span>${fmtNeg(d.opt3Holding)}</span></div>
            <div class="net-line"><span>Net to Seller:</span><span>~$${Math.round(d.opt3Net).toLocaleString('en-US')}</span></div>
          </div>
          <div class="pg-option-right">
            <div class="right-title">Considerations</div>
            <ul>
              <li>4–6 month timeline</li>
              <li>Full renovation required</li>
              <li>Project management &amp; coordination</li>
              <li>Market &amp; cost overrun risk</li>
            </ul>
          </div>
        </div>
      </div>

      <div class="pg-page-num">New Home Collective · Page 2 of 3</div>
    </div>

    <!-- ══ PAGE 3: Comparison + CTA ══ -->
    <div class="proposal-page">
      ${pageHeader(address)}

      <div class="pg-section-title" style="margin-top:14px;">Seller Comparison</div>
      <p class="pg-intro-text"><em>At a glance — what each option puts in your pocket and what it asks of you.</em></p>

      <table class="pg-comp-table">
        <thead>
          <tr><th>Option</th><th>Net to Seller</th><th>Timeline</th><th>Effort</th></tr>
        </thead>
        <tbody>
          <tr><td>Cash Offer (Option 1)</td><td>$${Math.round(d.cashOffer).toLocaleString('en-US')}</td><td>2–3 weeks</td><td>Very Low</td></tr>
          <tr><td>As-Is Listing (Option 2)</td><td>~$${Math.round(d.opt2Net).toLocaleString('en-US')}</td><td>2–3 months</td><td>Low</td></tr>
          <tr><td>Full Retail (Option 3)</td><td>~$${Math.round(d.opt3Net).toLocaleString('en-US')}</td><td>4–6 months</td><td>High</td></tr>
        </tbody>
      </table>

      <div class="pg-cta">
        <h3>Ready to move forward? Let's talk.</h3>
        <p>Reach out anytime to accept this offer or ask any questions.</p>
      </div>

      <div class="pg-footer-box">
        <img src="/nhc-logo.svg" alt="NHC" />
        <div>
          <h2>NEW HOME COLLECTIVE</h2>
          <p>Real Estate Solutions · Lexington, KY</p>
        </div>
      </div>

      <div class="pg-page-num">New Home Collective · Page 3 of 3</div>
    </div>
  `

  return (
    <div id="proposal-print-wrap" style={{ position:'fixed', inset:0, zIndex:300, overflowY:'auto', overflowX:'auto', WebkitOverflowScrolling:'touch' }}>
      <style>{CSS}</style>

      <div className="no-print" style={{ position:'sticky', top:0, zIndex:10, background:'rgba(15,20,40,0.93)', backdropFilter:'blur(8px)', padding:'12px 20px', display:'flex', gap:10, alignItems:'center' }}>
        <button onClick={()=>window.print()} style={{ background:'#B8892A', border:'none', borderRadius:6, padding:'10px 22px', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
          Print / Save PDF
        </button>
        <button onClick={onClose} style={{ background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.25)', borderRadius:6, padding:'10px 18px', color:'#fff', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
          Close
        </button>
        <span style={{ fontSize:12, color:'rgba(255,255,255,0.45)', marginLeft:6 }}>Print → Save as PDF · set margins to None</span>
      </div>

      <div id="proposal-root" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}
