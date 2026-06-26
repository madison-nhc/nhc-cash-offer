import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { PageWrap, SectionBar, Card, EmptyState, LoadingSpinner, StatCard, fmt, fmtK } from '../components/ui.jsx'
import PropertyDrawer from '../components/PropertyDrawer.jsx'

export default function Holds() {
  const mobile = useIsMobile()
  const [properties, setProperties] = useState([])
  const [income, setIncome] = useState([])
  const [mailings, setMailings] = useState([])
  const [loading, setLoading] = useState(true)
  const [drawer, setDrawer] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data:p }, { data:i }, { data:m }] = await Promise.all([
      supabase.from('properties').select('*').eq('investment_type','hold').order('purchase_date',{ascending:false}),
      supabase.from('property_income').select('*').order('income_month',{ascending:false}),
      supabase.from('mailings').select('id,campaign_name,drop_date'),
    ])
    setProperties(p||[])
    setIncome(i||[])
    setMailings(m||[])
    setLoading(false)
  }

  const totalRent   = income.reduce((s,i)=>s+(parseFloat(i.rent_received)||0),0)
  const totalExp    = income.reduce((s,i)=>s+(parseFloat(i.expenses)||0),0)
  const netIncome   = totalRent - totalExp
  const totalEquity = properties.reduce((s,p)=>s+Math.max(0,(parseFloat(p.arv)||0)-(parseFloat(p.mortgage_amount)||0)),0)
  const totalMortgage = properties.reduce((s,p)=>s+(parseFloat(p.monthly_payment)||0),0)

  if (loading) return <LoadingSpinner />

  return (
    <PageWrap pad={!mobile}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, color:'#2C2C2C' }}>Holds</h1>
          <p style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>BE Property Ventures · rental income and equity tracking</p>
        </div>
      </div>

      {/* Reporting */}
      <div style={{ display:'grid', gridTemplateColumns: mobile ? 'repeat(2,1fr)' : 'repeat(5,1fr)', gap:12, marginBottom:20 }}>
        <StatCard label="Active Holds" value={properties.filter(p=>p.status==='active').length} topColor="#2D6FAF" />
        <StatCard label="Total Rent Collected" value={fmtK(totalRent)} sub="all time" topColor="#3B6D11" />
        <StatCard label="Total Expenses" value={fmtK(totalExp)} sub="all time" topColor="#D97825" />
        <StatCard label="Net Income" value={fmtK(netIncome)} sub="rent minus expenses" topColor={netIncome>=0?'#3B6D11':'#B91C1C'} />
        <StatCard label="Est. Total Equity" value={fmtK(totalEquity)} sub="ARV minus mortgage" topColor="#B8892A" />
      </div>

      <SectionBar>Hold Properties ({properties.length})</SectionBar>

      {properties.length===0 ? <EmptyState icon="⌂" text="No hold properties yet. Add one in the Analyzer and set Investment Type to Hold." /> : (
        properties.map((p,i)=>{
          const propIncome = income.filter(inc=>inc.property_id===p.id)
          const propRent   = propIncome.reduce((s,inc)=>s+(parseFloat(inc.rent_received)||0),0)
          const propExp    = propIncome.reduce((s,inc)=>s+(parseFloat(inc.expenses)||0),0)
          const propNet    = propRent - propExp
          const equity     = Math.max(0,(parseFloat(p.arv)||0)-(parseFloat(p.mortgage_amount)||0))

          return (
            <Card key={p.id} style={{ marginTop:10, padding:0, overflow:'hidden' }}>
              {/* Property header */}
              <div onClick={()=>setDrawer(p)} style={{ display:'flex', alignItems:'center', gap:12, padding:'13px 16px', cursor:'pointer', background:'#fff', transition:'background 0.12s' }}
                onMouseEnter={e=>e.currentTarget.style.background='#fef9f0'}
                onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:14, color:'#2C2C2C' }}>{p.address}</div>
                  <div style={{ fontSize:11, color:'#6b7280', marginTop:2, display:'flex', gap:12 }}>
                    {p.purchase_date && <span>Purchased {new Date(p.purchase_date+'T12:00:00').toLocaleDateString()}</span>}
                    {p.monthly_payment && <span>{fmt(p.monthly_payment)}/mo mortgage</span>}
                    <span>{propIncome.length} months recorded</span>
                  </div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:13, fontFamily:'monospace', fontWeight:700, color:propNet>=0?'#3B6D11':'#B91C1C' }}>{propNet>=0?'+':''}{fmt(propNet)}</div>
                  <div style={{ fontSize:11, color:'#6b7280' }}>net income</div>
                </div>
                <div style={{ textAlign:'right', marginLeft:16 }}>
                  <div style={{ fontSize:13, fontFamily:'monospace', fontWeight:700 }}>{fmt(equity)}</div>
                  <div style={{ fontSize:11, color:'#6b7280' }}>equity</div>
                </div>
                <div style={{ fontSize:18, color:'#D6D2CA', marginLeft:8 }}>›</div>
              </div>

              {/* Income history */}
              {propIncome.length>0 && (
                <div style={{ borderTop:'1px solid #F0EDE6' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', minWidth: mobile ? 0 : 600 }}>
                    <thead><tr style={{ background:'#F0EDE6' }}>
                      {['Month','Rent','Expenses','Net','Notes'].map(h=><th key={h} style={{ padding:'5px 14px', textAlign:'left', fontSize:10, fontWeight:600, color:'#9ca3af', textTransform:'uppercase' }}>{h}</th>)}
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
                            <td style={{ padding:'7px 14px', fontSize:12, color:'#6b7280' }}>{inc.notes||'—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot><tr style={{ borderTop:'2px solid #D6D2CA', background:'#F0EDE6' }}>
                      <td style={{ padding:'7px 14px', fontSize:11, fontWeight:700 }}>TOTAL</td>
                      <td style={{ padding:'7px 14px', fontSize:13, fontFamily:'monospace', fontWeight:700, color:'#3B6D11' }}>{fmt(propRent)}</td>
                      <td style={{ padding:'7px 14px', fontSize:13, fontFamily:'monospace', fontWeight:700, color:'#B91C1C' }}>{fmt(propExp)}</td>
                      <td style={{ padding:'7px 14px', fontSize:13, fontFamily:'monospace', fontWeight:700, color:propNet>=0?'#3B6D11':'#B91C1C' }}>{propNet>=0?'+':''}{fmt(propNet)}</td>
                      <td />
                    </tr></tfoot>
                  </table>
                </div>
              )}
              {propIncome.length===0 && (
                <div style={{ borderTop:'1px solid #F0EDE6', padding:'10px 16px', background:'#FAFAF8', fontSize:12, color:'#9ca3af' }}>
                  No income recorded yet — open the property and add months in the Investment tab.
                </div>
              )}
            </Card>
          )
        })
      )}

      <PropertyDrawer property={drawer} open={!!drawer} onClose={()=>setDrawer(null)} onSave={()=>{ load() }} mailings={mailings} />
    </PageWrap>
  )
}
