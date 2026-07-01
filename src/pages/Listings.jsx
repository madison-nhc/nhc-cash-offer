import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { PageWrap, SectionBar, Card, Badge, EmptyState, LoadingSpinner, fmt, fmtK, useSort, SortTh } from '../components/ui.jsx'
import PropertyDrawer from '../components/PropertyDrawer.jsx'

function MiniStat({ label, value, sub, color = '#2C2C2C' }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
      <div style={{ fontSize:10, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.7 }}>{label}</div>
      <div style={{ fontSize:22, fontWeight:700, fontFamily:'monospace', color }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize:10, color:'#9ca3af' }}>{sub}</div>}
    </div>
  )
}

export default function Listings() {
  const mobile = useIsMobile()
  const [properties, setProperties] = useState([])
  const [mailings, setMailings] = useState([])
  const [loading, setLoading] = useState(true)
  const [drawer, setDrawer] = useState(null)
  const [filter, setFilter] = useState('active')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: p }, { data: m }] = await Promise.all([
      supabase.from('cashoffer_properties').select('*').eq('disposition', 'listing').order('list_date', { ascending: false }),
      supabase.from('cashoffer_mailings').select('id,campaign_name,drop_date').order('drop_date', { ascending: false }),
    ])
    setProperties(p || [])
    setMailings(m || [])
    setLoading(false)
  }

  const active = properties.filter(p => !p.sold_date && !p.disposition_date)
  const sold   = properties.filter(p =>  p.sold_date ||  p.disposition_date)

  const totalCommission = properties.reduce((s, p) => s + (parseFloat(p.commission_earned) || 0), 0)
  const totalVolume     = sold.reduce((s, p) => s + (parseFloat(p.sale_price) || 0), 0)
  const avgDOM = (() => {
    const withDOM = sold.filter(p => p.days_on_market)
    return withDOM.length ? Math.round(withDOM.reduce((s, p) => s + p.days_on_market, 0) / withDOM.length) : null
  })()

  const filtered = filter === 'active' ? active : filter === 'sold' ? sold : properties

  const { sorted, sortKey, sortDir, toggleSort } = useSort(filtered, 'list_date', 'desc', {
    commission: p => parseFloat(p.commission_earned) || null,
    dom: p => p.days_on_market || null,
  })

  if (loading) return <LoadingSpinner />

  return (
    <PageWrap pad={!mobile}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, color:'#2C2C2C' }}>Listings</h1>
          <p style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>NHC listed properties · commission tracking</p>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display:'grid', gridTemplateColumns: mobile ? '1fr 1fr' : 'repeat(4,1fr)', gap:12, marginBottom:24 }}>
        {[
          { label:'Active Listings', value: active.length,                                         color:'#3B6D11' },
          { label:'Sold',            value: sold.length,                                            color:'#2C2C2C' },
          { label:'Commission',      value: totalCommission > 0 ? fmtK(totalCommission) : '—',      color:'#B8892A' },
          { label:'Avg Days on Mkt', value: avgDOM !== null ? `${avgDOM}d` : '—',                   color:'#2D6FAF' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background:'#fff', border:'0.5px solid #D6D2CA', borderRadius:8, borderTop:`3px solid ${color}`, padding:'12px 16px' }}>
            <div style={{ fontSize:10, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.8, marginBottom:6 }}>{label}</div>
            <div style={{ fontSize:24, fontWeight:700, color, fontFamily:'monospace' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filter pills */}
      <div style={{ display:'flex', gap:4, marginBottom:14 }}>
        {[['active',`Active (${active.length})`],['sold',`Sold (${sold.length})`],['all',`All (${properties.length})`]].map(([f,l])=>(
          <button key={f} onClick={()=>setFilter(f)} style={{ padding:'5px 14px', border:'none', borderRadius:4, cursor:'pointer', background:filter===f?'#2C2C2C':'#F0EDE6', color:filter===f?'#fff':'#6b7280', fontSize:11, fontWeight:filter===f?700:400, fontFamily:'inherit' }}>{l}</button>
        ))}
      </div>

      <SectionBar>Listings ({filtered.length})</SectionBar>

      {filtered.length === 0 ? (
        <EmptyState icon="○" text="No listings yet. Set disposition to Listing on a property in the Analyzer." />
      ) : (
        <Card style={{ padding:0 }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'#F0EDE6' }}>
                <SortTh sortKeyName="address"          {...{sortKey,sortDir,toggleSort}}>Address</SortTh>
                <SortTh sortKeyName="list_date"        {...{sortKey,sortDir,toggleSort}}>List Date</SortTh>
                <SortTh sortKeyName="sale_price"       {...{sortKey,sortDir,toggleSort}}>Sale Price</SortTh>
                <SortTh sortKeyName="commission"       {...{sortKey,sortDir,toggleSort}}>Commission</SortTh>
                <SortTh sortKeyName="dom"              {...{sortKey,sortDir,toggleSort}}>DOM</SortTh>
                <SortTh sortKeyName="lead_type"        {...{sortKey,sortDir,toggleSort}}>Source</SortTh>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, i) => {
                const isSold = !!(p.sold_date || p.disposition_date)
                return (
                  <tr key={p.id} onClick={() => setDrawer(p)}
                    style={{ background:i%2===0?'#fff':'#FAFAF8', borderTop:'0.5px solid #F0EDE6', cursor:'pointer' }}
                    onMouseEnter={e=>e.currentTarget.style.background='#fef9f0'}
                    onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'#fff':'#FAFAF8'}>
                    <td style={{ padding:'10px 14px', fontSize:13, fontWeight:600 }}>
                      <div>{p.address}</div>
                      <div style={{ fontSize:11, color: isSold?'#9ca3af':'#3B6D11', fontWeight:600, marginTop:2 }}>{isSold ? 'Sold' : 'Active'}</div>
                    </td>
                    <td style={{ padding:'10px 14px', fontSize:12, color:'#6b7280' }}>
                      {p.list_date ? new Date(p.list_date+'T12:00:00').toLocaleDateString() : '—'}
                    </td>
                    <td style={{ padding:'10px 14px', fontSize:13, fontFamily:'monospace' }}>{fmt(p.sale_price) || '—'}</td>
                    <td style={{ padding:'10px 14px', fontSize:13, fontFamily:'monospace', fontWeight:700, color:'#3B6D11' }}>{fmt(p.commission_earned) || '—'}</td>
                    <td style={{ padding:'10px 14px', fontSize:13, fontFamily:'monospace', color: p.days_on_market > 60?'#B91C1C':'#6b7280' }}>
                      {p.days_on_market ? `${p.days_on_market}d` : '—'}
                    </td>
                    <td style={{ padding:'10px 14px', fontSize:12, color:'#6b7280' }}>{p.lead_type || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
            {properties.length > 0 && (
              <tfoot>
                <tr style={{ borderTop:'2px solid #D6D2CA', background:'#F0EDE6' }}>
                  <td colSpan={3} style={{ padding:'8px 14px', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:0.8 }}>Total Commission</td>
                  <td style={{ padding:'8px 14px', fontSize:14, fontFamily:'monospace', fontWeight:700, color:'#3B6D11' }}>{fmtK(totalCommission)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </Card>
      )}

      <PropertyDrawer property={drawer} open={!!drawer} onClose={() => setDrawer(null)} onSave={() => load()} mailings={mailings} />
    </PageWrap>
  )
}
