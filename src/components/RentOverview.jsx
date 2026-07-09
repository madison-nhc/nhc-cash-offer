import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { fmt } from './ui.jsx'

const PAID_BY_COLOR = { Bob: '#2D6FAF', Eric: '#D97825', BPV: '#B8892A' }
const STATUS_COLOR  = { Active:'#3B6D11', 'Month-to-Month':'#B8892A', Expired:'#9ca3af', Vacated:'#9ca3af' }

function daysBetween(fromStr, toStr) {
  const from = new Date(fromStr + 'T12:00:00')
  const to   = new Date(toStr   + 'T12:00:00')
  return Math.round((to - from) / 86400000)
}

function renewalInfo(lease) {
  if (!lease.lease_end) return { label:'Month-to-month', color:'#9ca3af' }
  const days = daysBetween(new Date().toISOString().slice(0,10), lease.lease_end)
  if (days < 0)  return { label:`Expired ${Math.abs(days)}d ago`, color:'#B91C1C' }
  if (days <= 60) return { label:`Renews in ${days}d`, color:'#D97825' }
  return { label:`Renews in ${days}d`, color:'#3B6D11' }
}

function StatCard({ topColor, label, value, sub }) {
  return (
    <div style={{ background:'#fff', borderRadius:8, padding:'12px 14px', border:'0.5px solid #D6D2CA', borderTop:`3px solid ${topColor}` }}>
      <div style={{ fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.8, marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:19, fontWeight:700, color:'#2C2C2C', fontFamily:'monospace', lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:'#6b7280', marginTop:6 }}>{sub}</div>}
    </div>
  )
}

// Compact per-unit lease card — key details at a glance, matches the Renovation
// Dashboard's stat-card language (top color bar, uppercase label, mono value).
function LeaseUnitCard({ lease }) {
  const renewal = renewalInfo(lease)
  return (
    <div style={{ background:'#fff', borderRadius:8, padding:'12px 14px', border:'0.5px solid #D6D2CA', borderTop:`3px solid ${STATUS_COLOR[lease.status]||'#9ca3af'}` }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
        <div style={{ fontSize:12, fontWeight:700, color:'#2C2C2C' }}>
          {lease.unit_label || 'Unit'}{lease.tenant_name ? ` — ${lease.tenant_name}` : ''}
        </div>
        <span style={{ background:(STATUS_COLOR[lease.status]||'#9ca3af')+'18', color:STATUS_COLOR[lease.status]||'#9ca3af',
          border:`1px solid ${STATUS_COLOR[lease.status]||'#9ca3af'}40`, borderRadius:4,
          padding:'2px 7px', fontSize:9, fontWeight:700 }}>{lease.status}</span>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        <div>
          <div style={{ fontSize:9, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.6 }}>Rent</div>
          <div style={{ fontSize:14, fontWeight:700, color:'#2C2C2C', fontFamily:'monospace' }}>{fmt(lease.rent_amount)}/mo</div>
        </div>
        <div>
          <div style={{ fontSize:9, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.6 }}>Lease Ends</div>
          <div style={{ fontSize:12, fontWeight:600, color:renewal.color }}>{renewal.label}</div>
        </div>
      </div>
    </div>
  )
}

function TurnExpenseCards({ propertyId }) {
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => { if (propertyId) load() }, [propertyId])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('cashoffer_turn_expenses').select('amount, status, paid_by').eq('property_id', propertyId)
    setExpenses(data || [])
    setLoading(false)
  }

  if (loading || expenses.length === 0) return null

  const total = expenses.reduce((s,e) => s + (parseFloat(e.amount)||0), 0)
  const done  = expenses.filter(e => e.status === 'Completed').length

  const paidByTotals = { Bob:0, Eric:0, BPV:0 }
  expenses.forEach(e => { if (paidByTotals[e.paid_by] !== undefined) paidByTotals[e.paid_by] += parseFloat(e.amount)||0 })

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      <StatCard topColor="#D97825" label="Maintenance" value={fmt(total)} sub={`${done} of ${expenses.length} completed`} />
      <div style={{ background:'#fff', borderRadius:8, padding:'12px 14px', border:'0.5px solid #D6D2CA', borderTop:'3px solid #6b21a8' }}>
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
  const [leases, setLeases]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (propertyId) load() }, [propertyId])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('cashoffer_leases')
      .select('*')
      .eq('property_id', propertyId)
      .order('lease_start', { ascending: false })
    setLeases(data || [])
    setLoading(false)
  }

  if (loading) return <div style={{ textAlign:'center', padding:20, color:'#9ca3af', fontSize:12 }}>Loading…</div>

  if (leases.length === 0) {
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        <div style={{ background:'#F0EDE6', borderRadius:8, padding:20, textAlign:'center' }}>
          <div style={{ fontSize:13, color:'#6b7280', marginBottom:12 }}>No leases for this property yet.</div>
          <button onClick={onOpenFull} style={{
            background:'#3B6D11', color:'#fff', border:'none', borderRadius:8, padding:'10px 18px',
            fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit',
          }}>
            + Add Lease
          </button>
        </div>
        <TurnExpenseCards propertyId={propertyId} />
      </div>
    )
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      <div style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.8 }}>
        {leases.length > 1 ? `${leases.length} Units` : 'Unit'}
      </div>
      <div style={{ display:'grid', gridTemplateColumns: leases.length > 1 ? '1fr 1fr' : '1fr', gap:10 }}>
        {leases.map(l => <LeaseUnitCard key={l.id} lease={l} />)}
      </div>

      <TurnExpenseCards propertyId={propertyId} />

      <button onClick={onOpenFull} style={{
        background:'#3B6D11', color:'#fff', border:'none', borderRadius:8, padding:'10px 14px',
        fontSize:12.5, fontWeight:700, cursor:'pointer', fontFamily:'inherit',
        display:'flex', alignItems:'center', justifyContent:'center', gap:6, marginTop:2,
      }}>
        Open Lease Details <span>→</span>
      </button>
    </div>
  )
}
