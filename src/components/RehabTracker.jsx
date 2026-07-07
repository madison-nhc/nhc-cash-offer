import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase.js'
import { Field, inp, monoInp, fmt, Modal } from './ui.jsx'

const STATUS_OPTIONS = ['Scheduled', 'In Progress', 'Completed']
const STATUS_COLORS  = { 'Scheduled':'#9ca3af', 'In Progress':'#D97825', 'Completed':'#3B6D11' }
const PAID_BY_OPTIONS = ['BPV', 'Bob', 'Eric', 'Blaire', 'Other']
const UTILITY_TYPES = ['Water', 'Electric', 'Gas', 'Insurance', 'Trash', 'HOA', 'Other']

export default function RehabTracker({ property, repairItems = [], onChange, open = true, onClose }) {
  const [items, setItems]         = useState([])
  const [budget, setBudget]       = useState('')
  const [vendors, setVendors]     = useState([])
  const [activeVendorId, setActiveVendorId] = useState(null)
  const [bills, setBills]         = useState([])
  const vendorRefs = useRef({})

  useEffect(() => {
    if (!property?.id) return
    setBudget(property.rehab_cost || '')
    loadItems(property.id)
    loadVendors()
    loadBills(property.id)
  }, [property?.id])

  async function loadBills(propertyId) {
    const { data } = await supabase
      .from('cashoffer_utility_bills')
      .select('*')
      .eq('property_id', propertyId)
      .order('bill_date', { ascending: false })
    setBills(data || [])
  }

  async function addBill() {
    if (!property?.id) return
    const { data } = await supabase.from('cashoffer_utility_bills').insert({
      property_id: property.id,
      utility_type: 'Water',
      bill_date: new Date().toISOString().slice(0, 10),
      amount: 0,
      paid_by: 'BPV',
    }).select().single()
    if (data) setBills(prev => [data, ...prev])
  }

  async function updateBill(id, field, value) {
    setBills(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b))
    await supabase.from('cashoffer_utility_bills').update({ [field]: value }).eq('id', id)
  }

  async function removeBill(id) {
    await supabase.from('cashoffer_utility_bills').delete().eq('id', id)
    setBills(prev => prev.filter(b => b.id !== id))
  }

  async function loadItems(propertyId) {
    const { data } = await supabase
      .from('cashoffer_rehab_items')
      .select('*')
      .eq('property_id', propertyId)
      .order('sort_order', { ascending: true })
    setItems(data || [])
  }

  async function loadVendors() {
    const { data } = await supabase
      .from('cashoffer_vendors')
      .select('company_name')
      .not('company_name', 'is', null)
      .neq('company_name', '')
    const unique = [...new Set((data || []).map(r => r.company_name).filter(Boolean))].sort()
    setVendors(unique)
  }

  async function copyFromAnalyzer() {
    if (!property?.id || !repairItems.length) return
    if (!confirm(`Copy ${repairItems.filter(r=>r.name).length} repair item(s) from the Analyzer? This will add them to your current rehab list.`)) return
    const toInsert = repairItems
      .filter(r => r.name)
      .map((r, i) => ({
        property_id: property.id,
        name: r.name,
        estimated_cost: parseFloat(r.cost) || 0,
        status: 'Scheduled',
        sort_order: items.length + i,
      }))
    if (!toInsert.length) return
    await supabase.from('cashoffer_rehab_items').insert(toInsert)
    loadItems(property.id)
  }

  async function addItem() {
    if (!property?.id) return
    const { data } = await supabase.from('cashoffer_rehab_items').insert({
      property_id: property.id,
      name: '',
      status: 'Scheduled',
      estimated_cost: 0,
      sort_order: items.length,
    }).select().single()
    if (data) setItems(prev => [...prev, data])
  }

  async function updateItem(id, field, value) {
    setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it))
    await supabase.from('cashoffer_rehab_items').update({ [field]: value }).eq('id', id)
    if (field === 'actual_cost' || field === 'estimated_cost') notifyParent()
  }

  async function removeItem(id) {
    await supabase.from('cashoffer_rehab_items').delete().eq('id', id)
    setItems(prev => prev.filter(it => it.id !== id))
    notifyParent()
  }

  async function saveBudget(val) {
    setBudget(val)
    if (!property?.id) return
    await supabase.from('cashoffer_properties').update({ rehab_cost: parseFloat(val) || null }).eq('id', property.id)
  }

  function notifyParent() {
    setTimeout(async () => {
      const { data } = await supabase
        .from('cashoffer_rehab_items')
        .select('actual_cost, estimated_cost')
        .eq('property_id', property.id)
      if (!data) return
      const total = data.reduce((s, r) => {
        const val = r.actual_cost !== null && r.actual_cost !== undefined
          ? parseFloat(r.actual_cost) || 0
          : parseFloat(r.estimated_cost) || 0
        return s + val
      }, 0)
      if (onChange) onChange(total)
    }, 200)
  }

  // Derived stats
  const budgetNum   = parseFloat(budget) || 0
  const estTotal    = items.reduce((s, r) => s + (parseFloat(r.estimated_cost) || 0), 0)
  const actualTotal = items.reduce((s, r) => {
    const val = r.actual_cost !== null && r.actual_cost !== undefined
      ? parseFloat(r.actual_cost) || 0
      : parseFloat(r.estimated_cost) || 0
    return s + val
  }, 0)
  const completedCost = items
    .filter(r => r.status === 'Completed')
    .reduce((s, r) => {
      const val = r.actual_cost !== null && r.actual_cost !== undefined
        ? parseFloat(r.actual_cost) || 0
        : parseFloat(r.estimated_cost) || 0
      return s + val
    }, 0)
  const pct = budgetNum > 0 ? Math.min(100, Math.round((completedCost / budgetNum) * 100)) : 0
  const actualOverEst = actualTotal > estTotal
  const actualColor   = actualOverEst ? '#B91C1C' : '#3B6D11'

  const paidByTotals = {}
  for (const it of items) {
    if (!it.paid_by) continue
    const val = it.actual_cost !== null && it.actual_cost !== undefined ? parseFloat(it.actual_cost) || 0 : parseFloat(it.estimated_cost) || 0
    paidByTotals[it.paid_by] = (paidByTotals[it.paid_by] || 0) + val
  }
  for (const b of bills) {
    if (!b.paid_by) continue
    paidByTotals[b.paid_by] = (paidByTotals[b.paid_by] || 0) + (parseFloat(b.amount) || 0)
  }

  if (!open) return null

  return (
    <Modal title={`Rehab Tracker — ${property?.address?.split(',')[0] || ''}`} onClose={onClose} width={860}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Budget + progress header */}
      <div style={{ background: '#FAFAF8', borderRadius: 8, padding: '14px 16px', border: '0.5px solid #D6D2CA' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Renovation Budget
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: '#6b7280' }}>Est. Budget ($)</span>
            <input
              style={{ ...monoInp, width: 120, textAlign: 'right', padding: '4px 8px', fontSize: 13 }}
              type="number"
              value={budget}
              onChange={e => saveBudget(e.target.value)}
            />
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ position: 'relative', height: 5, background: '#E5E1DB', borderRadius: 99, overflow: 'hidden', marginBottom: 8 }}>
          <div style={{
            position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: 99,
            width: `${pct}%`,
            background: pct >= 100 ? '#3B6D11' : '#B8892A',
            transition: 'width 0.4s ease'
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7280', marginBottom: 12 }}>
          <span style={{ fontWeight: 700, color: pct >= 100 ? '#3B6D11' : '#B8892A' }}>{pct}% Complete</span>
          <span>{items.filter(r => r.status === 'Completed').length} of {items.length} items done</span>
        </div>

        {/* Two stat cards: Est Total and Actual */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={{ background: '#fff', borderRadius: 6, padding: '8px 12px', border: '0.5px solid #D6D2CA', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 2 }}>Est. Total</div>
            <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'monospace', color: '#2C2C2C' }}>{fmt(estTotal)}</div>
          </div>
          <div style={{ background: actualOverEst ? '#fef2f2' : '#f0fdf4', borderRadius: 6, padding: '8px 12px', border: `0.5px solid ${actualColor}40`, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 2 }}>Actual</div>
            <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'monospace', color: actualColor }}>{fmt(actualTotal)}</div>
          </div>
        </div>
      </div>

      {/* Actions row */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          onClick={copyFromAnalyzer}
          disabled={!repairItems.filter(r => r.name).length}
          style={{
            background: repairItems.filter(r => r.name).length ? '#2C2C2C' : '#F0EDE6',
            color: repairItems.filter(r => r.name).length ? '#fff' : '#9ca3af',
            border: 'none', borderRadius: 6, padding: '8px 14px',
            cursor: repairItems.filter(r => r.name).length ? 'pointer' : 'default',
            fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
          }}
        >
          Copy from Analyzer
        </button>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>
          {repairItems.filter(r => r.name).length} item{repairItems.filter(r => r.name).length !== 1 ? 's' : ''} in Analyzer
        </span>
      </div>

      {/* Line items */}
      {items.length > 0 && (
        <div style={{ border: '0.5px solid #D6D2CA', borderRadius: 8, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 120px 1fr 90px 90px 28px', gap: 0, background: '#F0EDE6', padding: '6px 10px' }}>
            {['Item', 'Status', 'Vendor', 'Actual', 'Paid By', ''].map(h => (
              <div key={h} style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.7 }}>{h}</div>
            ))}
          </div>
          {items.map((item, i) => (
            <div key={item.id} style={{
              display: 'grid', gridTemplateColumns: '2fr 120px 1fr 90px 90px 28px',
              gap: 0, padding: '6px 10px', alignItems: 'center',
              background: i % 2 === 0 ? '#fff' : '#FAFAF8',
              borderTop: i > 0 ? '0.5px solid #F0EDE6' : 'none'
            }}>
              {/* Name */}
              <input
                style={{ ...inp, fontSize: 12, padding: '4px 6px', marginRight: 6 }}
                value={item.name}
                onChange={e => updateItem(item.id, 'name', e.target.value)}
              />
              {/* Status */}
              <select
                value={item.status}
                onChange={e => updateItem(item.id, 'status', e.target.value)}
                style={{
                  border: '0.5px solid #D6D2CA', borderRadius: 4, padding: '4px 6px',
                  fontSize: 11, fontFamily: 'inherit', fontWeight: 700,
                  color: STATUS_COLORS[item.status] || '#2C2C2C',
                  background: '#fff', cursor: 'pointer', marginRight: 6
                }}
              >
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {/* Vendor with autocomplete */}
              <div style={{ position: 'relative', marginRight: 6 }}>
                <input
                  ref={el => vendorRefs.current[item.id] = el}
                  style={{ ...inp, fontSize: 12, padding: '4px 6px', width: '100%' }}
                  value={item.vendor || ''}
                  onChange={e => { updateItem(item.id, 'vendor', e.target.value); setActiveVendorId(item.id) }}
                  onBlur={() => setTimeout(() => setActiveVendorId(null), 150)}
                  onFocus={() => setActiveVendorId(item.id)}
                />
                {activeVendorId === item.id && vendors.filter(v =>
                  v.toLowerCase().includes((item.vendor || '').toLowerCase()) && v !== item.vendor
                ).length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                    background: '#fff', border: '0.5px solid #D6D2CA', borderRadius: 4,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: 140, overflowY: 'auto'
                  }}>
                    {vendors.filter(v =>
                      v.toLowerCase().includes((item.vendor || '').toLowerCase()) && v !== item.vendor
                    ).map(v => (
                      <div
                        key={v}
                        onMouseDown={() => { updateItem(item.id, 'vendor', v); setActiveVendorId(null) }}
                        style={{ padding: '7px 10px', fontSize: 12, cursor: 'pointer', borderBottom: '0.5px solid #F0EDE6' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#FAFAF8'}
                        onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                      >{v}</div>
                    ))}
                  </div>
                )}
              </div>
              {/* Actual cost */}
              <input
                style={{
                  ...monoInp, fontSize: 12, padding: '4px 6px', textAlign: 'right',
                  borderColor: item.status === 'Completed' ? '#3B6D11' : '#D6D2CA',
                  marginRight: 6
                }}
                type="number"
                value={item.actual_cost !== null && item.actual_cost !== undefined ? item.actual_cost : ''}
                onChange={e => updateItem(item.id, 'actual_cost', e.target.value === '' ? null : parseFloat(e.target.value) || 0)}
              />
              {/* Paid By */}
              <select
                value={item.paid_by || ''}
                onChange={e => updateItem(item.id, 'paid_by', e.target.value || null)}
                style={{ border: '0.5px solid #D6D2CA', borderRadius: 4, padding: '4px 6px', fontSize: 11, fontFamily: 'inherit', background: '#fff', cursor: 'pointer', marginRight: 6 }}
              >
                <option value="">—</option>
                {PAID_BY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              {/* Delete */}
              <button
                onClick={() => removeItem(item.id)}
                style={{ background: 'none', border: 'none', color: '#D6D2CA', cursor: 'pointer', fontSize: 18, padding: 0, lineHeight: 1 }}
              >×</button>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={addItem}
        style={{ background: 'transparent', border: '1px dashed #D6D2CA', borderRadius: 6, padding: '7px', color: '#9ca3af', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}
      >
        + Add Line Item
      </button>

      {/* Who fronted the money */}
      {Object.keys(paidByTotals).length > 0 && (
        <div style={{ background: '#FAFAF8', border: '0.5px solid #D6D2CA', borderRadius: 8, padding: '12px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
            Who Fronted The Money
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {Object.entries(paidByTotals).map(([who, total]) => (
              <div key={who}>
                <div style={{ fontSize: 10, color: '#9ca3af' }}>{who}</div>
                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'monospace', color: '#2C2C2C' }}>{fmt(total)}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 8 }}>Includes rehab line items and utility/holding cost bills below. Reimbursement and interest owed are tracked with your lender separately.</div>
        </div>
      )}

      {/* Utilities & Holding Costs */}
      <div style={{ marginTop: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#2C2C2C', marginBottom: 4 }}>Utilities & Holding Costs</div>
        <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 10 }}>Recurring monthly bills while the property is in rehab — separate from any loan payment.</div>

        {bills.length > 0 && (
          <div style={{ border: '0.5px solid #D6D2CA', borderRadius: 8, overflow: 'hidden', marginBottom: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 90px 90px 28px', gap: 0, background: '#F0EDE6', padding: '6px 10px' }}>
              {['Date', 'Type', 'Amount', 'Paid By', ''].map(h => (
                <div key={h} style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.7 }}>{h}</div>
              ))}
            </div>
            {bills.map((b, i) => (
              <div key={b.id} style={{
                display: 'grid', gridTemplateColumns: '110px 1fr 90px 90px 28px',
                gap: 0, padding: '6px 10px', alignItems: 'center',
                background: i % 2 === 0 ? '#fff' : '#FAFAF8',
                borderTop: i > 0 ? '0.5px solid #F0EDE6' : 'none'
              }}>
                <input
                  style={{ ...inp, fontSize: 12, padding: '4px 6px', marginRight: 6 }}
                  type="date"
                  value={b.bill_date || ''}
                  onChange={e => updateBill(b.id, 'bill_date', e.target.value)}
                />
                <select
                  value={b.utility_type || 'Other'}
                  onChange={e => updateBill(b.id, 'utility_type', e.target.value)}
                  style={{ border: '0.5px solid #D6D2CA', borderRadius: 4, padding: '4px 6px', fontSize: 12, fontFamily: 'inherit', background: '#fff', cursor: 'pointer', marginRight: 6 }}
                >
                  {UTILITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input
                  style={{ ...monoInp, fontSize: 12, padding: '4px 6px', textAlign: 'right', marginRight: 6 }}
                  type="number"
                  value={b.amount ?? ''}
                  onChange={e => updateBill(b.id, 'amount', e.target.value === '' ? null : parseFloat(e.target.value) || 0)}
                />
                <select
                  value={b.paid_by || ''}
                  onChange={e => updateBill(b.id, 'paid_by', e.target.value || null)}
                  style={{ border: '0.5px solid #D6D2CA', borderRadius: 4, padding: '4px 6px', fontSize: 11, fontFamily: 'inherit', background: '#fff', cursor: 'pointer', marginRight: 6 }}
                >
                  <option value="">—</option>
                  {PAID_BY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <button onClick={() => removeBill(b.id)} style={{ background: 'none', border: 'none', color: '#D6D2CA', cursor: 'pointer', fontSize: 18, padding: 0, lineHeight: 1 }}>×</button>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={addBill}
          style={{ background: 'transparent', border: '1px dashed #D6D2CA', borderRadius: 6, padding: '7px', color: '#9ca3af', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}
        >
          + Add Bill
        </button>
      </div>

    </div>
    </Modal>
  )
}


