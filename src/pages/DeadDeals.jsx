import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { PageWrap, SectionBar, Card, EmptyState, LoadingSpinner, fmt, useSort, SortTh } from '../components/ui.jsx'
import PropertyDrawer from '../components/PropertyDrawer.jsx'
import MobileCard, { CardRow, CardLabel, CardValue } from '../components/MobileCard.jsx'

// ── Dead Deals archive ─────────────────────────────────────────────────────────
// Everything that exited the pipeline without closing: lost leads (Analyzing),
// cancelled/expired client listings, and cancelled wholesale contracts.
// Read-only in spirit — rows open the drawer, where a deal can be revived by
// changing its stage/type.

const DEAD_STAGES = ['Lost', 'Cancelled / Expired', 'Cancelled']

function outcomeLabel(p) {
  if (p.stage === 'Lost') return { text:'Lost',                color:'#9ca3af' }
  if (p.stage === 'Cancelled / Expired') return { text:'Cancelled / Expired', color:'#B91C1C' }
  return { text:'Cancelled', color:'#B91C1C' }
}

function typeLabel(p) {
  if (p.stage === 'Lost') return 'Lead'
  if (p.type === 'Retail Listing') return p.listing_type === 'Reno' ? 'Client Reno Listing' : 'Client Listing'
  return p.type
}

export default function DeadDeals() {
  const mobile = useIsMobile()
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [drawer, setDrawer] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('cashoffer_properties').select('*')
      .in('stage', DEAD_STAGES)
      .order('updated_at', { ascending: false })
    setProperties(data || [])
    setLoading(false)
  }

  const { sorted, sortKey, sortDir, toggleSort } = useSort(properties, 'updated_at', 'desc', {})

  if (loading) return <LoadingSpinner />

  return (
    <PageWrap pad={!mobile}>
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:20, fontWeight:700, color:'#2C2C2C' }}>Dead Deals</h1>
        <p style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>Lost leads, cancelled and expired listings, and fallen-through contracts · full history kept</p>
      </div>

      <SectionBar>Archive ({properties.length})</SectionBar>

      {properties.length === 0 ? (
        <EmptyState icon="○" text="Nothing here — no lost or cancelled deals." />
      ) : mobile ? (
        <div>
          {sorted.map(p => {
            const outcome = outcomeLabel(p)
            return (
              <MobileCard key={p.id} onClick={() => setDrawer(p)} accent={outcome.color}>
                <CardRow>
                  <span style={{ fontSize:14, fontWeight:700, color:'#2C2C2C', flex:1, marginRight:8 }}>{p.address || '—'}</span>
                  <span style={{ fontSize:10, color:outcome.color, fontWeight:600 }}>{outcome.text}</span>
                </CardRow>
                <CardRow><CardLabel>Was</CardLabel><CardValue>{typeLabel(p)}</CardValue></CardRow>
                {p.arv && <CardRow><CardLabel>ARV</CardLabel><CardValue>{fmt(p.arv)}</CardValue></CardRow>}
              </MobileCard>
            )
          })}
        </div>
      ) : (
        <Card style={{ padding:0 }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ borderBottom:'1px solid #D6D2CA', textAlign:'left' }}>
                <SortTh label="Address" sortKey="address" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <th style={{ padding:'10px 12px', fontSize:11, color:'#9ca3af' }}>Outcome</th>
                <th style={{ padding:'10px 12px', fontSize:11, color:'#9ca3af' }}>Was</th>
                <SortTh label="ARV" sortKey="arv" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <th style={{ padding:'10px 12px', fontSize:11, color:'#9ca3af' }}>Source</th>
                <SortTh label="Last Updated" sortKey="updated_at" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {sorted.map(p => {
                const outcome = outcomeLabel(p)
                return (
                  <tr key={p.id} onClick={() => setDrawer(p)}
                    style={{ borderBottom:'0.5px solid #EAE7E0', cursor:'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background='#FAF8F4'}
                    onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                    <td style={{ padding:'10px 12px', fontWeight:600, color:'#2C2C2C' }}>{p.address || '—'}</td>
                    <td style={{ padding:'10px 12px', fontWeight:700, fontSize:12, color:outcome.color }}>{outcome.text}</td>
                    <td style={{ padding:'10px 12px', color:'#6b7280' }}>{typeLabel(p)}</td>
                    <td style={{ padding:'10px 12px', fontFamily:'monospace', color:'#6b7280' }}>{p.arv ? fmt(p.arv) : '—'}</td>
                    <td style={{ padding:'10px 12px', color:'#6b7280', fontSize:12 }}>{p.source || '—'}</td>
                    <td style={{ padding:'10px 12px', color:'#9ca3af', fontSize:12 }}>{p.updated_at ? new Date(p.updated_at).toLocaleDateString() : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}

      <PropertyDrawer property={drawer} open={!!drawer} onClose={() => setDrawer(null)} onSave={() => load()} />
    </PageWrap>
  )
}
