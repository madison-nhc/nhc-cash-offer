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

function firstOfMonth(date) {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`
}

function monthsBetween(startStr, endStr) {
  const months = []
  const start = new Date(startStr + 'T12:00:00')
  const end   = new Date(endStr   + 'T12:00:00')
  const cur   = new Date(start.getFullYear(), start.getMonth(), 1)
  const last  = new Date(end.getFullYear(),   end.getMonth(),   1)
  while (cur <= last) {
    months.push(`${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}-01`)
    cur.setMonth(cur.getMonth() + 1)
  }
  return months
}

// Months a lease expects rent for, capped at today (or its actual/lease end if that's already passed)
function expectedMonths(lease) {
  if (!lease.lease_start) return []
  const today = firstOfMonth(new Date())
  const hardEnd = lease.actual_end_date || lease.lease_end
  const cutoff = hardEnd && hardEnd < today.slice(0,7)+'-01' ? firstOfMonth(hardEnd + 'T12:00:00') : today
  return monthsBetween(lease.lease_start, cutoff)
}

// Rent collected to date for a lease, given its logged exceptions (Missed/Partial/Vacant)
function collectedForLease(lease, exceptionsByLease) {
  const months = expectedMonths(lease)
  const rent = parseFloat(lease.rent_amount) || 0
  const expected = months.length * rent
  const exceptions = exceptionsByLease[lease.id] || []
  const shortfall = exceptions.reduce((s,e) => {
    const due = e.status === 'Partial' ? (parseFloat(e.amount_due)||rent) : rent
    const paid = e.status === 'Partial' ? (parseFloat(e.amount_paid)||0) : 0
    return s + Math.max(due - paid, 0)
  }, 0)
  return { expected, collected: Math.max(expected - shortfall, 0) }
}

function renewalInfo(lease) {
  if (lease.actual_end_date) return { label:'Ended', color:'#9ca3af' }
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

// One row per unit — current lease (or an empty "+ Add Lease" slot) plus an
// expandable Past Leases history for that same unit.
function UnitSlot({ unitLabel, current, past, exceptionsByLease, onOpenFull }) {
  const [showPast, setShowPast] = useState(false)

  if (!current) {
    return (
      <div style={{ background:'#F0EDE6', borderRadius:8, padding:'14px', border:'0.5px dashed #D6D2CA', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ fontSize:12, color:'#6b7280' }}>{unitLabel} — vacant, no lease yet</div>
        <button onClick={onOpenFull} style={{ background:'none', border:'1px solid #D6D2CA', borderRadius:6, padding:'5px 12px', fontSize:11, fontWeight:700, cursor:'pointer', color:'#3B6D11', fontFamily:'inherit' }}>
          + Add Lease
        </button>
      </div>
    )
  }

  const renewal = renewalInfo(current)
  const { collected } = collectedForLease(current, exceptionsByLease)

  return (
    <div style={{ background:'#fff', borderRadius:8, border:'0.5px solid #D6D2CA', borderTop:`3px solid ${STATUS_COLOR[current.status]||'#9ca3af'}`, overflow:'hidden' }}>
      <div style={{ padding:'12px 14px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#2C2C2C' }}>
            {current.unit_label || 'Unit'}{current.tenant_name ? ` — ${current.tenant_name}` : ''}
          </div>
          <span style={{ background:(STATUS_COLOR[current.status]||'#9ca3af')+'18', color:STATUS_COLOR[current.status]||'#9ca3af',
            border:`1px solid ${STATUS_COLOR[current.status]||'#9ca3af'}40`, borderRadius:4,
            padding:'2px 7px', fontSize:9, fontWeight:700 }}>{current.status}</span>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8 }}>
          <div>
            <div style={{ fontSize:9, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.6 }}>Monthly Rent</div>
            <div style={{ fontSize:14, fontWeight:700, color:'#2C2C2C', fontFamily:'monospace' }}>{fmt(current.rent_amount)}/mo</div>
          </div>
          <div>
            <div style={{ fontSize:9, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.6 }}>Total Rent Paid</div>
            <div style={{ fontSize:14, fontWeight:700, color:'#3B6D11', fontFamily:'monospace' }}>{fmt(collected)}</div>
          </div>
          <div>
            <div style={{ fontSize:9, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.6 }}>Lease Ends</div>
            <div style={{ fontSize:12, fontWeight:600, color:renewal.color }}>{renewal.label}</div>
          </div>
        </div>
      </div>

      {past.length > 0 && (
        <div style={{ borderTop:'0.5px solid #F0EDE6' }}>
          <button onClick={()=>setShowPast(v=>!v)} style={{
            width:'100%', background:'#FAFAF8', border:'none', padding:'7px 14px', textAlign:'left',
            fontSize:11, fontWeight:700, color:'#9ca3af', cursor:'pointer', fontFamily:'inherit',
            display:'flex', justifyContent:'space-between', alignItems:'center',
          }}>
            <span>Past Leases ({past.length})</span>
            <span>{showPast ? '▲' : '▼'}</span>
          </button>
          {showPast && (
            <div style={{ padding:'4px 14px 10px' }}>
              {past.map(p => {
                const { collected: pastCollected } = collectedForLease(p, exceptionsByLease)
                return (
                  <div key={p.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 0', borderTop:'0.5px solid #F0EDE6', fontSize:11 }}>
                    <span style={{ fontWeight:600, color:'#2C2C2C', minWidth:120 }}>{p.tenant_name || 'Unnamed Tenant'}</span>
                    <span style={{ color:'#9ca3af' }}>
                      {p.lease_start ? new Date(p.lease_start+'T12:00:00').toLocaleDateString('en-US',{month:'short',year:'numeric'}) : '—'}
                      {' → '}
                      {p.actual_end_date ? new Date(p.actual_end_date+'T12:00:00').toLocaleDateString('en-US',{month:'short',year:'numeric'}) : '—'}
                    </span>
                    <span style={{ marginLeft:'auto', fontFamily:'monospace', color:'#3B6D11' }}>{fmt(pastCollected)} paid</span>
                    {p.termination_reason && <span style={{ color:'#9ca3af' }}>· {p.termination_reason}</span>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PersonCard(who, amount) {
  return (
    <div key={who} style={{ background:'#fff', borderRadius:8, padding:'12px 14px', border:'0.5px solid #D6D2CA', borderTop:`3px solid ${PAID_BY_COLOR[who]||'#9ca3af'}` }}>
      <div style={{ fontSize:10, fontWeight:700, color:PAID_BY_COLOR[who]||'#9ca3af', textTransform:'uppercase', letterSpacing:0.6, marginBottom:6 }}>{who}</div>
      <div style={{ fontSize:9, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.5 }}>Amount</div>
      <div style={{ fontSize:16, fontWeight:700, color:'#2C2C2C', fontFamily:'monospace' }}>{fmt(amount)}</div>
    </div>
  )
}

function ExpensesSection({ propertyId }) {
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

  const paidByTotals = { BPV:0 }
  expenses.forEach(e => {
    if (!e.paid_by) return
    if (paidByTotals[e.paid_by] === undefined) paidByTotals[e.paid_by] = 0
    paidByTotals[e.paid_by] += parseFloat(e.amount)||0
  })
  const others = Object.keys(paidByTotals).filter(who => who !== 'BPV')

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      <div style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.8, marginTop:2 }}>Business Expenses</div>
      {PersonCard('BPV', paidByTotals.BPV)}

      {others.length > 0 && (<>
        <div style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.8, marginTop:6 }}>Partner Investments</div>
        <div style={{ display:'grid', gridTemplateColumns:`repeat(${others.length}, 1fr)`, gap:10 }}>
          {others.map(who => PersonCard(who, paidByTotals[who]))}
        </div>
      </>)}
    </div>
  )
}

export default function RentOverview({ propertyId, onOpenFull }) {
  const [leases, setLeases]       = useState([])
  const [exceptions, setExceptions] = useState([])
  const [maintenanceTotal, setMaintenanceTotal] = useState(0)
  const [maintenanceCount, setMaintenanceCount] = useState({ done:0, total:0 })
  const [unitCount, setUnitCount] = useState(null)
  const [loading, setLoading]     = useState(true)

  useEffect(() => { if (propertyId) load() }, [propertyId])

  async function load() {
    setLoading(true)
    const [{ data: l }, { data: prop }, { data: exp }] = await Promise.all([
      supabase.from('cashoffer_leases').select('*').eq('property_id', propertyId).order('lease_start', { ascending: false }),
      supabase.from('cashoffer_properties').select('unit_count').eq('id', propertyId).single(),
      supabase.from('cashoffer_turn_expenses').select('amount, status').eq('property_id', propertyId),
    ])
    const leaseRows = l || []
    setLeases(leaseRows)
    setUnitCount(prop?.unit_count || null)
    setMaintenanceTotal((exp||[]).reduce((s,e)=>s+(parseFloat(e.amount)||0),0))
    setMaintenanceCount({ done:(exp||[]).filter(e=>e.status==='Completed').length, total:(exp||[]).length })

    const leaseIds = leaseRows.map(r=>r.id)
    if (leaseIds.length) {
      const { data: ex } = await supabase.from('cashoffer_rent_payments').select('*').in('lease_id', leaseIds)
      setExceptions(ex || [])
    } else {
      setExceptions([])
    }
    setLoading(false)
  }

  if (loading) return <div style={{ textAlign:'center', padding:20, color:'#9ca3af', fontSize:12 }}>Loading…</div>

  const exceptionsByLease = {}
  exceptions.forEach(e => {
    if (!exceptionsByLease[e.lease_id]) exceptionsByLease[e.lease_id] = []
    exceptionsByLease[e.lease_id].push(e)
  })

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
      </div>
    )
  }

  // Group leases by unit label — current lease is the one still open (no actual_end_date),
  // falling back to the most recent by start date; everything else is history for that unit.
  const groups = {}
  leases.forEach(l => {
    const key = (l.unit_label || 'Main').trim() || 'Main'
    if (!groups[key]) groups[key] = []
    groups[key].push(l)
  })
  const unitLabels = Object.keys(groups).sort()
  const slots = unitLabels.map(label => {
    const rows = groups[label]
    const openLease = rows.find(r => !r.actual_end_date)
    const current = openLease || rows[0]
    const past = rows.filter(r => r.id !== current.id)
    return { label, current, past }
  })
  // Pad out to unit_count from the Analyzer/Acquisition details, if that's more units than we have leases for
  const slotCount = Math.max(unitCount || 0, slots.length)
  for (let i = slots.length; i < slotCount; i++) {
    slots.push({ label:`Unit ${i+1}`, current:null, past:[] })
  }

  const totalRentEarned = leases.reduce((s,l) => s + collectedForLease(l, exceptionsByLease).collected, 0)

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* Leases */}
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.8 }}>
            {slots.length > 1 ? `${slots.length} Units` : 'Lease'}
          </div>
          <div style={{ fontSize:11, color:'#9ca3af' }}>
            Total Rent Earned: <span style={{ fontWeight:700, color:'#3B6D11', fontFamily:'monospace' }}>{fmt(totalRentEarned)}</span>
          </div>
        </div>
        {slots.map(s => (
          <UnitSlot key={s.label} unitLabel={s.label} current={s.current} past={s.past} exceptionsByLease={exceptionsByLease} onOpenFull={onOpenFull} />
        ))}
      </div>

      {/* Maintenance Cost */}
      {maintenanceCount.total > 0 && (
        <StatCard topColor="#D97825" label="Total Maintenance Expenses" value={fmt(maintenanceTotal)} sub={`${maintenanceCount.done} of ${maintenanceCount.total} completed`} />
      )}

      {/* Expenses (who funded it) */}
      <ExpensesSection propertyId={propertyId} />

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
