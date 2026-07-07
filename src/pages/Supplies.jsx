import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { PageWrap, SectionBar, StatCard, EmptyState, useSort, SortTh, fmt, LoadingSpinner } from '../components/ui.jsx'

const STATUS_COLORS = { Ordered:'#D97825', Received:'#3B6D11' }

export default function Supplies({ onBack }) {
  const [items, setItems]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('cashoffer_supplies')
      .select('*, cashoffer_properties(address), cashoffer_rehab_rounds(label)')
      .order('created_at', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }

  async function updateStatus(id, status) {
    setItems(items => items.map(it => it.id===id ? { ...it, status } : it))
    await supabase.from('cashoffer_supplies').update({ status }).eq('id', id)
  }

  const filtered = statusFilter==='all' ? items : items.filter(i=>i.status===statusFilter)
  const totalCost = filtered.reduce((s,i) => s + ((parseFloat(i.unit_cost)||0)*(parseFloat(i.quantity)||0)), 0)
  const orderedCount  = items.filter(i=>i.status==='Ordered').length
  const receivedCount = items.filter(i=>i.status==='Received').length

  const { sorted, sortKey, sortDir, toggleSort } = useSort(filtered, 'created_at', 'desc', {
    address:   i => i.cashoffer_properties?.address || '',
    round:     i => i.cashoffer_rehab_rounds?.label || '',
    total:     i => (parseFloat(i.unit_cost)||0)*(parseFloat(i.quantity)||0),
  })

  if (loading) return <PageWrap><LoadingSpinner /></PageWrap>

  return (
    <PageWrap>
      {onBack && (
        <button onClick={onBack} style={{ background:'none', border:'none', color:'#B8892A', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', padding:0, marginBottom:12 }}>
          ← Back to Rehabs
        </button>
      )}
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:22, fontWeight:700, color:'#2C2C2C' }}>Supplies</div>
        <div style={{ fontSize:13, color:'#9ca3af', marginTop:2 }}>All supply purchases across properties</div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
        <StatCard label="Total Cost" value={fmt(totalCost)} topColor="#B8892A" />
        <StatCard label="Ordered" value={orderedCount} topColor="#D97825" />
        <StatCard label="Received" value={receivedCount} topColor="#3B6D11" />
      </div>

      <div style={{ display:'flex', gap:6, marginBottom:12 }}>
        {['all','Ordered','Received'].map(s=>(
          <button key={s} onClick={()=>setStatusFilter(s)} style={{
            padding:'5px 12px', border:`1.5px solid ${statusFilter===s?'#B8892A':'#D6D2CA'}`,
            borderRadius:20, cursor:'pointer', fontSize:11, fontWeight:statusFilter===s?700:400,
            fontFamily:'inherit', background:statusFilter===s?'#B8892A':'#fff',
            color:statusFilter===s?'#fff':'#6b7280',
          }}>{s==='all'?'All':s}</button>
        ))}
      </div>

      <SectionBar>Supply Items ({sorted.length})</SectionBar>
      {sorted.length===0 ? (
        <EmptyState icon="○" text="No supplies logged yet. Add supply items from the Rehab tab on a property." />
      ) : (
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr>
              <SortTh sortKeyName="address" {...{sortKey,sortDir,toggleSort}}>Property</SortTh>
              <SortTh sortKeyName="round" {...{sortKey,sortDir,toggleSort}}>Round</SortTh>
              <SortTh sortKeyName="name" {...{sortKey,sortDir,toggleSort}}>Item</SortTh>
              <SortTh sortKeyName="quantity" {...{sortKey,sortDir,toggleSort}} align="right">Qty</SortTh>
              <SortTh sortKeyName="unit_cost" {...{sortKey,sortDir,toggleSort}} align="right">Unit Cost</SortTh>
              <SortTh sortKeyName="total" {...{sortKey,sortDir,toggleSort}} align="right">Total</SortTh>
              <SortTh sortKeyName="vendor" {...{sortKey,sortDir,toggleSort}}>Vendor/Store</SortTh>
              <SortTh sortKeyName="status" {...{sortKey,sortDir,toggleSort}}>Status</SortTh>
            </tr>
          </thead>
          <tbody>
            {sorted.map((it,i) => (
              <tr key={it.id} style={{ background: i%2===1?'#FAFAF8':'#fff', borderBottom:'0.5px solid #F0EDE6' }}>
                <td style={{ padding:'10px 14px', fontSize:13, fontWeight:600 }}>{it.cashoffer_properties?.address || '—'}</td>
                <td style={{ padding:'10px 14px', fontSize:12, color:'#9ca3af' }}>{it.cashoffer_rehab_rounds?.label || '—'}</td>
                <td style={{ padding:'10px 14px', fontSize:13 }}>{it.name || '—'}</td>
                <td style={{ padding:'10px 14px', fontSize:13, fontFamily:'monospace', textAlign:'right' }}>{it.quantity ?? '—'}</td>
                <td style={{ padding:'10px 14px', fontSize:13, fontFamily:'monospace', textAlign:'right' }}>{it.unit_cost ? fmt(it.unit_cost) : '—'}</td>
                <td style={{ padding:'10px 14px', fontSize:13, fontFamily:'monospace', textAlign:'right', fontWeight:700 }}>{fmt((parseFloat(it.unit_cost)||0)*(parseFloat(it.quantity)||0))}</td>
                <td style={{ padding:'10px 14px', fontSize:13, color:'#6b7280' }}>{it.vendor || '—'}</td>
                <td style={{ padding:'10px 14px' }}>
                  <select value={it.status||'Ordered'} onChange={e=>updateStatus(it.id, e.target.value)} style={{
                    border:'none', background:'none', fontSize:11, fontWeight:700, color:STATUS_COLORS[it.status], cursor:'pointer', fontFamily:'inherit',
                  }}>
                    <option value="Ordered">Ordered</option>
                    <option value="Received">Received</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </PageWrap>
  )
}
