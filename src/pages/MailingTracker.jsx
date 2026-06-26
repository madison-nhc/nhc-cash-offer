import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { PageWrap, SectionBar, Card, Modal, Field, FieldRow, inp, monoInp, Btn, Badge, EmptyState, LoadingSpinner, StatCard, fmt, fmtK } from '../components/ui.jsx'

const STATUSES = ['active_listing', 'pending', 'closed']
const STATUS_LABELS = { active_listing: 'Active', pending: 'Pending', closed: 'Closed' }
const STATUS_COLORS = { active_listing: '#2D6FAF', pending: '#D97825', closed: '#3B6D11' }

const EMPTY_MAILING = { campaign_name: '', drop_date: '', list_size: '', piece_type: 'Postcard', mailer_cost: '', notes: '', entity: 'NHC' }
const EMPTY_DEAL = { address: '', deal_type: 'listing', status: 'active_listing', sale_price: '', commission_pct: '', commission_earned: '', is_flip: false, purchase_price: '', rehab_cost: '', flip_profit: '', notes: '', mailing_id: '', entity: 'NHC' }

export default function MailingTracker() {
  const [mailings, setMailings] = useState([])
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('campaigns')
  const [mailingModal, setMailingModal] = useState(null)
  const [dealModal, setDealModal] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: m }, { data: d }] = await Promise.all([
      supabase.from('mailings').select('*').order('drop_date', { ascending: false }),
      supabase.from('mailing_deals').select('*').order('created_at', { ascending: false }),
    ])
    setMailings(m || [])
    setDeals(d || [])
    setLoading(false)
  }

  const totalSent = mailings.reduce((s, m) => s + (m.list_size || 0), 0)
  const totalSpend = mailings.reduce((s, m) => s + (parseFloat(m.mailer_cost) || 0), 0)
  const closedDeals = deals.filter(d => d.status === 'closed')
  const totalComm = closedDeals.reduce((s, d) => s + (parseFloat(d.commission_earned) || 0), 0)
  const roi = totalSpend > 0 ? (((totalComm - totalSpend) / totalSpend) * 100).toFixed(0) : null
  const costPerDeal = closedDeals.length > 0 && totalSpend > 0 ? totalSpend / closedDeals.length : null

  if (loading) return <LoadingSpinner />

  return (
    <PageWrap>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#2C2C2C' }}>Mailing Tracker</h1>
          <p style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Vyral mail campaigns and deal pipeline</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="outline" onClick={() => setMailingModal(EMPTY_MAILING)}>+ Campaign</Btn>
          <Btn onClick={() => setDealModal(EMPTY_DEAL)}>+ Deal</Btn>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
        <StatCard label="Total Mailers" value={totalSent.toLocaleString()} topColor="#B8892A" />
        <StatCard label="Total Spend" value={fmtK(totalSpend)} topColor="#D97825" />
        <StatCard label="Deals Sourced" value={deals.length} topColor="#B8892A" />
        <StatCard label="Commission Earned" value={fmtK(totalComm)} topColor="#3B6D11" />
        <StatCard label="Mailing ROI" value={roi ? `${roi}%` : '—'} sub={costPerDeal ? `${fmt(costPerDeal)} / closed deal` : ''} topColor={roi >= 0 ? '#3B6D11' : '#B91C1C'} />
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 16 }}>
        {['campaigns', 'deals'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '6px 16px', border: 'none', borderRadius: 4, cursor: 'pointer',
            background: tab === t ? '#2C2C2C' : '#F0EDE6', color: tab === t ? '#fff' : '#6b7280',
            fontSize: 12, fontWeight: tab === t ? 700 : 400, fontFamily: 'inherit', textTransform: 'capitalize'
          }}>{t}</button>
        ))}
      </div>

      {tab === 'campaigns' && (
        <>
          <SectionBar>Mailing Campaigns ({mailings.length})</SectionBar>
          {mailings.length === 0 ? <EmptyState icon="✉" text="No mailing campaigns yet. Add your first campaign." /> : (
            <Card style={{ padding: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F0EDE6' }}>
                    {['Campaign', 'Drop Date', 'List Size', 'Piece Type', 'Mailer Cost', 'Cost / Piece', 'Deals Sourced', ''].map(h => (
                      <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, letterSpacing: 0.8, color: '#6b7280', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mailings.map((m, i) => {
                    const sourcedDeals = deals.filter(d => d.mailing_id === m.id).length
                    const costPerPiece = m.mailer_cost && m.list_size ? (parseFloat(m.mailer_cost) / m.list_size).toFixed(2) : null
                    return (
                      <tr key={m.id} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAF8', borderTop: '0.5px solid #F0EDE6' }}>
                        <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600 }}>{m.campaign_name || '—'}</td>
                        <td style={{ padding: '10px 16px', fontSize: 13 }}>{m.drop_date ? new Date(m.drop_date + 'T12:00:00').toLocaleDateString() : '—'}</td>
                        <td style={{ padding: '10px 16px', fontSize: 13, fontFamily: 'monospace' }}>{m.list_size?.toLocaleString() || '—'}</td>
                        <td style={{ padding: '10px 16px', fontSize: 13 }}>{m.piece_type || '—'}</td>
                        <td style={{ padding: '10px 16px', fontSize: 13, fontFamily: 'monospace', fontWeight: 600 }}>{m.mailer_cost ? fmt(m.mailer_cost) : '—'}</td>
                        <td style={{ padding: '10px 16px', fontSize: 13, fontFamily: 'monospace', color: '#6b7280' }}>{costPerPiece ? `$${costPerPiece}` : '—'}</td>
                        <td style={{ padding: '10px 16px', fontSize: 13 }}>{sourcedDeals}</td>
                        <td style={{ padding: '10px 16px' }}>
                          <button onClick={() => setMailingModal(m)} style={{ background: 'none', border: 'none', color: '#B8892A', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>Edit</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                {mailings.length > 1 && (
                  <tfoot>
                    <tr style={{ borderTop: '2px solid #D6D2CA', background: '#F0EDE6' }}>
                      <td style={{ padding: '8px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>Totals</td>
                      <td /><td style={{ padding: '8px 16px', fontSize: 13, fontFamily: 'monospace', fontWeight: 700 }}>{totalSent.toLocaleString()}</td>
                      <td />
                      <td style={{ padding: '8px 16px', fontSize: 13, fontFamily: 'monospace', fontWeight: 700 }}>{fmtK(totalSpend)}</td>
                      <td /><td /><td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </Card>
          )}
        </>
      )}

      {tab === 'deals' && (
        <>
          <SectionBar>Deals Sourced ({deals.length})</SectionBar>
          {deals.length === 0 ? <EmptyState icon="○" text="No deals yet." /> : (
            <Card style={{ padding: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F0EDE6' }}>
                    {['Address', 'Type', 'Status', 'Sale Price', 'Commission', 'Source', ''].map(h => (
                      <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, letterSpacing: 0.8, color: '#6b7280', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {deals.map((d, i) => {
                    const srcMailing = mailings.find(m => m.id === d.mailing_id)
                    return (
                      <tr key={d.id} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAF8', borderTop: '0.5px solid #F0EDE6' }}>
                        <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600 }}>{d.address}</td>
                        <td style={{ padding: '10px 16px' }}><Badge color={d.deal_type === 'listing' ? '#3B6D11' : '#D97825'}>{d.deal_type}</Badge></td>
                        <td style={{ padding: '10px 16px' }}><Badge color={STATUS_COLORS[d.status]}>{STATUS_LABELS[d.status]}</Badge></td>
                        <td style={{ padding: '10px 16px', fontSize: 13, fontFamily: 'monospace' }}>{fmt(d.sale_price)}</td>
                        <td style={{ padding: '10px 16px', fontSize: 13, fontFamily: 'monospace' }}>{fmt(d.commission_earned)}</td>
                        <td style={{ padding: '10px 16px', fontSize: 12, color: '#6b7280' }}>{srcMailing?.campaign_name || '—'}</td>
                        <td style={{ padding: '10px 16px' }}>
                          <button onClick={() => setDealModal(d)} style={{ background: 'none', border: 'none', color: '#B8892A', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>Edit</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}

      {mailingModal && <MailingForm mailing={mailingModal} onClose={() => setMailingModal(null)} onSave={() => { setMailingModal(null); load() }} />}
      {dealModal && <DealForm deal={dealModal} mailings={mailings} onClose={() => setDealModal(null)} onSave={() => { setDealModal(null); load() }} />}
    </PageWrap>
  )
}

function MailingForm({ mailing, onClose, onSave }) {
  const [form, setForm] = useState({ ...mailing })
  const isNew = !form.id

  async function save() {
    const payload = { campaign_name: form.campaign_name, drop_date: form.drop_date || null, list_size: parseInt(form.list_size) || null, piece_type: form.piece_type, mailer_cost: form.mailer_cost || null, notes: form.notes, entity: form.entity || 'NHC' }
    if (isNew) await supabase.from('mailings').insert(payload)
    else await supabase.from('mailings').update(payload).eq('id', form.id)
    onSave()
  }

  async function del() {
    if (!confirm('Delete this campaign?')) return
    await supabase.from('mailings').delete().eq('id', form.id)
    onSave()
  }

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  const costPerPiece = form.mailer_cost && form.list_size ? (parseFloat(form.mailer_cost) / parseInt(form.list_size)).toFixed(2) : null

  return (
    <Modal title={isNew ? 'New Campaign' : 'Edit Campaign'} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Campaign Name"><input style={inp} value={form.campaign_name} onChange={set('campaign_name')} placeholder="Q1 Absentee Owners" /></Field>
        <FieldRow>
          <Field label="Drop Date"><input style={inp} type="date" value={form.drop_date || ''} onChange={set('drop_date')} /></Field>
          <Field label="List Size"><input style={monoInp} type="number" value={form.list_size || ''} onChange={set('list_size')} placeholder="2500" /></Field>
        </FieldRow>
        <FieldRow>
          <Field label="Piece Type">
            <select style={inp} value={form.piece_type} onChange={set('piece_type')}>
              {['Postcard', 'Letter', 'Yellow Letter', 'Handwritten', 'Email', 'Other'].map(t => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Total Mailer Cost ($)"><input style={monoInp} type="number" value={form.mailer_cost || ''} onChange={set('mailer_cost')} placeholder="1250" /></Field>
        </FieldRow>
        {costPerPiece && (
          <div style={{ background: '#f0f6ff', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#2D6FAF', fontWeight: 600 }}>
            ${costPerPiece} per piece
          </div>
        )}
        <Field label="Notes"><textarea style={{ ...inp, minHeight: 72, resize: 'vertical' }} value={form.notes || ''} onChange={set('notes')} /></Field>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          {!isNew && <Btn variant="danger" onClick={del}>Delete</Btn>}
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <Btn variant="outline" onClick={onClose}>Cancel</Btn>
            <Btn onClick={save}>Save Campaign</Btn>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function DealForm({ deal, mailings, onClose, onSave }) {
  const [form, setForm] = useState({ ...deal })
  const isNew = !form.id

  function handlePriceChange(val) {
    setForm(f => ({ ...f, sale_price: val, commission_earned: f.commission_pct && val ? (parseFloat(val) * parseFloat(f.commission_pct) / 100).toFixed(2) : f.commission_earned }))
  }
  function handlePctChange(val) {
    setForm(f => ({ ...f, commission_pct: val, commission_earned: f.sale_price && val ? (parseFloat(f.sale_price) * parseFloat(val) / 100).toFixed(2) : f.commission_earned }))
  }

  async function save() {
    if (!form.address) return
    const payload = { address: form.address, deal_type: form.deal_type, status: form.status, sale_price: form.sale_price || null, commission_pct: form.commission_pct || null, commission_earned: form.commission_earned || null, is_flip: form.is_flip, purchase_price: form.purchase_price || null, rehab_cost: form.rehab_cost || null, flip_profit: form.flip_profit || null, notes: form.notes, mailing_id: form.mailing_id || null, entity: 'NHC' }
    if (isNew) await supabase.from('mailing_deals').insert(payload)
    else await supabase.from('mailing_deals').update(payload).eq('id', form.id)
    onSave()
  }

  async function del() {
    if (!confirm('Delete this deal?')) return
    await supabase.from('mailing_deals').delete().eq('id', form.id)
    onSave()
  }

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  const tabBtn = (active, color) => ({ flex: 1, padding: '7px', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 12, fontFamily: 'inherit', background: active ? (color || '#2C2C2C') : '#F0EDE6', color: active ? '#fff' : '#6b7280' })

  return (
    <Modal title={isNew ? 'New Deal' : 'Edit Deal'} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Property Address *"><input style={inp} value={form.address} onChange={set('address')} placeholder="123 Main St, Lexington KY" /></Field>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Transaction Type</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={tabBtn(form.deal_type === 'listing', '#3B6D11')} onClick={() => setForm(f => ({ ...f, deal_type: 'listing' }))}>Listing</button>
            <button style={tabBtn(form.deal_type === 'cash_purchase', '#D97825')} onClick={() => setForm(f => ({ ...f, deal_type: 'cash_purchase' }))}>Purchase</button>
          </div>
        </div>
        <Field label="Status">
          <select style={inp} value={form.status} onChange={set('status')}>
            {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </Field>
        <FieldRow>
          <Field label="Sale Price ($)"><input style={monoInp} type="number" value={form.sale_price || ''} onChange={e => handlePriceChange(e.target.value)} placeholder="285000" /></Field>
          <Field label="Commission %"><input style={monoInp} type="number" value={form.commission_pct || ''} onChange={e => handlePctChange(e.target.value)} placeholder="3" /></Field>
        </FieldRow>
        <Field label="Commission Earned ($)"><input style={monoInp} type="number" value={form.commission_earned || ''} onChange={set('commission_earned')} placeholder="Auto-calculated" /></Field>
        <Field label="Mailing Source">
          <select style={inp} value={form.mailing_id || ''} onChange={set('mailing_id')}>
            <option value="">No specific campaign</option>
            {mailings.map(m => <option key={m.id} value={m.id}>{m.campaign_name} {m.drop_date ? `(${m.drop_date})` : ''}</option>)}
          </select>
        </Field>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', padding: 10, background: '#f0f6ff', borderRadius: 6 }}>
          <input type="checkbox" checked={form.is_flip} onChange={e => setForm(f => ({ ...f, is_flip: e.target.checked }))} />
          <strong>BPV Flip Property</strong>
        </label>
        {form.is_flip && (
          <div style={{ background: '#f0f6ff', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <FieldRow>
              <Field label="Purchase Cost ($)"><input style={monoInp} type="number" value={form.purchase_price || ''} onChange={set('purchase_price')} /></Field>
              <Field label="Rehab Cost ($)"><input style={monoInp} type="number" value={form.rehab_cost || ''} onChange={set('rehab_cost')} /></Field>
            </FieldRow>
            <Field label="Flip Profit ($)"><input style={monoInp} type="number" value={form.flip_profit || ''} onChange={set('flip_profit')} /></Field>
          </div>
        )}
        <Field label="Notes"><textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={form.notes || ''} onChange={set('notes')} /></Field>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          {!isNew && <Btn variant="danger" onClick={del}>Delete</Btn>}
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <Btn variant="outline" onClick={onClose}>Cancel</Btn>
            <Btn onClick={save}>Save Deal</Btn>
          </div>
        </div>
      </div>
    </Modal>
  )
}
