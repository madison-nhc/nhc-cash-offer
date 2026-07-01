import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { PageWrap, SectionBar, Card, Btn, EmptyState, LoadingSpinner, fmt, useSort, SortTh } from '../components/ui.jsx'
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

export default function Analyzer({ openPropertyId, openInPackage, onOpenedTarget } = {}) {
  const [tab, setTab] = useState('properties')
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
      // Analyzer shows Analyzing + Under Contract + Lost
      supabase.from('cashoffer_properties').select('*')
        .is('package_id', null)
        .in('stage', ['Analyzing','Under Contract','Lost / Passed'])
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
        {tab === 'properties' && <Btn onClick={() => setDrawer({ ...EMPTY })} style={{ fontSize:12, padding:'7px 14px' }}>+ New Property</Btn>}
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
          {/* Search */}
          <div style={{ marginBottom:14 }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search address..."
              style={{ padding:'6px 12px', border:'1px solid #D6D2CA', borderRadius:6, fontSize:13, fontFamily:'inherit', outline:'none', width:'100%', maxWidth:360 }}
            />
          </div>

          <SectionBar>Properties ({filtered.length})</SectionBar>

          {filtered.length === 0 ? (
            <EmptyState icon="○" text="No properties being analyzed. Click + New Property to add one." />
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
                        {p.stage && p.stage!=='Analyzing' && (
                          <span style={{ fontSize:11, fontWeight:600, color: p.stage==='Under Contract'?'#2D6FAF':p.stage==='Lost / Passed'?'#9ca3af':'#B8892A' }}>{p.stage}</span>
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

      <PropertyDrawer property={drawer} open={!!drawer} onClose={() => setDrawer(null)} onSave={() => load()} mailings={mailings} onViewOffer={p => setProposal(p)} />
      {proposal && <ProposalModal property={proposal} onClose={() => setProposal(null)} />}
    </PageWrap>
  )
}
