import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { Modal, fmt, calcOwed } from './ui.jsx'

const GRID = '2fr 100px 80px 110px 60px 90px'

// Parses 'YYYY-MM-DD' manually (avoids new Date(str) timezone off-by-one).
function daysBetween(startStr, endStr) {
  if (!startStr || !endStr) return null
  const [sy,sm,sd] = startStr.split('-').map(Number)
  const [ey,em,ed] = endStr.split('-').map(Number)
  const start = Date.UTC(sy, sm-1, sd)
  const end   = Date.UTC(ey, em-1, ed)
  return Math.round((end-start) / 86400000)
}

// View-only interest readout — fetches repayments and computes accrued interest,
// no editing here. Interest keeps accruing day-by-day even before closing.
function InterestCell({ sourceType, sourceId, amount, datePaid, interestAsOfStr }) {
  const [interest, setInterest] = useState(null)
  useEffect(() => {
    if (!datePaid || !amount) { setInterest(0); return }
    supabase.from('cashoffer_partner_repayments').select('*').eq('source_type', sourceType).eq('source_id', sourceId)
      .then(({ data }) => {
        const asOf = new Date(interestAsOfStr + 'T12:00:00')
        const { accruedInterest } = calcOwed(amount, datePaid, data||[], asOf)
        setInterest(accruedInterest)
      })
  }, [sourceType, sourceId, amount, datePaid, interestAsOfStr])

  if (interest === null) return <span style={{ fontSize:11, color:'#D6D2CA' }}>…</span>
  return <span style={{ fontSize:12, fontFamily:"'DM Mono', monospace", fontWeight:700, color: interest>0 ? '#B8892A' : '#9ca3af' }}>{interest>0 ? fmt(interest) : '—'}</span>
}

function Row({ label, amount, paidBy, datePaid, sourceType, sourceId, closingDate, interestAsOfStr, zebra }) {
  const isPartner = paidBy === 'Bob' || paidBy === 'Eric'
  // Days is counted to the actual closing date only — shows TBD until the deal closes.
  const days = isPartner && datePaid ? (closingDate ? daysBetween(datePaid, closingDate) : 'TBD') : null
  return (
    <div style={{ display:'grid', gridTemplateColumns:GRID, gap:10, alignItems:'center', padding:'8px 10px', background: zebra ? '#FAFAF8' : '#fff' }}>
      <div style={{ fontSize:12.5, color:'#2C2C2C' }}>{label}</div>
      <div style={{ fontSize:12.5, fontFamily:"'DM Mono', monospace", textAlign:'right', color:'#4b5563' }}>{fmt(amount)}</div>
      <div style={{ fontSize:11.5, fontWeight:600, color: isPartner ? (paidBy==='Bob'?'#2D6FAF':'#D97825') : '#9ca3af' }}>{paidBy || 'BPV'}</div>
      <div style={{ fontSize:11.5, color:'#6b7280' }}>{datePaid || '—'}</div>
      <div style={{ fontSize:11.5, color: days==='TBD' ? '#B8892A' : '#9ca3af', fontStyle: days==='TBD' ? 'italic' : 'normal', textAlign:'right' }}>{days!=null ? days : '—'}</div>
      <div style={{ textAlign:'right' }}>
        {isPartner ? <InterestCell sourceType={sourceType} sourceId={sourceId} amount={amount} datePaid={datePaid} interestAsOfStr={interestAsOfStr} /> : <span style={{ fontSize:12, color:'#D6D2CA' }}>—</span>}
      </div>
    </div>
  )
}

// One self-contained bordered table per section — mirrors the Rehab Dashboard's
// pattern of a title above a shaded-header bordered box.
function SectionTable({ title, onNavigate, rows }) {
  return (
    <div style={{ marginBottom:18 }}>
      <div
        onClick={onNavigate}
        style={{ display:'flex', alignItems:'center', gap:5, marginBottom:8, cursor: onNavigate ? 'pointer' : 'default' }}
      >
        <span style={{ fontSize:13, fontWeight:700, color:'#2C2C2C' }}>{title}</span>
        {onNavigate && <span style={{ fontSize:11, color:'#B8892A', fontWeight:700 }}>Edit on {title.split(' — ')[0]} tab →</span>}
      </div>
      <div style={{ border:'0.5px solid #D6D2CA', borderRadius:8, overflow:'hidden' }}>
        <div style={{ display:'grid', gridTemplateColumns:GRID, gap:10, background:'#F0EDE6', padding:'8px 10px' }}>
          {['Item','Amount','Paid By','Date Paid','Days','Interest'].map((h,i)=>(
            <div key={h} style={{ fontSize:10, fontWeight:600, color:'#6b7280', textTransform:'uppercase', textAlign: i>=1 && i!==2 && i!==3 ? 'right' : 'left' }}>{h}</div>
          ))}
        </div>
        {rows.map((r,i) => <Row key={i} zebra={i%2===1} {...r} />)}
      </div>
    </div>
  )
}

