import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase.js'
import { Modal, Field, FieldRow, inp, monoInp, Btn, fmt, DatePicker, PAID_BY_OPTIONS, PARTNERS, calcOwed } from './ui.jsx'

// ── Amortization engine ───────────────────────────────────────────────────────
// Returns array of { month, payment, principal, interest, balance } for every month
function buildSchedule(loanAmount, annualRate, termMonths, monthlyOverride) {
  const P = parseFloat(loanAmount) || 0
  const r = (parseFloat(annualRate) || 0) / 100 / 12
  const n = parseInt(termMonths) || 0
  if (!P || !n) return []

  let M
  if (monthlyOverride && parseFloat(monthlyOverride) > 0) {
    M = parseFloat(monthlyOverride)
  } else if (r === 0) {
    M = P / n
  } else {
    M = P * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
  }

  const schedule = []
  let balance = P
  for (let i = 1; i <= n; i++) {
    const interest  = r > 0 ? balance * r : 0
    const principal = Math.min(M - interest, balance)
    balance = Math.max(0, balance - principal)
    schedule.push({ month: i, payment: M, principal, interest, balance })
  }
  return schedule
}

function groupByYear(schedule) {
  const years = []
  for (let y = 0; y < Math.ceil(schedule.length / 12); y++) {
    const months = schedule.slice(y * 12, (y + 1) * 12)
    years.push({
      year: y + 1,
      totalPayment:   months.reduce((s, m) => s + m.payment, 0),
      totalPrincipal: months.reduce((s, m) => s + m.principal, 0),
      totalInterest:  months.reduce((s, m) => s + m.interest, 0),
      endBalance:     months[months.length - 1]?.balance || 0,
      months,
    })
  }
  return years
}

function currentBalance(schedule, startDate) {
  if (!startDate || !schedule.length) return null
  const start = new Date(startDate + 'T12:00:00')
  const now   = new Date()
  const monthsElapsed = Math.max(0,
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth()   - start.getMonth())
  )
  const idx = Math.min(monthsElapsed, schedule.length - 1)
  return schedule[idx]?.balance ?? null
}

// Adds n months to a 'YYYY-MM-DD' string, parsed manually (no timezone drift).
function addMonths(dateStr, n) {
  if (!dateStr) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  const total = (m - 1) + n
  const newY = y + Math.floor(total / 12)
  const newM = (total % 12) + 1
  return `${newY}-${String(newM).padStart(2,'0')}-${String(d).padStart(2,'0')}`
}

// Due date for a given schedule month index (1-based), anchored on the loan's chosen
// due day rather than whatever day of the month the loan happened to start on.
function dueDateForMonth(loanStart, monthIndex, dueDay) {
  if (!loanStart) return null
  const [y, m] = loanStart.split('-').map(Number)
  // First payment always falls in the month AFTER closing — you can't owe a payment
  // before the loan has even funded, regardless of which day of the month is chosen.
  const total = (m - 1) + monthIndex
  const newY = y + Math.floor(total / 12)
  const newM = (total % 12) + 1
  const day = Math.min(dueDay || 1, 28)
  return `${newY}-${String(newM).padStart(2,'0')}-${String(day).padStart(2,'0')}`
}

// The next due date at or after today — schedule display is truncated to this,
// so a 30-year loan doesn't dump 360 rows on screen.
function nextDueCutoff(loanStart, dueDay) {
  const today = new Date().toISOString().slice(0,10)
  for (let i = 1; i <= 600; i++) {
    const d = dueDateForMonth(loanStart, i, dueDay)
    if (d && d >= today) return d
  }
  return null
}

// ── Empty loan form ───────────────────────────────────────────────────────────
const EMPTY_LOAN = {
  lender_name: '', bank: '', loan_type: 'Conventional',
  loan_amount: '', interest_rate: '', loan_term_months: '',
  loan_start_date: '', monthly_payment: '', notes: '', due_day: 1,
}
function ordinal(n) {
  const s = ['th','st','nd','rd']
  const v = n % 100
  return n + (s[(v-20)%10] || s[v] || s[0])
}
const LOAN_TYPES = ['Hard Money', 'Conventional', 'Private', 'HELOC', 'Other']
const TYPE_COLOR  = {
  'Hard Money':'#B91C1C', 'Conventional':'#2D6FAF',
  'Private':'#6b21a8', 'HELOC':'#D97825', 'Other':'#9ca3af',
}

