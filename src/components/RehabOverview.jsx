import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { fmt, calcOwed } from './ui.jsx'

const PAID_BY_COLOR = { Bob: '#2D6FAF', Eric: '#D97825', BPV: '#B8892A' }

function StatCard({ topColor, label, value, sub }) {
  return (
    <div
      style={{
        background:'#fff', borderRadius:8, padding:'12px 14px',
        border:'0.5px solid #D6D2CA',
        borderTop:`3px solid ${topColor}`,
      }}
    >
      <div style={{ fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.8, marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:19, fontWeight:700, color:'#2C2C2C', fontFamily:'monospace', lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:'#6b7280', marginTop:6 }}>{sub}</div>}
    </div>
  )
}

export default function RehabStatCards({ propertyId, onOpenFull, closingDate }) {
  const [items, setItems]       = useState([])
  const [supplies, setSupplies] = useState([])
  const [bills, setBills]       = useState([])
  const [repayments, setRepayments] = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => { if (propertyId) load() }, [propertyId])

  async function load() {
    setLoading(true)
    const [i, s, b] = await Promise.all([
      supabase.from('cashoffer_rehab_items').select('id, status, estimated_cost, actual_cost, paid_by, date_paid').eq('property_id', propertyId),
      supabase.from('cashoffer_supplies').select('id, status, unit_cost, quantity, paid_by, date_paid').eq('property_id', propertyId),
      supabase.from('cashoffer_utility_bills').select('id, amount, paid_by, date_paid').eq('property_id', propertyId),
    ])
    setItems(i.data || [])
    setSupplies(s.data || [])
    setBills(b.data || [])

    const ids = [
      ...(i.data||[]).map(r=>r.id),
      ...(s.data||[]).map(r=>r.id),
      ...(b.data||[]).map(r=>r.id),
    ]
    if (ids.length) {
      const { data: rp } = await supabase.from('cashoffer_partner_repayments').select('*').in('source_id', ids)
      setRepayments(rp || [])
    } else {
      setRepayments([])
    }
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

  // Principal per person — starts with BPV + known partners, but any other paid_by
  // value that shows up in the data (e.g. a new investor) gets its own card too.
  // Interest is tracked in the dedicated Partner Ledger (Disposition tab), not here.
  const paidByPrincipal = { BPV:0, Bob:0, Eric:0 }
  function addRow(who, amount) {
    if (!who) return
    if (paidByPrincipal[who] === undefined) paidByPrincipal[who] = 0
    paidByPrincipal[who] += amount
  }
  items.forEach(r => addRow(r.paid_by, itemCost(r)))
  supplies.forEach(r => addRow(r.paid_by, supplyCost(r)))
  bills.forEach(r => addRow(r.paid_by, parseFloat(r.amount)||0))

  const totalRehabCost = servicesTotal + suppliesTotal + utilitiesTotal

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      <div style={{
        background:'#B8892A12', border:'1px solid #B8892A30', borderRadius:8,
        padding:'12px 14px', display:'flex', justifyContent:'space-between', alignItems:'center',
      }}>
        <div style={{ fontSize:11, fontWeight:700, color:'#B8892A', textTransform:'uppercase', letterSpacing:0.8 }}>Total Rehab Cost</div>
        <div style={{ fontSize:20, fontWeight:700, color:'#B8892A', fontFamily:'monospace' }}>{fmt(totalRehabCost)}</div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:10 }}>
        <StatCard
          topColor="#B8892A" label="Services" value={fmt(servicesTotal)}
          sub={`${servicesDone} of ${items.length} completed`}
        />
        <StatCard
          topColor="#2D6FAF" label="Supplies" value={fmt(suppliesTotal)}
          sub={`${suppliesReceived} of ${supplies.length} received`}
        />
        <StatCard
          topColor="#3B6D11" label="Utilities" value={fmt(utilitiesTotal)}
          sub={`${bills.length} bill${bills.length===1?'':'s'} logged`}
        />
      </div>

      <div style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.8, marginTop:2 }}>Who's In</div>
      {(() => {
        const others = Object.keys(paidByPrincipal).filter(who => who !== 'BPV')
        const PersonCard = (who) => (
          <div
            key={who}
            style={{ background:'#fff', borderRadius:8, padding:'12px 14px', border:'0.5px solid #D6D2CA', borderTop:`3px solid ${PAID_BY_COLOR[who]||'#9ca3af'}` }}
          >
            <div style={{ fontSize:10, fontWeight:700, color:PAID_BY_COLOR[who]||'#9ca3af', textTransform:'uppercase', letterSpacing:0.6, marginBottom:6 }}>{who}</div>
            <div style={{ fontSize:9, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.5 }}>Amount</div>
            <div style={{ fontSize:16, fontWeight:700, color:'#2C2C2C', fontFamily:'monospace' }}>{fmt(paidByPrincipal[who])}</div>
          </div>
        )
        return (
          <>
            {PersonCard('BPV')}
            <div style={{ display:'grid', gridTemplateColumns:`repeat(${others.length}, 1fr)`, gap:10 }}>
              {others.map(who => PersonCard(who))}
            </div>
          </>
        )
      })()}

      <button onClick={onOpenFull} style={{
        background:'#B8892A', color:'#fff', border:'none', borderRadius:8, padding:'10px 14px',
        fontSize:12.5, fontWeight:700, cursor:'pointer', fontFamily:'inherit',
        display:'flex', alignItems:'center', justifyContent:'center', gap:6, marginTop:2,
      }}>
        Open Rehab Dashboard <span>→</span>
      </button>
    </div>
  )
}

