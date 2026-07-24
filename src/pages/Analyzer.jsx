import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { PageWrap, SectionBar, Card, Btn, EmptyState, LoadingSpinner, fmt, useSort, SortTh } from '../components/ui.jsx'
import PropertyDrawer from '../components/PropertyDrawer.jsx'
import ProposalModal from '../components/ProposalModal.jsx'
import PackageDeals from './PackageDeals.jsx'
import MobileCard, { CardRow, CardLabel, CardValue } from '../components/MobileCard.jsx'
import KanbanBoard, { cardPill, cardChip, cardBtn, CardStatBox, MoneyBurst, PROMO_PAYLOADS, shortStreet } from '../components/KanbanBoard.jsx'

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
// Dead deals don't get a column — they're dropped on the DEAD tray zone and
// live on the Dead Deals page from then on.
const BOARD_COLUMNS = [
  { key:'New Lead',          color:'#9ca3af' },
  { key:'Needs Cash Offer',  color:'#D97825' },
  { key:'Offer Submitted',   color:'#B8892A' },
  { key:'Offer Accepted',    color:'#3B6D11' },
]

function daysAgo(dateStr) {
  if (!dateStr) return null
  const diff = Date.now() - new Date(dateStr).getTime()
  return Math.max(0, Math.floor(diff / 86400000))
}

const PROMO_ZONES = [
  { key:'Renovation',     label:'START RENOVATION', sub:'Flip / Hold',      emoji:'\u{1F3D7}\u{FE0F}', color:'#6b21a8' },
  { key:'Retail Listing', label:'STANDARD LISTING', sub:'NHC \u00b7 client',   emoji:'\u{1FAA7}', color:'#3B6D11' },
  { key:'Wholesale',      label:'WHOLESALE',        sub:'Assign contract',  emoji:'\u{1F91D}', color:'#6b21a8' },
  { divider:true },
  { key:'Lost',           label:'DEAD',             sub:'Lost / passed',    emoji:'\u{1F480}', color:'#B91C1C' },
]

// Purchasing a deal kicks off its renovation automatically: the Analyzer's
// repair estimates become Round 1 line items. Skipped when the property
// already has renovation items (e.g. it cycled back through the Analyzer),
// so real tracked costs are never duplicated or overwritten.
async function seedRenovationFromAnalyzer(p) {
  const estimates = (p.repair_items || []).filter(r => r.name && r.name.trim())
  if (!estimates.length) return
  const { count } = await supabase.from('cashoffer_rehab_items')
    .select('id', { count: 'exact', head: true }).eq('property_id', p.id)
  if (count > 0) return  // renovation already has items — leave it alone
  let { data: round } = await supabase.from('cashoffer_rehab_rounds')
    .select('id').eq('property_id', p.id).order('sort_order', { ascending: true }).limit(1).maybeSingle()
  if (!round) {
    const { data: created } = await supabase.from('cashoffer_rehab_rounds')
      .insert({ property_id: p.id, label: 'Round 1', sort_order: 0 }).select().single()
    round = created
  }
  if (!round) return
  await supabase.from('cashoffer_rehab_items').insert(estimates.map((r, i) => ({
    property_id: p.id, rehab_round_id: round.id,
    name: r.name, estimated_cost: parseFloat(r.cost) || 0, status: 'Scheduled', sort_order: i,
  })))
}

function analyzerCardContent(p, onViewOffer) {
  const cashOffer = calcCashOffer(p)
  const days = daysAgo(p.updated_at)
  const stale = days !== null && days > 7
  return (
    <>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8 }}>
        <div style={{ minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'#2C2C2C' }}>{shortStreet(p.address) || 'New Property'}</div>
          <div style={{ fontSize:10, color:'#9ca3af', marginTop:1 }}>{p.address?.split(',').slice(1,3).join(',').trim() || ''}</div>
          {p.owner && <div style={{ fontSize:10, color:'#9ca3af', marginTop:1 }}>{p.owner}</div>}
        </div>
        {p.source && (
          <span style={{ flexShrink:0, fontSize:9, fontWeight:700, color:'#fff', background:'#6b7280', borderRadius:5, padding:'3px 8px', textTransform:'uppercase', letterSpacing:0.4 }}>
            {p.source}
          </span>
        )}
      </div>

      {p.seller_name && <div style={{ fontSize:11.5, color:'#B8892A', fontWeight:600, margin:'6px 0 8px' }}>{p.seller_name}</div>}

      <div style={{ display:'flex', gap:6 }}>
        {cashOffer ? <CardStatBox label="Cash Offer" value={fmt(cashOffer)} color="#B8892A" bg="#FBF6EA" /> : null}
        {p.arv ? <CardStatBox label="ARV" value={fmt(p.arv)} color="#3B6D11" bg="#EEF5E7" /> : null}
      </div>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:8 }}>
        {p.acquisition_type === 'Pre-Owned' && <span style={cardPill('#6b21a8','#F3EBFA')}>Pre-Owned</span>}
        {days !== null && (
          <span style={{ fontSize:10, fontWeight: stale ? 700 : 400, color: days > 14 ? '#B91C1C' : days > 7 ? '#D97825' : '#9ca3af', marginLeft:'auto' }}>
            {days===0 ? 'Updated today' : `Updated ${days}d ago`}
          </span>
        )}
      </div>

      {cashOffer ? (
        <button style={cardBtn} onClick={e => { e.stopPropagation(); onViewOffer(p) }}>📄 View Offer PDF</button>
      ) : null}
    </>
  )
}

