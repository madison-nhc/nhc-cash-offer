import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { PageWrap, SectionBar, Card, Badge, EmptyState, LoadingSpinner, fmt, fmtK } from '../components/ui.jsx'
import PropertyDrawer from '../components/PropertyDrawer.jsx'

function GroupLabel({ children }) {
  return <div style={{ fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>{children}</div>
}

function MiniStat({ label, value, sub, color='#2C2C2C' }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
      <div style={{ fontSize:10, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.7 }}>{label}</div>
      <div style={{ fontSize:18, fontWeight:700, fontFamily:'monospace', color }}>{value}</div>
      {sub && <div style={{ fontSize:10, color:'#9ca3af' }}>{sub}</div>}
    </div>
  )
}

function StatGroup({ title, color, filterKey, activeFilter, onFilter, children }) {
  const active = activeFilter === filterKey
  return (
    <div
      onClick={() => onFilter(active ? 'all' : filterKey)}
      style={{
        background:'#fff', border: active ? `1.5px solid ${color}` : '0.5px solid #D6D2CA',
        borderRadius:8, borderTop:`3px solid ${color}`, padding:'12px 16px',
        cursor:'pointer', transition:'box-shadow 0.15s',
        boxShadow: active ? `0 0 0 3px ${color}22` : 'none',
      }}
      onMouseEnter={e=>{ if(!active) e.currentTarget.style.boxShadow=`0 2px 8px rgba(0,0,0,0.08)` }}
      onMouseLeave={e=>{ if(!active) e.currentTarget.style.boxShadow='none' }}
    >
      <GroupLabel>{title}{active ? ' ✓' : ''}</GroupLabel>
      <div style={{ display:'flex', gap:24, flexWrap:'wrap' }}>{children}</div>
    </div>
  )
}

export default function BPVInvestments() {
  const mobile = useIsMobile()
  const [properties, setProperties] = useState([])
  const [income, setIncome] = useState([])
  const [packages, setPackages] = useState([])
  const [mailings, setMailings] = useState([])
  const [loading, setLoading] = useState(true)
  const [drawer, setDrawer] = useState(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data:p }, { data:inc }, { data:m }, { data:pkgs }] = await Promise.all([
      supabase.from('properties').select('*').in('disposition',['flip','hold','wholesale']).order('purchase_date',{ascending:false}),
      supabase.from('property_income').select('*'),
      supabase.from('package_deals').select('id,deal_name'),
      supabase.from('mailings').select('id,campaign_name,drop_date'),
    ])
    setProperties(p||[])
    setIncome(inc||[])
    setMailings(m||[])
    setPackages(pkgs||[])
    setLoading(false)
  }

  const flips      = properties.filter(p=>p.disposition==='flip')
  const holds      = properties.filter(p=>p.disposition==='hold')
  const wholesales = properties.filter(p=>p.disposition==='wholesale')

  const activeFlips    = flips.filter(p=>!p.sale_date)
  const completedFlips = flips.filter(p=>p.sale_date)
  const totalFlipProfit = completedFlips.reduce((s,p)=>{
    const cost=(parseFloat(p.purchase_price)||0)+(parseFloat(p.closing_costs)||0)+(parseFloat(p.rehab_cost)||0)
    return s+(parseFloat(p.sale_price)||0)-cost
  },0)

  // Holds — active = no sale_date, sold = has sale_date
  const activeHolds = holds.filter(p=>!p.sale_date)
  const soldHolds   = holds.filter(p=>p.sale_date)
  const totalRent   = income.reduce((s,i)=>s+(parseFloat(i.rent_received)||0),0)
  const totalExp    = income.reduce((s,i)=>s+(parseFloat(i.expenses)||0),0)
  const holdNet     = totalRent-totalExp
  const totalEquity = activeHolds.reduce((s,p)=>s+Math.max(0,(parseFloat(p.arv)||0)-(parseFloat(p.mortgage_amount)||0)),0)

  const totalWholesaleFee = wholesales.reduce((s,p)=>s+(parseFloat(p.wholesale_fee)||0),0)

  const filtered = filter==='all' ? properties : properties.filter(p=>p.disposition===filter)

  if (loading) return <LoadingSpinner />

  return (
    <PageWrap pad={!mobile}>
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:20, fontWeight:700, color:'#2C2C2C' }}>BPV Investments</h1>
        <p style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>BE Property Ventures · flips, holds and wholesale</p>
      </div>

      {/* Grouped stat cards */}
      <div style={{ display:'grid', gridTemplateColumns:mobile?'1fr':'1fr 1fr 1fr', gap:12, marginBottom:24 }}>
        <StatGroup title="Flips" color="#D97825" filterKey="flip" activeFilter={filter} onFilter={setFilter}>
          <MiniStat label="Active" value={activeFlips.length} color="#D97825" />
          <MiniStat label="Completed" value={completedFlips.length} />
          <MiniStat label="Profit" value={completedFlips.length>0?fmtK(totalFlipProfit):'—'} color={totalFlipProfit>=0?'#3B6D11':'#B91C1C'} />
        </StatGroup>
        <StatGroup title="Holds" color="#B8892A" filterKey="hold" activeFilter={filter} onFilter={setFilter}>
          <MiniStat label="Active" value={activeHolds.length} color="#B8892A" />
          <MiniStat label="Equity" value={totalEquity>0?fmtK(totalEquity):'—'} color="#B8892A" />
          <MiniStat label="Net Income" value={fmtK(holdNet)} color={holdNet>=0?'#3B6D11':'#B91C1C'} sub="rent − expenses" />
          {soldHolds.length>0 && <MiniStat label="Sold" value={soldHolds.length} color="#9ca3af" />}
        </StatGroup>
        <StatGroup title="Wholesale" color="#6b21a8" filterKey="wholesale" activeFilter={filter} onFilter={setFilter}>
          <MiniStat label="Deals" value={wholesales.length} color="#6b21a8" />
          <MiniStat label="Total Fees" value={totalWholesaleFee>0?fmtK(totalWholesaleFee):'—'} color="#6b21a8" />
        </StatGroup>
      </div>

      {/* Filter pills */}
      <div style={{ display:'flex', gap:4, marginBottom:14 }}>
        {[['all',`All (${properties.length})`],['flip',`Flips (${flips.length})`],['hold',`Holds (${holds.length})`],['wholesale',`Wholesale (${wholesales.length})`]].map(([f,l])=>(
          <button key={f} onClick={()=>setFilter(f)} style={{ padding:'5px 14px', border:'none', borderRadius:4, cursor:'pointer', background:filter===f?'#2C2C2C':'#F0EDE6', color:filter===f?'#fff':'#6b7280', fontSize:11, fontWeight:filter===f?700:400, fontFamily:'inherit' }}>{l}</button>
        ))}
      </div>

      <SectionBar>Properties ({filtered.length})</SectionBar>

      {filtered.length===0 ? (
        <EmptyState icon="⟳" text="No BPV investments yet. Add a property in the Analyzer and set the disposition to Cash Purchase or Wholesale." />
      ) : (
        <Card style={{ padding:0 }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead><tr style={{ background:'#F0EDE6' }}>
              {['Address','Type','Purchase','Rehab','Sale / Equity','P&L','Date'].map(h=>(
                <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:11, fontWeight:600, letterSpacing:0.8, color:'#6b7280', textTransform:'uppercase', whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map((p,i)=>{
                const isFlip      = p.disposition==='flip'
                const isHold      = p.disposition==='hold'
                const isWholesale = p.disposition==='wholesale'
                const cost = (parseFloat(p.purchase_price)||0)+(parseFloat(p.closing_costs)||0)+(parseFloat(p.rehab_cost)||0)
                const propIncome = income.filter(inc=>inc.property_id===p.id)
                const propNet    = propIncome.reduce((s,inc)=>(s+(parseFloat(inc.rent_received)||0)-(parseFloat(inc.expenses)||0)),0)
                const equity     = Math.max(0,(parseFloat(p.arv)||0)-(parseFloat(p.mortgage_amount)||0))
                const profit     = (isFlip||isHold) && p.sale_date ? (parseFloat(p.sale_price)||0)-cost : null
                const roi        = (isFlip||isHold) && cost>0 && profit!==null ? ((profit/cost)*100).toFixed(1) : null
                const typeColor  = isFlip?'#D97825':isWholesale?'#6b21a8':'#B8892A'
                const typeLabel  = isFlip?'Flip':isWholesale?'Wholesale':'Hold'

                // Hold sold badge
                const isSoldHold = isHold && p.sale_date

                return (
                  <tr key={p.id} onClick={()=>setDrawer(p)}
                    style={{ background:i%2===0?'#fff':'#FAFAF8', borderTop:'0.5px solid #F0EDE6', cursor:'pointer' }}
                    onMouseEnter={e=>e.currentTarget.style.background='#fef9f0'}
                    onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'#fff':'#FAFAF8'}>
                    <td style={{ padding:'10px 12px', fontSize:13, fontWeight:600 }}>
                      <div>{p.address}</div>
                      {p.package_id && (()=>{ const pkg=packages.find(pk=>pk.id===p.package_id); return pkg?<div style={{ fontSize:10, color:'#6b21a8', marginTop:2 }}>◫ {pkg.deal_name}</div>:null })()}
                    </td>
                    <td style={{ padding:'10px 12px' }}>
                      <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                        <Badge color={typeColor}>{typeLabel}</Badge>
                        {isSoldHold && <Badge color="#9ca3af">Sold</Badge>}
                      </div>
                    </td>
                    <td style={{ padding:'10px 12px', fontSize:13, fontFamily:'monospace' }}>{fmt(p.purchase_price)||'—'}</td>
                    <td style={{ padding:'10px 12px', fontSize:13, fontFamily:'monospace', color:'#6b7280' }}>{fmt(p.rehab_cost)||'—'}</td>
                    <td style={{ padding:'10px 12px', fontSize:13, fontFamily:'monospace' }}>
                      {isWholesale ? '—' : (isFlip||isSoldHold) ? fmt(p.sale_price) : fmt(equity)||'—'}
                    </td>
                    <td style={{ padding:'10px 12px', fontSize:13, fontFamily:'monospace', fontWeight:700 }}>
                      {isWholesale
                        ? <span style={{ color:'#6b21a8' }}>{fmt(p.wholesale_fee)}</span>
                        : profit!==null
                          ? <span style={{ color:profit>=0?'#3B6D11':'#B91C1C' }}>{profit>=0?'+':''}{fmt(profit)}{roi?` (${roi}%)`:''}</span>
                          : isHold
                            ? <span style={{ color:propNet>=0?'#3B6D11':'#B91C1C' }}>{propNet>=0?'+':''}{fmt(propNet)}</span>
                            : <span style={{ color:'#9ca3af', fontSize:11 }}>Active</span>}
                    </td>
                    <td style={{ padding:'10px 12px', fontSize:12, color:'#9ca3af', whiteSpace:'nowrap' }}>
                      {p.purchase_date?new Date(p.purchase_date+'T12:00:00').toLocaleDateString():'—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}

      <PropertyDrawer property={drawer} open={!!drawer} onClose={()=>setDrawer(null)} onSave={()=>load()} mailings={mailings} />
    </PageWrap>
  )
}
