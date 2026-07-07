import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase.js'
import { Field, FieldRow, inp, monoInp, Btn, fmt, fmtK, DatePicker } from './ui.jsx'
import Drawer from './Drawer.jsx'
import AddressInput from './AddressInput.jsx'
import RehabRoundTracker from './RehabRoundTracker.jsx'
import RehabStatCards from './RehabOverview.jsx'
import LoanTracker from './LoanTracker.jsx'
import RentTracker from './RentTracker.jsx'
import LoanOverview from './LoanOverview.jsx'
import RentOverview from './RentOverview.jsx'

// ── Type options (primary) ────────────────────────────────────────────────────
const TYPE_OPTIONS = [
  { value:'Analyzing',       color:'#B8892A' },
  { value:'Flip',            color:'#D97825' },
  { value:'Hold',            color:'#B8892A' },
  { value:'Retail Listing',  color:'#3B6D11' },
  { value:'Wholesale',       color:'#6b21a8' },
  { value:'Lost',            color:'#9ca3af' },
]
const TYPE_COLOR = Object.fromEntries(TYPE_OPTIONS.map(t=>[t.value,t.color]))

// Legacy disposition <-> new type mapping (disposition kept in sync for Sold/Rehabs/PackageDeals pages)
const TYPE_TO_DISP = { 'Analyzing':null, 'Flip':'flip', 'Hold':'hold', 'Retail Listing':'listing', 'Wholesale':'wholesale', 'Lost':'lost' }

// Stages scoped per type — As-Is Retail Listing skips the two Reno stages
const STAGE_BY_TYPE = {
  'Analyzing':      [],
  'Flip':           ['Purchased','Rehab','Listed','Under Contract','Sold'],
  'Hold':           ['Purchased','Rehab','Rent Ready','Leased','Sold'],
  'Retail Listing': { 'As-Is':['Listed','Under Contract','Sold'], 'Reno':['Reno In Progress','Reno Completed','Listed','Under Contract','Sold'] },
  'Wholesale':      ['Under Contract','Assigned','Closed'],
  'Lost':           [],
}
const STAGE_COLOR = {
  Purchased:'#D97825', Rehab:'#6b21a8', Listed:'#3B6D11', 'Under Contract':'#2D6FAF', Sold:'#3B6D11',
  'Rent Ready':'#B8892A', Leased:'#3B6D11', 'Reno In Progress':'#D97825', 'Reno Completed':'#B8892A',
  Assigned:'#6b21a8', Closed:'#3B6D11',
}

function stagesForType(type, listingType) {
  const s = STAGE_BY_TYPE[type]
  if (!s) return []
  if (type==='Retail Listing') return s[listingType||'As-Is']
  return s
}

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
function zillowUrl(address) {
  if (!address || !address.trim()) return null
  return `https://www.zillow.com/homes/${address.trim().replace(/\s+/g,'-')}_rb/`
}

function driveFolderId(link) {
  if (!link) return null
  const trimmed = link.trim()
  const folderMatch = trimmed.match(/folders\/([a-zA-Z0-9_-]+)/)
  if (folderMatch) return folderMatch[1]
  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (idParamMatch) return idParamMatch[1]
  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed)) return trimmed // pasted raw ID
  return null
}

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
    arv, reno, cashOffer, asisVal, asisDeduction:asisDisc*reno, opt2Net, opt3Net, profit,
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

