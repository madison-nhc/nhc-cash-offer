import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { fmt } from './ui.jsx'

// Mirrors the amortization engine in LoanTracker — kept in sync there.
function computeMonthlyPayment(loan) {
  if (!loan) return 0
  if (loan.monthly_payment) return parseFloat(loan.monthly_payment)
  const P = parseFloat(loan.loan_amount) || 0
  const r = (parseFloat(loan.interest_rate) || 0) / 100 / 12
  const n = parseInt(loan.loan_term_months) || 0
  if (!P || !n) return 0
  if (r === 0) return P / n
  return P * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
}

function monthsElapsedSince(dateStr) {
  const start = new Date(dateStr + 'T12:00:00')
  const now = new Date()
  return (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
}

// Returns { balance, interestPaid, paymentsMade } for a loan as of today.
function amortizeToDate(loan) {
  const P = parseFloat(loan.loan_amount) || 0
  const r = (parseFloat(loan.interest_rate) || 0) / 100 / 12
  const n = parseInt(loan.loan_term_months) || 0
  const pmt = computeMonthlyPayment(loan)
  if (!P || !n || !loan.loan_start_date) return { balance: P, interestPaid: 0, paymentsMade: 0 }
  const paymentsMade = Math.min(n, Math.max(0, monthsElapsedSince(loan.loan_start_date)))
  let balance = P
  let interestPaid = 0
  for (let i = 0; i < paymentsMade; i++) {
    const interest = r > 0 ? balance * r : 0
    const principal = Math.min(pmt - interest, balance)
    balance = Math.max(0, balance - principal)
    interestPaid += interest
  }
  return { balance, interestPaid, paymentsMade }
}

// Adds n months to a 'YYYY-MM-DD' string without timezone drift.
function addMonths(dateStr, n) {
  if (!dateStr) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  const total = (m - 1) + n
  const newY = y + Math.floor(total / 12)
  const newM = (total % 12) + 1
  return `${newY}-${String(newM).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function nextDueDate(loan, paymentsMade) {
  if (!loan.loan_start_date) return null
  const dueDay = parseInt(loan.due_day) || 1
  // First payment always falls the month after closing.
  const raw = addMonths(loan.loan_start_date, paymentsMade + 1)
  if (!raw) return null
  const [y, m] = raw.split('-')
  return `${y}-${m}-${String(dueDay).padStart(2, '0')}`
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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

export default function LoanOverview({ propertyId, onOpenLoan, onOpenFull }) {
  const [loans, setLoans]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [hoverId, setHoverId]     = useState(null)
  const [showPast, setShowPast]   = useState(false)
  const [arv, setArv]             = useState('')

  const openFull = onOpenFull || (() => onOpenLoan && onOpenLoan(null))

  useEffect(() => { if (propertyId) load() }, [propertyId])

  async function load() {
    setLoading(true)
    const [{ data }, { data: prop }] = await Promise.all([
      supabase.from('cashoffer_loans').select('*').eq('property_id', propertyId).order('loan_start_date', { ascending: false }),
      supabase.from('cashoffer_properties').select('arv').eq('id', propertyId).single(),
    ])
    setLoans(data || [])
    setArv(prop?.arv || '')
    setLoading(false)
  }

  if (loading) return <div style={{ textAlign:'center', padding:20, color:'#9ca3af', fontSize:12 }}>Loading…</div>

  const activeLoans = loans.filter(l => l.is_active)
  const pastLoans   = loans.filter(l => !l.is_active)

  if (activeLoans.length === 0 && pastLoans.length === 0) {
    return (
      <div style={{ background:'#F0EDE6', borderRadius:8, padding:20, textAlign:'center' }}>
        <div style={{ fontSize:13, color:'#6b7280', marginBottom:12 }}>No loan recorded for this property.</div>
        <button onClick={()=>onOpenLoan(null)} style={{
          background:'#D97825', color:'#fff', border:'none', borderRadius:8, padding:'10px 18px',
          fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit',
        }}>
          + Add Loan
        </button>
      </div>
    )
  }

  // Aggregate stats across active loans — this is what makes the tab worth glancing at
  // without opening the full tracker.
  const amortized = activeLoans.map(l => ({ loan: l, ...amortizeToDate(l) }))
  const totalBalance   = amortized.reduce((s, a) => s + a.balance, 0)
  const totalMonthly   = activeLoans.reduce((s, l) => s + computeMonthlyPayment(l), 0)
  const totalInterest  = amortized.reduce((s, a) => s + a.interestPaid, 0)
  const nextDues = amortized
    .map(a => nextDueDate(a.loan, a.paymentsMade))
    .filter(Boolean)
    .sort()
  const earliestDue = nextDues[0] || null

  const rowsFor = (loan) => [
    { label:'Loan Type',       value: loan.loan_type || '—' },
    { label:'Loan Amount',     value: fmt(loan.loan_amount) || '—' },
    { label:'Interest Rate',   value: loan.interest_rate != null ? `${loan.interest_rate}%` : '—' },
    { label:'Term',            value: loan.loan_term_months ? `${loan.loan_term_months / 12} yr` : '—' },
    { label:'Start Date',      value: loan.loan_start_date ? fmtDate(loan.loan_start_date) : '—' },
    { label:'Monthly Payment', value: loan.monthly_payment ? fmt(loan.monthly_payment) : fmt(computeMonthlyPayment(loan)) },
  ]

  const LoanCard = ({ loan, past }) => (
    <div
      key={loan.id}
      onClick={()=>onOpenLoan(loan.id)}
      onMouseEnter={()=>setHoverId(loan.id)}
      onMouseLeave={()=>setHoverId(null)}
      style={{
        background: past ? '#F5F4F0' : '#FAFAF8',
        border: hoverId===loan.id ? '1.5px solid #D97825' : '0.5px solid #D6D2CA',
        borderRadius:8, padding:'14px 16px', cursor:'pointer',
        transition:'border-color 0.15s',
        opacity: past ? 0.85 : 1,
      }}
    >
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ fontSize:14, fontWeight:700, color:'#2C2C2C' }}>
            {loan.lender_name || loan.bank || 'Unnamed Lender'}
          </div>
          {past && (
            <span style={{ background:'#9ca3af18', color:'#6b7280', border:'1px solid #9ca3af40', borderRadius:4, padding:'2px 7px', fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:0.5 }}>
              {loan.closed_reason || 'Closed'}
            </span>
          )}
        </div>
        <span style={{ fontSize:16, color:'#D97825' }}>→</span>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        {rowsFor(loan).map(({ label, value }) => (
          <div key={label}>
            <div style={{ fontSize:9, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.7, marginBottom:2 }}>{label}</div>
            <div style={{ fontSize:13, fontWeight:600, color:'#2C2C2C', fontFamily: label==='Loan Type' ? 'inherit' : 'monospace' }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* Live ARV lookup — placeholder for a future auto-pull-by-address feature */}
      <div style={{
        background:'#F5F4F0', borderRadius:8, padding:'14px 16px', border:'1px dashed #D6D2CA',
        display:'flex', alignItems:'center', justifyContent:'center', gap:8,
      }}>
        <span style={{ fontSize:16 }}>🔒</span>
        <div style={{ fontSize:12, color:'#9ca3af', fontWeight:600 }}>Live ARV lookup by address — feature coming soon</div>
      </div>

      {/* Snapshot — the numbers worth seeing without opening the full tracker. Monthly
          payment isn't repeated here since it's already on the loan card below. Equity
          uses the ARV set on the Analyzer tab until the live lookup above is built. */}
      <div style={{ display:'grid', gridTemplateColumns: arv ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)', gap:10 }}>
        <StatCard topColor="#D97825" label="Balance Remaining" value={fmt(totalBalance)} />
        <StatCard topColor="#3B6D11" label="Interest Paid to Date" value={fmt(totalInterest)} />
        {arv > 0 && <StatCard topColor="#3B6D11" label="Est. Equity" value={fmt(Math.max((parseFloat(arv)||0) - totalBalance, 0))} sub="ARV − balance remaining" />}
      </div>
      {earliestDue && (
        <div style={{
          background:'#D9782512', border:'1px solid #D9782530', borderRadius:8,
          padding:'10px 14px', display:'flex', justifyContent:'space-between', alignItems:'center',
        }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#D97825', textTransform:'uppercase', letterSpacing:0.8 }}>Next Payment Due</div>
          <div style={{ fontSize:14, fontWeight:700, color:'#D97825', fontFamily:'monospace' }}>{fmtDate(earliestDue)}</div>
        </div>
      )}

      {activeLoans.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {activeLoans.length > 1 && (
            <div style={{ fontSize:11, color:'#9ca3af', fontWeight:700, textTransform:'uppercase', letterSpacing:0.7 }}>
              {activeLoans.length} Active Loans
            </div>
          )}
          {activeLoans.map(loan => <LoanCard key={loan.id} loan={loan} />)}
        </div>
      )}

      {activeLoans.length === 0 && (
        <div style={{ background:'#F0EDE6', borderRadius:8, padding:16, textAlign:'center' }}>
          <div style={{ fontSize:12, color:'#6b7280', marginBottom:10 }}>No active loan for this property.</div>
          <button onClick={()=>onOpenLoan(null)} style={{
            background:'#D97825', color:'#fff', border:'none', borderRadius:8, padding:'8px 16px',
            fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit',
          }}>
            + Add Loan
          </button>
        </div>
      )}

      {pastLoans.length > 0 && (
        <div>
          <div
            onClick={()=>setShowPast(s=>!s)}
            style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', padding:'4px 2px' }}
          >
            <span style={{ fontSize:11, fontWeight:700, color:'#B8892A', textTransform:'uppercase', letterSpacing:0.7 }}>
              {showPast ? '▾' : '▸'} {pastLoans.length} Past Loan{pastLoans.length>1?'s':''}
            </span>
          </div>
          {showPast && (
            <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:8 }}>
              {pastLoans.map(loan => <LoanCard key={loan.id} loan={loan} past />)}
            </div>
          )}
        </div>
      )}

      <button onClick={openFull} style={{
        background:'#D97825', color:'#fff', border:'none', borderRadius:8, padding:'10px 14px',
        fontSize:12.5, fontWeight:700, cursor:'pointer', fontFamily:'inherit',
        display:'flex', alignItems:'center', justifyContent:'center', gap:6,
      }}>
        Open Loan Details <span>→</span>
      </button>

      {activeLoans.length > 0 && (
        <div>
          <button onClick={()=>onOpenLoan(null)} style={{
            background:'none', border:'1px solid #D97825', color:'#D97825', borderRadius:8,
            fontSize:12, fontWeight:700, padding:'7px 14px', cursor:'pointer', fontFamily:'inherit', width:'100%',
          }}>
            + Add Another Loan
          </button>
        </div>
      )}
    </div>
  )
}
