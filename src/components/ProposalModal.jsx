import { fmt } from './ui.jsx'

function calcOffers(p) {
  const arv = parseFloat(p.arv)||0
  const reno = (p.repair_items||[]).reduce((s,r)=>s+(parseFloat(r.cost)||0),0)
  const commCash = (parseFloat(p.comm_cash_pct)||9)/100
  const commList = (parseFloat(p.comm_list_pct)||6)/100
  const profitPct = (parseFloat(p.profit_margin)||15)/100
  const profit = p.profit_override ? parseFloat(p.profit_override) : arv*profitPct
  const asisDisc = (parseFloat(p.asis_pct)||50)/100
  const asisVal = p.asis_override ? parseFloat(p.asis_override) : arv-(asisDisc*reno)
  const cashHold = (parseFloat(p.hold_cash_pct)||0.75)/100*(parseFloat(p.hold_cash_months)||6)*arv
  const cashOffer = p.cash_offer_override ? parseFloat(p.cash_offer_override) : arv-reno-(commCash*arv)-cashHold-profit
  const opt2Hold = (parseFloat(p.hold_opt2_pct)||0.5)/100*(parseFloat(p.hold_opt2_months)||3)*arv
  const opt2Net = asisVal-(commList*asisVal)-opt2Hold
  const opt3Hold = (parseFloat(p.hold_opt3_pct)||0.5)/100*(parseFloat(p.hold_opt3_months)||6)*arv
  const opt3Net = arv-reno-(commList*arv)-opt3Hold
  return { arv, reno, cashOffer, asisVal, opt2Net, opt3Net, profit, profitPct, commCash, commList, asisDisc, cashHold, opt2Hold, opt3Hold }
}

