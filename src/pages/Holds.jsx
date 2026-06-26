import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { PageWrap, SectionBar, Card, Field, FieldRow, inp, monoInp, Btn, EmptyState, LoadingSpinner, StatCard, fmt, fmtK } from '../components/ui.jsx'
import Drawer from '../components/Drawer.jsx'

const EMPTY_PROP = { address:'', property_type:'hold', purchase_date:'', purchase_price:'', closing_costs:'', rehab_cost:'', arv:'', mortgage_amount:'', monthly_payment:'', status:'active', notes:'' }
const EMPTY_INCOME = { income_month:'', rent_received:'', expenses:'', notes:'' }

export default function Holds() {
  const [props, setProps] = useState([])
  const [income, setIncome] = useState([])
  const [loading, setLoading] = useState(true)
  const [drawer, setDrawer] = useState(null)
  const [incomeDrawer, setIncomeDrawer] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data:p }, { data:i }] = await Promise.all([
      supabase.from('investment_properties').select('*').eq('property_type','hold').order('created_at',{ascending:false}),
      supabase.from('hold_income').select('*').order('income_month',{ascending:false}),
    ])
    setProps(p||[])
    setIncome(i||[])
    setLoading(false)
  }

  const active = props.filter(p=>p.status==='active')
  const totalRent = income.reduce((s,i)=>s+(parseFloat(i.rent_received)||0),0)
  const totalExp  = income.reduce((s,i)=>s+(parseFloat(i.expenses)||0),0)
  const totalEquity = props.reduce((s,p)=>s+Math.max(0,(parseFloat(p.arv)||0)-(parseFloat(p.mortgage_amount)||0)),0)

  if (loading) return <LoadingSpinner />

  return (
    <PageWrap>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, color:'#2C2C2C' }}>Hold Properties</h1>
          <p style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>Long-term rental and hold income tracking</p>
        </div>
        <Btn onClick={()=>setDrawer({...EMPTY_PROP})}>+ Add Property</Btn>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        <StatCard label="Active Holds" value={active.length} topColor="#2D6FAF" />
        <StatCard label="Total Rent Collected" value={fmtK(totalRent)} topColor="#3B6D11" />
        <StatCard label="Net Income (all time)" value={fmtK(totalRent-totalExp)} sub="rent minus expenses" topColor={(totalRent-totalExp)>=0?'#3B6D11':'#B91C1C'} />
        <StatCard label="Est. Total Equity" value={fmtK(totalEquity)} sub="ARV minus mortgage" topColor="#B8892A" />
      </div>

      <SectionBar>Properties ({props.length})</SectionBar>

      {props.length === 0
        ? <EmptyState icon="⌂" text="No hold properties yet." />
        : props.map((p,i) => {
          const propIncome = income.filter(inc=>inc.property_id===p.id)
          const propRent = propIncome.reduce((s,inc)=>s+(parseFloat(inc.rent_received)||0),0)
          const propExp  = propIncome.reduce((s,inc)=>s+(parseFloat(inc.expenses)||0),0)
          const propNet  = propRent - propExp
          const equity   = Math.max(0,(parseFloat(p.arv)||0)-(parseFloat(p.mortgage_amount)||0))

          return (
            <Card key={p.id} style={{ marginTop:10, padding:0, overflow:'hidden' }}>
              {/* Clickable property row */}
              <div onClick={()=>setDrawer({...p, _income: propIncome})} style={{
                display:'flex', alignItems:'center', gap:12, padding:'13px 16px',
                cursor:'pointer', background:'#fff', transition:'background 0.12s'
              }}
              onMouseEnter={e=>e.currentTarget.style.background='#fef9f0'}
              onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:14, color:'#2C2C2C' }}>{p.address}</div>
                  <div style={{ fontSize:11, color:'#6b7280', marginTop:2 }}>
                    {p.purchase_date ? `Purchased ${new Date(p.purchase_date+'T12:00:00').toLocaleDateString()}` : 'No purchase date'} · {fmt(p.monthly_payment)}/mo mortgage · {propIncome.length} months recorded
                  </div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:13, fontFamily:'monospace', fontWeight:700, color:propNet>=0?'#3B6D11':'#B91C1C' }}>{propNet>=0?'+':''}{fmt(propNet)}</div>
                  <div style={{ fontSize:11, color:'#6b7280' }}>net income</div>
                </div>
                <div style={{ textAlign:'right', marginLeft:16 }}>
                  <div style={{ fontSize:13, fontFamily:'monospace', fontWeight:700 }}>{fmt(equity)}</div>
                  <div style={{ fontSize:11, color:'#6b7280' }}>equity</div>
                </div>
                <div style={{ fontSize:18, color:'#D6D2CA', marginLeft:8 }}>›</div>
              </div>

              {/* Income history inline (always visible, compact) */}
              {propIncome.length > 0 && (
                <div style={{ borderTop:'1px solid #F0EDE6' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 16px', background:'#F0EDE6' }}>
                    <span style={{ fontSize:10, fontWeight:700, letterSpacing:1.2, color:'#6b7280', textTransform:'uppercase' }}>Income History</span>
                    <button onClick={e=>{e.stopPropagation();setIncomeDrawer({property:p})}} style={{ background:'#B8892A', color:'#fff', border:'none', borderRadius:4, padding:'3px 10px', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>+ Add Month</button>
                  </div>
                  <table style={{ width:'100%', borderCollapse:'collapse' }}>
                    <thead><tr>
                      {['Month','Rent','Expenses','Net','Notes'].map(h=>(
                        <th key={h} style={{ padding:'5px 16px', textAlign:'left', fontSize:10, fontWeight:600, color:'#9ca3af', textTransform:'uppercase' }}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {propIncome.map((inc,j) => {
                        const net=(parseFloat(inc.rent_received)||0)-(parseFloat(inc.expenses)||0)
                        return (
                          <tr key={inc.id} style={{ background:j%2===0?'#fff':'#FAFAF8', borderTop:'0.5px solid #F0EDE6' }}>
                            <td style={{ padding:'7px 16px', fontSize:13 }}>{inc.income_month ? new Date(inc.income_month+'-01').toLocaleDateString('en-US',{month:'short',year:'numeric'}) : '—'}</td>
                            <td style={{ padding:'7px 16px', fontSize:13, fontFamily:'monospace', color:'#3B6D11' }}>{fmt(inc.rent_received)}</td>
                            <td style={{ padding:'7px 16px', fontSize:13, fontFamily:'monospace', color:'#B91C1C' }}>{fmt(inc.expenses)}</td>
                            <td style={{ padding:'7px 16px', fontSize:13, fontFamily:'monospace', fontWeight:700, color:net>=0?'#3B6D11':'#B91C1C' }}>{net>=0?'+':''}{fmt(net)}</td>
                            <td style={{ padding:'7px 16px', fontSize:12, color:'#6b7280' }}>{inc.notes||'—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop:'2px solid #D6D2CA', background:'#F0EDE6' }}>
                        <td style={{ padding:'7px 16px', fontSize:11, fontWeight:700 }}>TOTAL</td>
                        <td style={{ padding:'7px 16px', fontSize:13, fontFamily:'monospace', fontWeight:700, color:'#3B6D11' }}>{fmt(propRent)}</td>
                        <td style={{ padding:'7px 16px', fontSize:13, fontFamily:'monospace', fontWeight:700, color:'#B91C1C' }}>{fmt(propExp)}</td>
                        <td style={{ padding:'7px 16px', fontSize:13, fontFamily:'monospace', fontWeight:700, color:propNet>=0?'#3B6D11':'#B91C1C' }}>{propNet>=0?'+':''}{fmt(propNet)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
              {propIncome.length === 0 && (
                <div style={{ borderTop:'1px solid #F0EDE6', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 16px', background:'#FAFAF8' }}>
                  <span style={{ fontSize:12, color:'#9ca3af' }}>No income recorded yet.</span>
                  <button onClick={e=>{e.stopPropagation();setIncomeDrawer({property:p})}} style={{ background:'#B8892A', color:'#fff', border:'none', borderRadius:4, padding:'4px 12px', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>+ Add Month</button>
                </div>
              )}
            </Card>
          )
        })
      }

      <HoldDrawer property={drawer} open={!!drawer} onClose={()=>setDrawer(null)} onSave={()=>{ setDrawer(null); load() }} />
      <IncomeDrawer data={incomeDrawer} open={!!incomeDrawer} onClose={()=>setIncomeDrawer(null)} onSave={()=>{ setIncomeDrawer(null); load() }} />
    </PageWrap>
  )
}

function HoldDrawer({ property, open, onClose, onSave }) {
  const [form, setForm] = useState({})
  useEffect(() => { if (property) setForm({...property}) }, [property])
  if (!property) return null
  const isNew = !form.id
  const set = k => e => setForm(f=>({...f,[k]:e.target.value}))

  async function save() {
    const payload = { property_type:'hold', address:form.address, purchase_date:form.purchase_date||null, purchase_price:form.purchase_price||null, closing_costs:form.closing_costs||null, rehab_cost:form.rehab_cost||null, arv:form.arv||null, mortgage_amount:form.mortgage_amount||null, monthly_payment:form.monthly_payment||null, status:form.status||'active', notes:form.notes||null, entity:'NHC' }
    if (isNew) await supabase.from('investment_properties').insert(payload)
    else await supabase.from('investment_properties').update(payload).eq('id',form.id)
    onSave()
  }

  async function del() {
    if (!confirm('Delete this property and all income records?')) return
    await supabase.from('investment_properties').delete().eq('id',form.id)
    onSave()
  }

  return (
    <Drawer open={open} onClose={onClose} title={form.address||'New Hold Property'} subtitle={isNew ? 'New hold property' : `${form.status} · ${fmt(form.monthly_payment)}/mo`}>
      <div style={{ display:'flex', flexDirection:'column', gap:14, paddingTop:12 }}>
        <Field label="Address"><input style={inp} value={form.address||''} onChange={set('address')} placeholder="456 Oak Ave, Lexington KY" /></Field>
        <Field label="Status">
          <select style={inp} value={form.status||'active'} onChange={set('status')}>
            <option value="active">Active (Holding)</option>
            <option value="sold">Sold</option>
          </select>
        </Field>
        <div className="drawer-section">Acquisition</div>
        <FieldRow>
          <Field label="Purchase Date"><input style={inp} type="date" value={form.purchase_date||''} onChange={set('purchase_date')} /></Field>
          <Field label="Purchase Price ($)"><input style={monoInp} type="number" value={form.purchase_price||''} onChange={set('purchase_price')} /></Field>
        </FieldRow>
        <FieldRow>
          <Field label="Closing Costs ($)"><input style={monoInp} type="number" value={form.closing_costs||''} onChange={set('closing_costs')} /></Field>
          <Field label="Rehab Cost ($)"><input style={monoInp} type="number" value={form.rehab_cost||''} onChange={set('rehab_cost')} /></Field>
        </FieldRow>
        <div className="drawer-section">Mortgage & Value</div>
        <FieldRow>
          <Field label="Mortgage Balance ($)"><input style={monoInp} type="number" value={form.mortgage_amount||''} onChange={set('mortgage_amount')} /></Field>
          <Field label="Monthly Payment ($)"><input style={monoInp} type="number" value={form.monthly_payment||''} onChange={set('monthly_payment')} /></Field>
        </FieldRow>
        <Field label="Current ARV ($)"><input style={monoInp} type="number" value={form.arv||''} onChange={set('arv')} /></Field>
        <Field label="Notes"><textarea style={{ ...inp, minHeight:60, resize:'vertical' }} value={form.notes||''} onChange={set('notes')} /></Field>
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:8 }}>
          {!isNew && <Btn variant="danger" onClick={del}>Delete Property</Btn>}
          <div style={{ display:'flex', gap:8, marginLeft:'auto' }}>
            <Btn variant="outline" onClick={onClose}>Cancel</Btn>
            <Btn onClick={save}>Save</Btn>
          </div>
        </div>
      </div>
    </Drawer>
  )
}

function IncomeDrawer({ data, open, onClose, onSave }) {
  const [form, setForm] = useState({ income_month:'', rent_received:'', expenses:'', notes:'' })
  useEffect(() => { if (data) setForm({ income_month:'', rent_received:'', expenses:'', notes:'' }) }, [data])
  if (!data) return null
  const set = k => e => setForm(f=>({...f,[k]:e.target.value}))
  const net = (parseFloat(form.rent_received)||0) - (parseFloat(form.expenses)||0)

  async function save() {
    await supabase.from('hold_income').insert({ property_id:data.property.id, income_month:form.income_month, rent_received:form.rent_received||null, expenses:form.expenses||null, notes:form.notes||null })
    onSave()
  }

  return (
    <Drawer open={open} onClose={onClose} title={`Add Income Month`} subtitle={data.property.address}>
      <div style={{ display:'flex', flexDirection:'column', gap:14, paddingTop:12 }}>
        <Field label="Month"><input style={inp} type="month" value={form.income_month} onChange={set('income_month')} /></Field>
        <FieldRow>
          <Field label="Rent Received ($)"><input style={monoInp} type="number" value={form.rent_received} onChange={set('rent_received')} placeholder="1200" /></Field>
          <Field label="Expenses ($)"><input style={monoInp} type="number" value={form.expenses} onChange={set('expenses')} placeholder="0" /></Field>
        </FieldRow>
        {(form.rent_received || form.expenses) && (
          <div style={{ background:net>=0?'#f0fdf4':'#fef2f2', borderRadius:6, padding:10, display:'flex', justifyContent:'space-between' }}>
            <span style={{ fontSize:12, color:'#6b7280' }}>Net This Month</span>
            <span style={{ fontSize:14, fontWeight:700, fontFamily:'monospace', color:net>=0?'#3B6D11':'#B91C1C' }}>{net>=0?'+':''}{fmt(net)}</span>
          </div>
        )}
        <Field label="Notes"><input style={inp} value={form.notes} onChange={set('notes')} placeholder="Repairs, vacancy, etc." /></Field>
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:8 }}>
          <Btn variant="outline" onClick={onClose}>Cancel</Btn>
          <Btn onClick={save} disabled={!form.income_month}>Save Month</Btn>
        </div>
      </div>
    </Drawer>
  )
}
