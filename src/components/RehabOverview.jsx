import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { fmt } from './ui.jsx'

export default function RehabOverview({ propertyId, onOpenFull }) {
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)
  const [hover, setHover]     = useState(false)

  useEffect(() => { if (propertyId) load() }, [propertyId])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('cashoffer_rehab_items')
      .select('status, estimated_cost, actual_cost')
      .eq('property_id', propertyId)
    setItems(data || [])
    setLoading(false)
  }

  if (loading) return <div style={{ textAlign:'center', padding:20, color:'#9ca3af', fontSize:12 }}>Loading…</div>

  if (items.length === 0) {
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

  const total = items.reduce((s, r) => {
    const v = r.actual_cost !== null && r.actual_cost !== undefined ? parseFloat(r.actual_cost) || 0 : parseFloat(r.estimated_cost) || 0
    return s + v
  }, 0)
  const completed = items.filter(r => r.status === 'Completed').length

  return (
    <div
      onClick={onOpenFull}
      onMouseEnter={()=>setHover(true)}
      onMouseLeave={()=>setHover(false)}
      style={{
        background:'#FAFAF8',
        border: hover ? '1.5px solid #B8892A' : '0.5px solid #D6D2CA',
        borderRadius:8, padding:'14px 16px', cursor:'pointer',
        transition:'border-color 0.15s',
      }}
    >
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
        <div style={{ fontSize:14, fontWeight:700, color:'#2C2C2C' }}>Rehab Line Items</div>
        <span style={{ fontSize:16, color:'#B8892A' }}>→</span>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        <div>
          <div style={{ fontSize:9, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.7, marginBottom:2 }}>Total Cost</div>
          <div style={{ fontSize:13, fontWeight:600, color:'#2C2C2C', fontFamily:'monospace' }}>{fmt(total)}</div>
        </div>
        <div>
          <div style={{ fontSize:9, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.7, marginBottom:2 }}>Progress</div>
          <div style={{ fontSize:13, fontWeight:600, color:'#2C2C2C', fontFamily:'monospace' }}>{completed} of {items.length} done</div>
        </div>
      </div>
      <div style={{ fontSize:11, color:'#9ca3af', marginTop:10, textAlign:'right' }}>
        Click for line items, paid-by breakdown & utility bills
      </div>
    </div>
  )
}