function AnalyzerBoard({ properties, onOpen, onMoved, onPromoted, onViewOffer }) {
  const [burst, setBurst] = useState(null)

  const columnFor = p => (p.stage && p.stage !== 'Analyzing') ? p.stage : 'New Lead'

  async function handleDrop(id, columnKey) {
    const payload = { type:'Analyzing', stage:columnKey, disposition:null }
    const { error } = await supabase.from('cashoffer_properties').update(payload).eq('id', id)
    if (error) alert(`Could not move deal: ${error.message}`)
    onMoved()
  }

  async function handlePromote(id, typeKey, coords) {
    // Negative zone: mark dead → deal moves to the Dead Deals page. No confetti.
    if (typeKey === 'Lost') {
      const { error } = await supabase.from('cashoffer_properties')
        .update({ type:'Analyzing', stage:'Lost', disposition:'lost' }).eq('id', id)
      if (error) alert(`Could not move deal: ${error.message}`)
      onMoved()
      return
    }
    const payload = PROMO_PAYLOADS[typeKey]
    if (!payload) return
    const { error } = await supabase.from('cashoffer_properties').update(payload).eq('id', id)
    if (error) { alert(`Could not promote deal: ${error.message}`); onMoved(); return }
    if (typeKey === 'Renovation') {
      const item = properties.find(p => p.id === id)
      if (item) await seedRenovationFromAnalyzer(item)
    }
    setBurst({ ...coords, key: Date.now() })
    setTimeout(() => setBurst(null), 1600)
    onPromoted?.(id, typeKey)
    onMoved()
  }

  return (
    <>
      <KanbanBoard
        columnWidth={420}
        columns={BOARD_COLUMNS}
        items={properties}
        columnFor={columnFor}
        onOpen={onOpen}
        onDrop={handleDrop}
        renderCard={p => analyzerCardContent(p, onViewOffer)}
        promoZones={PROMO_ZONES}
        onPromote={handlePromote}
      />
      {burst && <MoneyBurst key={burst.key} x={burst.x} y={burst.y} />}
    </>
  )
}

export default function Analyzer({ openPropertyId, openInPackage, onOpenedTarget, onOpenNew, isAgentRole=false, currentUserEmail=null } = {}) {
  const [tab, setTab] = useState('properties')
  const [view, setView] = useState('board')
  const [properties, setProperties] = useState([])
  const [mailings, setMailings] = useState([])
  const [loading, setLoading] = useState(true)
  const [drawer, setDrawer] = useState(null)
  const [drawerTab, setDrawerTab] = useState('analyzer')
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
        let q = supabase.from('cashoffer_properties').select('*').eq('id', openPropertyId)
        if (isAgentRole) q = q.eq('agent_email', currentUserEmail)
        q.single().then(({ data }) => { if (data) setDrawer(data) })
      }
    }
    onOpenedTarget && onOpenedTarget()
  }, [openPropertyId, openInPackage]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    let propQuery = supabase.from('cashoffer_properties').select('*')
      // Analyzer is purely pre-purchase: active Analyzing deals only.
      // Dead deals (stage='Lost') live exclusively on the Dead Deals page now.
      // (Legacy type='Lost' rows — zero exist — would also be excluded here.)
      .is('package_id', null)
      .eq('type', 'Analyzing')
      .neq('stage', 'Lost')
    if (isAgentRole) propQuery = propQuery.eq('agent_email', currentUserEmail)
    propQuery = propQuery.order('updated_at', { ascending: false })

    const [{ data: p }, { data: m }] = await Promise.all([
      propQuery,
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

      {tab === 'packages' && <PackageDeals embedded openPropertyId={packageTargetId} onOpenedTarget={() => setPackageTargetId(null)} isAgentRole={isAgentRole} currentUserEmail={currentUserEmail} />}

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
              <AnalyzerBoard properties={filtered} onOpen={p => { setDrawerTab('analyzer'); setDrawer(p) }} onMoved={load} onViewOffer={p => setProposal(p)}
                onPromoted={async (id, typeKey) => {
                  // Celebration first, paperwork second — open on the tab the new type needs
                  const tab = typeKey === 'Wholesale' ? 'disposition' : typeKey === 'Retail Listing' ? 'analyzer' : 'acquisition'
                  const { data } = await supabase.from('cashoffer_properties').select('*').eq('id', id).single()
                  if (data) setTimeout(() => { setDrawerTab(tab); setDrawer(data) }, 900)
                }} />
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
                  <MobileCard key={p.id} onClick={() => { setDrawerTab('analyzer'); setDrawer(p) }} accent="#B8892A">
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
                      <tr key={p.id} onClick={() => { setDrawerTab('analyzer'); setDrawer(p) }}
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
                        {(p.type==='Lost' || p.stage==='Lost') && (
                          <span style={{ fontSize:11, fontWeight:600, color:'#9ca3af' }}>Lost</span>
                        )}
                        {p.stage && p.stage!=='Analyzing' && (
                          <span style={{ fontSize:11, fontWeight:600, color: p.stage==='Pending'?'#2D6FAF':'#B8892A' }}>{p.stage}</span>
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

      <PropertyDrawer property={drawer} open={!!drawer} onClose={() => setDrawer(null)} onSave={() => load()} mailings={mailings} onViewOffer={p => setProposal(p)} initialTab={drawerTab} isAgentRole={isAgentRole} currentUserEmail={currentUserEmail} />
      {proposal && <ProposalModal property={proposal} onClose={() => setProposal(null)} />}
    </PageWrap>
  )
}


