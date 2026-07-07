import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { fmt } from './ui.jsx'

export default function LoanOverview({ propertyId, onOpenFull }) {
  const [loans, setLoans]     = useState([])
  const [loading, setLoading] = useState(true)
  const [hoverId, setHoverId] = useState(null)

  useEffect(() => { if (propertyId) load() }, [propertyId])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('cashoffer_loans')
      .select('*')
      .eq('property_id', propertyId)
      .eq('is_active', true)
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

  if (loans.length === 0) {
    return (
      <div style={{ background:'#F0EDE6', borderRadius:8, padding:20, textAlign:'center' }}>
        <div style={{ fontSize:13, color:'#6b7280', marginBottom:12 }}>No loan recorded for this property.</div>
        <button onClick={onOpenFull} style={{
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

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {loans.length > 1 && (
        <div style={{ fontSize:11, color:'#9ca3af', fontWeight:700, textTransform:'uppercase', letterSpacing:0.7 }}>
          {loans.length} Active Loans
        </div>
      )}
      {loans.map(loan => (
        <div
          key={loan.id}
          onClick={onOpenFull}
          onMouseEnter={()=>setHoverId(loan.id)}
          onMouseLeave={()=>setHoverId(null)}
          style={{
            background:'#FAFAF8',
            border: hoverId===loan.id ? '1.5px solid #2D6FAF' : '0.5px solid #D6D2CA',
            borderRadius:8, padding:'14px 16px', cursor:'pointer',
            transition:'border-color 0.15s',
          }}
        >
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <div style={{ fontSize:14, fontWeight:700, color:'#2C2C2C' }}>
              {loan.lender_name || loan.bank || 'Unnamed Lender'}
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
      ))}
      <div style={{ fontSize:11, color:'#9ca3af', textAlign:'right' }}>
        Click any loan for amortization schedule, refi history & current balance
      </div>
    </div>
  )
}
