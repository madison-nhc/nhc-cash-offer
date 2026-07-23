import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

const GOLD = '#B8892A'
const CHARCOAL = '#2C2C2C'

export default function Business({ isAdmin }) {
  const [entities, setEntities] = useState([])
  const [members, setMembers] = useState([]) // all entity_members rows, joined client-side
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState(null)

  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('LLC')
  const [saving, setSaving] = useState(false)

  const load = () => {
    Promise.all([
      supabase.from('cashoffer_entities').select('*').order('name'),
      supabase.from('cashoffer_entity_members').select('*'),
      supabase.from('cashoffer_users').select('email,full_name,role').order('full_name'),
    ]).then(([e, m, u]) => {
      if (e.error) setError(e.error.message)
      setEntities(e.data || [])
      setMembers(m.data || [])
      setUsers(u.data || [])
      setLoading(false)
    })
  }
  useEffect(load, [])

  if (!isAdmin) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
        You don't have access to manage businesses. Ask an admin for access.
      </div>
    )
  }

  async function addEntity() {
    const name = newName.trim()
    if (!name) { setError('Enter a business name.'); return }
    setSaving(true)
    setError(null)
    const { data, error } = await supabase.from('cashoffer_entities')
      .insert({ name, entity_type: newType }).select().single()
    setSaving(false)
    if (error) { setError(error.message); return }
    setEntities(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    setNewName(''); setNewType('LLC')
  }

  async function removeEntity(id) {
    if (!confirm('Remove this business? Any properties owned by it will need a new owner assigned.')) return
    const { error } = await supabase.from('cashoffer_entities').delete().eq('id', id)
    if (error) { setError(error.message); return }
    setEntities(prev => prev.filter(e => e.id !== id))
    setMembers(prev => prev.filter(m => m.entity_id !== id))
  }

  async function addMember(entityId, email) {
    if (!email) return
    if (members.some(m => m.entity_id === entityId && m.user_email === email)) return
    const { data, error } = await supabase.from('cashoffer_entity_members')
      .insert({ entity_id: entityId, user_email: email }).select().single()
    if (error) { setError(error.message); return }
    setMembers(prev => [...prev, data])
  }

  async function removeMember(id) {
    const { error } = await supabase.from('cashoffer_entity_members').delete().eq('id', id)
    if (error) { setError(error.message); return }
    setMembers(prev => prev.filter(m => m.id !== id))
  }

  if (loading) return <div style={{ padding: 32, color: '#888' }}>Loading businesses...</div>

  const inputStyle = { padding: '8px 10px', border: '1px solid #D6D2CA', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', outline: 'none' }
  const nameFor = email => users.find(u => u.email === email)?.full_name || email

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: CHARCOAL, marginBottom: 4 }}>Business</h2>
      <p style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>
        Companies and LLCs (like BE Property Ventures) that can own properties. Add the people behind each one so ownership stays clear even when a property is held under an entity.
      </p>

      {error && (
        <div style={{ fontSize: 12, color: '#B22020', marginBottom: 16, padding: '10px 12px', background: '#FEF2F2', borderRadius: 6, border: '1px solid #FECACA' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        {entities.map(ent => {
          const entMembers = members.filter(m => m.entity_id === ent.id)
          const isOpen = expanded === ent.id
          const unaddedUsers = users.filter(u => !entMembers.some(m => m.user_email === u.email))
          return (
            <div key={ent.id} style={{ background: '#fff', border: '1px solid #E8E5DE', borderRadius: 10, overflow: 'hidden' }}>
              <div
                onClick={() => setExpanded(isOpen ? null : ent.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', cursor: 'pointer' }}
              >
                <span style={{ fontSize: 10, color: '#9ca3af', width: 10 }}>{isOpen ? '▼' : '▶'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: CHARCOAL, fontSize: 14 }}>{ent.name}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>
                    {ent.entity_type} · {entMembers.length} member{entMembers.length === 1 ? '' : 's'}
                  </div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); removeEntity(ent.id) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', fontSize: 16, lineHeight: 1 }}
                  title="Remove business"
                >×</button>
              </div>
              {isOpen && (
                <div style={{ borderTop: '1px solid #F0EDE6', padding: '10px 14px 14px', background: '#FAFAF8' }}>
                  {entMembers.length === 0 && <div style={{ fontSize: 12, color: '#bbb', marginBottom: 8 }}>No members yet.</div>}
                  {entMembers.map(m => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                      <span style={{ fontSize: 13, color: CHARCOAL, flex: 1 }}>{nameFor(m.user_email)}</span>
                      <button
                        onClick={() => removeMember(m.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', fontSize: 14, lineHeight: 1 }}
                      >×</button>
                    </div>
                  ))}
                  <div style={{ marginTop: 8 }}>
                    <select
                      value=""
                      onChange={e => addMember(ent.id, e.target.value)}
                      style={{ ...inputStyle, width: '100%' }}
                    >
                      <option value="">+ Add a member...</option>
                      {unaddedUsers.map(u => <option key={u.email} value={u.email}>{u.full_name || u.email}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {entities.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: '#bbb', background: '#fff', border: '1px solid #E8E5DE', borderRadius: 10 }}>
            No businesses yet.
          </div>
        )}
      </div>

      <div style={{ background: '#FAFAF8', border: '1px solid #E8DFC8', borderRadius: 10, padding: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Add a business</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Business name" style={{ ...inputStyle, flex: '2 1 200px' }} />
          <select value={newType} onChange={e => setNewType(e.target.value)} style={{ ...inputStyle, flex: '0 0 140px' }}>
            <option value="LLC">LLC</option>
            <option value="Corporation">Corporation</option>
            <option value="Partnership">Partnership</option>
            <option value="Other">Other</option>
          </select>
          <button
            onClick={addEntity}
            disabled={saving}
            style={{ background: GOLD, color: '#fff', border: 'none', borderRadius: 6, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit' }}
          >
            {saving ? 'Adding...' : '+ Add'}
          </button>
        </div>
      </div>
    </div>
  )
}
