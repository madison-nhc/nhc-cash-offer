import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase.js'
import { Modal, Field, inp, monoInp, fmt, DatePicker, Btn } from './ui.jsx'

const STATUS_OPTIONS = ['Scheduled', 'In Progress', 'Completed']
const STATUS_COLORS  = { 'Scheduled':'#9ca3af', 'In Progress':'#D97825', 'Completed':'#3B6D11' }
const SUPPLY_STATUS_OPTIONS = ['Ordered','Received']
const SUPPLY_STATUS_COLORS  = { Ordered:'#D97825', Received:'#3B6D11' }
const PAID_BY_OPTIONS = ['BPV', 'Bob', 'Eric']
const PARTNERS = ['Bob', 'Eric'] // BPV = company money, no interest owed to itself
const UTILITY_TYPES = ['Water', 'Electric', 'Gas', 'Insurance', 'Trash', 'HOA', 'Other']

// Declining-balance simple interest at 10%/yr. Each payment first clears accrued
// interest, then reduces principal — interest going forward accrues only on what's left.
function calcOwed(originalAmount, datePaid, repayments, asOf = new Date()) {
  const principal0 = parseFloat(originalAmount) || 0
  if (!datePaid || principal0 <= 0) return { balance: principal0, accruedInterest: 0, totalOwed: principal0, totalRepaid: 0 }
  const RATE = 0.10
  const sorted = [...repayments].sort((a,b) => new Date(a.payment_date) - new Date(b.payment_date))
  let balance = principal0
  let accrued = 0
  let lastDate = new Date(datePaid + 'T12:00:00')
  let totalRepaid = 0
  for (const p of sorted) {
    const pd = new Date(p.payment_date + 'T12:00:00')
    const days = Math.max(0, (pd - lastDate) / 86400000)
    accrued += balance * RATE * (days / 365)
    let remaining = parseFloat(p.amount) || 0
    totalRepaid += remaining
    if (remaining <= accrued) { accrued -= remaining }
    else { remaining -= accrued; accrued = 0; balance = Math.max(0, balance - remaining) }
    lastDate = pd
  }
  const daysSince = Math.max(0, (asOf - lastDate) / 86400000)
  accrued += balance * RATE * (daysSince / 365)
  return { balance, accruedInterest: accrued, totalOwed: balance + accrued, totalRepaid }
}

function PartnerLedger({ sourceType, sourceId, originalAmount, datePaid, onDatePaidChange, closingDate }) {
  const [payments, setPayments] = useState([])

  useEffect(() => {
    supabase.from('cashoffer_partner_repayments').select('*')
      .eq('source_type', sourceType).eq('source_id', sourceId).order('payment_date', { ascending: true })
      .then(({ data }) => setPayments(data || []))
  }, [sourceId])

  const today = new Date()
  const asOf = closingDate ? new Date(Math.min(today, new Date(closingDate + 'T12:00:00'))) : today
  const { accruedInterest } = calcOwed(originalAmount, datePaid, payments, asOf)

  return (
    <div style={{ display:'contents' }}>
      <DatePicker value={datePaid||''} onChange={e=>onDatePaidChange(e.target.value)} style={{ ...inp, fontSize:11, padding:'4px 6px', marginRight:6 }} />
      <div style={{ fontSize:12, fontWeight:700, fontFamily:'monospace', color:'#B8892A', textAlign:'right', marginRight:6, whiteSpace:'nowrap' }}>
        {fmt(accruedInterest)}
      </div>
    </div>
  )
}

