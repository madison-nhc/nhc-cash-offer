import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { Modal, Field, FieldRow, inp, monoInp, Btn, fmt } from './ui.jsx'

const STATUS_OPTIONS = ['Ordered','Received']
const STATUS_COLORS  = { Ordered:'#D97825', Received:'#3B6D11' }

export default function SuppliesTracker({ propertyId, propertyAddress, open, onClose }) {
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (open && propertyId) load() }, [open, propertyId])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('cashoffer_supplies')
      .select('*')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: true })
    setItems(data || [])
    setLoading(false)
  }

  async function addItem() {
    const payload = { property_id: propertyId, name:'', unit_cost:0, quantity:1, vendor:'', status:'Ordered' }
    const { data } = await supabase.from('cashoffer_supplies').insert(payload).select().single()
    setItems(i => [...i, data])
  }

  async function updateItem(id, field, value) {
    setItems(items => items.map(it => it.id===id ? { ...it, [field]: value } : it))
    await supabase.from('cashoffer_supplies').update({ [field]: value }).eq('id', id)
  }

  async function removeItem(id) {
    setItems(items => items.filter(it => it.id !== id))
    await supabase.from('cashoffer_supplies').delete().eq('id', id)
  }

  if (!open) return null

  const total = items.reduce((s,i) => s + ((parseFloat(i.unit_cost)||0) * (parseFloat(i.quantity)||0)), 0)

  return (
    <Modal title={`Supplies — ${propertyAddress?.split(',')[0] || ''}`} onClose={onClose} width={760}>
      {loading ? (
        <div style={{ textAlign:'center', padding:32, color:'#B8892A', fontSize:24 }}>⟳</div>
      ) : (<>
        <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:12 }}>
          <div style={{ background:'#FAFAF8', borderRadius:6, padding:'6px 14px', border:'0.5px solid #D6D2CA', fontSize:12, fontWeight:700, color:'#2C2C2C' }}>
            Total: <span style={{ fontFamily:'monospace' }}>{fmt(total)}</span>
          </div>
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <colgroup>
            <col style={{ width:'28%' }} />
            <col style={{ width:'10%' }} />
            <col style={{ width:'16%' }} />
            <col style={{ width:'14%' }} />
            <col style={{ width:'20%' }} />
            <col style={{ width:'14%' }} />
            <col style={{ width:'24px' }} />
          </colgroup>
          <thead>
            <tr>
              {['Name','Qty','Unit Cost','Total','Vendor/Store','Status',''].map((h,i)=>(
                <th key={h} style={{ textAlign:i>0&&i<6?'right':'left', fontSize:10, color:'#9ca3af', fontWeight:600, textTransform:'uppercase', letterSpacing:0.5, paddingBottom:6, paddingRight:i>0&&i<6?10:0 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map(it => (
              <tr key={it.id}>
                <td style={{ paddingBottom:6, paddingRight:6 }}>
                  <input style={{ ...inp, fontSize:12 }} value={it.name||''} onChange={e=>updateItem(it.id,'name',e.target.value)} />
                </td>
                <td style={{ paddingBottom:6, paddingRight:6 }}>
                  <input style={{ ...monoInp, fontSize:12, textAlign:'right' }} type="number" value={it.quantity||''} onChange={e=>updateItem(it.id,'quantity',parseFloat(e.target.value)||0)} />
                </td>
                <td style={{ paddingBottom:6, paddingRight:6 }}>
                  <input style={{ ...monoInp, fontSize:12, textAlign:'right' }} type="number" value={it.unit_cost||''} onChange={e=>updateItem(it.id,'unit_cost',parseFloat(e.target.value)||0)} />
                </td>
                <td style={{ paddingBottom:6, paddingRight:6, textAlign:'right', fontFamily:'monospace', fontSize:12, fontWeight:600 }}>
                  {fmt((parseFloat(it.unit_cost)||0)*(parseFloat(it.quantity)||0))}
                </td>
                <td style={{ paddingBottom:6, paddingRight:6 }}>
                  <input style={{ ...inp, fontSize:12 }} autoComplete="off" name={`vendor-${it.id}`} value={it.vendor||''} onChange={e=>updateItem(it.id,'vendor',e.target.value)} />
                </td>
                <td style={{ paddingBottom:6, paddingRight:6 }}>
                  <select style={{ ...inp, fontSize:11, color:STATUS_COLORS[it.status], fontWeight:700 }} value={it.status||'Ordered'} onChange={e=>updateItem(it.id,'status',e.target.value)}>
                    {STATUS_OPTIONS.map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td style={{ paddingBottom:6, textAlign:'center' }}>
                  <button onClick={()=>removeItem(it.id)} style={{ background:'none', border:'none', color:'#D6D2CA', cursor:'pointer', fontSize:16, padding:0 }}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={addItem} style={{ background:'transparent', border:'1px dashed #D6D2CA', borderRadius:6, padding:'6px', color:'#9ca3af', fontSize:12, cursor:'pointer', fontFamily:'inherit', width:'100%', marginTop:8 }}>
          + Add Supply Item
        </button>
      </>)}
    </Modal>
  )
}