export default function PropertyDrawer({ property, open, onClose, onSave, mailings=[], onViewOffer, inlineMode=false, initialTab='analyzer' }) {
  const [form, setForm]           = useState({})
  const [repairs, setRepairs]     = useState([])
  const [tab, setTab]             = useState('analyzer')
  const [rehabCost, setRehabCost] = useState(null)
  const [loanOpen, setLoanOpen] = useState(false)
  const [selectedLoanId, setSelectedLoanId] = useState(null)
  const [rehabOpen, setRehabOpen] = useState(false)
  const [rentOpen, setRentOpen] = useState(false)
  const [editingPhotosLink, setEditingPhotosLink] = useState(false)

  const isNew   = !form.id
  const type       = form.type || 'Analyzing'
  const listingType = form.listing_type || 'As-Is'
  const disp    = TYPE_TO_DISP[type] // derived — kept in sync for Sold/Rehabs/PackageDeals pages
  const scopedStages = stagesForType(type, listingType)
  const stage   = form.stage || (scopedStages[0] || null)
  const typeColor  = TYPE_COLOR[type] || '#9ca3af'
  const stageColor = STAGE_COLOR[stage] || '#9ca3af'

  useEffect(() => {
    if (property) {
      const t = property.type || 'Analyzing'
      const lt = property.listing_type || 'As-Is'
      const stages = stagesForType(t, lt)
      setForm({ ...property, type:t, listing_type:lt, stage: property.stage || stages[0] || null })
      setRepairs(
        property.repair_items?.length
          ? property.repair_items.map((r,i)=>({...r,id:i}))
          : DEFAULT_REPAIRS.map((r,i)=>({...r,id:i}))
      )
      setRehabCost(null)
      setTab(initialTab)
      setEditingPhotosLink(false)
    }
  }, [property]) // eslint-disable-line react-hooks/exhaustive-deps

  // When type or listing_type changes, snap stage to the first valid stage for the new scope
  function setType(newType) {
    const lt = newType==='Retail Listing' ? (form.listing_type||'As-Is') : null
    const stages = stagesForType(newType, lt)
    setForm(f=>({ ...f, type:newType, listing_type:lt, stage: stages[0] || null }))
  }
  function setListingType(lt) {
    const stages = stagesForType('Retail Listing', lt)
    setForm(f=>({ ...f, listing_type:lt, stage: stages[0] || null }))
  }

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

  function calcCommission(pct, base) {
    const p=parseFloat(pct)||0, b=parseFloat(base)||0
    return b&&p ? b*p/100 : null
  }

  async function save() {
    if (!form.address) return
    const rehab = rehabCost !== null ? rehabCost : (form.rehab_cost||null)
    const payload = {
      address:form.address, beds:form.beds||null, baths:form.baths||null,
      photos_drive_link:form.photos_drive_link||null,
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
      source:form.source||null,
      commission_pct:form.commission_pct||null, commission_earned:form.commission_earned||null,
      commission_min:form.commission_min||5000,
      nhc_notes:form.nhc_notes||null,
      purchase_price:form.purchase_price||null, closing_costs:form.closing_costs||null,
      rehab_cost:rehab, sale_price:form.sale_price||null, sale_date:form.sale_date||null,
      days_on_market:form.days_on_market||null, bpv_notes:form.bpv_notes||null,
      purchase_date:form.purchase_date||null, sold_date:form.sold_date||null,
      offer_date:form.offer_date||null,
      disposition:disp, disposition_date:form.disposition_date||null,
      type:type, listing_type:type==='Retail Listing'?listingType:null,
      bpv_rehab_fee:form.bpv_rehab_fee||null,
      wholesale_fee:form.wholesale_fee||null, wholesale_buyer:form.wholesale_buyer||null,
      lost_reason:form.lost_reason||null, list_date:form.list_date||null,
      // Stage + post-occupancy
      stage:stage||null,
      post_occupancy:form.post_occupancy||null,
      post_occupancy_end_date:form.post_occupancy_end_date||null,
      post_occupancy_months:form.post_occupancy_months||null,
      post_occupancy_payment:form.post_occupancy_payment||null,
      // Stage 1 fields
      acquisition_type:form.acquisition_type||'Purchased',
      owner:form.owner||'BPV', managed_by_bpv:form.managed_by_bpv||false,
      rehab_active:stage==='Rehab', // keep in sync
      rehab_stage:form.rehab_stage||'Not Started',
      rehab_start_date:form.rehab_start_date||null,
      converted_to_sale:form.converted_to_sale||false,
      conversion_date:form.conversion_date||null,
      conversion_disposition:form.conversion_disposition||null,
    }
    const { error } = isNew
      ? await supabase.from('cashoffer_properties').insert(payload)
      : await supabase.from('cashoffer_properties').update(payload).eq('id',form.id)
    if (error) {
      alert(`Couldn't save this property.\n\n${error.message}\n\nYour changes are still in the form — please try again or let Madison know if this keeps happening.`)
      return false
    }
    onSave()
    return true
  }

  async function handleClose() {
    if (!form.address) { onClose(); return }
    const ok = await save()
    if (ok) onClose()
    // if save failed, keep the drawer open so nothing is lost
  }
  function guardedClose() {
    if (!form.address) { onClose(); return }
    if (confirm('Discard unsaved changes to this property?')) onClose()
  }
  async function del() {
    if (!confirm('Delete this deal? This cannot be undone.')) return
    await supabase.from('cashoffer_properties').delete().eq('id',form.id)
    onSave(); onClose()
  }

  const showLoanTab = type==='Flip' || type==='Hold' || form.acquisition_type==='Pre-Owned'
  const showRentTab = type==='Hold'

  useEffect(() => {
    if (tab==='loan' && !showLoanTab) setTab('analyzer')
    if (tab==='rent' && !showRentTab) setTab('analyzer')
  }, [showLoanTab, showRentTab]) // eslint-disable-line react-hooks/exhaustive-deps

  const TABS = [
    { key:'analyzer',    label:'Analyzer' },
    { key:'rehab',       label:'Rehab' },
    ...(showLoanTab ? [{ key:'loan', label:'Loan' }] : []),
    ...(showRentTab ? [{ key:'rent', label:'Lease' }] : []),
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
          {zillowUrl(form.address) && (
            <button
              onClick={() => window.open(zillowUrl(form.address), 'nhc_zillow', 'width=1400,height=950,noopener,noreferrer')}
              style={{
                width:'100%', background:'#fff', border:'1.5px solid #2D6FAF', borderRadius:8, padding:'8px 16px',
                cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'space-between',
              }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#2D6FAF' }}>View on Zillow</div>
              <span style={{ fontSize:16, color:'#2D6FAF' }}>↗</span>
            </button>
          )}
          {driveFolderId(form.photos_drive_link) && !editingPhotosLink ? (
            <div style={{ display:'flex', gap:6, alignItems:'stretch' }}>
              <button
                onClick={() => window.open(
                  `https://drive.google.com/drive/folders/${driveFolderId(form.photos_drive_link)}`,
                  'nhc_photos',
                  'width=1400,height=950,noopener,noreferrer'
                )}
                style={{
                  flex:1, background:'#fff', border:'1.5px solid #B8892A', borderRadius:8, padding:'10px 16px',
                  cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'space-between',
                }}>
                <div style={{ textAlign:'left' }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#B8892A' }}>Open Photos — Large View</div>
                  <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>Opens the full Drive folder in a larger window</div>
                </div>
                <span style={{ fontSize:18, color:'#B8892A' }}>↗</span>
              </button>
              <button
                onClick={() => setEditingPhotosLink(true)}
                title="Edit photo folder link"
                style={{
                  width:40, background:'#fff', border:'1.5px solid #D6D2CA', borderRadius:8,
                  cursor:'pointer', fontSize:15, color:'#9ca3af', flexShrink:0,
                }}>✎</button>
            </div>
          ) : (
            <Field label="Photos (Google Drive folder link)">
              <div style={{ display:'flex', gap:6 }}>
                <input
                  style={{ ...inp, flex:1 }}
                  placeholder="Paste a shared Drive folder link — set to 'Anyone with the link'"
                  value={form.photos_drive_link||''}
                  onChange={set('photos_drive_link')}
                  autoFocus={editingPhotosLink}
                />
                {driveFolderId(form.photos_drive_link) && (
                  <button
                    onClick={() => setEditingPhotosLink(false)}
                    style={{
                      background:'#B8892A', color:'#fff', border:'none', borderRadius:6, padding:'0 14px',
                      cursor:'pointer', fontSize:12, fontWeight:700, fontFamily:'inherit', flexShrink:0,
                    }}>Done</button>
                )}
              </div>
              {form.photos_drive_link && !driveFolderId(form.photos_drive_link) && (
                <div style={{ fontSize:11, color:'#B91C1C', marginTop:6 }}>
                  Couldn't read a folder ID from that link — paste the full Drive folder URL.
                </div>
              )}
            </Field>
          )}
          <FieldRow>
            <Field label="Beds"><input style={monoInp} type="number" value={form.beds||''} onChange={set('beds')} /></Field>
            <Field label="Baths"><input style={monoInp} type="number" value={form.baths||''} onChange={set('baths')} /></Field>
            <Field label="Sq Ft"><input style={monoInp} type="number" value={form.sqft||''} onChange={set('sqft')} /></Field>
            <Field label="Units"><input style={monoInp} type="number" value={form.unit_count||''} onChange={set('unit_count')} /></Field>
          </FieldRow>
          <FieldRow>
            <Field label="Owner">
              <select style={inp} value={form.owner||'BPV'} onChange={set('owner')}>
                {['BPV','Bob Sophiea','Eric Kimble','Other'].map(o=><option key={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Acquisition">
              <select style={inp} value={form.acquisition_type||'Purchased'} onChange={set('acquisition_type')}>
                <option value="Purchased">Purchased</option>
                <option value="Pre-Owned">Pre-Owned</option>
              </select>
            </Field>
          </FieldRow>

          <FieldRow>
            <Field label="Source">
              <select style={inp} value={form.source||''} onChange={set('source')}>
                <option value="">— Select —</option>
                {['Sphere','Networking','Facebook','Instagram','Google','Referral','Mailers','Sign Call','Website','Other'].map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            {form.source==='Mailers' && (
              <Field label="Which Mailer?">
                <select style={inp} value={form.mailing_id||''} onChange={set('mailing_id')}>
                  <option value="">Unattributed / older campaign</option>
                  {mailings.map(m=><option key={m.id} value={m.id}>{m.campaign_name?.replace(/^Campaign \d+ — /,'')} {m.drop_date?`(${m.drop_date})`:''}</option>)}
                </select>
              </Field>
            )}
          </FieldRow>

          <div style={{ background:'#FAFAF8', borderRadius:8, padding:'4px 14px 12px', border:'0.5px solid #D6D2CA' }}>
            <Toggle
              on={!!form.post_occupancy}
              onToggle={()=>setForm(f=>({
                ...f,
                post_occupancy: f.post_occupancy ? null : 'owner',
                ...(f.post_occupancy ? { post_occupancy_end_date:null, post_occupancy_months:null, post_occupancy_payment:null } : {}),
              }))}
              label="Post-Occupancy"
              sub="Seller stays in the home after closing"
            />
            {form.post_occupancy && (<>
              <Field label="Type">
                <select style={inp} value={form.post_occupancy||'owner'} onChange={e=>setVal('post_occupancy',e.target.value)}>
                  <option value="owner">Owner Staying</option>
                  <option value="renting_back">Renting Back</option>
                </select>
              </Field>
              <FieldRow>
                <Field label="# of Months"><input style={monoInp} type="number" value={form.post_occupancy_months||''} onChange={set('post_occupancy_months')} /></Field>
                <Field label="Payment ($)"><input style={monoInp} type="number" value={form.post_occupancy_payment||''} onChange={set('post_occupancy_payment')} /></Field>
              </FieldRow>
              <Field label="End Date"><DatePicker style={inp} value={form.post_occupancy_end_date||''} onChange={set('post_occupancy_end_date')} /></Field>
            </>)}
          </div>

          <div className="drawer-section">Valuation</div>
          <Field label="After Renovation Value ($)">
            <input style={{ ...monoInp, borderLeft:'3px solid #D97825' }} type="number" value={form.arv||''} onChange={set('arv')} />
          </Field>
          <FieldRow>
            <Field label="As-Is Deduction %"><input style={monoInp} type="number" value={form.asis_pct||50} onChange={set('asis_pct')} /></Field>
            <Field label="As-Is Listing Price Override ($)"><input style={monoInp} type="number" value={form.asis_override||''} onChange={set('asis_override')} /></Field>
          </FieldRow>
          <FieldRow>
            <Field label="Profit Margin %"><input style={monoInp} type="number" value={form.profit_margin||15} onChange={set('profit_margin')} /></Field>
            <Field label="Cash Offer Override ($)"><input style={monoInp} type="number" value={form.cash_offer_override||''} onChange={set('cash_offer_override')} /></Field>
          </FieldRow>
          <FieldRow>
            <Field label="Holding % / mo"><input style={monoInp} type="number" step="0.05" value={form.hold_opt3_pct||0.5} onChange={set('hold_opt3_pct')} /></Field>
            <Field label="Holding Months"><input style={monoInp} type="number" value={form.hold_opt3_months||6} onChange={set('hold_opt3_months')} /></Field>
          </FieldRow>

          {form.arv && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
              {[
                { label:'Cash Offer', value:d.cashOffer, color:'#3B6D11', rows:[
                  { l:'ARV', v:fmt(d.arv) },
                  { l:'Repairs', v:`−${fmt(d.reno)}` },
                  { l:`Comm (${(d.commCashPct*100).toFixed(1).replace(/\.0$/,'')}%)`, v:`−${fmt(d.commCashPct*d.arv)}` },
                  { l:`Holding (${d.cashHoldMo}mo)`, v:`−${fmt(d.cashHold)}` },
                  { l:'Profit margin', v:`−${fmt(d.profit)}` },
                ]},
                { label:'As-Is Net', value:d.opt2Net, color:'#2D6FAF', rows:[
                  { l:'ARV', v:fmt(d.arv) },
                  { l:'As-Is Deduction', v:`−${fmt(d.asisDeduction)}` },
                  { l:'Listing Price', v:fmt(d.asisVal), strong:true },
                  { l:`Comm (${(d.commListPct*100).toFixed(1).replace(/\.0$/,'')}%)`, v:`−${fmt(d.opt2Comm)}` },
                  { l:`Holding (${d.opt2HoldMo}mo)`, v:`−${fmt(d.opt2Hold)}` },
                ]},
                { label:'Full Retail', value:d.opt3Net, color:'#D97825', rows:[
                  { l:'ARV', v:fmt(d.arv) },
                  { l:'Repairs', v:`−${fmt(d.reno)}` },
                  { l:`Comm (${(d.commListPct*100).toFixed(1).replace(/\.0$/,'')}%)`, v:`−${fmt(d.opt3Comm)}` },
                  { l:`Holding (${d.opt3HoldMo}mo)`, v:`−${fmt(d.opt3Hold)}` },
                ]},
              ].map(card=>(
                <div key={card.label} style={{ background:'#FAFAF8', borderRadius:6, padding:'8px 10px', borderTop:`3px solid ${card.color}` }}>
                  <div style={{ fontSize:10, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.8 }}>{card.label}</div>
                  <div style={{ fontSize:15, fontWeight:700, fontFamily:'monospace', color:card.color, marginTop:2 }}>{fmt(card.value)}</div>
                  <div style={{ marginTop:6, paddingTop:6, borderTop:'1px solid #F0EDE6', fontSize:10, color:'#6b7280', lineHeight:1.7 }}>
                    {card.rows.map(r=>(
                      <div key={r.l} style={{
                        display:'flex', justifyContent:'space-between',
                        ...(r.strong ? { borderTop:'1px solid #E5E1DB', marginTop:2, paddingTop:2, color:'#2C2C2C', fontWeight:700 } : {}),
                      }}>
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
                  <td style={{ paddingBottom:6, paddingRight:6 }}><input style={{ ...inp, fontSize:12 }} value={r.name||''} onChange={e=>updateRepair(r.id,'name',e.target.value)} /></td>
                  <td style={{ paddingBottom:6, paddingRight:6 }}><input style={{ ...monoInp, fontSize:12, textAlign:'right' }} type="number" value={r.sqft||''} onChange={e=>updateRepair(r.id,'sqft',e.target.value)} /></td>
                  <td style={{ paddingBottom:6, paddingRight:6 }}><input style={{ ...monoInp, fontSize:12, textAlign:'right' }} type="number" step="0.01" value={r.pricePerSqft||''} onChange={e=>updateRepair(r.id,'pricePerSqft',e.target.value)} /></td>
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
          <Field label="Notes"><textarea style={{ ...inp, minHeight:56, resize:'vertical' }} value={form.nhc_notes||''} onChange={set('nhc_notes')} /></Field>
        </div>
      )}

      {/* ══════════════ REHAB TAB ══════════════ */}
      {tab==='rehab' && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ background:'#FAFAF8', borderRadius:8, padding:'12px 14px', border:'0.5px solid #D6D2CA' }}>
            <FieldRow>
              <Field label="Rehab Stage">
                <select
                  value={form.rehab_stage||'Not Started'}
                  onChange={e=>setVal('rehab_stage', e.target.value)}
                  style={{
                    ...inp, fontWeight:700, color:'#fff',
                    background: REHAB_COLOR[form.rehab_stage||'Not Started'],
                    border:`1.5px solid ${REHAB_COLOR[form.rehab_stage||'Not Started']}`,
                  }}
                >
                  {REHAB_STAGES.map(st=><option key={st} value={st} style={{ background:'#fff', color:'#2C2C2C', fontWeight:400 }}>{st}</option>)}
                </select>
              </Field>
              <Field label="Rehab Start Date">
                <DatePicker style={inp} value={form.rehab_start_date||''} onChange={set('rehab_start_date')} />
              </Field>
            </FieldRow>
          </div>

          {form.id ? (<>
            <RehabStatCards propertyId={form.id} onOpenFull={()=>setRehabOpen(true)} />
          </>) : (
            <div style={{ background:'#F0EDE6', borderRadius:8, padding:'14px', textAlign:'center', fontSize:12, color:'#9ca3af' }}>
              Save the property first to track rehab line items.
            </div>
          )}
        </div>
      )}

      {/* ══════════════ LOAN TAB ══════════════ */}
      {tab==='loan' && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {form.id ? (
            <LoanOverview propertyId={form.id} onOpenLoan={(id)=>{ setSelectedLoanId(id); setLoanOpen(true) }} />
          ) : (
            <div style={{ background:'#F0EDE6', borderRadius:8, padding:'14px', textAlign:'center', fontSize:12, color:'#9ca3af' }}>
              Save the property first to add loan details.
            </div>
          )}
        </div>
      )}

      {/* ══════════════ RENT TAB ══════════════ */}
      {tab==='rent' && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {form.id ? (
            <RentOverview propertyId={form.id} onOpenFull={()=>setRentOpen(true)} />
          ) : (
            <div style={{ background:'#F0EDE6', borderRadius:8, padding:'14px', textAlign:'center', fontSize:12, color:'#9ca3af' }}>
              Save the property first to add lease details.
            </div>
          )}
        </div>
      )}

      {/* ══════════════ DISPOSITION TAB ══════════════ */}
      {tab==='disposition' && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

          {!disp && (
            <div style={{ background:'#F0EDE6', borderRadius:8, padding:'14px', textAlign:'center', fontSize:12, color:'#9ca3af' }}>
              Set a type in the header above to see relevant fields.
            </div>
          )}

          {/* ── LISTING ── */}
          {disp==='listing' && (<>
            <div className="drawer-section">Listing Details</div>
            <FieldRow>
              <Field label="List Date"><DatePicker style={inp} value={form.list_date||''} onChange={set('list_date')} /></Field>
              <Field label="Offer Date"><DatePicker style={inp} value={form.offer_date||''} onChange={set('offer_date')} /></Field>
            </FieldRow>
            <Field label="ARV / List Price ($)"><input style={monoInp} type="number" value={form.arv||''} onChange={set('arv')} /></Field>
            {listingType==='Reno' && (
              <Field label="BPV Rehab Fee ($) — placeholder, not yet wired to logic">
                <input style={monoInp} type="number" value={form.bpv_rehab_fee||''} onChange={set('bpv_rehab_fee')} />
              </Field>
            )}
            <div className="drawer-section">NHC Commission</div>
            <Field label="Commission %">
              <input style={monoInp} type="number" value={form.commission_pct||''}
                onChange={e=>{ const e2=calcCommission(e.target.value,form.sale_price||form.arv); setForm(f=>({...f,commission_pct:e.target.value,commission_earned:e2?e2.toFixed(2):f.commission_earned})) }} />
            </Field>
            <Field label="Commission Earned ($) — auto-calculated, edit to override"><input style={monoInp} type="number" value={form.commission_earned||''} onChange={set('commission_earned')} /></Field>
            <div className="drawer-section">Sale</div>
            <FieldRow>
              <Field label="Sale Price ($)"><input style={monoInp} type="number" value={form.sale_price||''} onChange={set('sale_price')} /></Field>
              <Field label="Close Date"><DatePicker style={inp} value={form.disposition_date||''} onChange={set('disposition_date')} /></Field>
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
              <Field label="Contract Price ($)"><input style={monoInp} type="number" value={form.purchase_price||''} onChange={set('purchase_price')} /></Field>
              <Field label="BPV Wholesale Fee ($)"><input style={monoInp} type="number" value={form.wholesale_fee||''} onChange={set('wholesale_fee')} /></Field>
            </FieldRow>
            <FieldRow>
              <Field label="Buyer"><input style={inp} type="text" value={form.wholesale_buyer||''} onChange={set('wholesale_buyer')} /></Field>
              <Field label="Close Date"><DatePicker style={inp} value={form.disposition_date||''} onChange={set('disposition_date')} /></Field>
            </FieldRow>
            <div className="drawer-section">NHC Commission</div>
            <FieldRow>
              <Field label="Commission %">
                <input style={monoInp} type="number" value={form.commission_pct||''}
                  onChange={e=>{ const e2=calcCommission(e.target.value,form.purchase_price); setForm(f=>({...f,commission_pct:e.target.value,commission_earned:e2?e2.toFixed(2):f.commission_earned})) }} />
              </Field>
              <Field label="Commission Earned ($) — auto-calc, edit to override"><input style={monoInp} type="number" value={form.commission_earned||''} onChange={set('commission_earned')} /></Field>
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
              <Field label="Purchase Date"><DatePicker style={inp} value={form.purchase_date||''} onChange={set('purchase_date')} /></Field>
              <Field label="Purchase Price ($)"><input style={monoInp} type="number" value={form.purchase_price||''} onChange={set('purchase_price')} /></Field>
            </FieldRow>
            <FieldRow>
              <Field label="Closing Costs ($)"><input style={monoInp} type="number" value={form.closing_costs||''} onChange={set('closing_costs')} /></Field>
              <Field label="Rehab Cost ($)">
                <input style={{ ...monoInp, color:rehabCost!==null?'#B8892A':undefined }}
                  type="number" value={rehabCost!==null?rehabCost:(form.rehab_cost||'')}
                  onChange={e=>setForm(f=>({...f,rehab_cost:e.target.value}))} />
              </Field>
            </FieldRow>
            <div className="drawer-section">NHC Commission on Purchase</div>
            <Field label="Commission %">
              <input style={monoInp} type="number" value={form.commission_pct||''}
                onChange={e=>{ const e2=calcCommission(e.target.value,form.purchase_price); setForm(f=>({...f,commission_pct:e.target.value,commission_earned:e2?e2.toFixed(2):f.commission_earned})) }} />
            </Field>
            <Field label="Commission Earned ($) — auto-calc, edit to override"><input style={monoInp} type="number" value={form.commission_earned||''} onChange={set('commission_earned')} /></Field>
            <div className="drawer-section">Resale</div>
            <FieldRow>
              <Field label="Sale Price ($)"><input style={monoInp} type="number" value={form.sale_price||''} onChange={set('sale_price')} /></Field>
              <Field label="Sale Date"><DatePicker style={inp} value={form.sale_date||''} onChange={set('sale_date')} /></Field>
            </FieldRow>
            <Field label="Days on Market"><input style={monoInp} type="number" value={form.days_on_market||''} onChange={set('days_on_market')} /></Field>
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
              <Field label="Purchase Date"><DatePicker style={inp} value={form.purchase_date||''} onChange={set('purchase_date')} /></Field>
              <Field label="Purchase Price ($)"><input style={monoInp} type="number" value={form.purchase_price||''} onChange={set('purchase_price')} /></Field>
            </FieldRow>
            <Field label="Closing Costs ($)"><input style={monoInp} type="number" value={form.closing_costs||''} onChange={set('closing_costs')} /></Field>
            <div className="drawer-section">NHC Commission on Purchase</div>
            <FieldRow>
              <Field label="Commission %">
                <input style={monoInp} type="number" value={form.commission_pct||''}
                  onChange={e=>{ const e2=calcCommission(e.target.value,form.purchase_price); setForm(f=>({...f,commission_pct:e.target.value,commission_earned:e2?e2.toFixed(2):f.commission_earned})) }} />
              </Field>
              <Field label="Commission Earned ($) — auto-calc, edit to override"><input style={monoInp} type="number" value={form.commission_earned||''} onChange={set('commission_earned')} /></Field>
            </FieldRow>
            <div className="drawer-section">Sale</div>
            <div style={{ background:'#FAFAF8', borderRadius:8, padding:'12px 14px', border:'0.5px solid #D6D2CA' }}>
              {stage==='Sold' ? (<>
                <div style={{ fontSize:11, color:'#9ca3af', marginBottom:8 }}>Stage is set to Sold — record the sale details below.</div>
                <FieldRow>
                  <Field label="Sale Price ($)"><input style={monoInp} type="number" value={form.sale_price||''} onChange={set('sale_price')} /></Field>
                  <Field label="Sale Date"><DatePicker style={inp} value={form.sale_date||''} onChange={set('sale_date')} /></Field>
                </FieldRow>
              </>) : (
                <div style={{ fontSize:11, color:'#9ca3af' }}>Set the stage to Sold in the header to record a sale on this hold.</div>
              )}
              {(form.converted_to_sale) && (
                <div style={{ marginTop:8, paddingTop:8, borderTop:'0.5px solid #D6D2CA', fontSize:10, color:'#9ca3af' }}>
                  Historical: previously marked converted-to-sale ({form.conversion_disposition||'—'}, {form.conversion_date||'—'}). No longer editable here.
                </div>
              )}
            </div>
            <Field label="BPV Notes"><textarea style={{ ...inp, minHeight:56, resize:'vertical' }} value={form.bpv_notes||''} onChange={set('bpv_notes')} /></Field>
          </>)}


          {/* ── LOST ── */}
          {disp==='lost' && (<>
            <div className="drawer-section">Lost / Passed Details</div>
            <Field label="Date Passed"><DatePicker style={inp} value={form.disposition_date||''} onChange={set('disposition_date')} /></Field>
            <Field label="Reason"><textarea style={{ ...inp, minHeight:72, resize:'vertical' }} value={form.lost_reason||''} onChange={set('lost_reason')} /></Field>
          </>)}

        </div>
      )}

      {/* Loan Tracker modal */}
      <LoanTracker
        propertyId={form.id}
        propertyAddress={form.address}
        open={loanOpen}
        initialLoanId={selectedLoanId}
        onClose={()=>{ setLoanOpen(false); setSelectedLoanId(null) }}
      />

      {/* Rehab Tracker modal (Services + Supplies + Utilities + Loan snapshot) */}
      <RehabRoundTracker
        property={form}
        repairItems={repairs}
        onChange={total=>setRehabCost(total)}
        open={rehabOpen}
        onClose={()=>setRehabOpen(false)}
      />

      {/* Rent Tracker modal */}
      <RentTracker
        propertyId={form.id}
        propertyAddress={form.address}
        open={rentOpen}
        onClose={()=>setRentOpen(false)}
        onRentChange={()=>onSave()}
      />

    </>
  )

  const footerContent = (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
      {!isNew ? (
        <button onClick={del} style={{ background:'#B91C1C', border:'1px solid #B91C1C', color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit', borderRadius:6, padding:'6px 12px' }}>
          Delete Property
        </button>
      ) : <span />}
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <Btn variant="outline" onClick={onClose}>Cancel</Btn>
        <Btn onClick={handleClose}>Save</Btn>
      </div>
    </div>
  )

  if (inlineMode) return <div style={{ padding:'0 16px 24px' }}>{innerContent}<div style={{ marginTop:20, paddingTop:16, borderTop:'1px solid #F0EDE6' }}>{footerContent}</div></div>

  return (
    <Drawer open={open} onClose={guardedClose} hideCloseButton width={580} footer={footerContent}
      title={form.address || 'New Property'}
      headerActions={null}
      subtitle={
        <div style={{ display:'flex', alignItems:'flex-end', gap:10, marginTop:8, flexWrap:'wrap' }}>
          {/* Type dropdown — primary */}
          <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
            <span style={{ fontSize:9, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.6 }}>Deal Type</span>
            <select
              value={type}
              onChange={e=>setType(e.target.value)}
              onClick={e=>e.stopPropagation()}
              style={{
                border:`1.5px solid ${typeColor}`, borderRadius:6, padding:'3px 8px',
                fontSize:11, fontWeight:700, fontFamily:'inherit',
                color:typeColor, background:typeColor+'12', cursor:'pointer', outline:'none',
              }}>
              {TYPE_OPTIONS.map(t=><option key={t.value} value={t.value}>{t.value}</option>)}
            </select>
          </div>

          {/* As-Is / Reno toggle — Retail Listing only */}
          {type==='Retail Listing' && (
            <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
              <span style={{ fontSize:9, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.6 }}>Listing Type</span>
              <select
                value={listingType}
                onChange={e=>setListingType(e.target.value)}
                onClick={e=>e.stopPropagation()}
                style={{
                  border:'1.5px solid #D6D2CA', borderRadius:6, padding:'3px 8px',
                  fontSize:11, fontWeight:600, fontFamily:'inherit', color:'#6b7280', background:'#fff',
                  cursor:'pointer', outline:'none',
                }}>
                <option value="As-Is">As-Is</option>
                <option value="Reno">Reno</option>
              </select>
            </div>
          )}

          {/* Scoped stage dropdown — hidden for Analyzing/Lost which have no stages */}
          {scopedStages.length>0 && (
            <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
              <span style={{ fontSize:9, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.6 }}>Deal Stage</span>
              <select
                value={stage||''}
                onChange={e=>setVal('stage',e.target.value)}
                onClick={e=>e.stopPropagation()}
                style={{
                  border:`1.5px solid ${stageColor}`, borderRadius:6, padding:'3px 8px',
                  fontSize:11, fontWeight:700, fontFamily:'inherit',
                  color:stageColor, background:stageColor+'12', cursor:'pointer', outline:'none',
                }}>
                {scopedStages.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
        </div>
      }>
      {innerContent}
    </Drawer>
  )
}