// Compact, view-only interest readout for a payment row (Bob/Eric only)
function InterestBadge({ paymentId, amount, datePaid }) {
  const [interest, setInterest] = useState(null)
  useEffect(() => {
    if (!datePaid || !amount) { setInterest(0); return }
    supabase.from('cashoffer_partner_repayments').select('*').eq('source_type','loan_payment').eq('source_id', paymentId)
      .then(({ data }) => {
        const { accruedInterest } = calcOwed(amount, datePaid, data||[], new Date())
        setInterest(accruedInterest)
      })
  }, [paymentId, amount, datePaid])
  if (interest === null) return null
  return interest > 0 ? <span style={{ fontSize:10, color:'#B8892A', fontWeight:700 }}>+{fmt(interest)} int.</span> : null
}

// ── Log an exception for a due date: Partner Paid or Skipped ─────────────────
const LOAN_EXC_TYPES = ['Partner Paid', 'Skipped']
const LOAN_EXC_COLOR = { 'Partner Paid':'#2D6FAF', 'Skipped':'#B91C1C' }

function LoanExceptionForm({ dueDate, existing, scheduledAmount, onSave, onClear, onCancel }) {
  const [type, setType] = useState(existing?.status || 'Partner Paid')
  const [paidBy, setPaidBy] = useState(existing?.paid_by || 'Bob')
  const [datePaid, setDatePaid] = useState(existing?.date_paid || dueDate)
  const [notes, setNotes] = useState(existing?.notes || '')

  return (
    <div style={{ background:'#FAFAF8', border:'0.5px solid #D6D2CA', borderRadius:8, padding:12, margin:'0 16px 8px 28px' }}>
      <div style={{ fontSize:12, fontWeight:700, color:'#2C2C2C', marginBottom:8 }}>{dueDate} — Log Exception</div>
      <div style={{ display:'flex', gap:8, marginBottom:8 }}>
        {LOAN_EXC_TYPES.map(t=>(
          <button key={t} onClick={()=>setType(t)} style={{
            border:`1px solid ${type===t?LOAN_EXC_COLOR[t]:'#D6D2CA'}`,
            background: type===t ? LOAN_EXC_COLOR[t]+'18' : '#fff',
            color: type===t ? LOAN_EXC_COLOR[t] : '#6b7280',
            borderRadius:6, padding:'5px 12px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit',
          }}>{t}</button>
        ))}
      </div>
      {type === 'Partner Paid' ? (
        <FieldRow>
          <Field label="Paid By">
            <select style={inp} value={paidBy} onChange={e=>setPaidBy(e.target.value)}>
              {PARTNERS.map(p=><option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Date Paid">
            <DatePicker style={inp} value={datePaid} onChange={setDatePaid} />
          </Field>
        </FieldRow>
      ) : (
        <div style={{ fontSize:11, color:'#6b7280', marginBottom:8 }}>
          Marks {fmt(scheduledAmount)} as skipped/missed for this due date.
        </div>
      )}
      <Field label="Notes">
        <input style={inp} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Optional" />
      </Field>
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:10 }}>
        {existing && <Btn variant="danger" onClick={onClear} style={{ fontSize:11 }}>Clear (Assume Paid)</Btn>}
        <div style={{ display:'flex', gap:8, marginLeft:'auto' }}>
          <Btn variant="outline" onClick={onCancel} style={{ fontSize:11 }}>Cancel</Btn>
          <Btn onClick={()=>onSave({ type, paid_by: paidBy, date_paid: datePaid, notes })} style={{ fontSize:11 }}>Save</Btn>
        </div>
      </div>
    </div>
  )
}

