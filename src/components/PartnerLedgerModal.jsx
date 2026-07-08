import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { Modal, fmt, PAID_BY_OPTIONS, PARTNERS, PartnerLedger, NoPartnerCells } from './ui.jsx'

const GRID = '1fr 100px 84px 190px'

function Row({ label, amount, paidBy, onPaidByChange, sourceType, sourceId, datePaid, onDatePaidChange, closingDate }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:GRID, gap:8, alignItems:'center', padding:'7px 10px', borderTop:'0.5px solid #F0EDE6' }}>
      <div style={{ fontSize:12, color:'#4b5563' }}>{label}</div>
      <div style={{ fontSize:12, fontFamily:"'DM Mono', monospace", textAlign:'right', color:'#4b5563' }}>{fmt(amount)}</div>
      <select
        value={paidBy||'BPV'} onChange={e=>onPaidByChange(e.target.value)}
        style={{ border:'0.5px solid #D6D2CA', borderRadius:4, padding:'4px 6px', fontSize:11, fontFamily:'inherit', background:'#fff', cursor:'pointer' }}
      >
        {PAID_BY_OPTIONS.map(o=><option key={o} value={o}>{o}</option>)}
      </select>
      {PARTNERS.includes(paidBy) ? (
        <PartnerLedger sourceType={sourceType} sourceId={sourceId} originalAmount={amount} datePaid={datePaid} onDatePaidChange={onDatePaidChange} closingDate={closingDate} />
      ) : <NoPartnerCells />}
    </div>
  )
}

function SectionHeader({ children }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:GRID, gap:8, padding:'0 10px 4px', marginTop:14 }}>
      <div style={{ fontSize:10, fontWeight:700, color:'#B8892A', textTransform:'uppercase', letterSpacing:0.7 }}>{children}</div>
      <div />
      <div style={{ fontSize:9, fontWeight:600, color:'#9ca3af', textTransform:'uppercase' }}>Paid By</div>
      <div style={{ fontSize:9, fontWeight:600, color:'#9ca3af', textTransform:'uppercase' }}>Date Paid / Interest</div>
    </div>
  )
}

export default function PartnerLedgerModal({ propertyId, property, closingDate, onClose, onPropertyChange }) {
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

  async function updateProperty(fields) {
    await supabase.from('cashoffer_properties').update(fields).eq('id', propertyId)
    onPropertyChange(fields)
  }

  async function updateRow(table, id, field, value, setList) {
    await supabase.from(table).update({ [field]: value }).eq('id', id)
    setList(list => list.map(x => x.id===id ? { ...x, [field]: value } : x))
  }

  const itemCost = r => r.actual_cost != null ? parseFloat(r.actual_cost)||0 : parseFloat(r.estimated_cost)||0
  const supplyCost = r => (parseFloat(r.unit_cost)||0) * (parseFloat(r.quantity)||0)

  return (
    <Modal title={`Partner Ledger — ${property?.address?.split(',')[0] || ''}`} onClose={onClose} width={720}>
      {loading ? (
        <div style={{ textAlign:'center', padding:30, color:'#9ca3af', fontSize:12 }}>Loading…</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column' }}>
          <div style={{ fontSize:11, color:'#9ca3af', marginBottom:4 }}>
            Every dollar Bob or Eric personally covered on this deal, in one place — adjust Paid By or Date Paid here and it updates everywhere else too.
          </div>

          <SectionHeader>Acquisition</SectionHeader>
          <Row
            label="Down Payment" amount={property?.down_payment}
            paidBy={property?.down_payment_paid_by}
            onPaidByChange={v=>updateProperty({ down_payment_paid_by: v, down_payment_date_paid: PARTNERS.includes(v) ? (property?.down_payment_date_paid || property?.purchase_date || null) : null })}
            sourceType="down_payment" sourceId={propertyId}
            datePaid={property?.down_payment_date_paid}
            onDatePaidChange={v=>updateProperty({ down_payment_date_paid: v })}
            closingDate={closingDate}
          />
          <Row
            label="Closing Costs" amount={property?.closing_costs}
            paidBy={property?.closing_costs_paid_by}
            onPaidByChange={v=>updateProperty({ closing_costs_paid_by: v, closing_costs_date_paid: PARTNERS.includes(v) ? (property?.closing_costs_date_paid || property?.purchase_date || null) : null })}
            sourceType="closing_costs" sourceId={propertyId}
            datePaid={property?.closing_costs_date_paid}
            onDatePaidChange={v=>updateProperty({ closing_costs_date_paid: v })}
            closingDate={closingDate}
          />

          {items.length > 0 && (<>
            <SectionHeader>Rehab — Services</SectionHeader>
            {items.map(r => (
              <Row key={r.id}
                label={r.name || 'Unnamed'} amount={itemCost(r)}
                paidBy={r.paid_by} onPaidByChange={v=>updateRow('cashoffer_rehab_items', r.id, 'paid_by', v, setItems)}
                sourceType="rehab_item" sourceId={r.id}
                datePaid={r.date_paid} onDatePaidChange={v=>updateRow('cashoffer_rehab_items', r.id, 'date_paid', v, setItems)}
                closingDate={closingDate}
              />
            ))}
          </>)}

          {supplies.length > 0 && (<>
            <SectionHeader>Rehab — Supplies</SectionHeader>
            {supplies.map(r => (
              <Row key={r.id}
                label={r.name || 'Unnamed'} amount={supplyCost(r)}
                paidBy={r.paid_by} onPaidByChange={v=>updateRow('cashoffer_supplies', r.id, 'paid_by', v, setSupplies)}
                sourceType="supply" sourceId={r.id}
                datePaid={r.date_paid} onDatePaidChange={v=>updateRow('cashoffer_supplies', r.id, 'date_paid', v, setSupplies)}
                closingDate={closingDate}
              />
            ))}
          </>)}

          {bills.length > 0 && (<>
            <SectionHeader>Rehab — Utilities</SectionHeader>
            {bills.map(r => (
              <Row key={r.id}
                label={r.utility_type || 'Utility'} amount={r.amount}
                paidBy={r.paid_by} onPaidByChange={v=>updateRow('cashoffer_utility_bills', r.id, 'paid_by', v, setBills)}
                sourceType="utility_bill" sourceId={r.id}
                datePaid={r.date_paid} onDatePaidChange={v=>updateRow('cashoffer_utility_bills', r.id, 'date_paid', v, setBills)}
                closingDate={closingDate}
              />
            ))}
          </>)}

          {loanPayments.length > 0 && (<>
            <SectionHeader>Loan Payments</SectionHeader>
            {loanPayments.map(p => (
              <Row key={p.id}
                label={p.due_date ? `Due ${p.due_date}` : 'Payment'} amount={p.amount}
                paidBy={p.paid_by} onPaidByChange={v=>updateRow('cashoffer_loan_payments', p.id, 'paid_by', v, setLoanPayments)}
                sourceType="loan_payment" sourceId={p.id}
                datePaid={p.date_paid} onDatePaidChange={v=>updateRow('cashoffer_loan_payments', p.id, 'date_paid', v, setLoanPayments)}
                closingDate={closingDate}
              />
            ))}
          </>)}

          {items.length===0 && supplies.length===0 && bills.length===0 && loanPayments.length===0 && !property?.down_payment && !property?.closing_costs && (
            <div style={{ textAlign:'center', padding:20, color:'#9ca3af', fontSize:12 }}>Nothing tracked yet.</div>
          )}
        </div>
      )}
    </Modal>
  )
}
