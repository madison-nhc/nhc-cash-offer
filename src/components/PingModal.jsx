import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { Modal, Btn, Field, inp } from './ui.jsx'

// Generic "ping" composer — send a quick message to any teammate about a
// property, not just the assigned agent. Writes to cashoffer_notifications
// (same table the bell in the header already polls), so it shows up there
// immediately with no extra plumbing needed.
export default function PingModal({ propertyId, propertyAddress, senderEmail, agentList=[], onClose, onSent }) {
  const [recipient, setRecipient] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)

  async function send() {
    if (!recipient || !message.trim()) return
    setSending(true)
    setError(null)
    const { error } = await supabase.from('cashoffer_notifications').insert({
      property_id: propertyId,
      recipient_email: recipient,
      sender_email: senderEmail || null,
      message: message.trim(),
    })
    setSending(false)
    if (error) { setError(error.message); return }
    onSent && onSent()
    onClose()
  }

  return (
    <Modal title={`Ping — ${propertyAddress || 'Property'}`} onClose={onClose} width={440} footer={
      <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
        <Btn variant="outline" onClick={onClose}>Cancel</Btn>
        <Btn onClick={send} disabled={sending || !recipient || !message.trim()}>{sending ? 'Sending...' : 'Send Ping'}</Btn>
      </div>
    }>
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        <Field label="To">
          <select style={inp} value={recipient} onChange={e=>setRecipient(e.target.value)}>
            <option value="">— Select teammate —</option>
            {agentList.map(a => <option key={a.email} value={a.email}>{a.full_name || a.email}</option>)}
          </select>
        </Field>
        <Field label="Message">
          <textarea
            style={{ ...inp, minHeight:80, resize:'vertical' }}
            placeholder="What do you need from them?"
            value={message}
            onChange={e=>setMessage(e.target.value)}
          />
        </Field>
        {error && <div style={{ fontSize:12, color:'#B91C1C' }}>{error}</div>}
      </div>
    </Modal>
  )
}
