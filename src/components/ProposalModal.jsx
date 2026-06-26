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
  return { arv, reno, cashOffer, asisVal, opt2Net, opt3Net, profit, profitPct, commCash, commList, asisDisc, cashHold, opt2Hold, opt3Hold, p }
}

export default function ProposalModal({ property, onClose }) {
  if (!property) return null
  const d = calcOffers(property)
  const repairs = (property.repair_items||[]).filter(r=>r.name||r.cost)

  const stripe = { height:14, margin:'5px 0 0', display:'flex' }
  const pg = { background:'#fff', color:'#111', width:'100%', padding: typeof window !== 'undefined' && window.innerWidth < 768 ? '16px' : '0.35in 0.45in', position:'relative', pageBreakAfter:'always', fontFamily:"'DM Sans', sans-serif" }
  const optLine = { display:'flex', justifyContent:'space-between', fontSize:11.5, padding:'3px 0', borderBottom:'1px solid #f0f0f0' }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:300, overflowY:'auto', padding:'20px 0' }}>
      <style>{`@media print { body * { visibility:hidden } #proposal-doc, #proposal-doc * { visibility:visible } #proposal-doc { position:fixed; inset:0; } .no-print { display:none!important } }`}</style>

      {/* Controls */}
      <div className="no-print" style={{ display:'flex', gap:10, justifyContent:'center', marginBottom:16 }}>
        <button onClick={()=>window.print()} style={{ background:'#B8892A', border:'none', borderRadius:8, padding:'11px 28px', color:'#111', fontSize:13, fontWeight:700, letterSpacing:1.5, cursor:'pointer', textTransform:'uppercase', fontFamily:'inherit' }}>
          Print / Save PDF
        </button>
        <button onClick={onClose} style={{ background:'#fff', border:'none', borderRadius:8, padding:'11px 20px', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
          Close
        </button>
      </div>

      <div id="proposal-doc" style={{ maxWidth:'8.5in', margin:'0 auto', padding:'0 8px' }}>

        {/* PAGE 1 — Property & Repairs */}
        <div style={pg}>
          {/* Header */}
          <div style={{ border:'1.5px solid #2D6FAF', borderRadius:6, padding:'12px 20px', display:'flex', alignItems:'center', gap:16, height:78 }}>
            <div style={{ width:48, height:48, borderRadius:'50%', background:'#2C2C2C', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, color:'#B8892A', fontWeight:700, flexShrink:0 }}>N</div>
            <div>
              <div style={{ fontSize:18, fontWeight:700, color:'#2D6FAF' }}>NEW HOME COLLECTIVE</div>
              <div style={{ fontSize:12, color:'#888', fontStyle:'italic' }}>Real Estate Solutions · Fast, Fair, Honest</div>
            </div>
          </div>
          <div style={stripe}><span style={{ background:'#2D6FAF', flex:25 }}/><span style={{ background:'#3B6D11', flex:24 }}/><span style={{ background:'#B8892A', flex:24 }}/><span style={{ background:'#D97825', flex:13 }}/><span style={{ background:'#B91C1C', flex:13 }}/></div>

          <h1 style={{ fontSize:32, fontWeight:800, color:'#2D6FAF', textAlign:'center', margin:'16px 0 6px' }}>CASH OFFER PROPOSAL</h1>
          <div style={{ textAlign:'center', fontSize:17, fontWeight:700, marginBottom:4 }}>{property.address}</div>
          {(property.beds||property.baths) && <div style={{ textAlign:'center', fontSize:12, fontStyle:'italic', color:'#555' }}>{[property.beds&&`${property.beds} Bed`,property.baths&&`${property.baths} Bath`,property.sqft&&`${parseInt(property.sqft).toLocaleString()} Sq Ft`].filter(Boolean).join(' · ')}</div>}

          <div style={{ fontSize:16, fontWeight:700, color:'#2D6FAF', margin:'18px 0 8px' }}>Property Valuation</div>
          <div style={{ border:'1px solid #d0d7e0', borderRadius:4, padding:'12px 22px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            {[['After Renovation Value',d.arv],['As-Is Market Value',d.asisVal]].map(([l,v])=>(
              <div key={l}><div style={{ fontSize:11, color:'#888' }}>{l}</div><div style={{ fontSize:28, fontWeight:800, color:'#2D6FAF' }}>{fmt(v)}</div></div>
            ))}
          </div>

          {repairs.length > 0 && <>
            <div style={{ fontSize:16, fontWeight:700, color:'#2D6FAF', margin:'18px 0 8px' }}>Renovation Breakdown</div>
            <div style={{ fontSize:12, fontStyle:'italic', color:'#555', marginBottom:8 }}>Estimated repairs required to bring the property to retail condition:</div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11.5 }}>
              <thead><tr><th style={{ background:'#2D6FAF', color:'#fff', padding:'8px 14px', textAlign:'left' }}>Item</th><th style={{ background:'#2D6FAF', color:'#fff', padding:'8px 14px', textAlign:'right' }}>Cost</th></tr></thead>
              <tbody>{repairs.map((r,i)=><tr key={i} style={{ background:i%2===0?'#fff':'#f9f9f9' }}><td style={{ padding:'5px 14px', borderBottom:'1px solid #eee' }}>{r.name}</td><td style={{ padding:'5px 14px', borderBottom:'1px solid #eee', textAlign:'right', fontWeight:700 }}>{fmt(parseFloat(r.cost)||0)}</td></tr>)}</tbody>
              <tfoot><tr style={{ background:'#2D6FAF', color:'#fff' }}><td style={{ padding:'9px 14px', fontWeight:700 }}>TOTAL ESTIMATED REPAIRS</td><td style={{ padding:'9px 14px', fontWeight:700, textAlign:'right' }}>{fmt(d.reno)}</td></tr></tfoot>
            </table>
          </>}
          <div style={{ position:'absolute', bottom:'0.25in', right:'0.45in', fontSize:10, color:'#aaa', fontStyle:'italic' }}>New Home Collective · Page 1 of 3</div>
        </div>

        {/* PAGE 2 — Three Options */}
        <div style={{ ...pg, marginTop:20 }}>
          <div style={{ border:'1.5px solid #2D6FAF', borderRadius:6, padding:'12px 20px', display:'flex', alignItems:'center', gap:16, height:78 }}>
            <div style={{ width:48, height:48, borderRadius:'50%', background:'#2C2C2C', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, color:'#B8892A', fontWeight:700, flexShrink:0 }}>N</div>
            <div><div style={{ fontSize:18, fontWeight:700, color:'#2D6FAF' }}>NEW HOME COLLECTIVE</div><div style={{ fontSize:12, color:'#888', fontStyle:'italic' }}>Real Estate Solutions · Fast, Fair, Honest</div></div>
          </div>
          <div style={stripe}><span style={{ background:'#2D6FAF', flex:25 }}/><span style={{ background:'#3B6D11', flex:24 }}/><span style={{ background:'#B8892A', flex:24 }}/><span style={{ background:'#D97825', flex:13 }}/><span style={{ background:'#B91C1C', flex:13 }}/></div>

          <div style={{ fontSize:16, fontWeight:700, color:'#2D6FAF', margin:'14px 0 6px' }}>Three-Option Offer</div>
          <p style={{ fontSize:12, color:'#333', lineHeight:1.45, marginBottom:14 }}>We're offering you three paths forward. Each one fits a different priority — speed, net amount, or maximum upside.</p>

          {[
            { color:'#3B6D11', title:'OPTION 1 — CASH OFFER', sub:'Fast, As-Is, No Hassle', price:fmt(d.cashOffer), label:'Purchase Price',
              items:[[`Commission (${(d.commCash*100).toFixed(1)}%)`,`−${fmt(d.commCash*d.arv)}`],[`Holding (${d.p.hold_cash_months||6} mo)`,`−${fmt(d.cashHold)}`]],
              highlights:['Close in 2–3 weeks','No repairs required','No commissions to you','Quick, clean sale'] },
            { color:'#2D6FAF', title:'OPTION 2 — AS-IS LISTING', sub:'Sell on the Open Market', price:fmt(d.asisVal), label:'Net to Seller',
              items:[[`Commission (${(d.commList*100).toFixed(1)}%)`,`−${fmt(d.commList*d.asisVal)}`],[`Holding (${d.p.hold_opt2_months||3} mo)`,`−${fmt(d.opt2Hold)}`]],
              net:fmt(d.opt2Net), highlights:['2–3 month timeline','Showings & negotiation','Inspection / financing risk','Carrying costs while listed'] },
            { color:'#D97825', title:'OPTION 3 — FULL RETAIL', sub:'Renovate First, Then List', price:fmt(d.arv), label:'Net to Seller',
              items:[['Repairs',`−${fmt(d.reno)}`],[`Commission (${(d.commList*100).toFixed(1)}%)`,`−${fmt(d.commList*d.arv)}`],[`Holding (${d.p.hold_opt3_months||6} mo)`,`−${fmt(d.opt3Hold)}`]],
              net:fmt(d.opt3Net), highlights:['4–6 month timeline','Full renovation required','Project management needed','Market & cost overrun risk'] },
          ].map(opt=>(
            <div key={opt.title} style={{ border:'1px solid #d0d7e0', borderRadius:4, overflow:'hidden', marginBottom:12 }}>
              <div style={{ background:opt.color, color:'#fff', padding:'10px 18px' }}>
                <div style={{ fontSize:13, fontWeight:700 }}>{opt.title}</div>
                <div style={{ fontSize:11.5, fontStyle:'italic', opacity:0.95 }}>{opt.sub}</div>
              </div>
              <div style={{ padding:'12px 18px', display:'flex', gap:24 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:11, color:'#888' }}>{opt.label}</div>
                  <div style={{ fontSize:22, fontWeight:800, color:opt.color }}>{opt.price}</div>
                  {opt.items.map(([l,v])=><div key={l} style={optLine}><span style={{ color:'#555' }}>{l}</span><span style={{ fontWeight:700 }}>{v}</span></div>)}
                  {opt.net && <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, fontWeight:700, marginTop:6, paddingTop:6, borderTop:'1px solid #eee' }}><span>Net to Seller</span><span>~{opt.net}</span></div>}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:0.8, marginBottom:6 }}>Highlights</div>
                  <ul style={{ paddingLeft:16, fontSize:11.5, lineHeight:1.7 }}>{opt.highlights.map(h=><li key={h}>{h}</li>)}</ul>
                </div>
              </div>
            </div>
          ))}
          <div style={{ position:'absolute', bottom:'0.25in', right:'0.45in', fontSize:10, color:'#aaa', fontStyle:'italic' }}>New Home Collective · Page 2 of 3</div>
        </div>

        {/* PAGE 3 — Comparison */}
        <div style={{ ...pg, marginTop:20 }}>
          <div style={{ border:'1.5px solid #2D6FAF', borderRadius:6, padding:'12px 20px', display:'flex', alignItems:'center', gap:16, height:78 }}>
            <div style={{ width:48, height:48, borderRadius:'50%', background:'#2C2C2C', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, color:'#B8892A', fontWeight:700, flexShrink:0 }}>N</div>
            <div><div style={{ fontSize:18, fontWeight:700, color:'#2D6FAF' }}>NEW HOME COLLECTIVE</div><div style={{ fontSize:12, color:'#888', fontStyle:'italic' }}>Real Estate Solutions · Fast, Fair, Honest</div></div>
          </div>
          <div style={stripe}><span style={{ background:'#2D6FAF', flex:25 }}/><span style={{ background:'#3B6D11', flex:24 }}/><span style={{ background:'#B8892A', flex:24 }}/><span style={{ background:'#D97825', flex:13 }}/><span style={{ background:'#B91C1C', flex:13 }}/></div>

          <div style={{ fontSize:16, fontWeight:700, color:'#2D6FAF', margin:'14px 0 8px' }}>Seller Comparison</div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead><tr style={{ background:'#2D6FAF', color:'#fff' }}>{['Option','Net to Seller','Timeline','Effort'].map(h=><th key={h} style={{ padding:'9px 14px', textAlign:'left', fontWeight:700 }}>{h}</th>)}</tr></thead>
            <tbody>
              {[['Cash Offer (Option 1)',fmt(d.cashOffer),'2–3 weeks','Very Low'],['As-Is Listing (Option 2)',`~${fmt(d.opt2Net)}`,'2–3 months','Low'],['Full Retail (Option 3)',`~${fmt(d.opt3Net)}`,'4–6 months','High']].map(([o,n,t,e],i)=>(
                <tr key={o} style={{ background:i%2===0?'#fff':'#f9f9f9' }}>{[o,n,t,e].map((v,j)=><td key={j} style={{ padding:'8px 14px', borderBottom:'1px solid #eee' }}>{v}</td>)}</tr>
              ))}
            </tbody>
          </table>
          <div style={{ border:'1px solid #d0d7e0', borderRadius:6, padding:'20px 24px', marginTop:24, textAlign:'center' }}>
            <h3 style={{ fontSize:16, fontWeight:700, marginBottom:6, color:'#2D6FAF' }}>Ready to move forward? Let's talk.</h3>
            <p style={{ fontSize:12, color:'#555' }}>Reach out anytime to accept this offer or ask any questions.</p>
          </div>
          <div style={{ position:'absolute', bottom:'0.25in', right:'0.45in', fontSize:10, color:'#aaa', fontStyle:'italic' }}>New Home Collective · Page 3 of 3</div>
        </div>

      </div>
    </div>
  )
}
