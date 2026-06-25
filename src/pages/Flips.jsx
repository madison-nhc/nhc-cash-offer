import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { PageWrap, SectionBar, Card, Modal, Field, FieldRow, inp, monoInp, Btn, Badge, EmptyState, LoadingSpinner, StatCard, fmt, fmtK } from '../components/ui.jsx'

const STATUS_COLORS = { active: '#D97825', listed: '#2D6FAF', sold: '#3B6D11' }
const EMPTY = { address: '', property_type: 'flip', purchase_date: '', purchase_price: '', closing_costs: '', rehab_cost: '', arv: '', sale_price: '', sale_date: '', days_on_market: '', status: 'active', notes: '' }

export default function Flips() {
  const [props, setProps] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('investment_properties').select('*').eq('property_type', 'flip').order('created_at', { ascending: false })
    setProps(data || [])
    setLoading(false)
  }

  const filtered = filter === 'all' ? props : props.filter(p => p.status === filter)
  const completed = props.filter(p => p.status === 'sold')
  const totalProfit = completed.reduce((s, p) => s + calcProfit(p), 0)
  const avgProfit = completed.length > 0 ? totalProfit / completed.length : 0
  const avgDOM = completed.filter(p => p.days_on_market).reduce((s, p, _, a) => s + p.days_on_market / a.length, 0)

  if (loading) return <LoadingSpinner />

  return (
    <PageWrap>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#2C2C2C' }}>Flips</h1>
          <p style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Properties bought, rehabbed, and sold</p>
        </div>
        <Btn onClick={() => setModal(EMPTY)}>+ Add Property</Btn>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <StatCard label="Active Flips" value={props.filter(p => p.status === 'active').length} topColor="#D97825" />
        <StatCard label="Completed Flips" value={completed.length} topColor="#3B6D11" />
        <StatCard label="Total Profit" value={fmtK(totalProfit)} sub="all completed" topColor={totalProfit >= 0 ? '#3B6D11' : '#B91C1C'} />
        <StatCard label="Avg Profit / Deal" value={fmtK(avgProfit)} sub={avgDOM ? `avg ${Math.round(avgDOM)} DOM` : ''} topColor="#B8892A" />
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {['all', 'active', 'listed', 'sold'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '5px 14px', border: 'none', borderRadius: 4, cursor: 'pointer',
            background: filter === f ? '#2C2C2C' : '#F0EDE6', color: filter === f ? '#fff' : '#6b7280',
            fontSize: 12, fontWeight: filter === f ? 700 : 400, fontFamily: 'inherit', textTransform: 'capitalize'
          }}>{f} {f === 'all' ? `(${props.length})` : `(${props.filter(p => p.status === f).length})`}</button>
        ))}
      </div>

      <SectionBar>Properties ({filtered.length})</SectionBar>

      {filtered.length === 0 ? <EmptyState icon="⟳" text="No flip properties yet. Add your first property." /> : (
        <Card style={{ padding: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F0EDE6' }}>
                {['Address', 'Status', 'Purchase', 'Rehab', 'ARV', 'Sale Price', 'Profit / Loss', 'DOM', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, letterSpacing: 0.8, color: '#6b7280', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => {
                const profit = calcProfit(p)
                const showProfit = p.status === 'sold'
                const totalCost = (parseFloat(p.purchase_price) || 0) + (parseFloat(p.closing_costs) || 0) + (parseFloat(p.rehab_cost) || 0)
                return (
                  <tr key={p.id} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAF8', borderTop: '0.5px solid #F0EDE6' }}>
                    <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600 }}>{p.address}</td>
                    <td style={{ padding: '10px 14px' }}><Badge color={STATUS_COLORS[p.status]}>{p.status}</Badge></td>
                    <td style={{ padding: '10px 14px', fontSize: 13, fontFamily: 'monospace' }}>{fmt(totalCost)}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, fontFamily: 'monospace' }}>{fmt(p.rehab_cost)}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, fontFamily: 'monospace' }}>{fmt(p.arv)}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, fontFamily: 'monospace' }}>{fmt(p.sale_price)}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, fontFamily: 'monospace', fontWeight: 700, color: showProfit ? (profit >= 0 ? '#3B6D11' : '#B91C1C') : '#9ca3af' }}>
                      {showProfit ? `${profit >= 0 ? '+' : ''}${fmt(profit)}` : '—'}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 13, color: '#6b7280' }}>{p.days_on_market || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <button onClick={() => setModal(p)} style={{ background: 'none', border: 'none', color: '#B8892A', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>Edit</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}

      {modal && <FlipModal property={modal} onClose={() => setModal(null)} onSave={() => { setModal(null); load() }} />}
    </PageWrap>
  )
}