// ── Amortization + integrated payment tracking ────────────────────────────────
function AmortizationTable({ schedule, startDate, dueDay, loanId, onTotals }) {
  const [expandedYear, setExpandedYear] = useState(1)
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingDueDate, setEditingDueDate] = useState(null)
  const years = useMemo(() => groupByYear(schedule), [schedule])
  const bal   = currentBalance(schedule, startDate)
  const cutoff = useMemo(() => nextDueCutoff(startDate, dueDay), [startDate, dueDay])

  // Only show elapsed months plus the next upcoming due date — not the entire loan term.
  const visibleYears = useMemo(() => {
    if (!cutoff) return years
    return years
      .map(yr => ({ ...yr, months: yr.months.filter(m => dueDateForMonth(startDate, m.month, dueDay) <= cutoff) }))
      .filter(yr => yr.months.length > 0)
  }, [years, cutoff, startDate, dueDay])

  useEffect(() => { if (loanId) load() }, [loanId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('cashoffer_loan_payments').select('*').eq('loan_id', loanId)
    setPayments(data || [])
    setLoading(false)
  }

  // Report totals up to the parent, treating every elapsed month as paid (by BPV, unless
  // flagged otherwise) except ones explicitly marked Skipped.
  useEffect(() => {
    const today = new Date().toISOString().slice(0,10)
    const excByDate = {}
    payments.forEach(p => { excByDate[p.due_date] = p })

    const byPerson = { BPV:0, Bob:0, Eric:0 }
    let total = 0, totalInterest = 0, count = 0

    schedule.forEach(m => {
      const d = dueDateForMonth(startDate, m.month, dueDay)
      if (!d || d > today) return
      const exc = excByDate[d]
      if (exc && exc.status === 'Skipped') return
      const payer = (exc && exc.status === 'Partner Paid') ? exc.paid_by : 'BPV'
      byPerson[payer] = (byPerson[payer]||0) + m.payment
      total += m.payment
      totalInterest += m.interest
      count++
    })

    if (onTotals) onTotals({ total, byPerson, count, totalInterest })
  }, [payments, schedule, startDate, dueDay]) // eslint-disable-line react-hooks/exhaustive-deps

  function findPayment(dueDate) {
    return payments.find(p => p.due_date === dueDate) || null
  }

  // payload: { type:'Partner Paid', paid_by, date_paid } | { type:'Skipped', notes }
  async function saveException(dueDate, scheduledAmount, payload) {
    const existing = findPayment(dueDate)
    const row = {
      status:    payload.type,
      paid_by:   payload.type === 'Partner Paid' ? payload.paid_by : null,
      date_paid: payload.type === 'Partner Paid' ? (payload.date_paid || dueDate) : null,
      notes:     payload.notes || null,
    }
    if (existing) {
      await supabase.from('cashoffer_loan_payments').update(row).eq('id', existing.id)
      setPayments(p => p.map(x => x.id===existing.id ? {...x, ...row} : x))
    } else {
      const { data } = await supabase.from('cashoffer_loan_payments')
        .insert({ loan_id: loanId, due_date: dueDate, amount: scheduledAmount, ...row })
        .select().single()
      if (data) setPayments(p => [...p, data])
    }
    setEditingDueDate(null)
  }

  async function clearException(dueDate) {
    const existing = findPayment(dueDate)
    if (!existing) return
    await supabase.from('cashoffer_loan_payments').delete().eq('id', existing.id)
    setPayments(p => p.filter(x => x.id !== existing.id))
    setEditingDueDate(null)
  }

  if (!years.length) return null

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
        <div style={{ fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:0.8 }}>
          Payment Schedule — assumed paid unless flagged
        </div>
        {bal !== null && (
          <div style={{ fontSize:11, color:'#2D6FAF', fontWeight:700 }}>
            Current Balance: <span style={{ fontFamily:'monospace' }}>{fmt(bal)}</span>
          </div>
        )}
      </div>

      <div style={{ border:'0.5px solid #D6D2CA', borderRadius:8, overflow:'hidden' }}>
        <div style={{ display:'grid', gridTemplateColumns:'60px 1fr 1fr 1fr 1fr 24px', background:'#2C2C2C', padding:'8px 12px', gap:0 }}>
          {['Year','Payment','Principal','Interest','Balance',''].map(h=>(
            <div key={h} style={{ fontSize:10, fontWeight:700, color:'#B8892A', textTransform:'uppercase', letterSpacing:0.7, textAlign: h==='Year'?'left':'right' }}>{h}</div>
          ))}
        </div>

        {visibleYears.map((yr, i) => {
          const isExpanded = expandedYear === yr.year
          const isCurrent  = startDate ? (() => {
            const start = new Date(startDate + 'T12:00:00')
            const now   = new Date()
            const elapsed = (now.getFullYear()-start.getFullYear())*12+(now.getMonth()-start.getMonth())
            return elapsed >= (yr.year-1)*12 && elapsed < yr.year*12
          })() : false

          return (
            <div key={yr.year}>
              <div
                onClick={() => setExpandedYear(isExpanded ? null : yr.year)}
                style={{
                  display:'grid', gridTemplateColumns:'60px 1fr 1fr 1fr 1fr 24px',
                  padding:'8px 12px', gap:0, cursor:'pointer',
                  background: isCurrent ? '#fef9f0' : i%2===0 ? '#fff' : '#FAFAF8',
                  borderTop: i>0 ? '0.5px solid #F0EDE6' : 'none',
                  borderLeft: isCurrent ? '3px solid #B8892A' : '3px solid transparent',
                }}
                onMouseEnter={e=>{ if(!isCurrent) e.currentTarget.style.background='#fef9f0' }}
                onMouseLeave={e=>{ if(!isCurrent) e.currentTarget.style.background=i%2===0?'#fff':'#FAFAF8' }}
              >
                <div style={{ fontSize:12, fontWeight:isCurrent?700:600, color:isCurrent?'#B8892A':'#2C2C2C' }}>
                  Yr {yr.year}{isCurrent?' ←':''}
                </div>
                <div style={{ fontSize:12, fontFamily:'monospace', textAlign:'right', color:'#6b7280' }}>{fmt(yr.totalPayment)}</div>
                <div style={{ fontSize:12, fontFamily:'monospace', textAlign:'right', color:'#3B6D11' }}>{fmt(yr.totalPrincipal)}</div>
                <div style={{ fontSize:12, fontFamily:'monospace', textAlign:'right', color:'#B91C1C' }}>{fmt(yr.totalInterest)}</div>
                <div style={{ fontSize:12, fontFamily:'monospace', textAlign:'right', fontWeight:600 }}>{fmt(yr.endBalance)}</div>
                <div style={{ fontSize:10, color:'#9ca3af', textAlign:'right' }}>{isExpanded?'▲':'▼'}</div>
              </div>

              {isExpanded && (
                <div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr 1.6fr', gap:10, padding:'8px 16px 8px 28px', background:'#F0EDE6', borderTop:'0.5px solid #D6D2CA' }}>
                    {['Due Date','Payment','Principal','Interest','Balance','Status'].map((h,i)=>(
                      <div key={h} style={{ fontSize:9, fontWeight:700, color:'#6b7280', textTransform:'uppercase', textAlign: i>=1&&i<=4 ? 'right' : 'left' }}>{h}</div>
                    ))}
                  </div>
                  {yr.months.map(m=>{
                    const dueDate = dueDateForMonth(startDate, m.month, dueDay)
                    const payment = dueDate ? findPayment(dueDate) : null
                    const isEditing = editingDueDate === dueDate
                    return (
                      <div key={m.month}>
                        <div style={{
                          display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr 1.6fr', gap:10,
                          padding:'8px 16px 8px 28px', alignItems:'center',
                          background:'#fff', borderTop:'0.5px solid #F0EDE6',
                        }}>
                          <div style={{ fontSize:11, color:'#6b7280' }}>{dueDate || `Mo ${m.month}`}</div>
                          <div style={{ fontSize:11, fontFamily:'monospace', textAlign:'right', color:'#6b7280' }}>{fmt(m.payment)}</div>
                          <div style={{ fontSize:11, fontFamily:'monospace', textAlign:'right', color:'#3B6D11' }}>{fmt(m.principal)}</div>
                          <div style={{ fontSize:11, fontFamily:'monospace', textAlign:'right', color:'#B91C1C' }}>{fmt(m.interest)}</div>
                          <div style={{ fontSize:11, fontFamily:'monospace', textAlign:'right' }}>{fmt(m.balance)}</div>
                          <div style={{ display:'flex', alignItems:'center', gap:8, justifyContent:'flex-end' }}>
                            {payment ? (
                              <>
                                <span style={{
                                  fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:4,
                                  background: (payment.status==='Skipped' ? '#B91C1C' : '#2D6FAF')+'18',
                                  color: payment.status==='Skipped' ? '#B91C1C' : '#2D6FAF',
                                }}>
                                  {payment.status === 'Skipped' ? 'Skipped' : `Paid by ${payment.paid_by}`}
                                </span>
                                {payment.status === 'Partner Paid' && <InterestBadge paymentId={payment.id} amount={payment.amount} datePaid={payment.date_paid} />}
                                <button onClick={()=>setEditingDueDate(isEditing ? null : dueDate)} style={{ background:'none', border:'1px solid #D6D2CA', borderRadius:4, padding:'2px 8px', fontSize:10, cursor:'pointer', color:'#6b7280', fontFamily:'inherit' }}>Edit</button>
                              </>
                            ) : (
                              <>
                                <span style={{ fontSize:11, color:'#9ca3af' }}>Paid (assumed)</span>
                                <button onClick={()=>setEditingDueDate(isEditing ? null : dueDate)} style={{ background:'none', border:'1px solid #D6D2CA', borderRadius:4, padding:'2px 8px', fontSize:10, cursor:'pointer', color:'#6b7280', fontFamily:'inherit' }}>Flag</button>
                              </>
                            )}
                          </div>
                        </div>
                        {isEditing && (
                          <LoanExceptionForm
                            dueDate={dueDate}
                            existing={payment}
                            scheduledAmount={m.payment}
                            onSave={(payload)=>saveException(dueDate, m.payment, payload)}
                            onClear={()=>clearException(dueDate)}
                            onCancel={()=>setEditingDueDate(null)}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        <div style={{ display:'grid', gridTemplateColumns:'60px 1fr 1fr 1fr 1fr 24px', padding:'8px 12px', gap:0, background:'#2C2C2C', borderTop:'2px solid #B8892A' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#B8892A', textTransform:'uppercase' }}>Full-Term Total</div>
          <div style={{ fontSize:12, fontFamily:'monospace', textAlign:'right', color:'#fff', fontWeight:700 }}>{fmt(years.reduce((s,y)=>s+y.totalPayment,0))}</div>
          <div style={{ fontSize:12, fontFamily:'monospace', textAlign:'right', color:'#3B6D11', fontWeight:700 }}>{fmt(years.reduce((s,y)=>s+y.totalPrincipal,0))}</div>
          <div style={{ fontSize:12, fontFamily:'monospace', textAlign:'right', color:'#B91C1C', fontWeight:700 }}>{fmt(years.reduce((s,y)=>s+y.totalInterest,0))}</div>
          <div style={{ fontSize:12, fontFamily:'monospace', textAlign:'right', color:'#9ca3af' }}>$0</div>
          <div />
        </div>
      </div>
    </div>
  )
}

// ── Loan edit form (controlled — parent owns the state so Save/Cancel can live in the sticky footer) ──
function LoanForm({ form, setForm, isNew }) {
  const set = k => e => setForm(f=>({...f,[k]:e.target.value}))

  const schedule = useMemo(() =>
    buildSchedule(form.loan_amount, form.interest_rate, form.loan_term_months, form.monthly_payment),
    [form.loan_amount, form.interest_rate, form.loan_term_months, form.monthly_payment]
  )
  const computedPayment = schedule[0]?.payment || null
  const totalInterest   = schedule.reduce((s,m)=>s+m.interest,0)

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <FieldRow>
        <Field label="Lender Name"><input style={inp} value={form.lender_name} onChange={set('lender_name')} /></Field>
        <Field label="Bank / Institution"><input style={inp} value={form.bank} onChange={set('bank')} /></Field>
      </FieldRow>
      <FieldRow>
        <Field label="Loan Type">
          <select style={inp} value={form.loan_type} onChange={set('loan_type')}>
            {LOAN_TYPES.map(t=><option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Loan Start Date"><DatePicker style={inp} value={form.loan_start_date} onChange={set('loan_start_date')} /></Field>
      </FieldRow>
      <FieldRow>
        <Field label="Loan Amount ($)"><input style={monoInp} type="number" value={form.loan_amount} onChange={set('loan_amount')} /></Field>
        <Field label="Interest Rate (%)"><input style={monoInp} type="number" step="0.01" value={form.interest_rate} onChange={set('interest_rate')} /></Field>
        <Field label="Term (months)"><input style={monoInp} type="number" value={form.loan_term_months} onChange={set('loan_term_months')} /></Field>
      </FieldRow>
      <FieldRow>
        <Field label="Payment Due Day">
          <select style={inp} value={form.due_day||1} onChange={set('due_day')}>
            {Array.from({length:28}, (_,i)=>i+1).map(d=><option key={d} value={d}>{ordinal(d)}</option>)}
          </select>
        </Field>
        <div />
      </FieldRow>
      <Field label="Monthly Payment Override ($)">
        <input style={monoInp} type="number" value={form.monthly_payment} onChange={set('monthly_payment')} />
      </Field>

      {computedPayment && (
        <div style={{ background:'#f0f6ff', borderRadius:8, padding:'12px 14px', display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
          <div>
            <div style={{ fontSize:10, color:'#6b7280', textTransform:'uppercase', letterSpacing:0.7, marginBottom:3 }}>Monthly Payment</div>
            <div style={{ fontSize:16, fontWeight:700, fontFamily:'monospace', color:'#2D6FAF' }}>{fmt(computedPayment)}</div>
          </div>
          <div>
            <div style={{ fontSize:10, color:'#6b7280', textTransform:'uppercase', letterSpacing:0.7, marginBottom:3 }}>Total Interest</div>
            <div style={{ fontSize:16, fontWeight:700, fontFamily:'monospace', color:'#B91C1C' }}>{fmt(totalInterest)}</div>
          </div>
          <div>
            <div style={{ fontSize:10, color:'#6b7280', textTransform:'uppercase', letterSpacing:0.7, marginBottom:3 }}>Total Cost</div>
            <div style={{ fontSize:16, fontWeight:700, fontFamily:'monospace', color:'#2C2C2C' }}>{fmt((parseFloat(form.loan_amount)||0)+totalInterest)}</div>
          </div>
        </div>
      )}

      <Field label="Notes"><textarea style={{ ...inp, minHeight:52, resize:'vertical' }} value={form.notes} onChange={set('notes')} /></Field>

      {!isNew && !form.is_active && form.closed_reason === 'Paid Off' && (
        <div style={{ background:'#fff3cd', borderRadius:8, padding:'12px 14px' }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#856404', textTransform:'uppercase', letterSpacing:0.6, marginBottom:10 }}>Correct Payoff Details</div>
          <FieldRow>
            <Field label="Paid Off Date"><DatePicker style={inp} value={form.paid_off_date||''} onChange={set('paid_off_date')} /></Field>
            <Field label="Total Interest Paid ($)"><input style={monoInp} type="number" value={form.total_interest_paid??''} onChange={set('total_interest_paid')} /></Field>
          </FieldRow>
        </div>
      )}
      {!isNew && !form.is_active && form.closed_reason === 'Refinanced' && (
        <div style={{ background:'#fff3cd', borderRadius:8, padding:'12px 14px' }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#856404', textTransform:'uppercase', letterSpacing:0.6, marginBottom:10 }}>Correct Refinance Details</div>
          <Field label="Refinanced Date"><DatePicker style={inp} value={form.refinanced_date||''} onChange={set('refinanced_date')} /></Field>
        </div>
      )}
    </div>
  )
}

// ── Main LoanTracker modal ────────────────────────────────────────────────────
export default function LoanTracker({ propertyId, propertyAddress, open, onClose, initialLoanId }) {
  const [loans, setLoans]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [selection, setSelection] = useState(null)      // null | 'new' | {refinanceFor:id} | loan id (string)
  const [editForm, setEditForm]   = useState(EMPTY_LOAN) // controlled form state, always editable, lives here for the sticky footer
  const [editFormSnapshot, setEditFormSnapshot] = useState(EMPTY_LOAN) // last-saved/loaded values, for the dirty check on backdrop-close
  const [closingId, setClosingId] = useState(null)
  const [payoffTotals, setPayoffTotals] = useState({ total:0, byPerson:{BPV:0,Bob:0,Eric:0}, count:0, totalInterest:0 })
  const [payoffDate, setPayoffDate] = useState(new Date().toISOString().slice(0,10))

  useEffect(() => {
    if (open && propertyId) load()
    if (!open) { setSelection(null); setClosingId(null) }
  }, [open, propertyId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('cashoffer_loans')
      .select('*')
      .eq('property_id', propertyId)
      .order('loan_start_date', { ascending: true })
    setLoans(data || [])
    setLoading(false)
    if (initialLoanId) {
      const found = (data||[]).find(l => l.id === initialLoanId)
      selectLoan(found || 'new')
    } else {
      selectLoan('new')
    }
  }

  function selectLoan(sel) {
    setSelection(sel)
    const next = (sel === 'new' || sel?.refinanceFor) ? EMPTY_LOAN : { ...EMPTY_LOAN, ...sel }
    setEditForm(next)
    setEditFormSnapshot(next)
  }
  function loanFormDirty() {
    return JSON.stringify(editForm) !== JSON.stringify(editFormSnapshot)
  }

  const isNew = selection === 'new' || !!selection?.refinanceFor
  const existingLoan = !isNew && selection ? selection : null

  async function saveLoan() {
    const form = editForm
    const payload = {
      property_id:       propertyId,
      lender_name:       form.lender_name || null,
      bank:              form.bank || null,
      loan_type:         form.loan_type || 'Conventional',
      loan_amount:       parseFloat(form.loan_amount) || 0,
      interest_rate:     parseFloat(form.interest_rate) || 0,
      loan_term_months:  parseInt(form.loan_term_months) || 0,
      loan_start_date:   form.loan_start_date || null,
      monthly_payment:   parseFloat(form.monthly_payment) || null,
      due_day:           parseInt(form.due_day) || 1,
      is_active:         true,
      notes:             form.notes || null,
    }
    if (form.id) {
      await supabase.from('cashoffer_loans').update(payload).eq('id', form.id)
      const { data } = await supabase.from('cashoffer_loans').select('*').eq('id', form.id).single()
      if (data) { setLoans(ls => ls.map(l => l.id===data.id ? data : l)); selectLoan(data) }
    } else if (selection?.refinanceFor) {
      await supabase.from('cashoffer_loans').update({
        is_active: false, closed_reason: 'Refinanced', refinanced_date: new Date().toISOString().split('T')[0],
      }).eq('id', selection.refinanceFor)
      const { data } = await supabase.from('cashoffer_loans').insert(payload).select().single()
      await load()
      if (data) selectLoan(data)
    } else {
      const { data } = await supabase.from('cashoffer_loans').insert(payload).select().single()
      await load()
      if (data) selectLoan(data)
    }
  }

  async function markPaidOff(loan) {
    await supabase.from('cashoffer_loans').update({
      is_active: false, closed_reason: 'Paid Off', paid_off_date: payoffDate,
      total_interest_paid: payoffTotals.totalInterest || 0,
    }).eq('id', loan.id)
    setClosingId(null)
    load()
  }

  async function deleteLoan(id) {
    if (!confirm('Delete this loan record?')) return
    await supabase.from('cashoffer_loans').delete().eq('id', id)
    onClose()
  }

  if (!open) return null

  const footer = (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
      {existingLoan ? (
        <Btn variant="danger" onClick={()=>deleteLoan(existingLoan.id)}>Delete Loan</Btn>
      ) : <span />}
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        {existingLoan?.is_active && (
          <Btn variant={closingId===existingLoan.id ? 'outline' : 'green'} onClick={()=>setClosingId(closingId===existingLoan.id?null:existingLoan.id)}>
            {closingId===existingLoan.id ? 'Cancel Close' : 'Close Loan'}
          </Btn>
        )}
        <Btn variant="outline" onClick={onClose}>Cancel</Btn>
        <Btn onClick={saveLoan}>Save Loan</Btn>
      </div>
    </div>
  )

  return (
    <Modal title={`Loan Tracker — ${propertyAddress?.split(',')[0] || ''}`} onClose={onClose} isDirty={loanFormDirty} hideCloseButton width={1240} footer={footer}>
      {loading ? (
        <div style={{ textAlign:'center', padding:32, color:'#B8892A', fontSize:24 }}>⟳</div>
      ) : (
        <>
          {selection?.refinanceFor && (
            <div style={{ background:'#fff3cd', borderRadius:6, padding:'10px 14px', fontSize:12, color:'#856404', marginBottom:12 }}>
              Saving will mark that loan as refinanced and add this as a new active loan.
            </div>
          )}

          {existingLoan && (
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
              {!existingLoan.is_active && (
                <span style={{ background:'#9ca3af18', color:'#6b7280', border:'1px solid #9ca3af40', borderRadius:4, padding:'2px 8px', fontSize:10, fontWeight:700 }}>{existingLoan.closed_reason || 'Closed'}</span>
              )}
              {!existingLoan.is_active && existingLoan.closed_reason === 'Refinanced' && (
                <span style={{ fontSize:11, color:'#9ca3af' }}>Refinanced {existingLoan.refinanced_date ? new Date(existingLoan.refinanced_date+'T12:00:00').toLocaleDateString('en-US',{month:'short',year:'numeric'}) : ''}</span>
              )}
              {!existingLoan.is_active && existingLoan.closed_reason === 'Paid Off' && (
                <span style={{ fontSize:11, color:'#9ca3af' }}>Paid Off {existingLoan.paid_off_date ? new Date(existingLoan.paid_off_date+'T12:00:00').toLocaleDateString('en-US',{month:'short',year:'numeric'}) : ''} · Total Interest Paid: {fmt(existingLoan.total_interest_paid)}</span>
              )}
            </div>
          )}

          <LoanForm form={editForm} setForm={setEditForm} isNew={isNew} />

          {closingId === existingLoan?.id && (
            <div style={{ background:'#fff', border:'1px solid #D6D2CA', borderRadius:6, padding:'12px 14px', marginTop:16 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:0.6, marginBottom:8 }}>
                Close This Loan
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:10 }}>
                <div style={{ background:'#F0EDE6', borderRadius:6, padding:'8px 10px' }}>
                  <div style={{ fontSize:9, color:'#9ca3af', textTransform:'uppercase' }}>Total Paid to Date</div>
                  <div style={{ fontSize:14, fontWeight:700, fontFamily:'monospace', color:'#2C2C2C' }}>{fmt(payoffTotals.total)}</div>
                  <div style={{ fontSize:9, color:'#9ca3af' }}>{payoffTotals.count} payment{payoffTotals.count===1?'':'s'} recorded</div>
                </div>
                <div style={{ background:'#F0EDE6', borderRadius:6, padding:'8px 10px' }}>
                  <div style={{ fontSize:9, color:'#9ca3af', textTransform:'uppercase' }}>Interest Paid to Date</div>
                  <div style={{ fontSize:14, fontWeight:700, fontFamily:'monospace', color:'#B91C1C' }}>{fmt(payoffTotals.totalInterest)}</div>
                </div>
                {['BPV','Bob','Eric'].filter(p=>payoffTotals.byPerson[p]>0).map(p=>(
                  <div key={p} style={{ background:'#F0EDE6', borderRadius:6, padding:'8px 10px' }}>
                    <div style={{ fontSize:9, color:'#9ca3af', textTransform:'uppercase' }}>Paid by {p}</div>
                    <div style={{ fontSize:14, fontWeight:700, fontFamily:'monospace', color:'#2C2C2C' }}>{fmt(payoffTotals.byPerson[p])}</div>
                  </div>
                ))}
              </div>
              <FieldRow>
                <Field label="Payoff Date"><DatePicker style={inp} value={payoffDate} onChange={e=>setPayoffDate(e.target.value)} /></Field>
                <div style={{ display:'flex', alignItems:'flex-end', gap:8 }}>
                  <button onClick={()=>markPaidOff(existingLoan)} style={{ background:'#3B6D11', color:'#fff', border:'none', borderRadius:6, padding:'8px 14px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', flex:1 }}>Mark Paid Off</button>
                  <button onClick={()=>{ selectLoan({ refinanceFor: existingLoan.id }); setClosingId(null) }} style={{ background:'#2D6FAF', color:'#fff', border:'none', borderRadius:6, padding:'8px 14px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', flex:1 }}>Refinance Instead</button>
                </div>
              </FieldRow>
            </div>
          )}

          {existingLoan && (
            <AmortizationTable
              schedule={buildSchedule(editForm.loan_amount, editForm.interest_rate, editForm.loan_term_months, editForm.monthly_payment)}
              startDate={editForm.loan_start_date}
              dueDay={editForm.due_day}
              loanId={existingLoan.id}
              onTotals={setPayoffTotals}
            />
          )}
        </>
      )}
    </Modal>
  )
}

