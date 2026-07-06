import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase.js'
import { PageWrap, SectionBar, EmptyState, Field, FieldRow, inp, Btn, Badge, Modal, LoadingSpinner } from '../components/ui.jsx'

const USE_AGAIN_COLOR = { Yes: '#3B6D11', No: '#B91C1C', Depends: '#D97825' }

function VendorDetailModal({ vendor, onClose, onUpdated, onDeleted }) {
  const [form, setForm]           = useState(vendor)
  const [notes, setNotes]         = useState([])
  const [properties, setProperties] = useState([])
  const [loading, setLoading]     = useState(true)
  const [noteForm, setNoteForm]   = useState({ what_happened: '', would_use_again: 'Yes' })
  const [addingNote, setAddingNote] = useState(false)

  useEffect(() => { load() }, [vendor.id])

  async function load() {
    setLoading(true)
    const [notesRes, rehabRes, suppliesRes] = await Promise.all([
      supabase.from('cashoffer_vendor_notes').select('*').eq('vendor_id', vendor.id).order('created_at', { ascending: false }),
      supabase.from('cashoffer_rehab_items').select('property_id').ilike('vendor', vendor.company_name),
      supabase.from('cashoffer_supplies').select('property_id').ilike('vendor', vendor.company_name),
    ])
    setNotes(notesRes.data || [])

    const propIds = [...new Set([
      ...(rehabRes.data || []).map(r => r.property_id),
      ...(suppliesRes.data || []).map(r => r.property_id),
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

  async function addNote() {
    if (!noteForm.what_happened.trim()) {
      alert('Please describe what happened before logging this note.')
      return
    }
    setAddingNote(true)
    const { error } = await supabase.from('cashoffer_vendor_notes').insert({
      vendor_id: vendor.id,
      what_happened: noteForm.what_happened.trim(),
      would_use_again: noteForm.would_use_again,
      source: 'vendors_page',
    })
    setAddingNote(false)
    if (error) { alert('Could not save note: ' + error.message); return }
    setNoteForm({ what_happened: '', would_use_again: 'Yes' })
    load()
  }

  async function deleteVendor() {
    if (!confirm(`Delete ${vendor.company_name}? This removes the vendor record and its note history. This cannot be undone.`)) return
    await supabase.from('cashoffer_vendors').delete().eq('id', vendor.id)
    onDeleted(vendor.id)
    onClose()
  }

  return (
    <Modal title={vendor.company_name || 'Vendor'} onClose={onClose} width={640}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Vendor info */}
        <FieldRow>
          <Field label="Company Name">
            <input style={inp} value={form.company_name || ''} onChange={e => saveField('company_name', e.target.value)} />
          </Field>
          <Field label="Service / Work They Do">
            <input style={inp} value={form.service || ''} onChange={e => saveField('service', e.target.value)} />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="Contact Person">
            <input style={inp} value={form.contact_person || ''} onChange={e => saveField('contact_person', e.target.value)} />
          </Field>
          <Field label="Phone">
            <input style={inp} value={form.phone || ''} onChange={e => saveField('phone', e.target.value)} />
          </Field>
        </FieldRow>
        <Field label="Email">
          <input style={inp} value={form.email || ''} onChange={e => saveField('email', e.target.value)} />
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

          {/* Note history */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
              History ({notes.length})
            </div>
            {notes.length === 0 ? (
              <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 12 }}>No notes logged yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                {notes.map(n => (
                  <div key={n.id} style={{ background: '#FAFAF8', border: '0.5px solid #D6D2CA', borderRadius: 6, padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      {n.would_use_again && <Badge color={USE_AGAIN_COLOR[n.would_use_again]}>Use again: {n.would_use_again}</Badge>}
                      <span style={{ fontSize: 10, color: '#9ca3af' }}>{new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#2C2C2C' }}>{n.what_happened}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Add note */}
            <div style={{ background: '#F0EDE6', borderRadius: 8, padding: '12px 14px' }}>
              <Field label="What happened?">
                <textarea
                  value={noteForm.what_happened}
                  onChange={e => setNoteForm(f => ({ ...f, what_happened: e.target.value }))}
                  placeholder="What went well or went wrong with this vendor?"
                  rows={2}
                  style={{ ...inp, resize: 'vertical', fontFamily: 'inherit', marginBottom: 10 }}
                />
              </Field>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <select value={noteForm.would_use_again} onChange={e => setNoteForm(f => ({ ...f, would_use_again: e.target.value }))} style={{ ...inp, width: 'auto' }}>
                  <option value="Yes">Would use again: Yes</option>
                  <option value="No">Would use again: No</option>
                  <option value="Depends">Would use again: Depends</option>
                </select>
                <Btn onClick={addNote} disabled={addingNote}>{addingNote ? 'Saving…' : 'Log Note'}</Btn>
              </div>
            </div>
          </div>
        </>)}

        <div style={{ borderTop: '1px solid #F0EDE6', paddingTop: 14 }}>
          <button onClick={deleteVendor} style={{ background: 'none', border: '1px solid #B91C1C', color: '#B91C1C', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', borderRadius: 6, padding: '6px 12px' }}>
            Delete Vendor
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default function Vendors() {
  const [vendors, setVendors] = useState([])
  const [loading, setLoading] = useState(true)
  const [sortService, setSortService] = useState('All')
  const [activeVendor, setActiveVendor] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('cashoffer_vendors')
      .select('*')
      .order('company_name', { ascending: true })
    setVendors(data || [])
    setLoading(false)
  }

  async function addVendor() {
    const { data } = await supabase.from('cashoffer_vendors').insert({ company_name: 'New Vendor' }).select().single()
    setVendors(v => [data, ...v])
    setActiveVendor(data)
  }

  const services = useMemo(() => {
    const s = new Set(vendors.map(v => v.service).filter(Boolean))
    return ['All', ...Array.from(s).sort()]
  }, [vendors])

  const filtered = sortService === 'All' ? vendors : vendors.filter(v => v.service === sortService)

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
              <div style={{ fontSize: 14, fontWeight: 700, color: '#2C2C2C', marginBottom: 4 }}>{v.company_name || 'Unnamed Vendor'}</div>
              {v.service && <Badge>{v.service}</Badge>}
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>{v.contact_person || '—'}</div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{v.phone || v.email || ''}</div>
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
