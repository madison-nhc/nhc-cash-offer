import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { fmt } from './ui.jsx'

export default function LoanOverview({ propertyId, onOpenLoan }) {
  const [loans, setLoans]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [hoverId, setHoverId]     = useState(null)
  const [showPast, setShowPast]   = useState(false)

  useEffect(() => { if (propertyId) load() }, [propertyId])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('cashoffer_loans')
      .select('*')
      .eq('property_id', propertyId)
      .order('loan_start_date', { ascending: false })
    setLoans(data || [])
    setLoading(false)
  }

  async function deleteLoan(e, id) {
    e.stopPropagation()
    if (!confirm('Delete this loan record? This cannot be undone.')) return
    await supabase.from('cashoffer_loans').delete().eq('id', id)
    setLoans(l => l.filter(x => x.id !== id))
  }

  if (loading) return <div style={{ textAlign:'center', padding:20, color:'#9ca3af', fontSize:12 }}>Loading…</div>

  const activeLoans = loans.filter(l => l.is_active)
  const pastLoans   = loans.filter(l => !l.is_active)

  if (activeLoans.length === 0 && pastLoans.length === 0) {
    return (
      <div style={{ background:'#F0EDE6', borderRadius:8, padding:20, textAlign:'center' }}>
        <div style={{ fontSize:13, color:'#6b7280', marginBottom:12 }}>No loan recorded for this property.</div>
        <button onClick={()=>onOpenLoan(null)} style={{
          background:'#2D6FAF', color:'#fff', border:'none', borderRadius:8, padding:'10px 18px',
          fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit',
        }}>
          + Add Loan
        </button>
      </div>
    )
  }

  const rowsFor = (loan) => [
    { label:'Loan Type',       value: loan.loan_type || '—' },
    { label:'Loan Amount',     value: fmt(loan.loan_amount) || '—' },
    { label:'Interest Rate',   value: loan.interest_rate != null ? `${loan.interest_rate}%` : '—' },
    { label:'Term',            value: loan.loan_term_months ? `${loan.loan_term_months / 12} yr` : '—' },
    { label:'Start Date',      value: loan.loan_start_date ? new Date(loan.loan_start_date+'T12:00:00').toLocaleDateString('en-US',{month:'short', day:'numeric', year:'numeric'}) : '—' },
    { label:'Monthly Payment', value: loan.monthly_payment ? fmt(loan.monthly_payment) : '—' },
  ]

  const LoanCard = ({ loan, past }) => (
    <div
      key={loan.id}
      onClick={()=>onOpenLoan(loan.id)}
      onMouseEnter={()=>setHoverId(loan.id)}
      onMouseLeave={()=>setHoverId(null)}
      style={{
        background: past ? '#F5F4F0' : '#FAFAF8',
        border: hoverId===loan.id ? '1.5px solid #2D6FAF' : '0.5px solid #D6D2CA',
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
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <button onClick={e=>deleteLoan(e, loan.id)} title="Delete loan" style={{
            background:'none', border:'1px solid #B91C1C', color:'#B91C1C', borderRadius:6,
            fontSize:10, fontWeight:700, padding:'3px 8px', cursor:'pointer', fontFamily:'inherit',
          }}>
            Delete
          </button>
          <span style={{ fontSize:16, color:'#2D6FAF' }}>→</span>
        </div>
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
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {activeLoans.length > 0 && (
        <>
          {activeLoans.length > 1 && (
            <div style={{ fontSize:11, color:'#9ca3af', fontWeight:700, textTransform:'uppercase', letterSpacing:0.7 }}>
              {activeLoans.length} Active Loans
            </div>
          )}
          {activeLoans.map(loan => <LoanCard key={loan.id} loan={loan} />)}
          <div>
            <button onClick={()=>onOpenLoan(null)} style={{
              background:'none', border:'1px solid #2D6FAF', color:'#2D6FAF', borderRadius:8,
              fontSize:12, fontWeight:700, padding:'7px 14px', cursor:'pointer', fontFamily:'inherit',
            }}>
              + Add Another Loan
            </button>
          </div>
        </>
      )}

      {activeLoans.length === 0 && (
        <div style={{ background:'#F0EDE6', borderRadius:8, padding:16, textAlign:'center' }}>
          <div style={{ fontSize:12, color:'#6b7280', marginBottom:10 }}>No active loan for this property.</div>
          <button onClick={()=>onOpenLoan(null)} style={{
            background:'#2D6FAF', color:'#fff', border:'none', borderRadius:8, padding:'8px 16px',
            fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit',
          }}>
            + Add Loan
          </button>
        </div>
      )}

      {pastLoans.length > 0 && (
        <div style={{ marginTop:4 }}>
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

      <div style={{ fontSize:11, color:'#9ca3af', textAlign:'right' }}>
        Click any loan for amortization schedule, refi history & current balance
      </div>
    </div>
  )
}
