import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { PageWrap, SectionBar, Card, Badge, EmptyState, LoadingSpinner, fmt, fmtK, useSort, SortTh } from '../components/ui.jsx'
import PropertyDrawer from '../components/PropertyDrawer.jsx'

const DISP_COLOR = { listing:'#3B6D11', flip:'#D97825', hold:'#B8892A', wholesale:'#6b21a8' }
const DISP_LABEL = { listing:'Listing', flip:'Flip', hold:'Hold (Conv.)', wholesale:'Wholesale' }

export default function Sold() {
  const mobile = useIsMobile()
  const [properties, setProperties] = useState([])
  const [mailings, setMailings] = useState([])
  const [loading, setLoading] = useState(true)
  const [drawer, setDrawer] = useState(null)
  const [filter, setFilter] = useState('all')
  const [yearFilter, setYearFilter] = useState('all')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: p }, { data: m }] = await Promise.all([
      // Sold = has a sold_date, OR a disposition_date (listings), OR converted_to_sale
      supabase.from('cashoffer_properties').select('*')
        .or('sold_date.not.is.null,disposition_date.not.is.null,converted_to_sale.eq.true')
        .order('sold_date', { ascending: false }),
      supabase.from('cashoffer_mailings').select('id,campaign_name,drop_date'),
    ])
    setProperties(p || [])
    setMailings(m || [])
    setLoading(false)
  }

  // Resolve the best "close date" per property
  function closeDate(p) {
    return p.sold_date || p.disposition_date || p.conversion_date || null
  }

  // Profit calc per property
  function profit(p) {
    const cost = (parseFloat(p.purchase_price)||0) + (parseFloat(p.closing_costs)||0) + (parseFloat(p.rehab_cost)||0)
    const saleP = parseFloat(p.sale_price) || 0
    return saleP > 0 && cost > 0 ? saleP - cost : null
  }

  const years = [...new Set(properties.map(p => {
    const d = closeDate(p)
    return d ? new Date(d).getFullYear() : null
  }).filter(Boolean))].sort((a,b) => b - a)

  const byDisp = disp => properties.filter(p => p.disposition === disp)
  const listings  = byDisp('listing')
  const flips     = byDisp('flip')
  const holds     = properties.filter(p => p.disposition === 'hold' && p.converted_to_sale)
  const wholesale = byDisp('wholesale')

  const totalVolume     = properties.reduce((s,p) => s + (parseFloat(p.sale_price)||0), 0)
  const totalCommission = properties.reduce((s,p) => s + (parseFloat(p.commission_earned)||0), 0)
  const totalProfit     = properties.reduce((s,p) => s + (profit(p)||0), 0)

  let filtered = filter === 'all' ? properties : properties.filter(p => {
    if (filter === 'hold') return p.disposition === 'hold' && p.converted_to_sale
    return p.disposition === filter
  })
  if (yearFilter !== 'all') {
    filtered = filtered.filter(p => {
      const d = closeDate(p)
      return d && new Date(d).getFullYear() === parseInt(yearFilter)
    })
  }

  const { sorted, sortKey, sortDir, toggleSort } = useSort(filtered, 'sold_date', 'desc', {
    close_date: p => closeDate(p),
    profit: p => profit(p),
    commission: p => parseFloat(p.commission_earned) || null,
  })

  if (loading) return <LoadingSpinner />

  return (
    <PageWrap pad={!mobile}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, color:'#2C2C2C' }}>Sold</h1>
          <p style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>All closed properties · full P&amp;L history</p>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display:'grid', gridTemplateColumns: mobile ? '1fr 1fr' : 'repeat(4,1fr)', gap:12, marginBottom:24 }}>
        {[
          { label:'Properties Sold',  value: properties.length,                              color:'#2C2C2C' },
          { label:'Total Volume',     value: totalVolume > 0 ? fmtK(totalVolume) : '—',       color:'#2D6FAF' },
          { label:'NHC Commission',   value: totalCommission > 0 ? fmtK(totalCommission) : '—', color:'#3B6D11' },
          { label:'BPV Profit',       value: totalProfit !== 0 ? fmtK(totalProfit) : '—',     color: totalProfit >= 0 ? '#3B6D11' : '#B91C1C' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background:'#fff', border:'0.5px solid #D6D2CA', borderRadius:8, borderTop:`3px solid ${color}`, padding:'12px 16px' }}>
            <div style={{ fontSize:10, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.8, marginBottom:6 }}>{label}</div>
            <div style={{ fontSize:24, fontWeight:700, color, fontFamily:'monospace' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
          {[
            ['all',      `All (${properties.length})`],
            ['listing',  `Listings (${listings.length})`],
            ['flip',     `Flips (${flips.length})`],
            ['hold',     `Holds Conv. (${holds.length})`],
            ['wholesale',`Wholesale (${wholesale.length})`],
          ].map(([f,l])=>(
            <button key={f} onClick={()=>setFilter(f)} style={{ padding:'5px 14px', border:'none', borderRadius:4, cursor:'pointer', background:filter===f?'#2C2C2C':'#F0EDE6', color:filter===f?'#fff':'#6b7280', fontSize:11, fontWeight:filter===f?700:400, fontFamily:'inherit', whiteSpace:'nowrap' }}>{l}</button>
          ))}
        </div>
        {years.length > 0 && (
          <select value={yearFilter} onChange={e=>setYearFilter(e.target.value)} style={{ padding:'5px 10px', border:'1px solid #D6D2CA', borderRadius:4, fontSize:11, fontFamily:'inherit', background:'#fff', color:'#2C2C2C', cursor:'pointer' }}>
            <option value="all">All Years</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
      </div>

      <SectionBar>Sold Properties ({filtered.length})</SectionBar>

      {filtered.length === 0 ? (
        <EmptyState icon="○" text="No sold properties yet." />
      ) : (
        <Card style={{ padding:0 }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'#F0EDE6' }}>
                <SortTh sortKeyName="address"    {...{sortKey,sortDir,toggleSort}}>Address</SortTh>
                <SortTh sortKeyName="disposition"  {...{sortKey,sortDir,toggleSort}}>Type</SortTh>
                <SortTh sortKeyName="sale_price" {...{sortKey,sortDir,toggleSort}}>Sale Price</SortTh>
                <SortTh sortKeyName="commission" {...{sortKey,sortDir,toggleSort}}>NHC Comm</SortTh>
                <SortTh sortKeyName="profit"     {...{sortKey,sortDir,toggleSort}}>BPV Profit</SortTh>
                <SortTh sortKeyName="close_date" {...{sortKey,sortDir,toggleSort}}>Close Date</SortTh>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, i) => {
                const pr = profit(p)
                const cd = closeDate(p)
                const dispColor = DISP_COLOR[p.disposition] || '#9ca3af'
                const dispLabel = DISP_LABEL[p.disposition] || p.disposition
                return (
                  <tr key={p.id} onClick={() => setDrawer(p)}
                    style={{ background:i%2===0?'#fff':'#FAFAF8', borderTop:'0.5px solid #F0EDE6', cursor:'pointer' }}
                    onMouseEnter={e=>e.currentTarget.style.background='#fef9f0'}
                    onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'#fff':'#FAFAF8'}>
                    <td style={{ padding:'10px 14px', fontSize:13, fontWeight:600 }}>{p.address}</td>
                    <td style={{ padding:'10px 14px' }}>
                      <Badge color={dispColor}>{dispLabel}</Badge>
                    </td>
                    <td style={{ padding:'10px 14px', fontSize:13, fontFamily:'monospace' }}>{fmt(p.sale_price) || '—'}</td>
                    <td style={{ padding:'10px 14px', fontSize:13, fontFamily:'monospace', color:'#3B6D11', fontWeight: p.commission_earned ? 700 : 400 }}>{fmt(p.commission_earned) || '—'}</td>
                    <td style={{ padding:'10px 14px', fontSize:13, fontFamily:'monospace', fontWeight: pr !== null ? 700 : 400, color: pr === null ? '#9ca3af' : pr >= 0 ? '#3B6D11' : '#B91C1C' }}>
                      {pr !== null ? `${pr >= 0 ? '+' : ''}${fmt(pr)}` : '—'}
                    </td>
                    <td style={{ padding:'10px 14px', fontSize:12, color:'#9ca3af' }}>
                      {cd ? new Date(cd+'T12:00:00').toLocaleDateString() : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop:'2px solid #D6D2CA', background:'#F0EDE6' }}>
                <td colSpan={2} style={{ padding:'8px 14px', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:0.8 }}>Totals</td>
                <td style={{ padding:'8px 14px', fontSize:13, fontFamily:'monospace', fontWeight:700 }}>{fmtK(totalVolume)}</td>
                <td style={{ padding:'8px 14px', fontSize:13, fontFamily:'monospace', fontWeight:700, color:'#3B6D11' }}>{fmtK(totalCommission)}</td>
                <td style={{ padding:'8px 14px', fontSize:13, fontFamily:'monospace', fontWeight:700, color: totalProfit >= 0 ? '#3B6D11' : '#B91C1C' }}>{fmtK(totalProfit)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </Card>
      )}

      <PropertyDrawer property={drawer} open={!!drawer} onClose={() => setDrawer(null)} onSave={() => load()} mailings={mailings} />
    </PageWrap>
  )
}
