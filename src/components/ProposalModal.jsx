import { fmt } from './ui.jsx'

// ── Calculations ────────────────────────────────────────────────────────────
function calcOffers(p) {
  const arv         = parseFloat(p.arv)||0
  const reno        = (p.repair_items||[]).reduce((s,r)=>s+(parseFloat(r.cost)||0),0)
  const commCashPct = (parseFloat(p.comm_cash_pct)||9)/100
  const commListPct = (parseFloat(p.comm_list_pct)||6)/100
  const profit      = p.profit_override ? parseFloat(p.profit_override) : arv*((parseFloat(p.profit_margin)||15)/100)
  const asisValue   = p.asis_override   ? parseFloat(p.asis_override)   : arv-((parseFloat(p.asis_pct)||50)/100*reno)
  const holdCashMo  = parseFloat(p.hold_cash_months)||6
  const holdCashPct = (parseFloat(p.hold_cash_pct)||0.75)/100
  const cashOffer   = p.cash_offer_override ? parseFloat(p.cash_offer_override) : arv-reno-(commCashPct*arv)-(holdCashPct*holdCashMo*arv)-profit
  const holdOpt2Mo  = parseFloat(p.hold_opt2_months)||3
  const holdOpt2Pct = (parseFloat(p.hold_opt2_pct)||0.5)/100
  const opt2Comm    = commListPct*asisValue
  const opt2Hold    = holdOpt2Pct*holdOpt2Mo*arv
  const opt2Net     = asisValue-opt2Comm-opt2Hold
  const holdOpt3Mo  = parseFloat(p.hold_opt3_months)||6
  const holdOpt3Pct = (parseFloat(p.hold_opt3_pct)||0.5)/100
  const opt3Comm    = commListPct*arv
  const opt3Hold    = holdOpt3Pct*holdOpt3Mo*arv
  const opt3Net     = arv-reno-opt3Comm-opt3Hold
  return { arv, reno, cashOffer, asisValue, opt2Comm, opt2Hold, opt2Net, opt3Comm, opt3Hold, opt3Net, commListPct, holdOpt2Mo, holdOpt3Mo }
}

function d$(n)  { return '$'+Math.round(Math.abs(n)).toLocaleString('en-US') }
function dn$(n) { return '−$'+Math.round(Math.abs(n)).toLocaleString('en-US') }

// ── Shared header snippet ───────────────────────────────────────────────────
function hdr(addr) { return `
  <div class="hdr">
    <div class="hdr-left">
      <img src="/nhc-logo.svg"/>
      <div>
        <div class="brand-name">NEW HOME COLLECTIVE</div>
        <div class="brand-sub">Real Estate Solutions · Fast, Fair, Honest</div>
      </div>
    </div>
    ${addr?`<div class="hdr-addr">${addr}</div>`:''}
  </div>
  <div class="stripe"><span class="s1"></span><span class="s2"></span><span class="s3"></span><span class="s4"></span><span class="s5"></span></div>
`}

