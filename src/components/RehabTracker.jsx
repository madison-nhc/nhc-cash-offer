import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase.js'
import { Field, inp, monoInp, fmt } from './ui.jsx'

const STATUS_OPTIONS = ['Scheduled', 'In Progress', 'Completed']
const STATUS_COLORS  = { 'Scheduled':'#9ca3af', 'In Progress':'#D97825', 'Completed':'#3B6D11' }

export default function RehabTracker({ property, repairItems = [], onChange }) {
  const [items, setItems]         = useState([])
  const [budget, setBudget]       = useState('')
  const [vendors, setVendors]     = useState([])
  const [activeVendorId, setActiveVendorId] = useState(null)
  const vendorRefs = useRef({})

  useEffect(() => {
    if (!property?.id) return
    setBudget(property.rehab_estimated_cost || '')
    loadItems(property.id)
    loadVendors()
  }, [property?.id])

  async function loadItems(propertyId) {
    const { data } = await supabase
      .from('rehab_items')
      .select('*')
      .eq('property_id', propertyId)
      .order('sort_order', { ascending: true })
    setItems(data || [])
  }

  async function loadVendors() {
    const { data } = await supabase
      .from('rehab_items')
      .select('vendor')
      .not('vendor', 'is', null)
      .neq('vendor', '')
    const unique = [...new Set((data || []).map(r => r.vendor).filter(Boolean))].sort()
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
    await supabase.from('rehab_items').insert(toInsert)
    loadItems(property.id)
  }

  async function addItem() {
    if (!property?.id) return
    const { data } = await supabase.from('rehab_items').insert({
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
    await supabase.from('rehab_items').update({ [field]: value }).eq('id', id)
    if (field === 'actual_cost' || field === 'estimated_cost') notifyParent()
  }

  async function removeItem(id) {
    await supabase.from('rehab_items').delete().eq('id', id)
    setItems(prev => prev.filter(it => it.id !== id))
    notifyParent()
  }

  async function saveBudget(val) {
    setBudget(val)
    if (!property?.id) return
    await supabase.from('properties').update({ rehab_estimated_cost: parseFloat(val) || null }).eq('id', property.id)
  }

  function notifyParent() {
    setTimeout(async () => {
      const { data } = await supabase
        .from('rehab_items')
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

  return (
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
              placeholder="0"
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
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 130px 1fr 90px 28px', gap: 0, background: '#F0EDE6', padding: '6px 10px' }}>
            {['Item', 'Status', 'Vendor', 'Actual', ''].map(h => (
              <div key={h} style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.7 }}>{h}</div>
            ))}
          </div>
          {items.map((item, i) => (
            <div key={item.id} style={{
              display: 'grid', gridTemplateColumns: '2fr 130px 1fr 90px 28px',
              gap: 0, padding: '6px 10px', alignItems: 'center',
              background: i % 2 === 0 ? '#fff' : '#FAFAF8',
              borderTop: i > 0 ? '0.5px solid #F0EDE6' : 'none'
            }}>
              {/* Name */}
              <input
                style={{ ...inp, fontSize: 12, padding: '4px 6px', marginRight: 6 }}
                value={item.name}
                onChange={e => updateItem(item.id, 'name', e.target.value)}
                placeholder="Item name"
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
                  placeholder="Vendor"
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
                placeholder="$"
              />
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

    </div>
  )
}
