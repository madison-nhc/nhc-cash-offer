import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { PageWrap, SectionBar, Card, EmptyState, LoadingSpinner, StatCard, fmt, fmtK } from '../components/ui.jsx'
import PropertyDrawer from '../components/PropertyDrawer.jsx'

export default function BPVInvestments() {
  const mobile = useIsMobile()
  const [properties, setProperties] = useState([])
  const [income, setIncome] = useState([])
  const [mailings, setMailings] = useState([])
  const [loading, setLoading] = useState(true)
  const [drawer, setDrawer] = useState(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data:p }, { data:inc }, { data:m }] = await Promise.all([
      supabase.from('properties').select('*').in('disposition',['flip','hold']).order('purchase_date',{ascending:false}),
      supabase.from('property_income').select('*'),
      supabase.from('mailings').select('id,campaign_name,drop_date'),
    ])
    setProperties(p||[])
    setIncome(inc||[])
    setMailings(m||[])
    setLoading(false)
  }

  const flips = properties.filter(p=>p.disposition==='flip')
  const holds = properties.filter(p=>p.disposition==='hold')
  const completedFlips = flips.filter(p=>p.sale_price)

  const totalFlipProfit = completedFlips.reduce((s,p)=>{
    const cost=(parseFloat(p.purchase_price)||0)+(parseFloat(p.closing_costs)||0)+(parseFloat(p.rehab_cost)||0)
    return s+(parseFloat(p.sale_price)||0)-cost
  },0)

  const totalRent = income.reduce((s,i)=>s+(parseFloat(i.rent_received)||0),0)
  const totalExp  = income.reduce((s,i)=>s+(parseFloat(i.expenses)||0),0)
  const holdNet   = totalRent-totalExp
  const totalEquity = holds.reduce((s,p)=>s+Math.max(0,(parseFloat(p.arv)||0)-(parseFloat(p.mortgage_amount)||0)),0)

  const filtered = filter==='all' ? properties : properties.filter(p=>p.disposition===filter)

  if (loading) return <LoadingSpinner />

  return (
    <PageWrap pad={!mobile}>
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:20, fontWeight:700, color:'#2C2C2C' }}>BPV Investments</h1>
        <p style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>BE Property Ventures · flips and holds</p>
      </div>

      <div style={{ display:'grid', gridTemplateColumns: mobile?'repeat(2,1fr)':'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        <StatCard label="Active Flips" value={flips.filter(p=>!p.sale_price).length} topColor="#D97825" />
        <StatCard label="Flip Profit" value={fmtK(totalFlipProfit)} sub={`${completedFlips.length} completed`} topColor={totalFlipProfit>=0?'#3B6D11':'#B91C1C'} />
        <StatCard label="Active Holds" value={holds.length} topColor="#2D6FAF" />
        <StatCard label="Hold Net Income" value={fmtK(holdNet)} sub="rent minus expenses" topColor={holdNet>=0?'#3B6D11':'#B91C1C'} />
      </div>

      <div style={{ display:'flex', gap:4, marginBottom:14 }}>
        {[['all',`All (${properties.length})`],['flip',`Flips (${flips.length})`],['hold',`Holds (${holds.length})`]].map(([f,l])=>(
          <button key={f} onClick={()=>setFilter(f)} style={{ padding:'5px 14px', border:'none', borderRadius:4, cursor:'pointer', background:filter===f?'#2C2C2C':'#F0EDE6', color:filter===f?'#fff':'#6b7280', fontSize:11, fontWeight:filter===f?700:400, fontFamily:'inherit' }}>{l}</button>
        ))}
      </div>

      <SectionBar>Properties ({filtered.length})</SectionBar>

      {filtered.length===0 ? (
        <EmptyState icon="⟳" text="No BPV investments yet. Add a property in the Analyzer and set the disposition to Cash Purchase." />
      ) : (
        <Card style={{ padding:0 }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead><tr style={{ background:'#F0EDE6' }}>
              {['Address','Type','Purchase','Rehab','Total Cost','ARV','Sale / Equity','Profit / Net','Purchase Date'].map(h=>(
                <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:11, fontWeight:600, letterSpacing:0.8, color:'#6b7280', textTransform:'uppercase', whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map((p,i)=>{
                const isFlip = p.disposition==='flip'
                const cost=(parseFloat(p.purchase_price)||0)+(parseFloat(p.closing_costs)||0)+(parseFloat(p.rehab_cost)||0)
                const propIncome = income.filter(inc=>inc.property_id===p.id)
                const propRent = propIncome.reduce((s,inc)=>s+(parseFloat(inc.rent_received)||0),0)
                const propExp  = propIncome.reduce((s,inc)=>s+(parseFloat(inc.expenses)||0),0)
                const propNet  = propRent-propExp
                const equity   = Math.max(0,(parseFloat(p.arv)||0)-(parseFloat(p.mortgage_amount)||0))
                const profit   = isFlip && p.sale_price ? (parseFloat(p.sale_price)||0)-cost : null
                const roi      = isFlip && cost>0 && profit!==null ? ((profit/cost)*100).toFixed(1) : null
                const typeColor = isFlip?'#D97825':'#2D6FAF'

                return (
                  <tr key={p.id} onClick={()=>setDrawer(p)} style={{ background:i%2===0?'#fff':'#FAFAF8', borderTop:'0.5px solid #F0EDE6', cursor:'pointer' }}
                    onMouseEnter={e=>e.currentTarget.style.background='#fef9f0'}
                    onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'#fff':'#FAFAF8'}>
                    <td style={{ padding:'10px 12px', fontSize:13, fontWeight:600 }}>{p.address}</td>
                    <td style={{ padding:'10px 12px' }}>
                      <span style={{ background:typeColor+'20', color:typeColor, border:`1px solid ${typeColor}40`, borderRadius:4, padding:'2px 7px', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:0.8 }}>
                        {isFlip?'Flip':'Hold'}
                      </span>
                    </td>
                    <td style={{ padding:'10px 12px', fontSize:13, fontFamily:'monospace' }}>{fmt(p.purchase_price)}</td>
                    <td style={{ padding:'10px 12px', fontSize:13, fontFamily:'monospace', color:'#6b7280' }}>{fmt(p.rehab_cost)}</td>
                    <td style={{ padding:'10px 12px', fontSize:13, fontFamily:'monospace', fontWeight:600 }}>{fmt(cost)||'—'}</td>
                    <td style={{ padding:'10px 12px', fontSize:13, fontFamily:'monospace' }}>{fmt(p.arv)}</td>
                    <td style={{ padding:'10px 12px', fontSize:13, fontFamily:'monospace' }}>
                      {isFlip ? fmt(p.sale_price) : fmt(equity)}
                    </td>
                    <td style={{ padding:'10px 12px', fontSize:13, fontFamily:'monospace', fontWeight:700 }}>
                      {isFlip
                        ? profit!==null
                          ? <span style={{ color:profit>=0?'#3B6D11':'#B91C1C' }}>{profit>=0?'+':''}{fmt(profit)}{roi?` (${roi}%)`:''}</span>
                          : <span style={{ color:'#9ca3af' }}>Active</span>
                        : <span style={{ color:propNet>=0?'#3B6D11':'#B91C1C' }}>{propNet>=0?'+':''}{fmt(propNet)}</span>
                      }
                    </td>
                    <td style={{ padding:'10px 12px', fontSize:12, color:'#9ca3af', whiteSpace:'nowrap' }}>
                      {p.purchase_date?new Date(p.purchase_date+'T12:00:00').toLocaleDateString():'—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {completedFlips.length>0 && (
              <tfoot><tr style={{ borderTop:'2px solid #D6D2CA', background:'#F0EDE6' }}>
                <td colSpan={7} style={{ padding:'8px 12px', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:0.8 }}>Flip Profit Total</td>
                <td style={{ padding:'8px 12px', fontSize:14, fontFamily:'monospace', fontWeight:700, color:totalFlipProfit>=0?'#3B6D11':'#B91C1C' }}>{totalFlipProfit>=0?'+':''}{fmtK(totalFlipProfit)}</td>
                <td />
              </tr></tfoot>
            )}
          </table>
        </Card>
      )}

      <PropertyDrawer property={drawer} open={!!drawer} onClose={()=>setDrawer(null)} onSave={()=>{ load() }} mailings={mailings} />
    </PageWrap>
  )
}
