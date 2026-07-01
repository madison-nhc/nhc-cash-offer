import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { Field, FieldRow, inp, monoInp, Btn } from './ui.jsx'

export default function LoanOverview({ propertyId, onOpenFull }) {
  const [loan, setLoan]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (propertyId) load() }, [propertyId])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('cashoffer_loans')
      .select('*')
      .eq('property_id', propertyId)
      .eq('is_active', true)
      .order('loan_start_date', { ascending: false })
      .limit(1)
    setLoan(data?.[0] || null)
    setLoading(false)
  }

  async function update(field, value) {
    if (!loan) return
    setLoan(l => ({ ...l, [field]: value }))
    await supabase.from('cashoffer_loans').update({ [field]: value }).eq('id', loan.id)
  }

  async function addLoan() {
    const payload = { property_id: propertyId, lender_name: '', loan_amount: 0, interest_rate: 0, loan_term_months: 0, is_active: true, loan_type: 'Conventional' }
    const { data } = await supabase.from('cashoffer_loans').insert(payload).select().single()
    setLoan(data)
  }

  if (loading) return <div style={{ textAlign:'center', padding:20, color:'#9ca3af', fontSize:12 }}>Loading…</div>

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      {!loan ? (
        <div style={{ background:'#F0EDE6', borderRadius:8, padding:20, textAlign:'center' }}>
          <div style={{ fontSize:13, color:'#6b7280', marginBottom:8 }}>No loan recorded for this property.</div>
          <Btn onClick={addLoan}>+ Add Loan</Btn>
        </div>
      ) : (<>
        <FieldRow>
          <Field label="Lender">
            <input style={inp} value={loan.lender_name||''} onChange={e=>update('lender_name', e.target.value)} />
          </Field>
          <Field label="Loan Amount ($)">
            <input style={monoInp} type="number" value={loan.loan_amount||''} onChange={e=>update('loan_amount', parseFloat(e.target.value)||0)} />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="Interest Rate (%)">
            <input style={monoInp} type="number" step="0.01" value={loan.interest_rate||''} onChange={e=>update('interest_rate', parseFloat(e.target.value)||0)} />
          </Field>
          <Field label="Monthly Payment ($)">
            <input style={monoInp} type="number" value={loan.monthly_payment||''} onChange={e=>update('monthly_payment', e.target.value===''?null:parseFloat(e.target.value)||0)} />
          </Field>
        </FieldRow>
        <Field label="Start Date">
          <input style={inp} type="date" value={loan.loan_start_date||''} onChange={e=>update('loan_start_date', e.target.value)} />
        </Field>
        <button onClick={onOpenFull} style={{
          width:'100%', background:'#fff', border:'1.5px solid #2D6FAF', borderRadius:8, padding:'12px 16px',
          cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:4,
        }}>
          <div style={{ textAlign:'left' }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#2D6FAF' }}>View Full Loan Tracker</div>
            <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>Amortization schedule, refi history, current balance</div>
          </div>
          <span style={{ fontSize:18, color:'#2D6FAF' }}>→</span>
        </button>
      </>)}
    </div>
  )
}
