import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { fmt } from './ui.jsx'

const PAID_BY_COLOR = { Bob: '#2D6FAF', Eric: '#D97825', BPV: '#B8892A' }

function StatCard({ topColor, label, value, sub, onClick }) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={()=>setHover(true)}
      onMouseLeave={()=>setHover(false)}
      style={{
        background:'#fff', borderRadius:8, padding:'12px 14px', cursor:'pointer',
        border: hover ? `1.5px solid ${topColor}` : '0.5px solid #D6D2CA',
        borderTop:`3px solid ${topColor}`,
        transition:'border-color 0.15s',
      }}
    >
      <div style={{ fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.8, marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:19, fontWeight:700, color:'#2C2C2C', fontFamily:'monospace', lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:'#6b7280', marginTop:6 }}>{sub}</div>}
    </div>
  )
}

function TurnExpenseCards({ propertyId, onOpenFull }) {
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => { if (propertyId) load() }, [propertyId])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('cashoffer_turn_expenses').select('amount, status, paid_by').eq('property_id', propertyId)
    setExpenses(data || [])
    setLoading(false)
  }

  if (loading) return null
  if (expenses.length === 0) {
    return (
      <div
        onClick={onOpenFull}
        style={{ background:'#F0EDE6', borderRadius:8, padding:'12px 16px', textAlign:'center', cursor:'pointer' }}
      >
        <div style={{ fontSize:12, color:'#6b7280' }}>No turn expenses logged yet — click to add some.</div>
      </div>
    )
  }

  const total = expenses.reduce((s,e) => s + (parseFloat(e.amount)||0), 0)
  const done  = expenses.filter(e => e.status === 'Completed').length

  const paidByTotals = { Bob:0, Eric:0, BPV:0 }
  expenses.forEach(e => { if (paidByTotals[e.paid_by] !== undefined) paidByTotals[e.paid_by] += parseFloat(e.amount)||0 })

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      <StatCard
        topColor="#D97825" label="Turn Expenses" value={fmt(total)}
        sub={`${done} of ${expenses.length} completed`}
        onClick={onOpenFull}
      />
      <div
        onClick={onOpenFull}
        style={{ background:'#fff', borderRadius:8, padding:'12px 14px', cursor:'pointer', border:'0.5px solid #D6D2CA', borderTop:'3px solid #6b21a8', transition:'border-color 0.15s' }}
        onMouseEnter={e=>e.currentTarget.style.borderColor='#6b21a8'}
        onMouseLeave={e=>e.currentTarget.style.borderColor='#D6D2CA'}
      >
        <div style={{ fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.8, marginBottom:8 }}>Who's In</div>
        <div style={{ display:'flex', justifyContent:'space-between' }}>
          {Object.entries(paidByTotals).map(([who, t]) => (
            <div key={who}>
              <div style={{ fontSize:10, fontWeight:700, color:PAID_BY_COLOR[who] }}>{who}</div>
              <div style={{ fontSize:16, fontWeight:700, color:'#2C2C2C', fontFamily:'monospace' }}>{fmt(t)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

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

  async function deleteLease(e) {
    e.stopPropagation()
    if (!confirm('Delete this lease record? This cannot be undone.')) return
    await supabase.from('cashoffer_leases').delete().eq('id', lease.id)
    setLease(null)
  }

  const rows = lease ? [
    { label:'Tenant',       value: lease.tenant_name || '—' },
    { label:'Status',       value: lease.status || '—' },
    { label:'Rent Amount',  value: fmt(lease.rent_amount) || '—' },
    { label:'Deposit',      value: lease.deposit_amount ? fmt(lease.deposit_amount) : '—' },
    { label:'Lease Start',  value: lease.lease_start ? new Date(lease.lease_start+'T12:00:00').toLocaleDateString('en-US',{month:'short', day:'numeric', year:'numeric'}) : '—' },
    { label:'Lease End',    value: lease.lease_end ? new Date(lease.lease_end+'T12:00:00').toLocaleDateString('en-US',{month:'short', day:'numeric', year:'numeric'}) : '—' },
  ] : []

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      {!lease ? (
        <div style={{ background:'#F0EDE6', borderRadius:8, padding:20, textAlign:'center' }}>
          <div style={{ fontSize:13, color:'#6b7280', marginBottom:12 }}>No lease recorded for this property.</div>
          <button onClick={onOpenFull} style={{
            background:'#3B6D11', color:'#fff', border:'none', borderRadius:8, padding:'10px 18px',
            fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit',
          }}>
            + Add Lease
          </button>
        </div>
      ) : (
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
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <button onClick={deleteLease} title="Delete lease" style={{
                background:'none', border:'1px solid #B91C1C', color:'#B91C1C', borderRadius:6,
                fontSize:10, fontWeight:700, padding:'3px 8px', cursor:'pointer', fontFamily:'inherit',
              }}>
                Delete
              </button>
              <span style={{ fontSize:16, color:'#3B6D11' }}>→</span>
            </div>
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
      )}

      <TurnExpenseCards propertyId={propertyId} onOpenFull={onOpenFull} />
    </div>
  )
}
