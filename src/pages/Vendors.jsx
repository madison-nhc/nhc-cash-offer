import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase.js'
import { PageWrap, SectionBar, EmptyState, Field, FieldRow, inp, Btn, Badge, Modal, LoadingSpinner } from '../components/ui.jsx'

const USE_AGAIN_COLOR = { Yes: '#3B6D11', No: '#B91C1C', Maybe: '#D97825' }

const SERVICE_TYPES = [
  'General Contractor', 'Electrical', 'Plumbing', 'HVAC', 'Roofing', 'Framing',
  'Drywall', 'Painting', 'Flooring', 'Foundation', 'Concrete', 'Masonry',
  'Carpentry', 'Cabinetry', 'Countertops', 'Tile', 'Windows & Doors', 'Siding',
  'Gutters', 'Insulation', 'Demolition', 'Landscaping', 'Tree Service', 'Fencing',
  'Pest Control', 'Cleaning', 'Locksmith', 'Appliances', 'Pool', 'Septic',
  'Well', 'Solar', 'Other',
]

// Multi-select that also lets you type a brand-new service and add it on the fly —
// added services are stored directly on the vendor, no separate service-type table needed.
function ServiceMultiSelect({ value = [], onChange }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  function toggle(type) {
    onChange(value.includes(type) ? value.filter(t => t !== type) : [...value, type])
    setQuery('')
  }
  function addCustom() {
    const t = query.trim()
    if (!t || value.includes(t)) return
    onChange([...value, t])
    setQuery('')
  }
  const matches = SERVICE_TYPES.filter(t => t.toLowerCase().includes(query.toLowerCase()))
  const exactExists = SERVICE_TYPES.some(t => t.toLowerCase() === query.trim().toLowerCase()) || value.some(t => t.toLowerCase() === query.trim().toLowerCase())
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ ...inp, minHeight: 38, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, padding: '4px 8px' }}>
        {value.map(t => (
          <Badge key={t}>
            {t} <span onClick={() => toggle(t)} style={{ cursor: 'pointer', marginLeft: 4 }}>×</span>
          </Badge>
        ))}
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={e => { if (e.key === 'Enter' && query.trim() && !exactExists) { e.preventDefault(); addCustom() } }}
          placeholder={value.length === 0 ? 'Type to search or add a service…' : ''}
          style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, fontFamily: 'inherit', flex: 1, minWidth: 90, padding: '4px 0' }}
        />
      </div>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
          background: '#fff', border: '1px solid #D6D2CA', borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)', maxHeight: 220, overflowY: 'auto', padding: 6,
        }} onMouseLeave={() => setOpen(false)}>
          {matches.length === 0 && !query.trim() && (
            <div style={{ fontSize: 12, color: '#9ca3af', padding: '6px 8px' }}>No matching services</div>
          )}
          {matches.map(t => (
            <div key={t} onClick={() => toggle(t)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', fontSize: 12, color: '#2C2C2C', cursor: 'pointer', borderRadius: 5, background: value.includes(t) ? '#FAFAF8' : 'transparent' }}
              onMouseEnter={e => e.currentTarget.style.background = '#FAFAF8'}
              onMouseLeave={e => e.currentTarget.style.background = value.includes(t) ? '#FAFAF8' : 'transparent'}
            >
              <input type="checkbox" checked={value.includes(t)} readOnly />
              {t}
            </div>
          ))}
          {query.trim() && !exactExists && (
            <div onClick={addCustom} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', fontSize: 12, color: '#B8892A', fontWeight: 700, cursor: 'pointer', borderRadius: 5, borderTop: matches.length ? '0.5px solid #F0EDE6' : 'none', marginTop: matches.length ? 4 : 0 }}
              onMouseEnter={e => e.currentTarget.style.background = '#FAFAF8'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              + Add "{query.trim()}" as a new service
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StarRating({ value = 0, onChange, size = 18, readOnly = false }) {
  const [hover, setHover] = useState(0)
  return (
    <div style={{ display: 'inline-flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <span
          key={n}
          onClick={() => !readOnly && onChange && onChange(n)}
          onMouseEnter={() => !readOnly && setHover(n)}
          onMouseLeave={() => !readOnly && setHover(0)}
          style={{
            fontSize: size, lineHeight: 1, cursor: readOnly ? 'default' : 'pointer',
            color: n <= (hover || value) ? '#B8892A' : '#D6D2CA',
          }}
        >★</span>
      ))}
    </div>
  )
}

function VendorDetailModal({ vendor, onClose, onUpdated, onDeleted }) {
  const [form, setForm]           = useState(vendor)
  const [reviews, setReviews]     = useState([])
  const [properties, setProperties] = useState([])
  const [allProperties, setAllProperties] = useState([])
  const [loading, setLoading]     = useState(true)
  const [reviewForm, setReviewForm] = useState({ property_id: '', what_happened: '', would_use_again: 'Yes', rating: 0 })
  const [addingReview, setAddingReview] = useState(false)
  const [notesDraft, setNotesDraft] = useState(vendor.notes || '')

  useEffect(() => { load() }, [vendor.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    const [reviewsRes, rehabRes, suppliesRes, allPropsRes] = await Promise.all([
      supabase.from('cashoffer_vendor_notes').select('*').eq('vendor_id', vendor.id).order('created_at', { ascending: false }),
      supabase.from('cashoffer_rehab_items').select('property_id').ilike('vendor', vendor.company_name),
      supabase.from('cashoffer_supplies').select('property_id').ilike('vendor', vendor.company_name),
      supabase.from('cashoffer_properties').select('id,address').order('address', { ascending: true }),
    ])
    const reviewsData = reviewsRes.data || []
    setReviews(reviewsData)
    setAllProperties(allPropsRes.data || [])

    const propIds = [...new Set([
      ...(rehabRes.data || []).map(r => r.property_id),
      ...(suppliesRes.data || []).map(r => r.property_id),
      ...reviewsData.map(r => r.property_id).filter(Boolean),
    ])]

    if (propIds.length) {
      const { data: props } = await supabase
        .from('cashoffer_properties')
        .select('id,address,type,stage,disposition')
        .in('id', propIds)
      setProperties(props || [])
    } else {
      setProperties([])
    }
    setLoading(false)
  }

  async function saveField(field, value) {
    setForm(f => ({ ...f, [field]: value }))
    await supabase.from('cashoffer_vendors').update({ [field]: value }).eq('id', vendor.id)
    onUpdated({ ...form, [field]: value })
  }

  async function saveNotes() {
    await saveField('notes', notesDraft)
  }

  async function addReview() {
    if (!reviewForm.what_happened.trim()) {
      alert('Please describe what happened before logging this review.')
      return
    }
    setAddingReview(true)
    const { error } = await supabase.from('cashoffer_vendor_notes').insert({
      vendor_id: vendor.id,
      property_id: reviewForm.property_id || null,
      what_happened: reviewForm.what_happened.trim(),
      would_use_again: reviewForm.would_use_again,
      rating: reviewForm.rating || null,
      source: 'vendors_page',
    })
    setAddingReview(false)
    if (error) { alert('Could not save review: ' + error.message); return }
    setReviewForm({ property_id: '', what_happened: '', would_use_again: 'Yes', rating: 0 })
    load()
  }

  async function deleteVendor() {
    if (!confirm(`Delete ${vendor.company_name}? This removes the vendor record and its review history. This cannot be undone.`)) return
    await supabase.from('cashoffer_vendors').delete().eq('id', vendor.id)
    onDeleted(vendor.id)
    onClose()
  }

  const propertyAddress = id => allProperties.find(p => p.id === id)?.address

  return (
    <Modal title={vendor.company_name || 'Vendor'} onClose={onClose} width={680}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* Business */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#B8892A', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Business</div>
          <Field label="Business Name">
            <input style={{ ...inp, marginBottom: 10 }} value={form.company_name || ''} onChange={e => saveField('company_name', e.target.value)} />
          </Field>
          <FieldRow>
            <Field label="Business Number"><input style={inp} value={form.business_phone || ''} onChange={e => saveField('business_phone', e.target.value)} /></Field>
            <Field label="Business Email"><input style={inp} value={form.business_email || ''} onChange={e => saveField('business_email', e.target.value)} /></Field>
          </FieldRow>
        </div>

        {/* Services */}
        <Field label="Services">
          <ServiceMultiSelect value={form.services || []} onChange={types => saveField('services', types)} />
        </Field>

        {/* Owner */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#B8892A', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Owner</div>
          <Field label="Owner Name">
            <input style={{ ...inp, marginBottom: 10 }} value={form.owner_name || ''} onChange={e => saveField('owner_name', e.target.value)} />
          </Field>
          <FieldRow>
            <Field label="Owner Number"><input style={inp} value={form.owner_phone || ''} onChange={e => saveField('owner_phone', e.target.value)} /></Field>
            <Field label="Owner Email"><input style={inp} value={form.owner_email || ''} onChange={e => saveField('owner_email', e.target.value)} /></Field>
          </FieldRow>
        </div>

        {/* Contact Person */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#B8892A', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Contact Person</div>
          <Field label="Contact Person Name">
            <input style={{ ...inp, marginBottom: 10 }} value={form.contact_person || ''} onChange={e => saveField('contact_person', e.target.value)} />
          </Field>
          <FieldRow>
            <Field label="Contact Person Number"><input style={inp} value={form.phone || ''} onChange={e => saveField('phone', e.target.value)} /></Field>
            <Field label="Contact Person Email"><input style={inp} value={form.email || ''} onChange={e => saveField('email', e.target.value)} /></Field>
          </FieldRow>
        </div>

        {/* FUB Link */}
        <Field label="FUB Link">
          <input style={inp} placeholder="https://…" value={form.fub_link || ''} onChange={e => saveField('fub_link', e.target.value)} />
        </Field>

        {/* Notes block — a single freeform scratchpad, separate from the property-linked Reviews below */}
        <Field label="Notes">
          <textarea
            value={notesDraft}
            onChange={e => setNotesDraft(e.target.value)}
            onBlur={saveNotes}
            placeholder="General notes about this vendor…"
            rows={3}
            style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </Field>

        {loading ? <LoadingSpinner /> : (<>
          {/* Associated properties */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
              Properties ({properties.length})
            </div>
            {properties.length === 0 ? (
              <div style={{ fontSize: 12, color: '#9ca3af' }}>No properties linked to this vendor yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {properties.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FAFAF8', border: '0.5px solid #D6D2CA', borderRadius: 6, padding: '8px 12px' }}>
                    <span style={{ fontSize: 12, color: '#2C2C2C', fontWeight: 600 }}>{p.address}</span>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>{p.type || p.disposition || '—'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reviews — linked to a specific property */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
              Reviews ({reviews.length})
            </div>
            {reviews.length === 0 ? (
              <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 12 }}>No reviews logged yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                {reviews.map(n => (
                  <div key={n.id} style={{ background: '#FAFAF8', border: '0.5px solid #D6D2CA', borderRadius: 6, padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {n.would_use_again && <Badge color={USE_AGAIN_COLOR[n.would_use_again]}>Use again: {n.would_use_again}</Badge>}
                        {n.rating && <StarRating value={n.rating} readOnly size={13} />}
                        {n.property_id && propertyAddress(n.property_id) && (
                          <Badge>{propertyAddress(n.property_id)}</Badge>
                        )}
                      </div>
                      <span style={{ fontSize: 10, color: '#9ca3af' }}>{new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#2C2C2C' }}>{n.what_happened}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Add review */}
            <div style={{ background: '#F0EDE6', borderRadius: 8, padding: '12px 14px' }}>
              <Field label="Property">
                <select
                  value={reviewForm.property_id}
                  onChange={e => setReviewForm(f => ({ ...f, property_id: e.target.value }))}
                  style={{ ...inp, marginBottom: 10 }}
                >
                  <option value="">No specific property</option>
                  {allProperties.map(p => <option key={p.id} value={p.id}>{p.address}</option>)}
                </select>
              </Field>
              <Field label="What happened?">
                <textarea
                  value={reviewForm.what_happened}
                  onChange={e => setReviewForm(f => ({ ...f, what_happened: e.target.value }))}
                  placeholder="What went well or went wrong with this vendor?"
                  rows={2}
                  style={{ ...inp, resize: 'vertical', fontFamily: 'inherit', marginBottom: 10 }}
                />
              </Field>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>Rating</div>
                  <StarRating value={reviewForm.rating} onChange={r => setReviewForm(f => ({ ...f, rating: r }))} />
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>Would Use Again</div>
                  <select value={reviewForm.would_use_again} onChange={e => setReviewForm(f => ({ ...f, would_use_again: e.target.value }))} style={{ ...inp, width: 'auto' }}>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                    <option value="Maybe">Maybe</option>
                  </select>
                </div>
                <div>
                  <Btn onClick={addReview} disabled={addingReview}>{addingReview ? 'Saving…' : 'Log Review'}</Btn>
                </div>
              </div>
            </div>
          </div>
        </>)}

        <div style={{ borderTop: '1px solid #F0EDE6', paddingTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={deleteVendor} style={{ background: 'none', border: '1px solid #B91C1C', color: '#B91C1C', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', borderRadius: 6, padding: '6px 12px' }}>
            Delete Vendor
          </button>
          <Btn onClick={onClose}>Save</Btn>
        </div>
      </div>
    </Modal>
  )
}

export default function Vendors() {
  const [vendors, setVendors] = useState([])
  const [ratings, setRatings] = useState({})
  const [loading, setLoading] = useState(true)
  const [sortService, setSortService] = useState('All')
  const [activeVendor, setActiveVendor] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [vendorsRes, notesRes] = await Promise.all([
      supabase.from('cashoffer_vendors').select('*').order('company_name', { ascending: true }),
      supabase.from('cashoffer_vendor_notes').select('vendor_id, rating').not('rating', 'is', null),
    ])
    setVendors(vendorsRes.data || [])
    const byVendor = {}
    for (const n of notesRes.data || []) {
      if (!byVendor[n.vendor_id]) byVendor[n.vendor_id] = []
      byVendor[n.vendor_id].push(n.rating)
    }
    const avgs = {}
    for (const [id, list] of Object.entries(byVendor)) {
      avgs[id] = list.reduce((a, b) => a + b, 0) / list.length
    }
    setRatings(avgs)
    setLoading(false)
  }

  async function addVendor() {
    const { data } = await supabase.from('cashoffer_vendors').insert({ company_name: 'New Vendor' }).select().single()
    setVendors(v => [data, ...v])
    setActiveVendor(data)
  }

  const services = useMemo(() => {
    const s = new Set(vendors.flatMap(v => v.services || []))
    return ['All', ...Array.from(s).sort()]
  }, [vendors])

  const filtered = sortService === 'All' ? vendors : vendors.filter(v => (v.services || []).includes(sortService))

  if (loading) return <PageWrap><LoadingSpinner /></PageWrap>

  return (
    <PageWrap>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#2C2C2C' }}>Vendors</div>
          <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>Click a vendor to see their history and every property they've worked on</div>
        </div>
        <button onClick={addVendor} style={{
          background: '#B8892A', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px',
          cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', whiteSpace: 'nowrap',
        }}>+ Add Vendor</button>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {services.map(s => (
          <button key={s} onClick={() => setSortService(s)} style={{
            background: sortService === s ? '#2C2C2C' : '#F0EDE6',
            color: sortService === s ? '#fff' : '#6b7280',
            border: 'none', borderRadius: 20, padding: '5px 14px',
            cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
          }}>{s}</button>
        ))}
      </div>

      <SectionBar>Vendors ({filtered.length})</SectionBar>
      {filtered.length === 0 ? (
        <EmptyState icon="○" text="No vendors found." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: (typeof window !== 'undefined' && window.innerWidth < 768) ? '1fr' : 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12, marginTop: 12 }}>
          {filtered.map(v => (
            <div
              key={v.id}
              onClick={() => setActiveVendor(v)}
              style={{ background: '#fff', border: '0.5px solid #D6D2CA', borderRadius: 8, padding: '14px 16px', cursor: 'pointer', transition: 'border-color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#B8892A'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#D6D2CA'}
            >
              <div style={{ fontSize: 14, fontWeight: 700, color: '#2C2C2C', marginBottom: 6 }}>{v.company_name || 'Unnamed Vendor'}</div>
              {ratings[v.id] && <div style={{ marginBottom: 6 }}><StarRating value={Math.round(ratings[v.id])} readOnly size={13} /></div>}
              {(v.services || []).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
                  {v.services.map(t => <Badge key={t}>{t}</Badge>)}
                </div>
              )}
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>{v.contact_person || '—'}</div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{v.business_phone || v.phone || v.business_email || v.email || ''}</div>
            </div>
          ))}
        </div>
      )}

      {activeVendor && (
        <VendorDetailModal
          vendor={activeVendor}
          onClose={() => setActiveVendor(null)}
          onUpdated={updated => setVendors(vs => vs.map(x => x.id === updated.id ? updated : x))}
          onDeleted={id => setVendors(vs => vs.filter(x => x.id !== id))}
        />
      )}
    </PageWrap>
  )
}
