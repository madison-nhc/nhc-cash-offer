import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { Field, FieldRow, inp, monoInp, Btn, fmt, fmtK } from './ui.jsx'
import Drawer from './Drawer.jsx'
import AddressInput from './AddressInput.jsx'

const STATUSES = [
  { value:'analyzing',      label:'Analyzing' },
  { value:'offer_made',     label:'Offer Made' },
  { value:'under_contract', label:'Under Contract' },
  { value:'purchased',      label:'Purchased' },
  { value:'active',         label:'Active' },
  { value:'sold',           label:'Sold' },
  { value:'passed',         label:'Passed' },
]

const STATUS_COLORS = {
  analyzing:'#B8892A', offer_made:'#D97825', under_contract:'#2D6FAF',
  purchased:'#6b21a8', active:'#3B6D11', sold:'#2C2C2C', passed:'#9ca3af'
}

const DEFAULT_REPAIRS = [
  { name:'Flooring', cost:'' }, { name:'Painting', cost:'' },
  { name:'Demo / Cleanup', cost:'' }, { name:'Drywall', cost:'' },
  { name:'Appliances', cost:'' }, { name:'Plumbing', cost:'' },
  { name:'Electrical', cost:'' }, { name:'Misc', cost:'' },
]

function calcOffers(p, repairs) {
  const arv = parseFloat(p.arv)||0
  const reno = repairs.reduce((s,r)=>s+(parseFloat(r.cost)||0),0)
  const commCash = (parseFloat(p.comm_cash_pct)||9)/100
  const commList = (parseFloat(p.comm_list_pct)||6)/100
  const profitPct = (parseFloat(p.profit_margin)||15)/100
  const profit = p.profit_override ? parseFloat(p.profit_override) : arv*profitPct
  const asisDisc = (parseFloat(p.asis_pct)||50)/100
  const asisVal  = p.asis_override ? parseFloat(p.asis_override) : arv-(asisDisc*reno)
  const cashHold = (parseFloat(p.hold_cash_pct)||0.75)/100*(parseFloat(p.hold_cash_months)||6)*arv
  const cashOffer= p.cash_offer_override ? parseFloat(p.cash_offer_override) : arv-reno-(commCash*arv)-cashHold-profit
  const opt2Hold = (parseFloat(p.hold_opt2_pct)||0.5)/100*(parseFloat(p.hold_opt2_months)||3)*arv
  const opt2Net  = asisVal-(commList*asisVal)-opt2Hold
  const opt3Hold = (parseFloat(p.hold_opt3_pct)||0.5)/100*(parseFloat(p.hold_opt3_months)||6)*arv
  const opt3Net  = arv-reno-(commList*arv)-opt3Hold
  return { arv, reno, cashOffer, asisVal, opt2Net, opt3Net, profit }
}

