import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { useIsMobile } from '../hooks/useIsMobile.js'
import MobileCard, { CardRow, CardLabel, CardValue } from '../components/MobileCard.jsx'
import { PageWrap, SectionBar, Card, Btn, Badge, EmptyState, LoadingSpinner, StatCard, fmt, fmtK } from '../components/ui.jsx'
import PropertyDrawer from '../components/PropertyDrawer.jsx'

export default function Purchases() {
  const mobile = useIsMobile()
  const [properties, setProperties] = useState([])
  const [mailings, setMailings] = useState([])
  const [loading, setLoading] = useState(true)
  const [drawer, setDrawer] = useState(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data:p }, { data:m }] = await Promise.all([
      supabase.from('properties').select('*').in('status',['purchased','active','sold','under_contract']).order('purchase_date',{ascending:false}),
      supabase.from('mailings').select('id,campaign_name,drop_date').order('drop_date',{ascending:false}),
    ])
    setProperties(p||[])
    setMailings(m||[])
    setLoading(false)
  }

  const statuses = ['all','under_contract','purchased','active','sold']
  const STATUS_LABELS = { under_contract:'Under Contract', purchased:'Purchased', active:'Active', sold:'Sold' }
  const STATUS_COLORS = { under_contract:'#2D6FAF', purchased:'#6b21a8', active:'#3B6D11', sold:'#2C2C2C' }

  const filtered = filter==='all' ? properties : properties.filter(p=>p.status===filter)

  // Reporting
  const totalComm    = properties.reduce((s,p)=>s+(parseFloat(p.commission_earned)||0),0)
  const totalVolume  = properties.filter(p=>p.sale_price||p.arv).reduce((s,p)=>s+(parseFloat(p.sale_price||p.arv)||0),0)
  const closed       = properties.filter(p=>p.status==='sold').length
  const pipeline     = properties.filter(p=>p.status!=='sold').length

  if (loading) return <LoadingSpinner />

  return (
    <PageWrap pad={!mobile}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, color:'#2C2C2C' }}>Purchases</h1>
          <p style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>NHC commission tracking · all purchased properties</p>
        </div>
      </div>

      {/* Reporting */}
      <div style={{ display:'grid', gridTemplateColumns: mobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        <StatCard label="Total Properties" value={properties.length} topColor="#B8892A" />
        <StatCard label="Pipeline" value={pipeline} sub="not yet sold" topColor="#2D6FAF" />
        <StatCard label="Closed" value={closed} topColor="#3B6D11" />
        <StatCard label="NHC Commission" value={fmtK(totalComm)} sub="all time" topColor="#3B6D11" />
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:4, marginBottom:14 }}>
        {statuses.map(s=>(
          <button key={s} onClick={()=>setFilter(s)} style={{ padding:'5px 14px', border:'none', borderRadius:4, cursor:'pointer', background:filter===s?'#2C2C2C':'#F0EDE6', color:filter===s?'#fff':'#6b7280', fontSize:11, fontWeight:filter===s?700:400, fontFamily:'inherit', textTransform:'capitalize' }}>
            {s==='all'?`All (${properties.length})`:`${STATUS_LABELS[s]||s} (${properties.filter(p=>p.status===s).length})`}
          </button>
        ))}
      </div>

      <SectionBar>Properties ({filtered.length})</SectionBar>

      {filtered.length===0 ? <EmptyState icon="○" text="No purchased properties yet. Mark a property as Purchased in the Analyzer." /> : (
        <Card style={{ padding:0 }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth: mobile ? 0 : 600 }}>
            <thead><tr style={{ background:'#F0EDE6' }}>
              {['Address','Status','Type','Purchase Price','ARV','NHC Commission','Source Campaign','Purchase Date'].map(h=>(
                <th key={h} style={{ padding:'8px 14px', textAlign:'left', fontSize:11, fontWeight:600, letterSpacing:0.8, color:'#6b7280', textTransform:'uppercase', whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map((p,i)=>{
                const src = mailings.find(m=>m.id===p.mailing_id)
                const sc = STATUS_COLORS[p.status]||'#9ca3af'
                return (
                  <tr key={p.id} onClick={()=>setDrawer(p)} style={{ background:i%2===0?'#fff':'#FAFAF8', borderTop:'0.5px solid #F0EDE6', cursor:'pointer' }}
                    onMouseEnter={e=>e.currentTarget.style.background='#fef9f0'}
                    onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'#fff':'#FAFAF8'}>
                    <td style={{ padding:'10px 14px', fontSize:13, fontWeight:600 }}>{p.address}</td>
                    <td style={{ padding:'10px 14px' }}><span style={{ background:sc+'20', color:sc, border:`1px solid ${sc}40`, borderRadius:4, padding:'2px 7px', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:0.8, whiteSpace:'nowrap' }}>{STATUS_LABELS[p.status]||p.status}</span></td>
                    <td style={{ padding:'10px 14px' }}>{p.investment_type?<Badge color={p.investment_type==='flip'?'#D97825':'#2D6FAF'}>{p.investment_type}</Badge>:<span style={{ color:'#9ca3af', fontSize:12 }}>—</span>}</td>
                    <td style={{ padding:'10px 14px', fontSize:13, fontFamily:'monospace' }}>{fmt(p.purchase_price)}</td>
                    <td style={{ padding:'10px 14px', fontSize:13, fontFamily:'monospace' }}>{fmt(p.arv)}</td>
                    <td style={{ padding:'10px 14px', fontSize:13, fontFamily:'monospace', fontWeight:700, color:'#3B6D11' }}>{fmt(p.commission_earned)}</td>
                    <td style={{ padding:'10px 14px', fontSize:12, color:'#2D6FAF' }}>{src?.campaign_name?.replace(/^Campaign \d+ — /,'')||'—'}</td>
                    <td style={{ padding:'10px 14px', fontSize:12, color:'#6b7280' }}>{p.purchase_date?new Date(p.purchase_date+'T12:00:00').toLocaleDateString():'—'}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot><tr style={{ borderTop:'2px solid #D6D2CA', background:'#F0EDE6' }}>
              <td colSpan={5} style={{ padding:'8px 14px', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:0.8 }}>Total Commission</td>
              <td style={{ padding:'8px 14px', fontSize:14, fontFamily:'monospace', fontWeight:700, color:'#3B6D11' }}>{fmtK(totalComm)}</td>
              <td colSpan={2}></td>
            </tr></tfoot>
          </table>
        </Card>
      )}

      <PropertyDrawer property={drawer} open={!!drawer} onClose={()=>setDrawer(null)} onSave={()=>{ load() }} mailings={mailings} />
    </PageWrap>
  )
}
