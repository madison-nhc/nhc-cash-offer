import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase.js'
import { Field, FieldRow, inp, monoInp, Btn, fmt, fmtK } from './ui.jsx'
import Drawer from './Drawer.jsx'
import AddressInput from './AddressInput.jsx'
import RehabTracker from './RehabTracker.jsx'

// ── Stage options ─────────────────────────────────────────────────────────────
const STAGES = [
  { value:'Analyzing',        color:'#B8892A' },
  { value:'Under Contract',   color:'#2D6FAF' },
  { value:'Purchased',        color:'#D97825' },
  { value:'Rehabbing',        color:'#6b21a8' },
  { value:'Active Hold',      color:'#B8892A' },
  { value:'Active Listing',   color:'#3B6D11' },
  { value:'Active Wholesale', color:'#6b21a8' },
  { value:'Sold / Closed',    color:'#3B6D11' },
  { value:'Lost / Passed',    color:'#9ca3af' },
]

const STAGE_MAP = Object.fromEntries(STAGES.map(s=>[s.value,s.color]))

// ── Disposition options ───────────────────────────────────────────────────────
const DISP_OPTIONS = [
  { value:'listing',   label:'Listing',       color:'#3B6D11' },
  { value:'hold',      label:'Hold',          color:'#B8892A' },
  { value:'flip',      label:'Flip',          color:'#D97825' },
  { value:'wholesale', label:'Wholesale',     color:'#6b21a8' },
  { value:'lost',      label:'Lost / Passed', color:'#9ca3af' },
]

// ── Rehab stages ──────────────────────────────────────────────────────────────
const REHAB_STAGES = ['Not Started','Demo','Rough Work','Inspections','Finishes','Punch List','Complete']
const REHAB_COLOR  = {
  'Not Started':'#9ca3af','Demo':'#D97825','Rough Work':'#B8892A',
  'Inspections':'#2D6FAF','Finishes':'#6b21a8','Punch List':'#3B6D11','Complete':'#3B6D11',
}

const DEFAULT_REPAIRS = [
  { name:'Flooring',     sqft:'', pricePerSqft:'', cost:'' },
  { name:'Painting',     sqft:'', pricePerSqft:'', cost:'' },
  { name:'Demo / Cleanup', sqft:'', pricePerSqft:'', cost:'' },
  { name:'Drywall',      sqft:'', pricePerSqft:'', cost:'' },
  { name:'Appliances',   sqft:'', pricePerSqft:'', cost:'' },
  { name:'Plumbing',     sqft:'', pricePerSqft:'', cost:'' },
  { name:'Electrical',   sqft:'', pricePerSqft:'', cost:'' },
  { name:'Misc',         sqft:'', pricePerSqft:'', cost:'' },
]

// Truncate "123 Main Street, Lexington, KY 40502" → "123 Main Street"
function shortAddress(addr) {
  if (!addr) return 'New Property'
  const parts = addr.split(',')
  return parts[0].trim()
}

function calcOffers(p, repairs) {
  const arv       = parseFloat(p.arv)||0
  const reno      = repairs.reduce((s,r)=>s+(parseFloat(r.cost)||0),0)
  const commCash  = (parseFloat(p.comm_cash_pct)||9)/100
  const commList  = (parseFloat(p.comm_list_pct)||6)/100
  const profitPct = (parseFloat(p.profit_margin)||15)/100
  const profit    = p.profit_override ? parseFloat(p.profit_override) : arv*profitPct
  const asisDisc  = (parseFloat(p.asis_pct)||50)/100
  const asisVal   = p.asis_override ? parseFloat(p.asis_override) : arv-(asisDisc*reno)
  const cashHoldMo= parseFloat(p.hold_cash_months)||6
  const cashHold  = (parseFloat(p.hold_cash_pct)||0.75)/100*cashHoldMo*arv
  const cashOffer = p.cash_offer_override ? parseFloat(p.cash_offer_override) : arv-reno-(commCash*arv)-cashHold-profit
  const opt2HoldMo= parseFloat(p.hold_opt2_months)||3
  const opt2Comm  = commList*asisVal
  const opt2Hold  = (parseFloat(p.hold_opt2_pct)||0.5)/100*opt2HoldMo*arv
  const opt2Net   = asisVal-opt2Comm-opt2Hold
  const opt3HoldMo= parseFloat(p.hold_opt3_months)||6
  const opt3Comm  = commList*arv
  const opt3Hold  = (parseFloat(p.hold_opt3_pct)||0.5)/100*opt3HoldMo*arv
  const opt3Net   = arv-reno-opt3Comm-opt3Hold
  return {
    arv, reno, cashOffer, asisVal, opt2Net, opt3Net, profit,
    commCashPct:commCash, commListPct:commList,
    cashHold, cashHoldMo, opt2Comm, opt2Hold, opt2HoldMo, opt3Comm, opt3Hold, opt3HoldMo,
  }
}

