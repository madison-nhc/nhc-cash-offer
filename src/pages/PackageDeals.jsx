import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { PageWrap, SectionBar, Card, Modal, Field, FieldRow, inp, monoInp, Btn, Badge, EmptyState, LoadingSpinner, StatCard, fmt, fmtK } from '../components/ui.jsx'

const STATUS_COLORS = { analyzing: '#B8892A', active: '#2D6FAF', closed: '#3B6D11', passed: '#6b7280' }
const EMPTY_PKG = { deal_name: '', status: 'analyzing', total_arv: '', total_purchase: '', total_rehab: '', notes: '' }
const EMPTY_PROP = { address: '', arv: '', purchase_price: '', rehab_cost: '', property_type: 'flip', notes: '' }

export default function PackageDeals() {
  const [packages, setPackages] = useState([])
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [pkgModal, setPkgModal] = useState(null)
  const [propModal, setPropModal] = useState(null) // { pkg }
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: p }, { data: pr }] = await Promise.all([
      supabase.from('package_deals').select('*').order('created_at', { ascending: false }),
      supabase.from('package_deal_properties').select('*'),
    ])
    setPackages(p || [])
    setProperties(pr || [])
    setLoading(false)
  }

  const active = packages.filter(p => p.status === 'analyzing' || p.status === 'active')

  if (loading) return <LoadingSpinner />

  return (
    <PageWrap>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#2C2C2C' }}>Package Deals</h1>
          <p style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Multi-property bundle analysis and storage</p>
        </div>
        <Btn onClick={() => setPkgModal(EMPTY_PKG)}>+ New Package</Btn>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        <StatCard label="Total Packages" value={packages.length} topColor="#6b21a8" />
        <StatCard label="Active / Analyzing" value={active.length} topColor="#B8892A" />
        <StatCard label="Total ARV Tracked" value={fmtK(packages.reduce((s, p) => s + (parseFloat(p.total_arv) || 0), 0))} topColor="#3B6D11" />
      </div>

      <SectionBar>All Packages ({packages.length})</SectionBar>

      {packages.length === 0 ? <EmptyState icon="⊕" text="No package deals yet. Create your first multi-property bundle." /> : (
        packages.map(pkg => {
          const pkgProps = properties.filter(pr => pr.package_id === pkg.id)
          const calcARV = pkgProps.reduce((s, pr) => s + (parseFloat(pr.arv) || 0), 0)
          const calcPurchase = pkgProps.reduce((s, pr) => s + (parseFloat(pr.purchase_price) || 0), 0)
          const calcRehab = pkgProps.reduce((s, pr) => s + (parseFloat(pr.rehab_cost) || 0), 0)
          const arv = parseFloat(pkg.total_arv) || calcARV
          const purchase = parseFloat(pkg.total_purchase) || calcPurchase
          const rehab = parseFloat(pkg.total_rehab) || calcRehab
          const estimatedProfit = arv - purchase - rehab
          const isExpanded = expandedId === pkg.id

          return (
            <Card key={pkg.id} style={{ marginTop: 10, padding: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer', background: isExpanded ? '#FAFAF8' : '#fff' }}
                onClick={() => setExpandedId(isExpanded ? null : pkg.id)}>
                <span style={{ fontSize: 18, color: '#9ca3af' }}>{isExpanded ? '▾' : '▸'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#2C2C2C' }}>{pkg.deal_name}</div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3 }}>
                    {pkgProps.length} propert{pkgProps.length === 1 ? 'y' : 'ies'} · Created {new Date(pkg.created_at).toLocaleDateString()}
                  </div>
                </div>
                <Badge color={STATUS_COLORS[pkg.status]}>{pkg.status}</Badge>
                <div style={{ textAlign: 'right', marginLeft: 12 }}>
                  <div style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 700 }}>{fmtK(arv)}</div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>total ARV</div>
                </div>
                <div style={{ textAlign: 'right', marginLeft: 16 }}>
                  <div style={{ fontSize: 14, fontFamily: 'monospace', fontWeight: 700, color: estimatedProfit >= 0 ? '#3B6D11' : '#B91C1C' }}>
                    {estimatedProfit >= 0 ? '+' : ''}{fmtK(estimatedProfit)}
                  </div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>est. profit</div>
                </div>
                <button onClick={e => { e.stopPropagation(); setPkgModal(pkg) }} style={{ background: 'none', border: 'none', color: '#B8892A', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', marginLeft: 8 }}>Edit</button>
              </div>

              {isExpanded && (
                <div style={{ borderTop: '1px solid #F0EDE6' }}>
                  {/* Package financials */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, background: '#FAFAF8', borderBottom: '1px solid #F0EDE6' }}>
                    {[['Total ARV', fmtK(arv), '#B8892A'], ['Total Purchase', fmtK(purchase), '#D97825'], ['Total Rehab', fmtK(rehab), '#2D6FAF'], ['Est. Profit', (estimatedProfit >= 0 ? '+' : '') + fmtK(estimatedProfit), estimatedProfit >= 0 ? '#3B6D11' : '#B91C1C']].map(([l, v, c]) => (
                      <div key={l} style={{ padding: '10px 16px', borderRight: '1px solid #F0EDE6' }}>
                        <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8 }}>{l}</div>
                        <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace', color: c, marginTop: 2 }}>{v}</div>
                      </div>
                    ))}
                  </div>

                  {/* Properties in package */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', background: '#F0EDE6' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: '#6b7280', textTransform: 'uppercase' }}>Properties ({pkgProps.length})</span>
                    <button onClick={() => setPropModal({ pkg })} style={{ background: '#B8892A', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 12px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>+ Add Property</button>
                  </div>
                  {pkgProps.length === 0 ? (
                    <div style={{ padding: 16, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>No properties added yet. Add individual addresses to build the analysis.</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          {['Address', 'Type', 'ARV', 'Purchase', 'Rehab', 'Margin'].map(h => (
                            <th key={h} style={{ padding: '7px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pkgProps.map((pr, j) => {
                          const margin = (parseFloat(pr.arv) || 0) - (parseFloat(pr.purchase_price) || 0) - (parseFloat(pr.rehab_cost) || 0)
                          return (
                            <tr key={pr.id} style={{ background: j % 2 === 0 ? '#fff' : '#FAFAF8', borderTop: '0.5px solid #F0EDE6' }}>
                              <td style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600 }}>{pr.address}</td>
                              <td style={{ padding: '8px 16px', fontSize: 12 }}><Badge color={pr.property_type === 'flip' ? '#D97825' : '#2D6FAF'}>{pr.property_type}</Badge></td>
                              <td style={{ padding: '8px 16px', fontSize: 13, fontFamily: 'monospace' }}>{fmt(pr.arv)}</td>
                              <td style={{ padding: '8px 16px', fontSize: 13, fontFamily: 'monospace' }}>{fmt(pr.purchase_price)}</td>
                              <td style={{ padding: '8px 16px', fontSize: 13, fontFamily: 'monospace' }}>{fmt(pr.rehab_cost)}</td>
                              <td style={{ padding: '8px 16px', fontSize: 13, fontFamily: 'monospace', fontWeight: 700, color: margin >= 0 ? '#3B6D11' : '#B91C1C' }}>{margin >= 0 ? '+' : ''}{fmt(margin)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}

                  {pkg.notes && (
                    <div style={{ padding: '10px 16px', borderTop: '1px solid #F0EDE6', fontSize: 12, color: '#6b7280', background: '#FAFAF8' }}>
                      <strong>Notes:</strong> {pkg.notes}
                    </div>
                  )}
                </div>
              )}
            </Card>
          )
        })
      )}

      {pkgModal && <PackageModal pkg={pkgModal} onClose={() => setPkgModal(null)} onSave={() => { setPkgModal(null); load() }} />}
      {propModal && <PropModal pkg={propModal.pkg} onClose={() => setPropModal(null)} onSave={() => { setPropModal(null); load() }} />}
    </PageWrap>
  )
}

function PackageModal({ pkg, onClose, onSave }) {
  const [form, setForm] = useState({ ...pkg })
  const isNew = !form.id

  async function save() {
    const payload = { deal_name: form.deal_name, status: form.status, total_arv: form.total_arv || null, total_purchase: form.total_purchase || null, total_rehab: form.total_rehab || null, notes: form.notes || null, entity: 'NHC' }
    if (isNew) await supabase.from('package_deals').insert(payload)
    else await supabase.from('package_deals').update(payload).eq('id', form.id)
    onSave()
  }

  async function del() {
    if (!confirm('Delete this package deal and all its properties?')) return
    await supabase.from('package_deals').delete().eq('id', form.id)
    onSave()
  }

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <Modal title={isNew ? 'New Package Deal' : 'Edit Package'} onClose={onClose} width={520}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Package Name *"><input style={inp} value={form.deal_name || ''} onChange={set('deal_name')} placeholder="East Side Portfolio — 4 Properties" /></Field>
        <Field label="Status">
          <select style={inp} value={form.status} onChange={set('status')}>
            <option value="analyzing">Analyzing</option>
            <option value="active">Active / Under Contract</option>
            <option value="closed">Closed</option>
            <option value="passed">Passed</option>
          </select>
        </Field>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: '#B8892A', textTransform: 'uppercase' }}>Override Totals (optional — auto-calculated from properties)</div>
        <FieldRow>
          <Field label="Total ARV ($)"><input style={monoInp} type="number" value={form.total_arv || ''} onChange={set('total_arv')} placeholder="Auto" /></Field>
          <Field label="Total Purchase ($)"><input style={monoInp} type="number" value={form.total_purchase || ''} onChange={set('total_purchase')} placeholder="Auto" /></Field>
        </FieldRow>
        <Field label="Total Rehab ($)"><input style={monoInp} type="number" value={form.total_rehab || ''} onChange={set('total_rehab')} placeholder="Auto" /></Field>
        <Field label="Notes"><textarea style={{ ...inp, minHeight: 72, resize: 'vertical' }} value={form.notes || ''} onChange={set('notes')} placeholder="Seller situation, deal terms, strategy..." /></Field>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          {!isNew && <Btn variant="danger" onClick={del}>Delete</Btn>}
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <Btn variant="outline" onClick={onClose}>Cancel</Btn>
            <Btn onClick={save} disabled={!form.deal_name}>Save Package</Btn>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function PropModal({ pkg, onClose, onSave }) {
  const [form, setForm] = useState({ ...EMPTY_PROP })

  async function save() {
    if (!form.address) return
    const payload = { package_id: pkg.id, address: form.address, arv: form.arv || null, purchase_price: form.purchase_price || null, rehab_cost: form.rehab_cost || null, property_type: form.property_type, notes: form.notes || null }
    await supabase.from('package_deal_properties').insert(payload)
    onSave()
  }

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  const margin = (parseFloat(form.arv) || 0) - (parseFloat(form.purchase_price) || 0) - (parseFloat(form.rehab_cost) || 0)

  return (
    <Modal title={`Add Property — ${pkg.deal_name}`} onClose={onClose} width={500}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Address *"><input style={inp} value={form.address} onChange={set('address')} placeholder="789 Elm St, Lexington KY" /></Field>
        <Field label="Property Type">
          <select style={inp} value={form.property_type} onChange={set('property_type')}>
            <option value="flip">Flip</option>
            <option value="hold">Hold</option>
          </select>
        </Field>
        <FieldRow>
          <Field label="ARV ($)"><input style={monoInp} type="number" value={form.arv} onChange={set('arv')} placeholder="195000" /></Field>
          <Field label="Purchase Price ($)"><input style={monoInp} type="number" value={form.purchase_price} onChange={set('purchase_price')} placeholder="110000" /></Field>
        </FieldRow>
        <Field label="Rehab Cost ($)"><input style={monoInp} type="number" value={form.rehab_cost} onChange={set('rehab_cost')} placeholder="35000" /></Field>
        {(form.arv || form.purchase_price) && (
          <div style={{ background: margin >= 0 ? '#f0fdf4' : '#fef2f2', borderRadius: 6, padding: 10, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: '#6b7280' }}>Estimated Margin</span>
            <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'monospace', color: margin >= 0 ? '#3B6D11' : '#B91C1C' }}>{margin >= 0 ? '+' : ''}{fmt(margin)}</span>
          </div>
        )}
        <Field label="Notes"><input style={inp} value={form.notes} onChange={set('notes')} placeholder="Condition notes, strategy..." /></Field>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <Btn variant="outline" onClick={onClose}>Cancel</Btn>
          <Btn onClick={save} disabled={!form.address}>Add Property</Btn>
        </div>
      </div>
    </Modal>
  )
}
