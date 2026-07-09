import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { PageWrap, SectionBar, Card, Badge, EmptyState, LoadingSpinner, fmt, fmtK, useSort, SortTh } from '../components/ui.jsx'
import PropertyDrawer from '../components/PropertyDrawer.jsx'
import ProposalModal from '../components/ProposalModal.jsx'
import KanbanBoard, { cardPill, cardChip, MoneyBurst, PROMO_PAYLOADS } from '../components/KanbanBoard.jsx'

const PROMO_ZONES = [
  { key:'Flip',      label:'FLIP',       emoji:'\u{1F528}', color:'#D97825' },
  { key:'Hold',      label:'HOLD',       emoji:'\u{1F3E0}', color:'#B8892A' },
  { key:'Analyzing', label:'RE-ANALYZE', emoji:'\u{1F50D}', color:'#6b7280' },
  { divider:true },
  { key:'Cancelled', label:'CANCEL',     emoji:'\u{1F6AB}', color:'#9ca3af' },
]

const BOARD_COLUMNS = [
  { key:'Under Contract', color:'#2D6FAF' },
  { key:'Assigned',       color:'#6b21a8' },
  { key:'Closed',         color:'#3B6D11' },  // drop opens drawer on Disposition; closed deals stay visible here
]

export default function Wholesale() {
  const mobile = useIsMobile()
  const [properties, setProperties] = useState([])
  const [mailings, setMailings] = useState([])
  const [loading, setLoading] = useState(true)
  const [drawer, setDrawer] = useState(null)
  const [drawerTab, setDrawerTab] = useState('analyzer')
  const [proposal, setProposal] = useState(null)
  const [view, setView] = useState('board')
  const [burst, setBurst] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: p }, { data: m }] = await Promise.all([
      supabase.from('cashoffer_properties').select('*').eq('type', 'Wholesale').neq('stage', 'Cancelled').order('disposition_date', { ascending: false }),
      supabase.from('cashoffer_mailings').select('id,campaign_name,drop_date').order('drop_date', { ascending: false }),
    ])
    setProperties(p || [])
    setMailings(m || [])
    setLoading(false)
  }

  const columnFor = p => p.stage || 'Under Contract'

  async function handleDrop(id, columnKey) {
    const { error } = await supabase.from('cashoffer_properties').update({ stage: columnKey }).eq('id', id)
    if (error) { alert(`Could not move deal: ${error.message}`); load(); return }
    if (columnKey === 'Closed') {
      // Terminal stage: open the drawer on Disposition so fee + close date get filled in
      const { data } = await supabase.from('cashoffer_properties').select('*').eq('id', id).single()
      if (data) { setDrawerTab('disposition'); setDrawer(data) }
    }
    load()
  }

  function openDrawer(p) { setDrawerTab('analyzer'); setDrawer(p) }

  async function handlePromote(id, zoneKey, coords) {
    // Negative zone: contract fell through — no confetti, deal leaves this page
    if (zoneKey === 'Cancelled') {
      const { error } = await supabase.from('cashoffer_properties').update({ stage:'Cancelled' }).eq('id', id)
      if (error) alert(`Could not move deal: ${error.message}`)
      load()
      return
    }
    const item = properties.find(p => p.id === id)
    if (item && item.type === zoneKey) { alert(`Already a ${zoneKey} deal.`); return }
    const payload = PROMO_PAYLOADS[zoneKey]
    if (!payload) return
    const { error } = await supabase.from('cashoffer_properties').update(payload).eq('id', id)
    if (error) { alert(`Could not move deal: ${error.message}`); load(); return }
    setBurst({ ...coords, key: Date.now() })
    setTimeout(() => setBurst(null), 1600)
    if (zoneKey === 'Flip' || zoneKey === 'Hold') {
      const { data } = await supabase.from('cashoffer_properties').select('*').eq('id', id).single()
      if (data) setTimeout(() => { setDrawerTab('acquisition'); setDrawer(data) }, 900)
    }
    load()
  }

  function wholesaleCardContent(p) {
    return (
      <>
        <div style={{ fontSize:13, fontWeight:700, color:'#2C2C2C', marginBottom:3 }}>{p.address || 'New Property'}</div>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8, marginBottom:8 }}>
          <div style={{ minWidth:0 }}>
            {p.wholesale_buyer && <div style={{ fontSize:11.5, color:'#6b21a8', fontWeight:600, marginBottom:1 }}>{p.wholesale_buyer}</div>}
            {p.seller_name && <div style={{ fontSize:11, color:'#6b7280' }}>{p.seller_name}</div>}
          </div>
          {p.wholesale_fee ? <span style={cardChip('#6b21a8','#F3EBFA','#DCC8EE')}>{fmt(p.wholesale_fee)}</span> : null}
        </div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:4, alignItems:'center' }}>
          {p.source && <span style={cardPill('#D97825','#FBF0E4')}>{p.source}</span>}
          {p.purchase_price && <span style={cardPill('#6b7280','#F0EDE6')}>Contract {fmt(p.purchase_price)}</span>}
        </div>
      </>
    )
  }

  const totalFees       = properties.reduce((s, p) => s + (parseFloat(p.wholesale_fee) || 0), 0)
  const totalCommission = properties.reduce((s, p) => s + (parseFloat(p.commission_earned) || 0), 0)
  const totalNHCRevenue = totalFees + totalCommission

  const { sorted, sortKey, sortDir, toggleSort } = useSort(properties, 'disposition_date', 'desc', {
    fee: p => parseFloat(p.wholesale_fee) || null,
    commission: p => parseFloat(p.commission_earned) || null,
    buyer: p => p.wholesale_buyer || '',
  })

  if (loading) return <LoadingSpinner />

  return (
    <PageWrap pad={!mobile}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, color:'#2C2C2C' }}>Wholesale</h1>
          <p style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>Contract assignments · BPV fees · NHC commission</p>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display:'grid', gridTemplateColumns: mobile ? '1fr 1fr' : 'repeat(4,1fr)', gap:12, marginBottom:24 }}>
        {[
          { label:'Total Deals',     value: properties.length,                              color:'#6b21a8' },
          { label:'BPV Fees',        value: totalFees > 0 ? fmtK(totalFees) : '—',          color:'#6b21a8' },
          { label:'NHC Commission',  value: totalCommission > 0 ? fmtK(totalCommission) : '—', color:'#3B6D11' },
          { label:'Total Revenue',   value: totalNHCRevenue > 0 ? fmtK(totalNHCRevenue) : '—', color:'#B8892A' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background:'#fff', border:'0.5px solid #D6D2CA', borderRadius:8, borderTop:`3px solid ${color}`, padding:'12px 16px' }}>
            <div style={{ fontSize:10, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.8, marginBottom:6 }}>{label}</div>
            <div style={{ fontSize:24, fontWeight:700, color, fontFamily:'monospace' }}>{value}</div>
          </div>
        ))}
      </div>

      {!mobile && (
        <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:14 }}>
          <div style={{ display:'flex', gap:2 }}>
            {[['board','Board'],['table','Table']].map(([v,l]) => (
              <button key={v} onClick={() => setView(v)} style={{ padding:'6px 14px', border:'none', borderRadius:6, cursor:'pointer', background: view === v ? '#2C2C2C' : '#F0EDE6', color: view === v ? '#fff' : '#6b7280', fontSize:12, fontWeight: view === v ? 700 : 400, fontFamily:'inherit' }}>{l}</button>
            ))}
          </div>
        </div>
      )}

      {view === 'board' && !mobile ? (
        properties.length === 0 ? (
          <EmptyState icon="○" text="No wholesale deals yet. Set deal type to Wholesale on a property in the Analyzer." />
        ) : (
          <>
            <KanbanBoard
              columns={BOARD_COLUMNS}
              items={properties}
              columnFor={columnFor}
              onOpen={openDrawer}
              onDrop={handleDrop}
              renderCard={wholesaleCardContent}
              promoZones={PROMO_ZONES}
              onPromote={handlePromote}
            />
            {burst && <MoneyBurst key={burst.key} x={burst.x} y={burst.y} />}
          </>
        )
      ) : (
      <>
      <SectionBar>Wholesale Deals ({properties.length})</SectionBar>

      {properties.length === 0 ? (
        <EmptyState icon="○" text="No wholesale deals yet. Set disposition to Wholesale on a property in the Analyzer." />
      ) : (
        <Card style={{ padding:0 }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'#F0EDE6' }}>
                <SortTh sortKeyName="address"          {...{sortKey,sortDir,toggleSort}}>Address</SortTh>
                <SortTh sortKeyName="buyer"            {...{sortKey,sortDir,toggleSort}}>Buyer</SortTh>
                <SortTh sortKeyName="purchase_price"   {...{sortKey,sortDir,toggleSort}}>Contract Price</SortTh>
                <SortTh sortKeyName="fee"              {...{sortKey,sortDir,toggleSort}}>BPV Fee</SortTh>
                <SortTh sortKeyName="commission"       {...{sortKey,sortDir,toggleSort}}>NHC Comm</SortTh>
                <SortTh sortKeyName="disposition_date" {...{sortKey,sortDir,toggleSort}}>Close Date</SortTh>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, i) => (
                <tr key={p.id} onClick={() => openDrawer(p)}
                  style={{ background:i%2===0?'#fff':'#FAFAF8', borderTop:'0.5px solid #F0EDE6', cursor:'pointer' }}
                  onMouseEnter={e=>e.currentTarget.style.background='#fef9f0'}
                  onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'#fff':'#FAFAF8'}>
                  <td style={{ padding:'10px 14px', fontSize:13, fontWeight:600 }}>{p.address}</td>
                  <td style={{ padding:'10px 14px', fontSize:12, color:'#6b7280' }}>{p.wholesale_buyer || '—'}</td>
                  <td style={{ padding:'10px 14px', fontSize:13, fontFamily:'monospace' }}>{fmt(p.purchase_price) || '—'}</td>
                  <td style={{ padding:'10px 14px', fontSize:13, fontFamily:'monospace', fontWeight:700, color:'#6b21a8' }}>{fmt(p.wholesale_fee) || '—'}</td>
                  <td style={{ padding:'10px 14px', fontSize:13, fontFamily:'monospace', color:'#3B6D11', fontWeight: p.commission_earned ? 700 : 400 }}>{fmt(p.commission_earned) || '—'}</td>
                  <td style={{ padding:'10px 14px', fontSize:12, color:'#9ca3af' }}>
                    {p.disposition_date ? new Date(p.disposition_date+'T12:00:00').toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop:'2px solid #D6D2CA', background:'#F0EDE6' }}>
                <td colSpan={3} style={{ padding:'8px 14px', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:0.8 }}>Totals</td>
                <td style={{ padding:'8px 14px', fontSize:14, fontFamily:'monospace', fontWeight:700, color:'#6b21a8' }}>{fmtK(totalFees)}</td>
                <td style={{ padding:'8px 14px', fontSize:14, fontFamily:'monospace', fontWeight:700, color:'#3B6D11' }}>{fmtK(totalCommission)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </Card>
      )}
      </>
      )}

      <PropertyDrawer property={drawer} open={!!drawer} onClose={() => setDrawer(null)} onSave={() => load()} mailings={mailings} onViewOffer={p => setProposal(p)} initialTab={drawerTab} />
      {proposal && <ProposalModal property={proposal} onClose={() => setProposal(null)} />}
    </PageWrap>
  )
}

