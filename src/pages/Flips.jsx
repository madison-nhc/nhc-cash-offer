import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { PageWrap, SectionBar, Card, Field, FieldRow, inp, monoInp, Btn, Badge, EmptyState, LoadingSpinner, StatCard, fmt, fmtK } from '../components/ui.jsx'
import Drawer from '../components/Drawer.jsx'

const STATUS_COLORS = { active: '#D97825', listed: '#2D6FAF', sold: '#3B6D11' }
const EMPTY = { address: '', property_type: 'flip', purchase_date: '', purchase_price: '', closing_costs: '', rehab_cost: '', arv: '', sale_price: '', sale_date: '', days_on_market: '', status: 'active', notes: '' }

function calcProfit(p) {
  return (parseFloat(p.sale_price)||0) - (parseFloat(p.purchase_price)||0) - (parseFloat(p.closing_costs)||0) - (parseFloat(p.rehab_cost)||0)
}

export default function Flips() {
  const [props, setProps] = useState([])
  const [loading, setLoading] = useState(true)
  const [drawer, setDrawer] = useState(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('investment_properties').select('*').eq('property_type','flip').order('created_at',{ascending:false})
    setProps(data||[])
    setLoading(false)
  }

  function openNew() { setDrawer({ ...EMPTY }) }
  function openEdit(p) { setDrawer({ ...p }) }

  const filtered = filter === 'all' ? props : props.filter(p => p.status === filter)
  const completed = props.filter(p => p.status === 'sold')
  const totalProfit = completed.reduce((s,p) => s + calcProfit(p), 0)
  const avgProfit = completed.length > 0 ? totalProfit / completed.length : 0
  const avgDOM = completed.filter(p=>p.days_on_market).reduce((s,p,_,a)=>s+p.days_on_market/a.length,0)

  if (loading) return <LoadingSpinner />

  return (
    <PageWrap>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, color:'#2C2C2C' }}>Flips</h1>
          <p style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>Properties bought, rehabbed, and sold</p>
        </div>
        <Btn onClick={openNew}>+ Add Property</Btn>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        <StatCard label="Active Flips" value={props.filter(p=>p.status==='active').length} topColor="#D97825" />
        <StatCard label="Completed Flips" value={completed.length} topColor="#3B6D11" />
        <StatCard label="Total Profit" value={fmtK(totalProfit)} sub="all completed" topColor={totalProfit>=0?'#3B6D11':'#B91C1C'} />
        <StatCard label="Avg Profit / Deal" value={fmtK(avgProfit)} sub={avgDOM ? `avg ${Math.round(avgDOM)} DOM` : ''} topColor="#B8892A" />
      </div>

      <div style={{ display:'flex', gap:6, marginBottom:14 }}>
        {['all','active','listed','sold'].map(f=>(
          <button key={f} onClick={()=>setFilter(f)} style={{
            padding:'5px 14px', border:'none', borderRadius:4, cursor:'pointer',
            background:filter===f?'#2C2C2C':'#F0EDE6', color:filter===f?'#fff':'#6b7280',
            fontSize:12, fontWeight:filter===f?700:400, fontFamily:'inherit', textTransform:'capitalize'
          }}>{f} ({f==='all'?props.length:props.filter(p=>p.status===f).length})</button>
        ))}
      </div>

      <SectionBar>Properties ({filtered.length})</SectionBar>

      {filtered.length === 0
        ? <EmptyState icon="⟳" text="No flip properties yet. Add your first property." />
        : (
          <Card style={{ padding:0 }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'#F0EDE6' }}>
                  {['Address','Status','Purchase','Rehab','ARV','Sale Price','Profit / Loss','DOM'].map(h=>(
                    <th key={h} style={{ padding:'8px 14px', textAlign:'left', fontSize:11, fontWeight:600, letterSpacing:0.8, color:'#6b7280', textTransform:'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p,i) => {
                  const profit = calcProfit(p)
                  const totalCost = (parseFloat(p.purchase_price)||0)+(parseFloat(p.closing_costs)||0)+(parseFloat(p.rehab_cost)||0)
                  return (
                    <tr key={p.id} onClick={()=>openEdit(p)} style={{
                      background:i%2===0?'#fff':'#FAFAF8', borderTop:'0.5px solid #F0EDE6',
                      cursor:'pointer', transition:'background 0.1s'
                    }}
                    onMouseEnter={e=>e.currentTarget.style.background='#fef9f0'}
                    onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'#fff':'#FAFAF8'}>
                      <td style={{ padding:'11px 14px', fontSize:13, fontWeight:600 }}>{p.address}</td>
                      <td style={{ padding:'11px 14px' }}><Badge color={STATUS_COLORS[p.status]}>{p.status}</Badge></td>
                      <td style={{ padding:'11px 14px', fontSize:13, fontFamily:'monospace' }}>{fmt(totalCost)}</td>
                      <td style={{ padding:'11px 14px', fontSize:13, fontFamily:'monospace' }}>{fmt(p.rehab_cost)}</td>
                      <td style={{ padding:'11px 14px', fontSize:13, fontFamily:'monospace' }}>{fmt(p.arv)}</td>
                      <td style={{ padding:'11px 14px', fontSize:13, fontFamily:'monospace' }}>{fmt(p.sale_price)}</td>
                      <td style={{ padding:'11px 14px', fontSize:13, fontFamily:'monospace', fontWeight:700, color:p.status==='sold'?(profit>=0?'#3B6D11':'#B91C1C'):'#9ca3af' }}>
                        {p.status==='sold'?`${profit>=0?'+':''}${fmt(profit)}`:'—'}
                      </td>
                      <td style={{ padding:'11px 14px', fontSize:13, color:'#6b7280' }}>{p.days_on_market||'—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>
        )
      }

      <FlipDrawer
        property={drawer}
        open={!!drawer}
        onClose={()=>setDrawer(null)}
        onSave={()=>{ setDrawer(null); load() }}
      />
    </PageWrap>
  )
}

function FlipDrawer({ property, open, onClose, onSave }) {
  const [form, setForm] = useState({})
  useEffect(() => { if (property) setForm({ ...property }) }, [property])

  if (!property) return null
  const isNew = !form.id
  const totalCost = (parseFloat(form.purchase_price)||0)+(parseFloat(form.closing_costs)||0)+(parseFloat(form.rehab_cost)||0)
  const profit = form.status==='sold' ? (parseFloat(form.sale_price)||0)-totalCost : null
  const roi = totalCost>0&&profit!==null ? ((profit/totalCost)*100).toFixed(1) : null
  const set = k => e => setForm(f=>({...f,[k]:e.target.value}))

  async function save() {
    const payload = { property_type:'flip', address:form.address, purchase_date:form.purchase_date||null, purchase_price:form.purchase_price||null, closing_costs:form.closing_costs||null, rehab_cost:form.rehab_cost||null, arv:form.arv||null, sale_price:form.sale_price||null, sale_date:form.sale_date||null, days_on_market:form.days_on_market||null, status:form.status, notes:form.notes||null, entity:'NHC' }
    if (isNew) await supabase.from('investment_properties').insert(payload)
    else await supabase.from('investment_properties').update(payload).eq('id',form.id)
    onSave()
  }

  async function del() {
    if (!confirm('Delete this property?')) return
    await supabase.from('investment_properties').delete().eq('id',form.id)
    onSave()
  }

  return (
    <Drawer open={open} onClose={onClose} title={form.address||'New Flip Property'} subtitle={form.status ? `Status: ${form.status}` : 'Flip property'}>
      <div style={{ display:'flex', flexDirection:'column', gap:14, paddingTop:12 }}>
        <Field label="Address"><input style={inp} value={form.address||''} onChange={set('address')} placeholder="123 Main St, Lexington KY" /></Field>
        <Field label="Status">
          <select style={inp} value={form.status||'active'} onChange={set('status')}>
            <option value="active">Active (Under Rehab)</option>
            <option value="listed">Listed</option>
            <option value="sold">Sold / Completed</option>
          </select>
        </Field>
        <div className="drawer-section">Acquisition</div>
        <FieldRow>
          <Field label="Purchase Date"><input style={inp} type="date" value={form.purchase_date||''} onChange={set('purchase_date')} /></Field>
          <Field label="Purchase Price ($)"><input style={monoInp} type="number" value={form.purchase_price||''} onChange={set('purchase_price')} /></Field>
        </FieldRow>
        <Field label="Closing Costs ($)"><input style={monoInp} type="number" value={form.closing_costs||''} onChange={set('closing_costs')} /></Field>
        <div className="drawer-section">Rehab & Valuation</div>
        <FieldRow>
          <Field label="Rehab Cost ($)"><input style={monoInp} type="number" value={form.rehab_cost||''} onChange={set('rehab_cost')} /></Field>
          <Field label="ARV ($)"><input style={monoInp} type="number" value={form.arv||''} onChange={set('arv')} /></Field>
        </FieldRow>
        {(form.status==='listed'||form.status==='sold') && <>
          <div className="drawer-section">Sale</div>
          <FieldRow>
            <Field label="Sale Price ($)"><input style={monoInp} type="number" value={form.sale_price||''} onChange={set('sale_price')} /></Field>
            <Field label="Sale Date"><input style={inp} type="date" value={form.sale_date||''} onChange={set('sale_date')} /></Field>
          </FieldRow>
          <Field label="Days on Market"><input style={monoInp} type="number" value={form.days_on_market||''} onChange={set('days_on_market')} /></Field>
        </>}
        {profit!==null && (
          <div style={{ background:profit>=0?'#f0fdf4':'#fef2f2', borderRadius:8, padding:14, display:'flex', justifyContent:'space-between' }}>
            <div><div style={{ fontSize:11, color:'#6b7280', textTransform:'uppercase', letterSpacing:0.8 }}>Profit</div><div style={{ fontSize:22, fontWeight:700, color:profit>=0?'#3B6D11':'#B91C1C' }}>{profit>=0?'+':''}{fmt(profit)}</div></div>
            <div style={{ textAlign:'right' }}><div style={{ fontSize:11, color:'#6b7280', textTransform:'uppercase', letterSpacing:0.8 }}>ROI</div><div style={{ fontSize:22, fontWeight:700, color:profit>=0?'#3B6D11':'#B91C1C' }}>{roi}%</div></div>
          </div>
        )}
        <Field label="Notes"><textarea style={{ ...inp, minHeight:72, resize:'vertical' }} value={form.notes||''} onChange={set('notes')} /></Field>
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:8 }}>
          {!isNew && <Btn variant="danger" onClick={del}>Delete</Btn>}
          <div style={{ display:'flex', gap:8, marginLeft:'auto' }}>
            <Btn variant="outline" onClick={onClose}>Cancel</Btn>
            <Btn onClick={save}>Save</Btn>
          </div>
        </div>
      </div>
    </Drawer>
  )
}
