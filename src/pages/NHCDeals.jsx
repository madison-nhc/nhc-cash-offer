import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { PageWrap, SectionBar, Card, Badge, EmptyState, LoadingSpinner, fmt, fmtK, useSort, SortTh } from '../components/ui.jsx'
import PropertyDrawer from '../components/PropertyDrawer.jsx'

const DISP_COLORS = { listing:'#3B6D11', wholesale:'#6b21a8', flip:'#D97825' }
const DISP_LABELS = { listing:'Listing', wholesale:'Wholesale', flip:'Flip' }

function GroupLabel({ children }) {
  return <div style={{ fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>{children}</div>
}

function MiniStat({ label, value, sub, color='#2C2C2C' }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
      <div style={{ fontSize:10, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.7 }}>{label}</div>
      <div style={{ fontSize:18, fontWeight:700, fontFamily:'monospace', color }}>{value}</div>
      {sub && <div style={{ fontSize:10, color:'#9ca3af' }}>{sub}</div>}
    </div>
  )
}

function StatGroup({ title, color, filterKey, activeFilter, onFilter, children }) {
  const active = activeFilter === filterKey
  return (
    <div
      onClick={() => onFilter(active ? 'all' : filterKey)}
      style={{
        background:'#fff', border: active ? `1.5px solid ${color}` : '0.5px solid #D6D2CA',
        borderRadius:8, borderTop:`3px solid ${color}`, padding:'12px 16px',
        cursor:'pointer', transition:'box-shadow 0.15s',
        boxShadow: active ? `0 0 0 3px ${color}22` : 'none',
      }}
      onMouseEnter={e=>{ if(!active) e.currentTarget.style.boxShadow=`0 2px 8px rgba(0,0,0,0.08)` }}
      onMouseLeave={e=>{ if(!active) e.currentTarget.style.boxShadow='none' }}
    >
      <GroupLabel>{title}{active ? ' ✓' : ''}</GroupLabel>
      <div style={{ display:'flex', gap:24, flexWrap:'wrap' }}>{children}</div>
    </div>
  )
}

export default function NHCDeals() {
  const mobile = useIsMobile()
  const [properties, setProperties] = useState([])
  const [mailings, setMailings] = useState([])
  const [packages, setPackages] = useState([])
  const [loading, setLoading] = useState(true)
  const [drawer, setDrawer] = useState(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data:p }, { data:m }, { data:pkgs }] = await Promise.all([
      supabase.from('properties').select('*').in('disposition',['listing','wholesale','flip']).order('updated_at',{ascending:false}),
      supabase.from('mailings').select('id,campaign_name,drop_date').order('drop_date',{ascending:false}),
      supabase.from('package_deals').select('id,deal_name'),
    ])
    setProperties(p||[])
    setMailings(m||[])
    setPackages(pkgs||[])
    setLoading(false)
  }

  const listings  = properties.filter(p => p.disposition === 'listing')
  const wholesale = properties.filter(p => p.disposition === 'wholesale')
  const flips     = properties.filter(p => p.disposition === 'flip')

  const activeListings   = listings.filter(p => !p.disposition_date)
  const closedListings   = listings.filter(p => p.disposition_date)
  const listingComm      = listings.reduce((s,p) => s+(parseFloat(p.commission_earned)||0), 0)

  const wholesaleComm    = wholesale.reduce((s,p) => s+(parseFloat(p.commission_earned)||0), 0)
  const wholesaleFees    = wholesale.reduce((s,p) => s+(parseFloat(p.wholesale_fee)||0), 0)

  const activeFlips      = flips.filter(p => !p.sale_date)
  const closedFlips      = flips.filter(p => p.sale_date)
  const flipComm         = flips.reduce((s,p) => s+(parseFloat(p.commission_earned)||0), 0)

  const totalComm = listingComm + wholesaleComm + flipComm

  const filtered = filter === 'all' ? properties : properties.filter(p => p.disposition === filter)

  const { sorted, sortKey, sortDir, toggleSort } = useSort(filtered, 'close_date', 'desc', {
    close_date: p => p.disposition_date || p.sale_date,
    source: p => mailings.find(m => m.id === p.mailing_id)?.campaign_name || '',
    type: p => DISP_LABELS[p.disposition] || p.disposition,
  })

  if (loading) return <LoadingSpinner />

  return (
    <PageWrap pad={!mobile}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, color:'#2C2C2C' }}>NHC Deals</h1>
          <p style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>New Home Collective · commission tracking</p>
        </div>
      </div>

      {/* Grouped stat cards */}
      <div style={{ display:'grid', gridTemplateColumns:mobile?'1fr':'1fr 1fr 1fr', gap:12, marginBottom:24 }}>
        <StatGroup title="Listings" color="#3B6D11" filterKey="listing" activeFilter={filter} onFilter={setFilter}>
          <MiniStat label="Active" value={activeListings.length} color="#3B6D11" />
          <MiniStat label="Closed" value={closedListings.length} />
          <MiniStat label="Commission" value={listingComm>0?fmtK(listingComm):'—'} color="#3B6D11" />
        </StatGroup>
        <StatGroup title="Wholesale" color="#6b21a8" filterKey="wholesale" activeFilter={filter} onFilter={setFilter}>
          <MiniStat label="Deals" value={wholesale.length} color="#6b21a8" />
          <MiniStat label="NHC Comm" value={wholesaleComm>0?fmtK(wholesaleComm):'—'} color="#6b21a8" />
          {wholesaleFees > 0 && <MiniStat label="BPV Fees" value={fmtK(wholesaleFees)} color="#9ca3af" />}
        </StatGroup>
        <StatGroup title="Flips" color="#D97825" filterKey="flip" activeFilter={filter} onFilter={setFilter}>
          <MiniStat label="Active" value={activeFlips.length} color="#D97825" />
          <MiniStat label="Sold" value={closedFlips.length} />
          <MiniStat label="NHC Comm" value={flipComm>0?fmtK(flipComm):'—'} color="#D97825" />
        </StatGroup>
      </div>

      {/* Filter pills */}
      <div style={{ display:'flex', gap:4, marginBottom:14, flexWrap:'wrap' }}>
        {[
          ['all',  `All (${properties.length})`],
          ['listing',   `Listings (${listings.length})`],
          ['wholesale', `Wholesale (${wholesale.length})`],
          ['flip',      `Flips (${flips.length})`],
        ].map(([f,l])=>(
          <button key={f} onClick={()=>setFilter(f)} style={{ padding:'5px 14px', border:'none', borderRadius:4, cursor:'pointer', background:filter===f?'#2C2C2C':'#F0EDE6', color:filter===f?'#fff':'#6b7280', fontSize:11, fontWeight:filter===f?700:400, fontFamily:'inherit' }}>{l}</button>
        ))}
      </div>

      <SectionBar>Deals ({filtered.length})</SectionBar>

      {filtered.length === 0 ? (
        <EmptyState icon="○" text="No NHC deals yet. Add a property in the Analyzer and set the disposition to Listing, Wholesale, or Flip." />
      ) : (
        <Card style={{ padding:0 }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead><tr style={{ background:'#F0EDE6' }}>
              <SortTh sortKeyName="address" {...{sortKey,sortDir,toggleSort}}>Address</SortTh>
              <SortTh sortKeyName="type" {...{sortKey,sortDir,toggleSort}}>Type</SortTh>
              <SortTh sortKeyName="sale_price" {...{sortKey,sortDir,toggleSort}}>Sale Price</SortTh>
              <SortTh sortKeyName="commission_earned" {...{sortKey,sortDir,toggleSort}}>Commission</SortTh>
              <SortTh sortKeyName="source" {...{sortKey,sortDir,toggleSort}}>Source</SortTh>
              <SortTh sortKeyName="close_date" {...{sortKey,sortDir,toggleSort}}>Close Date</SortTh>
            </tr></thead>
            <tbody>
              {sorted.map((p,i) => {
                const src = mailings.find(m => m.id === p.mailing_id)
                const c = DISP_COLORS[p.disposition] || '#B8892A'
                const closeDate = p.disposition_date || p.sale_date
                return (
                  <tr key={p.id} onClick={()=>setDrawer(p)}
                    style={{ background:i%2===0?'#fff':'#FAFAF8', borderTop:'0.5px solid #F0EDE6', cursor:'pointer' }}
                    onMouseEnter={e=>e.currentTarget.style.background='#fef9f0'}
                    onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'#fff':'#FAFAF8'}>
                    <td style={{ padding:'10px 14px', fontSize:13, fontWeight:600 }}>
                      <div>{p.address}</div>
                      {p.package_id && (()=>{ const pkg=packages.find(pk=>pk.id===p.package_id); return pkg?<div style={{ fontSize:10, color:'#6b21a8', marginTop:2 }}>◫ {pkg.deal_name}</div>:null })()}
                    </td>
                    <td style={{ padding:'10px 14px' }}>
                      <Badge color={c}>{DISP_LABELS[p.disposition]||p.disposition}</Badge>
                    </td>
                    <td style={{ padding:'10px 14px', fontSize:13, fontFamily:'monospace' }}>{fmt(p.sale_price)||'—'}</td>
                    <td style={{ padding:'10px 14px', fontSize:13, fontFamily:'monospace', fontWeight:700, color:'#3B6D11' }}>{fmt(p.commission_earned)||'—'}</td>
                    <td style={{ padding:'10px 14px', fontSize:12, color:'#2D6FAF' }}>{src?.campaign_name?.replace(/^Campaign \d+ — /,'')||'—'}</td>
                    <td style={{ padding:'10px 14px', fontSize:12, color:'#6b7280' }}>{closeDate?new Date(closeDate+'T12:00:00').toLocaleDateString():'—'}</td>
                  </tr>
                )
              })}
            </tbody>
            {properties.length > 0 && (
              <tfoot><tr style={{ borderTop:'2px solid #D6D2CA', background:'#F0EDE6' }}>
                <td colSpan={3} style={{ padding:'8px 14px', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:0.8 }}>Total Commission</td>
                <td style={{ padding:'8px 14px', fontSize:14, fontFamily:'monospace', fontWeight:700, color:'#3B6D11' }}>{fmtK(totalComm)}</td>
                <td colSpan={2} />
              </tr></tfoot>
            )}
          </table>
        </Card>
      )}

      <PropertyDrawer property={drawer} open={!!drawer} onClose={()=>setDrawer(null)} onSave={()=>load()} mailings={mailings} />
    </PageWrap>
  )
}
