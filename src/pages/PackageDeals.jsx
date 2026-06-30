import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { PageWrap, SectionBar, Card, Field, FieldRow, inp, monoInp, Btn, Badge, EmptyState, LoadingSpinner, fmt, fmtK } from '../components/ui.jsx'
import Drawer from '../components/Drawer.jsx'
import PropertyDrawer from '../components/PropertyDrawer.jsx'
import ProposalModal from '../components/ProposalModal.jsx'
import AddressInput from '../components/AddressInput.jsx'

const DISP_COLORS = { listing:'#3B6D11', wholesale:'#6b21a8', flip:'#D97825', hold:'#2D6FAF', lost:'#9ca3af' }
const DISP_LABELS = { listing:'Listing', wholesale:'Wholesale', flip:'Flip', hold:'Hold', lost:'Lost' }

// ── Package form drawer ──────────────────────────────────────────────────────
function PackageFormDrawer({ pkg, open, onClose, onSave }) {
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (pkg) setForm({ ...pkg }) }, [pkg])
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  const isNew = !form.id

  async function save() {
    if (!form.deal_name) return
    setSaving(true)
    const payload = { deal_name: form.deal_name, notes: form.notes || null, status: form.status || 'analyzing', entity: 'BPV' }
    if (isNew) await supabase.from('package_deals').insert(payload)
    else await supabase.from('package_deals').update(payload).eq('id', form.id)
    setSaving(false)
    onSave()
  }

  async function del() {
    if (!confirm('Delete this package and all its properties? This cannot be undone.')) return
    // Remove package_id from all properties in this package (keeps property records)
    await supabase.from('properties').update({ package_id: null }).eq('package_id', form.id)
    await supabase.from('package_deals').delete().eq('id', form.id)
    onSave(); onClose()
  }

  async function handleClose() {
    if (form.deal_name) await save()
    onClose()
  }

  if (!pkg) return null

  return (
    <Drawer open={open} onClose={handleClose} title={isNew ? 'New Package' : form.deal_name} width={480}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="drawer-section">Package Details</div>
        <Field label="Package Name">
          <input style={inp} value={form.deal_name || ''} onChange={set('deal_name')} placeholder="Central KY Portfolio — 35 Properties" />
        </Field>
        <Field label="Notes">
          <textarea style={{ ...inp, minHeight: 72, resize: 'vertical' }} value={form.notes || ''} onChange={set('notes')} placeholder="Seller context, deal overview..." />
        </Field>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '1px solid #F0EDE6' }}>
          {!isNew && <Btn variant="danger" onClick={del}>Delete Package</Btn>}
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <Btn variant="outline" onClick={onClose}>Cancel</Btn>
            <Btn onClick={save} disabled={saving || !form.deal_name}>{saving ? 'Saving…' : 'Save'}</Btn>
          </div>
        </div>
      </div>
    </Drawer>
  )
}

