import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { PageWrap, Field, inp, Btn, EmptyState, LoadingSpinner, fmtK } from '../components/ui.jsx'
import Drawer from '../components/Drawer.jsx'
import PropertyDrawer from '../components/PropertyDrawer.jsx'
import ProposalModal from '../components/ProposalModal.jsx'
import PropertyMapModal from '../components/PropertyMapModal.jsx'
import AddressInput from '../components/AddressInput.jsx'

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
    const payload = { deal_name: form.deal_name, notes: form.notes || null, fub_link: form.fub_link || null, status: form.status || 'analyzing', entity: 'BPV' }
    const { error } = isNew
      ? await supabase.from('cashoffer_package_deals').insert(payload)
      : await supabase.from('cashoffer_package_deals').update(payload).eq('id', form.id)
    setSaving(false)
    if (error) { alert(`Couldn't save this package.\n\n${error.message}`); return }
    onSave()
  }

  async function del() {
    if (!confirm('Delete this package and all its properties? This cannot be undone.')) return
    // Remove package_id from all properties in this package (keeps property records)
    await supabase.from('cashoffer_properties').update({ package_id: null }).eq('package_id', form.id)
    await supabase.from('cashoffer_package_deals').delete().eq('id', form.id)
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
        <Field label="FUB Link">
          <div style={{ display:'flex', gap:6 }}>
            <input style={inp} placeholder="https://app.followupboss.com/people/view/…" value={form.fub_link || ''} onChange={set('fub_link')} />
            {form.fub_link && (
              <button
                onClick={() => window.open(form.fub_link, 'nhc_fub', 'width=1400,height=950,noopener,noreferrer')}
                style={{ background:'#E0A526', border:'none', borderRadius:8, padding:'0 14px', cursor:'pointer', color:'#fff', fontSize:13, fontWeight:700, flexShrink:0 }}
              >Open ↗</button>
            )}
          </div>
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
    const { error } = await supabase.from('cashoffer_properties').insert({
      address, package_id: packageId,
      type: 'Analyzing',
    })
    setSaving(false)
    if (error) { alert(`Couldn't add this property.\n\n${error.message}`); return }
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
export default function PackageDeals({ openPropertyId, onOpenedTarget, isAgentRole=false, currentUserEmail=null } = {}) {
  const mobile = useIsMobile()
  const [packages, setPackages] = useState([])
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [pkgDrawer, setPkgDrawer] = useState(null)          // edit package metadata
  const [propDrawer, setPropDrawer] = useState(null)        // edit individual property (from outside the overlay, e.g. global search)
  const [addPropPkg, setAddPropPkg] = useState(null)        // add property to package
  const [proposal, setProposal] = useState(null)
  const [openPkg, setOpenPkg] = useState(null)  // package currently open in the list/map overlay

  useEffect(() => { load() }, [])

  // Keep the open package overlay's data fresh after edits (e.g. renaming via Edit)
  useEffect(() => {
    if (!openPkg) return
    const fresh = packages.find(pk => pk.id === openPkg.id)
    if (fresh && fresh !== openPkg) setOpenPkg(fresh)
  }, [packages]) // eslint-disable-line react-hooks/exhaustive-deps

  // A property arriving from the global search: find which package it
  // lives in, expand that package, and open the property's drawer.
  useEffect(() => {
    if (!openPropertyId || loading) return
    const match = properties.find(p => p.id === openPropertyId)
    if (match) {
      setPropDrawer(match)
    }
    onOpenedTarget && onOpenedTarget()
  }, [openPropertyId, loading]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    let propQuery = supabase.from('cashoffer_properties').select('*').not('package_id', 'is', null)
    if (isAgentRole) propQuery = propQuery.eq('agent_email', currentUserEmail)
    propQuery = propQuery.order('address')
    const [{ data: pkgs }, { data: props }] = await Promise.all([
      supabase.from('cashoffer_package_deals').select('*').order('created_at', { ascending: false }),
      propQuery,
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
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {packages.map(pkg => {
            const stats = packageStats(pkg.id)
            return (
              <div
                key={pkg.id}
                onClick={() => setOpenPkg(pkg)}
                style={{
                  background: '#fff', borderRadius: 8, border: '0.5px solid #D6D2CA', borderTop: '3px solid #B8892A',
                  padding: '16px 18px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8,
                  transition: 'box-shadow 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.08)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
              >
                <div style={{ fontSize: 15, fontWeight: 700, color: '#2C2C2C' }}>{pkg.deal_name}</div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>
                  {stats.total} propert{stats.total===1?'y':'ies'} · {stats.purchased} purchased · {stats.analyzing} analyzing
                </div>
                <div style={{ display: 'flex', gap: 14, marginTop: 4 }}>
                  {stats.totalArv > 0 && (
                    <div>
                      <div style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.6 }}>Combined ARV</div>
                      <div style={{ fontSize: 14, fontFamily: 'monospace', fontWeight: 700, color: '#2D6FAF' }}>{fmtK(stats.totalArv)}</div>
                    </div>
                  )}
                  {stats.totalPurchase > 0 && (
                    <div>
                      <div style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.6 }}>Total Cost</div>
                      <div style={{ fontSize: 14, fontFamily: 'monospace', fontWeight: 700, color: '#6b7280' }}>{fmtK(stats.totalPurchase)}</div>
                    </div>
                  )}
                </div>
              </div>
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

      {/* Shared property drawer — used for the global-search deep link case */}
      <PropertyDrawer
        property={propDrawer}
        open={!!propDrawer}
        onClose={() => setPropDrawer(null)}
        onSave={() => load()}
        mailings={[]}
        onViewOffer={p => setProposal(p)}
        isAgentRole={isAgentRole}
        currentUserEmail={currentUserEmail}
      />
      {proposal && <ProposalModal property={proposal} onClose={() => setProposal(null)} />}

      {/* Package overlay — List/Map toggle, property drawer opens on top */}
      {openPkg && (
        <PropertyMapModal
          properties={propertiesForPackage(openPkg.id)}
          packageName={openPkg.deal_name}
          fubLink={openPkg.fub_link}
          pkg={openPkg}
          onClose={() => setOpenPkg(null)}
          onSaveProperty={() => load()}
          onSavePackage={async (payload) => {
            const { error } = await supabase.from('cashoffer_package_deals').update(payload).eq('id', openPkg.id)
            if (error) { alert(`Couldn't save this package.\n\n${error.message}`); return }
            await load()
          }}
          onDeletePackage={async () => {
            await supabase.from('cashoffer_properties').update({ package_id: null }).eq('package_id', openPkg.id)
            await supabase.from('cashoffer_package_deals').delete().eq('id', openPkg.id)
            setOpenPkg(null)
            await load()
          }}
          onAddProperty={() => setAddPropPkg(openPkg.id)}
          isAgentRole={isAgentRole}
          currentUserEmail={currentUserEmail}
        />
      )}
    </PageWrap>
  )
}