// ── Styles — pixel-based, not inches ────────────────────────────────────────
// PW = page width in px. We'll render at 816px (8.5in @ 96dpi) but
// scale the OVERLAY container up to fill the screen nicely.
const CSS = `
  :root{ --blue:#2D6FAF;--green:#3B6D11;--gold:#B8892A;--orange:#D97825;--red:#c0392b; }

  /* ── OVERLAY SHELL ── */
  #prop-overlay {
    position:fixed;inset:0;z-index:500;
    background:rgba(0,0,0,0.6);
    display:flex;flex-direction:column;
    font-family:'Helvetica Neue',Arial,sans-serif;
  }

  /* top toolbar */
  #prop-toolbar {
    flex-shrink:0;
    background:#1a1f2e;
    padding:10px 20px;
    display:flex;align-items:center;gap:10px;
    border-bottom:2px solid #B8892A;
  }
  #prop-toolbar .btn-print {
    background:#B8892A;border:none;border-radius:5px;
    padding:9px 22px;color:#fff;font-size:13px;font-weight:700;
    cursor:pointer;font-family:inherit;
  }
  #prop-toolbar .btn-close {
    background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.25);
    border-radius:5px;padding:9px 18px;color:#fff;font-size:13px;
    cursor:pointer;font-family:inherit;
  }
  #prop-toolbar .tip { font-size:11px;color:rgba(255,255,255,0.4);margin-left:4px; }
  #prop-toolbar .page-info { margin-left:auto;font-size:12px;color:rgba(255,255,255,0.5); }

  /* scrollable canvas area */
  #prop-canvas {
    flex:1;overflow-y:auto;overflow-x:auto;
    background:#525659;
    padding:24px 0 48px;
    display:flex;flex-direction:column;align-items:center;
    gap:20px;
  }

  /* ── EACH PAGE ── */
  /* Render at 816px wide (8.5in @ 96dpi = true print size).           */
  /* The canvas centres them; user can zoom browser if they want larger. */
  .pg {
    background:#fff;
    width:816px;
    height:1056px;        /* 11in @ 96dpi */
    flex-shrink:0;
    position:relative;
    overflow:hidden;
    box-shadow:0 4px 20px rgba(0,0,0,0.45);
    padding:38px 48px 38px;
    box-sizing:border-box;
    color:#111;
    font-family:'Helvetica Neue',Arial,sans-serif;
    font-size:12px;
    line-height:1.4;
  }

  /* ── HEADER ── */
  .hdr { display:flex;align-items:center;justify-content:space-between;border:1.5px solid var(--blue);border-radius:5px;padding:10px 16px; }
  .hdr-left { display:flex;align-items:center;gap:14px; }
  .hdr img  { width:52px;height:52px;object-fit:contain;flex-shrink:0; }
  .brand-name { font-size:16px;font-weight:700;color:var(--blue);letter-spacing:.3px; }
  .brand-sub  { font-size:10.5px;color:#888;font-style:italic;margin-top:2px; }
  .hdr-addr   { font-size:9.5px;color:#888;font-style:italic;text-align:right;max-width:280px; }

  .stripe { display:flex;height:11px;margin:4px 0 0; }
  .stripe span { display:block;height:100%; }
  .stripe .s1{background:var(--blue);flex:25}
  .stripe .s2{background:var(--green);flex:24}
  .stripe .s3{background:var(--gold);flex:24}
  .stripe .s4{background:var(--orange);flex:13}
  .stripe .s5{background:var(--red);flex:13}

  /* ── PAGE 1 TITLE ── */
  .pg-title   { font-size:32px;font-weight:800;color:var(--blue);text-align:center;margin:14px 0 4px;letter-spacing:.4px; }
  .pg-address { font-size:15px;font-weight:700;text-align:center;margin-bottom:2px; }
  .pg-sub     { font-size:11px;font-style:italic;color:#555;text-align:center;line-height:1.6; }

  /* ── SECTION TITLE ── */
  .sec-title { font-size:16px;font-weight:700;color:var(--blue);margin:14px 0 7px; }

  /* ── VALUATION BOX ── */
  .val-box { border:1px solid #d0d7e0;border-radius:4px;padding:10px 18px;display:grid;grid-template-columns:1fr 1fr;gap:10px; }
  .val-label { font-size:10.5px;color:#888;margin-bottom:2px; }
  .val-num   { font-size:25px;font-weight:800;color:var(--blue);line-height:1.1; }

  /* ── REPAIR TABLE ── */
  .reno-note { font-size:11px;font-style:italic;color:#555;margin-bottom:5px; }
  .reno-tbl  { width:100%;border-collapse:collapse;font-size:11px; }
  .reno-tbl th { background:var(--blue);color:#fff;padding:6px 12px;text-align:left;font-weight:700; }
  .reno-tbl th:last-child { text-align:right; }
  .reno-tbl td { padding:4px 12px;border-bottom:1px solid #eee; }
  .reno-tbl td:last-child { text-align:right;font-weight:600; }
  .reno-tbl tr:nth-child(even) td { background:#f9f9f9; }
  .reno-tbl .total td { background:var(--blue);color:#fff;font-weight:700;border:none;padding:7px 12px; }

  /* ── PAGE FOOTER ── */
  .pg-foot { position:absolute;bottom:22px;left:0;right:0;text-align:center;font-size:9.5px;color:#aaa; }

  /* ── OPTION BOXES ── */
  .intro-text { font-size:11.5px;color:#333;line-height:1.5;margin-bottom:12px; }

  .opt-box { border:1px solid #d0d7e0;border-radius:4px;overflow:hidden;margin-bottom:12px; }
  .opt-hdr { color:#fff;padding:8px 16px; }
  .opt-box.green  .opt-hdr { background:var(--green); }
  .opt-box.blue   .opt-hdr { background:var(--blue); }
  .opt-box.orange .opt-hdr { background:var(--orange); }
  .opt-title { font-size:12.5px;font-weight:700;letter-spacing:.3px; }
  .opt-sub   { font-size:10.5px;font-style:italic;opacity:.95;margin-top:2px; }

  .opt-body  { display:grid;grid-template-columns:1fr 1fr;padding:11px 16px;gap:0; }
  .opt-left  { padding-right:20px;border-right:1px solid #eee; }
  .opt-right { padding-left:20px; }

  .price-lbl { font-size:10.5px;color:#666;margin-bottom:1px; }
  .price-num { font-size:21px;font-weight:800;color:var(--blue);line-height:1.1;margin-bottom:5px; }
  .less-ttl  { font-size:11px;font-weight:700;color:#333;margin-bottom:2px; }
  .less-row  { display:flex;justify-content:space-between;font-size:11px;color:var(--red);margin-bottom:2px; }
  .net-row   { display:flex;justify-content:space-between;font-size:11.5px;font-weight:700;color:var(--blue);margin-top:5px;padding-top:5px;border-top:1px solid #ddd; }

  .bul-ttl { font-size:11px;font-weight:700;color:var(--blue);margin-bottom:5px; }
  .bul-list{ list-style:none;padding:0; }
  .bul-list li { font-size:11px;color:#333;padding-left:11px;position:relative;margin-bottom:3px;line-height:1.4; }
  .bul-list li::before { content:'•';position:absolute;left:0;color:#555; }

  /* ── COMPARISON TABLE ── */
  .cmp-tbl { width:100%;border-collapse:collapse;font-size:12px;margin-top:4px; }
  .cmp-tbl th { background:var(--blue);color:#fff;padding:11px 16px;text-align:left;font-weight:700; }
  .cmp-tbl td { padding:12px 16px;border-bottom:1px solid #eee; }
  .cmp-tbl td:first-child { font-weight:700; }
  .cmp-tbl tr:nth-child(even) td { background:#f9f9f9; }

  /* ── CTA ── */
  .cta { text-align:center;margin-top:32px;padding-top:22px;border-top:1px solid #ddd; }
  .cta h3 { font-size:17px;font-weight:700;color:var(--blue);margin-bottom:5px; }
  .cta p  { font-size:11.5px;font-style:italic;color:#555; }

  /* ── FOOTER BOX ── */
  .ftr-box { border:1.5px solid var(--blue);border-radius:4px;padding:11px 16px;display:flex;align-items:center;gap:12px;margin-top:18px; }
  .ftr-box img { width:42px;height:42px;object-fit:contain;flex-shrink:0; }
  .ftr-box .fn { font-size:13px;font-weight:700;color:var(--blue); }
  .ftr-box .fs { font-size:10.5px;color:#888;font-style:italic;margin-top:2px; }

  /* ── PRINT ── */
  @media print {
    @page { margin:0; size:letter; }
    /* visibility (not display:none) is depth-agnostic: it hides everything
       in the document regardless of how deeply #prop-overlay is nested
       in the page's component tree, without needing to know the exact
       DOM structure of the host page. */
    body * { visibility:hidden; }
    #prop-overlay, #prop-overlay * { visibility:visible; }
    #prop-toolbar { display:none!important; }

    /* The app's layout uses minHeight:100vh / height:100% on several
       ancestors (App's flex wrapper, #root, etc). visibility:hidden keeps
       those elements in the layout flow, so they still reserve a full
       viewport's worth of blank space before our content prints. Since
       ProposalModal can be nested at any depth depending on which page
       it's rendered from, collapse height/min-height universally rather
       than targeting specific ancestor selectors. */
    body * {
      height:auto!important;
      min-height:0!important;
      max-height:none!important;
    }

    /* Force backgrounds/colors to print — browsers strip background-color
       by default in print mode to save ink unless explicitly told not to. */
    * {
      -webkit-print-color-adjust:exact!important;
      print-color-adjust:exact!important;
      color-adjust:exact!important;
    }

    html, body {
      margin:0!important;
      padding:0!important;
      height:auto!important;
      min-height:0!important;
      overflow:visible!important;
    }

    #prop-overlay {
      position:static!important;
      inset:auto!important;
      background:none!important;
      display:block!important;
      margin:0!important;
      padding:0!important;
      height:auto!important;
      min-height:0!important;
      overflow:visible!important;
    }

    #prop-canvas {
      background:none!important;
      padding:0!important;
      margin:0!important;
      gap:0!important;
      overflow:visible!important;
      display:block!important;
      position:static!important;
      height:auto!important;
      min-height:0!important;
      align-items:initial!important;
    }

    .pg {
      box-shadow:none!important;
      page-break-after:always;
      break-after:page;
      margin:0!important;
      width:816px!important;
      height:1056px!important;
      max-height:1056px!important;
      overflow:hidden!important;
      position:relative!important;
      display:block!important;
    }
    .pg:first-child { page-break-before:avoid!important; break-before:avoid!important; }
    .pg:last-child { page-break-after:auto!important; break-after:auto!important; }
  }
`