function calcProfit(p) {
  const sp = parseFloat(p.sale_price) || 0
  const pp = parseFloat(p.purchase_price) || 0
  const cc = parseFloat(p.closing_costs) || 0
  const rc = parseFloat(p.rehab_cost) || 0
  return sp - pp - cc - rc
}

function FlipModal({ property, onClose, onSave }) {
  const [form, setForm] = useState({ ...property })
  const isNew = !form.id

  const totalCost = (parseFloat(form.purchase_price) || 0) + (parseFloat(form.closing_costs) || 0) + (parseFloat(form.rehab_cost) || 0)
  const profit = form.status === 'sold' ? (parseFloat(form.sale_price) || 0) - totalCost : null
  const roi = totalCost > 0 && profit !== null ? ((profit / totalCost) * 100).toFixed(1) : null

  async function save() {
    const payload = { property_type: 'flip', address: form.address, purchase_date: form.purchase_date || null, purchase_price: form.purchase_price || null, closing_costs: form.closing_costs || null, rehab_cost: form.rehab_cost || null, arv: form.arv || null, sale_price: form.sale_price || null, sale_date: form.sale_date || null, days_on_market: form.days_on_market || null, status: form.status, notes: form.notes || null, entity: 'NHC' }
    if (isNew) await supabase.from('investment_properties').insert(payload)
    else await supabase.from('investment_properties').update(payload).eq('id', form.id)
    onSave()
  }

  async function del() {
    if (!confirm('Delete this property?')) return
    await supabase.from('investment_properties').delete().eq('id', form.id)
    onSave()
  }

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <Modal title={isNew ? 'Add Flip Property' : 'Edit Flip Property'} onClose={onClose} width={600}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Property Address *"><input style={inp} value={form.address || ''} onChange={set('address')} placeholder="123 Main St, Lexington KY" /></Field>
        <Field label="Status">
          <select style={inp} value={form.status} onChange={set('status')}>
            <option value="active">Active (Under Rehab)</option>
            <option value="listed">Listed</option>
            <option value="sold">Sold / Completed</option>
          </select>
        </Field>

        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: '#B8892A', textTransform: 'uppercase', borderBottom: '1px solid #F0EDE6', paddingBottom: 6 }}>Acquisition</div>
        <FieldRow>
          <Field label="Purchase Date"><input style={inp} type="date" value={form.purchase_date || ''} onChange={set('purchase_date')} /></Field>
          <Field label="Purchase Price ($)"><input style={monoInp} type="number" value={form.purchase_price || ''} onChange={set('purchase_price')} placeholder="120000" /></Field>
        </FieldRow>
        <Field label="Closing Costs ($)"><input style={monoInp} type="number" value={form.closing_costs || ''} onChange={set('closing_costs')} placeholder="2500" /></Field>

        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: '#B8892A', textTransform: 'uppercase', borderBottom: '1px solid #F0EDE6', paddingBottom: 6 }}>Rehab & Valuation</div>
        <FieldRow>
          <Field label="Rehab Cost ($)"><input style={monoInp} type="number" value={form.rehab_cost || ''} onChange={set('rehab_cost')} placeholder="45000" /></Field>
          <Field label="ARV ($)"><input style={monoInp} type="number" value={form.arv || ''} onChange={set('arv')} placeholder="220000" /></Field>
        </FieldRow>

        {(form.status === 'listed' || form.status === 'sold') && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: '#3B6D11', textTransform: 'uppercase', borderBottom: '1px solid #F0EDE6', paddingBottom: 6 }}>Sale</div>
            <FieldRow>
              <Field label="Sale Price ($)"><input style={monoInp} type="number" value={form.sale_price || ''} onChange={set('sale_price')} placeholder="215000" /></Field>
              <Field label="Sale Date"><input style={inp} type="date" value={form.sale_date || ''} onChange={set('sale_date')} /></Field>
            </FieldRow>
            <Field label="Days on Market"><input style={monoInp} type="number" value={form.days_on_market || ''} onChange={set('days_on_market')} placeholder="24" /></Field>
          </>
        )}

        {profit !== null && (
          <div style={{ background: profit >= 0 ? '#f0fdf4' : '#fef2f2', borderRadius: 8, padding: 14, display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8 }}>Calculated Profit</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: profit >= 0 ? '#3B6D11' : '#B91C1C', marginTop: 2 }}>
                {profit >= 0 ? '+' : ''}{fmt(profit)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8 }}>ROI</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: profit >= 0 ? '#3B6D11' : '#B91C1C', marginTop: 2 }}>{roi}%</div>
            </div>
          </div>
        )}

        <Field label="Notes"><textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={form.notes || ''} onChange={set('notes')} /></Field>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          {!isNew && <Btn variant="danger" onClick={del}>Delete</Btn>}
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <Btn variant="outline" onClick={onClose}>Cancel</Btn>
            <Btn onClick={save}>Save Property</Btn>
          </div>
        </div>
      </div>
    </Modal>
  )
}