function ProfitBox({ label, value, sub, color }) {
  return (
    <div style={{ background:color+'12', border:`1px solid ${color}30`, borderRadius:8, padding:'10px 14px', flex:1, minWidth:0 }}>
      <div style={{ fontSize:10, color:'#6b7280', textTransform:'uppercase', letterSpacing:0.8, marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:18, fontWeight:700, fontFamily:'monospace', color }}>{value}</div>
      {sub && <div style={{ fontSize:10, color:'#9ca3af', marginTop:2 }}>{sub}</div>}
    </div>
  )
}

function Toggle({ on, onToggle, label, sub }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0' }}>
      <div>
        <div style={{ fontSize:12, fontWeight:600, color:'#2C2C2C' }}>{label}</div>
        {sub && <div style={{ fontSize:11, color:'#9ca3af', marginTop:1 }}>{sub}</div>}
      </div>
      <button onClick={onToggle} style={{
        width:48, height:26, borderRadius:13, border:'none', cursor:'pointer',
        background:on?'#B8892A':'#D6D2CA', position:'relative', transition:'background 0.2s', flexShrink:0,
      }}>
        <div style={{
          position:'absolute', top:3, left:on?24:3, width:20, height:20,
          borderRadius:10, background:'#fff', transition:'left 0.2s',
          boxShadow:'0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </button>
    </div>
  )
}

export default function PropertyDrawer({ property, open, onClose, onSave, mailings=[], onViewOffer, inlineMode=false }) {
  const [form, setForm]           = useState({})
  const [repairs, setRepairs]     = useState([])
  const [tab, setTab]             = useState('analyzer')
  const [rehabCost, setRehabCost] = useState(null)

  const isNew   = !form.id
  const stage   = form.stage || 'Analyzing'
  const disp    = form.disposition || null
  const dispOpt = DISP_OPTIONS.find(o=>o.value===disp)
  const stageColor = STAGE_MAP[stage] || '#9ca3af'

  useEffect(() => {
    if (property) {
      setForm({ ...property, stage: property.stage || 'Analyzing' })
      setRepairs(
        property.repair_items?.length
          ? property.repair_items.map((r,i)=>({...r,id:i}))
          : DEFAULT_REPAIRS.map((r,i)=>({...r,id:i}))
      )
      setRehabCost(null)
      setTab('analyzer')
    }
  }, [property])

  const set    = k => e => setForm(f=>({...f,[k]:e.target.value}))
  const setVal = (k,v)  => setForm(f=>({...f,[k]:v}))
  const d = calcOffers(form, repairs)

  function addRepair() { setRepairs(rs=>[...rs,{id:Date.now(),name:'',sqft:'',pricePerSqft:'',cost:''}]) }
  function removeRepair(id) { setRepairs(rs=>rs.filter(r=>r.id!==id)) }
  function updateRepair(id,k,v) {
    setRepairs(rs=>rs.map(r=>{
      if (r.id!==id) return r
      const next={...r,[k]:v}
      if (k==='sqft'||k==='pricePerSqft') {
        const s=parseFloat(k==='sqft'?v:next.sqft)||0
        const p=parseFloat(k==='pricePerSqft'?v:next.pricePerSqft)||0
        next.cost=s&&p?String(s*p):''
      }
      return next
    }))
  }

  function calcCommission(pct, base, min) {
    const p=parseFloat(pct)||0, b=parseFloat(base)||0, m=parseFloat(min)||5000
    return b&&p ? Math.max(m, b*p/100) : null
  }

  async function save() {
    if (!form.address) return
    const rehab = rehabCost !== null ? rehabCost : (form.rehab_cost||null)
    const payload = {
      address:form.address, beds:form.beds||null, baths:form.baths||null,
      sqft:form.sqft||null, unit_count:parseInt(form.unit_count)||null,
      arv:form.arv||null, asis_pct:form.asis_pct||50, asis_override:form.asis_override||null,
      profit_margin:form.profit_margin||15, profit_override:form.profit_override||null,
      cash_offer_override:form.cash_offer_override||null,
      repair_items: repairs.filter(r=>r.name||r.cost).map(r=>({
        name:r.name, sqft:r.sqft||'', pricePerSqft:r.pricePerSqft||'', cost:parseFloat(r.cost)||0
      })),
      comm_cash_pct:form.comm_cash_pct||9, comm_list_pct:form.comm_list_pct||6,
      hold_cash_pct:form.hold_cash_pct||0.75, hold_cash_months:form.hold_cash_months||6,
      hold_opt2_pct:form.hold_opt2_pct||0.5, hold_opt2_months:form.hold_opt2_months||3,
      hold_opt3_pct:form.hold_opt3_pct||0.5, hold_opt3_months:form.hold_opt3_months||6,
      mailing_id:form.mailing_id||null,
      commission_pct:form.commission_pct||null, commission_earned:form.commission_earned||null,
      commission_min:form.commission_min||5000,
      nhc_notes:form.nhc_notes||null,
      purchase_price:form.purchase_price||null, closing_costs:form.closing_costs||null,
      rehab_cost:rehab, sale_price:form.sale_price||null, sale_date:form.sale_date||null,
      days_on_market:form.days_on_market||null, bpv_notes:form.bpv_notes||null,
      purchase_date:form.purchase_date||null, sold_date:form.sold_date||null,
      offer_date:form.offer_date||null,
      disposition:form.disposition||null, disposition_date:form.disposition_date||null,
      wholesale_fee:form.wholesale_fee||null, wholesale_buyer:form.wholesale_buyer||null,
      lost_reason:form.lost_reason||null, list_date:form.list_date||null,
      // Stage + post-occupancy
      stage:form.stage||'Analyzing',
      post_occupancy:form.post_occupancy||null,
      post_occupancy_end_date:form.post_occupancy_end_date||null,
      // Stage 1 fields
      acquisition_type:form.acquisition_type||'Purchased',
      owner:form.owner||'BPV', managed_by_bpv:form.managed_by_bpv||false,
      rehab_active:form.stage==='Rehabbing', // keep in sync
      rehab_stage:form.rehab_stage||'Not Started',
      rehab_start_date:form.rehab_start_date||null,
      converted_to_sale:form.converted_to_sale||false,
      conversion_date:form.conversion_date||null,
      conversion_disposition:form.conversion_disposition||null,
      entity:'NHC',
    }
    if (isNew) await supabase.from('cashoffer_properties').insert(payload)
    else await supabase.from('cashoffer_properties').update(payload).eq('id',form.id)
    onSave()
  }

  async function handleClose() { if (form.address) await save(); onClose() }
  async function del() {
    if (!confirm('Delete this property?')) return
    await supabase.from('cashoffer_properties').delete().eq('id',form.id)
    onSave(); onClose()
  }

  const TABS = [
    { key:'analyzer',    label:'Analyzer' },
    { key:'rehab',       label:'Rehab' },
    { key:'disposition', label:'Disposition' },
  ]

  // P&L helpers
  const rc         = rehabCost!==null ? rehabCost : (parseFloat(form.rehab_cost)||0)
  const totalCost  = (parseFloat(form.purchase_price)||0)+(parseFloat(form.closing_costs)||0)+rc
  const flipProfit = form.sale_price ? (parseFloat(form.sale_price)||0)-totalCost : null
  const flipROI    = totalCost>0&&flipProfit!==null ? ((flipProfit/totalCost)*100).toFixed(1) : null

  if (!property) return null

  // Post-occupancy badge label
  const poLabel = form.post_occupancy==='owner' ? 'Post-Occ: Owner' : form.post_occupancy==='renting_back' ? 'Post-Occ: Renting Back' : null

  const innerContent = (
    <>
      {/* ── Tab bar ── */}
      <div style={{ display:'flex', gap:0, borderBottom:'2px solid #F0EDE6', marginBottom:16, marginTop:8 }}>
        {TABS.map(t=>(
          <button key={t.key} onClick={()=>setTab(t.key)} style={{
            padding:'8px 18px', border:'none', background:'none', cursor:'pointer',
            fontSize:12, fontWeight:tab===t.key?700:400, fontFamily:'inherit',
            color:tab===t.key?'#B8892A':'#6b7280',
            borderBottom:tab===t.key?'2px solid #B8892A':'2px solid transparent',
            marginBottom:-2, letterSpacing:0.5,
          }}>{t.label}</button>
        ))}
      </div>

      {/* ══════════════ ANALYZER TAB ══════════════ */}
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
            <Field label="Units"><input style={monoInp} type="number" value={form.unit_count||''} onChange={set('unit_count')} placeholder="1" /></Field>
          </FieldRow>
          <FieldRow>
            <Field label="Owner">
              <select style={inp} value={form.owner||'BPV'} onChange={set('owner')}>
                {['BPV','NHC','Bob Sophiea','Eric Garverick','Other'].map(o=><option key={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Acquisition">
              <select style={inp} value={form.acquisition_type||'Purchased'} onChange={set('acquisition_type')}>
                <option value="Purchased">Purchased</option>
                <option value="Pre-Owned">Pre-Owned</option>
              </select>
            </Field>
          </FieldRow>

          <div className="drawer-section">Valuation</div>
          <Field label="After Renovation Value ($)">
            <input style={{ ...monoInp, borderLeft:'3px solid #D97825' }} type="number" value={form.arv||''} onChange={set('arv')} placeholder="385000" />
          </Field>
          <FieldRow>
            <Field label="As-Is Deduction %"><input style={monoInp} type="number" value={form.asis_pct||50} onChange={set('asis_pct')} /></Field>
            <Field label="As-Is Override ($)"><input style={monoInp} type="number" value={form.asis_override||''} onChange={set('asis_override')} placeholder="Auto" /></Field>
          </FieldRow>
          <FieldRow>
            <Field label="Profit Margin %"><input style={monoInp} type="number" value={form.profit_margin||15} onChange={set('profit_margin')} /></Field>
            <Field label="Cash Offer Override ($)"><input style={monoInp} type="number" value={form.cash_offer_override||''} onChange={set('cash_offer_override')} placeholder="Auto" /></Field>
          </FieldRow>
          <FieldRow>
            <Field label="Holding % / mo"><input style={monoInp} type="number" step="0.05" value={form.hold_opt3_pct||0.5} onChange={set('hold_opt3_pct')} /></Field>
            <Field label="Holding Months"><input style={monoInp} type="number" value={form.hold_opt3_months||6} onChange={set('hold_opt3_months')} /></Field>
          </FieldRow>

          {form.arv && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
              {[
                { label:'Cash Offer', value:d.cashOffer, color:'#3B6D11', rows:[
                  { l:`Comm (${(d.commCashPct*100).toFixed(1).replace(/\.0$/,'')}%)`, v:`−${fmt(d.commCashPct*d.arv)}` },
                  { l:`Holding (${d.cashHoldMo}mo)`, v:`−${fmt(d.cashHold)}` },
                  { l:'Profit margin', v:`−${fmt(d.profit)}` },
                ]},
                { label:'As-Is Net', value:d.opt2Net, color:'#2D6FAF', rows:[
                  { l:'List Price', v:fmt(d.asisVal) },
                  { l:`Comm (${(d.commListPct*100).toFixed(1).replace(/\.0$/,'')}%)`, v:`−${fmt(d.opt2Comm)}` },
                  { l:`Holding (${d.opt2HoldMo}mo)`, v:`−${fmt(d.opt2Hold)}` },
                ]},
                { label:'Full Retail', value:d.opt3Net, color:'#D97825', rows:[
                  { l:'Sale Price', v:fmt(d.arv) },
                  { l:'Repairs', v:`−${fmt(d.reno)}` },
                  { l:`Comm (${(d.commListPct*100).toFixed(1).replace(/\.0$/,'')}%)`, v:`−${fmt(d.opt3Comm)}` },
                ]},
              ].map(card=>(
                <div key={card.label} style={{ background:'#FAFAF8', borderRadius:6, padding:'8px 10px', borderTop:`3px solid ${card.color}` }}>
                  <div style={{ fontSize:10, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.8 }}>{card.label}</div>
                  <div style={{ fontSize:15, fontWeight:700, fontFamily:'monospace', color:card.color, marginTop:2 }}>{fmt(card.value)}</div>
                  <div style={{ marginTop:6, paddingTop:6, borderTop:'1px solid #F0EDE6', fontSize:10, color:'#6b7280', lineHeight:1.7 }}>
                    {card.rows.map(r=>(
                      <div key={r.l} style={{ display:'flex', justifyContent:'space-between' }}>
                        <span>{r.l}</span><span style={{ fontFamily:'monospace' }}>{r.v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="drawer-section">Repairs ({fmt(d.reno)} total)</div>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>
                {['Item','Sq Ft','$/Sq Ft','Total',''].map((h,i)=>(
                  <th key={h} style={{ textAlign:i>0?'right':'left', fontSize:10, color:'#9ca3af', fontWeight:600, textTransform:'uppercase', letterSpacing:0.5, paddingBottom:4, width:i===4?24:undefined }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {repairs.map(r=>(
                <tr key={r.id}>
                  <td style={{ paddingBottom:6, paddingRight:6 }}><input style={{ ...inp, fontSize:12 }} value={r.name||''} onChange={e=>updateRepair(r.id,'name',e.target.value)} placeholder="Item" /></td>
                  <td style={{ paddingBottom:6, paddingRight:6 }}><input style={{ ...monoInp, fontSize:12, textAlign:'right' }} type="number" value={r.sqft||''} onChange={e=>updateRepair(r.id,'sqft',e.target.value)} placeholder="0" /></td>
                  <td style={{ paddingBottom:6, paddingRight:6 }}><input style={{ ...monoInp, fontSize:12, textAlign:'right' }} type="number" step="0.01" value={r.pricePerSqft||''} onChange={e=>updateRepair(r.id,'pricePerSqft',e.target.value)} placeholder="0.00" /></td>
                  <td style={{ paddingBottom:6, paddingRight:6 }}>
                    <div style={{ ...monoInp, fontSize:12, textAlign:'right', background:'#FAFAF8', color:'#2C2C2C', fontWeight:600, display:'flex', alignItems:'center', justifyContent:'flex-end' }}>{r.cost?fmt(r.cost):'—'}</div>
                  </td>
                  <td style={{ paddingBottom:6, textAlign:'center' }}><button onClick={()=>removeRepair(r.id)} style={{ background:'none', border:'none', color:'#D6D2CA', cursor:'pointer', fontSize:16, padding:0 }}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={addRepair} style={{ background:'transparent', border:'1px dashed #D6D2CA', borderRadius:6, padding:'6px', color:'#9ca3af', fontSize:12, cursor:'pointer', fontFamily:'inherit', width:'100%' }}>+ Add Line Item</button>
          {form.arv && (
            <button onClick={()=>onViewOffer&&onViewOffer({...form, repair_items:repairs.filter(r=>r.name||r.cost).map(r=>({name:r.name,cost:parseFloat(r.cost)||0}))})}
              style={{ background:'#2D6FAF', color:'#fff', border:'none', borderRadius:6, padding:'10px 16px', cursor:'pointer', fontSize:13, fontWeight:700, fontFamily:'inherit', width:'100%', marginTop:4 }}>
              View Offer PDF
            </button>
          )}
          <Field label="Notes"><textarea style={{ ...inp, minHeight:56, resize:'vertical' }} value={form.nhc_notes||''} onChange={set('nhc_notes')} placeholder="Seller situation, offer context..." /></Field>
        </div>
      )}

      {/* ══════════════ REHAB TAB ══════════════ */}
      {tab==='rehab' && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ background:'#FAFAF8', borderRadius:8, padding:'12px 14px', border:'0.5px solid #D6D2CA' }}>
            <div style={{ fontSize:10, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.8, marginBottom:8 }}>Rehab Stage</div>
            <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
              {REHAB_STAGES.map(st=>{
                const active=(form.rehab_stage||'Not Started')===st
                const color=REHAB_COLOR[st]
                return (
                  <button key={st} onClick={()=>setVal('rehab_stage',st)} style={{
                    padding:'4px 10px', border:`1.5px solid ${active?color:'#D6D2CA'}`,
                    borderRadius:16, cursor:'pointer', fontSize:11, fontWeight:active?700:400,
                    fontFamily:'inherit', background:active?color:'#fff', color:active?'#fff':'#6b7280',
                    transition:'all 0.12s', whiteSpace:'nowrap',
                  }}>{st}</button>
                )
              })}
            </div>
            <div style={{ marginTop:10 }}>
              <Field label="Rehab Start Date">
                <input style={inp} type="date" value={form.rehab_start_date||''} onChange={set('rehab_start_date')} />
              </Field>
            </div>
          </div>

          {form.id ? (
            <RehabTracker property={form} repairItems={repairs} onChange={total=>setRehabCost(total)} />
          ) : (
            <div style={{ background:'#F0EDE6', borderRadius:8, padding:'14px', textAlign:'center', fontSize:12, color:'#9ca3af' }}>
              Save the property first to track rehab line items.
            </div>
          )}
        </div>
      )}

      {/* ══════════════ DISPOSITION TAB ══════════════ */}
      {tab==='disposition' && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

          {/* Disposition type pills */}
          <div>
            <div style={{ fontSize:10, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.8, marginBottom:8 }}>Type</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {DISP_OPTIONS.map(opt=>{
                const active=disp===opt.value
                return (
                  <button key={opt.value} onClick={()=>setVal('disposition', active?null:opt.value)} style={{
                    padding:'5px 12px', border:`1.5px solid ${active?opt.color:'#D6D2CA'}`,
                    borderRadius:20, cursor:'pointer', fontSize:11, fontWeight:active?700:400,
                    fontFamily:'inherit', background:active?opt.color:'#fff',
                    color:active?'#fff':'#6b7280', transition:'all 0.12s', whiteSpace:'nowrap',
                  }}>{opt.label}</button>
                )
              })}
            </div>
          </div>

          {!disp && (
            <div style={{ background:'#F0EDE6', borderRadius:8, padding:'14px', textAlign:'center', fontSize:12, color:'#9ca3af' }}>
              Select a type above to see relevant fields.
            </div>
          )}

          {/* ── LISTING ── */}
          {disp==='listing' && (<>
            <div className="drawer-section">Listing Details</div>
            <FieldRow>
              <Field label="List Date"><input style={inp} type="date" value={form.list_date||''} onChange={set('list_date')} /></Field>
              <Field label="Offer Date"><input style={inp} type="date" value={form.offer_date||''} onChange={set('offer_date')} /></Field>
            </FieldRow>
            <Field label="ARV / List Price ($)"><input style={monoInp} type="number" value={form.arv||''} onChange={set('arv')} placeholder="285000" /></Field>
            <div className="drawer-section">NHC Commission</div>
            <FieldRow>
              <Field label="Commission %">
                <input style={monoInp} type="number" value={form.commission_pct||''} placeholder="3"
                  onChange={e=>{ const e2=calcCommission(e.target.value,form.sale_price||form.arv,form.commission_min); setForm(f=>({...f,commission_pct:e.target.value,commission_earned:e2?e2.toFixed(2):f.commission_earned})) }} />
              </Field>
              <Field label="Minimum ($)"><input style={monoInp} type="number" value={form.commission_min||5000} onChange={set('commission_min')} /></Field>
            </FieldRow>
            <Field label="Commission Earned ($)"><input style={monoInp} type="number" value={form.commission_earned||''} onChange={set('commission_earned')} placeholder="Auto" /></Field>
            <div className="drawer-section">Sale</div>
            <FieldRow>
              <Field label="Sale Price ($)"><input style={monoInp} type="number" value={form.sale_price||''} onChange={set('sale_price')} placeholder="285000" /></Field>
              <Field label="Close Date"><input style={inp} type="date" value={form.disposition_date||''} onChange={set('disposition_date')} /></Field>
            </FieldRow>
            <Field label="Days on Market"><input style={monoInp} type="number" value={form.days_on_market||''} onChange={set('days_on_market')} /></Field>
            {(form.commission_earned||form.sale_price) && (
              <div style={{ display:'flex', gap:8, marginTop:4 }}>
                {form.commission_earned && <ProfitBox label="NHC Commission" value={fmt(form.commission_earned)} color="#3B6D11" />}
                {form.sale_price && <ProfitBox label="Sale Price" value={fmt(form.sale_price)} color="#2D6FAF" />}
              </div>
            )}
          </>)}

          {/* ── WHOLESALE ── */}
          {disp==='wholesale' && (<>
            <div className="drawer-section">Wholesale Details</div>
            <FieldRow>
              <Field label="Contract Price ($)"><input style={monoInp} type="number" value={form.purchase_price||''} onChange={set('purchase_price')} placeholder="140000" /></Field>
              <Field label="BPV Wholesale Fee ($)"><input style={monoInp} type="number" value={form.wholesale_fee||''} onChange={set('wholesale_fee')} placeholder="10000" /></Field>
            </FieldRow>
            <FieldRow>
              <Field label="Buyer"><input style={inp} type="text" value={form.wholesale_buyer||''} onChange={set('wholesale_buyer')} placeholder="Buyer name or company" /></Field>
              <Field label="Close Date"><input style={inp} type="date" value={form.disposition_date||''} onChange={set('disposition_date')} /></Field>
            </FieldRow>
            <div className="drawer-section">NHC Commission</div>
            <FieldRow>
              <Field label="Commission %">
                <input style={monoInp} type="number" value={form.commission_pct||''} placeholder="3"
                  onChange={e=>{ const e2=calcCommission(e.target.value,form.purchase_price,form.commission_min); setForm(f=>({...f,commission_pct:e.target.value,commission_earned:e2?e2.toFixed(2):f.commission_earned})) }} />
              </Field>
              <Field label="Commission Earned ($)"><input style={monoInp} type="number" value={form.commission_earned||''} onChange={set('commission_earned')} placeholder="Auto" /></Field>
            </FieldRow>
            {(form.wholesale_fee||form.commission_earned) && (
              <div style={{ display:'flex', gap:8, marginTop:4 }}>
                {form.wholesale_fee && <ProfitBox label="BPV Fee" value={fmt(form.wholesale_fee)} color="#6b21a8" />}
                {form.commission_earned && <ProfitBox label="NHC Commission" value={fmt(form.commission_earned)} color="#3B6D11" />}
              </div>
            )}
          </>)}

          {/* ── FLIP ── */}
          {disp==='flip' && (<>
            <div className="drawer-section">Acquisition</div>
            <FieldRow>
              <Field label="Purchase Date"><input style={inp} type="date" value={form.purchase_date||''} onChange={set('purchase_date')} /></Field>
              <Field label="Purchase Price ($)"><input style={monoInp} type="number" value={form.purchase_price||''} onChange={set('purchase_price')} placeholder="120000" /></Field>
            </FieldRow>
            <FieldRow>
              <Field label="Closing Costs ($)"><input style={monoInp} type="number" value={form.closing_costs||''} onChange={set('closing_costs')} placeholder="2500" /></Field>
              <Field label="Rehab Cost ($)">
                <input style={{ ...monoInp, color:rehabCost!==null?'#B8892A':undefined }}
                  type="number" value={rehabCost!==null?rehabCost:(form.rehab_cost||'')}
                  onChange={e=>setForm(f=>({...f,rehab_cost:e.target.value}))} placeholder="Auto from Rehab tab" />
              </Field>
            </FieldRow>
            <div className="drawer-section">NHC Commission on Purchase</div>
            <FieldRow>
              <Field label="Commission %">
                <input style={monoInp} type="number" value={form.commission_pct||''} placeholder="3"
                  onChange={e=>{ const e2=calcCommission(e.target.value,form.purchase_price,form.commission_min); setForm(f=>({...f,commission_pct:e.target.value,commission_earned:e2?e2.toFixed(2):f.commission_earned})) }} />
              </Field>
              <Field label="Minimum ($)"><input style={monoInp} type="number" value={form.commission_min||5000} onChange={set('commission_min')} /></Field>
            </FieldRow>
            <Field label="Commission Earned ($)"><input style={monoInp} type="number" value={form.commission_earned||''} onChange={set('commission_earned')} placeholder="Auto — greater of % or minimum" /></Field>
            <div className="drawer-section">Loan</div>
            <div style={{ background:'#FAFAF8', borderRadius:8, padding:'12px 14px', border:'0.5px solid #D6D2CA', fontSize:12, color:'#9ca3af', textAlign:'center' }}>
              Loan tracker coming in Stage 4.
            </div>
            <div className="drawer-section">Resale</div>
            <FieldRow>
              <Field label="Sale Price ($)"><input style={monoInp} type="number" value={form.sale_price||''} onChange={set('sale_price')} placeholder="215000" /></Field>
              <Field label="Sale Date"><input style={inp} type="date" value={form.sale_date||''} onChange={set('sale_date')} /></Field>
            </FieldRow>
            <Field label="Days on Market"><input style={monoInp} type="number" value={form.days_on_market||''} onChange={set('days_on_market')} placeholder="24" /></Field>
            {flipProfit!==null && (
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:4 }}>
                <ProfitBox label="BPV Profit" value={`${flipProfit>=0?'+':''}${fmt(flipProfit)}`} color={flipProfit>=0?'#3B6D11':'#B91C1C'} sub={flipROI?`${flipROI}% ROI`:null} />
                <ProfitBox label="NHC Commission" value={fmt(form.commission_earned)||'—'} color="#B8892A" />
                <ProfitBox label="Total Cost" value={fmt(totalCost)} color="#6b7280" />
              </div>
            )}
            <Field label="BPV Notes"><textarea style={{ ...inp, minHeight:56, resize:'vertical' }} value={form.bpv_notes||''} onChange={set('bpv_notes')} /></Field>
          </>)}

          {/* ── HOLD ── */}
          {disp==='hold' && (<>
            <div className="drawer-section">Acquisition</div>
            <FieldRow>
              <Field label="Purchase Date"><input style={inp} type="date" value={form.purchase_date||''} onChange={set('purchase_date')} /></Field>
              <Field label="Purchase Price ($)"><input style={monoInp} type="number" value={form.purchase_price||''} onChange={set('purchase_price')} placeholder="120000" /></Field>
            </FieldRow>
            <Field label="Closing Costs ($)"><input style={monoInp} type="number" value={form.closing_costs||''} onChange={set('closing_costs')} placeholder="2500" /></Field>
            <div className="drawer-section">NHC Commission on Purchase</div>
            <FieldRow>
              <Field label="Commission %">
                <input style={monoInp} type="number" value={form.commission_pct||''} placeholder="3"
                  onChange={e=>{ const e2=calcCommission(e.target.value,form.purchase_price,form.commission_min); setForm(f=>({...f,commission_pct:e.target.value,commission_earned:e2?e2.toFixed(2):f.commission_earned})) }} />
              </Field>
              <Field label="Commission Earned ($)"><input style={monoInp} type="number" value={form.commission_earned||''} onChange={set('commission_earned')} placeholder="Auto" /></Field>
            </FieldRow>
            <div className="drawer-section">Loan</div>
            <div style={{ background:'#FAFAF8', borderRadius:8, padding:'12px 14px', border:'0.5px solid #D6D2CA', fontSize:12, color:'#9ca3af', textAlign:'center' }}>
              Full loan tracker (amortization, refi support) coming in Stage 4.
            </div>
            <div className="drawer-section">Rent</div>
            <div style={{ background:'#FAFAF8', borderRadius:8, padding:'12px 14px', border:'0.5px solid #D6D2CA', fontSize:12, color:'#9ca3af', textAlign:'center' }}>
              Lease and rent payment tracker coming in Stage 5.
            </div>
            <div className="drawer-section">Convert to Sale</div>
            <div style={{ background:'#FAFAF8', borderRadius:8, padding:'12px 14px', border:'0.5px solid #D6D2CA' }}>
              <Toggle
                on={!!form.converted_to_sale}
                onToggle={()=>setVal('converted_to_sale',!form.converted_to_sale)}
                label="This hold is being sold"
                sub="Records the sale while preserving hold history"
              />
              {form.converted_to_sale && (<>
                <FieldRow>
                  <Field label="Sale Price ($)"><input style={monoInp} type="number" value={form.sale_price||''} onChange={set('sale_price')} placeholder="215000" /></Field>
                  <Field label="Sale Date"><input style={inp} type="date" value={form.conversion_date||''} onChange={set('conversion_date')} /></Field>
                </FieldRow>
                <Field label="Conversion Disposition">
                  <select style={inp} value={form.conversion_disposition||''} onChange={set('conversion_disposition')}>
                    <option value="">Select...</option>
                    <option value="Listing">Listing (NHC)</option>
                    <option value="Flip">Flip (BPV)</option>
                    <option value="Wholesale">Wholesale</option>
                  </select>
                </Field>
              </>)}
            </div>
            <Field label="BPV Notes"><textarea style={{ ...inp, minHeight:56, resize:'vertical' }} value={form.bpv_notes||''} onChange={set('bpv_notes')} /></Field>
          </>)}

          {/* ── LOST ── */}
          {disp==='lost' && (<>
            <div className="drawer-section">Lost / Passed Details</div>
            <Field label="Date Passed"><input style={inp} type="date" value={form.disposition_date||''} onChange={set('disposition_date')} /></Field>
            <Field label="Reason"><textarea style={{ ...inp, minHeight:72, resize:'vertical' }} value={form.lost_reason||''} onChange={set('lost_reason')} placeholder="Why did we pass on this property?" /></Field>
          </>)}

          {mailings.length>0 && (<>
            <div className="drawer-section">Source</div>
            <Field label="Mailing Campaign">
              <select style={inp} value={form.mailing_id||''} onChange={set('mailing_id')}>
                <option value="">No specific campaign</option>
                {mailings.map(m=><option key={m.id} value={m.id}>{m.campaign_name?.replace(/^Campaign \d+ — /,'')} {m.drop_date?`(${m.drop_date})`:''}</option>)}
              </select>
            </Field>
          </>)}
        </div>
      )}

      <div style={{ display:'flex', justifyContent:'space-between', marginTop:20, paddingTop:16, borderTop:'1px solid #F0EDE6' }}>
        {!isNew && <Btn variant="danger" onClick={del}>Delete</Btn>}
        <Btn variant="outline" onClick={handleClose} style={{ marginLeft:'auto' }}>Close</Btn>
      </div>
    </>
  )

  if (inlineMode) return <div style={{ padding:'0 16px 24px' }}>{innerContent}</div>

  return (
    <Drawer open={open} onClose={handleClose} width={580}
      title={shortAddress(form.address)}
      subtitle={
        <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:6, flexWrap:'wrap' }}>
          {/* Stage dropdown */}
          <select
            value={stage}
            onChange={e=>setVal('stage',e.target.value)}
            onClick={e=>e.stopPropagation()}
            style={{
              border:`1.5px solid ${stageColor}`, borderRadius:6, padding:'3px 8px',
              fontSize:11, fontWeight:700, fontFamily:'inherit',
              color:stageColor, background:stageColor+'12', cursor:'pointer', outline:'none',
            }}>
            {STAGES.map(s=><option key={s.value} value={s.value}>{s.value}</option>)}
          </select>

          {/* Post-occupancy — shown when stage is Purchased */}
          {stage==='Purchased' && (
            <select
              value={form.post_occupancy||''}
              onChange={e=>setVal('post_occupancy',e.target.value||null)}
              style={{
                border:'1.5px solid #D6D2CA', borderRadius:6, padding:'3px 8px',
                fontSize:11, fontFamily:'inherit', color:'#6b7280', background:'#fff',
                cursor:'pointer', outline:'none',
              }}>
              <option value="">Standard Closing</option>
              <option value="owner">Post-Occ: Owner Staying</option>
              <option value="renting_back">Post-Occ: Renting Back</option>
            </select>
          )}

          {/* Post-occupancy end date if set */}
          {form.post_occupancy && (
            <input type="date" value={form.post_occupancy_end_date||''} onChange={set('post_occupancy_end_date')}
              style={{ border:'1px solid #D6D2CA', borderRadius:6, padding:'3px 8px', fontSize:11, fontFamily:'inherit', color:'#6b7280', background:'#fff', cursor:'pointer', outline:'none' }} />
          )}

          {/* Disposition badge */}
          {dispOpt && (
            <span style={{ background:dispOpt.color+'20', color:dispOpt.color, border:`1px solid ${dispOpt.color}40`, borderRadius:4, padding:'2px 8px', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:0.8 }}>
              {dispOpt.label}
            </span>
          )}

          {/* Post-occ badge when not on Purchased stage */}
          {poLabel && stage!=='Purchased' && (
            <span style={{ background:'#fef9f0', color:'#B8892A', border:'1px solid #B8892A40', borderRadius:4, padding:'2px 8px', fontSize:10, fontWeight:700 }}>
              {poLabel}
            </span>
          )}
        </div>
      }>
      {innerContent}
    </Drawer>
  )
}

function Toggle({ on, onToggle, label, sub }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 0' }}>
      <div>
        <div style={{ fontSize:12, fontWeight:600, color:'#2C2C2C' }}>{label}</div>
        {sub && <div style={{ fontSize:11, color:'#9ca3af', marginTop:1 }}>{sub}</div>}
      </div>
      <button onClick={onToggle} style={{
        width:48, height:26, borderRadius:13, border:'none', cursor:'pointer',
        background:on?'#B8892A':'#D6D2CA', position:'relative', transition:'background 0.2s', flexShrink:0,
      }}>
        <div style={{ position:'absolute', top:3, left:on?24:3, width:20, height:20, borderRadius:10, background:'#fff', transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }} />
      </button>
    </div>
  )
}