export default function ProposalModal({ property, onClose }) {
  if (!property) return null
  const d    = calcOffers(property)
  const addr = property.address || '—'
  const repairs = (property.repair_items||[]).filter(r=>r.name&&parseFloat(r.cost)>0)
  const bedsBaths = [property.beds&&`${property.beds} Bed`, property.baths&&`${property.baths} Bath`].filter(Boolean).join(' · ')
  const sqft = property.sqft ? `${parseInt(property.sqft).toLocaleString('en-US')} sq ft` : ''
  const commPct = (d.commListPct*100).toFixed(1).replace(/\.0$/,'')

  const repairRows = repairs.map(r=>`
    <tr><td>${r.name}</td><td>${d$(parseFloat(r.cost))}</td></tr>
  `).join('')

  const pages = `
    <!-- ══ PAGE 1 ══ -->
    <div class="pg">
      ${hdr('')}
      <div class="pg-title">CASH OFFER PROPOSAL</div>
      <div class="pg-address">${addr}</div>
      ${bedsBaths?`<div class="pg-sub">${bedsBaths}</div>`:''}
      ${sqft?`<div class="pg-sub">${sqft}</div>`:''}

      <div class="sec-title">Property Valuation</div>
      <div class="val-box">
        <div><div class="val-label">After Renovation Value</div><div class="val-num">${d$(d.arv)}</div></div>
        <div><div class="val-label">As-Is Market Value</div><div class="val-num">${d$(d.asisValue)}</div></div>
      </div>

      ${repairs.length>0?`
        <div class="sec-title">Renovation Breakdown</div>
        <div class="reno-note">Estimated repairs required to bring the property to retail condition:</div>
        <table class="reno-tbl">
          <thead><tr><th>Item</th><th>Cost</th></tr></thead>
          <tbody>${repairRows}</tbody>
          <tfoot><tr class="total"><td>TOTAL ESTIMATED REPAIRS</td><td>${d$(d.reno)}</td></tr></tfoot>
        </table>
      `:''}

      <div class="pg-foot">New Home Collective · Page 1 of 3</div>
    </div>

    <!-- ══ PAGE 2 ══ -->
    <div class="pg">
      ${hdr(addr)}
      <div class="sec-title" style="margin-top:12px;">Three-Option Offer</div>
      <p class="intro-text">We're offering you three paths forward. Each one fits a different priority — speed, net amount, or maximum upside. Here's how they compare side by side.</p>

      <div class="opt-box green">
        <div class="opt-hdr"><div class="opt-title">OPTION 1 — CASH OFFER</div><div class="opt-sub">Fast, As-Is, No Hassle</div></div>
        <div class="opt-body">
          <div class="opt-left">
            <div class="price-lbl">Purchase Price</div>
            <div class="price-num" style="color:var(--green)">${d$(d.cashOffer)}</div>
            <div class="net-row" style="color:var(--green)"><span>Net to Seller:</span><span>${d$(d.cashOffer)}</span></div>
          </div>
          <div class="opt-right">
            <div class="bul-ttl">Highlights</div>
            <ul class="bul-list">
              <li>Close in 2–3 weeks</li>
              <li>No repairs required</li>
              <li>No commissions, no fees</li>
              <li>Quick, clean sale</li>
            </ul>
          </div>
        </div>
      </div>

      <div class="opt-box blue">
        <div class="opt-hdr"><div class="opt-title">OPTION 2 — AS-IS LISTING</div><div class="opt-sub">Sell on the Open Market</div></div>
        <div class="opt-body">
          <div class="opt-left">
            <div class="price-lbl">List Price</div>
            <div class="price-num">${d$(d.asisValue)}</div>
            <div class="less-ttl">Less Costs:</div>
            <div class="less-row"><span>Commission (${commPct}%):</span><span>${dn$(d.opt2Comm)}</span></div>
            <div class="less-row"><span>Holding (${d.holdOpt2Mo} mo):</span><span>${dn$(d.opt2Hold)}</span></div>
            <div class="net-row"><span>Net to Seller:</span><span>~${d$(d.opt2Net)}</span></div>
          </div>
          <div class="opt-right">
            <div class="bul-ttl">Considerations</div>
            <ul class="bul-list">
              <li>2–3 month timeline</li>
              <li>Showings &amp; negotiation required</li>
              <li>Inspection / financing risk</li>
              <li>Carrying costs while listed</li>
            </ul>
          </div>
        </div>
      </div>

      <div class="opt-box orange">
        <div class="opt-hdr"><div class="opt-title">OPTION 3 — FULL RETAIL (After Renovation)</div><div class="opt-sub">Renovate First, Then List at Top of Market</div></div>
        <div class="opt-body">
          <div class="opt-left">
            <div class="price-lbl">Projected Sale Price</div>
            <div class="price-num">${d$(d.arv)}</div>
            <div class="less-ttl">Less Costs:</div>
            <div class="less-row"><span>Repairs:</span><span>${dn$(d.reno)}</span></div>
            <div class="less-row"><span>Commission (${commPct}%):</span><span>${dn$(d.opt3Comm)}</span></div>
            <div class="less-row"><span>Holding (${d.holdOpt3Mo} mo):</span><span>${dn$(d.opt3Hold)}</span></div>
            <div class="net-row"><span>Net to Seller:</span><span>~${d$(d.opt3Net)}</span></div>
          </div>
          <div class="opt-right">
            <div class="bul-ttl">Considerations</div>
            <ul class="bul-list">
              <li>4–6 month timeline</li>
              <li>Full renovation required</li>
              <li>Project management &amp; coordination</li>
              <li>Market &amp; cost overrun risk</li>
            </ul>
          </div>
        </div>
      </div>

      <div class="pg-foot">New Home Collective · Page 2 of 3</div>
    </div>

    <!-- ══ PAGE 3 ══ -->
    <div class="pg">
      ${hdr(addr)}
      <div class="sec-title" style="margin-top:12px;">Seller Comparison</div>
      <p class="intro-text"><em>At a glance — what each option puts in your pocket and what it asks of you.</em></p>

      <table class="cmp-tbl">
        <thead><tr><th>Option</th><th>Net to Seller</th><th>Timeline</th><th>Effort</th></tr></thead>
        <tbody>
          <tr><td>Cash Offer (Option 1)</td><td>${d$(d.cashOffer)}</td><td>2–3 weeks</td><td>Very Low</td></tr>
          <tr><td>As-Is Listing (Option 2)</td><td>~${d$(d.opt2Net)}</td><td>2–3 months</td><td>Low</td></tr>
          <tr><td>Full Retail (Option 3)</td><td>~${d$(d.opt3Net)}</td><td>4–6 months</td><td>High</td></tr>
        </tbody>
      </table>

      <div class="cta">
        <h3>Ready to move forward? Let's talk.</h3>
        <p>Reach out anytime to accept this offer or ask any questions.</p>
      </div>

      <div class="ftr-box">
        <img src="/nhc-logo.svg" alt="NHC"/>
        <div><div class="fn">NEW HOME COLLECTIVE</div><div class="fs">Real Estate Solutions · Lexington, KY</div></div>
      </div>

      <div class="pg-foot">New Home Collective · Page 3 of 3</div>
    </div>
  `

  const printFilename = `Cash Offer - ${addr.split(',')[0].trim() || 'Property'}`

  function handlePrint() {
    const originalTitle = document.title
    document.title = printFilename
    const restore = () => {
      document.title = originalTitle
      window.removeEventListener('afterprint', restore)
    }
    window.addEventListener('afterprint', restore)
    window.print()
  }

  return (
    <>
      <style>{CSS}</style>
      <div id="prop-overlay">
        <div id="prop-toolbar">
          <button className="btn-print" onClick={handlePrint}>⬇ Print / Save PDF</button>
          <button className="btn-close" onClick={onClose}>✕ Close</button>
          <span className="tip">File → Print → Save as PDF · Margins: None · Paper: Letter</span>
          <span className="page-info">3 pages</span>
        </div>
        <div id="prop-canvas" dangerouslySetInnerHTML={{ __html: pages }} />
      </div>
    </>
  )
}

