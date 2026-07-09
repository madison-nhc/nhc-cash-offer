import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { Modal, Field, FieldRow, inp, monoInp, Btn, fmt, fmtK, DatePicker, PAID_BY_OPTIONS, PARTNERS, PartnerLedger, NoPartnerCells } from './ui.jsx'

const TURN_STATUS_OPTIONS = ['Scheduled', 'In Progress', 'Completed']
const TURN_STATUS_COLORS  = { 'Scheduled':'#9ca3af', 'In Progress':'#D97825', 'Completed':'#3B6D11' }

// ── Helpers ───────────────────────────────────────────────────────────────────
function firstOfMonth(date) {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`
}

function monthsBetween(startStr, endStr) {
  // Array of 'YYYY-MM-01' strings from start to end (inclusive)
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
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month:'short', year:'numeric' })
}

function fmtMonthShort(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month:'short' })
}

function daysBetween(fromStr, toStr) {
  const from = new Date(fromStr + 'T12:00:00')
  const to   = new Date(toStr   + 'T12:00:00')
  return Math.round((to - from) / 86400000)
}

// Months a lease expects rent for, from lease_start through today (or lease_end if it already passed)
function expectedMonths(lease) {
  if (!lease.lease_start) return []
  const today = firstOfMonth(new Date())
  const cutoff = lease.lease_end && lease.lease_end < today.slice(0,7)+'-01' ? firstOfMonth(lease.lease_end + 'T12:00:00') : today
  return monthsBetween(lease.lease_start, cutoff)
}

const EXC_STATUS = ['Missed', 'Partial', 'Vacant']
const EXC_COLOR  = { Missed:'#B91C1C', Partial:'#D97825', Vacant:'#9ca3af' }
const PAID_COLOR = '#3B6D11'
const LEASE_STATUS = ['Active','Month-to-Month','Expired','Vacated']

// ── Lease form ────────────────────────────────────────────────────────────────
const EMPTY_LEASE = {
  unit_label:'', tenant_name:'', tenant_phone:'', tenant_email:'', rent_amount:'',
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
        <Field label="Tenant Phone">
          <input style={inp} value={form.tenant_phone} onChange={set('tenant_phone')} />
        </Field>
        <Field label="Tenant Email">
          <input style={inp} value={form.tenant_email} onChange={set('tenant_email')} />
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

// ── Exception form (log a Missed / Partial / Vacant month) ───────────────────
function ExceptionForm({ month, existing, defaultDue, onSave, onCancel, onDelete }) {
  const [status, setStatus]   = useState(existing?.status || 'Missed')
  const [amtPaid, setAmtPaid] = useState(existing?.amount_paid ?? '')
  const [amtDue, setAmtDue]   = useState(existing?.amount_due ?? defaultDue)
  const [notes, setNotes]     = useState(existing?.notes || '')

  return (
    <div style={{ background:'#FAFAF8', border:'0.5px solid #D6D2CA', borderRadius:8, padding:12, marginTop:6 }}>
      <div style={{ fontSize:12, fontWeight:700, color:'#2C2C2C', marginBottom:8 }}>
        {fmtMonth(month)} — Log Exception
      </div>
      <div style={{ display:'flex', gap:8, marginBottom:8, flexWrap:'wrap' }}>
        {EXC_STATUS.map(s=>(
          <button key={s} onClick={()=>setStatus(s)} style={{
            border:`1px solid ${status===s?EXC_COLOR[s]:'#D6D2CA'}`,
            background: status===s ? EXC_COLOR[s]+'18' : '#fff',
            color: status===s ? EXC_COLOR[s] : '#6b7280',
            borderRadius:6, padding:'5px 12px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit',
          }}>{s}</button>
        ))}
      </div>
      {status === 'Partial' && (
        <FieldRow>
          <Field label="Due ($)">
            <input style={monoInp} type="number" value={amtDue} onChange={e=>setAmtDue(e.target.value)} />
          </Field>
          <Field label="Received ($)">
            <input style={monoInp} type="number" value={amtPaid} onChange={e=>setAmtPaid(e.target.value)} />
          </Field>
        </FieldRow>
      )}
      <Field label="Notes">
        <input style={inp} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Optional" />
      </Field>
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:10 }}>
        {existing && <Btn variant="danger" onClick={()=>onDelete(existing.id)} style={{ fontSize:11 }}>Clear (Mark Paid)</Btn>}
        <div style={{ display:'flex', gap:8, marginLeft:'auto' }}>
          <Btn variant="outline" onClick={onCancel} style={{ fontSize:11 }}>Cancel</Btn>
          <Btn onClick={()=>onSave({
            status,
            amount_due:  status==='Partial' ? (parseFloat(amtDue)||0) : (parseFloat(defaultDue)||0),
            amount_paid: status==='Partial' ? (parseFloat(amtPaid)||0) : 0,
            notes: notes || null,
          })} style={{ fontSize:11 }}>Save</Btn>
        </div>
      </div>
    </div>
  )
}

// ── Compact month strip ────────────────────────────────────────────────────────
function MonthStrip({ months, exceptionsByMonth, onPick }) {
  if (months.length === 0) return <div style={{ fontSize:11, color:'#9ca3af' }}>No months elapsed yet.</div>
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
      {months.map(m=>{
        const exc = exceptionsByMonth[m]
        const color = exc ? EXC_COLOR[exc.status] : PAID_COLOR
        return (
          <button key={m} onClick={()=>onPick(m)} title={`${fmtMonth(m)} — ${exc ? exc.status : 'Paid'}`} style={{
            width:34, height:26, borderRadius:5, border:`1px solid ${color}55`,
            background: color+'18', color, fontSize:9, fontWeight:700, cursor:'pointer',
            fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            {fmtMonthShort(m)}
          </button>
        )
      })}
    </div>
  )
}

const TERMINATION_REASONS = ['Lease Expired', 'Terminated Early', 'Tenant Vacated', 'Non-Renewal', 'Other']
const DEPOSIT_OPTIONS = ['Returned', 'Kept', 'Partial']

// ── End / extend lease form ──────────────────────────────────────────────────
function LeaseEndForm({ lease, onSave, onCancel }) {
  const [mode, setMode] = useState('end') // 'end' | 'extend'
  const [actualEndDate, setActualEndDate] = useState(new Date().toISOString().slice(0,10))
  const [reason, setReason] = useState('Lease Expired')
  const [depositDisposition, setDepositDisposition] = useState('Returned')
  const [depositReturned, setDepositReturned] = useState(lease.deposit_amount || '')
  const [depositNotes, setDepositNotes] = useState('')

  function submit() {
    if (mode === 'extend') {
      onSave({ status:'Month-to-Month', lease_end:null })
      return
    }
    onSave({
      status: reason==='Lease Expired' ? 'Expired' : 'Vacated',
      actual_end_date: actualEndDate,
      termination_reason: reason,
      deposit_disposition: depositDisposition,
      deposit_returned_amount: depositDisposition==='Returned' ? (parseFloat(lease.deposit_amount)||0)
                              : depositDisposition==='Kept' ? 0
                              : (parseFloat(depositReturned)||0),
      deposit_notes: depositNotes || null,
    })
  }

  return (
    <div style={{ background:'#FAFAF8', border:'0.5px solid #D6D2CA', borderRadius:8, padding:14, marginTop:8 }}>
      <div style={{ display:'flex', gap:8, marginBottom:12 }}>
        {[['extend','Extend Month-to-Month'],['end','End Lease']].map(([m,label])=>(
          <button key={m} onClick={()=>setMode(m)} style={{
            flex:1, border:`1.5px solid ${mode===m?'#B8892A':'#D6D2CA'}`,
            background: mode===m ? '#B8892A18' : '#fff',
            color: mode===m ? '#B8892A' : '#6b7280',
            borderRadius:6, padding:'7px 10px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit',
          }}>{label}</button>
        ))}
      </div>

      {mode === 'extend' ? (
        <div style={{ fontSize:12, color:'#6b7280' }}>
          Converts this lease to month-to-month — clears the lease end date and keeps rent and tenant as-is.
        </div>
      ) : (
        <>
          <FieldRow>
            <Field label="Actual End Date">
              <DatePicker style={inp} value={actualEndDate} onChange={setActualEndDate} />
            </Field>
            <Field label="Reason">
              <select style={inp} value={reason} onChange={e=>setReason(e.target.value)}>
                {TERMINATION_REASONS.map(r=><option key={r}>{r}</option>)}
              </select>
            </Field>
          </FieldRow>

          <div style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.7, marginTop:10, marginBottom:6 }}>
            Security Deposit ({fmt(lease.deposit_amount || 0)})
          </div>
          <div style={{ display:'flex', gap:8, marginBottom:8 }}>
            {DEPOSIT_OPTIONS.map(d=>(
              <button key={d} onClick={()=>setDepositDisposition(d)} style={{
                flex:1, border:`1px solid ${depositDisposition===d?'#B8892A':'#D6D2CA'}`,
                background: depositDisposition===d ? '#B8892A18' : '#fff',
                color: depositDisposition===d ? '#B8892A' : '#6b7280',
                borderRadius:6, padding:'5px 8px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit',
              }}>{d}</button>
            ))}
          </div>
          {depositDisposition === 'Partial' && (
            <Field label="Amount Returned ($)">
              <input style={monoInp} type="number" value={depositReturned} onChange={e=>setDepositReturned(e.target.value)} />
            </Field>
          )}
          <Field label="Notes (e.g. damages, unpaid rent withheld)">
            <textarea style={{ ...inp, minHeight:44, resize:'vertical' }} value={depositNotes} onChange={e=>setDepositNotes(e.target.value)} />
          </Field>
        </>
      )}

      <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:12 }}>
        <Btn variant="outline" onClick={onCancel} style={{ fontSize:11 }}>Cancel</Btn>
        <Btn onClick={submit} style={{ fontSize:11 }}>{mode==='extend' ? 'Extend Lease' : 'End Lease'}</Btn>
      </div>
    </div>
  )
}

// ── Lease card ──────────────────────────────────────────────────────────────────
function LeaseCard({ lease, onEdit, allExpenses, onSaved, defaultExpanded=true }) {
  const [exceptions, setExceptions] = useState([])
  const [loading, setLoading]       = useState(true)
  const [expanded, setExpanded]     = useState(defaultExpanded)
  const [pickedMonth, setPickedMonth] = useState(null)
  const [endingLease, setEndingLease] = useState(false)

  useEffect(() => { loadExceptions() }, [lease.id])

  async function loadExceptions() {
    const { data } = await supabase
      .from('cashoffer_rent_payments')
      .select('*')
      .eq('lease_id', lease.id)
      .order('period_month', { ascending: false })
    setExceptions(data || [])
    setLoading(false)
  }

  const months = expectedMonths(lease)
  const exceptionsByMonth = {}
  exceptions.forEach(e => { exceptionsByMonth[e.period_month] = e })

  const rent = parseFloat(lease.rent_amount) || 0
  const expected = months.length * rent
  const shortfall = exceptions.reduce((s,e) => {
    const due = e.status === 'Partial' ? (parseFloat(e.amount_due)||rent) : rent
    const paid = e.status === 'Partial' ? (parseFloat(e.amount_paid)||0) : 0
    return s + Math.max(due - paid, 0)
  }, 0)
  const collected = Math.max(expected - shortfall, 0)
  const exceptionCount = exceptions.length

  async function saveException(month, payload) {
    const existing = exceptionsByMonth[month]
    if (existing) {
      await supabase.from('cashoffer_rent_payments').update(payload).eq('id', existing.id)
    } else {
      await supabase.from('cashoffer_rent_payments').insert({
        lease_id: lease.id, property_id: lease.property_id, period_month: month, ...payload,
      })
    }
    setPickedMonth(null)
    loadExceptions()
  }

  async function deleteException(id) {
    await supabase.from('cashoffer_rent_payments').delete().eq('id', id)
    setPickedMonth(null)
    loadExceptions()
  }

  const statusColor = { Active:'#3B6D11', 'Month-to-Month':'#B8892A', Expired:'#9ca3af', Vacated:'#9ca3af' }

  // Renewal countdown
  let renewalLabel = 'Month-to-month'
  let renewalColor = '#9ca3af'
  if (lease.lease_end) {
    const days = daysBetween(new Date().toISOString().slice(0,10), lease.lease_end)
    if (days < 0) { renewalLabel = `Expired ${Math.abs(days)}d ago`; renewalColor = '#B91C1C' }
    else if (days <= 60) { renewalLabel = `Renews in ${days}d`; renewalColor = '#D97825' }
    else { renewalLabel = `Renews in ${days}d`; renewalColor = '#3B6D11' }
  }

  // Turn history — expenses tagged to this lease
  const turnHistory = allExpenses.filter(e => e.lease_id === lease.id)

  return (
    <div style={{ border:'0.5px solid #D6D2CA', borderRadius:8, overflow:'hidden', marginBottom:12 }}>
      {/* Lease header */}
      <div style={{ background:'#FAFAF8', padding:'12px 14px' }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:10 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
              <span style={{ fontSize:14, fontWeight:700, color:'#2C2C2C' }}>
                {lease.unit_label || 'Unit'}{lease.tenant_name ? ` — ${lease.tenant_name}` : ''}
              </span>
              <span style={{ background:(statusColor[lease.status]||'#9ca3af')+'18', color:statusColor[lease.status]||'#9ca3af',
                border:`1px solid ${statusColor[lease.status]||'#9ca3af'}40`, borderRadius:4,
                padding:'2px 8px', fontSize:10, fontWeight:700 }}>{lease.status}</span>
              <span style={{ background:renewalColor+'18', color:renewalColor,
                border:`1px solid ${renewalColor}40`, borderRadius:4,
                padding:'2px 8px', fontSize:10, fontWeight:700 }}>{renewalLabel}</span>
            </div>
            <div style={{ fontSize:12, color:'#6b7280', marginTop:3 }}>
              {fmt(lease.rent_amount)}/mo
              {lease.lease_start ? ` · From ${new Date(lease.lease_start+'T12:00:00').toLocaleDateString('en-US',{month:'short',year:'numeric'})}` : ''}
              {lease.lease_end ? ` to ${new Date(lease.lease_end+'T12:00:00').toLocaleDateString('en-US',{month:'short',year:'numeric'})}` : ' · Month-to-month'}
            </div>
            {(lease.tenant_phone || lease.tenant_email) && (
              <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>
                {[lease.tenant_phone, lease.tenant_email].filter(Boolean).join('  ·  ')}
              </div>
            )}
            {lease.deposit_amount ? (
              <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>Deposit: {fmt(lease.deposit_amount)}</div>
            ) : null}
            {lease.actual_end_date && (
              <div style={{ fontSize:11, color:'#6b7280', marginTop:4, background:'#F0EDE6', display:'inline-block', padding:'3px 8px', borderRadius:4 }}>
                Ended {new Date(lease.actual_end_date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
                {lease.termination_reason ? ` · ${lease.termination_reason}` : ''}
                {lease.deposit_disposition ? ` · Deposit ${lease.deposit_disposition}${lease.deposit_disposition==='Partial' ? ` (${fmt(lease.deposit_returned_amount)} returned)` : ''}` : ''}
              </div>
            )}
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={()=>onEdit(lease)} style={{ background:'none', border:'1px solid #D6D2CA', borderRadius:4, padding:'4px 10px', fontSize:11, cursor:'pointer', color:'#6b7280', fontFamily:'inherit' }}>Edit</button>
            {!lease.actual_end_date && (
              <button onClick={()=>setEndingLease(v=>!v)} style={{ background:'none', border:'1px solid #D6D2CA', borderRadius:4, padding:'4px 10px', fontSize:11, cursor:'pointer', color:'#6b7280', fontFamily:'inherit' }}>
                End / Extend
              </button>
            )}
            <button onClick={()=>setExpanded(e=>!e)} style={{ background:'none', border:'1px solid #D6D2CA', borderRadius:4, padding:'4px 10px', fontSize:11, cursor:'pointer', color:'#6b7280', fontFamily:'inherit' }}>
              {expanded ? '▲ Hide' : '▼ Details'}
            </button>
          </div>
        </div>

        {endingLease && (
          <LeaseEndForm
            lease={lease}
            onCancel={()=>setEndingLease(false)}
            onSave={async (payload) => {
              await supabase.from('cashoffer_leases').update(payload).eq('id', lease.id)
              setEndingLease(false)
              onSaved && onSaved()
            }}
          />
        )}

        {/* Summary stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
          {[
            { label:'Collected',  value:fmtK(collected), color:'#3B6D11' },
            { label:'Expected',   value:fmtK(expected),  color:'#2C2C2C' },
            { label:'Months',     value:months.length,   color:'#2C2C2C' },
            { label:'Exceptions', value:exceptionCount,   color:exceptionCount>0?'#B91C1C':'#9ca3af' },
          ].map(({label,value,color})=>(
            <div key={label} style={{ background:'#fff', borderRadius:6, padding:'6px 10px', border:'0.5px solid #D6D2CA', textAlign:'center' }}>
              <div style={{ fontSize:9, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.7, marginBottom:2 }}>{label}</div>
              <div style={{ fontSize:14, fontWeight:700, fontFamily:'monospace', color }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {expanded && (
        <div style={{ padding:'12px 14px' }}>
          {loading ? (
            <div style={{ textAlign:'center', color:'#9ca3af', fontSize:12, padding:12 }}>Loading...</div>
          ) : (
            <>
              {/* Month strip */}
              <div style={{ fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.7, marginBottom:6 }}>
                Rent collected by month — assumed paid unless flagged
              </div>
              <MonthStrip months={months} exceptionsByMonth={exceptionsByMonth} onPick={setPickedMonth} />
              {pickedMonth && (
                <ExceptionForm
                  month={pickedMonth}
                  existing={exceptionsByMonth[pickedMonth]}
                  defaultDue={rent}
                  onSave={(payload)=>saveException(pickedMonth, payload)}
                  onCancel={()=>setPickedMonth(null)}
                  onDelete={deleteException}
                />
              )}

              {/* Exceptions list */}
              {exceptions.length > 0 && (
                <div style={{ marginTop:14 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.7, marginBottom:6 }}>Exceptions</div>
                  {exceptions.map(e=>(
                    <div key={e.id} onClick={()=>setPickedMonth(e.period_month)} style={{
                      display:'flex', alignItems:'center', gap:10, padding:'6px 10px', borderRadius:6,
                      border:'0.5px solid #D6D2CA', marginBottom:4, cursor:'pointer', background:'#fff',
                    }}>
                      <span style={{ fontSize:11, fontWeight:600, minWidth:70 }}>{fmtMonth(e.period_month)}</span>
                      <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:4,
                        background:EXC_COLOR[e.status]+'18', color:EXC_COLOR[e.status] }}>{e.status}</span>
                      {e.status === 'Partial' && (
                        <span style={{ fontSize:11, fontFamily:'monospace', color:'#6b7280' }}>
                          {fmt(e.amount_paid)} / {fmt(e.amount_due)}
                        </span>
                      )}
                      {e.notes && <span style={{ fontSize:11, color:'#9ca3af', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.notes}</span>}
                    </div>
                  ))}
                </div>
              )}

              {/* Turn history */}
              <div style={{ marginTop:14 }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.7, marginBottom:6 }}>Maintenance History</div>
                {turnHistory.length === 0 ? (
                  <div style={{ fontSize:11, color:'#9ca3af' }}>No maintenance logged for this unit yet.</div>
                ) : (
                  turnHistory.map(e=>(
                    <div key={e.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'5px 10px', fontSize:11, color:'#6b7280' }}>
                      <span style={{ fontWeight:600, color:'#2C2C2C', minWidth:120 }}>{e.name || 'Untitled'}</span>
                      <span>{e.vendor}</span>
                      <span style={{ marginLeft:'auto', fontFamily:'monospace' }}>{fmt(e.amount)}</span>
                      <span style={{ color:TURN_STATUS_COLORS[e.status] }}>{e.status}</span>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main RentTracker modal ────────────────────────────────────────────────────
export default function RentTracker({ propertyId, propertyAddress, unitCount, open, onClose, onRentChange }) {
  const [leases, setLeases]   = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)  // null | 'new' | lease obj
  const [expenses, setExpenses]           = useState([])
  const [deletedExpenseIds, setDeletedExpenseIds] = useState([])
  const [expensesSaving, setExpensesSaving] = useState(false)
  const closingDate = null

  useEffect(() => { if (open && propertyId) load() }, [open, propertyId])

  async function load() {
    setLoading(true)
    const [leasesRes, expensesRes] = await Promise.all([
      supabase.from('cashoffer_leases').select('*').eq('property_id', propertyId).order('lease_start', { ascending: false }),
      supabase.from('cashoffer_turn_expenses').select('*').eq('property_id', propertyId).order('created_at', { ascending: true }),
    ])
    setLeases(leasesRes.data || [])
    setExpenses(expensesRes.data || [])
    setDeletedExpenseIds([])
    setLoading(false)
  }

  // Turn expenses — local drafts, committed only on Save
  function addExpense() {
    setExpenses(p => [...p, {
      id: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`, _isNew: true,
      property_id: propertyId, name: '', amount: 0, vendor: '', status: 'Scheduled', lease_id: null,
    }])
  }
  function updateExpense(id, field, value) {
    setExpenses(p => p.map(e => e.id===id ? {...e,[field]:value} : e))
  }
  function removeExpense(id) {
    const e = expenses.find(x => x.id === id)
    if (e && !e._isNew) setDeletedExpenseIds(d => [...d, id])
    setExpenses(p => p.filter(e => e.id!==id))
  }
  async function handleSaveExpenses() {
    setExpensesSaving(true)
    try {
      if (deletedExpenseIds.length) await supabase.from('cashoffer_turn_expenses').delete().in('id', deletedExpenseIds)
      const newOnes = expenses.filter(e => e._isNew).map(({ id, _isNew, ...rest }) => rest)
      const existing = expenses.filter(e => !e._isNew)
      if (newOnes.length) await supabase.from('cashoffer_turn_expenses').insert(newOnes)
      await Promise.all(existing.map(({ id, ...rest }) => supabase.from('cashoffer_turn_expenses').update(rest).eq('id', id)))
      const { data } = await supabase.from('cashoffer_turn_expenses').select('*').eq('property_id', propertyId).order('created_at', { ascending: true })
      setExpenses(data || [])
      setDeletedExpenseIds([])
      onRentChange && onRentChange()
    } catch (err) {
      alert('Something went wrong saving maintenance items: ' + err.message)
    }
    setExpensesSaving(false)
  }
  function handleCancelExpenses() {
    supabase.from('cashoffer_turn_expenses').select('*').eq('property_id', propertyId).order('created_at', { ascending: true })
      .then(({ data }) => { setExpenses(data || []); setDeletedExpenseIds([]) })
  }

  async function saveLease(form) {
    const payload = {
      property_id:    propertyId,
      unit_label:     form.unit_label || 'Main',
      tenant_name:    form.tenant_name || null,
      tenant_phone:   form.tenant_phone || null,
      tenant_email:   form.tenant_email || null,
      rent_amount:    parseFloat(form.rent_amount) || 0,
      lease_start:    form.lease_start || null,
      lease_end:      form.lease_end   || null,
      status:         form.status || 'Active',
      deposit_amount: parseFloat(form.deposit_amount) || null,
      notes:          form.notes || null,
    }

    if (form.id) {
      await supabase.from('cashoffer_leases').update(payload).eq('id', form.id)
    } else {
      await supabase.from('cashoffer_leases').insert(payload)
    }
    // No more auto-generated monthly rows — exceptions are logged on demand from the month strip.

    setEditing(null)
    load()
    onRentChange && onRentChange()
  }

  async function deleteLease(id) {
    if (!confirm('Delete this lease and all its logged exceptions?')) return
    await supabase.from('cashoffer_leases').delete().eq('id', id)
    setEditing(null)
    load()
    onRentChange && onRentChange()
  }

  const activeLeases    = leases.filter(l=>l.status==='Active'||l.status==='Month-to-Month')
  const totalMonthlyRent= activeLeases.reduce((s,l)=>s+(parseFloat(l.rent_amount)||0),0)

  // Group leases by unit label — current lease is the one still open (no actual_end_date).
  // If every lease for a unit has ended, that unit is vacant: hollow "Add Lease" slot,
  // with its full history still reachable as collapsed Past Lease cards underneath.
  function unitSortKey(label) {
    const m = label.match(/(\d+)/)
    return m ? parseInt(m[1]) : 0
  }
  const groups = {}
  leases.forEach(l => {
    const key = (l.unit_label || 'Main').trim() || 'Main'
    if (!groups[key]) groups[key] = []
    groups[key].push(l)
  })
  const unitLabels = Object.keys(groups).sort((a,b) => unitSortKey(a) - unitSortKey(b) || a.localeCompare(b))
  const unitSlots = unitLabels.map(label => {
    const rows = groups[label]
    const openLease = rows.find(r => !r.actual_end_date)
    const current = openLease || null
    const past = openLease ? rows.filter(r => r.id !== current.id) : rows
    return { label, current, past }
  })
  const slotCount = Math.max(unitCount || 0, unitSlots.length)
  for (let i = unitSlots.length; i < slotCount; i++) {
    unitSlots.push({ label:`Unit ${i+1}`, current:null, past:[] })
  }
  // Current lease per unit, for the Maintenance table's Unit dropdown — tagging maintenance
  // to a specific past tenancy doesn't make sense, so only currently-open leases are offered.
  const currentLeaseByUnit = unitSlots.filter(s => s.current).map(s => s.current)

  if (!open) return null

  return (
    <Modal title={`Lease Tracker — ${propertyAddress?.split(',')[0] || ''}`} onClose={onClose} width={1240}>
      {loading ? (
        <div style={{ textAlign:'center', padding:32, color:'#B8892A', fontSize:24 }}>⟳</div>
      ) : editing ? (
        <>
          <div style={{ fontSize:13, fontWeight:700, color:'#2C2C2C', marginBottom:16 }}>
            {!editing?.id ? 'Add Lease' : 'Edit Lease'}
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
          {leases.length > 0 && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:20 }}>
              {[
                { label:'Active Leases',    value:activeLeases.length,                              color:'#3B6D11' },
                { label:'Monthly Rent',     value:totalMonthlyRent>0?fmtK(totalMonthlyRent):'—',    color:'#B8892A' },
                { label:'Total Units',      value:unitSlots.length,                                 color:'#2C2C2C' },
              ].map(({label,value,color})=>(
                <div key={label} style={{ background:'#FAFAF8', borderRadius:8, padding:'10px 14px', border:'0.5px solid #D6D2CA', textAlign:'center' }}>
                  <div style={{ fontSize:9, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.7, marginBottom:3 }}>{label}</div>
                  <div style={{ fontSize:20, fontWeight:700, fontFamily:'monospace', color }}>{value}</div>
                </div>
              ))}
            </div>
          )}

          {leases.length === 0 && !unitCount ? (
            <div style={{ background:'#F0EDE6', borderRadius:8, padding:'24px', textAlign:'center', marginBottom:16 }}>
              <div style={{ fontSize:13, color:'#6b7280', marginBottom:10 }}>No leases for this property yet.</div>
              <Btn onClick={()=>setEditing('new')}>+ Add Lease</Btn>
            </div>
          ) : (
            unitSlots.map(slot => (
              <div key={slot.label} style={{ marginBottom:20 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'#2C2C2C', marginBottom:8 }}>{slot.label}</div>

                {slot.current ? (
                  <LeaseCard
                    lease={slot.current}
                    onEdit={setEditing}
                    allExpenses={expenses}
                    onSaved={()=>{ load(); onRentChange && onRentChange() }}
                    defaultExpanded={true}
                  />
                ) : (
                  <div style={{
                    background:'transparent', borderRadius:8, padding:'18px 14px', marginBottom: slot.past.length>0 ? 8 : 0,
                    border:'2px dashed #D6D2CA', display:'flex', alignItems:'center', justifyContent:'center', gap:12,
                  }}>
                    <div style={{ fontSize:12, color:'#9ca3af', fontWeight:600 }}>{slot.label} — vacant</div>
                    <button onClick={()=>setEditing({ unit_label: slot.label })} style={{ background:'none', border:'1px solid #3B6D11', borderRadius:6, padding:'5px 12px', fontSize:11, fontWeight:700, cursor:'pointer', color:'#3B6D11', fontFamily:'inherit' }}>
                      + Add Lease — {slot.label}
                    </button>
                  </div>
                )}

                {slot.past.length > 0 && (
                  <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:8 }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.7 }}>
                      Past Leases ({slot.past.length})
                    </div>
                    {slot.past.map(p => (
                      <LeaseCard
                        key={p.id}
                        lease={p}
                        onEdit={setEditing}
                        allExpenses={expenses}
                        onSaved={()=>{ load(); onRentChange && onRentChange() }}
                        defaultExpanded={false}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))
          )}

          {leases.length > 0 && (
            <div style={{ paddingTop:12, borderTop:'1px solid #F0EDE6' }}>
              <Btn variant="outline" onClick={()=>setEditing('new')} style={{ fontSize:12 }}>
                + Add Another Lease
              </Btn>
              <span style={{ fontSize:11, color:'#9ca3af', marginLeft:10 }}>
                Add a new unit or a new tenant for an existing unit.
              </span>
            </div>
          )}

          {/* Maintenance */}
          <div style={{ marginTop:24, paddingTop:16, borderTop:'1px solid #F0EDE6' }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#2C2C2C', marginBottom:4 }}>Maintenance</div>
            <div style={{ fontSize:11, color:'#9ca3af', marginBottom:8 }}>Ongoing upkeep and turnover costs — cleaning, repairs, touch-up paint, etc. Tag a unit to show it in that lease's history.</div>
            {expenses.length > 0 && (
              <div style={{ border:'0.5px solid #D6D2CA', borderRadius:8, overflow:'hidden', marginBottom:8 }}>
                <div style={{ display:'grid', gridTemplateColumns:'1.6fr 1.2fr 0.9fr 0.9fr 0.9fr 0.9fr 1.1fr 0.9fr 28px', gap:12, background:'#F0EDE6', padding:'8px 10px' }}>
                  {['Name','Vendor','Unit','Status','Amount','Paid By','Date Paid','Interest',''].map(h=><div key={h} style={{ fontSize:10, fontWeight:600, color:'#6b7280', textTransform:'uppercase' }}>{h}</div>)}
                </div>
                {expenses.map((e,i) => (
                  <div key={e.id} style={{ display:'grid', gridTemplateColumns:'1.6fr 1.2fr 0.9fr 0.9fr 0.9fr 0.9fr 1.1fr 0.9fr 28px', gap:12, padding:'8px 10px', alignItems:'center', background:i%2===0?'#fff':'#FAFAF8', borderTop:i>0?'0.5px solid #F0EDE6':'none' }}>
                    <input style={{ ...inp, fontSize:12, padding:'4px 6px', marginRight:6 }} value={e.name||''} onChange={ev=>updateExpense(e.id,'name',ev.target.value)} />
                    <input style={{ ...inp, fontSize:12, padding:'4px 6px', marginRight:6 }} value={e.vendor||''} onChange={ev=>updateExpense(e.id,'vendor',ev.target.value)} />
                    <select value={e.lease_id||''} onChange={ev=>updateExpense(e.id,'lease_id',ev.target.value||null)} style={{ border:'0.5px solid #D6D2CA', borderRadius:4, padding:'4px 6px', fontSize:11, fontFamily:'inherit', background:'#fff', cursor:'pointer', marginRight:6 }}>
                      <option value="">—</option>
                      {currentLeaseByUnit.map(l=><option key={l.id} value={l.id}>{l.unit_label||'Unit'}</option>)}
                    </select>
                    <select style={{ border:'0.5px solid #D6D2CA', borderRadius:4, padding:'4px 6px', fontSize:11, color:TURN_STATUS_COLORS[e.status], fontWeight:700, marginRight:6, background:'#fff' }} value={e.status||'Scheduled'} onChange={ev=>updateExpense(e.id,'status',ev.target.value)}>
                      {TURN_STATUS_OPTIONS.map(s=><option key={s} value={s}>{s}</option>)}
                    </select>
                    <div style={{ position:'relative', marginRight:6 }}>
                      <span style={{ position:'absolute', left:6, top:'50%', transform:'translateY(-50%)', fontSize:12, color:'#9ca3af', fontFamily:'monospace', pointerEvents:'none' }}>$</span>
                      <input style={{ ...monoInp, fontSize:12, padding:'4px 6px 4px 16px', textAlign:'right', width:'100%' }} type="number" value={e.amount??''} onChange={ev=>updateExpense(e.id,'amount', ev.target.value===''?null:parseFloat(ev.target.value)||0)} />
                    </div>
                    <select value={e.paid_by||''} onChange={ev=>updateExpense(e.id,'paid_by',ev.target.value||null)} style={{ border:'0.5px solid #D6D2CA', borderRadius:4, padding:'4px 6px', fontSize:11, fontFamily:'inherit', background:'#fff', cursor:'pointer', marginRight:6 }}>
                      <option value="">—</option>
                      {PAID_BY_OPTIONS.map(p=><option key={p} value={p}>{p}</option>)}
                    </select>
                    {PARTNERS.includes(e.paid_by) ? (
                      <PartnerLedger
                        sourceType="turn_expense" sourceId={e.id}
                        originalAmount={e.amount}
                        datePaid={e.date_paid}
                        onDatePaidChange={v=>updateExpense(e.id,'date_paid',v)}
                        closingDate={closingDate}
                      />
                    ) : <NoPartnerCells />}
                    <button onClick={()=>removeExpense(e.id)} style={{ background:'none', border:'none', color:'#D6D2CA', cursor:'pointer', fontSize:18, padding:0 }}>×</button>
                  </div>
                ))}
              </div>
            )}
            <button onClick={addExpense} style={{ background:'transparent', border:'1px dashed #D6D2CA', borderRadius:6, padding:'7px', color:'#9ca3af', fontSize:12, cursor:'pointer', fontFamily:'inherit', width:'100%', marginBottom:12 }}>+ Add Maintenance Item</button>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
              <Btn variant="outline" onClick={handleCancelExpenses}>Cancel</Btn>
              <Btn onClick={handleSaveExpenses} disabled={expensesSaving}>{expensesSaving ? 'Saving…' : 'Save'}</Btn>
            </div>
          </div>
        </>
      )}
    </Modal>
  )
}


