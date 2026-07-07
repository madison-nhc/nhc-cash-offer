import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { fmt } from './ui.jsx'

const PAID_BY_COLOR = { Bob: '#2D6FAF', Eric: '#D97825', BPV: '#B8892A' }

function StatCard({ topColor, label, value, sub, onClick }) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={()=>setHover(true)}
      onMouseLeave={()=>setHover(false)}
      style={{
        background:'#fff', borderRadius:8, padding:'12px 14px', cursor:'pointer',
        border: hover ? `1.5px solid ${topColor}` : '0.5px solid #D6D2CA',
        borderTop:`3px solid ${topColor}`,
        transition:'border-color 0.15s',
      }}
    >
      <div style={{ fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.8, marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:19, fontWeight:700, color:'#2C2C2C', fontFamily:'monospace', lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:'#6b7280', marginTop:6 }}>{sub}</div>}
    </div>
  )
}

export default function RehabStatCards({ propertyId, onOpenFull }) {
  const [items, setItems]       = useState([])
  const [supplies, setSupplies] = useState([])
  const [bills, setBills]       = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => { if (propertyId) load() }, [propertyId])

  async function load() {
    setLoading(true)
    const [i, s, b] = await Promise.all([
      supabase.from('cashoffer_rehab_items').select('status, estimated_cost, actual_cost, paid_by').eq('property_id', propertyId),
      supabase.from('cashoffer_supplies').select('status, unit_cost, quantity, paid_by').eq('property_id', propertyId),
      supabase.from('cashoffer_utility_bills').select('amount, paid_by').eq('property_id', propertyId),
    ])
    setItems(i.data || [])
    setSupplies(s.data || [])
    setBills(b.data || [])
    setLoading(false)
  }

  if (loading) return <div style={{ textAlign:'center', padding:20, color:'#9ca3af', fontSize:12 }}>Loading…</div>

  const hasAnything = items.length > 0 || supplies.length > 0 || bills.length > 0

  if (!hasAnything) {
    return (
      <div style={{ background:'#F0EDE6', borderRadius:8, padding:20, textAlign:'center' }}>
        <div style={{ fontSize:13, color:'#6b7280', marginBottom:12 }}>No rehab line items yet.</div>
        <button onClick={onOpenFull} style={{
          background:'#B8892A', color:'#fff', border:'none', borderRadius:8, padding:'10px 18px',
          fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit',
        }}>
          + Start Rehab Tracker
        </button>
      </div>
    )
  }

  const itemCost = r => r.actual_cost != null ? parseFloat(r.actual_cost)||0 : parseFloat(r.estimated_cost)||0
  const supplyCost = r => (parseFloat(r.unit_cost)||0) * (parseFloat(r.quantity)||0)

  const servicesTotal = items.reduce((s,r)=>s+itemCost(r), 0)
  const servicesDone  = items.filter(r=>r.status==='Completed').length

  const suppliesTotal = supplies.reduce((s,r)=>s+supplyCost(r), 0)
  const suppliesReceived = supplies.filter(r=>r.status==='Received').length

  const utilitiesTotal = bills.reduce((s,b)=>s+(parseFloat(b.amount)||0), 0)

  const paidByTotals = { Bob:0, Eric:0, BPV:0 }
  items.forEach(r => { if (paidByTotals[r.paid_by] !== undefined) paidByTotals[r.paid_by] += itemCost(r) })
  supplies.forEach(r => { if (paidByTotals[r.paid_by] !== undefined) paidByTotals[r.paid_by] += supplyCost(r) })
  bills.forEach(b => { if (paidByTotals[b.paid_by] !== undefined) paidByTotals[b.paid_by] += parseFloat(b.amount)||0 })

  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:10 }}>
      <StatCard
        topColor="#B8892A" label="Services" value={fmt(servicesTotal)}
        sub={`${servicesDone} of ${items.length} completed`}
        onClick={onOpenFull}
      />
      <StatCard
        topColor="#2D6FAF" label="Supplies" value={fmt(suppliesTotal)}
        sub={`${suppliesReceived} of ${supplies.length} received`}
        onClick={onOpenFull}
      />
      <StatCard
        topColor="#3B6D11" label="Utilities" value={fmt(utilitiesTotal)}
        sub={`${bills.length} bill${bills.length===1?'':'s'} logged`}
        onClick={onOpenFull}
      />
      <div
        onClick={onOpenFull}
        style={{ background:'#fff', borderRadius:8, padding:'12px 14px', cursor:'pointer', border:'0.5px solid #D6D2CA', borderTop:'3px solid #6b21a8', transition:'border-color 0.15s' }}
        onMouseEnter={e=>e.currentTarget.style.borderColor='#6b21a8'}
        onMouseLeave={e=>e.currentTarget.style.borderColor='#D6D2CA'}
      >
        <div style={{ fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.8, marginBottom:8 }}>Who's In</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:4 }}>
          {Object.entries(paidByTotals).map(([who, total]) => (
            <div key={who}>
              <div style={{ fontSize:10, fontWeight:700, color:PAID_BY_COLOR[who] }}>{who}</div>
              <div style={{ fontSize:12, fontWeight:700, color:'#2C2C2C', fontFamily:'monospace' }}>{fmt(total)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
