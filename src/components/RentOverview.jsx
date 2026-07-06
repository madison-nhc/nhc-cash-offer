import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { fmt } from './ui.jsx'

export default function RentOverview({ propertyId, onOpenFull }) {
  const [lease, setLease]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [hover, setHover]     = useState(false)

  useEffect(() => { if (propertyId) load() }, [propertyId])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('cashoffer_leases')
      .select('*')
      .eq('property_id', propertyId)
      .order('lease_start', { ascending: false })
      .limit(5)
    const active = (data||[]).find(l=>l.status==='Active') || data?.[0] || null
    setLease(active)
    setLoading(false)
  }

  if (loading) return <div style={{ textAlign:'center', padding:20, color:'#9ca3af', fontSize:12 }}>Loading…</div>

  if (!lease) {
    return (
      <div style={{ background:'#F0EDE6', borderRadius:8, padding:20, textAlign:'center' }}>
        <div style={{ fontSize:13, color:'#6b7280', marginBottom:12 }}>No lease recorded for this property.</div>
        <button onClick={onOpenFull} style={{
          background:'#3B6D11', color:'#fff', border:'none', borderRadius:8, padding:'10px 18px',
          fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit',
        }}>
          + Add Lease
        </button>
      </div>
    )
  }

  const rows = [
    { label:'Tenant',       value: lease.tenant_name || '—' },
    { label:'Status',       value: lease.status || '—' },
    { label:'Rent Amount',  value: fmt(lease.rent_amount) || '—' },
    { label:'Deposit',      value: lease.deposit_amount ? fmt(lease.deposit_amount) : '—' },
    { label:'Lease Start',  value: lease.lease_start ? new Date(lease.lease_start+'T12:00:00').toLocaleDateString('en-US',{month:'short', day:'numeric', year:'numeric'}) : '—' },
    { label:'Lease End',    value: lease.lease_end ? new Date(lease.lease_end+'T12:00:00').toLocaleDateString('en-US',{month:'short', day:'numeric', year:'numeric'}) : '—' },
  ]

  return (
    <div
      onClick={onOpenFull}
      onMouseEnter={()=>setHover(true)}
      onMouseLeave={()=>setHover(false)}
      style={{
        background:'#FAFAF8',
        border: hover ? '1.5px solid #3B6D11' : '0.5px solid #D6D2CA',
        borderRadius:8, padding:'14px 16px', cursor:'pointer',
        transition:'border-color 0.15s',
      }}
    >
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
        <div style={{ fontSize:14, fontWeight:700, color:'#2C2C2C' }}>
          {lease.tenant_name || 'Unnamed Tenant'}
        </div>
        <span style={{ fontSize:16, color:'#3B6D11' }}>→</span>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        {rows.map(({ label, value }) => (
          <div key={label}>
            <div style={{ fontSize:9, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.7, marginBottom:2 }}>{label}</div>
            <div style={{ fontSize:13, fontWeight:600, color:'#2C2C2C', fontFamily: label==='Tenant' || label==='Status' ? 'inherit' : 'monospace' }}>{value}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize:11, color:'#9ca3af', marginTop:10, textAlign:'right' }}>
        Click for lease terms, payment log & collected vs. expected
      </div>
    </div>
  )
}
