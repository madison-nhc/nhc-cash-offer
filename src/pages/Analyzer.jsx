import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { PageWrap, SectionBar, Card, Btn, Badge, EmptyState, LoadingSpinner, StatCard, fmt, fmtK } from '../components/ui.jsx'
import PropertyDrawer from '../components/PropertyDrawer.jsx'
import ProposalModal from '../components/ProposalModal.jsx'
import PackageDeals from './PackageDeals.jsx'

const STATUS_COLORS = {
  analyzing:'#B8892A', offer_made:'#D97825', under_contract:'#2D6FAF',
  purchased:'#6b21a8', active:'#3B6D11', sold:'#2C2C2C', passed:'#9ca3af'
}
const STATUS_LABELS = {
  analyzing:'Analyzing', offer_made:'Offer Made', under_contract:'Under Contract',
  purchased:'Purchased', active:'Active', sold:'Sold', passed:'Passed'
}

function calcCashOffer(p) {
  const arv = parseFloat(p.arv)||0
  if (!arv) return null
  const reno = (p.repair_items||[]).reduce((s,r)=>s+(parseFloat(r.cost)||0),0)
  const commCash = (parseFloat(p.comm_cash_pct)||9)/100
  const profitPct = (parseFloat(p.profit_margin)||15)/100
  const profit = p.profit_override ? parseFloat(p.profit_override) : arv*profitPct
  const cashHold = (parseFloat(p.hold_cash_pct)||0.75)/100*(parseFloat(p.hold_cash_months)||6)*arv
  return p.cash_offer_override ? parseFloat(p.cash_offer_override) : arv-reno-(commCash*arv)-cashHold-profit
}

