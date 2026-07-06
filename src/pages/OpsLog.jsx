import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { PageWrap, SectionBar, EmptyState, Field, FieldRow, inp, Btn, Badge, LoadingSpinner } from '../components/ui.jsx'

const FOUND_BY_OPTIONS = ['Bob', 'Eric', 'Blaire', 'Madison']
const COLUMNS = ['Idea', 'Working On', 'Implemented']
const COLUMN_COLOR = { Idea: '#B91C1C', 'Working On': '#D97825', Implemented: '#3B6D11' }

const EMPTY_FORM = { issue: '', fix: '', found_by: '', is_vendor_related: false, vendor_name: '' }

function Card({ entry, onAdvance, onRetreat, onDelete }) {
  const colIdx = COLUMNS.indexOf(entry.status)
  return (
    <div style={{ background: '#fff', border: '0.5px solid #D6D2CA', borderRadius: 8, padding: '12px 14px', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {entry.is_vendor_related && entry.vendor_name && <Badge color="#2D6FAF">{entry.vendor_name}</Badge>}
        {entry.found_by && <span style={{ fontSize: 10, color: '#9ca3af' }}>{entry.found_by}</span>}
        <span style={{ fontSize: 10, color: '#9ca3af' }}>
          {new Date(entry.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      </div>
      <div style={{ fontSize: 12, color: '#2C2C2C', marginBottom: 6 }}><strong>Issue:</strong> {entry.issue}</div>
      <div style={{ fontSize: 12, color: '#2C2C2C', marginBottom: 10 }}><strong>Fix:</strong> {entry.fix}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {colIdx > 0 && (
            <button onClick={() => onRetreat(entry)} style={{ background: '#F0EDE6', border: 'none', borderRadius: 6, padding: '4px 9px', fontSize: 11, cursor: 'pointer', color: '#6b7280', fontFamily: 'inherit' }}>
              ← {COLUMNS[colIdx - 1]}
            </button>
          )}
          {colIdx < COLUMNS.length - 1 && (
            <button onClick={() => onAdvance(entry)} style={{ background: COLUMN_COLOR[COLUMNS[colIdx + 1]] + '18', color: COLUMN_COLOR[COLUMNS[colIdx + 1]], border: `1px solid ${COLUMN_COLOR[COLUMNS[colIdx + 1]]}40`, borderRadius: 6, padding: '4px 9px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              {COLUMNS[colIdx + 1]} →
            </button>
          )}
        </div>
        <button onClick={() => onDelete(entry.id)} style={{ background: 'none', border: 'none', color: '#D6D2CA', cursor: 'pointer', fontSize: 15, padding: 0 }}>×</button>
      </div>
    </div>
  )
}

export default function OpsLog() {
  const [entries, setEntries]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [form, setForm]         = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [confirmMsg, setConfirmMsg] = useState(false)
  const [formOpen, setFormOpen] = useState(false)

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
      status: 'Idea',
    }
    const { error } = await supabase.from('cashoffer_ops_log').insert(payload)
    setSubmitting(false)
    if (error) {
      alert('Could not log this: ' + error.message)
      return
    }
    setForm(EMPTY_FORM)
    setFormOpen(false)
    setConfirmMsg(true)
    setTimeout(() => setConfirmMsg(false), 3000)
    load()
  }

  async function setStatus(entry, status) {
    setEntries(e => e.map(x => x.id === entry.id ? { ...x, status } : x))
    await supabase.from('cashoffer_ops_log').update({ status }).eq('id', entry.id)
  }
  const advance = entry => setStatus(entry, COLUMNS[COLUMNS.indexOf(entry.status) + 1])
  const retreat = entry => setStatus(entry, COLUMNS[COLUMNS.indexOf(entry.status) - 1])

  async function removeEntry(id) {
    if (!confirm('Delete this entry?')) return
    setEntries(e => e.filter(x => x.id !== id))
    await supabase.from('cashoffer_ops_log').delete().eq('id', id)
  }

  const isVendorYes = form.is_vendor_related === true || form.is_vendor_related === 'true'

  if (loading) return <PageWrap><LoadingSpinner /></PageWrap>

  return (
    <PageWrap>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#2C2C2C' }}>Things We Could Do Better</div>
          <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>Track the gaps we find running this thing day to day. Fix them before they cost us again.</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {confirmMsg && <span style={{ fontSize: 12, color: '#3B6D11', fontWeight: 700 }}>Logged. On the review list.</span>}
          <Btn onClick={() => setFormOpen(o => !o)}>{formOpen ? 'Cancel' : '+ Log an Issue'}</Btn>
        </div>
      </div>

      {/* ── Submission form ── */}
      {formOpen && (
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
                  value={isVendorYes ? 'true' : 'false'}
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
            <div>
              <Btn onClick={submit} disabled={submitting}>{submitting ? 'Logging…' : 'Log it'}</Btn>
            </div>
          </div>
        </div>
      )}

      {/* ── Board ── */}
      <div style={{ display: 'grid', gridTemplateColumns: (typeof window !== 'undefined' && window.innerWidth < 768) ? '1fr' : 'repeat(3, 1fr)', gap: 16 }}>
        {COLUMNS.map(col => {
          const colEntries = entries.filter(e => e.status === col)
          return (
            <div key={col}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLUMN_COLOR[col] }} />
                <div style={{ fontSize: 13, fontWeight: 700, color: '#2C2C2C', textTransform: 'uppercase', letterSpacing: 0.5 }}>{col}</div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>({colEntries.length})</div>
              </div>
              <div style={{ background: '#FAFAF8', borderRadius: 8, padding: 10, minHeight: 80 }}>
                {colEntries.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 12, color: '#9ca3af' }}>Nothing here</div>
                ) : (
                  colEntries.map(entry => (
                    <Card key={entry.id} entry={entry} onAdvance={advance} onRetreat={retreat} onDelete={removeEntry} />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </PageWrap>
  )
}