// ── Add property to package drawer ───────────────────────────────────────────
function AddPropertyDrawer({ packageId, open, onClose, onSave }) {
  const [address, setAddress] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!address || !packageId) return
    setSaving(true)
    await supabase.from('properties').insert({
      address, package_id: packageId,
      status: 'analyzing', entity: 'BPV',
      investment_type: 'hold',
    })
    setSaving(false)
    setAddress('')
    onSave()
  }

  return (
    <Drawer open={open} onClose={onClose} title="Add Property to Package" width={420}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Address">
          <AddressInput value={address} onChange={v => setAddress(v)} />
        </Field>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <Btn variant="outline" onClick={onClose} style={{ flex: 1 }}>Cancel</Btn>
          <Btn onClick={save} disabled={saving || !address} style={{ flex: 1 }}>{saving ? 'Adding…' : 'Add Property'}</Btn>
        </div>
      </div>
    </Drawer>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PackageDeals({ openPropertyId, onOpenedTarget } = {}) {
  const mobile = useIsMobile()
  const [packages, setPackages] = useState([])
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [activePackage, setActivePackage] = useState(null)  // expanded package
  const [pkgDrawer, setPkgDrawer] = useState(null)          // edit package metadata
  const [propDrawer, setPropDrawer] = useState(null)        // edit individual property
  const [addPropPkg, setAddPropPkg] = useState(null)        // add property to package
  const [proposal, setProposal] = useState(null)

  useEffect(() => { load() }, [])

  // A property arriving from the global search: find which package it
  // lives in, expand that package, and open the property's drawer.
  useEffect(() => {
    if (!openPropertyId || loading) return
    const match = properties.find(p => p.id === openPropertyId)
    if (match) {
      setActivePackage(match.package_id)
      setPropDrawer(match)
    }
    onOpenedTarget && onOpenedTarget()
  }, [openPropertyId, loading]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    const [{ data: pkgs }, { data: props }] = await Promise.all([
      supabase.from('package_deals').select('*').order('created_at', { ascending: false }),
      supabase.from('properties').select('*').not('package_id', 'is', null).order('address'),
    ])
    setPackages(pkgs || [])
    setProperties(props || [])
    setLoading(false)
  }

  function propertiesForPackage(pkgId) {
    return properties.filter(p => p.package_id === pkgId && !p.excluded)
  }

  function packageStats(pkgId) {
    const props = propertiesForPackage(pkgId)
    const totalArv = props.reduce((s, p) => s + (parseFloat(p.arv) || 0), 0)
    const totalPurchase = props.reduce((s, p) => s + (parseFloat(p.purchase_price) || 0), 0)
    const totalRehab = props.reduce((s, p) => s + (parseFloat(p.rehab_cost) || 0), 0)
    const purchased = props.filter(p => p.disposition)
    const analyzing = props.filter(p => !p.disposition)
    return { totalArv, totalPurchase, totalRehab, purchased: purchased.length, analyzing: analyzing.length, total: props.length }
  }

  if (loading) return <LoadingSpinner />

  const totalPackages = packages.length
  const totalProps = properties.filter(p => !p.excluded).length
  const totalPurchased = properties.filter(p => p.disposition && !p.excluded).length

  return (
    <PageWrap pad={!mobile}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#2C2C2C' }}>Package Deals</h1>
          <p style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Multi-property seller packages</p>
        </div>
        <Btn onClick={() => setPkgDrawer({})}>+ New Package</Btn>
      </div>

      {packages.length === 0 ? (
        <EmptyState icon="◫" text="No packages yet. Create one to start tracking a multi-property deal." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {packages.map(pkg => {
            const stats = packageStats(pkg.id)
            const pkgProps = propertiesForPackage(pkg.id)
            const isOpen = activePackage === pkg.id

            return (
              <Card key={pkg.id} style={{ padding: 0, overflow: 'hidden' }}>
                {/* Package header */}
                <div
                  onClick={() => setActivePackage(isOpen ? null : pkg.id)}
                  style={{ padding: '14px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: isOpen ? '#FAFAF8' : '#fff', borderBottom: isOpen ? '1px solid #F0EDE6' : 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 14, color: '#6b7280', transition: 'transform 0.2s', display: 'inline-block', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#2C2C2C' }}>{pkg.deal_name}</div>
                      <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                        {stats.total} properties · {stats.purchased} purchased · {stats.analyzing} analyzing
                        {stats.totalPurchase > 0 && ` · ${fmtK(stats.totalPurchase)} total cost`}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {stats.totalArv > 0 && (
                      <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#2D6FAF', fontWeight: 600 }}>ARV {fmtK(stats.totalArv)}</span>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); setPkgDrawer(pkg) }}
                      style={{ background: '#F0EDE6', border: 'none', borderRadius: 4, padding: '5px 10px', fontSize: 11, cursor: 'pointer', color: '#6b7280', fontFamily: 'inherit' }}
                    >Edit</button>
                    <button
                      onClick={e => { e.stopPropagation(); setAddPropPkg(pkg.id) }}
                      style={{ background: '#B8892A', border: 'none', borderRadius: 4, padding: '5px 10px', fontSize: 11, cursor: 'pointer', color: '#fff', fontWeight: 600, fontFamily: 'inherit' }}
                    >+ Property</button>
                  </div>
                </div>

                {/* Properties table */}
                {isOpen && (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#F0EDE6' }}>
                        {['Address', 'Cash Offer', 'Rehab', 'ARV', 'Disposition', 'Updated', 'Offer PDF'].map(h => (
                          <th key={h} style={{ padding: '7px 14px', textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: 0.8, color: '#6b7280', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pkgProps.map((p, i) => {
                        const dispColor = DISP_COLORS[p.disposition] || '#9ca3af'
                        const dispLabel = DISP_LABELS[p.disposition]
                        return (
                          <tr
                            key={p.id}
                            onClick={() => setPropDrawer(p)}
                            style={{ background: i % 2 === 0 ? '#fff' : '#FAFAF8', borderTop: '0.5px solid #F0EDE6', cursor: 'pointer' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#fef9f0'}
                            onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#FAFAF8'}
                          >
                            <td style={{ padding: '9px 14px', fontSize: 13, fontWeight: 600 }}>
                              <div>{p.address}</div>
                              {p.unit_count > 1 && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{p.unit_count} units</div>}
                            </td>
                            <td style={{ padding: '9px 14px', fontSize: 12, fontFamily: 'monospace', color: '#3B6D11', fontWeight: 600 }}>{(() => { const co = (() => { const arv=parseFloat(p.arv)||0; if(!arv) return null; const reno=(p.repair_items||[]).reduce((s,r)=>s+(parseFloat(r.cost)||0),0); const commCash=(parseFloat(p.comm_cash_pct)||9)/100; const profitPct=(parseFloat(p.profit_margin)||15)/100; const profit=p.profit_override?parseFloat(p.profit_override):arv*profitPct; const cashHold=(parseFloat(p.hold_cash_pct)||0.75)/100*(parseFloat(p.hold_cash_months)||6)*arv; return p.cash_offer_override?parseFloat(p.cash_offer_override):arv-reno-(commCash*arv)-cashHold-profit; })(); return co ? fmt(co) : '—'; })()}</td>
                            <td style={{ padding: '9px 14px', fontSize: 12, fontFamily: 'monospace', color: '#6b7280' }}>{fmt(p.rehab_cost)||'—'}</td>
                            <td style={{ padding: '9px 14px', fontSize: 12, fontFamily: 'monospace', fontWeight: 700 }}>{fmt(p.arv)||'—'}</td>
                            <td style={{ padding: '9px 14px' }}>
                              {dispLabel ? (
                                <span style={{ background: dispColor + '20', color: dispColor, border: `1px solid ${dispColor}40`, borderRadius: 4, padding: '2px 7px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                                  {dispLabel}
                                </span>
                              ) : (
                                <span style={{ fontSize: 11, color: '#9ca3af' }}>Analyzing</span>
                              )}
                            </td>
                            <td style={{ padding: '9px 14px', fontSize: 11, color: '#9ca3af' }}>{new Date(p.updated_at).toLocaleDateString()}</td>
                            <td style={{ padding: '9px 10px' }} onClick={e => e.stopPropagation()}>
                              {p.arv && <button onClick={e => { e.stopPropagation(); setProposal(p) }} style={{ background:'#2D6FAF', color:'#fff', border:'none', borderRadius:4, padding:'4px 10px', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>Offer PDF</button>}
                            </td>
                          </tr>
                        )
                      })}
                      {pkgProps.length === 0 && (
                        <tr><td colSpan={8} style={{ padding: '20px 14px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No properties yet — click + Property to add one.</td></tr>
                      )}
                    </tbody>
                    {pkgProps.length > 0 && (
                      <tfoot>
                        <tr style={{ borderTop: '2px solid #D6D2CA', background: '#F0EDE6' }}>
                          <td colSpan={3} style={{ padding: '8px 14px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>Totals</td>
                          <td style={{ padding: '8px 14px', fontSize: 13, fontFamily: 'monospace', fontWeight: 700, color: '#6b7280' }}>{fmtK(stats.totalRehab)}</td>
                          <td style={{ padding: '8px 14px', fontSize: 13, fontFamily: 'monospace', fontWeight: 700 }}>{fmtK(stats.totalArv)}</td>
                          <td /><td /><td />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Package metadata drawer */}
      <PackageFormDrawer
        pkg={pkgDrawer}
        open={!!pkgDrawer}
        onClose={() => setPkgDrawer(null)}
        onSave={() => { load(); setPkgDrawer(null) }}
      />

      {/* Add property to package */}
      <AddPropertyDrawer
        packageId={addPropPkg}
        open={!!addPropPkg}
        onClose={() => setAddPropPkg(null)}
        onSave={() => { load(); setAddPropPkg(null) }}
      />

      {/* Shared property drawer — same as Analyzer */}
      <PropertyDrawer
        property={propDrawer}
        open={!!propDrawer}
        onClose={() => setPropDrawer(null)}
        onSave={() => load()}
        mailings={[]}
        onViewOffer={p => setProposal(p)}
      />
      {proposal && <ProposalModal property={proposal} onClose={() => setProposal(null)} />}
    </PageWrap>
  )
}
