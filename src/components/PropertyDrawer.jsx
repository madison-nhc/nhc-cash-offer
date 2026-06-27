import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase.js'
import { Field, FieldRow, inp, monoInp, Btn, fmt, fmtK } from './ui.jsx'
import Drawer from './Drawer.jsx'
import ProposalModal from './ProposalModal.jsx'
import AddressInput from './AddressInput.jsx'

const DISP_OPTIONS = [
  { value:'listing',  label:'Listing',       color:'#3B6D11',  desc:'NHC listed this property' },
  { value:'wholesale',label:'Wholesale',     color:'#6b21a8',  desc:'Sold off-market to a buyer' },
  { value:'flip',     label:'Cash Purchase', color:'#2D6FAF',  desc:'BPV purchased this property' },
  { value:'hold',     label:'Cash Purchase', color:'#2D6FAF',  desc:'BPV purchased this property' },
  { value:'lost',     label:'Lost / Passed', color:'#9ca3af',  desc:'Did not move forward' },
]

// Unique top-level options (flip and hold share "Cash Purchase")
const TOP_LEVEL = [
  { value:'listing',  label:'Listing',       color:'#3B6D11' },
  { value:'wholesale',label:'Wholesale',     color:'#6b21a8' },
  { value:'purchase', label:'Cash Purchase', color:'#2D6FAF' },
  { value:'lost',     label:'Lost / Passed', color:'#9ca3af' },
]

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
  const [showProposal, setShowProposal] = useState(false)
  const autoSaveTimer = useRef(null)
  const [incomeForm, setIncomeForm] = useState({ income_month:'', rent_received:'', expenses:'', notes:'' })

  // Top-level disposition selection: listing | wholesale | purchase | lost
  // purchase sub-type: flip | hold
  const topDisp = form.disposition==='flip'||form.disposition==='hold' ? 'purchase' : (form.disposition||null)
  const purchaseType = (form.disposition==='flip'||form.disposition==='hold') ? form.disposition : 'flip'

  useEffect(() => {
    if (property) {
      setForm({ ...property })
      setRepairs(property.repair_items?.length ? property.repair_items.map((r,i)=>({...r,id:i})) : DEFAULT_REPAIRS.map((r,i)=>({...r,id:i})))
      setTab('analyzer')
      if (property.id && (property.disposition==='hold')) loadIncome(property.id)
    }
  }, [property])

  async function loadIncome(id) {
    const { data } = await supabase.from('property_income').select('*').eq('property_id',id).order('income_month',{ascending:false})
    setIncome(data||[])
  }

  const set = k => e => setForm(f=>({...f,[k]:e.target.value}))
  const isNew = !form.id
  const d = calcOffers(form, repairs)

  const totalCost  = (parseFloat(form.purchase_price)||0)+(parseFloat(form.closing_costs)||0)+(parseFloat(form.rehab_cost)||0)
  const flipProfit = form.sale_price ? (parseFloat(form.sale_price)||0)-totalCost : null
  const totalIncome = income.reduce((s,i)=>s+(parseFloat(i.rent_received)||0),0)
  const totalExp    = income.reduce((s,i)=>s+(parseFloat(i.expenses)||0),0)

  function setTopDisp(val) {
    if (val==='purchase') {
      setForm(f=>({...f, disposition:'flip'}))
    } else {
      setForm(f=>({...f, disposition:val}))
    }
  }

  function setPurchaseType(val) {
    setForm(f=>({...f, disposition:val}))
    if (val==='hold') loadIncome(form.id)
  }

  const save = useCallback(async () => {
    if (!form.address) return
    const payload = {
      address:form.address, beds:form.beds||null, baths:form.baths||null, sqft:form.sqft||null,
      arv:form.arv||null, asis_pct:form.asis_pct||50, asis_override:form.asis_override||null,
      profit_margin:form.profit_margin||15, profit_override:form.profit_override||null,
      cash_offer_override:form.cash_offer_override||null,
      repair_items: repairs.filter(r=>r.name||r.cost).map(r=>({name:r.name,cost:parseFloat(r.cost)||0})),
      comm_cash_pct:form.comm_cash_pct||9, comm_list_pct:form.comm_list_pct||6,
      hold_cash_pct:form.hold_cash_pct||0.75, hold_cash_months:form.hold_cash_months||6,
      hold_opt2_pct:form.hold_opt2_pct||0.5, hold_opt2_months:form.hold_opt2_months||3,
      hold_opt3_pct:form.hold_opt3_pct||0.5, hold_opt3_months:form.hold_opt3_months||6,
      mailing_id:form.mailing_id||null,
      commission_pct:form.commission_pct||null, commission_earned:form.commission_earned||null, commission_min:form.commission_min||5000,
      nhc_notes:form.nhc_notes||null,
      purchase_price:form.purchase_price||null, closing_costs:form.closing_costs||null,
      rehab_cost:form.rehab_cost||null, sale_price:form.sale_price||null,
      sale_date:form.sale_date||null, days_on_market:form.days_on_market||null,
      mortgage_amount:form.mortgage_amount||null, monthly_payment:form.monthly_payment||null,
      bpv_notes:form.bpv_notes||null,
      purchase_date:form.purchase_date||null, sold_date:form.sold_date||null,
      disposition:form.disposition||null,
      disposition_date:form.disposition_date||null,
      wholesale_fee:form.wholesale_fee||null,
      wholesale_buyer:form.wholesale_buyer||null,
      lost_reason:form.lost_reason||null,
      list_date:form.list_date||null,
      entity:'NHC',
      // derive status from disposition for backward compat
      status: form.disposition==='lost' ? 'passed'
            : form.disposition==='listing' ? 'active'
            : form.disposition==='wholesale' ? 'sold'
            : (form.disposition==='flip'||form.disposition==='hold') ? (form.sale_price||form.purchase_date ? 'purchased' : 'analyzing')
            : 'analyzing',
      investment_type: form.disposition==='flip' ? 'flip' : form.disposition==='hold' ? 'hold' : null,
    }
    if (isNew) await supabase.from('properties').insert(payload)
    else await supabase.from('properties').update(payload).eq('id',form.id)
    onSave()
  }, [form, repairs, income])

  // Auto-save: fires 1.2s after any form change (for existing records)
  useEffect(() => {
    if (!form.id || !form.address) return
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => save(), 1200)
    return () => clearTimeout(autoSaveTimer.current)
  }, [form, repairs])

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

  const dispColor = form.disposition==='listing'?'#3B6D11':form.disposition==='wholesale'?'#6b21a8':(form.disposition==='flip'||form.disposition==='hold')?'#2D6FAF':form.disposition==='lost'?'#9ca3af':'#B8892A'
  const dispLabel = form.disposition==='listing'?'Listing':form.disposition==='wholesale'?'Wholesale':form.disposition==='flip'?'Flip':form.disposition==='hold'?'Hold':form.disposition==='lost'?'Lost':null

  if (!property) return null

  return (
    <Drawer open={open} onClose={onClose} width={580}
      title={form.address||'New Property'}
      subtitle={
        <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:4 }}>
          {dispLabel && (
            <span style={{ background:dispColor+'20', color:dispColor, border:`1px solid ${dispColor}40`, borderRadius:4, padding:'2px 8px', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:0.8 }}>
              {dispLabel}
            </span>
          )}
          {!dispLabel && <span style={{ fontSize:11, color:'#9ca3af' }}>Analyzing</span>}
        </div>
      }>

      {/* Tab switcher */}
      <div style={{ display:'flex', gap:0, borderBottom:'2px solid #F0EDE6', marginBottom:16, marginTop:8 }}>
        {['analyzer','disposition'].map(t=>(
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

          {form.arv && (
            <button onClick={()=>setShowProposal(true)} style={{ background:'#2D6FAF', color:'#fff', border:'none', borderRadius:6, padding:'10px 16px', cursor:'pointer', fontSize:13, fontWeight:700, fontFamily:'inherit', width:'100%', marginTop:4 }}>
              View Offer PDF
            </button>
          )}
          <Field label="Notes"><textarea style={{ ...inp, minHeight:56, resize:'vertical' }} value={form.nhc_notes||''} onChange={set('nhc_notes')} placeholder="Seller situation, offer context..." /></Field>
        </div>
      )}

      {/* ── DISPOSITION TAB ── */}
      {tab==='disposition' && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

          {/* Top-level selector */}
          <div className="drawer-section">What happened with this property?</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {TOP_LEVEL.map(opt=>(
              <button key={opt.value} onClick={()=>setTopDisp(opt.value)} style={{
                padding:'12px', border:`2px solid ${topDisp===opt.value?opt.color:'#D6D2CA'}`,
                borderRadius:8, cursor:'pointer', background:topDisp===opt.value?opt.color+'12':'#fff',
                textAlign:'left', fontFamily:'inherit'
              }}>
                <div style={{ fontSize:12, fontWeight:700, color:topDisp===opt.value?opt.color:'#2C2C2C' }}>{opt.label}</div>
              </button>
            ))}
          </div>

          {/* ── LISTING fields ── */}
          {topDisp==='listing' && (
            <>
              <div className="drawer-section">Listing Details</div>
              <FieldRow>
                <Field label="List Date"><input style={inp} type="date" value={form.list_date||''} onChange={set('list_date')} /></Field>
                <Field label="Sale Price ($)"><input style={monoInp} type="number" value={form.sale_price||''} onChange={set('sale_price')} placeholder="285000" /></Field>
              </FieldRow>
              <FieldRow>
                <Field label="Commission %">
                  <input style={monoInp} type="number" value={form.commission_pct||''} placeholder="3" onChange={e=>{
                    const pct=parseFloat(e.target.value)||0
                    const min=parseFloat(form.commission_min)||5000
                    const earned=form.sale_price?Math.max(min,parseFloat(form.sale_price)*pct/100):''
                    setForm(f=>({...f,commission_pct:e.target.value,commission_earned:earned?earned.toFixed(2):f.commission_earned}))
                  }} />
                </Field>
                <Field label="Commission Earned ($)"><input style={monoInp} type="number" value={form.commission_earned||''} onChange={set('commission_earned')} placeholder="Auto" /></Field>
              </FieldRow>
              <FieldRow>
                <Field label="Close Date"><input style={inp} type="date" value={form.disposition_date||''} onChange={set('disposition_date')} /></Field>
                <Field label="Days on Market"><input style={monoInp} type="number" value={form.days_on_market||''} onChange={set('days_on_market')} /></Field>
              </FieldRow>
              {form.commission_earned && (
                <div style={{ background:'#f0fdf4', borderRadius:8, padding:'10px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:12, color:'#6b7280' }}>NHC Commission</span>
                  <span style={{ fontSize:16, fontWeight:700, fontFamily:'monospace', color:'#3B6D11' }}>{fmt(form.commission_earned)}</span>
                </div>
              )}
            </>
          )}

          {/* ── WHOLESALE fields ── */}
          {topDisp==='wholesale' && (
            <>
              <div className="drawer-section">Wholesale Details</div>
              <FieldRow>
                <Field label="Sale Price ($)"><input style={monoInp} type="number" value={form.sale_price||''} onChange={set('sale_price')} placeholder="140000" /></Field>
                <Field label="Wholesale Fee ($)"><input style={monoInp} type="number" value={form.wholesale_fee||''} onChange={set('wholesale_fee')} placeholder="10000" /></Field>
              </FieldRow>
              <FieldRow>
                <Field label="Buyer"><input style={inp} type="text" value={form.wholesale_buyer||''} onChange={set('wholesale_buyer')} placeholder="Buyer name or company" /></Field>
                <Field label="Close Date"><input style={inp} type="date" value={form.disposition_date||''} onChange={set('disposition_date')} /></Field>
              </FieldRow>
              <FieldRow>
                <Field label="Commission %">
                  <input style={monoInp} type="number" value={form.commission_pct||''} placeholder="3" onChange={e=>{
                    const pct=parseFloat(e.target.value)||0
                    const min=parseFloat(form.commission_min)||5000
                    const earned=form.sale_price?Math.max(min,parseFloat(form.sale_price)*pct/100):''
                    setForm(f=>({...f,commission_pct:e.target.value,commission_earned:earned?earned.toFixed(2):f.commission_earned}))
                  }} />
                </Field>
                <Field label="Commission Earned ($)"><input style={monoInp} type="number" value={form.commission_earned||''} onChange={set('commission_earned')} placeholder="Auto" /></Field>
              </FieldRow>
              {form.wholesale_fee && (
                <div style={{ background:'#f5f0ff', borderRadius:8, padding:'10px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:12, color:'#6b7280' }}>Wholesale Fee</span>
                  <span style={{ fontSize:16, fontWeight:700, fontFamily:'monospace', color:'#6b21a8' }}>{fmt(form.wholesale_fee)}</span>
                </div>
              )}
            </>
          )}

          {/* ── CASH PURCHASE fields ── */}
          {topDisp==='purchase' && (
            <>
              {/* Hold / Flip toggle */}
              <div className="drawer-section">Investment Type</div>
              <div style={{ display:'flex', gap:8 }}>
                {[['flip','Flip','#D97825'],['hold','Hold','#2D6FAF']].map(([val,label,color])=>(
                  <button key={val} onClick={()=>setPurchaseType(val)} style={{
                    flex:1, padding:'10px', border:'none', borderRadius:6, cursor:'pointer',
                    fontWeight:purchaseType===val?700:400, fontSize:13, fontFamily:'inherit',
                    background:purchaseType===val?color:'#F0EDE6',
                    color:purchaseType===val?'#fff':'#6b7280'
                  }}>{label}</button>
                ))}
              </div>

              <div className="drawer-section">Acquisition</div>
              <FieldRow>
                <Field label="Purchase Date"><input style={inp} type="date" value={form.purchase_date||''} onChange={set('purchase_date')} /></Field>
                <Field label="Purchase Price ($)"><input style={monoInp} type="number" value={form.purchase_price||''} onChange={set('purchase_price')} placeholder="120000" /></Field>
              </FieldRow>
              <FieldRow>
                <Field label="Closing Costs ($)"><input style={monoInp} type="number" value={form.closing_costs||''} onChange={set('closing_costs')} placeholder="2500" /></Field>
                <Field label="Rehab Cost ($)"><input style={monoInp} type="number" value={form.rehab_cost||''} onChange={set('rehab_cost')} placeholder="0" /></Field>
              </FieldRow>

              <div className="drawer-section">NHC Commission on Purchase</div>
              <FieldRow>
                <Field label="Commission %">
                  <input style={monoInp} type="number" value={form.commission_pct||''} placeholder="3" onChange={e=>{
                    const pct=parseFloat(e.target.value)||0
                    const min=parseFloat(form.commission_min)||5000
                    const base=parseFloat(form.purchase_price)||0
                    const earned=base?Math.max(min,base*pct/100):''
                    setForm(f=>({...f,commission_pct:e.target.value,commission_earned:earned?earned.toFixed(2):f.commission_earned}))
                  }} />
                </Field>
                <Field label="Minimum ($)"><input style={monoInp} type="number" value={form.commission_min||5000} onChange={set('commission_min')} /></Field>
              </FieldRow>
              <Field label="Commission Earned ($)"><input style={monoInp} type="number" value={form.commission_earned||''} onChange={set('commission_earned')} placeholder="Auto — greater of % or minimum" /></Field>

              {/* Flip-specific: sale details */}
              {purchaseType==='flip' && (
                <>
                  <div className="drawer-section">Sale</div>
                  <FieldRow>
                    <Field label="Sale Price ($)"><input style={monoInp} type="number" value={form.sale_price||''} onChange={set('sale_price')} placeholder="215000" /></Field>
                    <Field label="Sale Date"><input style={inp} type="date" value={form.sale_date||''} onChange={set('sale_date')} /></Field>
                  </FieldRow>
                  <Field label="Days on Market"><input style={monoInp} type="number" value={form.days_on_market||''} onChange={set('days_on_market')} placeholder="24" /></Field>

                  {form.purchase_price && form.sale_price && (()=>{
                    const cost=(parseFloat(form.purchase_price)||0)+(parseFloat(form.closing_costs)||0)+(parseFloat(form.rehab_cost)||0)
                    const profit=(parseFloat(form.sale_price)||0)-cost
                    const roi=cost>0?((profit/cost)*100).toFixed(1):null
                    const comm=parseFloat(form.commission_earned)||0
                    return (
                      <div style={{ background:profit>=0?'#f0fdf4':'#fef2f2', borderRadius:8, padding:14, display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
                        <div><div style={{ fontSize:10, color:'#6b7280', textTransform:'uppercase', letterSpacing:0.8 }}>BPV Profit</div><div style={{ fontSize:20, fontWeight:700, color:profit>=0?'#3B6D11':'#B91C1C' }}>{profit>=0?'+':''}{fmt(profit)}</div></div>
                        <div><div style={{ fontSize:10, color:'#6b7280', textTransform:'uppercase', letterSpacing:0.8 }}>NHC Comm</div><div style={{ fontSize:20, fontWeight:700, color:'#B8892A' }}>{fmt(comm)}</div></div>
                        {roi && <div><div style={{ fontSize:10, color:'#6b7280', textTransform:'uppercase', letterSpacing:0.8 }}>ROI</div><div style={{ fontSize:20, fontWeight:700, color:profit>=0?'#3B6D11':'#B91C1C' }}>{roi}%</div></div>}
                      </div>
                    )
                  })()}
                </>
              )}

              {/* Hold-specific: mortgage + income */}
              {purchaseType==='hold' && (
                <>
                  <div className="drawer-section">Mortgage</div>
                  <FieldRow>
                    <Field label="Mortgage Balance ($)"><input style={monoInp} type="number" value={form.mortgage_amount||''} onChange={set('mortgage_amount')} placeholder="145000" /></Field>
                    <Field label="Monthly Payment ($)"><input style={monoInp} type="number" value={form.monthly_payment||''} onChange={set('monthly_payment')} placeholder="1050" /></Field>
                  </FieldRow>

                  <div className="drawer-section">Income History</div>
                  {form.id && (
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr auto', gap:8, alignItems:'end' }}>
                      <Field label="Month"><input style={inp} type="month" value={incomeForm.income_month} onChange={e=>setIncomeForm(f=>({...f,income_month:e.target.value}))} /></Field>
                      <Field label="Rent ($)"><input style={monoInp} type="number" value={incomeForm.rent_received} onChange={e=>setIncomeForm(f=>({...f,rent_received:e.target.value}))} placeholder="950" /></Field>
                      <Field label="Expenses ($)"><input style={monoInp} type="number" value={incomeForm.expenses} onChange={e=>setIncomeForm(f=>({...f,expenses:e.target.value}))} placeholder="620" /></Field>
                      <button onClick={addIncome} style={{ background:'#B8892A', color:'#fff', border:'none', borderRadius:6, padding:'9px 12px', cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:600 }}>Add</button>
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
                </>
              )}

              <Field label="BPV Notes"><textarea style={{ ...inp, minHeight:56, resize:'vertical' }} value={form.bpv_notes||''} onChange={set('bpv_notes')} /></Field>
            </>
          )}

          {/* ── LOST fields ── */}
          {topDisp==='lost' && (
            <>
              <div className="drawer-section">Lost / Passed Details</div>
              <Field label="Date Passed"><input style={inp} type="date" value={form.disposition_date||''} onChange={set('disposition_date')} /></Field>
              <Field label="Reason"><textarea style={{ ...inp, minHeight:72, resize:'vertical' }} value={form.lost_reason||''} onChange={set('lost_reason')} placeholder="Why did we pass on this property?" /></Field>
            </>
          )}

          {/* Mailing source — always visible on disposition tab */}
          {mailings.length>0 && (
            <>
              <div className="drawer-section">Source</div>
              <Field label="Mailing Campaign">
                <select style={inp} value={form.mailing_id||''} onChange={set('mailing_id')}>
                  <option value="">No specific campaign</option>
                  {mailings.map(m=><option key={m.id} value={m.id}>{m.campaign_name?.replace(/^Campaign \d+ — /,'')} {m.drop_date?`(${m.drop_date})`:''}</option>)}
                </select>
              </Field>
            </>
          )}
        </div>
      )}

      <div style={{ display:'flex', justifyContent:'space-between', marginTop:20, paddingTop:16, borderTop:'1px solid #F0EDE6' }}>
        {!isNew && <Btn variant="danger" onClick={del}>Delete</Btn>}
        <Btn variant="outline" onClick={onClose} style={{ marginLeft:'auto' }}>Close</Btn>
      </div>
    </Drawer>
    {showProposal && createPortal(
      <ProposalModal property={form} onClose={()=>setShowProposal(false)} />,
      document.body
    )}
  )
}
