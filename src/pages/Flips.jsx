import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { PageWrap, SectionBar, Card, Btn, Badge, EmptyState, LoadingSpinner, StatCard, fmt, fmtK } from '../components/ui.jsx'
import PropertyDrawer from '../components/PropertyDrawer.jsx'

export default function Flips() {
  const [properties, setProperties] = useState([])
  const [mailings, setMailings] = useState([])
  const [loading, setLoading] = useState(true)
  const [drawer, setDrawer] = useState(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data:p }, { data:m }] = await Promise.all([
      supabase.from('properties').select('*').eq('investment_type','flip').order('purchase_date',{ascending:false}),
      supabase.from('mailings').select('id,campaign_name,drop_date'),
    ])
    setProperties(p||[])
    setMailings(m||[])
    setLoading(false)
  }

  const completed = properties.filter(p=>p.sale_price)
  const active    = properties.filter(p=>!p.sale_price)

  const totalProfit = completed.reduce((s,p)=>{
    const cost=(parseFloat(p.purchase_price)||0)+(parseFloat(p.closing_costs)||0)+(parseFloat(p.rehab_cost)||0)
    return s+(parseFloat(p.sale_price)||0)-cost
  },0)
  const avgProfit = completed.length>0 ? totalProfit/completed.length : 0
  const avgDOM    = completed.filter(p=>p.days_on_market).reduce((s,p,_,a)=>s+p.days_on_market/a.length,0)
  const totalInvested = properties.reduce((s,p)=>(parseFloat(p.purchase_price)||0)+(parseFloat(p.closing_costs)||0)+(parseFloat(p.rehab_cost)||0)+s,0)

  const filtered = filter==='all'?properties:filter==='active'?active:completed

  if (loading) return <LoadingSpinner />

  return (
    <PageWrap>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, color:'#2C2C2C' }}>Flips</h1>
          <p style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>BE Property Ventures · buy, rehab, sell</p>
        </div>
      </div>

      {/* Reporting */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12, marginBottom:20 }}>
        <StatCard label="Active Flips" value={active.length} topColor="#D97825" />
        <StatCard label="Completed" value={completed.length} topColor="#3B6D11" />
        <StatCard label="Total BPV Profit" value={fmtK(totalProfit)} sub="all completed" topColor={totalProfit>=0?'#3B6D11':'#B91C1C'} />
        <StatCard label="Avg Profit / Flip" value={fmtK(avgProfit)} sub={avgDOM?`avg ${Math.round(avgDOM)} DOM`:''} topColor="#B8892A" />
        <StatCard label="Total Invested" value={fmtK(totalInvested)} sub="purchase + rehab + closing" topColor="#2D6FAF" />
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:4, marginBottom:14 }}>
        {[['all',`All (${properties.length})`],['active',`Active (${active.length})`],['completed',`Completed (${completed.length})`]].map(([f,l])=>(
          <button key={f} onClick={()=>setFilter(f)} style={{ padding:'5px 14px', border:'none', borderRadius:4, cursor:'pointer', background:filter===f?'#2C2C2C':'#F0EDE6', color:filter===f?'#fff':'#6b7280', fontSize:11, fontWeight:filter===f?700:400, fontFamily:'inherit' }}>{l}</button>
        ))}
      </div>

      <SectionBar>Flip Properties ({filtered.length})</SectionBar>

      {filtered.length===0 ? <EmptyState icon="⟳" text="No flip properties yet. Add one in the Analyzer and set Investment Type to Flip." /> : (
        <Card style={{ padding:0 }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead><tr style={{ background:'#F0EDE6' }}>
              {['Address','Purchase','Closing','Rehab','Total Cost','ARV','Sale Price','BPV Profit','ROI','DOM','Purchase Date'].map(h=>(
                <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:11, fontWeight:600, letterSpacing:0.8, color:'#6b7280', textTransform:'uppercase', whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map((p,i)=>{
                const cost=(parseFloat(p.purchase_price)||0)+(parseFloat(p.closing_costs)||0)+(parseFloat(p.rehab_cost)||0)
                const profit=p.sale_price?(parseFloat(p.sale_price)||0)-cost:null
                const roi=cost>0&&profit!==null?((profit/cost)*100).toFixed(1):null
                return (
                  <tr key={p.id} onClick={()=>setDrawer(p)} style={{ background:i%2===0?'#fff':'#FAFAF8', borderTop:'0.5px solid #F0EDE6', cursor:'pointer' }}
                    onMouseEnter={e=>e.currentTarget.style.background='#fef9f0'}
                    onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'#fff':'#FAFAF8'}>
                    <td style={{ padding:'10px 12px', fontSize:13, fontWeight:600 }}>{p.address}</td>
                    <td style={{ padding:'10px 12px', fontSize:13, fontFamily:'monospace' }}>{fmt(p.purchase_price)}</td>
                    <td style={{ padding:'10px 12px', fontSize:13, fontFamily:'monospace', color:'#6b7280' }}>{fmt(p.closing_costs)}</td>
                    <td style={{ padding:'10px 12px', fontSize:13, fontFamily:'monospace' }}>{fmt(p.rehab_cost)}</td>
                    <td style={{ padding:'10px 12px', fontSize:13, fontFamily:'monospace', fontWeight:600 }}>{fmt(cost)}</td>
                    <td style={{ padding:'10px 12px', fontSize:13, fontFamily:'monospace' }}>{fmt(p.arv)}</td>
                    <td style={{ padding:'10px 12px', fontSize:13, fontFamily:'monospace' }}>{fmt(p.sale_price)}</td>
                    <td style={{ padding:'10px 12px', fontSize:13, fontFamily:'monospace', fontWeight:700, color:profit===null?'#9ca3af':profit>=0?'#3B6D11':'#B91C1C' }}>{profit===null?'—':profit>=0?'+'+fmt(profit):fmt(profit)}</td>
                    <td style={{ padding:'10px 12px', fontSize:13, fontFamily:'monospace', color:'#6b7280' }}>{roi?`${roi}%`:'—'}</td>
                    <td style={{ padding:'10px 12px', fontSize:13, color:'#6b7280' }}>{p.days_on_market||'—'}</td>
                    <td style={{ padding:'10px 12px', fontSize:12, color:'#9ca3af', whiteSpace:'nowrap' }}>{p.purchase_date?new Date(p.purchase_date+'T12:00:00').toLocaleDateString():'—'}</td>
                  </tr>
                )
              })}
            </tbody>
            {completed.length>0 && (
              <tfoot><tr style={{ borderTop:'2px solid #D6D2CA', background:'#F0EDE6' }}>
                <td style={{ padding:'8px 12px', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:0.8 }}>Totals</td>
                <td colSpan={3} />
                <td style={{ padding:'8px 12px', fontSize:13, fontFamily:'monospace', fontWeight:700 }}>{fmtK(totalInvested)}</td>
                <td colSpan={1} />
                <td colSpan={1} />
                <td style={{ padding:'8px 12px', fontSize:13, fontFamily:'monospace', fontWeight:700, color:totalProfit>=0?'#3B6D11':'#B91C1C' }}>{totalProfit>=0?'+':''}{fmtK(totalProfit)}</td>
                <td colSpan={3} />
              </tr></tfoot>
            )}
          </table>
        </Card>
      )}

      <PropertyDrawer property={drawer} open={!!drawer} onClose={()=>setDrawer(null)} onSave={()=>{ load() }} mailings={mailings} />
    </PageWrap>
  )
}
