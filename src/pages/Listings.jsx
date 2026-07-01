import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { PageWrap, SectionBar, Card, EmptyState, LoadingSpinner, fmt, fmtK, useSort, SortTh } from '../components/ui.jsx'
import PropertyDrawer from '../components/PropertyDrawer.jsx'
import ProposalModal from '../components/ProposalModal.jsx'

export default function Listings() {
  const mobile = useIsMobile()
  const [properties, setProperties] = useState([])
  const [mailings, setMailings] = useState([])
  const [loading, setLoading] = useState(true)
  const [drawer, setDrawer] = useState(null)
  const [proposal, setProposal] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: p }, { data: m }] = await Promise.all([
      // Active listings only — no sold_date and no disposition_date
      supabase.from('cashoffer_properties').select('*').eq('stage', 'Active Listing').order('list_date', { ascending: false }),
      supabase.from('cashoffer_mailings').select('id,campaign_name,drop_date').order('drop_date', { ascending: false }),
    ])
    setProperties(p || [])
    setMailings(m || [])
    setLoading(false)
  }

  const totalCommission = properties.reduce((s, p) => s + (parseFloat(p.commission_earned) || 0), 0)
  const withARV = properties.filter(p => p.arv)
  const totalVolume = properties.reduce((s, p) => s + (parseFloat(p.arv) || 0), 0)

  const { sorted, sortKey, sortDir, toggleSort } = useSort(properties, 'list_date', 'desc', {
    commission: p => parseFloat(p.commission_earned) || null,
    dom: p => p.days_on_market || null,
    arv: p => parseFloat(p.arv) || null,
  })

  if (loading) return <LoadingSpinner />

  return (
    <PageWrap pad={!mobile}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, color:'#2C2C2C' }}>Listings</h1>
          <p style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>Active NHC listings · commission tracking</p>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display:'grid', gridTemplateColumns: mobile ? '1fr 1fr' : 'repeat(3,1fr)', gap:12, marginBottom:24 }}>
        {[
          { label:'Active Listings',  value: properties.length,                                   color:'#3B6D11' },
          { label:'Active Volume',    value: totalVolume > 0 ? fmtK(totalVolume) : '—',            color:'#2D6FAF', sub:'based on ARV' },
          { label:'Commission',       value: totalCommission > 0 ? fmtK(totalCommission) : '—',    color:'#B8892A' },
        ].map(({ label, value, color, sub }) => (
          <div key={label} style={{ background:'#fff', border:'0.5px solid #D6D2CA', borderRadius:8, borderTop:`3px solid ${color}`, padding:'12px 16px' }}>
            <div style={{ fontSize:10, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.8, marginBottom:6 }}>{label}</div>
            <div style={{ fontSize:24, fontWeight:700, color, fontFamily:'monospace' }}>{value}</div>
            {sub && <div style={{ fontSize:10, color:'#9ca3af', marginTop:3 }}>{sub}</div>}
          </div>
        ))}
      </div>

      <SectionBar>Active Listings ({properties.length})</SectionBar>

      {properties.length === 0 ? (
        <EmptyState icon="○" text="No active listings. Set disposition to Listing on a property in the Analyzer." />
      ) : (
        <Card style={{ padding:0 }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'#F0EDE6' }}>
                <SortTh sortKeyName="address"    {...{sortKey,sortDir,toggleSort}}>Address</SortTh>
                <SortTh sortKeyName="list_date"  {...{sortKey,sortDir,toggleSort}}>List Date</SortTh>
                <SortTh sortKeyName="arv"        {...{sortKey,sortDir,toggleSort}}>ARV</SortTh>
                <SortTh sortKeyName="commission" {...{sortKey,sortDir,toggleSort}}>Commission</SortTh>
                <SortTh sortKeyName="dom"        {...{sortKey,sortDir,toggleSort}}>DOM</SortTh>
                <SortTh sortKeyName="lead_type"  {...{sortKey,sortDir,toggleSort}}>Source</SortTh>
                <th style={{ padding:'8px 14px' }}></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, i) => (
                <tr key={p.id} onClick={() => setDrawer(p)}
                  style={{ background: i % 2 === 0 ? '#fff' : '#FAFAF8', borderTop:'0.5px solid #F0EDE6', cursor:'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#fef9f0'}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#FAFAF8'}>
                  <td style={{ padding:'10px 14px', fontSize:13, fontWeight:600 }}>
                    <div>{p.address}</div>
                    <div style={{ fontSize:11, color:'#9ca3af', marginTop:1 }}>
                      {[p.beds && `${p.beds}bd`, p.baths && `${p.baths}ba`, p.sqft && `${parseInt(p.sqft).toLocaleString()}sf`].filter(Boolean).join(' · ')}
                    </div>
                  </td>
                  <td style={{ padding:'10px 14px', fontSize:12, color:'#6b7280' }}>
                    {p.list_date ? new Date(p.list_date + 'T12:00:00').toLocaleDateString() : '—'}
                  </td>
                  <td style={{ padding:'10px 14px', fontSize:13, fontFamily:'monospace' }}>{fmt(p.arv) || '—'}</td>
                  <td style={{ padding:'10px 14px', fontSize:13, fontFamily:'monospace', fontWeight:700, color:'#3B6D11' }}>{fmt(p.commission_earned) || '—'}</td>
                  <td style={{ padding:'10px 14px', fontSize:13, fontFamily:'monospace', color: p.days_on_market > 60 ? '#B91C1C' : '#6b7280' }}>
                    {p.days_on_market ? `${p.days_on_market}d` : '—'}
                  </td>
                  <td style={{ padding:'10px 14px', fontSize:12, color:'#6b7280' }}>{p.lead_type || '—'}</td>
                  <td style={{ padding:'10px 10px' }} onClick={e => e.stopPropagation()}>
                    {p.arv && (
                      <button onClick={() => setProposal(p)} style={{ background:'#2D6FAF', color:'#fff', border:'none', borderRadius:4, padding:'4px 10px', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                        Offer PDF
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {totalCommission > 0 && (
              <tfoot>
                <tr style={{ borderTop:'2px solid #D6D2CA', background:'#F0EDE6' }}>
                  <td colSpan={3} style={{ padding:'8px 14px', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:0.8 }}>Total Commission</td>
                  <td style={{ padding:'8px 14px', fontSize:14, fontFamily:'monospace', fontWeight:700, color:'#3B6D11' }}>{fmtK(totalCommission)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        </Card>
      )}

      <PropertyDrawer property={drawer} open={!!drawer} onClose={() => setDrawer(null)} onSave={() => load()} mailings={mailings} onViewOffer={p => setProposal(p)} />
      {proposal && <ProposalModal property={proposal} onClose={() => setProposal(null)} />}
    </PageWrap>
  )
}
