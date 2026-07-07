import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase.js'
import { PageWrap, SectionBar, EmptyState, Field, FieldRow, inp, monoInp, Btn, Badge, Modal, LoadingSpinner, fmt, DatePicker } from '../components/ui.jsx'

const CATEGORIES = ['Appliances', 'Wood', 'Wiring', 'Plumbing', 'Electrical', 'Hardware', 'Fixtures', 'Other']
const UNITS = ['qty', 'ft']

const CAT_COLOR = {
  Appliances: '#2D6FAF', Wood: '#B8892A', Wiring: '#D97825', Plumbing: '#3B6D11',
  Electrical: '#D97825', Hardware: '#6b7280', Fixtures: '#2D6FAF', Other: '#9ca3af',
}

// Small property search — same pattern as the global search in App.jsx, scoped to this page.
function PropertySearch({ value, onChange }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const timer = setTimeout(async () => {
      const { data } = await supabase.from('cashoffer_properties').select('id,address').ilike('address', `%${query.trim()}%`).limit(8)
      setResults(data || [])
      setOpen(true)
    }, 200)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    function onDocClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        style={inp}
        placeholder="Search property address…"
        value={value ? value.address : query}
        onChange={e => { onChange(null); setQuery(e.target.value) }}
        onFocus={() => results.length && setOpen(true)}
      />
      {open && results.length > 0 && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50, background: '#fff', border: '0.5px solid #D6D2CA', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', maxHeight: 200, overflowY: 'auto' }}>
          {results.map(p => (
            <div key={p.id} onMouseDown={() => { onChange(p); setQuery(''); setOpen(false) }} style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer', borderBottom: '0.5px solid #F0EDE6' }}>
              {p.address}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CheckoutModal({ item, onClose, onDone }) {
  const [property, setProperty] = useState(null)
  const [quantity, setQuantity] = useState('')
  const [unitCost, setUnitCost] = useState(item.unit_cost || 0)
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const qtyNum = parseFloat(quantity) || 0
  const overStock = qtyNum > item.quantity_on_hand

  async function resolveActiveRound(propertyId) {
    let { data } = await supabase.from('cashoffer_rehab_rounds').select('*').eq('property_id', propertyId).order('sort_order', { ascending: true })
    if (!data || data.length === 0) {
      const { data: created } = await supabase.from('cashoffer_rehab_rounds').insert({ property_id: propertyId, label: 'Round 1', sort_order: 0 }).select().single()
      data = created ? [created] : []
    }
    return data[data.length - 1]?.id || null
  }

  async function submit() {
    if (!property) { alert('Pick a property first.'); return }
    if (!qtyNum || qtyNum <= 0) { alert('Enter a quantity to check out.'); return }
    if (overStock) { alert(`Only ${item.quantity_on_hand} ${item.unit} on hand.`); return }
    setSaving(true)

    const roundId = await resolveActiveRound(property.id)
    if (!roundId) { setSaving(false); alert('Could not resolve a rehab round for that property.'); return }

    const { data: supply, error: supplyErr } = await supabase.from('cashoffer_supplies').insert({
      property_id: property.id, rehab_round_id: roundId,
      name: item.name, quantity: qtyNum, unit_cost: unitCost,
      vendor: "Eric's Warehouse", status: 'Received',
      paid_by: 'Eric', date_paid: date,
    }).select().single()
    if (supplyErr) { setSaving(false); alert('Could not create supply record: ' + supplyErr.message); return }

    await supabase.from('cashoffer_inventory_checkouts').insert({
      inventory_item_id: item.id, property_id: property.id, supply_id: supply.id,
      quantity: qtyNum, unit_cost_at_checkout: unitCost, checkout_date: date, notes: notes || null,
    })

    await supabase.from('cashoffer_inventory_items').update({ quantity_on_hand: item.quantity_on_hand - qtyNum }).eq('id', item.id)

    setSaving(false)
    onDone()
  }

  return (
    <Modal title={`Check Out — ${item.name}`} onClose={onClose} width={480}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 12, color: '#6b7280' }}>
          On hand: <strong style={{ color: '#2C2C2C' }}>{item.quantity_on_hand} {item.unit}</strong> @ {fmt(item.unit_cost)}/{item.unit}
        </div>
        <Field label="Property">
          <PropertySearch value={property} onChange={setProperty} />
        </Field>
        <FieldRow>
          <Field label={`Quantity (${item.unit})`}>
            <input style={{ ...monoInp, borderColor: overStock ? '#B91C1C' : '#D6D2CA' }} type="number" value={quantity} onChange={e => setQuantity(e.target.value)} />
          </Field>
          <Field label="Unit Cost ($)">
            <input style={monoInp} type="number" value={unitCost} onChange={e => setUnitCost(parseFloat(e.target.value) || 0)} />
          </Field>
        </FieldRow>
        {overStock && <div style={{ fontSize: 11, color: '#B91C1C' }}>Only {item.quantity_on_hand} {item.unit} available.</div>}
        <Field label="Date">
          <DatePicker value={date} onChange={e => setDate(e.target.value)} />
        </Field>
        <Field label="Notes (optional)">
          <input style={inp} value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. used for kitchen outlets" />
        </Field>
        <div style={{ fontSize: 11, color: '#9ca3af' }}>
          This creates a Supply line item on that property's Rehab tab (paid by Eric, accrues interest like any other Eric-fronted supply) and reduces warehouse stock.
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <Btn variant="outline" onClick={onClose}>Cancel</Btn>
          <Btn onClick={submit} disabled={saving}>{saving ? 'Checking Out…' : 'Check Out'}</Btn>
        </div>
      </div>
    </Modal>
  )
}

function ItemDetailModal({ item, onClose, onUpdated, onDeleted }) {
  const [form, setForm] = useState(item)
  const [checkouts, setCheckouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [checkoutOpen, setCheckoutOpen] = useState(false)

  useEffect(() => { load() }, [item.id])

  async function load() {
    setLoading(true)
    const { data: co } = await supabase
      .from('cashoffer_inventory_checkouts')
      .select('*, cashoffer_properties(address)')
      .eq('inventory_item_id', item.id)
      .order('checkout_date', { ascending: false })
    setCheckouts(co || [])
    setLoading(false)
  }

  async function saveField(field, value) {
    setForm(f => {
      const updated = { ...f, [field]: value }
      onUpdated(updated)
      return updated
    })
    await supabase.from('cashoffer_inventory_items').update({ [field]: value }).eq('id', item.id)
  }

  async function deleteItem() {
    if (!confirm(`Delete ${item.name} from inventory? This does not remove past checkouts already applied to properties.`)) return
    await supabase.from('cashoffer_inventory_items').delete().eq('id', item.id)
    onDeleted(item.id)
    onClose()
  }

  return (
    <>
      <Modal title={form.name || 'Inventory Item'} onClose={onClose} width={620}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <FieldRow>
            <Field label="Name">
              <input style={inp} value={form.name || ''} onChange={e => saveField('name', e.target.value)} />
            </Field>
            <Field label="Category">
              <select style={inp} value={form.category || 'Other'} onChange={e => saveField('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </FieldRow>
          <FieldRow>
            <Field label="Quantity on Hand">
              <input style={monoInp} type="number" value={form.quantity_on_hand ?? 0} onChange={e => saveField('quantity_on_hand', parseFloat(e.target.value) || 0)} />
            </Field>
            <Field label="Unit">
              <select style={inp} value={form.unit || 'qty'} onChange={e => saveField('unit', e.target.value)}>
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </Field>
            <Field label="Unit Cost ($)">
              <input style={monoInp} type="number" value={form.unit_cost ?? 0} onChange={e => saveField('unit_cost', parseFloat(e.target.value) || 0)} />
            </Field>
          </FieldRow>
          <Field label="Location / Bin">
            <input style={inp} value={form.location || ''} onChange={e => saveField('location', e.target.value)} placeholder="e.g. Shelf 3, Bay B" />
          </Field>
          <Field label="Notes">
            <input style={inp} value={form.notes || ''} onChange={e => saveField('notes', e.target.value)} />
          </Field>

          <div style={{ background: '#FAFAF8', border: '0.5px solid #D6D2CA', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>Total Value on Hand</div>
              <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace', color: '#2C2C2C' }}>{fmt((form.quantity_on_hand || 0) * (form.unit_cost || 0))}</div>
            </div>
            <Btn onClick={() => setCheckoutOpen(true)}>Check Out to Property</Btn>
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
              Checkout History ({checkouts.length})
            </div>
            {loading ? <LoadingSpinner /> : checkouts.length === 0 ? (
              <div style={{ fontSize: 12, color: '#9ca3af' }}>Nothing checked out yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {checkouts.map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FAFAF8', border: '0.5px solid #D6D2CA', borderRadius: 6, padding: '8px 12px', fontSize: 12 }}>
                    <div>
                      <span style={{ fontWeight: 600, color: '#2C2C2C' }}>{c.cashoffer_properties?.address || 'Unknown property'}</span>
                      <span style={{ color: '#9ca3af', marginLeft: 8 }}>{new Date(c.checkout_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{c.quantity} {form.unit} · {fmt(c.unit_cost_at_checkout * c.quantity)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid #F0EDE6', paddingTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button onClick={deleteItem} style={{ background: '#B91C1C', border: '1px solid #B91C1C', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', borderRadius: 6, padding: '6px 12px' }}>
              Delete Item
            </button>
            <Btn onClick={onClose}>Done</Btn>
          </div>
        </div>
      </Modal>

      {checkoutOpen && (
        <CheckoutModal
          item={form}
          onClose={() => setCheckoutOpen(false)}
          onDone={() => { setCheckoutOpen(false); load() }}
        />
      )}
    </>
  )
}

export default function Inventory() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('All')
  const [activeItem, setActiveItem] = useState(null)
  const [quickCheckoutItem, setQuickCheckoutItem] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('cashoffer_inventory_items').select('*').order('name', { ascending: true })
    setItems(data || [])
    setLoading(false)
  }

  async function addItem() {
    const { data } = await supabase.from('cashoffer_inventory_items').insert({ name: 'New Item', category: 'Other', unit: 'qty' }).select().single()
    setItems(i => [data, ...i])
    setActiveItem(data)
  }

  const cats = ['All', ...CATEGORIES]
  const filtered = category === 'All' ? items : items.filter(i => i.category === category)
  const totalValue = filtered.reduce((s, i) => s + (i.quantity_on_hand || 0) * (i.unit_cost || 0), 0)

  if (loading) return <PageWrap><LoadingSpinner /></PageWrap>

  return (
    <PageWrap>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#2C2C2C' }}>Inventory</div>
          <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>Eric's warehouse stock — check items out to a property to use them on a rehab</div>
        </div>
        <button onClick={addItem} style={{
          background: '#B8892A', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px',
          cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', whiteSpace: 'nowrap',
        }}>+ Add Item</button>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {cats.map(c => (
          <button key={c} onClick={() => setCategory(c)} style={{
            background: category === c ? '#2C2C2C' : '#F0EDE6',
            color: category === c ? '#fff' : '#6b7280',
            border: 'none', borderRadius: 20, padding: '5px 14px',
            cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
          }}>{c}</button>
        ))}
        <div style={{ marginLeft: 'auto', fontSize: 12, color: '#9ca3af' }}>
          Total value: <strong style={{ color: '#2C2C2C', fontFamily: 'monospace' }}>{fmt(totalValue)}</strong>
        </div>
      </div>

      <SectionBar>Items ({filtered.length})</SectionBar>
      {filtered.length === 0 ? (
        <EmptyState icon="○" text="No inventory items yet." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: (typeof window !== 'undefined' && window.innerWidth < 768) ? '1fr' : 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12, marginTop: 12 }}>
          {filtered.map(i => (
            <div
              key={i.id}
              onClick={() => setActiveItem(i)}
              style={{ background: '#fff', border: '0.5px solid #D6D2CA', borderRadius: 8, padding: '14px 16px', cursor: 'pointer', transition: 'border-color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#B8892A'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#D6D2CA'}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#2C2C2C' }}>{i.name || 'Unnamed Item'}</div>
                <Badge color={CAT_COLOR[i.category] || '#9ca3af'}>{i.category || 'Other'}</Badge>
              </div>
              <div style={{ fontSize: 13, fontFamily: 'monospace', color: (i.quantity_on_hand || 0) <= 0 ? '#B91C1C' : '#2C2C2C' }}>
                {i.quantity_on_hand ?? 0} {i.unit} on hand
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{fmt(i.unit_cost)} / {i.unit} · {i.location || 'No location set'}</div>
              <div style={{ marginTop: 10 }}>
                <button
                  onClick={e => { e.stopPropagation(); setQuickCheckoutItem(i) }}
                  disabled={!(i.quantity_on_hand > 0)}
                  style={{
                    width: '100%', background: 'none', border: '1px solid #2D6FAF', color: '#2D6FAF',
                    borderRadius: 6, padding: '6px 10px', fontSize: 11, fontWeight: 700, cursor: i.quantity_on_hand > 0 ? 'pointer' : 'not-allowed',
                    fontFamily: 'inherit', opacity: i.quantity_on_hand > 0 ? 1 : 0.4,
                  }}
                >
                  Check Out
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeItem && (
        <ItemDetailModal
          item={activeItem}
          onClose={() => setActiveItem(null)}
          onUpdated={updated => setItems(is => is.map(x => x.id === updated.id ? updated : x))}
          onDeleted={id => setItems(is => is.filter(x => x.id !== id))}
        />
      )}

      {quickCheckoutItem && (
        <CheckoutModal
          item={quickCheckoutItem}
          onClose={() => setQuickCheckoutItem(null)}
          onDone={() => { setQuickCheckoutItem(null); load() }}
        />
      )}
    </PageWrap>
  )
}
