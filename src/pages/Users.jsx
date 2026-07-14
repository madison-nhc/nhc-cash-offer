import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

const GOLD = '#B8892A'
const CHARCOAL = '#2C2C2C'
const GREEN = '#3B6D11'
const RED = '#B22020'

export default function Users({ isAdmin, userEmail }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [newEmail, setNewEmail] = useState('')
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState('viewer')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const load = () => {
    supabase.from('cashoffer_users').select('*').order('created_at')
      .then(({ data, error }) => {
        if (error) setError(error.message)
        setUsers(data || [])
        setLoading(false)
      })
  }
  useEffect(load, [])

  if (!isAdmin) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
        You don't have access to manage users. Ask an admin for access.
      </div>
    )
  }

  async function addUser() {
    const email = newEmail.trim().toLowerCase()
    if (!email) { setError('Enter an email address.'); return }
    setSaving(true)
    setError(null)
    const { data, error } = await supabase.from('cashoffer_users')
      .insert({ email, full_name: newName.trim() || null, role: newRole })
      .select().single()
    setSaving(false)
    if (error) { setError(error.message); return }
    setUsers(prev => [...prev, data])
    setNewEmail(''); setNewName(''); setNewRole('viewer')
  }

  async function updateRole(email, role) {
    setUsers(prev => prev.map(u => u.email === email ? { ...u, role } : u))
    const { error } = await supabase.from('cashoffer_users').update({ role }).eq('email', email)
    if (error) setError(error.message)
  }

  async function removeUser(email) {
    if (email === userEmail) { alert("You can't remove your own access."); return }
    if (!confirm(`Remove ${email}'s access to Cash Offer Hub?`)) return
    const { error } = await supabase.from('cashoffer_users').delete().eq('email', email)
    if (error) { setError(error.message); return }
    setUsers(prev => prev.filter(u => u.email !== email))
  }

  if (loading) return <div style={{ padding: 32, color: '#888' }}>Loading users...</div>

  const inputStyle = { padding: '8px 10px', border: '1px solid #D6D2CA', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', outline: 'none' }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: CHARCOAL, marginBottom: 4 }}>Users</h2>
      <p style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>
        Only people listed here can sign into Cash Offer Hub. Admins can edit everything; Agents only see and edit their own assigned deals; Viewers can only look.
      </p>

      {error && (
        <div style={{ fontSize: 12, color: RED, marginBottom: 16, padding: '10px 12px', background: '#FEF2F2', borderRadius: 6, border: '1px solid #FECACA' }}>
          {error}
        </div>
      )}

      <div style={{ background: '#fff', border: '1px solid #E8E5DE', borderRadius: 10, overflow: 'hidden', marginBottom: 24 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#FAFAF8', borderBottom: '1px solid #E8E5DE' }}>
              <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>Name</th>
              <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>Email</th>
              <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>Role</th>
              <th style={{ padding: '10px 14px' }}></th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.email} style={{ borderBottom: '1px solid #F0EDE6' }}>
                <td style={{ padding: '10px 14px', color: CHARCOAL, fontWeight: 600 }}>{u.full_name || '—'}</td>
                <td style={{ padding: '10px 14px', color: '#555' }}>
                  {u.email}
                  {u.email === userEmail && <span style={{ marginLeft: 6, fontSize: 10, color: GOLD, fontWeight: 700 }}>(you)</span>}
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <select
                    value={u.role}
                    onChange={e => updateRole(u.email, e.target.value)}
                    style={{
                      fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
                      color: u.role === 'admin' ? GREEN : u.role === 'agent' ? '#2D6FAF' : '#6b7280',
                      background: u.role === 'admin' ? '#EAF2EA' : u.role === 'agent' ? '#E8F0FA' : '#F0EDE6',
                      border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    <option value="admin">Admin</option>
                    <option value="agent">Agent</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                  <button
                    onClick={() => removeUser(u.email)}
                    disabled={u.email === userEmail}
                    style={{
                      background: 'none', border: 'none', cursor: u.email === userEmail ? 'default' : 'pointer',
                      color: u.email === userEmail ? '#ddd' : '#ccc', fontSize: 16, lineHeight: 1,
                    }}
                    title="Remove access"
                  >×</button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={4} style={{ padding: '20px 14px', textAlign: 'center', color: '#bbb' }}>No users yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ background: '#FAFAF8', border: '1px solid #E8DFC8', borderRadius: 10, padding: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Add a user</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="email@example.com" style={{ ...inputStyle, flex: '2 1 200px' }} />
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Full name (optional)" style={{ ...inputStyle, flex: '1 1 160px' }} />
          <select value={newRole} onChange={e => setNewRole(e.target.value)} style={{ ...inputStyle, flex: '0 0 120px' }}>
            <option value="viewer">Viewer</option>
            <option value="agent">Agent</option>
            <option value="admin">Admin</option>
          </select>
          <button
            onClick={addUser}
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