function InventoryPickerModal({ propertyId, roundId, onClose, onDone }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState('')
  const [qty, setQty] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('cashoffer_inventory_items').select('*').gt('quantity_on_hand', 0).order('name', { ascending: true })
      .then(({ data }) => { setItems(data || []); setLoading(false) })
  }, [])

  const selected = items.find(i => i.id === selectedId)
  const qtyNum = parseFloat(qty) || 0
  const overStock = selected && qtyNum > selected.quantity_on_hand

  async function submit() {
    if (!selected) { alert('Pick an item from inventory.'); return }
    if (!qtyNum || qtyNum <= 0) { alert('Enter a quantity.'); return }
    if (overStock) { alert(`Only ${selected.quantity_on_hand} ${selected.unit} on hand.`); return }
    setSaving(true)
    const today = new Date().toISOString().slice(0, 10)

    const { data: supply, error } = await supabase.from('cashoffer_supplies').insert({
      property_id: propertyId, rehab_round_id: roundId,
      name: selected.name, quantity: qtyNum, unit_cost: selected.unit_cost,
      vendor: "Eric's Warehouse", status: 'Received', paid_by: 'Eric', date_paid: today,
    }).select().single()
    if (error) { setSaving(false); alert('Could not add supply: ' + error.message); return }

    await supabase.from('cashoffer_inventory_checkouts').insert({
      inventory_item_id: selected.id, property_id: propertyId, supply_id: supply.id,
      quantity: qtyNum, unit_cost_at_checkout: selected.unit_cost, checkout_date: today,
    })
    await supabase.from('cashoffer_inventory_items').update({ quantity_on_hand: selected.quantity_on_hand - qtyNum }).eq('id', selected.id)

    setSaving(false)
    onDone()
  }

  return (
    <Modal title="Add Supply From Inventory" onClose={onClose} width={420}>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {loading ? (
          <div style={{ textAlign:'center', padding:20, color:'#9ca3af', fontSize:12 }}>Loading…</div>
        ) : items.length === 0 ? (
          <div style={{ fontSize:12, color:'#9ca3af' }}>Nothing in Eric's warehouse with stock on hand right now.</div>
        ) : (
          <>
            <div>
              <div style={{ fontSize:10, color:'#9ca3af', textTransform:'uppercase', marginBottom:4 }}>Item</div>
              <select style={inp} value={selectedId} onChange={e=>{ setSelectedId(e.target.value); setQty('') }}>
                <option value="">Select an item…</option>
                {items.map(i => <option key={i.id} value={i.id}>{i.name} — {i.quantity_on_hand} {i.unit} on hand</option>)}
              </select>
            </div>
            {selected && (
              <>
                <div style={{ fontSize:12, color:'#6b7280' }}>
                  {fmt(selected.unit_cost)} / {selected.unit} · {selected.location || 'no location set'}
                </div>
                <div>
                  <div style={{ fontSize:10, color:'#9ca3af', textTransform:'uppercase', marginBottom:4 }}>Quantity needed ({selected.unit})</div>
                  <input style={{ ...monoInp, borderColor: overStock?'#B91C1C':'#D6D2CA' }} type="number" value={qty} onChange={e=>setQty(e.target.value)} />
                  {overStock && <div style={{ fontSize:11, color:'#B91C1C', marginTop:4 }}>Only {selected.quantity_on_hand} {selected.unit} available.</div>}
                </div>
              </>
            )}
            <div style={{ fontSize:11, color:'#9ca3af' }}>
              Adds this to Supplies below (paid by Eric, accrues interest) and reduces warehouse stock.
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
              <Btn variant="outline" onClick={onClose}>Cancel</Btn>
              <Btn onClick={submit} disabled={saving || !selected}>{saving ? 'Adding…' : 'Add to Supplies'}</Btn>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

function NoPartnerCells() {
  return (
    <div style={{ display:'contents' }}>
      <div style={{ fontSize:12, color:'#D6D2CA', textAlign:'center' }}>—</div>
      <div style={{ fontSize:12, color:'#D6D2CA', textAlign:'right', marginRight:6 }}>—</div>
    </div>
  )
}

function LoanSnapshot({ propertyId }) {
  const [loans, setLoans] = useState([])
  useEffect(() => {
    if (!propertyId) return
    supabase.from('cashoffer_loans').select('*').eq('property_id', propertyId).eq('is_active', true)
      .order('loan_start_date', { ascending: false })
      .then(({ data }) => setLoans(data || []))
  }, [propertyId])

  if (loans.length === 0) return null

  function estInterest(loan) {
    const months = loan.loan_start_date
      ? Math.max(0, (new Date() - new Date(loan.loan_start_date + 'T12:00:00')) / (1000 * 60 * 60 * 24 * 30.44))
      : 0
    return (parseFloat(loan.loan_amount) || 0) * ((parseFloat(loan.interest_rate) || 0) / 100) * (months / 12)
  }
  const totalInterest = loans.reduce((s, l) => s + estInterest(l), 0)
  const totalPrincipal = loans.reduce((s, l) => s + (parseFloat(l.loan_amount) || 0), 0)

  return (
    <div style={{ background: '#FAFAF8', border: '0.5px solid #D6D2CA', borderRadius: 8, padding: '10px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.7 }}>Loan Snapshot ({loans.length} active)</div>
        <div style={{ fontSize: 11, color: '#9ca3af' }}>
          Total Principal: <span style={{ fontWeight: 700, fontFamily: 'monospace', color: '#2C2C2C' }}>{fmt(totalPrincipal)}</span>
          {'  '}·{'  '}Total Est. Interest: <span style={{ fontWeight: 700, fontFamily: 'monospace', color: '#B8892A' }}>{fmt(totalInterest)}</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {loans.map(loan => (
          <div key={loan.id} style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center', background: '#fff', border: '0.5px solid #D6D2CA', borderRadius: 6, padding: '6px 12px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#2C2C2C', minWidth: 160 }}>{loan.lender_name || loan.bank || '—'}</div>
            <div><span style={{ fontSize: 10, color: '#9ca3af' }}>Principal: </span><span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'monospace' }}>{fmt(loan.loan_amount)}</span></div>
            <div><span style={{ fontSize: 10, color: '#9ca3af' }}>Rate: </span><span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'monospace' }}>{loan.interest_rate}%</span></div>
            <div><span style={{ fontSize: 10, color: '#9ca3af' }}>Est. Interest to Date: </span><span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'monospace', color: '#B8892A' }}>{fmt(estInterest(loan))}</span></div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function RehabRoundTracker({ property, repairItems = [], onChange, open, onClose }) {
  const [rounds, setRounds]           = useState([])
  const [activeRoundId, setActiveRoundId] = useState(null)
  const [items, setItems]             = useState([])
  const [supplies, setSupplies]       = useState([])
  const [bills, setBills]             = useState([])
  const [vendors, setVendors]         = useState([])
  const [activeVendorId, setActiveVendorId] = useState(null)
  const [inventoryPickerOpen, setInventoryPickerOpen] = useState(false)
  const [budget, setBudget]           = useState('')
  const vendorRefs = useRef({})

  const propertyId = property?.id
  const closingDate = property?.disposition_date || property?.sale_date || null
  const showRoundPicker = property?.type === 'Hold' || rounds.length > 1

  useEffect(() => {
    if (!open || !propertyId) return
    setBudget(property.rehab_cost || '')
    loadVendors()
    loadRounds()
  }, [open, propertyId])

  useEffect(() => {
    if (activeRoundId) loadRoundData(activeRoundId)
  }, [activeRoundId])

  async function loadRounds() {
    let { data } = await supabase.from('cashoffer_rehab_rounds').select('*').eq('property_id', propertyId).order('sort_order', { ascending: true })
    if (!data || data.length === 0) {
      const { data: created } = await supabase.from('cashoffer_rehab_rounds').insert({ property_id: propertyId, label: 'Round 1', sort_order: 0 }).select().single()
      data = created ? [created] : []
    }
    setRounds(data)
    setActiveRoundId(data[data.length - 1]?.id || null)
  }

  async function addRound() {
    const label = prompt('Name this rehab round (e.g. "Post-Tenant Turnover"):', `Round ${rounds.length + 1}`)
    if (!label) return
    const { data } = await supabase.from('cashoffer_rehab_rounds').insert({ property_id: propertyId, label, sort_order: rounds.length }).select().single()
    if (data) { setRounds(r => [...r, data]); setActiveRoundId(data.id) }
  }

  async function deleteRound() {
    const round = rounds.find(r => r.id === activeRoundId)
    if (!round) return
    if (!confirm(`Delete "${round.label}"? This permanently removes every service, supply, and utility bill logged under this round. This cannot be undone.`)) return
    await Promise.all([
      supabase.from('cashoffer_rehab_items').delete().eq('rehab_round_id', activeRoundId),
      supabase.from('cashoffer_supplies').delete().eq('rehab_round_id', activeRoundId),
      supabase.from('cashoffer_utility_bills').delete().eq('rehab_round_id', activeRoundId),
    ])
    await supabase.from('cashoffer_rehab_rounds').delete().eq('id', activeRoundId)
    const remaining = rounds.filter(r => r.id !== activeRoundId)
    setRounds(remaining)
    setActiveRoundId(remaining[remaining.length - 1]?.id || null)
  }

  async function loadVendors() {
    const { data } = await supabase.from('cashoffer_vendors').select('company_name').not('company_name', 'is', null).neq('company_name', '')
    setVendors([...new Set((data || []).map(r => r.company_name).filter(Boolean))].sort())
  }

  async function loadRoundData(roundId) {
    const [i, s, b] = await Promise.all([
      supabase.from('cashoffer_rehab_items').select('*').eq('rehab_round_id', roundId).order('sort_order', { ascending: true }),
      supabase.from('cashoffer_supplies').select('*').eq('rehab_round_id', roundId).order('created_at', { ascending: true }),
      supabase.from('cashoffer_utility_bills').select('*').eq('rehab_round_id', roundId).order('bill_date', { ascending: false }),
    ])
    if (i.error || s.error || b.error) {
      alert('Error loading rehab data: ' + (i.error?.message || s.error?.message || b.error?.message))
    }
    setItems(i.data || [])
    setSupplies(s.data || [])
    setBills(b.data || [])
  }

  function notifyParent() {
    setTimeout(async () => {
      const { data } = await supabase.from('cashoffer_rehab_items').select('actual_cost, estimated_cost').eq('property_id', propertyId)
      if (!data) return
      const total = data.reduce((s, r) => s + (r.actual_cost != null ? parseFloat(r.actual_cost) || 0 : parseFloat(r.estimated_cost) || 0), 0)
      onChange && onChange(total)
    }, 200)
  }

  async function saveBudget(val) {
    setBudget(val)
    if (propertyId) await supabase.from('cashoffer_properties').update({ rehab_cost: parseFloat(val) || null }).eq('id', propertyId)
  }

  // Services
  async function addItem() {
    const { data } = await supabase.from('cashoffer_rehab_items').insert({ property_id: propertyId, rehab_round_id: activeRoundId, name: '', status: 'Scheduled', estimated_cost: 0, sort_order: items.length }).select().single()
    if (data) setItems(p => [...p, data])
  }
  async function copyFromAnalyzer() {
    const existingNames = new Set(items.map(it => (it.name || '').trim().toLowerCase()).filter(Boolean))
    const candidates = repairItems.filter(r => r.name && !existingNames.has(r.name.trim().toLowerCase()))
    if (!candidates.length) {
      alert('Nothing new to copy — every named item on the Analyzer already exists in this round.')
      return
    }
    if (!confirm(`Copy ${candidates.length} new repair item(s) from the Analyzer? (Items already in this round will be skipped.)`)) return
    const toInsert = candidates.map((r,i) => ({ property_id: propertyId, rehab_round_id: activeRoundId, name: r.name, estimated_cost: parseFloat(r.cost)||0, status:'Scheduled', sort_order: items.length+i }))
    await supabase.from('cashoffer_rehab_items').insert(toInsert)
    loadRoundData(activeRoundId)
  }
  async function updateItem(id, field, value) {
    setItems(p => p.map(it => it.id===id ? {...it,[field]:value} : it))
    await supabase.from('cashoffer_rehab_items').update({ [field]: value }).eq('id', id)
    if (field==='actual_cost'||field==='estimated_cost') notifyParent()
  }
  async function removeItem(id) {
    await supabase.from('cashoffer_rehab_items').delete().eq('id', id)
    setItems(p => p.filter(it => it.id!==id)); notifyParent()
  }

  // Supplies
  async function addSupply() {
    const { data } = await supabase.from('cashoffer_supplies').insert({ property_id: propertyId, rehab_round_id: activeRoundId, name:'', unit_cost:0, quantity:1, vendor:'', status:'Ordered' }).select().single()
    if (data) setSupplies(p => [...p, data])
  }
  async function updateSupply(id, field, value) {
    setSupplies(p => p.map(it => it.id===id ? {...it,[field]:value} : it))
    await supabase.from('cashoffer_supplies').update({ [field]: value }).eq('id', id)
  }
  async function removeSupply(id) {
    await supabase.from('cashoffer_supplies').delete().eq('id', id)
    setSupplies(p => p.filter(it => it.id!==id))
  }

  // Utilities
  async function addBill() {
    const { data } = await supabase.from('cashoffer_utility_bills').insert({ property_id: propertyId, rehab_round_id: activeRoundId, utility_type:'Water', bill_date: new Date().toISOString().slice(0,10), amount:0, paid_by:'BPV' }).select().single()
    if (data) setBills(p => [data, ...p])
  }
  async function updateBill(id, field, value) {
    setBills(p => p.map(b => b.id===id ? {...b,[field]:value} : b))
    await supabase.from('cashoffer_utility_bills').update({ [field]: value }).eq('id', id)
  }
  async function removeBill(id) {
    await supabase.from('cashoffer_utility_bills').delete().eq('id', id)
    setBills(p => p.filter(b => b.id!==id))
  }

  if (!open) return null

  const budgetNum   = parseFloat(budget) || 0
  const estTotal    = items.reduce((s,r) => s + (parseFloat(r.estimated_cost)||0), 0)
  const actualTotal = items.reduce((s,r) => s + (r.actual_cost!=null ? parseFloat(r.actual_cost)||0 : parseFloat(r.estimated_cost)||0), 0)
  const completedCost = items.filter(r=>r.status==='Completed').reduce((s,r) => s + (r.actual_cost!=null ? parseFloat(r.actual_cost)||0 : parseFloat(r.estimated_cost)||0), 0)
  const pct = budgetNum > 0 ? Math.min(100, Math.round((completedCost/budgetNum)*100)) : 0
  const suppliesTotal = supplies.reduce((s,i) => s + ((parseFloat(i.unit_cost)||0)*(parseFloat(i.quantity)||0)), 0)
  const billsTotal = bills.reduce((s,b) => s + (parseFloat(b.amount)||0), 0)

  const paidByTotals = {}
  const addPaid = (who, val) => { if (!who) return; paidByTotals[who] = (paidByTotals[who]||0) + val }
  items.forEach(it => addPaid(it.paid_by, it.actual_cost!=null ? parseFloat(it.actual_cost)||0 : parseFloat(it.estimated_cost)||0))
  supplies.forEach(it => addPaid(it.paid_by, (parseFloat(it.unit_cost)||0)*(parseFloat(it.quantity)||0)))
  bills.forEach(b => addPaid(b.paid_by, parseFloat(b.amount)||0))

  return (
    <>
    <Modal
      title={`Rehab — ${property?.address?.split(',')[0] || ''}`}
      onClose={onClose}
      width={1240}
      footer={
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          {rounds.length > 1 ? (
            <button onClick={deleteRound} style={{ background:'#B91C1C', border:'1px solid #B91C1C', color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit', borderRadius:6, padding:'6px 12px' }}>
              Delete This Round
            </button>
          ) : <span />}
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <Btn variant="outline" onClick={onClose}>Cancel</Btn>
            <Btn onClick={onClose}>Save</Btn>
          </div>
        </div>
      }
    >
      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

        <LoanSnapshot propertyId={propertyId} />

        {/* Round picker */}
        {showRoundPicker && (
          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            {rounds.map(r => (
              <button key={r.id} onClick={()=>setActiveRoundId(r.id)} style={{
                background: activeRoundId===r.id ? '#2C2C2C' : '#F0EDE6',
                color: activeRoundId===r.id ? '#fff' : '#6b7280',
                border:'none', borderRadius:20, padding:'6px 14px', cursor:'pointer', fontSize:12, fontWeight:600, fontFamily:'inherit',
              }}>{r.label}</button>
            ))}
            <button onClick={addRound} style={{ background:'transparent', border:'1px dashed #D6D2CA', borderRadius:20, padding:'6px 14px', cursor:'pointer', fontSize:12, color:'#9ca3af', fontFamily:'inherit' }}>+ New Round</button>
          </div>
        )}

        {/* Budget + progress header */}
        <div style={{ background:'#FAFAF8', borderRadius:8, padding:'14px 16px', border:'0.5px solid #D6D2CA' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:0.8 }}>Renovation Budget</div>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontSize:11, color:'#6b7280' }}>Est. Budget ($)</span>
              <input style={{ ...monoInp, width:120, textAlign:'right', padding:'4px 8px', fontSize:13 }} type="number" value={budget} onChange={e=>saveBudget(e.target.value)} />
            </div>
          </div>
          <div style={{ position:'relative', height:5, background:'#E5E1DB', borderRadius:99, overflow:'hidden', marginBottom:8 }}>
            <div style={{ position:'absolute', left:0, top:0, height:'100%', borderRadius:99, width:`${pct}%`, background: pct>=100?'#3B6D11':'#B8892A', transition:'width 0.4s ease' }} />
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#6b7280', marginBottom:12 }}>
            <span style={{ fontWeight:700, color: pct>=100?'#3B6D11':'#B8892A' }}>{pct}% Complete</span>
            <span>{items.filter(r=>r.status==='Completed').length} of {items.length} services done</span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:8 }}>
            <div style={{ background:'#fff', borderRadius:6, padding:'8px 10px', border:'0.5px solid #D6D2CA', textAlign:'center' }}>
              <div style={{ fontSize:9, color:'#9ca3af', textTransform:'uppercase' }}>Services</div>
              <div style={{ fontSize:14, fontWeight:700, fontFamily:'monospace' }}>{fmt(actualTotal)}</div>
            </div>
            <div style={{ background:'#fff', borderRadius:6, padding:'8px 10px', border:'0.5px solid #D6D2CA', textAlign:'center' }}>
              <div style={{ fontSize:9, color:'#9ca3af', textTransform:'uppercase' }}>Supplies</div>
              <div style={{ fontSize:14, fontWeight:700, fontFamily:'monospace' }}>{fmt(suppliesTotal)}</div>
            </div>
            <div style={{ background:'#fff', borderRadius:6, padding:'8px 10px', border:'0.5px solid #D6D2CA', textAlign:'center' }}>
              <div style={{ fontSize:9, color:'#9ca3af', textTransform:'uppercase' }}>Utilities</div>
              <div style={{ fontSize:14, fontWeight:700, fontFamily:'monospace' }}>{fmt(billsTotal)}</div>
            </div>
            <div style={{ background:'#fef9ee', borderRadius:6, padding:'8px 10px', border:'0.5px solid #B8892A40', textAlign:'center' }}>
              <div style={{ fontSize:9, color:'#9ca3af', textTransform:'uppercase' }}>Round Total</div>
              <div style={{ fontSize:14, fontWeight:700, fontFamily:'monospace', color:'#B8892A' }}>{fmt(actualTotal+suppliesTotal+billsTotal)}</div>
            </div>
          </div>
        </div>

        {/* SERVICES */}
        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#2C2C2C' }}>Services</div>
            {repairItems.filter(r=>r.name).length > 0 && (
              <button onClick={copyFromAnalyzer} style={{ background:'#2C2C2C', color:'#fff', border:'none', borderRadius:6, padding:'6px 12px', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>Copy from Analyzer</button>
            )}
          </div>
          {items.length > 0 && (
            <div style={{ border:'0.5px solid #D6D2CA', borderRadius:8, overflow:'hidden', marginBottom:8 }}>
              <div style={{ display:'grid', gridTemplateColumns:'2fr 110px 170px 100px 90px 115px 90px 28px', background:'#F0EDE6', padding:'6px 10px' }}>
                {['Item','Status','Vendor','Amount','Paid By','Date Paid','Interest',''].map(h=><div key={h} style={{ fontSize:10, fontWeight:600, color:'#6b7280', textTransform:'uppercase' }}>{h}</div>)}
              </div>
              {items.map((item,i) => (
                <div key={item.id} style={{ display:'grid', gridTemplateColumns:'2fr 110px 170px 100px 90px 115px 90px 28px', padding:'6px 10px', alignItems:'center', background:i%2===0?'#fff':'#FAFAF8', borderTop:i>0?'0.5px solid #F0EDE6':'none' }}>
                    <input style={{ ...inp, fontSize:12, padding:'4px 6px', marginRight:6 }} value={item.name} onChange={e=>updateItem(item.id,'name',e.target.value)} />
                    <select value={item.status} onChange={e=>updateItem(item.id,'status',e.target.value)} style={{ border:'0.5px solid #D6D2CA', borderRadius:4, padding:'4px 6px', fontSize:11, fontFamily:'inherit', fontWeight:700, color:STATUS_COLORS[item.status]||'#2C2C2C', background:'#fff', cursor:'pointer', marginRight:6 }}>
                      {STATUS_OPTIONS.map(s=><option key={s} value={s}>{s}</option>)}
                    </select>
                    <div style={{ position:'relative', marginRight:6 }}>
                      <input ref={el=>vendorRefs.current[item.id]=el} style={{ ...inp, fontSize:12, padding:'4px 6px', width:'100%' }} value={item.vendor||''}
                        onChange={e=>{ updateItem(item.id,'vendor',e.target.value); setActiveVendorId(item.id) }}
                        onBlur={()=>setTimeout(()=>setActiveVendorId(null),150)} onFocus={()=>setActiveVendorId(item.id)} />
                      {activeVendorId===item.id && vendors.filter(v=>v.toLowerCase().includes((item.vendor||'').toLowerCase())&&v!==item.vendor).length>0 && (
                        <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:50, background:'#fff', border:'0.5px solid #D6D2CA', borderRadius:4, boxShadow:'0 4px 12px rgba(0,0,0,0.1)', maxHeight:140, overflowY:'auto' }}>
                          {vendors.filter(v=>v.toLowerCase().includes((item.vendor||'').toLowerCase())&&v!==item.vendor).map(v=>(
                            <div key={v} onMouseDown={()=>{updateItem(item.id,'vendor',v);setActiveVendorId(null)}} style={{ padding:'7px 10px', fontSize:12, cursor:'pointer', borderBottom:'0.5px solid #F0EDE6' }}>{v}</div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ position:'relative', marginRight:6 }}>
                      <span style={{ position:'absolute', left:6, top:'50%', transform:'translateY(-50%)', fontSize:12, color:'#9ca3af', fontFamily:'monospace', pointerEvents:'none' }}>$</span>
                      <input style={{ ...monoInp, fontSize:12, padding:'4px 6px 4px 16px', textAlign:'right', borderColor:item.status==='Completed'?'#3B6D11':'#D6D2CA', width:'100%' }} type="number"
                        value={item.actual_cost!=null?item.actual_cost:''} onChange={e=>updateItem(item.id,'actual_cost', e.target.value===''?null:parseFloat(e.target.value)||0)} />
                    </div>
                    <select value={item.paid_by||''} onChange={e=>updateItem(item.id,'paid_by',e.target.value||null)} style={{ border:'0.5px solid #D6D2CA', borderRadius:4, padding:'4px 6px', fontSize:11, fontFamily:'inherit', background:'#fff', cursor:'pointer', marginRight:6 }}>
                      <option value="">—</option>
                      {PAID_BY_OPTIONS.map(p=><option key={p} value={p}>{p}</option>)}
                    </select>
                    {PARTNERS.includes(item.paid_by) ? (
                      <PartnerLedger
                        sourceType="rehab_item" sourceId={item.id}
                        originalAmount={item.actual_cost!=null?item.actual_cost:item.estimated_cost}
                        datePaid={item.date_paid}
                        onDatePaidChange={v=>updateItem(item.id,'date_paid',v)}
                        closingDate={closingDate}
                      />
                    ) : <NoPartnerCells />}
                    <button onClick={()=>removeItem(item.id)} style={{ background:'none', border:'none', color:'#D6D2CA', cursor:'pointer', fontSize:18, padding:0 }}>×</button>
                </div>
              ))}
            </div>
          )}
          <button onClick={addItem} style={{ background:'transparent', border:'1px dashed #D6D2CA', borderRadius:6, padding:'7px', color:'#9ca3af', fontSize:12, cursor:'pointer', fontFamily:'inherit', width:'100%' }}>+ Add Service</button>
        </div>

        {/* SUPPLIES */}
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:'#2C2C2C', marginBottom:8 }}>Supplies</div>
          {supplies.length > 0 && (
            <div style={{ border:'0.5px solid #D6D2CA', borderRadius:8, overflow:'hidden', marginBottom:8 }}>
              <div style={{ display:'grid', gridTemplateColumns:'2fr 55px 85px 85px 170px 90px 90px 115px 90px 28px', background:'#F0EDE6', padding:'6px 10px' }}>
                {['Name','Qty','Unit Cost','Total','Vendor/Store','Status','Paid By','Date Paid','Interest',''].map(h=><div key={h} style={{ fontSize:10, fontWeight:600, color:'#6b7280', textTransform:'uppercase' }}>{h}</div>)}
              </div>
              {supplies.map((it,i) => (
                <div key={it.id} style={{ display:'grid', gridTemplateColumns:'2fr 55px 85px 85px 170px 90px 90px 115px 90px 28px', padding:'6px 10px', alignItems:'center', background:i%2===0?'#fff':'#FAFAF8', borderTop:i>0?'0.5px solid #F0EDE6':'none' }}>
                    <input style={{ ...inp, fontSize:12, padding:'4px 6px', marginRight:6 }} value={it.name||''} onChange={e=>updateSupply(it.id,'name',e.target.value)} />
                    <input style={{ ...monoInp, fontSize:12, padding:'4px 6px', textAlign:'right', marginRight:6 }} type="number" value={it.quantity||''} onChange={e=>updateSupply(it.id,'quantity',parseFloat(e.target.value)||0)} />
                    <input style={{ ...monoInp, fontSize:12, padding:'4px 6px', textAlign:'right', marginRight:6 }} type="number" value={it.unit_cost||''} onChange={e=>updateSupply(it.id,'unit_cost',parseFloat(e.target.value)||0)} />
                    <div style={{ fontFamily:'monospace', fontSize:12, fontWeight:600, textAlign:'right', marginRight:6 }}>{fmt((parseFloat(it.unit_cost)||0)*(parseFloat(it.quantity)||0))}</div>
                    <input style={{ ...inp, fontSize:12, padding:'4px 6px', marginRight:6 }} value={it.vendor||''} onChange={e=>updateSupply(it.id,'vendor',e.target.value)} />
                    <select style={{ border:'0.5px solid #D6D2CA', borderRadius:4, padding:'4px 6px', fontSize:11, color:SUPPLY_STATUS_COLORS[it.status], fontWeight:700, marginRight:6, background:'#fff' }} value={it.status||'Ordered'} onChange={e=>updateSupply(it.id,'status',e.target.value)}>
                      {SUPPLY_STATUS_OPTIONS.map(s=><option key={s} value={s}>{s}</option>)}
                    </select>
                    <select style={{ border:'0.5px solid #D6D2CA', borderRadius:4, padding:'4px 6px', fontSize:11, fontFamily:'inherit', background:'#fff', cursor:'pointer', marginRight:6 }} value={it.paid_by||''} onChange={e=>updateSupply(it.id,'paid_by',e.target.value||null)}>
                      <option value="">—</option>
                      {PAID_BY_OPTIONS.map(p=><option key={p} value={p}>{p}</option>)}
                    </select>
                    {PARTNERS.includes(it.paid_by) ? (
                      <PartnerLedger
                        sourceType="supply" sourceId={it.id}
                        originalAmount={(parseFloat(it.unit_cost)||0)*(parseFloat(it.quantity)||0)}
                        datePaid={it.date_paid}
                        onDatePaidChange={v=>updateSupply(it.id,'date_paid',v)}
                        closingDate={closingDate}
                      />
                    ) : <NoPartnerCells />}
                    <button onClick={()=>removeSupply(it.id)} style={{ background:'none', border:'none', color:'#D6D2CA', cursor:'pointer', fontSize:18, padding:0 }}>×</button>
                </div>
              ))}
            </div>
          )}
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={addSupply} style={{ flex:1, background:'transparent', border:'1px dashed #D6D2CA', borderRadius:6, padding:'7px', color:'#9ca3af', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>+ Add Supply</button>
            <button onClick={()=>setInventoryPickerOpen(true)} style={{ flex:1, background:'transparent', border:'1px dashed #2D6FAF', borderRadius:6, padding:'7px', color:'#2D6FAF', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>+ From Inventory (Eric's Warehouse)</button>
          </div>
        </div>

        {/* UTILITIES */}
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:'#2C2C2C', marginBottom:4 }}>Utilities & Holding Costs</div>
          <div style={{ fontSize:11, color:'#9ca3af', marginBottom:8 }}>Recurring bills while in rehab — separate from the loan payment.</div>
          {bills.length > 0 && (
            <div style={{ border:'0.5px solid #D6D2CA', borderRadius:8, overflow:'hidden', marginBottom:8 }}>
              <div style={{ display:'grid', gridTemplateColumns:'115px 170px 90px 90px 115px 90px 28px', background:'#F0EDE6', padding:'6px 10px' }}>
                {['Bill Date','Type','Amount','Paid By','Date Paid','Interest',''].map(h=><div key={h} style={{ fontSize:10, fontWeight:600, color:'#6b7280', textTransform:'uppercase' }}>{h}</div>)}
              </div>
              {bills.map((b,i) => (
                <div key={b.id} style={{ display:'grid', gridTemplateColumns:'115px 170px 90px 90px 115px 90px 28px', padding:'6px 10px', alignItems:'center', background:i%2===0?'#fff':'#FAFAF8', borderTop:i>0?'0.5px solid #F0EDE6':'none' }}>
                    <DatePicker style={{ ...inp, fontSize:12, padding:'4px 6px', marginRight:6 }} value={b.bill_date||''} onChange={e=>updateBill(b.id,'bill_date',e.target.value)} />
                    <select value={b.utility_type||'Other'} onChange={e=>updateBill(b.id,'utility_type',e.target.value)} style={{ border:'0.5px solid #D6D2CA', borderRadius:4, padding:'4px 6px', fontSize:12, fontFamily:'inherit', background:'#fff', cursor:'pointer', marginRight:6 }}>
                      {UTILITY_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                    </select>
                    <div style={{ position:'relative', marginRight:6 }}>
                      <span style={{ position:'absolute', left:6, top:'50%', transform:'translateY(-50%)', fontSize:12, color:'#9ca3af', fontFamily:'monospace', pointerEvents:'none' }}>$</span>
                      <input style={{ ...monoInp, fontSize:12, padding:'4px 6px 4px 16px', textAlign:'right', width:'100%' }} type="number" value={b.amount??''} onChange={e=>updateBill(b.id,'amount', e.target.value===''?null:parseFloat(e.target.value)||0)} />
                    </div>
                    <select value={b.paid_by||''} onChange={e=>updateBill(b.id,'paid_by',e.target.value||null)} style={{ border:'0.5px solid #D6D2CA', borderRadius:4, padding:'4px 6px', fontSize:11, fontFamily:'inherit', background:'#fff', cursor:'pointer', marginRight:6 }}>
                      <option value="">—</option>
                      {PAID_BY_OPTIONS.map(p=><option key={p} value={p}>{p}</option>)}
                    </select>
                    {PARTNERS.includes(b.paid_by) ? (
                      <PartnerLedger
                        sourceType="utility_bill" sourceId={b.id}
                        originalAmount={b.amount}
                        datePaid={b.date_paid || b.bill_date}
                        onDatePaidChange={v=>updateBill(b.id,'date_paid',v)}
                        closingDate={closingDate}
                      />
                    ) : <NoPartnerCells />}
                    <button onClick={()=>removeBill(b.id)} style={{ background:'none', border:'none', color:'#D6D2CA', cursor:'pointer', fontSize:18, padding:0 }}>×</button>
                </div>
              ))}
            </div>
          )}
          <button onClick={addBill} style={{ background:'transparent', border:'1px dashed #D6D2CA', borderRadius:6, padding:'7px', color:'#9ca3af', fontSize:12, cursor:'pointer', fontFamily:'inherit', width:'100%' }}>+ Add Bill</button>
        </div>

        {/* Who fronted the money */}
        {Object.keys(paidByTotals).length > 0 && (() => {
          const PAID_BY_COLOR = { Bob:'#2D6FAF', Eric:'#D97825', BPV:'#B8892A' }
          const grandTotal = Object.values(paidByTotals).reduce((s,v)=>s+v, 0)
          return (
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:0.8, marginBottom:8 }}>Who Fronted The Money — This Round</div>
              <div style={{ display:'grid', gridTemplateColumns:`repeat(${Object.keys(paidByTotals).length}, 1fr)`, gap:10 }}>
                {Object.entries(paidByTotals).map(([who,t]) => {
                  const color = PAID_BY_COLOR[who] || '#9ca3af'
                  const share = grandTotal > 0 ? Math.round((t/grandTotal)*100) : 0
                  return (
                    <div key={who} style={{ background:'#fff', border:'0.5px solid #D6D2CA', borderTop:`3px solid ${color}`, borderRadius:8, padding:'10px 12px' }}>
                      <div style={{ fontSize:10, fontWeight:700, color, textTransform:'uppercase', letterSpacing:0.6, marginBottom:4 }}>{who}</div>
                      <div style={{ fontSize:18, fontWeight:700, fontFamily:'monospace', color:'#2C2C2C', lineHeight:1 }}>{fmt(t)}</div>
                      <div style={{ fontSize:10, color:'#9ca3af', marginTop:5 }}>{share}% of this round</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

      </div>
    </Modal>

    {inventoryPickerOpen && (
      <InventoryPickerModal
        propertyId={propertyId}
        roundId={activeRoundId}
        onClose={()=>setInventoryPickerOpen(false)}
        onDone={()=>{ setInventoryPickerOpen(false); loadRoundData(activeRoundId) }}
      />
    )}
    </>
  )
}




