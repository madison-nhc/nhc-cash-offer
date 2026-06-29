import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { PageWrap, SectionBar, Card, Btn, Badge, EmptyState, LoadingSpinner, fmt } from '../components/ui.jsx'
import PropertyDrawer from '../components/PropertyDrawer.jsx'
import ProposalModal from '../components/ProposalModal.jsx'
import PackageDeals from './PackageDeals.jsx'
import MobileCard, { CardRow, CardLabel, CardValue } from '../components/MobileCard.jsx'

const DISP_COLOR = { listing:'#3B6D11', wholesale:'#6b21a8', flip:'#D97825', hold:'#B8892A', lost:'#9ca3af' }
const DISP_LABEL = { listing:'Listing', wholesale:'Wholesale', flip:'Flip', hold:'Hold', lost:'Lost' }

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

// Active = no disposition, OR listing with no close date, OR flip/hold with no sale_date
function isActive(p) {
  if (!p.disposition || p.disposition === null) return true
  if (p.disposition === 'listing' && !p.disposition_date) return true
  if ((p.disposition === 'flip' || p.disposition === 'hold') && !p.sale_date) return true
  return false
}

export default function Analyzer() {
  const [tab, setTab] = useState('properties')
  const [properties, setProperties] = useState([])
  const [mailings, setMailings] = useState([])
  const [loading, setLoading] = useState(true)
  const [drawer, setDrawer] = useState(null)
  const [proposal, setProposal] = useState(null)
  const [filter, setFilter] = useState('active')
  const [search, setSearch] = useState('')
  const mobile = useIsMobile()

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data:p }, { data:m }] = await Promise.all([
      supabase.from('properties').select('*').is('package_id',null).order('updated_at',{ascending:false}),
      supabase.from('mailings').select('id,campaign_name,drop_date').order('drop_date',{ascending:false}),
    ])
    setProperties(p||[])
    setMailings(m||[])
    setLoading(false)
  }

  const EMPTY = { address:'', status:'analyzing', arv:'', asis_pct:50, profit_margin:15, comm_cash_pct:9, comm_list_pct:6, hold_cash_pct:0.75, hold_cash_months:6, hold_opt2_pct:0.5, hold_opt2_months:3, hold_opt3_pct:0.5, hold_opt3_months:6, repair_items:[] }

  const activeProps = properties.filter(p => isActive(p))
  const pastProps   = properties.filter(p => !isActive(p))

  const filtered = properties.filter(p => {
    const matchFilter = filter === 'active' ? isActive(p) : !isActive(p)
    const matchSearch = !search || p.address?.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  if (loading) return <LoadingSpinner />

  return (
    <PageWrap>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <div>
          <h1 style={{ fontSize:mobile?18:20, fontWeight:700, color:'#2C2C2C' }}>Property Analyzer</h1>
          <p style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>Single properties and package deals</p>
        </div>
        {tab==='properties' && <Btn onClick={()=>setDrawer({...EMPTY})} style={{ fontSize:12, padding:'7px 14px' }}>+ New</Btn>}
      </div>

      {/* Page tabs */}
      <div style={{ display:'flex', gap:2, marginBottom:16 }}>
        {[['properties','Single Properties'],['packages','Package Deals']].map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)} style={{ padding:'7px 16px', border:'none', borderRadius:6, cursor:'pointer', background:tab===t?'#2C2C2C':'#F0EDE6', color:tab===t?'#fff':'#6b7280', fontSize:12, fontWeight:tab===t?700:400, fontFamily:'inherit' }}>{l}</button>
        ))}
      </div>

      {tab==='packages' && <PackageDeals embedded />}

      {tab==='properties' && (<>
        {/* Filters */}
        <div style={{ display:'flex', gap:8, marginBottom:14, alignItems:'center', flexWrap:'wrap' }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search address..." style={{ padding:'6px 12px', border:'1px solid #D6D2CA', borderRadius:6, fontSize:13, fontFamily:'inherit', outline:'none', flex:1, minWidth:140 }} />
          <div style={{ display:'flex', gap:4 }}>
            {[['active',`Active (${activeProps.length})`],['past',`Past (${pastProps.length})`]].map(([f,l])=>(
              <button key={f} onClick={()=>setFilter(f)} style={{ padding:'6px 16px', border:'none', borderRadius:6, cursor:'pointer', background:filter===f?'#2C2C2C':'#F0EDE6', color:filter===f?'#fff':'#6b7280', fontSize:12, fontWeight:filter===f?700:400, fontFamily:'inherit', whiteSpace:'nowrap' }}>{l}</button>
            ))}
          </div>
        </div>

        <SectionBar>Properties ({filtered.length})</SectionBar>

        {filtered.length===0 ? <EmptyState icon="○" text="No properties here yet." /> : mobile ? (
          <div style={{ marginTop:8 }}>
            {filtered.map(p=>{
              const cashOffer = calcCashOffer(p)
              return (
                <MobileCard key={p.id} onClick={()=>setDrawer(p)} accent={p.disposition?DISP_COLOR[p.disposition]:'#B8892A'}>
                  <CardRow>
                    <span style={{ fontSize:14, fontWeight:700, color:'#2C2C2C', flex:1, marginRight:8 }}>{p.address}</span>
                    {p.disposition
                      ? <Badge color={DISP_COLOR[p.disposition]}>{DISP_LABEL[p.disposition]}</Badge>
                      : <span style={{ fontSize:10, color:'#B8892A', fontWeight:600 }}>Analyzing</span>}
                  </CardRow>
                  <CardRow style={{ marginTop:6 }}>
                    {p.arv && <div><CardLabel>ARV</CardLabel><CardValue mono>{fmt(p.arv)}</CardValue></div>}
                    {cashOffer && <div><CardLabel>Cash Offer</CardLabel><CardValue mono color="#3B6D11">{fmt(cashOffer)}</CardValue></div>}
                  </CardRow>
                </MobileCard>
              )
            })}
          </div>
        ) : (
          <Card style={{ padding:0 }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'#F0EDE6' }}>
                  {['Address','Cash Offer','Rehab','ARV','Disposition','Updated',''].map(h=>(
                    <th key={h} style={{ padding:'8px 14px', textAlign:'left', fontSize:11, fontWeight:600, letterSpacing:0.8, color:'#6b7280', textTransform:'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p,i)=>{
                  const cashOffer = calcCashOffer(p)
                  return (
                    <tr key={p.id} onClick={()=>setDrawer(p)}
                      style={{ background:i%2===0?'#fff':'#FAFAF8', borderTop:'0.5px solid #F0EDE6', cursor:'pointer' }}
                      onMouseEnter={e=>e.currentTarget.style.background='#fef9f0'}
                      onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'#fff':'#FAFAF8'}>
                      <td style={{ padding:'10px 14px' }}>
                        <div style={{ fontSize:13, fontWeight:600 }}>{p.address}</div>
                        <div style={{ fontSize:11, color:'#9ca3af', marginTop:1 }}>
                          {[p.unit_count>1&&`${p.unit_count} units`,p.beds&&`${p.beds}bd`,p.baths&&`${p.baths}ba`,p.sqft&&`${parseInt(p.sqft).toLocaleString()}sf`].filter(Boolean).join(' · ')}
                        </div>
                      </td>
                      <td style={{ padding:'10px 14px', fontSize:13, fontFamily:'monospace', color:'#3B6D11', fontWeight:600 }}>{cashOffer?fmt(cashOffer):'—'}</td>
                      <td style={{ padding:'10px 14px', fontSize:13, fontFamily:'monospace', color:'#6b7280' }}>{(p.repair_items||[]).reduce((s,r)=>s+(parseFloat(r.cost)||0),0)>0?fmt((p.repair_items||[]).reduce((s,r)=>s+(parseFloat(r.cost)||0),0)):'—'}</td>
                      <td style={{ padding:'10px 14px', fontSize:13, fontFamily:'monospace', fontWeight:700 }}>{fmt(p.arv)||'—'}</td>
                      <td style={{ padding:'10px 14px' }}>
                        {p.disposition
                          ? <Badge color={DISP_COLOR[p.disposition]}>{DISP_LABEL[p.disposition]}</Badge>
                          : <span style={{ fontSize:11, color:'#B8892A', fontWeight:600 }}>Analyzing</span>}
                      </td>
                      <td style={{ padding:'10px 14px', fontSize:11, color:'#9ca3af' }}>{new Date(p.updated_at).toLocaleDateString()}</td>
                      <td style={{ padding:'10px 10px' }} onClick={e=>e.stopPropagation()}>
                        {p.arv && <button onClick={()=>setProposal(p)} style={{ background:'#2D6FAF', color:'#fff', border:'none', borderRadius:4, padding:'4px 10px', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>Offer PDF</button>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>
        )}
      </>)}

      <PropertyDrawer property={drawer} open={!!drawer} onClose={()=>setDrawer(null)} onSave={()=>load()} mailings={mailings} onViewOffer={p=>setProposal(p)} />
      {proposal && <ProposalModal property={proposal} onClose={()=>setProposal(null)} />}
    </PageWrap>
  )
}