// NHC logo — SVG inline so it works without a file server and prints cleanly
function NHCLogo({ height = 48 }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
      {/* Circle icon placeholder — replace src with actual logo once uploaded */}
      <div style={{ width:height, height:height, borderRadius:'50%', background:'#1a1e2e', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        <svg width={height*0.55} height={height*0.55} viewBox="0 0 40 40" fill="none">
          <text x="50%" y="72%" textAnchor="middle" fontSize="22" fontWeight="800" fill="#B8892A" fontFamily="'DM Sans',sans-serif">N</text>
        </svg>
      </div>
      <div>
        <div style={{ fontSize:20, fontWeight:800, color:'#1a1e2e', letterSpacing:1, lineHeight:1.1 }}>NEW HOME COLLECTIVE</div>
        <div style={{ fontSize:11, color:'#888', fontStyle:'italic', marginTop:1 }}>Real Estate Solutions · Fast, Fair, Honest</div>
      </div>
    </div>
  )
}

function ColorStripe() {
  return (
    <div style={{ display:'flex', height:8, borderRadius:2, overflow:'hidden', margin:'10px 0 0' }}>
      <div style={{ background:'#2D6FAF', flex:25 }} />
      <div style={{ background:'#3B6D11', flex:24 }} />
      <div style={{ background:'#B8892A', flex:24 }} />
      <div style={{ background:'#D97825', flex:13 }} />
      <div style={{ background:'#B91C1C', flex:13 }} />
    </div>
  )
}

function PageHeader() {
  return (
    <div style={{ borderBottom:'2px solid #e8edf4', paddingBottom:12, marginBottom:16 }}>
      <NHCLogo />
      <ColorStripe />
    </div>
  )
}

function PageFooter({ page }) {
  return (
    <div style={{ marginTop:24, paddingTop:10, borderTop:'1px solid #e8edf4', display:'flex', justifyContent:'space-between', fontSize:10, color:'#aaa' }}>
      <span>New Home Collective · Confidential</span>
      <span>Page {page} of 3</span>
    </div>
  )
}

const PAGE = {
  background:'#fff',
  fontFamily:"'DM Sans','Helvetica Neue',sans-serif",
  color:'#1a1e2e',
  width:'100%',
  maxWidth:'7.5in',
  margin:'0 auto 24px',
  padding:'0.4in 0.5in',
  boxShadow:'0 2px 16px rgba(0,0,0,0.10)',
  borderRadius:4,
  boxSizing:'border-box',
  pageBreakAfter:'always',
}

const ROW = { display:'flex', justifyContent:'space-between', alignItems:'baseline', padding:'4px 0', borderBottom:'1px solid #f0f3f7', fontSize:12 }
const SECTION_HDR = { fontSize:14, fontWeight:700, color:'#2D6FAF', margin:'18px 0 8px', paddingBottom:4, borderBottom:'2px solid #e8edf4' }
const MONO = { fontFamily:'monospace', fontWeight:700 }

export default function ProposalModal({ property, onClose }) {
  if (!property) return null
  const d = calcOffers(property)
  const repairs = (property.repair_items||[]).filter(r=>r.name||r.cost)
  const addr = property.address || '— Address Not Entered —'
  const sub = [property.beds&&`${property.beds} Bed`, property.baths&&`${property.baths} Bath`, property.sqft&&`${parseInt(property.sqft).toLocaleString()} Sq Ft`].filter(Boolean).join(' · ')

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(15,20,40,0.75)', zIndex:300, overflowY:'auto', WebkitOverflowScrolling:'touch' }}>
      <style>{`
        @media print {
          @page { margin: 0.3in; size: letter; }
          body > * { display: none !important; }
          #proposal-print-root { display: block !important; position: static !important; background: none !important; overflow: visible !important; }
          #proposal-print-root .no-print { display: none !important; }
          #proposal-print-root .proposal-page { box-shadow: none !important; margin: 0 !important; border-radius: 0 !important; page-break-after: always; }
          #proposal-print-root .proposal-page:last-child { page-break-after: avoid; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="no-print" style={{ position:'sticky', top:0, zIndex:10, background:'rgba(15,20,40,0.92)', backdropFilter:'blur(8px)', padding:'12px 24px', display:'flex', gap:10, alignItems:'center' }}>
        <button onClick={()=>window.print()} style={{ background:'#B8892A', border:'none', borderRadius:7, padding:'10px 24px', color:'#fff', fontSize:13, fontWeight:700, letterSpacing:1, cursor:'pointer', fontFamily:'inherit' }}>
          🖨 Print / Save PDF
        </button>
        <button onClick={onClose} style={{ background:'rgba(255,255,255,0.12)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:7, padding:'10px 18px', color:'#fff', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
          Close
        </button>
        <span style={{ fontSize:12, color:'rgba(255,255,255,0.5)', marginLeft:8 }}>Use browser Print → Save as PDF for best results</span>
      </div>

      <div id="proposal-print-root" style={{ padding:'24px 16px 40px' }}>

        {/* ─── PAGE 1: Cover + Repairs ─── */}
        <div className="proposal-page" style={PAGE}>
          <PageHeader />

          {/* Title block */}
          <div style={{ textAlign:'center', margin:'20px 0 24px' }}>
            <div style={{ fontSize:11, fontWeight:700, letterSpacing:3, color:'#B8892A', textTransform:'uppercase', marginBottom:6 }}>Cash Offer Proposal</div>
            <div style={{ fontSize:26, fontWeight:800, color:'#1a1e2e', lineHeight:1.2 }}>{addr}</div>
            {sub && <div style={{ fontSize:13, color:'#888', marginTop:6 }}>{sub}</div>}
          </div>

          {/* Valuation boxes */}
          <div style={SECTION_HDR}>Property Valuation</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
            {[['After Renovation Value (ARV)', d.arv, '#2D6FAF'],['As-Is Market Value', d.asisVal, '#3B6D11']].map(([l,v,c])=>(
              <div key={l} style={{ background:'#f8fafc', border:`1px solid ${c}30`, borderLeft:`4px solid ${c}`, borderRadius:6, padding:'14px 16px' }}>
                <div style={{ fontSize:11, color:'#888', marginBottom:4, fontWeight:600, textTransform:'uppercase', letterSpacing:0.8 }}>{l}</div>
                <div style={{ fontSize:28, fontWeight:800, color:c, fontFamily:'monospace' }}>{fmt(v)}</div>
              </div>
            ))}
          </div>

          {/* Repairs */}
          {repairs.length > 0 && (<>
            <div style={SECTION_HDR}>Renovation Estimate</div>
            <div style={{ fontSize:12, color:'#666', marginBottom:10, fontStyle:'italic' }}>
              Estimated repairs to bring the property to full retail condition:
            </div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr style={{ background:'#1a1e2e' }}>
                  <th style={{ padding:'9px 14px', textAlign:'left', color:'#B8892A', fontWeight:700, letterSpacing:0.5 }}>Repair Item</th>
                  <th style={{ padding:'9px 14px', textAlign:'right', color:'#B8892A', fontWeight:700, letterSpacing:0.5 }}>Estimated Cost</th>
                </tr>
              </thead>
              <tbody>
                {repairs.map((r,i)=>(
                  <tr key={i} style={{ background:i%2===0?'#fff':'#f8fafc' }}>
                    <td style={{ padding:'7px 14px', borderBottom:'1px solid #f0f3f7' }}>{r.name}</td>
                    <td style={{ padding:'7px 14px', borderBottom:'1px solid #f0f3f7', textAlign:'right', fontFamily:'monospace', fontWeight:600 }}>{fmt(parseFloat(r.cost)||0)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background:'#1a1e2e' }}>
                  <td style={{ padding:'9px 14px', color:'#fff', fontWeight:700 }}>Total Estimated Repairs</td>
                  <td style={{ padding:'9px 14px', textAlign:'right', color:'#B8892A', fontFamily:'monospace', fontWeight:800, fontSize:14 }}>{fmt(d.reno)}</td>
                </tr>
              </tfoot>
            </table>
          </>)}

          <PageFooter page={1} />
        </div>

        {/* ─── PAGE 2: Three Options ─── */}
        <div className="proposal-page" style={PAGE}>
          <PageHeader />
          <div style={SECTION_HDR}>Your Three Options</div>
          <p style={{ fontSize:12, color:'#555', lineHeight:1.6, marginBottom:16 }}>
            We've prepared three paths forward. Each one serves a different goal — choose the one that fits your situation best.
          </p>

          {[
            {
              num:'01', color:'#3B6D11', bg:'#f0fdf4',
              title:'Cash Offer', sub:'Fast · As-Is · No Hassle',
              price: fmt(d.cashOffer), priceLabel:'Purchase Price',
              lines:[
                [`ARV`, fmt(d.arv)],
                [`Less Repairs`, `(${fmt(d.reno)})`],
                [`Less Commission (${(d.commCash*100).toFixed(0)}%)`, `(${fmt(d.commCash*d.arv)})`],
                [`Less Holding (${property.hold_cash_months||6} mo)`, `(${fmt(d.cashHold)})`],
                [`Less Profit Margin (${Math.round(d.profitPct*100)}%)`, `(${fmt(d.profit)})`],
              ],
              highlights:['Close in 2–3 weeks','Zero repairs required','No showings or agents','Cash in hand quickly'],
            },
            {
              num:'02', color:'#2D6FAF', bg:'#f0f6ff',
              title:'As-Is Listing', sub:'List on the Market · Current Condition',
              price: fmt(d.asisVal), priceLabel:'List Price',
              lines:[
                [`As-Is Value`, fmt(d.asisVal)],
                [`Less Commission (${(d.commList*100).toFixed(0)}%)`, `(${fmt(d.commList*d.asisVal)})`],
                [`Less Holding (${property.hold_opt2_months||3} mo)`, `(${fmt(d.opt2Hold)})`],
              ],
              net: fmt(d.opt2Net),
              highlights:['2–3 month timeline','No repairs needed','Buyer financing risk','Carrying costs apply'],
            },
            {
              num:'03', color:'#D97825', bg:'#fff8f0',
              title:'Full Retail', sub:'Renovate First · Maximum Price',
              price: fmt(d.arv), priceLabel:'After-Repair Value',
              lines:[
                [`After-Repair Value`, fmt(d.arv)],
                [`Less Repairs`, `(${fmt(d.reno)})`],
                [`Less Commission (${(d.commList*100).toFixed(0)}%)`, `(${fmt(d.commList*d.arv)})`],
                [`Less Holding (${property.hold_opt3_months||6} mo)`, `(${fmt(d.opt3Hold)})`],
              ],
              net: fmt(d.opt3Net),
              highlights:['4–6 month timeline','Full renovation required','Maximum net potential','Higher risk & time'],
            },
          ].map(opt=>(
            <div key={opt.num} style={{ background:opt.bg, border:`1px solid ${opt.color}25`, borderLeft:`5px solid ${opt.color}`, borderRadius:8, marginBottom:14, overflow:'hidden' }}>
              <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', background:`${opt.color}12`, borderBottom:`1px solid ${opt.color}20` }}>
                <div style={{ width:32, height:32, borderRadius:'50%', background:opt.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color:'#fff', flexShrink:0 }}>{opt.num}</div>
                <div>
                  <div style={{ fontSize:15, fontWeight:800, color:opt.color }}>{opt.title}</div>
                  <div style={{ fontSize:11, color:'#666', fontStyle:'italic' }}>{opt.sub}</div>
                </div>
                <div style={{ marginLeft:'auto', textAlign:'right' }}>
                  <div style={{ fontSize:11, color:'#888' }}>{opt.priceLabel}</div>
                  <div style={{ fontSize:22, fontWeight:800, color:opt.color, fontFamily:'monospace' }}>{opt.price}</div>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:0 }}>
                <div style={{ padding:'12px 16px', borderRight:`1px solid ${opt.color}15` }}>
                  {opt.lines.map(([l,v])=>(
                    <div key={l} style={{ ...ROW, borderBottomColor:`${opt.color}15` }}>
                      <span style={{ color:'#666' }}>{l}</span>
                      <span style={{ ...MONO }}>{v}</span>
                    </div>
                  ))}
                  {opt.net && (
                    <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0 0', marginTop:4, borderTop:`2px solid ${opt.color}30` }}>
                      <span style={{ fontSize:13, fontWeight:700 }}>Est. Net to Seller</span>
                      <span style={{ ...MONO, fontSize:15, color:opt.color }}>~{opt.net}</span>
                    </div>
                  )}
                </div>
                <div style={{ padding:'12px 16px' }}>
                  <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:0.8, color:'#888', marginBottom:8 }}>What to Expect</div>
                  <ul style={{ margin:0, paddingLeft:16, fontSize:12, lineHeight:1.9, color:'#444' }}>
                    {opt.highlights.map(h=><li key={h}>{h}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          ))}

          <PageFooter page={2} />
        </div>

        {/* ─── PAGE 3: Side by Side + CTA ─── */}
        <div className="proposal-page" style={{ ...PAGE, pageBreakAfter:'avoid' }}>
          <PageHeader />
          <div style={SECTION_HDR}>Side-by-Side Comparison</div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, marginBottom:24 }}>
            <thead>
              <tr style={{ background:'#1a1e2e' }}>
                {['Option','Net to You','Timeline','Effort','Risk'].map(h=>(
                  <th key={h} style={{ padding:'10px 14px', textAlign:'left', color:'#B8892A', fontWeight:700, letterSpacing:0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label:'Cash Offer', color:'#3B6D11', net:fmt(d.cashOffer), time:'2–3 weeks', effort:'Very Low', risk:'None' },
                { label:'As-Is Listing', color:'#2D6FAF', net:`~${fmt(d.opt2Net)}`, time:'2–3 months', effort:'Low', risk:'Moderate' },
                { label:'Full Retail', color:'#D97825', net:`~${fmt(d.opt3Net)}`, time:'4–6 months', effort:'High', risk:'Higher' },
              ].map((row,i)=>(
                <tr key={row.label} style={{ background:i%2===0?'#fff':'#f8fafc' }}>
                  <td style={{ padding:'10px 14px', fontWeight:700, color:row.color, borderBottom:'1px solid #f0f3f7' }}>{row.label}</td>
                  <td style={{ padding:'10px 14px', fontFamily:'monospace', fontWeight:700, borderBottom:'1px solid #f0f3f7' }}>{row.net}</td>
                  <td style={{ padding:'10px 14px', borderBottom:'1px solid #f0f3f7' }}>{row.time}</td>
                  <td style={{ padding:'10px 14px', borderBottom:'1px solid #f0f3f7' }}>{row.effort}</td>
                  <td style={{ padding:'10px 14px', borderBottom:'1px solid #f0f3f7' }}>{row.risk}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* CTA */}
          <div style={{ background:'linear-gradient(135deg,#1a1e2e 0%,#2D6FAF 100%)', borderRadius:10, padding:'24px 28px', color:'#fff', textAlign:'center' }}>
            <div style={{ fontSize:9, fontWeight:700, letterSpacing:3, color:'#B8892A', textTransform:'uppercase', marginBottom:10 }}>Ready to Move Forward?</div>
            <div style={{ fontSize:20, fontWeight:800, marginBottom:8 }}>Let's find the right option for you.</div>
            <div style={{ fontSize:13, color:'rgba(255,255,255,0.7)', lineHeight:1.6 }}>
              There's no pressure and no obligation. We're here to make selling easy.<br/>
              Reach out anytime — we'll walk you through every step.
            </div>
            <div style={{ marginTop:16, display:'flex', justifyContent:'center', gap:24, fontSize:13, color:'rgba(255,255,255,0.6)' }}>
              <span>🌐 nhcnow.com</span>
              <span>⭐ 1,200+ Five-Star Reviews</span>
            </div>
          </div>

          <PageFooter page={3} />
        </div>

      </div>
    </div>
  )
}
