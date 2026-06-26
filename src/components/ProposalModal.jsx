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
    </div>
    <div class="pg-stripe">
      <span class="s1"></span><span class="s2"></span><span class="s3"></span><span class="s4"></span><span class="s5"></span>
    </div>
    ${address ? `<div class="pg-note">New Home Collective · ${address}</div>` : ''}
  `
}

const CSS = `
  :root {
    --doc-blue: #2D6FAF;
    --green: #3B6D11;
    --gold: #B8892A;
    --orange: #D97825;
    --red: #c0392b;
    --blue: #2D6FAF;
  }

  #proposal-root * { box-sizing: border-box; margin: 0; padding: 0; }
  #proposal-root { font-family: 'DM Sans', 'Helvetica Neue', Arial, sans-serif; background: #e8eaed; padding: 24px 12px 48px; }

  .proposal-page {
    background: #fff;
    color: #111;
    width: 8.5in;
    min-height: 11in;
    max-width: 100%;
    margin: 0 auto 20px;
    padding: 0.4in 0.55in 0.7in;
    box-shadow: 0 4px 24px rgba(0,0,0,0.1);
    position: relative;
    font-family: 'DM Sans', 'Helvetica Neue', Arial, sans-serif;
    page-break-after: always;
  }
  .proposal-page:last-child { page-break-after: auto; }

  .pg-header {
    border: 1.5px solid var(--doc-blue);
    border-radius: 6px;
    padding: 12px 20px;
    display: flex;
    align-items: center;
    gap: 16px;
    height: 78px;
  }
  .pg-header img { width: 56px; height: 56px; flex-shrink: 0; object-fit: contain; }
  .pg-brand h2 { font-size: 18px; font-weight: 700; color: var(--doc-blue); letter-spacing: 0.3px; line-height: 1.1; }
  .pg-brand p { font-size: 12px; color: #888; font-style: italic; margin-top: 4px; line-height: 1; }

  .pg-stripe { height: 14px; margin: 5px 0 0; display: flex; }
  .pg-stripe span { display: block; height: 100%; }
  .pg-stripe .s1 { background: var(--blue); flex: 25; }
  .pg-stripe .s2 { background: var(--green); flex: 24; }
  .pg-stripe .s3 { background: var(--gold); flex: 24; }
  .pg-stripe .s4 { background: var(--orange); flex: 13; }
  .pg-stripe .s5 { background: var(--red); flex: 13; }

  .pg-note { position: absolute; top: 0.18in; right: 0.55in; font-size: 9.5px; color: #888; font-style: italic; }

  .pg-title { font-size: 36px; font-weight: 800; color: var(--doc-blue); text-align: center; letter-spacing: 0.5px; margin-top: 18px; margin-bottom: 6px; line-height: 1.1; }
  .pg-address { text-align: center; font-size: 17px; font-weight: 700; color: #111; margin-bottom: 4px; }
  .pg-subtitle { text-align: center; font-size: 12px; font-style: italic; color: #555; line-height: 1.4; }

  .pg-section-title { font-size: 18px; font-weight: 700; color: var(--doc-blue); margin: 18px 0 8px; }

  .pg-valuation { border: 1px solid #d0d7e0; border-radius: 4px; padding: 12px 22px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .pg-val-cell .label { font-size: 11px; color: #888; margin-bottom: 2px; }
  .pg-val-cell .num { font-size: 28px; font-weight: 800; color: var(--doc-blue); line-height: 1.1; }

  .pg-reno-intro { font-size: 12px; font-style: italic; color: #555; margin-bottom: 8px; }
  .pg-reno-table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
  .pg-reno-table th { background: var(--doc-blue); color: white; padding: 8px 14px; text-align: left; font-weight: 700; }
  .pg-reno-table th:last-child { text-align: right; }
  .pg-reno-table td { padding: 5px 14px; border-bottom: 1px solid #eee; }
  .pg-reno-table td:last-child { text-align: right; font-weight: 700; }
  .pg-reno-table tr:nth-child(even) td { background: #f9f9f9; }
  .pg-reno-table .total-row td { background: var(--doc-blue); color: white; font-weight: 700; border: none; padding: 9px 14px; }

  .pg-intro-text { font-size: 12px; color: #333; line-height: 1.45; margin-bottom: 14px; }

  .pg-option-box { border: 1px solid #d0d7e0; border-radius: 4px; overflow: hidden; margin-bottom: 14px; }
  .pg-option-header { color: white; padding: 10px 18px; }
  .pg-option-box.green-o .pg-option-header { background: var(--green); }
  .pg-option-box.blue-o .pg-option-header { background: var(--doc-blue); }
  .pg-option-box.orange-o .pg-option-header { background: var(--orange); }
  .pg-option-header .opt-title { font-size: 13px; font-weight: 700; letter-spacing: 0.3px; }
  .pg-option-header .opt-sub { font-size: 11.5px; font-style: italic; opacity: 0.95; margin-top: 1px; }
  .pg-option-body { padding: 12px 18px; display: grid; grid-template-columns: 1.3fr 1fr; gap: 32px; background: white; }
  .pg-option-left { font-size: 11.5px; line-height: 1.55; }
  .pg-option-left .price-label { font-size: 11px; color: #666; margin-bottom: 1px; }
  .pg-option-left .price-num { font-size: 22px; font-weight: 800; color: var(--doc-blue); margin-bottom: 4px; line-height: 1.1; }
  .pg-option-left .less-title { font-weight: 700; margin-top: 2px; margin-bottom: 2px; color: #333; }
  .pg-option-left .less-line { display: flex; justify-content: space-between; margin-bottom: 1px; color: var(--red); }
  .pg-option-left .net-line { margin-top: 4px; padding-top: 4px; border-top: 1px solid #ddd; font-weight: 700; color: var(--doc-blue); display: flex; justify-content: space-between; }
  .pg-option-right { font-size: 11.5px; }
  .pg-option-right .right-title { font-weight: 700; color: var(--doc-blue); margin-bottom: 4px; }
  .pg-option-right ul { list-style: none; padding: 0; }
  .pg-option-right li { padding-left: 11px; position: relative; margin-bottom: 3px; line-height: 1.4; color: #333; }
  .pg-option-right li::before { content: '•'; position: absolute; left: 0; color: #555; }

  .pg-comp-table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .pg-comp-table th { background: var(--doc-blue); color: white; padding: 10px 16px; text-align: left; font-weight: 700; }
  .pg-comp-table td { padding: 11px 16px; border-bottom: 1px solid #eee; }
  .pg-comp-table td:first-child { font-weight: 700; }
  .pg-comp-table tr:nth-child(even) td { background: #f9f9f9; }

  .pg-cta { text-align: center; margin: 36px 0 20px; padding-top: 22px; border-top: 1px solid #ddd; }
  .pg-cta h3 { font-size: 17px; font-weight: 700; color: var(--doc-blue); margin-bottom: 6px; }
  .pg-cta p { font-size: 12px; font-style: italic; color: #555; }

  .pg-footer-box { border: 1.5px solid var(--doc-blue); border-radius: 4px; padding: 12px 20px; display: flex; align-items: center; gap: 14px; margin-top: 16px; }
  .pg-footer-box img { width: 44px; height: 44px; flex-shrink: 0; object-fit: contain; }
  .pg-footer-box h2 { font-size: 14px; font-weight: 700; color: var(--doc-blue); }
  .pg-footer-box p { font-size: 11px; color: #888; font-style: italic; margin-top: 2px; }

  .pg-page-num { position: absolute; bottom: 0.3in; left: 0; right: 0; text-align: center; font-size: 10px; color: #999; }

  @media print {
    @page { margin: 0; size: letter; }
    body * { visibility: hidden; }
    #proposal-print-wrap, #proposal-print-wrap * { visibility: visible; }
    #proposal-print-wrap { position: fixed; top: 0; left: 0; width: 100%; }
    .no-print { display: none !important; }
    #proposal-root { background: white; padding: 0; }
    .proposal-page { box-shadow: none; margin: 0; width: 100%; min-height: 100vh; }
  }
`

export default function ProposalModal({ property, onClose }) {
  if (!property) return null
  const d = calcOffers(property)
  const address = property.address || '— Address Not Entered —'
  const repairs = (property.repair_items||[]).filter(r => r.name || r.cost)

  const bedsBathsParts = [
    property.beds && `${property.beds} Bed`,
    property.baths && `${property.baths} Bath`,
  ].filter(Boolean)
  const bedsBaths = bedsBathsParts.join(' · ')
  const sqft = property.sqft ? `${parseInt(property.sqft).toLocaleString('en-US')} sq ft` : ''

  const repairRows = repairs.map(r => `<tr><td>${r.name}</td><td>${fmt(parseFloat(r.cost)||0)}</td></tr>`).join('')

  const html = `
    <!-- PAGE 1 -->
    <div class="proposal-page">
      ${pageHeader('')}
      <h1 class="pg-title">CASH OFFER PROPOSAL</h1>
      <div class="pg-address">${address}</div>
      ${bedsBaths ? `<div class="pg-subtitle">${bedsBaths}</div>` : ''}
      ${sqft ? `<div class="pg-subtitle">${sqft}</div>` : ''}

      <div class="pg-section-title">Property Valuation</div>
      <div class="pg-valuation">
        <div class="pg-val-cell">
          <div class="label">After Renovation Value</div>
          <div class="num">${fmt(d.arv)}</div>
        </div>
        <div class="pg-val-cell">
          <div class="label">As-Is Market Value</div>
          <div class="num">${fmt(d.asisValue)}</div>
        </div>
      </div>

      ${repairs.length > 0 ? `
      <div class="pg-section-title">Renovation Breakdown</div>
      <div class="pg-reno-intro">Estimated repairs required to bring the property to retail condition:</div>
      <table class="pg-reno-table">
        <thead><tr><th>Item</th><th>Cost</th></tr></thead>
        <tbody>${repairRows}</tbody>
        <tfoot><tr class="total-row"><td>TOTAL ESTIMATED REPAIRS</td><td>${fmt(d.reno)}</td></tr></tfoot>
      </table>
      ` : ''}

      <div class="pg-page-num">New Home Collective · Page 1 of 3</div>
    </div>

    <!-- PAGE 2 -->
    <div class="proposal-page">
      ${pageHeader(address)}
      <div class="pg-section-title">Three-Option Offer</div>
      <p class="pg-intro-text">We're offering you three paths forward. Each one fits a different priority — speed, net amount, or maximum upside. Here's how they compare side by side.</p>

      <div class="pg-option-box green-o">
        <div class="pg-option-header">
          <div class="opt-title">OPTION 1 — CASH OFFER</div>
          <div class="opt-sub">Fast, As-Is, No Hassle</div>
        </div>
        <div class="pg-option-body">
          <div class="pg-option-left">
            <div class="price-label">Purchase Price</div>
            <div class="price-num" style="color: var(--green);">${fmt(d.cashOffer)}</div>
            <div class="net-line" style="color: var(--green);"><span>Net to Seller:</span><span>${fmt(d.cashOffer)}</span></div>
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

      <div class="pg-option-box blue-o">
        <div class="pg-option-header">
          <div class="opt-title">OPTION 2 — AS-IS LISTING</div>
          <div class="opt-sub">Sell on the Open Market</div>
        </div>
        <div class="pg-option-body">
          <div class="pg-option-left">
            <div class="price-label">List Price</div>
            <div class="price-num">${fmt(d.asisValue)}</div>
            <div class="less-title">Less Costs:</div>
            <div class="less-line"><span>Commission (${(d.commListPct*100).toFixed(1).replace(/\.0$/,'')}%):</span><span>${fmtNeg(d.opt2Comm)}</span></div>
            <div class="less-line"><span>Holding (${d.holdOpt2Mo} mo):</span><span>${fmtNeg(d.opt2Holding)}</span></div>
            <div class="net-line"><span>Net to Seller:</span><span>~${fmt(d.opt2Net)}</span></div>
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

      <div class="pg-option-box orange-o">
        <div class="pg-option-header">
          <div class="opt-title">OPTION 3 — FULL RETAIL (After Renovation)</div>
          <div class="opt-sub">Renovate First, Then List at Top of Market</div>
        </div>
        <div class="pg-option-body">
          <div class="pg-option-left">
            <div class="price-label">Projected Sale Price</div>
            <div class="price-num">${fmt(d.arv)}</div>
            <div class="less-title">Less Costs:</div>
            <div class="less-line"><span>Repairs:</span><span>${fmtNeg(d.reno)}</span></div>
            <div class="less-line"><span>Commission (${(d.commListPct*100).toFixed(1).replace(/\.0$/,'')}%):</span><span>${fmtNeg(d.opt3Comm)}</span></div>
            <div class="less-line"><span>Holding (${d.holdOpt3Mo} mo):</span><span>${fmtNeg(d.opt3Holding)}</span></div>
            <div class="net-line"><span>Net to Seller:</span><span>~${fmt(d.opt3Net)}</span></div>
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

    <!-- PAGE 3 -->
    <div class="proposal-page">
      ${pageHeader(address)}
      <div class="pg-section-title">Seller Comparison</div>
      <p class="pg-intro-text"><em>At a glance — what each option puts in your pocket and what it asks of you.</em></p>

      <table class="pg-comp-table">
        <thead>
          <tr><th>Option</th><th>Net to Seller</th><th>Timeline</th><th>Effort</th></tr>
        </thead>
        <tbody>
          <tr><td>Cash Offer (Option 1)</td><td>${fmt(d.cashOffer)}</td><td>2–3 weeks</td><td>Very Low</td></tr>
          <tr><td>As-Is Listing (Option 2)</td><td>~${fmt(d.opt2Net)}</td><td>2–3 months</td><td>Low</td></tr>
          <tr><td>Full Retail (Option 3)</td><td>~${fmt(d.opt3Net)}</td><td>4–6 months</td><td>High</td></tr>
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
    <div id="proposal-print-wrap" style={{ position:'fixed', inset:0, zIndex:300, overflowY:'auto', WebkitOverflowScrolling:'touch' }}>
      <style>{CSS}</style>
      <style>{`@media print { .no-print { display:none!important } }`}</style>

      {/* Toolbar */}
      <div className="no-print" style={{ position:'sticky', top:0, zIndex:10, background:'rgba(15,20,40,0.93)', backdropFilter:'blur(8px)', padding:'12px 20px', display:'flex', gap:10, alignItems:'center' }}>
        <button onClick={()=>window.print()} style={{ background:'#B8892A', border:'none', borderRadius:6, padding:'10px 22px', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
          Print / Save PDF
        </button>
        <button onClick={onClose} style={{ background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.25)', borderRadius:6, padding:'10px 18px', color:'#fff', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
          Close
        </button>
        <span style={{ fontSize:12, color:'rgba(255,255,255,0.45)', marginLeft:6 }}>Print → Save as PDF for best results</span>
      </div>

      <div id="proposal-root" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}