export default function Analyzer() {
  const mobile = useIsMobile()
  const [tab, setTab] = useState('properties')
  const [properties, setProperties] = useState([])
  const [mailings, setMailings] = useState([])
  const [loading, setLoading] = useState(true)
  const [drawer, setDrawer] = useState(null)
  const [proposal, setProposal] = useState(null)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data:p }, { data:m }] = await Promise.all([
      supabase.from('properties').select('*').order('updated_at',{ascending:false}),
      supabase.from('mailings').select('id,campaign_name,drop_date').order('drop_date',{ascending:false}),
    ])
    setProperties(p||[])
    setMailings(m||[])
    setLoading(false)
  }

  const EMPTY = { address:'', status:'analyzing', arv:'', asis_pct:50, profit_margin:15, comm_cash_pct:9, comm_list_pct:6, hold_cash_pct:0.75, hold_cash_months:6, hold_opt2_pct:0.5, hold_opt2_months:3, hold_opt3_pct:0.5, hold_opt3_months:6, repair_items:[] }

  const statuses = ['all','analyzing','offer_made','under_contract','purchased','active','sold','passed']
  const filtered = properties.filter(p=>{
    const matchStatus = filter==='all' || p.status===filter
    const matchSearch = !search || p.address?.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  // Stats
  const active = properties.filter(p=>!['sold','passed'].includes(p.status))
  const totalComm = properties.reduce((s,p)=>s+(parseFloat(p.commission_earned)||0),0)
  const totalBPVProfit = properties.filter(p=>p.investment_type==='flip'&&p.sale_price).reduce((s,p)=>{
    const cost=(parseFloat(p.purchase_price)||0)+(parseFloat(p.closing_costs)||0)+(parseFloat(p.rehab_cost)||0)
    return s+(parseFloat(p.sale_price)||0)-cost
  },0)

  if (loading) return <LoadingSpinner />

  return (
    <PageWrap pad={!mobile}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, color:'#2C2C2C' }}>Property Analyzer</h1>
          <p style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>Single properties and package deals</p>
        </div>
        {tab==='properties' && <Btn onClick={()=>setDrawer({...EMPTY})}>+ New Property</Btn>}
      </div>

      {/* Page tabs */}
      <div style={{ display:'flex', gap:2, marginBottom:20 }}>
        {[['properties','Single Properties'],['packages','Package Deals']].map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)} style={{ padding:'8px 20px', border:'none', borderRadius:6, cursor:'pointer', background:tab===t?'#2C2C2C':'#F0EDE6', color:tab===t?'#fff':'#6b7280', fontSize:13, fontWeight:tab===t?700:400, fontFamily:'inherit' }}>{l}</button>
        ))}
      </div>

      {tab==='packages' && <PackageDeals embedded />}

      {tab==='properties' && (<>
        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns: mobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap:12, marginBottom:20 }}>
          <StatCard label="Total Properties" value={properties.length} topColor="#B8892A" />
          <StatCard label="Active Pipeline" value={active.length} topColor="#2D6FAF" />
          <StatCard label="NHC Commission" value={fmtK(totalComm)} sub="all closed" topColor="#3B6D11" />
          <StatCard label="BPV Flip Profit" value={fmtK(totalBPVProfit)} sub="all completed flips" topColor={totalBPVProfit>=0?'#3B6D11':'#B91C1C'} />
        </div>

        {/* Filters */}
        <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search address..." style={{ padding:'6px 12px', border:'1px solid #D6D2CA', borderRadius:6, fontSize:13, fontFamily:'inherit', outline:'none', width:220 }} />
          <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
            {statuses.map(s=>(
              <button key={s} onClick={()=>setFilter(s)} style={{ padding:'5px 12px', border:'none', borderRadius:4, cursor:'pointer', background:filter===s?'#2C2C2C':'#F0EDE6', color:filter===s?'#fff':'#6b7280', fontSize:11, fontWeight:filter===s?700:400, fontFamily:'inherit', textTransform:'capitalize' }}>
                {s==='all'?`All (${properties.length})`:STATUS_LABELS[s]+` (${properties.filter(p=>p.status===s).length})`}
              </button>
            ))}
          </div>
        </div>

        <SectionBar>Properties ({filtered.length})</SectionBar>

        {filtered.length===0 ? <EmptyState icon="○" text="No properties yet. Add your first." /> : (
          <Card style={{ padding:0 }}>
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth: mobile ? 0 : 600 }}>
              <thead>
                <tr style={{ background:'#F0EDE6' }}>
                  {['Address','Status','ARV','Cash Offer','Repairs','NHC Comm','BPV Type','Updated',''].map(h=>(
                    <th key={h} style={{ padding:'8px 14px', textAlign:'left', fontSize:11, fontWeight:600, letterSpacing:0.8, color:'#6b7280', textTransform:'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p,i)=>{
                  const cashOffer = calcCashOffer(p)
                  const reno = (p.repair_items||[]).reduce((s,r)=>s+(parseFloat(r.cost)||0),0)
                  return (
                    <tr key={p.id} onClick={()=>setDrawer(p)} style={{ background:i%2===0?'#fff':'#FAFAF8', borderTop:'0.5px solid #F0EDE6', cursor:'pointer' }}
                      onMouseEnter={e=>e.currentTarget.style.background='#fef9f0'}
                      onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'#fff':'#FAFAF8'}>
                      <td style={{ padding:'10px 14px', fontSize:13, fontWeight:600 }}>
                        <div>{p.address}</div>
                        {(p.beds||p.baths) && <div style={{ fontSize:11, color:'#9ca3af', marginTop:1 }}>{[p.beds&&`${p.beds}bd`,p.baths&&`${p.baths}ba`,p.sqft&&`${parseInt(p.sqft).toLocaleString()}sf`].filter(Boolean).join(' · ')}</div>}
                      </td>
                      <td style={{ padding:'10px 14px' }}>
                        <span style={{ background:(STATUS_COLORS[p.status]||'#9ca3af')+'20', color:STATUS_COLORS[p.status]||'#9ca3af', border:`1px solid ${STATUS_COLORS[p.status]||'#9ca3af'}40`, borderRadius:4, padding:'2px 7px', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:0.8, whiteSpace:'nowrap' }}>
                          {STATUS_LABELS[p.status]||p.status}
                        </span>
                      </td>
                      <td style={{ padding:'10px 14px', fontSize:13, fontFamily:'monospace', fontWeight:700 }}>{fmt(p.arv)}</td>
                      <td style={{ padding:'10px 14px', fontSize:13, fontFamily:'monospace', color:'#3B6D11', fontWeight:600 }}>{cashOffer?fmt(cashOffer):'—'}</td>
                      <td style={{ padding:'10px 14px', fontSize:13, fontFamily:'monospace', color:'#6b7280' }}>{reno>0?fmt(reno):'—'}</td>
                      <td style={{ padding:'10px 14px', fontSize:13, fontFamily:'monospace' }}>{fmt(p.commission_earned)}</td>
                      <td style={{ padding:'10px 14px' }}>
                        {p.investment_type && <Badge color={p.investment_type==='flip'?'#D97825':'#2D6FAF'}>{p.investment_type}</Badge>}
                      </td>
                      <td style={{ padding:'10px 14px', fontSize:11, color:'#9ca3af' }}>{new Date(p.updated_at).toLocaleDateString()}</td>
                      <td style={{ padding:'10px 10px' }} onClick={e=>e.stopPropagation()}>
                        {p.arv && <button onClick={()=>setProposal(p)} style={{ background:'#2D6FAF', color:'#fff', border:'none', borderRadius:4, padding:'4px 10px', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>View Offer</button>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>
        )}
      </>)}

      <PropertyDrawer
        property={drawer}
        open={!!drawer}
        onClose={()=>setDrawer(null)}
        onSave={()=>{ load() }}
        mailings={mailings}
      />
      {proposal && <ProposalModal property={proposal} onClose={()=>setProposal(null)} />}
    </PageWrap>
  )
}
