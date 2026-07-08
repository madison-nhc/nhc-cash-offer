import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { PageWrap, SectionBar, Card, Btn, EmptyState, LoadingSpinner, fmt, useSort, SortTh, Badge } from '../components/ui.jsx'
import PropertyDrawer from '../components/PropertyDrawer.jsx'
import ProposalModal from '../components/ProposalModal.jsx'
import PackageDeals from './PackageDeals.jsx'
import MobileCard, { CardRow, CardLabel, CardValue } from '../components/MobileCard.jsx'

function calcCashOffer(p) {
  const arv = parseFloat(p.arv) || 0
  if (!arv) return null
  const reno = (p.repair_items || []).reduce((s, r) => s + (parseFloat(r.cost) || 0), 0)
  const commCash = (parseFloat(p.comm_cash_pct) || 9) / 100
  const profitPct = (parseFloat(p.profit_margin) || 15) / 100
  const profit = p.profit_override ? parseFloat(p.profit_override) : arv * profitPct
  const cashHold = (parseFloat(p.hold_cash_pct) || 0.75) / 100 * (parseFloat(p.hold_cash_months) || 6) * arv
  return p.cash_offer_override ? parseFloat(p.cash_offer_override) : arv - reno - (commCash * arv) - cashHold - profit
}

// ── Kanban board for working leads through analysis ──────────────────────────
const BOARD_COLUMNS = [
  { key:'New Lead',          color:'#9ca3af' },
  { key:'Needs Cash Offer',  color:'#D97825' },
  { key:'Offer Submitted',   color:'#B8892A' },
  { key:'Offer Accepted',    color:'#3B6D11' },
  { key:'Rejected / Lost',   color:'#B91C1C' },
]

function daysAgo(dateStr) {
  if (!dateStr) return null
  const diff = Date.now() - new Date(dateStr).getTime()
  return Math.max(0, Math.floor(diff / 86400000))
}

function BoardCard({ p, onOpen, onDragStart }) {
  const cashOffer = calcCashOffer(p)
  const days = daysAgo(p.updated_at)
  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, p.id)}
      onClick={() => onOpen(p)}
      style={{
        background:'#fff', border:'0.5px solid #D6D2CA', borderRadius:8, padding:'10px 12px',
        marginBottom:8, cursor:'grab',
      }}
    >
      <div style={{ fontSize:13, fontWeight:700, color:'#2C2C2C', marginBottom:4 }}>{p.address || 'New Property'}</div>
      {p.seller_name && <div style={{ fontSize:11, color:'#6b7280', marginBottom:4 }}>{p.seller_name}</div>}
      <div style={{ display:'flex', flexWrap:'wrap', gap:6, alignItems:'center' }}>
        {p.arv && <span style={{ fontSize:11, fontFamily:'monospace', color:'#6b7280' }}>ARV {fmt(p.arv)}</span>}
        {cashOffer && <span style={{ fontSize:11, fontFamily:'monospace', color:'#3B6D11', fontWeight:700 }}>{fmt(cashOffer)}</span>}
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:6 }}>
        {p.source ? <Badge>{p.source}</Badge> : <span />}
        {days !== null && <span style={{ fontSize:10, color:'#9ca3af' }}>{days===0 ? 'today' : `${days}d`}</span>}
      </div>
    </div>
  )
}