export default function PartnerLedgerModal({ propertyId, property, closingDate, onClose, onNavigate }) {
  const [items, setItems]       = useState([])
  const [supplies, setSupplies] = useState([])
  const [bills, setBills]       = useState([])
  const [loanPayments, setLoanPayments] = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => { load() }, [propertyId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    const [i, s, b, loans] = await Promise.all([
      supabase.from('cashoffer_rehab_items').select('id, name, estimated_cost, actual_cost, paid_by, date_paid').eq('property_id', propertyId),
      supabase.from('cashoffer_supplies').select('id, name, unit_cost, quantity, paid_by, date_paid').eq('property_id', propertyId),
      supabase.from('cashoffer_utility_bills').select('id, utility_type, amount, paid_by, date_paid').eq('property_id', propertyId),
      supabase.from('cashoffer_loans').select('id, lender_name, bank').eq('property_id', propertyId),
    ])
    setItems(i.data || [])
    setSupplies(s.data || [])
    setBills(b.data || [])
    const loanIds = (loans.data || []).map(l => l.id)
    if (loanIds.length) {
      const { data: payments } = await supabase.from('cashoffer_loan_payments').select('*').in('loan_id', loanIds).order('due_date', { ascending: true })
      setLoanPayments(payments || [])
    } else {
      setLoanPayments([])
    }
    setLoading(false)
  }

  const itemCost = r => r.actual_cost != null ? parseFloat(r.actual_cost)||0 : parseFloat(r.estimated_cost)||0
  const supplyCost = r => (parseFloat(r.unit_cost)||0) * (parseFloat(r.quantity)||0)

  const nothing = items.length===0 && supplies.length===0 && bills.length===0 && loanPayments.length===0 && !property?.down_payment && !property?.closing_costs

  const today = new Date().toISOString().slice(0,10)
  const interestAsOfStr = closingDate && closingDate < today ? closingDate : today

  const commonRow = { closingDate, interestAsOfStr }

  const acquisitionRows = [
    { label:'Down Payment', amount:property?.down_payment, paidBy:property?.down_payment_paid_by, datePaid:property?.down_payment_date_paid, sourceType:'down_payment', sourceId:propertyId, ...commonRow },
    { label:'Closing Costs', amount:property?.closing_costs, paidBy:property?.closing_costs_paid_by, datePaid:property?.closing_costs_date_paid, sourceType:'closing_costs', sourceId:propertyId, ...commonRow },
  ]
  const serviceRows = items.map(r => ({ label:r.name||'Unnamed', amount:itemCost(r), paidBy:r.paid_by, datePaid:r.date_paid, sourceType:'rehab_item', sourceId:r.id, ...commonRow }))
  const supplyRows = supplies.map(r => ({ label:r.name||'Unnamed', amount:supplyCost(r), paidBy:r.paid_by, datePaid:r.date_paid, sourceType:'supply', sourceId:r.id, ...commonRow }))
  const utilityRows = bills.map(r => ({ label:r.utility_type||'Utility', amount:r.amount, paidBy:r.paid_by, datePaid:r.date_paid, sourceType:'utility_bill', sourceId:r.id, ...commonRow }))
  const loanRows = loanPayments.map(p => ({ label:p.due_date ? `Due ${p.due_date}` : 'Payment', amount:p.amount, paidBy:p.paid_by, datePaid:p.date_paid, sourceType:'loan_payment', sourceId:p.id, ...commonRow }))

  return (
    <Modal title={`Partner Ledger — ${property?.address?.split(',')[0] || ''}`} onClose={onClose} width={1240}>
      {loading ? (
        <div style={{ textAlign:'center', padding:30, color:'#9ca3af', fontSize:12 }}>Loading…</div>
      ) : (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:16, flexWrap:'wrap', gap:8 }}>
            <div style={{ fontSize:11, color:'#9ca3af' }}>
              View only — click a section title to jump there and make edits.
            </div>
            <div style={{ fontSize:11, color:'#6b7280' }}>
              Closing Date: <strong style={{ color:'#2C2C2C' }}>{closingDate || 'Not set — using today'}</strong>
            </div>
          </div>

          <SectionTable title="Acquisition" onNavigate={()=>onNavigate('acquisition')} rows={acquisitionRows} />
          {serviceRows.length > 0 && <SectionTable title="Rehab — Services" onNavigate={()=>onNavigate('rehab')} rows={serviceRows} />}
          {supplyRows.length > 0 && <SectionTable title="Rehab — Supplies" onNavigate={()=>onNavigate('rehab')} rows={supplyRows} />}
          {utilityRows.length > 0 && <SectionTable title="Rehab — Utilities" onNavigate={()=>onNavigate('rehab')} rows={utilityRows} />}
          {loanRows.length > 0 && <SectionTable title="Loan Payments" onNavigate={()=>onNavigate('loan')} rows={loanRows} />}

          {nothing && (
            <div style={{ textAlign:'center', padding:20, color:'#9ca3af', fontSize:12 }}>Nothing tracked yet.</div>
          )}
        </div>
      )}
    </Modal>
  )
}
