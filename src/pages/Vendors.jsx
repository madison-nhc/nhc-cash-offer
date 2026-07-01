import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { PageWrap, SectionBar, EmptyState, inp, LoadingSpinner } from '../components/ui.jsx'

export default function Vendors() {
  const [vendors, setVendors] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('cashoffer_vendors')
      .select('*')
      .order('company_name', { ascending: true })
    setVendors(data || [])
    setLoading(false)
  }

  async function addVendor() {
    const { data } = await supabase.from('cashoffer_vendors').insert({ company_name: '' }).select().single()
    setVendors(v => [data, ...v])
  }

  async function updateVendor(id, field, value) {
    setVendors(v => v.map(x => x.id===id ? { ...x, [field]: value } : x))
    await supabase.from('cashoffer_vendors').update({ [field]: value }).eq('id', id)
  }

  async function removeVendor(id) {
    if (!confirm('Delete this vendor?')) return
    setVendors(v => v.filter(x => x.id !== id))
    await supabase.from('cashoffer_vendors').delete().eq('id', id)
  }

  if (loading) return <PageWrap><LoadingSpinner /></PageWrap>

  return (
    <PageWrap>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:700, color:'#2C2C2C' }}>Vendors</div>
          <div style={{ fontSize:13, color:'#9ca3af', marginTop:2 }}>Master vendor list — source for Rehab and Supplies autocomplete</div>
        </div>
        <button onClick={addVendor} style={{
          background:'#B8892A', color:'#fff', border:'none', borderRadius:6, padding:'8px 16px',
          cursor:'pointer', fontSize:12, fontWeight:700, fontFamily:'inherit', whiteSpace:'nowrap',
        }}>+ Add Vendor</button>
      </div>

      <SectionBar>Vendors ({vendors.length})</SectionBar>
      {vendors.length===0 ? (
        <EmptyState icon="○" text="No vendors added yet. Click + Add Vendor to get started." />
      ) : (
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <colgroup>
            <col style={{ width:'20%' }} /><col style={{ width:'14%' }} /><col style={{ width:'16%' }} />
            <col style={{ width:'14%' }} /><col style={{ width:'16%' }} /><col style={{ width:'18%' }} /><col style={{ width:'24px' }} />
          </colgroup>
          <thead>
            <tr>
              {['Company Name','Service','Contact Person','Phone','Email','Notes',''].map(h=>(
                <th key={h} style={{ textAlign:'left', fontSize:10, color:'#9ca3af', fontWeight:600, textTransform:'uppercase', letterSpacing:0.5, padding:'8px 10px 8px 0' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vendors.map((v,i) => (
              <tr key={v.id} style={{ background: i%2===1?'#FAFAF8':'#fff', borderBottom:'0.5px solid #F0EDE6' }}>
                <td style={{ padding:'6px 10px 6px 0' }}>
                  <input style={{ ...inp, fontSize:12 }} value={v.company_name||''} onChange={e=>updateVendor(v.id,'company_name',e.target.value)} />
                </td>
                <td style={{ padding:'6px 10px 6px 0' }}>
                  <input style={{ ...inp, fontSize:12 }} value={v.service||''} onChange={e=>updateVendor(v.id,'service',e.target.value)} />
                </td>
                <td style={{ padding:'6px 10px 6px 0' }}>
                  <input style={{ ...inp, fontSize:12 }} value={v.contact_person||''} onChange={e=>updateVendor(v.id,'contact_person',e.target.value)} />
                </td>
                <td style={{ padding:'6px 10px 6px 0' }}>
                  <input style={{ ...inp, fontSize:12 }} value={v.phone||''} onChange={e=>updateVendor(v.id,'phone',e.target.value)} />
                </td>
                <td style={{ padding:'6px 10px 6px 0' }}>
                  <input style={{ ...inp, fontSize:12 }} value={v.email||''} onChange={e=>updateVendor(v.id,'email',e.target.value)} />
                </td>
                <td style={{ padding:'6px 10px 6px 0' }}>
                  <input style={{ ...inp, fontSize:12 }} value={v.notes||''} onChange={e=>updateVendor(v.id,'notes',e.target.value)} />
                </td>
                <td style={{ padding:'6px 0', textAlign:'center' }}>
                  <button onClick={()=>removeVendor(v.id)} style={{ background:'none', border:'none', color:'#D6D2CA', cursor:'pointer', fontSize:16, padding:0 }}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </PageWrap>
  )
}