function AnalyzerBoard({ properties, onOpen, onMoved }) {
  const [dragOverCol, setDragOverCol] = useState(null)

  const columnFor = p => {
    if (p.type === 'Lost') return 'Rejected / Lost'
    return (p.stage && p.stage !== 'Analyzing') ? p.stage : 'New Lead'
  }

  async function handleDrop(e, columnKey) {
    e.preventDefault()
    setDragOverCol(null)
    const id = e.dataTransfer.getData('text/plain')
    if (!id) return
    const payload = columnKey === 'Rejected / Lost'
      ? { type:'Lost', stage:null, disposition:'lost' }
      : { type:'Analyzing', stage:columnKey, disposition:null }
    await supabase.from('cashoffer_properties').update(payload).eq('id', id)
    onMoved()
  }

  return (
    <div style={{ display:'flex', gap:12, overflowX:'auto', paddingBottom:8, alignItems:'flex-start' }}>
      {BOARD_COLUMNS.map(col => {
        const items = properties.filter(p => columnFor(p) === col.key)
        return (
          <div
            key={col.key}
            onDragOver={e => { e.preventDefault(); setDragOverCol(col.key) }}
            onDragLeave={() => setDragOverCol(null)}
            onDrop={e => handleDrop(e, col.key)}
            style={{
              flex:'0 0 260px', minWidth:260, background: dragOverCol===col.key ? '#fef9f0' : '#F0EDE6',
              borderRadius:8, padding:10, transition:'background 0.1s',
            }}
          >
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8, padding:'0 2px', borderTop:`3px solid ${col.color}`, paddingTop:8 }}>
              <span style={{ fontSize:12, fontWeight:700, color:'#2C2C2C' }}>{col.key}</span>
              <span style={{ fontSize:11, color:'#9ca3af', fontWeight:600 }}>{items.length}</span>
            </div>
            <div style={{ minHeight:40 }}>
              {items.map(p => (
                <BoardCard key={p.id} p={p} onOpen={onOpen} onDragStart={(e,id)=>e.dataTransfer.setData('text/plain', id)} />
              ))}
              {items.length===0 && (
                <div style={{ fontSize:11, color:'#9ca3af', textAlign:'center', padding:'12px 0' }}>No deals</div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function Analyzer({ openPropertyId, openInPackage, onOpenedTarget, onOpenNew } = {}) {
  const [tab, setTab] = useState('properties')
  const [view, setView] = useState('board')
  const [properties, setProperties] = useState([])
  const [mailings, setMailings] = useState([])
  const [loading, setLoading] = useState(true)
  const [drawer, setDrawer] = useState(null)
  const [proposal, setProposal] = useState(null)
  const [search, setSearch] = useState('')
  const [packageTargetId, setPackageTargetId] = useState(null)
  const mobile = useIsMobile()

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (!openPropertyId) return
    if (openInPackage) {
      setTab('packages')
      setPackageTargetId(openPropertyId)
    } else {
      const match = properties.find(p => p.id === openPropertyId)
      if (match) setDrawer(match)
      else {
        supabase.from('cashoffer_properties').select('*').eq('id', openPropertyId).single()
          .then(({ data }) => { if (data) setDrawer(data) })
      }
    }
    onOpenedTarget && onOpenedTarget()
  }, [openPropertyId, openInPackage]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    const [{ data: p }, { data: m }] = await Promise.all([
      // Analyzer shows Analyzing + Lost, plus any type currently Under Contract
      supabase.from('cashoffer_properties').select('*')
        .is('package_id', null)
        .or('type.in.(Analyzing,Lost),stage.eq.Under Contract')
        .order('updated_at', { ascending: false }),
      supabase.from('cashoffer_mailings').select('id,campaign_name,drop_date').order('drop_date', { ascending: false }),
    ])
    setProperties(p || [])
    setMailings(m || [])
    setLoading(false)
  }

  const EMPTY = {
    address: '', arv: '', asis_pct: 50, profit_margin: 15,
    comm_cash_pct: 9, comm_list_pct: 6, hold_cash_pct: 0.75, hold_cash_months: 6,
    hold_opt2_pct: 0.5, hold_opt2_months: 3, hold_opt3_pct: 0.5, hold_opt3_months: 6,
    repair_items: []
  }

  const filtered = properties.filter(p =>
    !search || p.address?.toLowerCase().includes(search.toLowerCase())
  )

  const { sorted, sortKey, sortDir, toggleSort } = useSort(filtered, 'updated_at', 'desc', {
    cash_offer: p => calcCashOffer(p),
    rehab: p => (p.repair_items || []).reduce((s, r) => s + (parseFloat(r.cost) || 0), 0),
  })

  if (loading) return <LoadingSpinner />

  return (
    <PageWrap>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <div>
          <h1 style={{ fontSize: mobile ? 18 : 20, fontWeight:700, color:'#2C2C2C' }}>Property Analyzer</h1>
          <p style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>Properties being evaluated · analyzing and under contract</p>
        </div>

      </div>

      {/* Page tabs */}
      <div style={{ display:'flex', gap:2, marginBottom:16 }}>
        {[['properties', 'Single Properties'], ['packages', 'Package Deals']].map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)} style={{ padding:'7px 16px', border:'none', borderRadius:6, cursor:'pointer', background: tab === t ? '#2C2C2C' : '#F0EDE6', color: tab === t ? '#fff' : '#6b7280', fontSize:12, fontWeight: tab === t ? 700 : 400, fontFamily:'inherit' }}>{l}</button>
        ))}
      </div>

      {tab === 'packages' && <PackageDeals embedded openPropertyId={packageTargetId} onOpenedTarget={() => setPackageTargetId(null)} />}

      {tab === 'properties' && (
        <>
          {/* Search + view toggle */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, marginBottom:14, flexWrap:'wrap' }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search address..."
              style={{ padding:'6px 12px', border:'1px solid #D6D2CA', borderRadius:6, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%', maxWidth:360 }}
            />
            <div style={{ display:'flex', gap:2 }}>
              {[['board','Board'],['table','Table']].map(([v,l]) => (
                <button key={v} onClick={() => setView(v)} style={{ padding:'6px 14px', border:'none', borderRadius:6, cursor:'pointer', background: view === v ? '#2C2C2C' : '#F0EDE6', color: view === v ? '#fff' : '#6b7280', fontSize:12, fontWeight: view === v ? 700 : 400, fontFamily:'inherit' }}>{l}</button>
              ))}
            </div>
          </div>

          {view === 'board' && !mobile ? (
            filtered.length === 0 ? (
              <EmptyState icon="○" text="No properties being analyzed. Use the + Add Property button in the nav to add one." />
            ) : (
              <AnalyzerBoard properties={filtered} onOpen={setDrawer} onMoved={load} />
            )
          ) : (
          <>
          <SectionBar>Properties ({filtered.length})</SectionBar>

          {filtered.length === 0 ? (
            <EmptyState icon="○" text="No properties being analyzed. Use the + Add Property button in the nav to add one." />
          ) : mobile ? (
            <div style={{ marginTop:8 }}>
              {filtered.map(p => {
                const cashOffer = calcCashOffer(p)
                return (
                  <MobileCard key={p.id} onClick={() => setDrawer(p)} accent="#B8892A">
                    <CardRow>
                      <span style={{ fontSize:14, fontWeight:700, color:'#2C2C2C', flex:1, marginRight:8 }}>{p.address}</span>
                      <span style={{ fontSize:10, color:'#B8892A', fontWeight:600 }}>Analyzing</span>
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
                    <SortTh sortKeyName="address"    {...{sortKey,sortDir,toggleSort}}>Address</SortTh>
                    <SortTh sortKeyName="cash_offer" {...{sortKey,sortDir,toggleSort}}>Cash Offer</SortTh>
                    <SortTh sortKeyName="rehab"      {...{sortKey,sortDir,toggleSort}}>Est. Rehab</SortTh>
                    <SortTh sortKeyName="arv"        {...{sortKey,sortDir,toggleSort}}>ARV</SortTh>
                    <SortTh sortKeyName="stage"      {...{sortKey,sortDir,toggleSort}}>Stage</SortTh>
                  <SortTh sortKeyName="updated_at" {...{sortKey,sortDir,toggleSort}}>Updated</SortTh>
                    <th style={{ padding:'8px 14px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((p, i) => {
                    const cashOffer = calcCashOffer(p)
                    const rehabTotal = (p.repair_items || []).reduce((s, r) => s + (parseFloat(r.cost) || 0), 0)
                    return (
                      <tr key={p.id} onClick={() => setDrawer(p)}
                        style={{ background: i % 2 === 0 ? '#fff' : '#FAFAF8', borderTop:'0.5px solid #F0EDE6', cursor:'pointer' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#fef9f0'}
                        onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#FAFAF8'}>
                        <td style={{ padding:'10px 14px' }}>
                          <div style={{ fontSize:13, fontWeight:600 }}>{p.address}</div>
                          <div style={{ fontSize:11, color:'#9ca3af', marginTop:1 }}>
                            {[p.unit_count > 1 && `${p.unit_count} units`, p.beds && `${p.beds}bd`, p.baths && `${p.baths}ba`, p.sqft && `${parseInt(p.sqft).toLocaleString()}sf`].filter(Boolean).join(' · ')}
                          </div>
                        </td>
                        <td style={{ padding:'10px 14px', fontSize:13, fontFamily:'monospace', color:'#3B6D11', fontWeight:600 }}>{cashOffer ? fmt(cashOffer) : '—'}</td>
                        <td style={{ padding:'10px 14px', fontSize:13, fontFamily:'monospace', color:'#6b7280' }}>{rehabTotal > 0 ? fmt(rehabTotal) : '—'}</td>
                        <td style={{ padding:'10px 14px', fontSize:13, fontFamily:'monospace', fontWeight:700 }}>{fmt(p.arv) || '—'}</td>
                        <td style={{ padding:'10px 14px' }}>
                        {p.type==='Lost' && (
                          <span style={{ fontSize:11, fontWeight:600, color:'#9ca3af' }}>Lost</span>
                        )}
                        {p.stage && p.stage!=='Analyzing' && (
                          <span style={{ fontSize:11, fontWeight:600, color: p.stage==='Under Contract'?'#2D6FAF':'#B8892A' }}>{p.stage}</span>
                        )}
                        {p.post_occupancy && <div style={{ fontSize:10, color:'#B8892A', marginTop:1 }}>{p.post_occupancy==='owner'?'Post-Occ: Owner':'Post-Occ: Renting Back'}</div>}
                      </td>
                      <td style={{ padding:'10px 14px', fontSize:11, color:'#9ca3af' }}>{new Date(p.updated_at).toLocaleDateString()}</td>
                        <td style={{ padding:'10px 10px' }} onClick={e => e.stopPropagation()}>
                          {p.arv && (
                            <button onClick={() => setProposal(p)} style={{ background:'#2D6FAF', color:'#fff', border:'none', borderRadius:4, padding:'4px 10px', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                              Offer PDF
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </Card>
          )}
          </>
          )}
        </>
      )}

      <PropertyDrawer property={drawer} open={!!drawer} onClose={() => setDrawer(null)} onSave={() => load()} mailings={mailings} onViewOffer={p => setProposal(p)} />
      {proposal && <ProposalModal property={proposal} onClose={() => setProposal(null)} />}
    </PageWrap>
  )
}

