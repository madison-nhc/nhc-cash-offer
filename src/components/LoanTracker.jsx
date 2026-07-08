import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase.js'
import { Modal, Field, FieldRow, inp, monoInp, Btn, fmt, fmtK, DatePicker, PAID_BY_OPTIONS, PARTNERS, PartnerLedger, NoPartnerCells } from './ui.jsx'

// ── Amortization engine ───────────────────────────────────────────────────────
// Returns array of { month, payment, principal, interest, balance } for every month
function buildSchedule(loanAmount, annualRate, termMonths, monthlyOverride) {
  const P = parseFloat(loanAmount) || 0
  const r = (parseFloat(annualRate) || 0) / 100 / 12
  const n = parseInt(termMonths) || 0
  if (!P || !n) return []

  // Monthly payment — use override if provided, else compute
  let M
  if (monthlyOverride && parseFloat(monthlyOverride) > 0) {
    M = parseFloat(monthlyOverride)
  } else if (r === 0) {
    M = P / n  // zero-interest
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

// Group monthly schedule into years
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

// Compute current balance based on loan_start_date and today
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

// ── Empty loan form ───────────────────────────────────────────────────────────
const EMPTY_LOAN = {
  lender_name: '', bank: '', loan_type: 'Conventional',
  loan_amount: '', interest_rate: '', loan_term_months: '',
  loan_start_date: '', monthly_payment: '', notes: '',
}
const LOAN_TYPES = ['Hard Money', 'Conventional', 'Private', 'HELOC', 'Other']
const TYPE_COLOR  = {
  'Hard Money':'#B91C1C', 'Conventional':'#2D6FAF',
  'Private':'#6b21a8', 'HELOC':'#D97825', 'Other':'#9ca3af',
}

// ── Sub-components ────────────────────────────────────────────────────────────
function AmortizationTable({ schedule, startDate }) {
  const [expandedYear, setExpandedYear] = useState(null)
  const years = useMemo(() => groupByYear(schedule), [schedule])
  const bal   = currentBalance(schedule, startDate)

  if (!years.length) return null

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
        <div style={{ fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:0.8 }}>
          Amortization Schedule
        </div>
        {bal !== null && (
          <div style={{ fontSize:11, color:'#2D6FAF', fontWeight:700 }}>
            Current Balance: <span style={{ fontFamily:'monospace' }}>{fmt(bal)}</span>
          </div>
        )}
      </div>

      <div style={{ border:'0.5px solid #D6D2CA', borderRadius:8, overflow:'hidden' }}>
        {/* Header */}
        <div style={{ display:'grid', gridTemplateColumns:'60px 1fr 1fr 1fr 1fr 24px', background:'#2C2C2C', padding:'7px 12px', gap:0 }}>
          {['Year','Payment','Principal','Interest','Balance',''].map(h=>(
            <div key={h} style={{ fontSize:10, fontWeight:700, color:'#B8892A', textTransform:'uppercase', letterSpacing:0.7, textAlign: h==='Year'?'left':'right' }}>{h}</div>
          ))}
        </div>

        {years.map((yr, i) => {
          const isExpanded = expandedYear === yr.year
          const isCurrent  = startDate ? (() => {
            const start = new Date(startDate + 'T12:00:00')
            const now   = new Date()
            const elapsed = (now.getFullYear()-start.getFullYear())*12+(now.getMonth()-start.getMonth())
            return elapsed >= (yr.year-1)*12 && elapsed < yr.year*12
          })() : false

          return (
            <div key={yr.year}>
              {/* Year row */}
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

              {/* Expanded months */}
              {isExpanded && yr.months.map(m=>(
                <div key={m.month} style={{
                  display:'grid', gridTemplateColumns:'60px 1fr 1fr 1fr 1fr 24px',
                  padding:'5px 12px 5px 24px', gap:0,
                  background:'#F0EDE6', borderTop:'0.5px solid #D6D2CA',
                }}>
                  <div style={{ fontSize:11, color:'#9ca3af' }}>Mo {m.month}</div>
                  <div style={{ fontSize:11, fontFamily:'monospace', textAlign:'right', color:'#6b7280' }}>{fmt(m.payment)}</div>
                  <div style={{ fontSize:11, fontFamily:'monospace', textAlign:'right', color:'#3B6D11' }}>{fmt(m.principal)}</div>
                  <div style={{ fontSize:11, fontFamily:'monospace', textAlign:'right', color:'#B91C1C' }}>{fmt(m.interest)}</div>
                  <div style={{ fontSize:11, fontFamily:'monospace', textAlign:'right' }}>{fmt(m.balance)}</div>
                  <div />
                </div>
              ))}
            </div>
          )
        })}

        {/* Totals footer */}
        <div style={{ display:'grid', gridTemplateColumns:'60px 1fr 1fr 1fr 1fr 24px', padding:'8px 12px', gap:0, background:'#2C2C2C', borderTop:'2px solid #B8892A' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#B8892A', textTransform:'uppercase' }}>Total</div>
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

function LoanPaymentsLog({ loanId, closingDate }) {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [loanId])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('cashoffer_loan_payments').select('*').eq('loan_id', loanId).order('due_date', { ascending: true })
    setPayments(data || [])
    setLoading(false)
  }

  async function addPayment() {
    const { data } = await supabase.from('cashoffer_loan_payments').insert({ loan_id: loanId, amount: 0, paid_by: 'BPV' }).select().single()
    if (data) setPayments(p => [...p, data])
  }
  async function updatePayment(id, field, value) {
    setPayments(p => p.map(x => x.id===id ? {...x,[field]:value} : x))
    await supabase.from('cashoffer_loan_payments').update({ [field]: value }).eq('id', id)
  }
  async function removePayment(id) {
    await supabase.from('cashoffer_loan_payments').delete().eq('id', id)
    setPayments(p => p.filter(x => x.id!==id))
  }

  if (loading) return null

  return (
    <div style={{ marginTop:16 }}>
      <div style={{ fontSize:11, fontWeight:700, color:'#B8892A', textTransform:'uppercase', letterSpacing:0.8, marginBottom:6 }}>
        Loan Payments — who covered each one
      </div>
      <div style={{ fontSize:10, color:'#9ca3af', marginBottom:8 }}>
        Log each monthly principal+interest payment. If Bob or Eric covered it personally, we track what's owed back to them (that amount + our 10%/yr) separately from the bank's own interest above.
      </div>
      {payments.length > 0 && (
        <div style={{ border:'0.5px solid #D6D2CA', borderRadius:8, overflow:'hidden', marginBottom:8 }}>
          <div style={{ display:'grid', gridTemplateColumns:'110px 90px 90px 115px 90px 24px', background:'#F0EDE6', padding:'6px 10px' }}>
            {['Due Date','Amount','Paid By','Date Paid','Interest',''].map(h=><div key={h} style={{ fontSize:10, fontWeight:600, color:'#6b7280', textTransform:'uppercase' }}>{h}</div>)}
          </div>
          {payments.map((p,i) => (
            <div key={p.id} style={{ display:'grid', gridTemplateColumns:'110px 90px 90px 115px 90px 24px', padding:'6px 10px', alignItems:'center', background:i%2===0?'#fff':'#FAFAF8', borderTop:i>0?'0.5px solid #F0EDE6':'none' }}>
              <DatePicker value={p.due_date||''} onChange={e=>updatePayment(p.id,'due_date',e.target.value)} style={{ fontSize:11, padding:'4px 6px', marginRight:6 }} />
              <div style={{ position:'relative', marginRight:6 }}>
                <span style={{ position:'absolute', left:6, top:'50%', transform:'translateY(-50%)', fontSize:12, color:'#9ca3af', fontFamily:'monospace', pointerEvents:'none' }}>$</span>
                <input style={{ ...monoInp, fontSize:12, padding:'4px 6px 4px 16px', textAlign:'right', width:'100%' }} type="number" value={p.amount??''} onChange={e=>updatePayment(p.id,'amount', e.target.value===''?0:parseFloat(e.target.value)||0)} />
              </div>
              <select value={p.paid_by||'BPV'} onChange={e=>updatePayment(p.id,'paid_by',e.target.value)} style={{ border:'0.5px solid #D6D2CA', borderRadius:4, padding:'4px 6px', fontSize:11, fontFamily:'inherit', background:'#fff', cursor:'pointer', marginRight:6 }}>
                {PAID_BY_OPTIONS.map(o=><option key={o} value={o}>{o}</option>)}
              </select>
              {PARTNERS.includes(p.paid_by) ? (
                <PartnerLedger
                  sourceType="loan_payment" sourceId={p.id}
                  originalAmount={p.amount}
                  datePaid={p.date_paid}
                  onDatePaidChange={v=>updatePayment(p.id,'date_paid',v)}
                  closingDate={closingDate}
                />
              ) : <NoPartnerCells />}
              <button onClick={()=>removePayment(p.id)} style={{ background:'none', border:'none', color:'#D6D2CA', cursor:'pointer', fontSize:18, padding:0 }}>×</button>
            </div>
          ))}
        </div>
      )}
      <button onClick={addPayment} style={{ background:'transparent', border:'1px dashed #D6D2CA', borderRadius:6, padding:'7px', color:'#9ca3af', fontSize:12, cursor:'pointer', fontFamily:'inherit', width:'100%' }}>+ Add Payment</button>
    </div>
  )
}

function LoanForm({ loan, onSave, onCancel, onDelete }) {
  const [form, setForm] = useState({ ...EMPTY_LOAN, ...loan })
  const isNew = !loan?.id
  const set = k => e => setForm(f=>({...f,[k]:e.target.value}))

  // Live preview of computed payment
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
      <Field label="Monthly Payment Override ($)">
        <input style={monoInp} type="number" value={form.monthly_payment} onChange={set('monthly_payment')} />
      </Field>

      {/* Live summary */}
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

      <div style={{ display:'flex', justifyContent:'space-between', paddingTop:8 }}>
        {!isNew && <Btn variant="danger" onClick={()=>onDelete(loan.id)}>Delete Loan</Btn>}
        <div style={{ display:'flex', gap:8, marginLeft:'auto' }}>
          <Btn variant="outline" onClick={onCancel}>Cancel</Btn>
          <Btn onClick={()=>onSave(form)}>Save Loan</Btn>
        </div>
      </div>
    </div>
  )
}

// ── Main LoanTracker modal ────────────────────────────────────────────────────
export default function LoanTracker({ propertyId, propertyAddress, open, onClose, initialLoanId }) {
  const [loans, setLoans]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [editing, setEditing]     = useState(null)   // null | 'new' | {refinanceFor: id} | loan object
  const [closingId, setClosingId] = useState(null)   // id of loan showing Paid Off / Refinance choice
  const [focusId, setFocusId]     = useState(initialLoanId ?? null) // non-null = single-loan detail view

  useEffect(() => {
    if (open && propertyId) load()
    if (!open) { setEditing(null); setClosingId(null) }
  }, [open, propertyId])

  useEffect(() => {
    if (open) setFocusId(initialLoanId ?? null)
  }, [open, initialLoanId])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('cashoffer_loans')
      .select('*')
      .eq('property_id', propertyId)
      .order('loan_start_date', { ascending: true })
    setLoans(data || [])
    setLoading(false)
    if (initialLoanId === null) setEditing('new')
  }

  async function saveLoan(form) {
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
      is_active:         true,
      notes:             form.notes || null,
    }
    if (form.id) {
      await supabase.from('cashoffer_loans').update(payload).eq('id', form.id)
    } else if (editing?.refinanceFor) {
      // Refinance: close only the specific loan being refinanced, then add the new one
      await supabase.from('cashoffer_loans').update({
        is_active: false, closed_reason: 'Refinanced', refinanced_date: new Date().toISOString().split('T')[0],
      }).eq('id', editing.refinanceFor)
      await supabase.from('cashoffer_loans').insert(payload)
    } else {
      // Brand new, standalone loan — doesn't touch any existing loans
      await supabase.from('cashoffer_loans').insert(payload)
    }
    setEditing(null)
    load()
  }

  async function markPaidOff(loan) {
    const val = prompt(`Total interest paid on this loan (${loan.lender_name || loan.bank || 'loan'}):`, '')
    if (val === null) return
    await supabase.from('cashoffer_loans').update({
      is_active: false, closed_reason: 'Paid Off', paid_off_date: new Date().toISOString().split('T')[0],
      total_interest_paid: parseFloat(val) || 0,
    }).eq('id', loan.id)
    setClosingId(null)
    load()
  }

  async function deleteLoan(id) {
    if (!confirm('Delete this loan record?')) return
    await supabase.from('cashoffer_loans').delete().eq('id', id)
    setEditing(null)
    load()
  }

  if (!open) return null

  const focusLoan = focusId ? loans.find(l => l.id === focusId) : null

  return (
    <Modal title={`Loan Tracker — ${propertyAddress?.split(',')[0] || ''}`} onClose={onClose} width={1240}>
      {loading ? (
        <div style={{ textAlign:'center', padding:32, color:'#B8892A', fontSize:24 }}>⟳</div>
      ) : editing ? (
        <>
          <div style={{ fontSize:13, fontWeight:700, color:'#2C2C2C', marginBottom:16 }}>
            {editing?.refinanceFor ? 'Add Refinance Loan' : editing==='new' ? 'Add Loan' : 'Edit Loan'}
          </div>
          {editing?.refinanceFor && (
            <div style={{ background:'#fff3cd', borderRadius:6, padding:'10px 14px', fontSize:12, color:'#856404', marginBottom:12 }}>
              Saving will mark that loan as refinanced and add this as a new active loan.
            </div>
          )}
          <LoanForm
            loan={(editing==='new' || editing?.refinanceFor) ? null : editing}
            onSave={saveLoan}
            onCancel={()=>setEditing(null)}
            onDelete={deleteLoan}
          />
        </>
      ) : focusLoan ? (
        <>
          <div style={{ background:'#FAFAF8', borderRadius:8, padding:'14px 16px', border:'0.5px solid #D6D2CA' }}>
            <div style={{ marginBottom:12 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                <span style={{ fontSize:14, fontWeight:700, color:'#2C2C2C' }}>{focusLoan.lender_name || focusLoan.bank || 'Unnamed Lender'}</span>
                <span style={{ background:TYPE_COLOR[focusLoan.loan_type]+'18', color:TYPE_COLOR[focusLoan.loan_type], border:`1px solid ${TYPE_COLOR[focusLoan.loan_type]}40`, borderRadius:4, padding:'2px 8px', fontSize:10, fontWeight:700 }}>{focusLoan.loan_type}</span>
                {!focusLoan.is_active && (
                  <span style={{ background:'#9ca3af18', color:'#6b7280', border:'1px solid #9ca3af40', borderRadius:4, padding:'2px 8px', fontSize:10, fontWeight:700 }}>{focusLoan.closed_reason || 'Closed'}</span>
                )}
              </div>
              <div style={{ fontSize:12, color:'#6b7280' }}>
                {focusLoan.loan_start_date ? new Date(focusLoan.loan_start_date+'T12:00:00').toLocaleDateString('en-US',{month:'short',year:'numeric'}) : ''}
                {focusLoan.loan_start_date && focusLoan.loan_term_months ? ` · ${focusLoan.loan_term_months/12}yr term` : ''}
              </div>
            </div>

            {closingId === focusLoan.id && (
              <div style={{ background:'#fff', border:'1px solid #D6D2CA', borderRadius:6, padding:'10px 12px', marginBottom:12, display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                <span style={{ fontSize:11, color:'#6b7280' }}>How is this loan closing out?</span>
                <button onClick={()=>markPaidOff(focusLoan)} style={{ background:'#3B6D11', color:'#fff', border:'none', borderRadius:6, padding:'6px 12px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Paid Off</button>
                <button onClick={()=>{ setEditing({ refinanceFor: focusLoan.id }); setClosingId(null) }} style={{ background:'#2D6FAF', color:'#fff', border:'none', borderRadius:6, padding:'6px 12px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Refinance</button>
                <span style={{ fontSize:10, color:'#9ca3af' }}>Paid Off asks for total interest paid. Refinance opens a new loan and closes this one.</span>
              </div>
            )}

            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
              {[
                { label:'Original Amount',  value:fmt(focusLoan.loan_amount),   color:'#2C2C2C' },
                { label:'Rate',             value:`${focusLoan.interest_rate}%`, color:'#2C2C2C' },
                { label:'Monthly Payment',  value:fmt(focusLoan.monthly_payment || (()=>{ const s=buildSchedule(focusLoan.loan_amount,focusLoan.interest_rate,focusLoan.loan_term_months,null); return s[0]?.payment })()), color:'#D97825' },
                { label:'Current Balance',  value:fmt(currentBalance(buildSchedule(focusLoan.loan_amount,focusLoan.interest_rate,focusLoan.loan_term_months,focusLoan.monthly_payment),focusLoan.loan_start_date)), color:'#2D6FAF' },
              ].map(({label,value,color})=>(
                <div key={label} style={{ textAlign:'center', background:'#fff', borderRadius:6, padding:'8px 10px', border:'0.5px solid #D6D2CA' }}>
                  <div style={{ fontSize:9, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.7, marginBottom:3 }}>{label}</div>
                  <div style={{ fontSize:14, fontWeight:700, fontFamily:'monospace', color }}>{value||'—'}</div>
                </div>
              ))}
            </div>

            {focusLoan.notes && (
              <div style={{ fontSize:11, color:'#6b7280', marginTop:10, fontStyle:'italic' }}>{focusLoan.notes}</div>
            )}

            {!focusLoan.is_active && (focusLoan.closed_reason === 'Refinanced'
              ? <div style={{ fontSize:11, color:'#9ca3af', marginTop:10 }}>Refinanced {focusLoan.refinanced_date ? new Date(focusLoan.refinanced_date+'T12:00:00').toLocaleDateString('en-US',{month:'short',year:'numeric'}) : ''}</div>
              : focusLoan.closed_reason === 'Paid Off'
                ? (
                  <div style={{ fontSize:11, color:'#9ca3af', marginTop:10 }}>Paid Off {focusLoan.paid_off_date ? new Date(focusLoan.paid_off_date+'T12:00:00').toLocaleDateString('en-US',{month:'short',year:'numeric'}) : ''} · Total Interest Paid: {fmt(focusLoan.total_interest_paid)}</div>
                )
                : null)}
          </div>

          <div style={{ marginTop:10 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#B8892A', textTransform:'uppercase', letterSpacing:0.8, marginBottom:6 }}>
              Amortization Schedule
            </div>
            <AmortizationTable
              schedule={buildSchedule(focusLoan.loan_amount, focusLoan.interest_rate, focusLoan.loan_term_months, focusLoan.monthly_payment)}
              startDate={focusLoan.loan_start_date}
            />
          </div>

          <LoanPaymentsLog loanId={focusLoan.id} closingDate={null} />

          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:18, paddingTop:16, borderTop:'1px solid #F0EDE6' }}>
            <Btn variant="danger" onClick={async ()=>{ await deleteLoan(focusLoan.id); onClose() }}>Delete Loan</Btn>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              {focusLoan.is_active && (
                <Btn variant="outline" onClick={()=>setClosingId(closingId===focusLoan.id?null:focusLoan.id)}>Close Loan</Btn>
              )}
              <Btn onClick={()=>setEditing(focusLoan)}>Edit / Save</Btn>
            </div>
          </div>
        </>
      ) : (
        <div style={{ background:'#F0EDE6', borderRadius:8, padding:'20px', textAlign:'center' }}>
          <div style={{ fontSize:13, color:'#6b7280', marginBottom:8 }}>No loan selected.</div>
          <Btn variant="outline" onClick={onClose} style={{ fontSize:12 }}>Close</Btn>
        </div>
      )}
    </Modal>
  )
}






