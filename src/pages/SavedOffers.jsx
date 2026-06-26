import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { PageWrap, SectionBar, Card, Btn, Badge, EmptyState, LoadingSpinner, StatCard, fmt, fmtK } from '../components/ui.jsx'
import Drawer from '../components/Drawer.jsx'

export default function SavedOffers({ onLoadCalc }) {
  const [offers, setOffers] = useState([])
  const [loading, setLoading] = useState(true)
  const [drawer, setDrawer] = useState(null)

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    const { data } = await supabase.from('cash_offers').select('*').order('created_at',{ascending:false})
    setOffers(data||[])
    setLoading(false)
  }

  async function del(id) {
    if (!confirm('Delete this saved offer?')) return
    await supabase.from('cash_offers').delete().eq('id',id)
    setDrawer(null)
    load()
  }

  const totalARV = offers.reduce((s,o)=>s+(parseFloat(o.arv)||0),0)

  function calcOptions(o) {
    const arv = parseFloat(o.arv)||0
    const reno = (o.repair_items||[]).reduce((s,r)=>s+(parseFloat(r.cost)||0),0)
    const commCash = (parseFloat(o.commission_cash_pct)||9)/100
    const commList = (parseFloat(o.commission_list_pct)||6)/100
    const holdCash = ((parseFloat(o.holding_cash_pct)||0.75)/100)*(parseFloat(o.holding_cash_months)||6)*arv
    const holdOpt2 = ((parseFloat(o.holding_opt2_pct)||0.5)/100)*(parseFloat(o.holding_opt2_months)||3)*arv
    const holdOpt3 = ((parseFloat(o.holding_opt3_pct)||0.5)/100)*(parseFloat(o.holding_opt3_months)||6)*arv
    const profit   = o.profit_margin_override ? parseFloat(o.profit_margin_override) : arv*((parseFloat(o.profit_margin)||15)/100)
    const cashOffer= o.cash_offer_override ? parseFloat(o.cash_offer_override) : arv-reno-(commCash*arv)-holdCash-profit
    const asisVal  = o.asis_override ? parseFloat(o.asis_override) : arv-((parseFloat(o.asis_pct)||50)/100)*reno
    const opt2Net  = asisVal-(commList*asisVal)-holdOpt2
    const opt3Net  = arv-reno-(commList*arv)-holdOpt3
    return { arv, reno, cashOffer, opt2Net, opt3Net }
  }

  if (loading) return <LoadingSpinner />

  return (
    <PageWrap>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, color:'#2C2C2C' }}>Saved Proposals</h1>
          <p style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>All saved cash offer calculations</p>
        </div>
        <Btn onClick={()=>onLoadCalc(null)}>+ New Offer</Btn>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
        <StatCard label="Total Saved" value={offers.length} topColor="#B8892A" />
        <StatCard label="Total ARV Analyzed" value={fmtK(totalARV)} topColor="#3B6D11" />
        <StatCard label="Avg ARV" value={offers.length?fmtK(totalARV/offers.length):'—'} topColor="#2D6FAF" />
      </div>

      <SectionBar>All Offers ({offers.length})</SectionBar>

      {offers.length===0
        ? <EmptyState icon="⊞" text="No saved offers yet. Use the Cash Offer Calc tab to generate and save proposals." />
        : (
          <Card style={{ padding:0 }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'#F0EDE6' }}>
                  {['Address','ARV','Cash Offer','As-Is Net','Retail Net','Repairs','Saved'].map(h=>(
                    <th key={h} style={{ padding:'8px 16px', textAlign:'left', fontSize:11, fontWeight:600, letterSpacing:0.8, color:'#6b7280', textTransform:'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {offers.map((o,i) => {
                  const { arv, reno, cashOffer, opt2Net, opt3Net } = calcOptions(o)
                  return (
                    <tr key={o.id} onClick={()=>setDrawer(o)} style={{ background:i%2===0?'#fff':'#FAFAF8', borderTop:'0.5px solid #F0EDE6', cursor:'pointer' }}
                      onMouseEnter={e=>e.currentTarget.style.background='#fef9f0'}
                      onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'#fff':'#FAFAF8'}>
                      <td style={{ padding:'10px 16px', fontSize:13, fontWeight:600, maxWidth:220 }}>
                        <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{o.address||'—'}</div>
                        {(o.beds||o.baths) && <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>{[o.beds&&`${o.beds}bd`,o.baths&&`${o.baths}ba`,o.sqft&&`${parseInt(o.sqft).toLocaleString()} sqft`].filter(Boolean).join(' · ')}</div>}
                      </td>
                      <td style={{ padding:'10px 16px', fontSize:13, fontFamily:'monospace', fontWeight:700 }}>{fmt(arv)}</td>
                      <td style={{ padding:'10px 16px', fontSize:13, fontFamily:'monospace', fontWeight:700, color:'#3B6D11' }}>{fmt(cashOffer)}</td>
                      <td style={{ padding:'10px 16px', fontSize:13, fontFamily:'monospace', color:'#2D6FAF' }}>~{fmt(opt2Net)}</td>
                      <td style={{ padding:'10px 16px', fontSize:13, fontFamily:'monospace', color:'#D97825' }}>~{fmt(opt3Net)}</td>
                      <td style={{ padding:'10px 16px', fontSize:13, fontFamily:'monospace', color:'#6b7280' }}>{reno>0?fmt(reno):'—'}</td>
                      <td style={{ padding:'10px 16px', fontSize:11, color:'#9ca3af' }}>{new Date(o.created_at).toLocaleDateString()}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>
        )
      }

      {/* Detail drawer */}
      {drawer && (() => {
        const { arv, reno, cashOffer, opt2Net, opt3Net } = calcOptions(drawer)
        const repairs = drawer.repair_items||[]
        return (
          <Drawer open={!!drawer} onClose={()=>setDrawer(null)} title={drawer.address||'Saved Offer'} subtitle={`Saved ${new Date(drawer.created_at).toLocaleDateString()}`}>
            <div style={{ paddingTop:12 }}>
              {/* Three options summary */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:16 }}>
                {[['Cash Offer',fmt(cashOffer),'#3B6D11'],['As-Is Net',`~${fmt(opt2Net)}`,'#2D6FAF'],['Full Retail',`~${fmt(opt3Net)}`,'#D97825']].map(([l,v,c])=>(
                  <div key={l} style={{ background:'#FAFAF8', borderRadius:6, padding:'10px 12px', borderTop:`3px solid ${c}` }}>
                    <div style={{ fontSize:10, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.8 }}>{l}</div>
                    <div style={{ fontSize:18, fontWeight:700, fontFamily:'monospace', color:c, marginTop:2 }}>{v}</div>
                  </div>
                ))}
              </div>

              {/* Details */}
              <div className="drawer-section">Property Details</div>
              {[['ARV',fmt(arv)],['Total Repairs',fmt(reno)],['Profit Margin',`${drawer.profit_margin||15}%`],[`Beds / Baths`,`${drawer.beds||'—'} / ${drawer.baths||'—'}`],['Sq Ft',drawer.sqft?parseInt(drawer.sqft).toLocaleString():'—']].map(([l,v])=>(
                <div key={l} className="drawer-row"><span className="drawer-label">{l}</span><span className="drawer-value">{v}</span></div>
              ))}

              {/* Repair items */}
              {repairs.length>0 && <>
                <div className="drawer-section">Repair Breakdown</div>
                {repairs.map((r,i)=>(
                  <div key={i} className="drawer-row"><span style={{ fontSize:13, color:'#6b7280' }}>{r.name}</span><span style={{ fontFamily:'monospace', fontWeight:600 }}>{fmt(r.cost)}</span></div>
                ))}
                <div className="drawer-row" style={{ borderTop:'2px solid #D6D2CA', marginTop:4 }}><span style={{ fontWeight:700 }}>Total</span><span style={{ fontFamily:'monospace', fontWeight:700 }}>{fmt(reno)}</span></div>
              </>}

              <div style={{ display:'flex', gap:8, marginTop:20 }}>
                <Btn onClick={()=>{ setDrawer(null); onLoadCalc(drawer) }} style={{ flex:1 }}>Load into Calculator</Btn>
                <Btn variant="danger" onClick={()=>del(drawer.id)}>Delete</Btn>
              </div>
            </div>
          </Drawer>
        )
      })()}
    </PageWrap>
  )
}
