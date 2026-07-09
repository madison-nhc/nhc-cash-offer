import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { PageWrap, SectionBar, Card, Badge, EmptyState, LoadingSpinner, fmt, fmtK, useSort, SortTh } from '../components/ui.jsx'
import PropertyDrawer from '../components/PropertyDrawer.jsx'
import ProposalModal from '../components/ProposalModal.jsx'

export default function Wholesale() {
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
      supabase.from('cashoffer_properties').select('*').eq('type', 'Wholesale').neq('stage', 'Cancelled').order('disposition_date', { ascending: false }),
      supabase.from('cashoffer_mailings').select('id,campaign_name,drop_date').order('drop_date', { ascending: false }),
    ])
    setProperties(p || [])
    setMailings(m || [])
    setLoading(false)
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
                <tr key={p.id} onClick={() => setDrawer(p)}
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

      <PropertyDrawer property={drawer} open={!!drawer} onClose={() => setDrawer(null)} onSave={() => load()} mailings={mailings} onViewOffer={p => setProposal(p)} />
      {proposal && <ProposalModal property={proposal} onClose={() => setProposal(null)} />}
    </PageWrap>
  )
}

