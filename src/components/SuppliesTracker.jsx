import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase.js'
import { Modal, Field, FieldRow, inp, monoInp, Btn, fmt } from './ui.jsx'

const STATUS_OPTIONS = ['Ordered','Received']
const STATUS_COLORS  = { Ordered:'#D97825', Received:'#3B6D11' }
const PAID_BY_OPTIONS = ['BPV', 'Bob', 'Eric', 'Blaire', 'Other']

export default function SuppliesTracker({ propertyId, propertyAddress, open, onClose }) {
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)
  const [vendors, setVendors] = useState([])
  const [activeVendorId, setActiveVendorId] = useState(null)
  const vendorRefs = useRef({})

  useEffect(() => { if (open && propertyId) { load(); loadVendors() } }, [open, propertyId])

  async function loadVendors() {
    const { data } = await supabase
      .from('cashoffer_vendors')
      .select('company_name')
      .not('company_name', 'is', null)
      .neq('company_name', '')
    const unique = [...new Set((data || []).map(r => r.company_name).filter(Boolean))].sort()
    setVendors(unique)
  }

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
    const payload = { property_id: propertyId, name:'', unit_cost:0, quantity:1, vendor:'', status:'Ordered', paid_by:null }
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
  const paidByTotals = {}
  for (const it of items) {
    if (!it.paid_by) continue
    paidByTotals[it.paid_by] = (paidByTotals[it.paid_by] || 0) + ((parseFloat(it.unit_cost)||0) * (parseFloat(it.quantity)||0))
  }

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
        <table style={{ width:'100%', borderCollapse:'collapse', tableLayout:'fixed' }}>
          <colgroup>
            <col style={{ width:'24%' }} />
            <col style={{ width:'8%' }} />
            <col style={{ width:'14%' }} />
            <col style={{ width:'12%' }} />
            <col style={{ width:'18%' }} />
            <col style={{ width:'12%' }} />
            <col style={{ width:'12%' }} />
            <col style={{ width:'24px' }} />
          </colgroup>
          <thead>
            <tr>
              {['Name','Qty','Unit Cost','Total','Vendor/Store','Status','Paid By',''].map((h,i)=>(
                <th key={h} style={{ textAlign:i>0&&i<7?'right':'left', fontSize:10, color:'#9ca3af', fontWeight:600, textTransform:'uppercase', letterSpacing:0.5, paddingBottom:6, paddingRight:i>0&&i<7?10:0 }}>{h}</th>
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
                  <div style={{ position:'relative' }}>
                    <input
                      ref={el => vendorRefs.current[it.id] = el}
                      style={{ ...inp, fontSize:12 }}
                      autoComplete="off" name={`vendor-${it.id}`}
                      value={it.vendor||''}
                      onChange={e=>{ updateItem(it.id,'vendor',e.target.value); setActiveVendorId(it.id) }}
                      onFocus={()=>setActiveVendorId(it.id)}
                      onBlur={()=>setTimeout(()=>setActiveVendorId(null),150)}
                    />
                    {activeVendorId===it.id && vendors.filter(v =>
                      v.toLowerCase().includes((it.vendor||'').toLowerCase()) && v !== it.vendor
                    ).length > 0 && (
                      <div style={{
                        position:'absolute', top:'100%', left:0, minWidth:180, zIndex:50,
                        background:'#fff', border:'0.5px solid #D6D2CA', borderRadius:4,
                        boxShadow:'0 4px 12px rgba(0,0,0,0.1)', maxHeight:140, overflowY:'auto',
                      }}>
                        {vendors.filter(v =>
                          v.toLowerCase().includes((it.vendor||'').toLowerCase()) && v !== it.vendor
                        ).map(v => (
                          <div key={v}
                            onMouseDown={()=>{ updateItem(it.id,'vendor',v); setActiveVendorId(null) }}
                            style={{ padding:'7px 10px', fontSize:12, cursor:'pointer', borderBottom:'0.5px solid #F0EDE6', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}
                            onMouseEnter={e=>e.currentTarget.style.background='#FAFAF8'}
                            onMouseLeave={e=>e.currentTarget.style.background='#fff'}
                          >{v}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </td>
                <td style={{ paddingBottom:6, paddingRight:6 }}>
                  <select style={{ ...inp, fontSize:11, color:STATUS_COLORS[it.status], fontWeight:700 }} value={it.status||'Ordered'} onChange={e=>updateItem(it.id,'status',e.target.value)}>
                    {STATUS_OPTIONS.map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td style={{ paddingBottom:6, paddingRight:6 }}>
                  <select style={{ ...inp, fontSize:11 }} value={it.paid_by||''} onChange={e=>updateItem(it.id,'paid_by',e.target.value||null)}>
                    <option value="">—</option>
                    {PAID_BY_OPTIONS.map(p=><option key={p} value={p}>{p}</option>)}
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

        {Object.keys(paidByTotals).length > 0 && (
          <div style={{ background:'#FAFAF8', border:'0.5px solid #D6D2CA', borderRadius:8, padding:'12px 16px', marginTop:14 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:0.8, marginBottom:8 }}>
              Who Fronted The Money
            </div>
            <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
              {Object.entries(paidByTotals).map(([who, t]) => (
                <div key={who}>
                  <div style={{ fontSize:10, color:'#9ca3af' }}>{who}</div>
                  <div style={{ fontSize:14, fontWeight:700, fontFamily:'monospace', color:'#2C2C2C' }}>{fmt(t)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </>)}
    </Modal>
  )
}
