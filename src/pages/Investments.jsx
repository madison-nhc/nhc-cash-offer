import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { PageWrap, SectionBar, Card, Btn, Badge, EmptyState, LoadingSpinner, StatCard, fmt, fmtK } from '../components/ui.jsx'
import PropertyDrawer from '../components/PropertyDrawer.jsx'

const INV_TABS = [
  { id:'deals', label:'Deals' },
  { id:'flips', label:'Flips' },
  { id:'holds', label:'Holds' },
]

export default function Investments() {
  const [tab, setTab] = useState('deals')
  const [properties, setProperties] = useState([])
  const [income, setIncome] = useState([])
  const [mailings, setMailings] = useState([])
  const [loading, setLoading] = useState(true)
  const [drawer, setDrawer] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data:p }, { data:i }, { data:m }] = await Promise.all([
      supabase.from('cashoffer_properties').select('*').order('updated_at',{ascending:false}),
      supabase.from('cashoffer_property_income').select('*'),
      supabase.from('cashoffer_mailings').select('id,campaign_name,drop_date').order('drop_date',{ascending:false}),
    ])
    setProperties(p||[])
    setIncome(i||[])
    setMailings(m||[])
    setLoading(false)
  }

  // Deals = purchased properties (any type)
  const deals = properties.filter(p=>['purchased','active','sold'].includes(p.status))
  // Flips
  const flips = properties.filter(p=>p.investment_type==='flip')
  // Holds
  const holds = properties.filter(p=>p.investment_type==='hold')

  // Stats
  const totalNHCComm   = deals.reduce((s,p)=>s+(parseFloat(p.commission_earned)||0),0)
  const completedFlips = flips.filter(p=>p.sale_price)
  const totalBPVProfit = completedFlips.reduce((s,p)=>{
    const cost=(parseFloat(p.purchase_price)||0)+(parseFloat(p.closing_costs)||0)+(parseFloat(p.rehab_cost)||0)
    return s+(parseFloat(p.sale_price)||0)-cost
  },0)
  const totalRent = income.reduce((s,i)=>s+(parseFloat(i.rent_received)||0),0)
  const totalExp  = income.reduce((s,i)=>s+(parseFloat(i.expenses)||0),0)

  if (loading) return <LoadingSpinner />

  return (
    <PageWrap>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, color:'#2C2C2C' }}>Investments</h1>
          <p style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>NHC commissions · BPV flips and holds</p>
        </div>
      </div>

      {/* Combined P&L banner */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        <StatCard label="NHC Commission (all)" value={fmtK(totalNHCComm)} sub="closed deals" topColor="#3B6D11" />
        <StatCard label="BPV Flip Profit" value={fmtK(totalBPVProfit)} sub={`${completedFlips.length} completed flips`} topColor={totalBPVProfit>=0?'#3B6D11':'#B91C1C'} />
        <StatCard label="BPV Hold Net" value={fmtK(totalRent-totalExp)} sub="rent minus expenses" topColor={(totalRent-totalExp)>=0?'#3B6D11':'#B91C1C'} />
        <StatCard label="Total BPV Properties" value={flips.length+holds.length} sub={`${flips.length} flips · ${holds.length} holds`} topColor="#2D6FAF" />
      </div>

      {/* Tab switcher */}
      <div style={{ display:'flex', gap:0, borderBottom:'2px solid #F0EDE6', marginBottom:16 }}>
        {INV_TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{ padding:'9px 22px', border:'none', background:'none', cursor:'pointer', fontSize:13, fontWeight:tab===t.id?700:400, fontFamily:'inherit', color:tab===t.id?'#B8892A':'#6b7280', borderBottom:tab===t.id?'2px solid #B8892A':'2px solid transparent', marginBottom:-2 }}>
            {t.label} <span style={{ fontSize:11, opacity:0.6 }}>({t.id==='deals'?deals.length:t.id==='flips'?flips.length:holds.length})</span>
          </button>
        ))}
      </div>

      {/* ── DEALS TAB ── */}
      {tab==='deals' && (
        <>
          <SectionBar>Purchased Properties ({deals.length})</SectionBar>
          {deals.length===0 ? <EmptyState icon="○" text="No purchased properties yet. Mark a property as Purchased in the Analyzer." /> : (
            <Card style={{ padding:0 }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr style={{ background:'#F0EDE6' }}>
                  {['Address','Status','Type','Purchase Price','ARV','NHC Commission','Source Campaign','Purchase Date'].map(h=>(
                    <th key={h} style={{ padding:'8px 14px', textAlign:'left', fontSize:11, fontWeight:600, letterSpacing:0.8, color:'#6b7280', textTransform:'uppercase', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {deals.map((p,i)=>(
                    <tr key={p.id} onClick={()=>setDrawer(p)} style={{ background:i%2===0?'#fff':'#FAFAF8', borderTop:'0.5px solid #F0EDE6', cursor:'pointer' }}
                      onMouseEnter={e=>e.currentTarget.style.background='#fef9f0'}
                      onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'#fff':'#FAFAF8'}>
                      <td style={{ padding:'10px 14px', fontSize:13, fontWeight:600 }}>{p.address}</td>
                      <td style={{ padding:'10px 14px' }}><StatusBadge status={p.status} /></td>
                      <td style={{ padding:'10px 14px' }}>{p.investment_type?<Badge color={p.investment_type==='flip'?'#D97825':'#2D6FAF'}>{p.investment_type}</Badge>:<span style={{ color:'#9ca3af', fontSize:12 }}>—</span>}</td>
                      <td style={{ padding:'10px 14px', fontSize:13, fontFamily:'monospace' }}>{fmt(p.purchase_price)}</td>
                      <td style={{ padding:'10px 14px', fontSize:13, fontFamily:'monospace' }}>{fmt(p.arv)}</td>
                      <td style={{ padding:'10px 14px', fontSize:13, fontFamily:'monospace', fontWeight:700, color:'#3B6D11' }}>{fmt(p.commission_earned)}</td>
                      <td style={{ padding:'10px 14px', fontSize:12, color:'#2D6FAF' }}>{mailings.find(m=>m.id===p.mailing_id)?.campaign_name?.replace(/^Campaign \d+ — /,'')||'—'}</td>
                      <td style={{ padding:'10px 14px', fontSize:12, color:'#6b7280' }}>{p.purchase_date?new Date(p.purchase_date+'T12:00:00').toLocaleDateString():'—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr style={{ borderTop:'2px solid #D6D2CA', background:'#F0EDE6' }}>
                  <td colSpan={5} style={{ padding:'8px 14px', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:0.8 }}>Total Commission</td>
                  <td style={{ padding:'8px 14px', fontSize:14, fontFamily:'monospace', fontWeight:700, color:'#3B6D11' }}>{fmtK(totalNHCComm)}</td>
                  <td colSpan={2}></td>
                </tr></tfoot>
              </table>
            </Card>
          )}
        </>
      )}

      {/* ── FLIPS TAB ── */}
      {tab==='flips' && (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:16 }}>
            <StatCard label="Active Flips" value={flips.filter(p=>!p.sale_price).length} topColor="#D97825" />
            <StatCard label="Completed" value={completedFlips.length} topColor="#3B6D11" />
            <StatCard label="Total BPV Profit" value={fmtK(totalBPVProfit)} sub="all completed" topColor={totalBPVProfit>=0?'#3B6D11':'#B91C1C'} />
          </div>
          <SectionBar>Flip Properties ({flips.length})</SectionBar>
          {flips.length===0 ? <EmptyState icon="⟳" text="No flip properties yet." /> : (
            <Card style={{ padding:0 }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr style={{ background:'#F0EDE6' }}>
                  {['Address','Purchase','Rehab','ARV','Sale Price','BPV Profit','ROI','DOM'].map(h=>(
                    <th key={h} style={{ padding:'8px 14px', textAlign:'left', fontSize:11, fontWeight:600, letterSpacing:0.8, color:'#6b7280', textTransform:'uppercase' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {flips.map((p,i)=>{
                    const cost=(parseFloat(p.purchase_price)||0)+(parseFloat(p.closing_costs)||0)+(parseFloat(p.rehab_cost)||0)
                    const profit=p.sale_price?(parseFloat(p.sale_price)||0)-cost:null
                    const roi=cost>0&&profit!==null?((profit/cost)*100).toFixed(1):null
                    return (
                      <tr key={p.id} onClick={()=>setDrawer(p)} style={{ background:i%2===0?'#fff':'#FAFAF8', borderTop:'0.5px solid #F0EDE6', cursor:'pointer' }}
                        onMouseEnter={e=>e.currentTarget.style.background='#fef9f0'}
                        onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'#fff':'#FAFAF8'}>
                        <td style={{ padding:'10px 14px', fontSize:13, fontWeight:600 }}>{p.address}</td>
                        <td style={{ padding:'10px 14px', fontSize:13, fontFamily:'monospace' }}>{fmt(cost)}</td>
                        <td style={{ padding:'10px 14px', fontSize:13, fontFamily:'monospace' }}>{fmt(p.rehab_cost)}</td>
                        <td style={{ padding:'10px 14px', fontSize:13, fontFamily:'monospace' }}>{fmt(p.arv)}</td>
                        <td style={{ padding:'10px 14px', fontSize:13, fontFamily:'monospace' }}>{fmt(p.sale_price)}</td>
                        <td style={{ padding:'10px 14px', fontSize:13, fontFamily:'monospace', fontWeight:700, color:profit===null?'#9ca3af':profit>=0?'#3B6D11':'#B91C1C' }}>{profit===null?'Active':profit>=0?'+'+fmt(profit):fmt(profit)}</td>
                        <td style={{ padding:'10px 14px', fontSize:13, fontFamily:'monospace', color:'#6b7280' }}>{roi?`${roi}%`:'—'}</td>
                        <td style={{ padding:'10px 14px', fontSize:13, color:'#6b7280' }}>{p.days_on_market||'—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}

      {/* ── HOLDS TAB ── */}
      {tab==='holds' && (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:16 }}>
            <StatCard label="Active Holds" value={holds.filter(p=>p.status==='active').length} topColor="#2D6FAF" />
            <StatCard label="Total Rent" value={fmtK(totalRent)} topColor="#3B6D11" />
            <StatCard label="Net Income" value={fmtK(totalRent-totalExp)} sub="all time" topColor={(totalRent-totalExp)>=0?'#3B6D11':'#B91C1C'} />
          </div>
          <SectionBar>Hold Properties ({holds.length})</SectionBar>
          {holds.length===0 ? <EmptyState icon="⌂" text="No hold properties yet." /> : (
            holds.map((p,i)=>{
              const propIncome = income.filter(inc=>inc.property_id===p.id)
              const propRent   = propIncome.reduce((s,inc)=>s+(parseFloat(inc.rent_received)||0),0)
              const propExp    = propIncome.reduce((s,inc)=>s+(parseFloat(inc.expenses)||0),0)
              const propNet    = propRent-propExp
              const equity     = Math.max(0,(parseFloat(p.arv)||0)-(parseFloat(p.mortgage_amount)||0))
              return (
                <Card key={p.id} style={{ marginTop:10, padding:0, overflow:'hidden' }}>
                  <div onClick={()=>setDrawer(p)} style={{ display:'flex', alignItems:'center', gap:12, padding:'13px 16px', cursor:'pointer' }}
                    onMouseEnter={e=>e.currentTarget.style.background='#fef9f0'}
                    onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:14 }}>{p.address}</div>
                      <div style={{ fontSize:11, color:'#6b7280', marginTop:2 }}>{p.purchase_date?`Purchased ${new Date(p.purchase_date+'T12:00:00').toLocaleDateString()}`:'No purchase date'} · {fmt(p.monthly_payment)}/mo mortgage · {propIncome.length} months recorded</div>
                    </div>
                    <div style={{ textAlign:'right' }}><div style={{ fontSize:13, fontFamily:'monospace', fontWeight:700, color:propNet>=0?'#3B6D11':'#B91C1C' }}>{propNet>=0?'+':''}{fmt(propNet)}</div><div style={{ fontSize:11, color:'#6b7280' }}>net income</div></div>
                    <div style={{ textAlign:'right', marginLeft:12 }}><div style={{ fontSize:13, fontFamily:'monospace', fontWeight:700 }}>{fmt(equity)}</div><div style={{ fontSize:11, color:'#6b7280' }}>equity</div></div>
                    <div style={{ fontSize:18, color:'#D6D2CA' }}>›</div>
                  </div>
                  {propIncome.length>0 && (
                    <div style={{ borderTop:'1px solid #F0EDE6', overflowX:'auto' }}>
                      <table style={{ width:'100%', borderCollapse:'collapse', minWidth:400 }}>
                        <thead><tr style={{ background:'#F0EDE6' }}>
                          {['Month','Rent','Expenses','Net'].map(h=><th key={h} style={{ padding:'5px 14px', textAlign:'left', fontSize:10, fontWeight:600, color:'#9ca3af', textTransform:'uppercase' }}>{h}</th>)}
                        </tr></thead>
                        <tbody>
                          {propIncome.map((inc,j)=>{
                            const net=(parseFloat(inc.rent_received)||0)-(parseFloat(inc.expenses)||0)
                            return (
                              <tr key={inc.id} style={{ background:j%2===0?'#fff':'#FAFAF8', borderTop:'0.5px solid #F0EDE6' }}>
                                <td style={{ padding:'7px 14px', fontSize:13 }}>{inc.income_month?new Date(inc.income_month+'-01').toLocaleDateString('en-US',{month:'short',year:'numeric'}):'—'}</td>
                                <td style={{ padding:'7px 14px', fontSize:13, fontFamily:'monospace', color:'#3B6D11' }}>{fmt(inc.rent_received)}</td>
                                <td style={{ padding:'7px 14px', fontSize:13, fontFamily:'monospace', color:'#B91C1C' }}>{fmt(inc.expenses)}</td>
                                <td style={{ padding:'7px 14px', fontSize:13, fontFamily:'monospace', fontWeight:700, color:net>=0?'#3B6D11':'#B91C1C' }}>{net>=0?'+':''}{fmt(net)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot><tr style={{ borderTop:'2px solid #D6D2CA', background:'#F0EDE6' }}>
                          <td style={{ padding:'7px 14px', fontSize:11, fontWeight:700 }}>TOTAL</td>
                          <td style={{ padding:'7px 14px', fontSize:13, fontFamily:'monospace', fontWeight:700, color:'#3B6D11' }}>{fmt(propRent)}</td>
                          <td style={{ padding:'7px 14px', fontSize:13, fontFamily:'monospace', fontWeight:700, color:'#B91C1C' }}>{fmt(propExp)}</td>
                          <td style={{ padding:'7px 14px', fontSize:13, fontFamily:'monospace', fontWeight:700, color:propNet>=0?'#3B6D11':'#B91C1C' }}>{propNet>=0?'+':''}{fmt(propNet)}</td>
                        </tr></tfoot>
                      </table>
                    </div>
                  )}
                </Card>
              )
            })
          )}
        </>
      )}

      <PropertyDrawer property={drawer} open={!!drawer} onClose={()=>setDrawer(null)} onSave={()=>{ load() }} mailings={mailings} />
    </PageWrap>
  )
}

function StatusBadge({ status }) {
  const colors = { analyzing:'#B8892A', offer_made:'#D97825', under_contract:'#2D6FAF', purchased:'#6b21a8', active:'#3B6D11', sold:'#2C2C2C', passed:'#9ca3af' }
  const labels = { analyzing:'Analyzing', offer_made:'Offer Made', under_contract:'Under Contract', purchased:'Purchased', active:'Active', sold:'Sold', passed:'Passed' }
  const c = colors[status]||'#9ca3af'
  return <span style={{ background:c+'20', color:c, border:`1px solid ${c}40`, borderRadius:4, padding:'2px 7px', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:0.8, whiteSpace:'nowrap' }}>{labels[status]||status}</span>
}
