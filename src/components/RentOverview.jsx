import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { Field, FieldRow, inp, monoInp, Btn } from './ui.jsx'

const STATUS_OPTIONS = ['Active','Expired','Vacated','Month-to-Month']

export default function RentOverview({ propertyId, onOpenFull }) {
  const [lease, setLease]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (propertyId) load() }, [propertyId])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('cashoffer_leases')
      .select('*')
      .eq('property_id', propertyId)
      .order('lease_start', { ascending: false })
      .limit(5)
    const active = (data||[]).find(l=>l.status==='Active') || data?.[0] || null
    setLease(active)
    setLoading(false)
  }

  async function update(field, value) {
    if (!lease) return
    setLease(l => ({ ...l, [field]: value }))
    await supabase.from('cashoffer_leases').update({ [field]: value }).eq('id', lease.id)
  }

  async function addLease() {
    const payload = { property_id: propertyId, unit_label: 'Main', tenant_name: '', rent_amount: 0, lease_start: new Date().toISOString().split('T')[0], status: 'Active' }
    const { data } = await supabase.from('cashoffer_leases').insert(payload).select().single()
    setLease(data)
  }

  if (loading) return <div style={{ textAlign:'center', padding:20, color:'#9ca3af', fontSize:12 }}>Loading…</div>

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      {!lease ? (
        <div style={{ background:'#F0EDE6', borderRadius:8, padding:20, textAlign:'center' }}>
          <div style={{ fontSize:13, color:'#6b7280', marginBottom:8 }}>No lease recorded for this property.</div>
          <Btn onClick={addLease}>+ Add Lease</Btn>
        </div>
      ) : (<>
        <FieldRow>
          <Field label="Tenant">
            <input style={inp} value={lease.tenant_name||''} onChange={e=>update('tenant_name', e.target.value)} />
          </Field>
          <Field label="Rent Amount ($)">
            <input style={monoInp} type="number" value={lease.rent_amount||''} onChange={e=>update('rent_amount', parseFloat(e.target.value)||0)} />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="Lease Start">
            <input style={inp} type="date" value={lease.lease_start||''} onChange={e=>update('lease_start', e.target.value)} />
          </Field>
          <Field label="Lease End">
            <input style={inp} type="date" value={lease.lease_end||''} onChange={e=>update('lease_end', e.target.value)} />
          </Field>
        </FieldRow>
        <Field label="Status">
          <select style={inp} value={lease.status||'Active'} onChange={e=>update('status', e.target.value)}>
            {STATUS_OPTIONS.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <button onClick={onOpenFull} style={{
          width:'100%', background:'#fff', border:'1.5px solid #3B6D11', borderRadius:8, padding:'12px 16px',
          cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:4,
        }}>
          <div style={{ textAlign:'left' }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#3B6D11' }}>View Full Rent & Leases</div>
            <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>Lease terms, monthly payment log, collected vs expected</div>
          </div>
          <span style={{ fontSize:18, color:'#3B6D11' }}>→</span>
        </button>
      </>)}
    </div>
  )
}
