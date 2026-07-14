import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase.js'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { PageWrap, SectionBar, Card, Badge, EmptyState, LoadingSpinner, fmt, fmtK, useSort, SortTh } from '../components/ui.jsx'
import PropertyDrawer from '../components/PropertyDrawer.jsx'
import ProposalModal from '../components/ProposalModal.jsx'

const DISP_COLOR = { listing:'#3B6D11', flip:'#D97825', hold:'#B8892A', wholesale:'#6b21a8' }
const DISP_LABEL = { listing:'Listing', flip:'Flip', hold:'Hold Conv.', wholesale:'Wholesale' }

export default function Sold({ isAgentRole=false, currentUserEmail=null }) {
  const mobile = useIsMobile()
  const [properties, setProperties] = useState([])
  const [mailings,   setMailings]   = useState([])
  const [loading,    setLoading]    = useState(true)
  const [drawer,     setDrawer]     = useState(null)
  const [proposal,   setProposal]   = useState(null)
  const [filter,     setFilter]     = useState('all')
  const [yearFilter, setYearFilter] = useState('all')
  const [showYoY,    setShowYoY]    = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    let propQuery = supabase.from('cashoffer_properties').select('*').in('stage', ['Sold', 'Closed'])
    if (isAgentRole) propQuery = propQuery.eq('agent_email', currentUserEmail)
    propQuery = propQuery.order('sold_date', { ascending: false })
    const [{ data: p }, { data: m }] = await Promise.all([
      propQuery,
      supabase.from('cashoffer_mailings').select('id,campaign_name,drop_date'),
    ])
    setProperties(p || [])
    setMailings(m || [])
    setLoading(false)
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function closeDate(p) {
    return p.sold_date || p.disposition_date || p.conversion_date || null
  }

  function bpvProfit(p) {
    const rc   = parseFloat(p.rehab_cost) || 0
    const cost = (parseFloat(p.purchase_price)||0) + (parseFloat(p.closing_costs)||0) + rc
    const sale = parseFloat(p.sale_price) || 0
    return sale > 0 && cost > 0 ? sale - cost : null
  }

  function roi(p) {
    const cost = (parseFloat(p.purchase_price)||0) + (parseFloat(p.closing_costs)||0) + (parseFloat(p.rehab_cost)||0)
    const pr   = bpvProfit(p)
    return cost > 0 && pr !== null ? ((pr / cost) * 100) : null
  }

  // ── Segmentation ─────────────────────────────────────────────────────────────
  const listings  = properties.filter(p => p.disposition === 'listing')
  const flips     = properties.filter(p => p.disposition === 'flip')
  const holdsConv = properties.filter(p => p.disposition === 'hold' && p.converted_to_sale)
  const wholesale = properties.filter(p => p.disposition === 'wholesale')

  // ── Year list ────────────────────────────────────────────────────────────────
  const years = [...new Set(properties.map(p => {
    const d = closeDate(p)
    return d ? new Date(d + 'T12:00:00').getFullYear() : null
  }).filter(Boolean))].sort((a, b) => b - a)

  // ── Filtered set ─────────────────────────────────────────────────────────────
  let filtered = useMemo(() => {
    let base = filter === 'all'       ? properties
             : filter === 'listing'   ? listings
             : filter === 'flip'      ? flips
             : filter === 'hold'      ? holdsConv
             : filter === 'wholesale' ? wholesale
             : properties
    if (yearFilter !== 'all') {
      base = base.filter(p => {
        const d = closeDate(p)
        return d && new Date(d + 'T12:00:00').getFullYear() === parseInt(yearFilter)
      })
    }
    return base
  }, [properties, filter, yearFilter])

  // ── Aggregates on filtered set ───────────────────────────────────────────────
  const totalVolume     = filtered.reduce((s, p) => s + (parseFloat(p.sale_price)||0), 0)
  const totalCommission = filtered.reduce((s, p) => s + (parseFloat(p.commission_earned)||0), 0)
  const totalBpvProfit  = filtered.reduce((s, p) => s + (bpvProfit(p) || 0), 0)
  const totalWholesaleFee = filtered.reduce((s, p) => s + (parseFloat(p.wholesale_fee)||0), 0)

  // Avg DOM (listings only in filtered)
  const withDOM = filtered.filter(p => p.days_on_market)
  const avgDOM  = withDOM.length ? Math.round(withDOM.reduce((s, p) => s + p.days_on_market, 0) / withDOM.length) : null

  // Avg ROI (flips only in filtered)
  const withROI  = filtered.filter(p => roi(p) !== null)
  const avgROI   = withROI.length ? (withROI.reduce((s, p) => s + roi(p), 0) / withROI.length).toFixed(1) : null

  // ── Stat cards — dynamic by filter type ─────────────────────────────────────
  const statCards = useMemo(() => {
    if (filter === 'listing') return [
      { label:'Active Listings Sold', value: filtered.length,                                      color:'#3B6D11' },
      { label:'Total Volume',         value: totalVolume > 0 ? fmtK(totalVolume) : '—',             color:'#2D6FAF' },
      { label:'NHC Commission',       value: totalCommission > 0 ? fmtK(totalCommission) : '—',     color:'#3B6D11' },
      { label:'Avg Days on Market',   value: avgDOM !== null ? `${avgDOM}d` : '—',                   color:'#D97825' },
    ]
    if (filter === 'flip') return [
      { label:'Flips Completed',      value: filtered.length,                                      color:'#D97825' },
      { label:'Total Volume',         value: totalVolume > 0 ? fmtK(totalVolume) : '—',             color:'#2D6FAF' },
      { label:'BPV Profit',           value: totalBpvProfit !== 0 ? fmtK(totalBpvProfit) : '—',     color: totalBpvProfit >= 0 ? '#3B6D11' : '#B91C1C' },
      { label:'Avg ROI',              value: avgROI !== null ? `${avgROI}%` : '—',                   color: avgROI >= 0 ? '#3B6D11' : '#B91C1C' },
    ]
    if (filter === 'wholesale') return [
      { label:'Wholesale Deals',      value: filtered.length,                                      color:'#6b21a8' },
      { label:'BPV Fees',             value: totalWholesaleFee > 0 ? fmtK(totalWholesaleFee) : '—', color:'#6b21a8' },
      { label:'NHC Commission',       value: totalCommission > 0 ? fmtK(totalCommission) : '—',     color:'#3B6D11' },
      { label:'Total Revenue',        value: fmtK(totalCommission + totalWholesaleFee),              color:'#B8892A' },
    ]
    if (filter === 'hold') return [
      { label:'Holds Converted',      value: filtered.length,                                      color:'#B8892A' },
      { label:'Total Volume',         value: totalVolume > 0 ? fmtK(totalVolume) : '—',             color:'#2D6FAF' },
      { label:'BPV Profit',           value: totalBpvProfit !== 0 ? fmtK(totalBpvProfit) : '—',     color: totalBpvProfit >= 0 ? '#3B6D11' : '#B91C1C' },
      { label:'NHC Commission',       value: totalCommission > 0 ? fmtK(totalCommission) : '—',     color:'#3B6D11' },
    ]
    // All
    return [
      { label:'Properties Sold',      value: filtered.length,                                      color:'#2C2C2C' },
      { label:'Total Volume',         value: totalVolume > 0 ? fmtK(totalVolume) : '—',             color:'#2D6FAF' },
      { label:'NHC Commission',       value: totalCommission > 0 ? fmtK(totalCommission) : '—',     color:'#3B6D11' },
      { label:'BPV Profit',           value: totalBpvProfit !== 0 ? fmtK(totalBpvProfit) : '—',     color: totalBpvProfit >= 0 ? '#3B6D11' : '#B91C1C' },
    ]
  }, [filter, filtered, totalVolume, totalCommission, totalBpvProfit, totalWholesaleFee, avgDOM, avgROI])

  // ── Year-over-year breakdown ──────────────────────────────────────────────────
  const yoyData = useMemo(() => years.map(yr => {
    const base = filter === 'all' ? properties
               : filter === 'listing' ? listings
               : filter === 'flip'    ? flips
               : filter === 'hold'    ? holdsConv
               : wholesale
    const yr_props = base.filter(p => {
      const d = closeDate(p)
      return d && new Date(d + 'T12:00:00').getFullYear() === yr
    })
    return {
      year:       yr,
      count:      yr_props.length,
      volume:     yr_props.reduce((s, p) => s + (parseFloat(p.sale_price)||0), 0),
      commission: yr_props.reduce((s, p) => s + (parseFloat(p.commission_earned)||0), 0),
      profit:     yr_props.reduce((s, p) => s + (bpvProfit(p)||0), 0),
      fees:       yr_props.reduce((s, p) => s + (parseFloat(p.wholesale_fee)||0), 0),
    }
  }), [years, filter, properties])

  // ── Table sort ───────────────────────────────────────────────────────────────
  const { sorted, sortKey, sortDir, toggleSort } = useSort(filtered, 'close_date', 'desc', {
    close_date:  p => closeDate(p),
    profit:      p => bpvProfit(p),
    commission:  p => parseFloat(p.commission_earned) || null,
    roi:         p => roi(p),
    rehab:       p => parseFloat(p.rehab_cost) || null,
  })

  // ── Totals row (filtered) ────────────────────────────────────────────────────
  const filteredVolume     = filtered.reduce((s,p) => s+(parseFloat(p.sale_price)||0), 0)
  const filteredCommission = filtered.reduce((s,p) => s+(parseFloat(p.commission_earned)||0), 0)
  const filteredProfit     = filtered.reduce((s,p) => s+(bpvProfit(p)||0), 0)
  const filteredFees       = filtered.reduce((s,p) => s+(parseFloat(p.wholesale_fee)||0), 0)

  if (loading) return <LoadingSpinner />

  return (
    <PageWrap pad={!mobile}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, color:'#2C2C2C' }}>Sold</h1>
          <p style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>All closed properties · full P&amp;L history</p>
        </div>
      </div>

      {/* Dynamic stat cards */}
      <div style={{ display:'grid', gridTemplateColumns: mobile ? '1fr 1fr' : 'repeat(4,1fr)', gap:12, marginBottom:24 }}>
        {statCards.map(({ label, value, color }) => (
          <div key={label} style={{ background:'#fff', border:'0.5px solid #D6D2CA', borderRadius:8, borderTop:`3px solid ${color}`, padding:'12px 16px' }}>
            <div style={{ fontSize:10, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.8, marginBottom:6 }}>{label}</div>
            <div style={{ fontSize:24, fontWeight:700, color, fontFamily:'monospace' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filters row */}
      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
          {[
            ['all',       `All (${properties.length})`],
            ['listing',   `Listings (${listings.length})`],
            ['flip',      `Flips (${flips.length})`],
            ['hold',      `Holds Conv. (${holdsConv.length})`],
            ['wholesale', `Wholesale (${wholesale.length})`],
          ].map(([f, l]) => (
            <button key={f} onClick={() => { setFilter(f); setYearFilter('all') }}
              style={{ padding:'5px 14px', border:'none', borderRadius:4, cursor:'pointer',
                background: filter===f ? '#2C2C2C' : '#F0EDE6',
                color: filter===f ? '#fff' : '#6b7280',
                fontSize:11, fontWeight: filter===f ? 700 : 400, fontFamily:'inherit', whiteSpace:'nowrap' }}>
              {l}
            </button>
          ))}
        </div>

        {/* Year filter */}
        {years.length > 0 && (
          <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}
            style={{ padding:'5px 10px', border:'1px solid #D6D2CA', borderRadius:4, fontSize:11,
              fontFamily:'inherit', background:'#fff', color:'#2C2C2C', cursor:'pointer' }}>
            <option value="all">All Years</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        )}

        {/* YoY toggle */}
        {years.length > 1 && (
          <button onClick={() => setShowYoY(s => !s)}
            style={{ padding:'5px 14px', border:'1px solid #D6D2CA', borderRadius:4, cursor:'pointer',
              background: showYoY ? '#2C2C2C' : '#fff', color: showYoY ? '#fff' : '#6b7280',
              fontSize:11, fontWeight: showYoY ? 700 : 400, fontFamily:'inherit', whiteSpace:'nowrap' }}>
            {showYoY ? '▲ Hide Year Breakdown' : '▼ Year Breakdown'}
          </button>
        )}
      </div>

      {/* Year-over-year breakdown */}
      {showYoY && yoyData.length > 0 && (
        <Card style={{ padding:0, marginBottom:20 }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'#2C2C2C' }}>
                {['Year','Deals','Volume','NHC Commission','BPV Profit / Fees'].map(h => (
                  <th key={h} style={{ padding:'8px 14px', textAlign: h==='Year'||h==='Deals'?'left':'right',
                    fontSize:10, fontWeight:700, color:'#B8892A', textTransform:'uppercase', letterSpacing:0.8 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {yoyData.map((yr, i) => (
                <tr key={yr.year}
                  style={{ background: i%2===0?'#fff':'#FAFAF8', borderTop:'0.5px solid #F0EDE6',
                    cursor:'pointer',
                    fontWeight: String(yr.year) === String(yearFilter) ? 700 : 400 }}
                  onClick={() => setYearFilter(yearFilter === String(yr.year) ? 'all' : String(yr.year))}>
                  <td style={{ padding:'9px 14px', fontSize:13, fontWeight:700,
                    color: String(yr.year)===String(yearFilter)?'#B8892A':'#2C2C2C' }}>
                    {yr.year}{String(yr.year)===String(yearFilter)?' ✓':''}
                  </td>
                  <td style={{ padding:'9px 14px', fontSize:13 }}>{yr.count}</td>
                  <td style={{ padding:'9px 14px', fontSize:13, fontFamily:'monospace', textAlign:'right' }}>{yr.volume>0?fmtK(yr.volume):'—'}</td>
                  <td style={{ padding:'9px 14px', fontSize:13, fontFamily:'monospace', textAlign:'right', color:'#3B6D11', fontWeight:yr.commission>0?700:400 }}>{yr.commission>0?fmtK(yr.commission):'—'}</td>
                  <td style={{ padding:'9px 14px', fontSize:13, fontFamily:'monospace', textAlign:'right',
                    color: (yr.profit+yr.fees) >= 0 ? '#3B6D11' : '#B91C1C', fontWeight:700 }}>
                    {(yr.profit+yr.fees)!==0 ? `${(yr.profit+yr.fees)>=0?'+':''}${fmtK(yr.profit+yr.fees)}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background:'#F0EDE6', borderTop:'2px solid #D6D2CA' }}>
                <td style={{ padding:'8px 14px', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:0.8 }}>Total</td>
                <td style={{ padding:'8px 14px', fontSize:12, fontWeight:700 }}>{yoyData.reduce((s,y)=>s+y.count,0)}</td>
                <td style={{ padding:'8px 14px', fontSize:13, fontFamily:'monospace', textAlign:'right', fontWeight:700 }}>{fmtK(yoyData.reduce((s,y)=>s+y.volume,0))}</td>
                <td style={{ padding:'8px 14px', fontSize:13, fontFamily:'monospace', textAlign:'right', fontWeight:700, color:'#3B6D11' }}>{fmtK(yoyData.reduce((s,y)=>s+y.commission,0))}</td>
                <td style={{ padding:'8px 14px', fontSize:13, fontFamily:'monospace', textAlign:'right', fontWeight:700,
                  color: yoyData.reduce((s,y)=>s+y.profit+y.fees,0)>=0?'#3B6D11':'#B91C1C' }}>
                  {fmtK(yoyData.reduce((s,y)=>s+y.profit+y.fees,0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </Card>
      )}

      <SectionBar>Sold Properties ({filtered.length}){yearFilter!=='all'?` — ${yearFilter}`:''}</SectionBar>

      {filtered.length === 0 ? (
        <EmptyState icon="○" text="No sold properties match this filter." />
      ) : (
        <Card style={{ padding:0 }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'#F0EDE6' }}>
                <SortTh sortKeyName="address"     {...{sortKey,sortDir,toggleSort}}>Address</SortTh>
                <SortTh sortKeyName="disposition" {...{sortKey,sortDir,toggleSort}}>Type</SortTh>
                <SortTh sortKeyName="owner"       {...{sortKey,sortDir,toggleSort}}>Owner</SortTh>
                <SortTh sortKeyName="sale_price"  {...{sortKey,sortDir,toggleSort}}>Sale Price</SortTh>
                {(filter==='all'||filter==='flip'||filter==='hold') && (
                  <SortTh sortKeyName="rehab"   {...{sortKey,sortDir,toggleSort}}>Rehab</SortTh>
                )}
                <SortTh sortKeyName="commission"  {...{sortKey,sortDir,toggleSort}}>NHC Comm</SortTh>
                {filter !== 'listing' && (
                  <SortTh sortKeyName="profit"  {...{sortKey,sortDir,toggleSort}}>BPV P&L</SortTh>
                )}
                {(filter==='all'||filter==='listing') && (
                  <SortTh sortKeyName="roi" {...{sortKey,sortDir,toggleSort}}>DOM</SortTh>
                )}
                <SortTh sortKeyName="close_date"  {...{sortKey,sortDir,toggleSort}}>Close Date</SortTh>
                <th style={{ padding:'8px 14px' }}></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, i) => {
                const pr   = bpvProfit(p)
                const r    = roi(p)
                const cd   = closeDate(p)
                const dc   = DISP_COLOR[p.disposition] || '#9ca3af'
                const dl   = DISP_LABEL[p.disposition] || p.disposition
                const showRehab  = filter==='all'||filter==='flip'||filter==='hold'
                const showProfit = filter !== 'listing'
                const showDOM    = filter==='all'||filter==='listing'
                return (
                  <tr key={p.id} onClick={() => setDrawer(p)}
                    style={{ background:i%2===0?'#fff':'#FAFAF8', borderTop:'0.5px solid #F0EDE6', cursor:'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background='#fef9f0'}
                    onMouseLeave={e => e.currentTarget.style.background=i%2===0?'#fff':'#FAFAF8'}>
                    <td style={{ padding:'10px 14px', fontSize:13, fontWeight:600 }}>
                      <div>{p.address?.split(',')[0]}</div>
                      <div style={{ fontSize:10, color:'#9ca3af', marginTop:1 }}>{p.address?.split(',').slice(1,3).join(',').trim()}</div>
                    </td>
                    <td style={{ padding:'10px 14px' }}>
                      <Badge color={dc}>{dl}</Badge>
                    </td>
                    <td style={{ padding:'10px 14px', fontSize:12, color:'#6b7280' }}>{p.owner || 'BPV'}</td>
                    <td style={{ padding:'10px 14px', fontSize:13, fontFamily:'monospace' }}>{fmt(p.sale_price) || '—'}</td>
                    {showRehab && (
                      <td style={{ padding:'10px 14px', fontSize:13, fontFamily:'monospace', color:'#6b7280' }}>
                        {fmt(p.rehab_cost) || '—'}
                      </td>
                    )}
                    <td style={{ padding:'10px 14px', fontSize:13, fontFamily:'monospace', fontWeight:700, color:'#3B6D11' }}>
                      {fmt(p.commission_earned) || '—'}
                    </td>
                    {showProfit && (
                      <td style={{ padding:'10px 14px', fontSize:13, fontFamily:'monospace', fontWeight: pr!==null?700:400,
                        color: pr===null?'#9ca3af':pr>=0?'#3B6D11':'#B91C1C' }}>
                        {p.disposition==='wholesale'
                          ? (fmt(p.wholesale_fee)||'—')
                          : pr!==null ? `${pr>=0?'+':''}${fmt(pr)}${r!==null?` (${r.toFixed(0)}%)`:''}`
                          : '—'}
                      </td>
                    )}
                    {showDOM && (
                      <td style={{ padding:'10px 14px', fontSize:13, fontFamily:'monospace',
                        color: p.days_on_market > 60 ? '#B91C1C' : '#6b7280' }}>
                        {p.days_on_market ? `${p.days_on_market}d` : '—'}
                      </td>
                    )}
                    <td style={{ padding:'10px 14px', fontSize:12, color:'#9ca3af', whiteSpace:'nowrap' }}>
                      {cd ? new Date(cd + 'T12:00:00').toLocaleDateString() : '—'}
                    </td>
                    <td style={{ padding:'10px 10px' }} onClick={e => e.stopPropagation()}>
                      {p.arv && (
                        <button onClick={() => setProposal(p)}
                          style={{ background:'#2D6FAF', color:'#fff', border:'none', borderRadius:4,
                            padding:'4px 10px', fontSize:11, fontWeight:600, cursor:'pointer',
                            fontFamily:'inherit', whiteSpace:'nowrap' }}>
                          Offer PDF
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr style={{ borderTop:'2px solid #D6D2CA', background:'#F0EDE6' }}>
                  <td colSpan={3} style={{ padding:'8px 14px', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:0.8 }}>
                    Totals{yearFilter!=='all'?` (${yearFilter})`:''}
                  </td>
                  <td style={{ padding:'8px 14px', fontSize:13, fontFamily:'monospace', fontWeight:700 }}>{fmtK(filteredVolume)}</td>
                  {(filter==='all'||filter==='flip'||filter==='hold') && <td />}
                  <td style={{ padding:'8px 14px', fontSize:13, fontFamily:'monospace', fontWeight:700, color:'#3B6D11' }}>{fmtK(filteredCommission)}</td>
                  {filter !== 'listing' && (
                    <td style={{ padding:'8px 14px', fontSize:13, fontFamily:'monospace', fontWeight:700,
                      color: (filteredProfit+filteredFees)>=0?'#3B6D11':'#B91C1C' }}>
                      {filter==='wholesale' ? fmtK(filteredFees) : `${filteredProfit>=0?'+':''}${fmtK(filteredProfit)}`}
                    </td>
                  )}
                  {(filter==='all'||filter==='listing') && <td />}
                  <td /><td />
                </tr>
              </tfoot>
            )}
          </table>
        </Card>
      )}

      <PropertyDrawer property={drawer} open={!!drawer} onClose={() => setDrawer(null)} onSave={() => load()} mailings={mailings} onViewOffer={p => setProposal(p)} initialTab="disposition" isAgentRole={isAgentRole} currentUserEmail={currentUserEmail} />
      {proposal && <ProposalModal property={proposal} onClose={() => setProposal(null)} />}
    </PageWrap>
  )
}

