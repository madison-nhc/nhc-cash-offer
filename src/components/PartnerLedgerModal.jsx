import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { Modal, fmt, calcOwed } from './ui.jsx'

const GRID = '200px 90px 70px 100px 60px 80px'

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
    <div style={{ display:'grid', gridTemplateColumns:GRID, gap:8, alignItems:'center', padding:'8px 12px', background: zebra ? '#FAFAF8' : '#fff' }}>
      <div style={{ fontSize:12.5, color:'#2C2C2C' }}>{label}</div>
      <div style={{ fontSize:12.5, fontFamily:"'DM Mono', monospace", textAlign:'right', color:'#4b5563' }}>{fmt(amount)}</div>
      <div style={{ fontSize:11.5, fontWeight:600, color: isPartner ? (paidBy==='Bob'?'#2D6FAF':'#D97825') : '#9ca3af' }}>{paidBy || 'BPV'}</div>
      <div style={{ fontSize:11.5, color:'#6b7280' }}>{isPartner ? (datePaid || '—') : '—'}</div>
      <div style={{ fontSize:11.5, color: days==='TBD' ? '#B8892A' : '#9ca3af', fontStyle: days==='TBD' ? 'italic' : 'normal', textAlign:'right' }}>{days!=null ? days : '—'}</div>
      <div style={{ textAlign:'right' }}>
        {isPartner ? <InterestCell sourceType={sourceType} sourceId={sourceId} amount={amount} datePaid={datePaid} interestAsOfStr={interestAsOfStr} /> : <span style={{ fontSize:12, color:'#D6D2CA' }}>—</span>}
      </div>
    </div>
  )
}

function SectionHeader({ children, onClick, first }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: first ? '2px 12px 8px' : '16px 12px 8px',
        cursor: onClick ? 'pointer' : 'default',
        display:'flex', alignItems:'center', gap:5,
      }}
    >
      <span style={{ fontSize:11, fontWeight:700, color:'#B8892A', textTransform:'uppercase', letterSpacing:0.7 }}>{children}</span>
      {onClick && <span style={{ fontSize:10, color:'#B8892A' }}>→</span>}
    </div>
  )
}

function ColumnLabels() {
  const label = (text, right) => (
    <div style={{ fontSize:9, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.6, textAlign: right?'right':'left' }}>{text}</div>
  )
  return (
    <div style={{ display:'grid', gridTemplateColumns:GRID, gap:8, padding:'0 12px 6px', borderBottom:'1px solid #D6D2CA' }}>
      {label('Item')}
      {label('Amount', true)}
      {label('Paid By')}
      {label('Date Paid')}
      {label('Days', true)}
      {label('Interest', true)}
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
  const asOfStr = closingDate && closingDate < today ? closingDate : today

  let rowIndex = 0
  const nextZebra = () => (rowIndex++ % 2 === 1)

  return (
    <Modal title={`Partner Ledger — ${property?.address?.split(',')[0] || ''}`} onClose={onClose} width={820}>
      {loading ? (
        <div style={{ textAlign:'center', padding:30, color:'#9ca3af', fontSize:12 }}>Loading…</div>
      ) : (
        <div style={{ maxWidth:700, margin:'0 auto' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:14, flexWrap:'wrap', gap:8 }}>
            <div style={{ fontSize:11, color:'#9ca3af' }}>
              View only — click a section name to jump there and make edits.
            </div>
            <div style={{ fontSize:11, color:'#6b7280' }}>
              Closing Date: <strong style={{ color:'#2C2C2C' }}>{closingDate || 'Not set — using today'}</strong>
            </div>
          </div>

          <div style={{ border:'0.5px solid #D6D2CA', borderRadius:8, overflow:'hidden' }}>
            <ColumnLabels />

            <SectionHeader first onClick={()=>onNavigate('acquisition')}>Acquisition</SectionHeader>
            <Row zebra={nextZebra()} label="Down Payment" amount={property?.down_payment} paidBy={property?.down_payment_paid_by} datePaid={property?.down_payment_date_paid} sourceType="down_payment" sourceId={propertyId} closingDate={closingDate} interestAsOfStr={asOfStr} />
            <Row zebra={nextZebra()} label="Closing Costs" amount={property?.closing_costs} paidBy={property?.closing_costs_paid_by} datePaid={property?.closing_costs_date_paid} sourceType="closing_costs" sourceId={propertyId} closingDate={closingDate} interestAsOfStr={asOfStr} />

            {items.length > 0 && (<>
              <SectionHeader onClick={()=>onNavigate('rehab')}>Rehab — Services</SectionHeader>
              {items.map(r => (
                <Row key={r.id} zebra={nextZebra()} label={r.name || 'Unnamed'} amount={itemCost(r)} paidBy={r.paid_by} datePaid={r.date_paid} sourceType="rehab_item" sourceId={r.id} closingDate={closingDate} interestAsOfStr={asOfStr} />
              ))}
            </>)}

            {supplies.length > 0 && (<>
              <SectionHeader onClick={()=>onNavigate('rehab')}>Rehab — Supplies</SectionHeader>
              {supplies.map(r => (
                <Row key={r.id} zebra={nextZebra()} label={r.name || 'Unnamed'} amount={supplyCost(r)} paidBy={r.paid_by} datePaid={r.date_paid} sourceType="supply" sourceId={r.id} closingDate={closingDate} interestAsOfStr={asOfStr} />
              ))}
            </>)}

            {bills.length > 0 && (<>
              <SectionHeader onClick={()=>onNavigate('rehab')}>Rehab — Utilities</SectionHeader>
              {bills.map(r => (
                <Row key={r.id} zebra={nextZebra()} label={r.utility_type || 'Utility'} amount={r.amount} paidBy={r.paid_by} datePaid={r.date_paid} sourceType="utility_bill" sourceId={r.id} closingDate={closingDate} interestAsOfStr={asOfStr} />
              ))}
            </>)}

            {loanPayments.length > 0 && (<>
              <SectionHeader onClick={()=>onNavigate('loan')}>Loan Payments</SectionHeader>
              {loanPayments.map(p => (
                <Row key={p.id} zebra={nextZebra()} label={p.due_date ? `Due ${p.due_date}` : 'Payment'} amount={p.amount} paidBy={p.paid_by} datePaid={p.date_paid} sourceType="loan_payment" sourceId={p.id} closingDate={closingDate} interestAsOfStr={asOfStr} />
              ))}
            </>)}

            {nothing && (
              <div style={{ textAlign:'center', padding:20, color:'#9ca3af', fontSize:12 }}>Nothing tracked yet.</div>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