export default function PropertyDrawer({ property, open, onClose, onSave, mailings=[] }) {
  const [form, setForm] = useState({})
  const [repairs, setRepairs] = useState([])
  const [income, setIncome] = useState([])
  const [tab, setTab] = useState('analyzer')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [incomeForm, setIncomeForm] = useState({ income_month:'', rent_received:'', expenses:'', notes:'' })

  useEffect(() => {
    if (property) {
      setForm({ ...property })
      setRepairs(property.repair_items?.length ? property.repair_items.map((r,i)=>({...r,id:i})) : DEFAULT_REPAIRS.map((r,i)=>({...r,id:i})))
      setTab('analyzer')
      if (property.id && (property.investment_type==='hold')) loadIncome(property.id)
    }
  }, [property])

  async function loadIncome(id) {
    const { data } = await supabase.from('property_income').select('*').eq('property_id',id).order('income_month',{ascending:false})
    setIncome(data||[])
  }

  const set = k => e => setForm(f=>({...f,[k]:e.target.value}))
  const isNew = !form.id
  const d = calcOffers(form, repairs)

  const totalCost   = (parseFloat(form.purchase_price)||0)+(parseFloat(form.closing_costs)||0)+(parseFloat(form.rehab_cost)||0)
  const flipProfit  = form.sale_price ? (parseFloat(form.sale_price)||0)-totalCost : null
  const totalIncome = income.reduce((s,i)=>s+(parseFloat(i.rent_received)||0),0)
  const totalExp    = income.reduce((s,i)=>s+(parseFloat(i.expenses)||0),0)

  async function save() {
    if (!form.address) return
    setSaving(true)
    const payload = {
      address:form.address, beds:form.beds||null, baths:form.baths||null, sqft:form.sqft||null,
      status:form.status||'analyzing', investment_type:form.investment_type||null,
      arv:form.arv||null, asis_pct:form.asis_pct||50, asis_override:form.asis_override||null,
      profit_margin:form.profit_margin||15, profit_override:form.profit_override||null,
      cash_offer_override:form.cash_offer_override||null,
      repair_items: repairs.filter(r=>r.name||r.cost).map(r=>({name:r.name,cost:parseFloat(r.cost)||0})),
      comm_cash_pct:form.comm_cash_pct||9, comm_list_pct:form.comm_list_pct||6,
      hold_cash_pct:form.hold_cash_pct||0.75, hold_cash_months:form.hold_cash_months||6,
      hold_opt2_pct:form.hold_opt2_pct||0.5, hold_opt2_months:form.hold_opt2_months||3,
      hold_opt3_pct:form.hold_opt3_pct||0.5, hold_opt3_months:form.hold_opt3_months||6,
      mailing_id:form.mailing_id||null, lead_type:form.lead_type||null,
      commission_pct:form.commission_pct||null, commission_earned:form.commission_earned||null,
      nhc_notes:form.nhc_notes||null,
      purchase_price:form.purchase_price||null, closing_costs:form.closing_costs||null,
      rehab_cost:form.rehab_cost||null, sale_price:form.sale_price||null,
      sale_date:form.sale_date||null, days_on_market:form.days_on_market||null,
      mortgage_amount:form.mortgage_amount||null, monthly_payment:form.monthly_payment||null,
      bpv_notes:form.bpv_notes||null,
      offer_date:form.offer_date||null, purchase_date:form.purchase_date||null, sold_date:form.sold_date||null,
      entity:'NHC'
    }
    if (isNew) await supabase.from('properties').insert(payload)
    else await supabase.from('properties').update(payload).eq('id',form.id)
    setSaving(false); setSaved(true)
    setTimeout(()=>setSaved(false),2000)
    onSave()
  }

  async function del() {
    if (!confirm('Delete this property?')) return
    await supabase.from('properties').delete().eq('id',form.id)
    onSave(); onClose()
  }

  async function addIncome() {
    if (!incomeForm.income_month || !form.id) return
    await supabase.from('property_income').insert({ property_id:form.id, ...incomeForm })
    setIncomeForm({ income_month:'', rent_received:'', expenses:'', notes:'' })
    loadIncome(form.id)
  }

  function addRepair() { setRepairs(rs=>[...rs,{id:Date.now(),name:'',cost:''}]) }
  function removeRepair(id) { setRepairs(rs=>rs.filter(r=>r.id!==id)) }
  function updateRepair(id,k,v) { setRepairs(rs=>rs.map(r=>r.id===id?{...r,[k]:v}:r)) }

  const statusColor = STATUS_COLORS[form.status]||'#6b7280'
  const tabs = ['analyzer','purchase','investment']

  if (!property) return null

  return (
    <Drawer open={open} onClose={onClose} width={580}
      title={form.address||'New Property'}
      subtitle={
        <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:4 }}>
          <span style={{ background:statusColor+'20', color:statusColor, border:`1px solid ${statusColor}40`, borderRadius:4, padding:'2px 8px', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:0.8 }}>
            {STATUSES.find(s=>s.value===form.status)?.label||'Analyzing'}
          </span>
          {form.investment_type && <span style={{ fontSize:11, color:'#6b7280', textTransform:'capitalize' }}>{form.investment_type}</span>}
        </div>
      }>

      {/* Tab switcher */}
      <div style={{ display:'flex', gap:0, borderBottom:'2px solid #F0EDE6', marginBottom:16, marginTop:8 }}>
        {tabs.map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{
            padding:'8px 18px', border:'none', background:'none', cursor:'pointer',
            fontSize:12, fontWeight:tab===t?700:400, fontFamily:'inherit',
            color:tab===t?'#B8892A':'#6b7280', textTransform:'capitalize',
            borderBottom:tab===t?'2px solid #B8892A':'2px solid transparent',
            marginBottom:-2, letterSpacing:0.5
          }}>{t}</button>
        ))}
      </div>

      {/* ── ANALYZER TAB ── */}
      {tab==='analyzer' && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div className="drawer-section">Property</div>
          <Field label="Address">
            <AddressInput value={form.address||''} onChange={v=>setForm(f=>({...f,address:v}))} />
          </Field>
          <FieldRow>
            <Field label="Beds"><input style={monoInp} type="number" value={form.beds||''} onChange={set('beds')} placeholder="3" /></Field>
            <Field label="Baths"><input style={monoInp} type="number" value={form.baths||''} onChange={set('baths')} placeholder="2" /></Field>
            <Field label="Sq Ft"><input style={monoInp} type="number" value={form.sqft||''} onChange={set('sqft')} placeholder="1850" /></Field>
          </FieldRow>
          <Field label="Status">
            <select style={inp} value={form.status||'analyzing'} onChange={set('status')}>
              {STATUSES.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>

          <div className="drawer-section">Valuation</div>
          <Field label="After Renovation Value ($)"><input style={{ ...monoInp, borderLeft:'3px solid #D97825' }} type="number" value={form.arv||''} onChange={set('arv')} placeholder="385000" /></Field>
          <FieldRow>
            <Field label="As-Is Deduction %"><input style={monoInp} type="number" value={form.asis_pct||50} onChange={set('asis_pct')} /></Field>
            <Field label="As-Is Override ($)"><input style={monoInp} type="number" value={form.asis_override||''} onChange={set('asis_override')} placeholder="Auto" /></Field>
          </FieldRow>
          <FieldRow>
            <Field label="Profit Margin %"><input style={monoInp} type="number" value={form.profit_margin||15} onChange={set('profit_margin')} /></Field>
            <Field label="Cash Offer Override ($)"><input style={monoInp} type="number" value={form.cash_offer_override||''} onChange={set('cash_offer_override')} placeholder="Auto" /></Field>
          </FieldRow>

          {/* Live 3-option preview */}
          {form.arv && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
              {[['Cash Offer',fmt(d.cashOffer),'#3B6D11'],['As-Is Net',`~${fmt(d.opt2Net)}`,'#2D6FAF'],['Full Retail',`~${fmt(d.opt3Net)}`,'#D97825']].map(([l,v,c])=>(
                <div key={l} style={{ background:'#FAFAF8', borderRadius:6, padding:'8px 10px', borderTop:`3px solid ${c}` }}>
                  <div style={{ fontSize:10, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.8 }}>{l}</div>
                  <div style={{ fontSize:15, fontWeight:700, fontFamily:'monospace', color:c, marginTop:2 }}>{v}</div>
                </div>
              ))}
            </div>
          )}

          <div className="drawer-section">Repairs ({fmt(d.reno)} total)</div>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <tbody>
              {repairs.map(r=>(
                <tr key={r.id}>
                  <td style={{ paddingBottom:6, paddingRight:6 }}><input style={{ ...inp, fontSize:12 }} value={r.name} onChange={e=>updateRepair(r.id,'name',e.target.value)} placeholder="Item" /></td>
                  <td style={{ paddingBottom:6, paddingRight:6, width:110 }}><input style={{ ...monoInp, fontSize:12, textAlign:'right' }} type="number" value={r.cost} onChange={e=>updateRepair(r.id,'cost',e.target.value)} placeholder="0" /></td>
                  <td style={{ paddingBottom:6, width:24, textAlign:'center' }}><button onClick={()=>removeRepair(r.id)} style={{ background:'none', border:'none', color:'#D6D2CA', cursor:'pointer', fontSize:16, padding:0 }}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={addRepair} style={{ background:'transparent', border:'1px dashed #D6D2CA', borderRadius:6, padding:'6px', color:'#9ca3af', fontSize:12, cursor:'pointer', fontFamily:'inherit', width:'100%' }}>+ Add Line Item</button>
        </div>
      )}

      {/* ── DEAL TAB (NHC) ── */}
      {tab==='purchase' && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ background:'#f0fdf4', borderRadius:6, padding:'8px 12px', fontSize:11, color:'#3B6D11', fontWeight:600 }}>NHC — Commission Tracking</div>


          <Field label="Source Campaign">
            <select style={inp} value={form.mailing_id||''} onChange={set('mailing_id')}>
              <option value="">No specific campaign</option>
              {mailings.map(m=><option key={m.id} value={m.id}>{m.campaign_name?.replace(/^Campaign \d+ — /,'')} {m.drop_date?`(${m.drop_date})`:''}</option>)}
            </select>
          </Field>
          <FieldRow>
            <Field label="Commission %"><input style={monoInp} type="number" value={form.commission_pct||''} onChange={e=>{ const v=e.target.value; setForm(f=>({...f,commission_pct:v,commission_earned:f.arv&&v?(parseFloat(f.arv)*parseFloat(v)/100).toFixed(2):f.commission_earned})) }} placeholder="3" /></Field>
            <Field label="Commission Earned ($)"><input style={monoInp} type="number" value={form.commission_earned||''} onChange={set('commission_earned')} placeholder="Auto" /></Field>
          </FieldRow>
          <Field label="Offer Date"><input style={inp} type="date" value={form.offer_date||''} onChange={set('offer_date')} /></Field>
          <Field label="Notes"><textarea style={{ ...inp, minHeight:72, resize:'vertical' }} value={form.nhc_notes||''} onChange={set('nhc_notes')} placeholder="Lead source, agent, deal notes..." /></Field>

          {form.commission_earned && (
            <div style={{ background:'#f0fdf4', borderRadius:8, padding:14 }}>
              <div style={{ fontSize:11, color:'#6b7280', textTransform:'uppercase', letterSpacing:0.8 }}>NHC Commission</div>
              <div style={{ fontSize:24, fontWeight:700, color:'#3B6D11', marginTop:2 }}>{fmt(form.commission_earned)}</div>
            </div>
          )}
        </div>
      )}

      {/* ── INVESTMENT TAB (BPV) ── */}
      {tab==='investment' && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ background:'#f0f6ff', borderRadius:6, padding:'8px 12px', fontSize:11, color:'#2D6FAF', fontWeight:600 }}>BE Property Ventures — Investment Tracking</div>

          {/* Flip / Hold toggle */}
          <Field label="Investment Type">
            <div style={{ display:'flex', gap:8 }}>
              {[['flip','Flip'],['hold','Hold / Rental'],['none','Not BPV']].map(([val,label])=>(
                <button key={val} onClick={()=>setForm(f=>({...f,investment_type:val==='none'?null:val}))} style={{
                  flex:1, padding:'8px', border:'none', borderRadius:6, cursor:'pointer',
                  fontWeight:(form.investment_type||'none')===val?700:400, fontSize:12, fontFamily:'inherit',
                  background:(form.investment_type||'none')===val?'#2D6FAF':'#F0EDE6',
                  color:(form.investment_type||'none')===val?'#fff':'#6b7280'
                }}>{label}</button>
              ))}
            </div>
          </Field>

          {(form.investment_type==='flip'||form.investment_type==='hold') && (<>
            <div className="drawer-section">Acquisition</div>
            <FieldRow>
              <Field label="Purchase Date"><input style={inp} type="date" value={form.purchase_date||''} onChange={set('purchase_date')} /></Field>
              <Field label="Purchase Price ($)"><input style={monoInp} type="number" value={form.purchase_price||''} onChange={set('purchase_price')} /></Field>
            </FieldRow>
            <FieldRow>
              <Field label="Closing Costs ($)"><input style={monoInp} type="number" value={form.closing_costs||''} onChange={set('closing_costs')} /></Field>
              <Field label="Rehab Cost ($)"><input style={monoInp} type="number" value={form.rehab_cost||''} onChange={set('rehab_cost')} /></Field>
            </FieldRow>
          </>)}

          {form.investment_type==='flip' && (<>
            <div className="drawer-section">Sale</div>
            <FieldRow>
              <Field label="Sale Price ($)"><input style={monoInp} type="number" value={form.sale_price||''} onChange={set('sale_price')} /></Field>
              <Field label="Sale Date"><input style={inp} type="date" value={form.sale_date||''} onChange={set('sale_date')} /></Field>
            </FieldRow>
            <Field label="Days on Market"><input style={monoInp} type="number" value={form.days_on_market||''} onChange={set('days_on_market')} /></Field>

            {form.purchase_price && form.sale_price && (() => {
              const cost = (parseFloat(form.purchase_price)||0)+(parseFloat(form.closing_costs)||0)+(parseFloat(form.rehab_cost)||0)
              const profit = (parseFloat(form.sale_price)||0)-cost
              const roi = cost>0?((profit/cost)*100).toFixed(1):null
              return (
                <div style={{ background:profit>=0?'#f0fdf4':'#fef2f2', borderRadius:8, padding:14, display:'flex', justifyContent:'space-between' }}>
                  <div><div style={{ fontSize:11, color:'#6b7280', textTransform:'uppercase', letterSpacing:0.8 }}>BPV Profit</div><div style={{ fontSize:22, fontWeight:700, color:profit>=0?'#3B6D11':'#B91C1C' }}>{profit>=0?'+':''}{fmt(profit)}</div></div>
                  {roi && <div style={{ textAlign:'right' }}><div style={{ fontSize:11, color:'#6b7280', textTransform:'uppercase', letterSpacing:0.8 }}>ROI</div><div style={{ fontSize:22, fontWeight:700, color:profit>=0?'#3B6D11':'#B91C1C' }}>{roi}%</div></div>}
                </div>
              )
            })()}
          </>)}

          {form.investment_type==='hold' && (<>
            <div className="drawer-section">Mortgage</div>
            <FieldRow>
              <Field label="Mortgage Balance ($)"><input style={monoInp} type="number" value={form.mortgage_amount||''} onChange={set('mortgage_amount')} /></Field>
              <Field label="Monthly Payment ($)"><input style={monoInp} type="number" value={form.monthly_payment||''} onChange={set('monthly_payment')} /></Field>
            </FieldRow>

            <div className="drawer-section">Income History</div>

            {/* Add income row */}
            {form.id && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr auto', gap:8, alignItems:'end' }}>
                <Field label="Month"><input style={inp} type="month" value={incomeForm.income_month} onChange={e=>setIncomeForm(f=>({...f,income_month:e.target.value}))} /></Field>
                <Field label="Rent ($)"><input style={monoInp} type="number" value={incomeForm.rent_received} onChange={e=>setIncomeForm(f=>({...f,rent_received:e.target.value}))} placeholder="950" /></Field>
                <Field label="Expenses ($)"><input style={monoInp} type="number" value={incomeForm.expenses} onChange={e=>setIncomeForm(f=>({...f,expenses:e.target.value}))} placeholder="620" /></Field>
                <button onClick={addIncome} style={{ background:'#B8892A', color:'#fff', border:'none', borderRadius:6, padding:'9px 12px', cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:600, marginBottom:0 }}>Add</button>
              </div>
            )}

            {income.length>0 && (
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead><tr style={{ background:'#F0EDE6' }}>
                  {['Month','Rent','Expenses','Net'].map(h=><th key={h} style={{ padding:'5px 10px', textAlign:'left', fontSize:10, fontWeight:600, color:'#6b7280', textTransform:'uppercase' }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {income.map((inc,i)=>{
                    const net=(parseFloat(inc.rent_received)||0)-(parseFloat(inc.expenses)||0)
                    return (
                      <tr key={inc.id} style={{ background:i%2===0?'#fff':'#FAFAF8', borderTop:'0.5px solid #F0EDE6' }}>
                        <td style={{ padding:'6px 10px' }}>{inc.income_month?new Date(inc.income_month+'-01').toLocaleDateString('en-US',{month:'short',year:'numeric'}):'—'}</td>
                        <td style={{ padding:'6px 10px', fontFamily:'monospace', color:'#3B6D11' }}>{fmt(inc.rent_received)}</td>
                        <td style={{ padding:'6px 10px', fontFamily:'monospace', color:'#B91C1C' }}>{fmt(inc.expenses)}</td>
                        <td style={{ padding:'6px 10px', fontFamily:'monospace', fontWeight:700, color:net>=0?'#3B6D11':'#B91C1C' }}>{net>=0?'+':''}{fmt(net)}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot><tr style={{ borderTop:'2px solid #D6D2CA', background:'#F0EDE6' }}>
                  <td style={{ padding:'6px 10px', fontWeight:700, fontSize:11 }}>NET</td>
                  <td style={{ padding:'6px 10px', fontFamily:'monospace', fontWeight:700, color:'#3B6D11' }}>{fmt(totalIncome)}</td>
                  <td style={{ padding:'6px 10px', fontFamily:'monospace', fontWeight:700, color:'#B91C1C' }}>{fmt(totalExp)}</td>
                  <td style={{ padding:'6px 10px', fontFamily:'monospace', fontWeight:700, color:(totalIncome-totalExp)>=0?'#3B6D11':'#B91C1C' }}>{(totalIncome-totalExp)>=0?'+':''}{fmt(totalIncome-totalExp)}</td>
                </tr></tfoot>
              </table>
            )}
          </>)}

          {form.investment_type && <Field label="BPV Notes"><textarea style={{ ...inp, minHeight:60, resize:'vertical' }} value={form.bpv_notes||''} onChange={set('bpv_notes')} /></Field>}
        </div>
      )}

      {/* Footer */}
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:20, paddingTop:16, borderTop:'1px solid #F0EDE6' }}>
        {!isNew && <Btn variant="danger" onClick={del}>Delete</Btn>}
        <div style={{ display:'flex', gap:8, marginLeft:'auto' }}>
          <Btn variant="outline" onClick={onClose}>Cancel</Btn>
          <Btn onClick={save} disabled={saving||!form.address} style={{ minWidth:80 }}>
            {saving?'Saving…':saved?'✓ Saved':'Save'}
          </Btn>
        </div>
      </div>
    </Drawer>
  )
}
