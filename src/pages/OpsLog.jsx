import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { PageWrap, SectionBar, EmptyState, Field, FieldRow, inp, Btn, Badge, LoadingSpinner } from '../components/ui.jsx'

const FOUND_BY_OPTIONS = ['Bob', 'Eric', 'Blaire', 'Madison']
const STATUS_OPTIONS = ['Open', 'In Progress', 'Fixed']
const STATUS_COLOR = { Open: '#B91C1C', 'In Progress': '#D97825', Fixed: '#3B6D11' }

const EMPTY_FORM = { issue: '', fix: '', found_by: '', is_vendor_related: false, vendor_name: '' }

export default function OpsLog() {
  const [entries, setEntries]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [form, setForm]         = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [confirmMsg, setConfirmMsg] = useState(false)
  const [statusFilter, setStatusFilter] = useState('All')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('cashoffer_ops_log')
      .select('*')
      .order('created_at', { ascending: false })
    setEntries(data || [])
    setLoading(false)
  }

  function set(field) { return e => setForm(f => ({ ...f, [field]: e.target.value })) }

  async function submit() {
    if (!form.issue.trim() || !form.fix.trim()) {
      alert('Please fill in both "What\'s the issue?" and "What would fix it?" before logging.')
      return
    }
    setSubmitting(true)
    const payload = {
      issue: form.issue.trim(),
      fix: form.fix.trim(),
      found_by: form.found_by || null,
      is_vendor_related: form.is_vendor_related === true || form.is_vendor_related === 'true',
      vendor_name: (form.is_vendor_related === true || form.is_vendor_related === 'true') ? (form.vendor_name.trim() || null) : null,
      status: 'Open',
    }
    const { error } = await supabase.from('cashoffer_ops_log').insert(payload)
    setSubmitting(false)
    if (error) {
      alert('Could not log this: ' + error.message)
      return
    }
    setForm(EMPTY_FORM)
    setConfirmMsg(true)
    setTimeout(() => setConfirmMsg(false), 3000)
    load()
  }

  async function updateStatus(id, status) {
    setEntries(e => e.map(x => x.id === id ? { ...x, status } : x))
    await supabase.from('cashoffer_ops_log').update({ status }).eq('id', id)
  }

  async function removeEntry(id) {
    if (!confirm('Delete this entry?')) return
    setEntries(e => e.filter(x => x.id !== id))
    await supabase.from('cashoffer_ops_log').delete().eq('id', id)
  }

  const isVendorYes = form.is_vendor_related === true || form.is_vendor_related === 'true'
  const filtered = statusFilter === 'All' ? entries : entries.filter(e => e.status === statusFilter)

  if (loading) return <PageWrap><LoadingSpinner /></PageWrap>

  return (
    <PageWrap>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#2C2C2C' }}>Things We Could Do Better</div>
        <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>Track the gaps we find running this thing day to day. Fix them before they cost us again.</div>
      </div>

      {/* ── Submission form ── */}
      <div style={{ background: '#FAFAF8', border: '0.5px solid #D6D2CA', borderRadius: 8, padding: '18px 18px 20px', marginBottom: 28 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="What's the issue?">
            <textarea
              value={form.issue}
              onChange={set('issue')}
              placeholder="What slowed us down, broke, or cost us money/time?"
              rows={2}
              style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </Field>
          <Field label="What would fix it?">
            <textarea
              value={form.fix}
              onChange={set('fix')}
              placeholder="What should we do different next time?"
              rows={2}
              style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </Field>
          <FieldRow>
            <Field label="Who found this (optional)">
              <select value={form.found_by} onChange={set('found_by')} style={inp}>
                <option value="">Bob, Eric, Blaire, or Madison</option>
                {FOUND_BY_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>
            <Field label="Is this about a vendor?">
              <select
                value={form.is_vendor_related === true || form.is_vendor_related === 'true' ? 'true' : 'false'}
                onChange={e => setForm(f => ({ ...f, is_vendor_related: e.target.value }))}
                style={inp}
              >
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
            </Field>
          </FieldRow>
          {isVendorYes && (
            <Field label="Which vendor?">
              <input
                style={inp}
                value={form.vendor_name}
                onChange={set('vendor_name')}
                placeholder="Vendor company name"
              />
            </Field>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 4 }}>
            <Btn onClick={submit} disabled={submitting}>{submitting ? 'Logging…' : 'Log it'}</Btn>
            {confirmMsg && <span style={{ fontSize: 12, color: '#3B6D11', fontWeight: 700 }}>Logged. On the review list.</span>}
          </div>
        </div>
      </div>

      {/* ── Internal review list ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <SectionBar>Review List ({filtered.length})</SectionBar>
        <div style={{ display: 'flex', gap: 6 }}>
          {['All', ...STATUS_OPTIONS].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{
              background: statusFilter === s ? '#2C2C2C' : '#F0EDE6',
              color: statusFilter === s ? '#fff' : '#6b7280',
              border: 'none', borderRadius: 20, padding: '4px 12px',
              cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
            }}>{s}</button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="○" text="Nothing logged yet." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(e => (
            <div key={e.id} style={{ background: '#fff', border: '0.5px solid #D6D2CA', borderRadius: 8, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Badge color={STATUS_COLOR[e.status]}>{e.status}</Badge>
                  {e.is_vendor_related && e.vendor_name && <Badge color="#2D6FAF">Vendor: {e.vendor_name}</Badge>}
                  {e.found_by && <span style={{ fontSize: 11, color: '#9ca3af' }}>Found by {e.found_by}</span>}
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>
                    {new Date(e.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <select value={e.status} onChange={ev => updateStatus(e.id, ev.target.value)} style={{ ...inp, width: 'auto', fontSize: 11, padding: '4px 8px' }}>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button onClick={() => removeEntry(e.id)} style={{ background: 'none', border: 'none', color: '#D6D2CA', cursor: 'pointer', fontSize: 16, padding: 0 }}>×</button>
                </div>
              </div>
              <div style={{ fontSize: 13, color: '#2C2C2C', marginBottom: 6 }}><strong>Issue:</strong> {e.issue}</div>
              <div style={{ fontSize: 13, color: '#2C2C2C' }}><strong>Fix:</strong> {e.fix}</div>
            </div>
          ))}
        </div>
      )}
    </PageWrap>
  )
}
