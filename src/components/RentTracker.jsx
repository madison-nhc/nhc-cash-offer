import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase.js'
import { Modal, Field, FieldRow, inp, monoInp, Btn, fmt, fmtK, DatePicker } from './ui.jsx'

// ── Helpers ───────────────────────────────────────────────────────────────────
function firstOfMonth(date) {
  // Returns 'YYYY-MM-01' string for the given date
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`
}

function monthsBetween(startStr, endStr) {
  // Returns array of 'YYYY-MM-01' strings from start to end (inclusive)
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

function fmtMonth(dateStr) {
  // '2024-03-01' → 'Mar 2024'
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month:'short', year:'numeric' })
}

const STATUS_COLOR = {
  'Paid':    '#3B6D11',
  'Partial': '#D97825',
  'Unpaid':  '#B91C1C',
  'Vacant':  '#9ca3af',
}

const LEASE_STATUS = ['Active','Month-to-Month','Expired','Vacated']

// ── Lease form ────────────────────────────────────────────────────────────────
const EMPTY_LEASE = {
  unit_label:'', tenant_name:'', rent_amount:'',
  lease_start:'', lease_end:'', status:'Active', deposit_amount:'', notes:''
}

function LeaseForm({ lease, onSave, onCancel, onDelete }) {
  const [form, setForm] = useState({ ...EMPTY_LEASE, ...lease })
  const isNew = !lease?.id
  const set = k => e => setForm(f=>({...f,[k]:e.target.value}))

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <FieldRow>
        <Field label="Unit Label">
          <input style={inp} value={form.unit_label} onChange={set('unit_label')} />
        </Field>
        <Field label="Tenant Name">
          <input style={inp} value={form.tenant_name} onChange={set('tenant_name')} />
        </Field>
      </FieldRow>
      <FieldRow>
        <Field label="Monthly Rent ($)">
          <input style={monoInp} type="number" value={form.rent_amount} onChange={set('rent_amount')} />
        </Field>
        <Field label="Security Deposit ($)">
          <input style={monoInp} type="number" value={form.deposit_amount} onChange={set('deposit_amount')} />
        </Field>
      </FieldRow>
      <FieldRow>
        <Field label="Lease Start">
          <DatePicker style={inp} value={form.lease_start} onChange={set('lease_start')} />
        </Field>
        <Field label="Lease End (blank = month-to-month)">
          <DatePicker style={inp} value={form.lease_end} onChange={set('lease_end')} />
        </Field>
      </FieldRow>
      <Field label="Status">
        <select style={inp} value={form.status} onChange={set('status')}>
          {LEASE_STATUS.map(s=><option key={s}>{s}</option>)}
        </select>
      </Field>
      <Field label="Notes">
        <textarea style={{ ...inp, minHeight:52, resize:'vertical' }} value={form.notes} onChange={set('notes')} />
      </Field>
      <div style={{ display:'flex', justifyContent:'space-between', paddingTop:8 }}>
        {!isNew && <Btn variant="danger" onClick={()=>onDelete(lease.id)}>Delete Lease</Btn>}
        <div style={{ display:'flex', gap:8, marginLeft:'auto' }}>
          <Btn variant="outline" onClick={onCancel}>Cancel</Btn>
          <Btn onClick={()=>onSave(form)}>Save Lease</Btn>
        </div>
      </div>
    </div>
  )
}

// ── Payment row ───────────────────────────────────────────────────────────────
function PaymentRow({ payment, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const [amtPaid, setAmtPaid] = useState(payment.amount_paid || '')
  const [note, setNote]       = useState(payment.notes || '')
  const isCurrentMonth = payment.period_month === firstOfMonth(new Date())
  const statusColor = STATUS_COLOR[payment.status] || '#9ca3af'

  async function markPaid() {
    const paid = parseFloat(amtPaid) || payment.amount_due
    const status = paid >= payment.amount_due ? 'Paid' : paid > 0 ? 'Partial' : 'Unpaid'
    await supabase.from('cashoffer_rent_payments').update({
      amount_paid: paid, status, paid_date: new Date().toISOString().split('T')[0], notes: note
    }).eq('id', payment.id)
    setEditing(false)
    onUpdate()
  }

  async function markVacant() {
    await supabase.from('cashoffer_rent_payments').update({ status:'Vacant', amount_paid:0 }).eq('id', payment.id)
    onUpdate()
  }

  async function markUnpaid() {
    await supabase.from('cashoffer_rent_payments').update({ status:'Unpaid', amount_paid:0, paid_date:null }).eq('id', payment.id)
    onUpdate()
  }

  return (
    <div style={{
      padding:'8px 12px', borderTop:'0.5px solid #F0EDE6',
      background: isCurrentMonth ? '#fef9f0' : 'transparent',
      borderLeft: isCurrentMonth ? '3px solid #B8892A' : '3px solid transparent',
    }}>
      {editing ? (
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <span style={{ fontSize:12, fontWeight:600, minWidth:70, color:'#2C2C2C' }}>{fmtMonth(payment.period_month)}</span>
          <span style={{ fontSize:11, color:'#9ca3af', minWidth:60, fontFamily:'monospace' }}>Due: {fmt(payment.amount_due)}</span>
          <input
            style={{ ...monoInp, width:100, fontSize:12, padding:'4px 8px' }}
            type="number" value={amtPaid}
            onChange={e=>setAmtPaid(e.target.value)}
          />
          <input
            style={{ ...inp, flex:1, minWidth:120, fontSize:12, padding:'4px 8px' }}
            value={note} onChange={e=>setNote(e.target.value)}
          />
          <Btn onClick={markPaid} style={{ fontSize:11, padding:'5px 10px' }}>Save</Btn>
          <button onClick={()=>setEditing(false)} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'#9ca3af' }}>×</button>
        </div>
      ) : (
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:12, fontWeight:600, minWidth:70, color: isCurrentMonth?'#B8892A':'#2C2C2C' }}>
            {fmtMonth(payment.period_month)}{isCurrentMonth?' ←':''}
          </span>
          <span style={{ fontSize:11, fontFamily:'monospace', color:'#6b7280', minWidth:60 }}>{fmt(payment.amount_due)}</span>
          <span style={{ fontSize:11, fontFamily:'monospace', fontWeight:600,
            color: payment.amount_paid > 0 ? '#3B6D11' : '#9ca3af', minWidth:60 }}>
            {payment.amount_paid > 0 ? fmt(payment.amount_paid) : '—'}
          </span>
          <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:4,
            background:statusColor+'18', color:statusColor, minWidth:52, textAlign:'center' }}>
            {payment.status}
          </span>
          {payment.notes && <span style={{ fontSize:11, color:'#9ca3af', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{payment.notes}</span>}
          <div style={{ display:'flex', gap:4, marginLeft:'auto' }}>
            {payment.status !== 'Vacant' && (
              <button onClick={()=>setEditing(true)} style={{ background:'#F0EDE6', border:'none', borderRadius:4, padding:'3px 8px', fontSize:11, cursor:'pointer', color:'#6b7280', fontFamily:'inherit' }}>
                {payment.status === 'Unpaid' ? 'Mark Paid' : 'Edit'}
              </button>
            )}
            {payment.status === 'Unpaid' && (
              <button onClick={markVacant} style={{ background:'none', border:'1px solid #D6D2CA', borderRadius:4, padding:'3px 8px', fontSize:11, cursor:'pointer', color:'#9ca3af', fontFamily:'inherit' }}>
                Vacant
              </button>
            )}
            {(payment.status === 'Paid' || payment.status === 'Partial') && (
              <button onClick={markUnpaid} style={{ background:'none', border:'1px solid #D6D2CA', borderRadius:4, padding:'3px 8px', fontSize:11, cursor:'pointer', color:'#9ca3af', fontFamily:'inherit' }}>
                Undo
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Lease card with payment log ───────────────────────────────────────────────
function LeaseCard({ lease, onEdit, onPaymentsChange }) {
  const [payments, setPayments] = useState([])
  const [expanded, setExpanded] = useState(true)
  const [loading, setLoading]   = useState(true)

  useEffect(() => { loadPayments() }, [lease.id])

  async function loadPayments() {
    const { data } = await supabase
      .from('cashoffer_rent_payments')
      .select('*')
      .eq('lease_id', lease.id)
      .order('period_month', { ascending: false })
    setPayments(data || [])
    setLoading(false)
  }

  const totalDue       = payments.reduce((s,p)=>s+(parseFloat(p.amount_due)||0),0)
  const totalCollected = payments.reduce((s,p)=>s+(parseFloat(p.amount_paid)||0),0)
  const paidCount      = payments.filter(p=>p.status==='Paid').length
  const vacantCount    = payments.filter(p=>p.status==='Vacant').length
  const unpaidCount    = payments.filter(p=>p.status==='Unpaid'||p.status==='Partial').length

  const statusColor = { Active:'#3B6D11', 'Month-to-Month':'#B8892A', Expired:'#9ca3af', Vacated:'#9ca3af' }

  return (
    <div style={{ border:'0.5px solid #D6D2CA', borderRadius:8, overflow:'hidden', marginBottom:12 }}>
      {/* Lease header */}
      <div style={{ background:'#FAFAF8', padding:'12px 14px' }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:10 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:14, fontWeight:700, color:'#2C2C2C' }}>
                {lease.unit_label || 'Unit'}{lease.tenant_name ? ` — ${lease.tenant_name}` : ''}
              </span>
              <span style={{ background:(statusColor[lease.status]||'#9ca3af')+'18', color:statusColor[lease.status]||'#9ca3af',
                border:`1px solid ${statusColor[lease.status]||'#9ca3af'}40`, borderRadius:4,
                padding:'2px 8px', fontSize:10, fontWeight:700 }}>{lease.status}</span>
            </div>
            <div style={{ fontSize:12, color:'#6b7280', marginTop:3 }}>
              {fmt(lease.rent_amount)}/mo
              {lease.lease_start ? ` · From ${new Date(lease.lease_start+'T12:00:00').toLocaleDateString('en-US',{month:'short',year:'numeric'})}` : ''}
              {lease.lease_end ? ` to ${new Date(lease.lease_end+'T12:00:00').toLocaleDateString('en-US',{month:'short',year:'numeric'})}` : ' · Month-to-month'}
            </div>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={()=>onEdit(lease)} style={{ background:'none', border:'1px solid #D6D2CA', borderRadius:4, padding:'4px 10px', fontSize:11, cursor:'pointer', color:'#6b7280', fontFamily:'inherit' }}>Edit</button>
            <button onClick={()=>setExpanded(e=>!e)} style={{ background:'none', border:'1px solid #D6D2CA', borderRadius:4, padding:'4px 10px', fontSize:11, cursor:'pointer', color:'#6b7280', fontFamily:'inherit' }}>
              {expanded ? '▲ Hide' : '▼ Payments'}
            </button>
          </div>
        </div>

        {/* Summary stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
          {[
            { label:'Collected',  value:fmtK(totalCollected), color:'#3B6D11' },
            { label:'Expected',   value:fmtK(totalDue),       color:'#2C2C2C' },
            { label:'Paid Months',value:paidCount,             color:'#3B6D11' },
            { label:'Unpaid',     value:unpaidCount,           color:unpaidCount>0?'#B91C1C':'#9ca3af' },
          ].map(({label,value,color})=>(
            <div key={label} style={{ background:'#fff', borderRadius:6, padding:'6px 10px', border:'0.5px solid #D6D2CA', textAlign:'center' }}>
              <div style={{ fontSize:9, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.7, marginBottom:2 }}>{label}</div>
              <div style={{ fontSize:14, fontWeight:700, fontFamily:'monospace', color }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Payment rows */}
      {expanded && (
        <div>
          {/* Column header */}
          <div style={{ display:'grid', gridTemplateColumns:'70px 60px 60px 52px 1fr auto', gap:12, padding:'6px 12px', background:'#2C2C2C' }}>
            {['Month','Due','Paid','Status','Notes',''].map(h=>(
              <div key={h} style={{ fontSize:9, fontWeight:700, color:'#B8892A', textTransform:'uppercase', letterSpacing:0.7 }}>{h}</div>
            ))}
          </div>
          {loading ? (
            <div style={{ padding:'16px', textAlign:'center', color:'#9ca3af', fontSize:12 }}>Loading...</div>
          ) : payments.length === 0 ? (
            <div style={{ padding:'16px', textAlign:'center', color:'#9ca3af', fontSize:12 }}>No payment records yet.</div>
          ) : (
            payments.map(p=>(
              <PaymentRow key={p.id} payment={p} onUpdate={()=>{ loadPayments(); onPaymentsChange() }} />
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ── Main RentTracker modal ────────────────────────────────────────────────────
export default function RentTracker({ propertyId, propertyAddress, open, onClose, onRentChange }) {
  const [leases, setLeases]   = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)  // null | 'new' | lease obj

  useEffect(() => { if (open && propertyId) load() }, [open, propertyId])

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

  async function saveLease(form) {
    const payload = {
      property_id:    propertyId,
      unit_label:     form.unit_label || 'Main',
      tenant_name:    form.tenant_name || null,
      rent_amount:    parseFloat(form.rent_amount) || 0,
      lease_start:    form.lease_start || null,
      lease_end:      form.lease_end   || null,
      status:         form.status || 'Active',
      deposit_amount: parseFloat(form.deposit_amount) || null,
      notes:          form.notes || null,
    }

    let leaseId = form.id
    if (form.id) {
      await supabase.from('cashoffer_leases').update(payload).eq('id', form.id)
    } else {
      const { data } = await supabase.from('cashoffer_leases').insert(payload).select().single()
      leaseId = data?.id
    }

    // Auto-generate monthly payment rows from lease_start to today (or lease_end if earlier)
    if (leaseId && payload.lease_start) {
      const today    = firstOfMonth(new Date())
      const end      = payload.lease_end && payload.lease_end < today.slice(0,7)+'-01'
                       ? firstOfMonth(payload.lease_end + 'T12:00:00')
                       : today
      const months   = monthsBetween(payload.lease_start, end)

      // Check which months already exist to avoid duplicates
      const { data: existing } = await supabase
        .from('cashoffer_rent_payments')
        .select('period_month')
        .eq('lease_id', leaseId)

      const existingSet = new Set((existing||[]).map(r=>r.period_month))
      const toInsert = months
        .filter(m => !existingSet.has(m))
        .map(m => ({
          lease_id:     leaseId,
          property_id:  propertyId,
          period_month: m,
          amount_due:   payload.rent_amount,
          amount_paid:  0,
          status:       'Unpaid',
        }))

      if (toInsert.length > 0) {
        await supabase.from('cashoffer_rent_payments').insert(toInsert)
      }
    }

    setEditing(null)
    load()
    onRentChange && onRentChange()
  }

  async function deleteLease(id) {
    if (!confirm('Delete this lease and all its payment records?')) return
    // Cascade deletes payment rows via FK
    await supabase.from('cashoffer_leases').delete().eq('id', id)
    setEditing(null)
    load()
    onRentChange && onRentChange()
  }

  // Portfolio summary across all leases
  const activeLeases    = leases.filter(l=>l.status==='Active'||l.status==='Month-to-Month')
  const totalMonthlyRent= activeLeases.reduce((s,l)=>s+(parseFloat(l.rent_amount)||0),0)

  if (!open) return null

  return (
    <Modal title={`Rent & Leases — ${propertyAddress?.split(',')[0] || ''}`} onClose={onClose} width={740}>
      {loading ? (
        <div style={{ textAlign:'center', padding:32, color:'#B8892A', fontSize:24 }}>⟳</div>
      ) : editing ? (
        <>
          <div style={{ fontSize:13, fontWeight:700, color:'#2C2C2C', marginBottom:16 }}>
            {editing === 'new' ? 'Add Lease' : 'Edit Lease'}
          </div>
          <LeaseForm
            lease={editing === 'new' ? null : editing}
            onSave={saveLease}
            onCancel={()=>setEditing(null)}
            onDelete={deleteLease}
          />
        </>
      ) : (
        <>
          {/* Summary header */}
          {leases.length > 0 && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:20 }}>
              {[
                { label:'Active Leases',    value:activeLeases.length,                              color:'#3B6D11' },
                { label:'Monthly Rent',     value:totalMonthlyRent>0?fmtK(totalMonthlyRent):'—',    color:'#B8892A' },
                { label:'Total Units',      value:leases.length,                                    color:'#2C2C2C' },
              ].map(({label,value,color})=>(
                <div key={label} style={{ background:'#FAFAF8', borderRadius:8, padding:'10px 14px', border:'0.5px solid #D6D2CA', textAlign:'center' }}>
                  <div style={{ fontSize:9, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.7, marginBottom:3 }}>{label}</div>
                  <div style={{ fontSize:20, fontWeight:700, fontFamily:'monospace', color }}>{value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Lease cards */}
          {leases.length === 0 ? (
            <div style={{ background:'#F0EDE6', borderRadius:8, padding:'24px', textAlign:'center', marginBottom:16 }}>
              <div style={{ fontSize:13, color:'#6b7280', marginBottom:10 }}>No leases for this property yet.</div>
              <Btn onClick={()=>setEditing('new')}>+ Add Lease</Btn>
            </div>
          ) : (
            leases.map(l=>(
              <LeaseCard
                key={l.id}
                lease={l}
                onEdit={setEditing}
                onPaymentsChange={()=>onRentChange&&onRentChange()}
              />
            ))
          )}

          {/* Add lease button */}
          {leases.length > 0 && (
            <div style={{ paddingTop:12, borderTop:'1px solid #F0EDE6' }}>
              <Btn variant="outline" onClick={()=>setEditing('new')} style={{ fontSize:12 }}>
                + Add {leases.length > 0 ? 'Another Lease' : 'Lease'}
              </Btn>
              <span style={{ fontSize:11, color:'#9ca3af', marginLeft:10 }}>
                Add a new unit or a new tenant for an existing unit.
              </span>
            </div>
          )}
        </>
      )}
    </Modal>
  )
}
