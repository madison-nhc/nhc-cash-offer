import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase.js'
import { Modal, Field, FieldRow, inp, monoInp, Btn, fmt, fmtK } from './ui.jsx'

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
        <Field label="Loan Start Date"><input style={inp} type="date" value={form.loan_start_date} onChange={set('loan_start_date')} /></Field>
      </FieldRow>
      <FieldRow>
        <Field label="Loan Amount ($)"><input style={monoInp} type="number" value={form.loan_amount} onChange={set('loan_amount')} /></Field>
        <Field label="Interest Rate (%)"><input style={monoInp} type="number" step="0.01" value={form.interest_rate} onChange={set('interest_rate')} /></Field>
        <Field label="Term (months)"><input style={monoInp} type="number" value={form.loan_term_months} onChange={set('loan_term_months')} /></Field>
      </FieldRow>
      <Field label="Monthly Payment Override ($)">
        <input style={monoInp} type="number" value={form.monthly_payment} onChange={set('monthly_payment')}` : 'Auto'} />
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
export default function LoanTracker({ propertyId, propertyAddress, open, onClose }) {
  const [loans, setLoans]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [editing, setEditing]     = useState(null)   // null | 'new' | loan object
  const [expandedLoan, setExpandedLoan] = useState(null) // id of loan showing amortization

  useEffect(() => {
    if (open && propertyId) load()
  }, [open, propertyId])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('cashoffer_loans')
      .select('*')
      .eq('property_id', propertyId)
      .order('loan_start_date', { ascending: true })
    setLoans(data || [])
    // Auto-expand active loan's amortization
    const active = (data||[]).find(l=>l.is_active)
    if (active && !expandedLoan) setExpandedLoan(active.id)
    setLoading(false)
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
    } else {
      // Mark all existing loans inactive when adding a new one (refi)
      if (loans.length > 0) {
        await supabase.from('cashoffer_loans').update({ is_active: false, refinanced_date: new Date().toISOString().split('T')[0] }).eq('property_id', propertyId).eq('is_active', true)
      }
      await supabase.from('cashoffer_loans').insert(payload)
    }
    setEditing(null)
    load()
  }

  async function deleteLoan(id) {
    if (!confirm('Delete this loan record?')) return
    await supabase.from('cashoffer_loans').delete().eq('id', id)
    setEditing(null)
    load()
  }

  if (!open) return null

  const activeLoan = loans.find(l => l.is_active)
  const priorLoans = loans.filter(l => !l.is_active)

  return (
    <Modal title={`Loan Tracker — ${propertyAddress?.split(',')[0] || ''}`} onClose={onClose} width={720}>
      {loading ? (
        <div style={{ textAlign:'center', padding:32, color:'#B8892A', fontSize:24 }}>⟳</div>
      ) : editing ? (
        <>
          <div style={{ fontSize:13, fontWeight:700, color:'#2C2C2C', marginBottom:16 }}>
            {editing==='new' ? (loans.length > 0 ? 'Add Refinance Loan' : 'Add Loan') : 'Edit Loan'}
          </div>
          {loans.length > 0 && editing==='new' && (
            <div style={{ background:'#fff3cd', borderRadius:6, padding:'10px 14px', fontSize:12, color:'#856404', marginBottom:12 }}>
              Adding a new loan will mark the current active loan as refinanced.
            </div>
          )}
          <LoanForm
            loan={editing==='new' ? null : editing}
            onSave={saveLoan}
            onCancel={()=>setEditing(null)}
            onDelete={deleteLoan}
          />
        </>
      ) : (
        <>
          {/* Active loan */}
          {activeLoan ? (
            <div>
              {/* Active loan summary card */}
              <div style={{ background:'#FAFAF8', borderRadius:8, padding:'14px 16px', border:'0.5px solid #D6D2CA', marginBottom:16 }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:12 }}>
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                      <span style={{ fontSize:14, fontWeight:700, color:'#2C2C2C' }}>{activeLoan.lender_name || activeLoan.bank || 'Unnamed Lender'}</span>
                      <span style={{ background:TYPE_COLOR[activeLoan.loan_type]+'18', color:TYPE_COLOR[activeLoan.loan_type], border:`1px solid ${TYPE_COLOR[activeLoan.loan_type]}40`, borderRadius:4, padding:'2px 8px', fontSize:10, fontWeight:700 }}>{activeLoan.loan_type}</span>
                    </div>
                    <div style={{ fontSize:12, color:'#6b7280' }}>
                      {activeLoan.loan_start_date ? new Date(activeLoan.loan_start_date+'T12:00:00').toLocaleDateString('en-US',{month:'short',year:'numeric'}) : ''}
                      {activeLoan.loan_start_date && activeLoan.loan_term_months ? ` · ${activeLoan.loan_term_months/12}yr term` : ''}
                    </div>
                  </div>
                  <Btn variant="outline" onClick={()=>setEditing(activeLoan)} style={{ fontSize:11, padding:'5px 12px' }}>Edit</Btn>
                </div>

                {/* Key figures */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
                  {[
                    { label:'Original Amount',  value:fmt(activeLoan.loan_amount),   color:'#2C2C2C' },
                    { label:'Rate',             value:`${activeLoan.interest_rate}%`, color:'#2C2C2C' },
                    { label:'Monthly Payment',  value:fmt(activeLoan.monthly_payment || (()=>{ const s=buildSchedule(activeLoan.loan_amount,activeLoan.interest_rate,activeLoan.loan_term_months,null); return s[0]?.payment })()), color:'#D97825' },
                    { label:'Current Balance',  value:fmt(currentBalance(buildSchedule(activeLoan.loan_amount,activeLoan.interest_rate,activeLoan.loan_term_months,activeLoan.monthly_payment),activeLoan.loan_start_date)), color:'#2D6FAF' },
                  ].map(({label,value,color})=>(
                    <div key={label} style={{ textAlign:'center', background:'#fff', borderRadius:6, padding:'8px 10px', border:'0.5px solid #D6D2CA' }}>
                      <div style={{ fontSize:9, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.7, marginBottom:3 }}>{label}</div>
                      <div style={{ fontSize:14, fontWeight:700, fontFamily:'monospace', color }}>{value||'—'}</div>
                    </div>
                  ))}
                </div>

                {activeLoan.notes && (
                  <div style={{ fontSize:11, color:'#6b7280', marginTop:10, fontStyle:'italic' }}>{activeLoan.notes}</div>
                )}
              </div>

              {/* Amortization toggle */}
              <div
                onClick={()=>setExpandedLoan(expandedLoan===activeLoan.id?null:activeLoan.id)}
                style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', marginBottom:8, padding:'6px 2px' }}
              >
                <span style={{ fontSize:11, fontWeight:700, color:'#B8892A', textTransform:'uppercase', letterSpacing:0.8 }}>Amortization Schedule</span>
                <span style={{ fontSize:10, color:'#9ca3af' }}>{expandedLoan===activeLoan.id?'▲':'▼'} click to {expandedLoan===activeLoan.id?'hide':'show'}</span>
              </div>

              {expandedLoan===activeLoan.id && (
                <AmortizationTable
                  schedule={buildSchedule(activeLoan.loan_amount, activeLoan.interest_rate, activeLoan.loan_term_months, activeLoan.monthly_payment)}
                  startDate={activeLoan.loan_start_date}
                />
              )}
            </div>
          ) : (
            <div style={{ background:'#F0EDE6', borderRadius:8, padding:'20px', textAlign:'center', marginBottom:16 }}>
              <div style={{ fontSize:13, color:'#6b7280', marginBottom:8 }}>No loan recorded for this property.</div>
              <Btn onClick={()=>setEditing('new')}>+ Add Loan</Btn>
            </div>
          )}

          {/* Prior loans / refi history */}
          {priorLoans.length > 0 && (
            <div style={{ marginTop:20 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:1, marginBottom:10 }}>Loan History</div>
              {priorLoans.map((loan, i) => {
                const sched = buildSchedule(loan.loan_amount, loan.interest_rate, loan.loan_term_months, loan.monthly_payment)
                const isExp = expandedLoan === loan.id
                return (
                  <div key={loan.id} style={{ borderRadius:8, border:'0.5px solid #D6D2CA', marginBottom:10, overflow:'hidden' }}>
                    <div style={{ background:'#FAFAF8', padding:'10px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer' }}
                      onClick={()=>setExpandedLoan(isExp?null:loan.id)}>
                      <div>
                        <div style={{ fontSize:12, fontWeight:700, color:'#6b7280' }}>{loan.lender_name||loan.bank||'Unnamed Lender'}</div>
                        <div style={{ fontSize:11, color:'#9ca3af' }}>
                          {loan.loan_type} · {loan.interest_rate}% · {fmt(loan.loan_amount)}
                          {loan.refinanced_date ? ` · Refinanced ${new Date(loan.refinanced_date+'T12:00:00').toLocaleDateString('en-US',{month:'short',year:'numeric'})}` : ''}
                        </div>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <button onClick={e=>{e.stopPropagation();setEditing(loan)}} style={{ background:'none', border:'1px solid #D6D2CA', borderRadius:4, padding:'3px 8px', fontSize:11, cursor:'pointer', color:'#6b7280', fontFamily:'inherit' }}>Edit</button>
                        <span style={{ fontSize:10, color:'#9ca3af' }}>{isExp?'▲':'▼'}</span>
                      </div>
                    </div>
                    {isExp && (
                      <div style={{ padding:'0 14px 14px' }}>
                        <AmortizationTable schedule={sched} startDate={loan.loan_start_date} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Add / Refi button */}
          {activeLoan && (
            <div style={{ marginTop:16, paddingTop:16, borderTop:'1px solid #F0EDE6' }}>
              <Btn variant="outline" onClick={()=>setEditing('new')} style={{ fontSize:12 }}>
                {loans.length > 0 ? '+ Add Refinance Loan' : '+ Add Loan'}
              </Btn>
              <span style={{ fontSize:11, color:'#9ca3af', marginLeft:10 }}>
                This will mark the current loan as refinanced and add a new active loan.
              </span>
            </div>
          )}
        </>
      )}
    </Modal>
  )
}

