import { useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { calcOffers as sharedCalcOffers } from '../lib/valuation.js'

// ── Calculations — same shared math as the single-property proposal ────────
function calcOffers(p) {
  const shared = sharedCalcOffers(p, p.repair_items||[])
  return { arv: shared.arv, reno: shared.reno, cashOffer: shared.cashOffer, asisValue: shared.asisVal }
}

function d$(n) { return '$'+Math.round(Math.abs(n)).toLocaleString('en-US') }

function hdr(sub) { return `
  <div class="hdr">
    <div class="hdr-left">
      <img src="/nhc-logo.svg"/>
      <div>
        <div class="brand-name">NEW HOME COLLECTIVE</div>
        <div class="brand-sub">Real Estate Solutions · Fast, Fair, Honest</div>
      </div>
    </div>
    ${sub?`<div class="hdr-addr">${sub}</div>`:''}
  </div>
  <div class="stripe"><span class="s1"></span><span class="s2"></span><span class="s3"></span><span class="s4"></span><span class="s5"></span></div>
`}

// Same page shell/typography as ProposalModal.jsx so a portfolio PDF and a
// single-property PDF look like they came from the same document family.
const CSS = `
  :root{ --blue:#2D6FAF;--green:#3B6D11;--gold:#B8892A;--orange:#D97825;--red:#c0392b; }

  #prop-overlay {
    position:fixed;inset:0;z-index:500;
    background:rgba(0,0,0,0.6);
    display:flex;flex-direction:column;
    font-family:'Helvetica Neue',Arial,sans-serif;
  }
  #prop-toolbar {
    flex-shrink:0;background:#1a1f2e;padding:10px 20px;
    display:flex;align-items:center;gap:10px;border-bottom:2px solid #B8892A;
  }
  #prop-toolbar .btn-print {
    background:#B8892A;border:none;border-radius:5px;padding:9px 22px;
    color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;
  }
  #prop-toolbar .btn-close {
    background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.25);
    border-radius:5px;padding:9px 18px;color:#fff;font-size:13px;cursor:pointer;font-family:inherit;
  }
  #prop-toolbar .tip { font-size:11px;color:rgba(255,255,255,0.4);margin-left:4px; }
  #prop-toolbar .page-info { margin-left:auto;font-size:12px;color:rgba(255,255,255,0.5); }

  #prop-canvas {
    flex:1;overflow-y:auto;overflow-x:auto;background:#525659;
    padding:24px 0 48px;display:flex;flex-direction:column;align-items:center;gap:20px;
  }

  .pg {
    background:#fff;width:816px;height:1056px;flex-shrink:0;position:relative;overflow:hidden;
    box-shadow:0 4px 20px rgba(0,0,0,0.45);padding:38px 48px 38px;box-sizing:border-box;
    color:#111;font-family:'Helvetica Neue',Arial,sans-serif;font-size:12px;line-height:1.4;
  }

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

  .pg-title   { font-size:30px;font-weight:800;color:var(--blue);text-align:center;margin:14px 0 4px;letter-spacing:.4px; }
  .pg-sub     { font-size:12.5px;font-style:italic;color:#555;text-align:center;line-height:1.6;margin-bottom:6px; }

  .sec-title { font-size:16px;font-weight:700;color:var(--blue);margin:14px 0 7px; }

  .val-box { border:1px solid #d0d7e0;border-radius:4px;padding:14px 20px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px; }
  .val-label { font-size:10.5px;color:#888;margin-bottom:2px; }
  .val-num   { font-size:23px;font-weight:800;color:var(--blue);line-height:1.1; }
  .val-num.green { color:var(--green); }

  .port-tbl  { width:100%;border-collapse:collapse;font-size:10.5px; }
  .port-tbl th { background:var(--blue);color:#fff;padding:7px 10px;text-align:left;font-weight:700; }
  .port-tbl th.num, .port-tbl td.num { text-align:right; }
  .port-tbl td { padding:6px 10px;border-bottom:1px solid #eee; }
  .port-tbl tr:nth-child(even) td { background:#f9f9f9; }
  .port-tbl .total td { background:var(--blue);color:#fff;font-weight:700;border:none;padding:8px 10px; }
  .port-tbl .grp td { background:#eef2f7;color:var(--blue);font-weight:700;font-size:9.5px;text-transform:uppercase;letter-spacing:0.4px;padding:5px 10px; }

  .pg-foot { position:absolute;bottom:22px;left:0;right:0;text-align:center;font-size:9.5px;color:#aaa; }

  .intro-text { font-size:11.5px;color:#333;line-height:1.5;margin-bottom:12px; }

  .cta { text-align:center;margin-top:28px;padding-top:20px;border-top:1px solid #ddd; }
  .cta h3 { font-size:17px;font-weight:700;color:var(--blue);margin-bottom:5px; }
  .cta p  { font-size:11.5px;font-style:italic;color:#555; }

  .ftr-box { border:1.5px solid var(--blue);border-radius:4px;padding:11px 16px;display:flex;align-items:center;gap:12px;margin-top:18px; }
  .ftr-box img { width:42px;height:42px;object-fit:contain;flex-shrink:0; }
  .ftr-box .fn { font-size:13px;font-weight:700;color:var(--blue); }
  .ftr-box .fs { font-size:10.5px;color:#888;font-style:italic;margin-top:2px; }
`

function unitTypeLabel(count) {
  const n = parseInt(count) || 1
  if (n <= 1) return 'Single'
  if (n === 2) return 'Duplex'
  if (n === 3) return 'Triplex'
  if (n === 4) return 'Quadplex'
  return 'Custom'
}
const UNIT_TYPE_ORDER = ['Single', 'Duplex', 'Triplex', 'Quadplex', 'Custom']

export default function PortfolioProposalModal({ packageName, properties, onClose }) {
  const included = (properties||[]).filter(p => !p.excluded_from_offer)
  if (included.length === 0) return null

  const rows = included.map(p => ({ p, d: calcOffers(p) }))
  const totalCash = rows.reduce((s,r) => s + (r.d.cashOffer||0), 0)
  const totalArv  = rows.reduce((s,r) => s + (r.d.arv||0), 0)
  const totalReno = rows.reduce((s,r) => s + (r.d.reno||0), 0)

  const groups = UNIT_TYPE_ORDER
    .map(label => ({ label, rows: rows.filter(r => unitTypeLabel(r.p.unit_count) === label) }))
    .filter(g => g.rows.length > 0)

  // Split the property table across as many table-pages as needed — roughly
  // 26 rows fit comfortably per page alongside group headers.
  const ROWS_PER_PAGE = 24
  const flatRows = [] // interleave group header markers with rows for pagination
  groups.forEach(g => {
    flatRows.push({ kind: 'group', label: g.label, count: g.rows.length })
    g.rows.forEach(r => flatRows.push({ kind: 'row', ...r }))
  })
  const tablePages = []
  for (let i = 0; i < flatRows.length; i += ROWS_PER_PAGE) {
    tablePages.push(flatRows.slice(i, i + ROWS_PER_PAGE))
  }

  const tablePageHtml = (chunk, pageNum, totalTablePages) => `
    <div class="pg">
      ${hdr(packageName || '')}
      <div class="sec-title" style="margin-top:12px;">Property Schedule${totalTablePages>1?` (Page ${pageNum} of ${totalTablePages})`:''}</div>
      <table class="port-tbl">
        <thead><tr><th>Address</th><th class="num">Cash Offer</th></tr></thead>
        <tbody>
          ${chunk.map(item => item.kind === 'group'
            ? `<tr class="grp"><td colspan="2">${item.label} (${item.count})</td></tr>`
            : `<tr><td>${(item.p.address||'—').split(',')[0]}${item.p.unit_count>1?` <span style="color:#999;font-weight:400;">(${item.p.unit_count} units)</span>`:''}</td><td class="num" style="font-weight:700;color:var(--green);">${d$(item.d.cashOffer)}</td></tr>`
          ).join('')}
        </tbody>
      </table>
      <div class="pg-foot">New Home Collective · Portfolio Offer</div>
    </div>
  `

  const pages = `
    <!-- ══ COVER PAGE ══ -->
    <div class="pg">
      ${hdr('')}
      <div class="pg-title">PORTFOLIO CASH OFFER</div>
      <div class="pg-sub">${packageName || 'Property Portfolio'}</div>
      <div class="pg-sub">${included.length} propert${included.length===1?'y':'ies'}${properties.length>included.length?` · ${properties.length-included.length} excluded from this offer`:''}</div>

      <div class="sec-title">Combined Valuation</div>
      <div class="val-box">
        <div><div class="val-label">Combined ARV</div><div class="val-num">${d$(totalArv)}</div></div>
        <div><div class="val-label">Est. Total Repairs</div><div class="val-num">${totalReno>0?d$(totalReno):'—'}</div></div>
        <div><div class="val-label">Total Cash Offer</div><div class="val-num green">${d$(totalCash)}</div></div>
      </div>

      <div class="sec-title">Portfolio Summary</div>
      <table class="port-tbl">
        <thead><tr><th>Property Type</th><th class="num">Count</th><th class="num">Combined Cash Offer</th></tr></thead>
        <tbody>
          ${groups.map(g => {
            const gCash = g.rows.reduce((s,r)=>s+(r.d.cashOffer||0),0)
            return `<tr><td>${g.label}</td><td class="num">${g.rows.length}</td><td class="num" style="font-weight:700;color:var(--green);">${d$(gCash)}</td></tr>`
          }).join('')}
        </tbody>
        <tfoot><tr class="total"><td>TOTAL</td><td class="num">${included.length}</td><td class="num">${d$(totalCash)}</td></tr></tfoot>
      </table>

      <div class="pg-foot">New Home Collective · Page 1 of ${2 + tablePages.length}</div>
    </div>

    <!-- ══ PROPERTY SCHEDULE PAGE(S) ══ -->
    ${tablePages.map((chunk, i) => tablePageHtml(chunk, i+1, tablePages.length)).join('')}

    <!-- ══ CLOSING PAGE ══ -->
    <div class="pg">
      ${hdr(packageName || '')}
      <div class="sec-title" style="margin-top:12px;">Terms</div>
      <p class="intro-text">This offer covers the ${included.length} propert${included.length===1?'y':'ies'} listed in the schedule above, purchased together as a single portfolio transaction. Cash offer amounts are as-is, with no repairs required from the seller and no commissions or fees deducted. Closing can occur in as little as 2–3 weeks from acceptance.</p>

      <div class="cta">
        <h3>Ready to move forward? Let's talk.</h3>
        <p>Reach out anytime to accept this offer or ask any questions.</p>
      </div>

      <div class="ftr-box">
        <img src="/nhc-logo.svg" alt="NHC"/>
        <div><div class="fn">NEW HOME COLLECTIVE</div><div class="fs">Real Estate Solutions · Lexington, KY</div></div>
      </div>

      <div class="pg-foot">New Home Collective · Page ${2 + tablePages.length} of ${2 + tablePages.length}</div>
    </div>
  `

  const printFilename = `Portfolio Cash Offer - ${(packageName || 'Portfolio').replace(/[^\w\s-]/g,'').trim()}`
  const canvasRef = useRef(null)
  const [downloading, setDownloading] = useState(false)

  async function handleDownload() {
    if (!canvasRef.current || downloading) return
    setDownloading(true)
    try {
      const pageEls = canvasRef.current.querySelectorAll('.pg')
      const pdf = new jsPDF({ unit:'in', format:'letter', orientation:'portrait' })
      for (let i = 0; i < pageEls.length; i++) {
        const el = pageEls[i]
        const canvas = await html2canvas(el, { scale:2, backgroundColor:'#ffffff', useCORS:true })
        const imgData = canvas.toDataURL('image/jpeg', 0.95)
        if (i > 0) pdf.addPage('letter', 'portrait')
        pdf.addImage(imgData, 'JPEG', 0, 0, 8.5, 11)
      }
      pdf.save(`${printFilename}.pdf`)
    } catch (err) {
      console.error('Portfolio PDF generation failed:', err)
      alert('Something went wrong generating the PDF. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <>
      <style>{CSS}</style>
      <div id="prop-overlay">
        <div id="prop-toolbar">
          <button className="btn-print" onClick={handleDownload} disabled={downloading}>
            {downloading ? 'Generating PDF…' : '⬇ Download Portfolio PDF'}
          </button>
          <button className="btn-close" onClick={onClose}>✕ Close</button>
          <span className="tip">Downloads as a PDF matching this preview exactly</span>
          <span className="page-info">{2 + tablePages.length} pages · {included.length} properties</span>
        </div>
        <div id="prop-canvas" ref={canvasRef} dangerouslySetInnerHTML={{ __html: pages }} />
      </div>
    </>
  )
}
