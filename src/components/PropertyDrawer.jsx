import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase.js'
import { Field, FieldRow, inp, monoInp, Btn, fmt, fmtK, DatePicker, PAID_BY_OPTIONS, PARTNERS, calcOwed } from './ui.jsx'
import { calcOffers } from '../lib/valuation.js'
import Drawer from './Drawer.jsx'
import AddressInput from './AddressInput.jsx'
import RehabRoundTracker from './RehabRoundTracker.jsx'
import RehabStatCards from './RehabOverview.jsx'
import LoanTracker from './LoanTracker.jsx'
import RentTracker from './RentTracker.jsx'
import LoanOverview from './LoanOverview.jsx'
import RentOverview from './RentOverview.jsx'
import PartnerLedgerModal from './PartnerLedgerModal.jsx'
import PropertyFullView from './PropertyFullView.jsx'

// ── Type options (primary) ────────────────────────────────────────────────────
const TYPE_OPTIONS = [
  { value:'Analyzing',       color:'#B8892A' },
  { value:'Renovation',      color:'#6b21a8' },
  { value:'Flip',            color:'#D97825' },
  { value:'Hold',            color:'#B8892A' },
  { value:'Retail Listing',  color:'#3B6D11' },
  { value:'Wholesale',       color:'#6b21a8' },
]
const TYPE_COLOR = Object.fromEntries(TYPE_OPTIONS.map(t=>[t.value,t.color]))

// Legacy disposition <-> new type mapping (disposition kept in sync for Sold/Rehabs/PackageDeals pages)
const TYPE_TO_DISP = { 'Analyzing':null, 'Renovation':'renovation', 'Flip':'flip', 'Hold':'hold', 'Retail Listing':'listing', 'Wholesale':'wholesale' }

// Stages scoped per type — As-Is Retail Listing skips the two Reno stages.
// Renovation is the owned pre-fork phase; Flip/Hold are its results.
const STAGE_BY_TYPE = {
  'Analyzing':      ['New Lead','Needs Cash Offer','Offer Submitted','Offer Accepted','Lost'],
  'Renovation':     ['Purchased','Renovation'],
  'Flip':           ['Off Market','Listed','Under Contract','Sold'],
  'Hold':           ['Vacant','Rent Ready','Rental Listed','Leased','Listed','Sold'],
  'Retail Listing': { 'As-Is':['Off Market','Listed','Under Contract','Sold','Cancelled / Expired'], 'Reno':['Reno In Progress','Reno Completed','Off Market','Listed','Under Contract','Sold','Cancelled / Expired'] },
  'Wholesale':      ['Under Contract','Assigned','Closed','Cancelled'],
}
const STAGE_COLOR = {
  'New Lead':'#9ca3af', 'Needs Cash Offer':'#D97825', 'Offer Submitted':'#B8892A', 'Offer Accepted':'#3B6D11', 'Off Market':'#9ca3af',
  Purchased:'#D97825', Renovation:'#6b21a8', Rehab:'#6b21a8', Listed:'#3B6D11', 'Under Contract':'#2D6FAF', Sold:'#3B6D11',
  Vacant:'#D97825', 'Rent Ready':'#B8892A', 'Rental Listed':'#2D6FAF', Leased:'#3B6D11', 'Reno In Progress':'#D97825', 'Reno Completed':'#B8892A',
  Assigned:'#6b21a8', Closed:'#3B6D11',
  Lost:'#9ca3af', 'Cancelled / Expired':'#9ca3af', Cancelled:'#9ca3af',
}

function stagesForType(type, listingType) {
  const s = STAGE_BY_TYPE[type]
  if (!s) return []
  if (type==='Retail Listing') return s[listingType||'As-Is']
  return s
}

// ── Rehab stages ──────────────────────────────────────────────────────────────
const REHAB_STAGES = ['Not Started','Demo','Rough Work','Inspections','Finishes','Complete']
const REHAB_COLOR  = {
  'Not Started':'#9ca3af','Demo':'#D97825','Rough Work':'#B8892A',
  'Inspections':'#2D6FAF','Finishes':'#6b21a8','Complete':'#3B6D11',
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
// Parses 'YYYY-MM-DD' manually (avoids new Date(str) timezone off-by-one) and
// returns whole days between two such date strings, or null if either is missing.
function daysBetween(startStr, endStr) {
  if (!startStr || !endStr) return null
  const [sy,sm,sd] = startStr.split('-').map(Number)
  const [ey,em,ed] = endStr.split('-').map(Number)
  const start = Date.UTC(sy, sm-1, sd)
  const end   = Date.UTC(ey, em-1, ed)
  return Math.round((end-start) / 86400000)
}

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

function ProfitBox({ label, value, sub, color }) {
  return (
    <div style={{ background:color+'12', border:`1px solid ${color}30`, borderRadius:8, padding:'10px 14px', flex:1, minWidth:0 }}>
      <div style={{ fontSize:10, color:'#6b7280', textTransform:'uppercase', letterSpacing:0.8, marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:18, fontWeight:700, fontFamily:'monospace', color }}>{value}</div>
      {sub && <div style={{ fontSize:10, color:'#9ca3af', marginTop:2 }}>{sub}</div>}
    </div>
  )
}

// Simple cash waterfall: Sale Price − NHC Commission − Loan Payoff − Partner Payback = Profit
function ProfitWaterfall({ salePrice, commission, loanPayoff, partnerPayback, capGainsPct, capGainsOverride, onCapGainsPctChange, onCapGainsOverrideChange }) {
  const sp = parseFloat(salePrice) || 0
  const c  = parseFloat(commission) || 0
  const lp = loanPayoff || 0
  const pb = partnerPayback || 0
  const profit = sp - c - lp - pb
  const pct = capGainsPct===''||capGainsPct==null ? 20 : parseFloat(capGainsPct)||0
  const capGains = capGainsOverride!==''&&capGainsOverride!=null ? parseFloat(capGainsOverride)||0 : Math.max(profit,0)*(pct/100)
  const netAfterCapGains = profit - capGains

  const rows = [
    { label:'Sale Price', value:fmt(sp), sign:'' },
    { label:'NHC Commission', value:fmt(c), sign:'−' },
    { label:'Loan Payoff', value:fmt(lp), sign:'−' },
    { label:'Partner Payback', value:fmt(pb), sign:'−' },
  ]

  return (
    <div style={{ background:'#FAFAF8', borderRadius:8, border:'0.5px solid #D6D2CA', padding:'2px 14px' }}>
      {rows.map((r,i)=>(
        <div key={r.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderTop:i===0?'none':'0.5px solid #E8E4DB' }}>
          <span style={{ fontSize:12, color:'#6b7280' }}>{r.sign ? `${r.sign} ${r.label}` : r.label}</span>
          <span style={{ fontSize:13, fontFamily:"'DM Mono', monospace", fontWeight:600, color:'#4b5563' }}>{r.value}</span>
        </div>
      ))}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderTop:'1.5px solid #B8892A' }}>
        <span style={{ fontSize:13, fontWeight:700, color:'#2C2C2C' }}>Profit</span>
        <span style={{ fontSize:17, fontWeight:700, fontFamily:"'DM Mono', monospace", color: profit>=0?'#3B6D11':'#B91C1C' }}>{profit>=0?'+':''}{fmt(profit)}</span>
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, padding:'8px 0', borderTop:'0.5px solid #E8E4DB' }}>
        <span style={{ fontSize:12, color:'#6b7280' }}>− Est. Capital Gains</span>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          {onCapGainsPctChange && (
            <input type="number" value={capGainsPct??''} onChange={e=>onCapGainsPctChange(e.target.value)} placeholder="20"
              style={{ width:44, fontSize:11, textAlign:'right', border:'0.5px solid #D6D2CA', borderRadius:4, padding:'3px 4px', fontFamily:'inherit' }} />
          )}
          {onCapGainsPctChange && <span style={{ fontSize:11, color:'#9ca3af' }}>%</span>}
          <span style={{ fontSize:13, fontFamily:"'DM Mono', monospace", fontWeight:600, color:'#B91C1C' }}>{fmt(capGains)}</span>
        </div>
      </div>
      {onCapGainsOverrideChange && (
        <div style={{ display:'flex', justifyContent:'flex-end', paddingBottom:8 }}>
          <input type="number" value={capGainsOverride??''} onChange={e=>onCapGainsOverrideChange(e.target.value)} placeholder="Override $ (optional)"
            style={{ width:150, fontSize:11, textAlign:'right', border:'0.5px solid #D6D2CA', borderRadius:4, padding:'4px 6px', fontFamily:'inherit', color:'#9ca3af' }} />
        </div>
      )}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderTop:'1.5px solid #B8892A' }}>
        <span style={{ fontSize:13, fontWeight:700, color:'#2C2C2C' }}>Net After Cap Gains</span>
        <span style={{ fontSize:17, fontWeight:700, fontFamily:"'DM Mono', monospace", color: netAfterCapGains>=0?'#3B6D11':'#B91C1C' }}>{netAfterCapGains>=0?'+':''}{fmt(netAfterCapGains)}</span>
      </div>
    </div>
  )
}

// Money input with a fixed "$" prefix baked into the field, instead of the unit in the label
function MoneyInput({ value, onChange, disabled=false }) {
  return (
    <div style={{ position:'relative' }}>
      <span style={{
        position:'absolute', left:10, top:'50%', transform:'translateY(-50%)',
        fontSize:13, fontFamily:"'DM Mono', monospace", color:disabled?'#c7c2b8':'#9ca3af', pointerEvents:'none',
      }}>$</span>
      <input
        style={{ ...monoInp, paddingLeft:20, background:disabled?'#F0EDE6':monoInp.background, color:disabled?'#9ca3af':monoInp.color }}
        type="number" value={value||''} onChange={onChange} disabled={disabled}
      />
    </div>
  )
}

// Read-only, clickable snapshot of Acquisition-tab data shown inside Disposition
function SummaryCard({ rows, onClick, footerLabel }) {
  return (
    <div
      onClick={onClick}
      style={{
        background:'#FAFAF8', borderRadius:8, border:'0.5px solid #D6D2CA',
        cursor:'pointer', transition:'border-color 0.15s, background 0.15s',
      }}
      onMouseEnter={e=>{ e.currentTarget.style.borderColor='#B8892A'; e.currentTarget.style.background='#FAF6EC' }}
      onMouseLeave={e=>{ e.currentTarget.style.borderColor='#D6D2CA'; e.currentTarget.style.background='#FAFAF8' }}
    >
      <div style={{ display:'flex', flexDirection:'column' }}>
        {rows.map((r,i)=>(
          <div key={r.label} style={{
            display:'flex', justifyContent:'space-between', alignItems:'center',
            padding:'8px 14px', borderTop: i===0 ? 'none' : '0.5px solid #E8E4DB',
          }}>
            <span style={{ fontSize:11, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.5 }}>{r.label}</span>
            <span style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontSize:13, fontFamily:"'DM Mono', monospace", fontWeight:600, color:'#4b5563' }}>{r.value||'—'}</span>
              {r.tag && (
                <span style={{ fontSize:9, fontWeight:700, color:'#B8892A', background:'#B8892A18', border:'1px solid #B8892A40', borderRadius:4, padding:'1px 6px', textTransform:'uppercase', letterSpacing:0.3 }}>
                  {r.tag}
                </span>
              )}
            </span>
          </div>
        ))}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:5, padding:'6px 14px', borderTop:'0.5px solid #E8E4DB', fontSize:10, color:'#B8892A', fontWeight:700 }}>
          {footerLabel} <span>→</span>
        </div>
      </div>
    </div>
  )
}

// Fetches active loan(s) for the property and renders a click-through summary card.
// Loans are always taken out through BPV — individual monthly payments may be
// personally covered by Bob/Eric, which is tracked in cashoffer_loan_payments, not here.
function LoanSummaryCard({ propertyId, onClick, onTotal }) {
  const [loans, setLoans] = useState(null)
  const [coveredCount, setCoveredCount] = useState(0)

  useEffect(() => {
    if (!propertyId) return
    supabase.from('cashoffer_loans').select('id, loan_amount, lender_name, bank')
      .eq('property_id', propertyId).eq('is_active', true)
      .then(async ({ data }) => {
        setLoans(data || [])
        const total = (data||[]).reduce((s,l)=>s+(parseFloat(l.loan_amount)||0), 0)
        if (onTotal) onTotal(total)
        const loanIds = (data||[]).map(l=>l.id)
        if (loanIds.length) {
          const { data: payments } = await supabase.from('cashoffer_loan_payments').select('paid_by').in('loan_id', loanIds)
          setCoveredCount((payments||[]).filter(p=>PARTNERS.includes(p.paid_by)).length)
        }
      })
  }, [propertyId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loans === null || loans.length === 0) return null
  const totalAmount = loans.reduce((s,l)=>s+(parseFloat(l.loan_amount)||0), 0)

  return (
    <SummaryCard
      onClick={onClick}
      footerLabel="Edit on Loan tab"
      rows={[
        { label: loans.length>1 ? `Loan Amount (${loans.length} loans)` : 'Loan Amount', value: fmt(totalAmount) },
        ...(coveredCount > 0 ? [{ label:'Payments Covered Personally', value:String(coveredCount) }] : []),
      ]}
    />
  )
}

// Aggregates what's owed back to Bob/Eric personally across Closing Costs, Rehab
// line items, and any individual loan payments they covered — one net number per partner.
function PartnerPaybackSummary({ propertyId, property, closingDate, onOpenLedger, onTotal }) {
  const [totals, setTotals] = useState(null)

  useEffect(() => { if (propertyId) load() }, [propertyId, property?.closing_costs, property?.closing_costs_paid_by, property?.closing_costs_date_paid, property?.down_payment, property?.down_payment_paid_by, property?.down_payment_date_paid, closingDate]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    const asOf = closingDate ? new Date(Math.min(new Date(), new Date(closingDate+'T12:00:00'))) : new Date()
    const t = { Bob:{principal:0,interest:0}, Eric:{principal:0,interest:0} }

    async function addRow(who, amount, datePaid, sourceType, sourceId) {
      if (!PARTNERS.includes(who) || !amount) return
      const { data: rp } = await supabase.from('cashoffer_partner_repayments').select('*').eq('source_type', sourceType).eq('source_id', sourceId)
      const { balance, accruedInterest } = calcOwed(amount, datePaid, rp||[], asOf)
      t[who].principal += balance
      t[who].interest += accruedInterest
    }

    // Closing costs
    if (property?.closing_costs) {
      await addRow(property.closing_costs_paid_by, parseFloat(property.closing_costs)||0, property.closing_costs_date_paid, 'closing_costs', propertyId)
    }
    // Down payment
    if (property?.down_payment) {
      await addRow(property.down_payment_paid_by, parseFloat(property.down_payment)||0, property.down_payment_date_paid, 'down_payment', propertyId)
    }

    // Rehab items / supplies / utility bills
    const [items, supplies, bills] = await Promise.all([
      supabase.from('cashoffer_rehab_items').select('id, estimated_cost, actual_cost, paid_by, date_paid').eq('property_id', propertyId),
      supabase.from('cashoffer_supplies').select('id, unit_cost, quantity, paid_by, date_paid').eq('property_id', propertyId),
      supabase.from('cashoffer_utility_bills').select('id, amount, paid_by, date_paid').eq('property_id', propertyId),
    ])
    await Promise.all([
      ...(items.data||[]).map(r => addRow(r.paid_by, r.actual_cost!=null?parseFloat(r.actual_cost):(parseFloat(r.estimated_cost)||0), r.date_paid, 'rehab_item', r.id)),
      ...(supplies.data||[]).map(r => addRow(r.paid_by, (parseFloat(r.unit_cost)||0)*(parseFloat(r.quantity)||0), r.date_paid, 'supply', r.id)),
      ...(bills.data||[]).map(r => addRow(r.paid_by, parseFloat(r.amount)||0, r.date_paid, 'utility_bill', r.id)),
    ])

    // Loan payments — the loan itself is always through BPV, but an individual
    // monthly payment may have been personally covered by Bob or Eric.
    const { data: loans } = await supabase.from('cashoffer_loans').select('id').eq('property_id', propertyId)
    const loanIds = (loans||[]).map(l=>l.id)
    if (loanIds.length) {
      const { data: payments } = await supabase.from('cashoffer_loan_payments').select('id, amount, paid_by, date_paid').in('loan_id', loanIds)
      await Promise.all((payments||[]).map(p => addRow(p.paid_by, parseFloat(p.amount)||0, p.date_paid, 'loan_payment', p.id)))
    }

    setTotals(t)
    if (onTotal) onTotal(t.Bob.principal + t.Bob.interest + t.Eric.principal + t.Eric.interest)
  }

  if (!totals) return null
  const active = PARTNERS.filter(p => totals[p].principal > 0 || totals[p].interest > 0)
  if (active.length === 0) return null

  return (
    <div
      onClick={onOpenLedger}
      style={{ display:'flex', flexDirection:'column', gap:8, cursor:'pointer' }}
    >
      <div className="drawer-section">Partner Payback</div>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        {active.map(p => (
          <ProfitBox
            key={p}
            label={`Owed to ${p}`}
            value={fmt(totals[p].principal + totals[p].interest)}
            sub={`Principal ${fmt(totals[p].principal)} + Interest ${fmt(totals[p].interest)}`}
            color={p==='Bob' ? '#2D6FAF' : '#D97825'}
          />
        ))}
      </div>
      <div style={{ fontSize:10, color:'#B8892A', fontWeight:700, textAlign:'center' }}>View / edit full partner ledger →</div>
    </div>
  )
}

function LoanVsPurchaseCheck({ propertyId, purchasePrice, downPayment }) {
  const [loanTotal, setLoanTotal] = useState(null)
  useEffect(() => {
    if (!propertyId) return
    supabase.from('cashoffer_loans').select('loan_amount').eq('property_id', propertyId).eq('is_active', true)
      .then(({ data }) => setLoanTotal((data||[]).reduce((s,l)=>s+(parseFloat(l.loan_amount)||0), 0)))
  }, [propertyId])

  if (loanTotal === null || loanTotal === 0) return null
  const pp = parseFloat(purchasePrice) || 0
  const dp = parseFloat(downPayment) || 0
  const combined = loanTotal + dp
  const diff = pp - combined
  const matches = pp > 0 && Math.abs(diff) < 1

  return (
    <div style={{ fontSize:11, padding:'8px 12px', borderRadius:6, background: matches ? '#eef7ea' : '#fff3cd', color: matches ? '#3B6D11' : '#856404', display:'flex', justifyContent:'space-between', gap:10, flexWrap:'wrap' }}>
      <span>Loan ({fmt(loanTotal)}) + Down Payment ({fmt(dp)}) = {fmt(combined)}</span>
      {pp > 0 && (
        <span style={{ fontWeight:700 }}>
          {matches ? '✓ Matches Purchase Price' : `${diff > 0 ? 'Short by' : 'Over by'} ${fmt(Math.abs(diff))} vs Purchase Price`}
        </span>
      )}
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

export default function PropertyDrawer({ property, open, onClose, onSave, mailings=[], onViewOffer, inlineMode=false, initialTab='analyzer', openRentTracker=false, currentUserEmail=null, isAgentRole=false }) {
  const [form, setForm]           = useState({})
  const [repairs, setRepairs]     = useState([])
  const [tab, setTab]             = useState('analyzer')
  const [rehabCost, setRehabCost] = useState(null)
  const [loanOpen, setLoanOpen] = useState(false)
  const [selectedLoanId, setSelectedLoanId] = useState(null)
  const [rehabOpen, setRehabOpen] = useState(false)
  const [rentOpen, setRentOpen] = useState(false)
  const [ledgerOpen, setLedgerOpen] = useState(false)
  const [loanPayoffTotal, setLoanPayoffTotal] = useState(0)
  const [partnerPaybackTotal, setPartnerPaybackTotal] = useState(0)
  const [editingPhotosLink, setEditingPhotosLink] = useState(false)
  const [fullViewOpen, setFullViewOpen] = useState(false)
  const [agentList, setAgentList] = useState([])

  useEffect(() => {
    supabase.from('cashoffer_users').select('email,full_name').eq('role','agent').order('full_name')
      .then(({ data }) => setAgentList(data || []))
  }, [])

  const isNew   = !form.id
  // An agent editing an existing deal only gets the Analyzer tab and can't touch
  // Owner/Type/Stage classification or delete — everything else stays admin/viewer-only.
  const restrictedAgent = isAgentRole && !isNew
  const type       = form.type || 'Analyzing'
  const listingType = form.listing_type || 'As-Is'
  const disp    = form.stage === 'Lost' ? 'lost' : TYPE_TO_DISP[type] // derived — kept in sync for Sold/Rehabs/PackageDeals pages
  const scopedStages = stagesForType(type, listingType)
  const stage   = form.stage || (scopedStages[0] || null)
  const typeColor  = TYPE_COLOR[type] || '#9ca3af'
  const stageColor = STAGE_COLOR[stage] || '#9ca3af'

  const lastPropertyId = useRef(null)
  const snapshotRef = useRef({ form:{}, repairs:[] }) // last-loaded/saved values, for the dirty check on close
  useEffect(() => {
    if (property) {
      const isNewProperty = property.id !== lastPropertyId.current
      lastPropertyId.current = property.id
      const t = property.type || 'Analyzing'
      const lt = property.listing_type || 'As-Is'
      const stages = stagesForType(t, lt)
      const nextForm = { ...property, type:t, listing_type:lt, stage: property.stage || stages[0] || null }
      const nextRepairs = property.repair_items?.length
        ? property.repair_items.map((r,i)=>({...r,id:i}))
        : DEFAULT_REPAIRS.map((r,i)=>({...r,id:i}))
      setForm(nextForm)
      setRepairs(nextRepairs)
      snapshotRef.current = { form: nextForm, repairs: nextRepairs }
      setRehabCost(null)
      // Only jump back to the initial tab (and cancel any in-progress photo-link edit)
      // when this is actually a different property — a same-property refresh (e.g. after
      // saving a lease or loan payment) should leave the drawer right where the user was.
      if (isNewProperty) {
        setTab(initialTab)
        setEditingPhotosLink(false)
        if (openRentTracker) setRentOpen(true)
      }
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
      seller_name:form.seller_name||null, seller_fub_link:form.seller_fub_link||null,
      photos_drive_link:form.photos_drive_link||null,
      sqft:form.sqft||null, unit_count:parseInt(form.unit_count)||null, unit_names:form.unit_names||null,
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
      sale_commission_pct:form.sale_commission_pct||null, sale_commission_earned:form.sale_commission_earned||null,
      capital_gains_pct:form.capital_gains_pct||null, capital_gains_override:form.capital_gains_override||null,
      commission_min:form.commission_min||5000,
      nhc_notes:form.nhc_notes||null,
      purchase_price:form.purchase_price||null, closing_costs:form.closing_costs||null,
      prior_acquisition_cost:form.prior_acquisition_cost||null, prior_renovation_cost:form.prior_renovation_cost||null,
      prior_history_notes:form.prior_history_notes||null,
      closing_costs_paid_by:form.closing_costs_paid_by||null, closing_costs_date_paid:PARTNERS.includes(form.closing_costs_paid_by)?(form.purchase_date||null):null,
      down_payment:form.down_payment||null, down_payment_paid_by:form.down_payment_paid_by||null, down_payment_date_paid:PARTNERS.includes(form.down_payment_paid_by)?(form.purchase_date||null):null,
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
      rehab_active: type==='Renovation'
        ? !['Not Started','Complete'].includes(form.rehab_stage||'Not Started')
        : stage==='Renovation', // keep in sync
      rehab_stage:form.rehab_stage||'Not Started',
      rehab_start_date:form.rehab_start_date||null,
      rehab_complete_date:form.rehab_complete_date||null,
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
  function isFormDirty() {
    return JSON.stringify(form) !== JSON.stringify(snapshotRef.current.form) ||
           JSON.stringify(repairs) !== JSON.stringify(snapshotRef.current.repairs)
  }
  function guardedClose() {
    if (!form.address) { onClose(); return }
    if (!isFormDirty()) { onClose(); return }
    if (confirm('Discard unsaved changes to this property?')) onClose()
  }
  async function del() {
    if (!confirm('Delete this deal? This cannot be undone.')) return
    await supabase.from('cashoffer_properties').delete().eq('id',form.id)
    onSave(); onClose()
  }

  const showLoanTab = type==='Renovation' || type==='Flip' || type==='Hold' || form.acquisition_type==='Pre-Owned'
  const showRentTab = type==='Hold'

  useEffect(() => {
    if (tab==='loan' && !showLoanTab) setTab('analyzer')
    if (tab==='rent' && !showRentTab) setTab('analyzer')
    if (restrictedAgent && tab!=='analyzer') setTab('analyzer')
  }, [showLoanTab, showRentTab, restrictedAgent]) // eslint-disable-line react-hooks/exhaustive-deps

  const TABS = restrictedAgent ? [{ key:'analyzer', label:'Analyzer' }] : [
    { key:'analyzer',    label:'Analyzer' },
    { key:'acquisition', label:'Acquisition' },
    ...(showLoanTab ? [{ key:'loan', label:'Loan' }] : []),
    { key:'rehab',       label:'Renovation' },
    ...(showRentTab ? [{ key:'rent', label:'Lease' }] : []),
    { key:'disposition', label:'Disposition' },
  ]

  // Disposition is always accessible — no gating on type/stage.
  const disabledTabReasons = {}

  // P&L helpers
  const rc         = rehabCost!==null ? rehabCost : (parseFloat(form.rehab_cost)||0)
  const totalCost  = (parseFloat(form.purchase_price)||0)+(parseFloat(form.closing_costs)||0)+rc
  const flipProfit = form.sale_price ? (parseFloat(form.sale_price)||0)-totalCost : null
  const flipROI    = totalCost>0&&flipProfit!==null ? ((flipProfit/totalCost)*100).toFixed(1) : null

  if (!property) return null

  // Post-occupancy badge label
  const poLabel = form.post_occupancy ? 'Post-Occ' : null

  const innerContent = (
    <>
      {/* ── Tab bar ── */}
      <div style={{ display:'flex', gap:0, borderBottom:'2px solid #F0EDE6', marginBottom:16, marginTop:8, position:'sticky', top:0, background:'#fff', zIndex:5 }}>
        {TABS.map(t=>{
          const disabledReason = disabledTabReasons[t.key]
          return (
            <button key={t.key} disabled={!!disabledReason} title={disabledReason||undefined}
              onClick={()=>!disabledReason && setTab(t.key)} style={{
              padding:'8px 18px', border:'none', background:'none',
              cursor:disabledReason?'not-allowed':'pointer',
              fontSize:12, fontWeight:tab===t.key?700:400, fontFamily:'inherit',
              color:disabledReason?'#c7c2b8':(tab===t.key?'#B8892A':'#6b7280'),
              borderBottom:tab===t.key?'2px solid #B8892A':'2px solid transparent',
              marginBottom:-2, letterSpacing:0.5,
            }}>{t.label}</button>
          )
        })}
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

          <FieldRow>
            <Field label="Beds"><input style={monoInp} type="number" value={form.beds||''} onChange={set('beds')} /></Field>
            <Field label="Baths"><input style={monoInp} type="number" value={form.baths||''} onChange={set('baths')} /></Field>
            <Field label="Sq Ft"><input style={monoInp} type="number" value={form.sqft||''} onChange={set('sqft')} /></Field>
          </FieldRow>
          <div className="drawer-section">Owner / Seller</div>
          <FieldRow>
            <Field label="Name"><input style={inp} value={form.seller_name||''} onChange={set('seller_name')} /></Field>
            <Field label="FUB Link">
              <div style={{ display:'flex', gap:6 }}>
                <input style={inp} placeholder="https://…" value={form.seller_fub_link||''} onChange={set('seller_fub_link')} />
                {form.seller_fub_link && (
                  <button
                    onClick={() => window.open(form.seller_fub_link, 'nhc_fub', 'width=1400,height=950,noopener,noreferrer')}
                    style={{ background:'#fff', border:'1.5px solid #2D6FAF', borderRadius:8, padding:'0 12px', cursor:'pointer', color:'#2D6FAF', fontSize:14, flexShrink:0 }}
                  >↗</button>
                )}
              </div>
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

          <div className="drawer-section">Valuation</div>

          {form.arv && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
              {[
                { label:'Cash Offer', value:d.cashOffer, color:'#3B6D11', rows:[
                  { l:'ARV', v:fmt(d.arv) },
                  { l:'Repairs', v:`−${fmt(d.reno)}` },
                  { l:`Comm (${(d.commOfferPct*100).toFixed(1).replace(/\.0$/,'')}% of offer)`, v:`−${fmt(d.commOfferAmt)}` },
                  { l:`Comm (${(d.commArvPct*100).toFixed(1).replace(/\.0$/,'')}% of ARV)`, v:`−${fmt(d.commArvAmt)}` },
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

          {form.id && (
            <button
              onClick={() => setFullViewOpen(true)}
              style={{ background:'#6b21a8', color:'#fff', border:'none', borderRadius:8, padding:'11px 16px', cursor:'pointer', fontSize:13, fontWeight:700, fontFamily:'inherit', width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginTop:4 }}
            >
              <span>Open Full Property View (Edit Offer)</span>
              <span style={{ fontSize:16 }}>&#8599;</span>
            </button>
          )}
          {form.arv && (
            <button onClick={()=>onViewOffer&&onViewOffer({...form, repair_items:repairs.filter(r=>r.name||r.cost).map(r=>({name:r.name,cost:parseFloat(r.cost)||0}))})}
              style={{ background:'#2D6FAF', color:'#fff', border:'none', borderRadius:6, padding:'10px 16px', cursor:'pointer', fontSize:13, fontWeight:700, fontFamily:'inherit', width:'100%' }}>
              View Offer PDF
            </button>
          )}
          <Field label="Notes"><textarea style={{ ...inp, minHeight:56, resize:'vertical' }} value={form.nhc_notes||''} onChange={set('nhc_notes')} /></Field>
        </div>
      )}

      {/* ══════════════ ACQUISITION TAB ══════════════ */}
      {tab==='acquisition' && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <Toggle
            on={form.acquisition_type==='Pre-Owned'}
            onToggle={()=>setVal('acquisition_type', form.acquisition_type==='Pre-Owned' ? 'Purchased' : 'Pre-Owned')}
            label="Pre-Owned"
            sub="This property was already in Bob or Eric's personal portfolio — it's not being purchased through this deal."
          />

          {form.acquisition_type==='Pre-Owned' ? (
            <div style={{ background:'#FAFAF8', borderRadius:8, padding:'12px 14px', border:'0.5px solid #D6D2CA' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:0.8, marginBottom:4 }}>Known History (Optional)</div>
              <div style={{ fontSize:11, color:'#9ca3af', marginBottom:10 }}>
                No purchase price is tracked for pre-owned properties. If you happen to know what was originally paid or already renovated, jot it down here — it's not used in any calculations yet, just kept for reference.
              </div>
              <FieldRow>
                <Field label="Original Acquisition Cost"><MoneyInput value={form.prior_acquisition_cost} onChange={set('prior_acquisition_cost')} /></Field>
                <Field label="Prior Renovation Spend"><MoneyInput value={form.prior_renovation_cost} onChange={set('prior_renovation_cost')} /></Field>
              </FieldRow>
              <Field label="Notes"><textarea style={{ ...inp, minHeight:52, resize:'vertical' }} value={form.prior_history_notes||''} onChange={set('prior_history_notes')} placeholder="e.g. bought in 2019, kitchen redone in 2021" /></Field>
            </div>
          ) : (
            <>
              <div className="drawer-section">Purchase</div>
              <FieldRow>
                <Field label="Purchase Price"><MoneyInput value={form.purchase_price} onChange={set('purchase_price')} /></Field>
                <Field label="Purchase Date"><DatePicker style={inp} value={form.purchase_date||''} onChange={set('purchase_date')} /></Field>
              </FieldRow>

              <div className="drawer-section">Down Payment</div>
              <div style={{ fontSize:11, color:'#9ca3af', marginTop:-8 }}>
                The cash portion of the purchase not covered by the loan. Separate from Closing Costs.
              </div>
              <FieldRow>
                <Field label="Down Payment"><MoneyInput value={form.down_payment} onChange={set('down_payment')} /></Field>
                <Field label="Paid By">
                  <select style={inp} value={form.down_payment_paid_by||''} onChange={set('down_payment_paid_by')}>
                    <option value="">—</option>
                    {PAID_BY_OPTIONS.map(p=><option key={p} value={p}>{p}</option>)}
                  </select>
                </Field>
              </FieldRow>
              <LoanVsPurchaseCheck propertyId={form.id} purchasePrice={form.purchase_price} downPayment={form.down_payment} />

              <div className="drawer-section">Closing Costs</div>
              <div style={{ fontSize:11, color:'#9ca3af', marginTop:-8 }}>
                This is the same figure shown on the Rehab tab — editing it here updates it there too.
              </div>
              <FieldRow>
                <Field label="Closing Costs"><MoneyInput value={form.closing_costs} onChange={set('closing_costs')} /></Field>
                <Field label="Paid By">
                  <select style={inp} value={form.closing_costs_paid_by||''} onChange={set('closing_costs_paid_by')}>
                    <option value="">—</option>
                    {PAID_BY_OPTIONS.map(p=><option key={p} value={p}>{p}</option>)}
                  </select>
                </Field>
              </FieldRow>

              {(type==='Renovation' || type==='Flip' || type==='Hold') && (<>
                <div className="drawer-section">NHC Commission</div>
                <div style={{ fontSize:11, color:'#9ca3af', marginTop:-8, marginBottom:2 }}>
                  Paid by BPV to the NHC team as part of this purchase.
                </div>
                <div style={{ display:'flex', gap:6, marginBottom:2 }}>
                  {['pct','flat'].map(m=>(
                    <button key={m} type="button"
                      onClick={()=>{
                        if (m==='flat') {
                          const flat = form.commission_earned || 5000
                          setForm(f=>({...f, commission_mode:'flat', commission_earned:String(flat), commission_pct:''}))
                        } else {
                          setForm(f=>({...f, commission_mode:'pct'}))
                        }
                      }}
                      style={{
                        flex:1, padding:'6px 10px', borderRadius:6, fontSize:11, fontWeight:700, fontFamily:'inherit', cursor:'pointer',
                        border:`1.5px solid ${(form.commission_mode||'pct')===m?'#B8892A':'#D6D2CA'}`,
                        background:(form.commission_mode||'pct')===m?'#B8892A18':'#fff',
                        color:(form.commission_mode||'pct')===m?'#B8892A':'#6b7280',
                      }}>{m==='pct' ? 'Percentage' : 'Flat Fee'}</button>
                  ))}
                </div>
                {(form.commission_mode||'pct')==='pct' ? (
                  <Field label="Commission %">
                    <input style={monoInp} type="number" value={form.commission_pct||''}
                      onChange={e=>{ const e2=calcCommission(e.target.value,form.purchase_price); setForm(f=>({...f,commission_pct:e.target.value,commission_earned:e2?e2.toFixed(2):f.commission_earned})) }} />
                    {form.commission_earned && (
                      <div style={{ fontSize:11, color:'#9ca3af', marginTop:5 }}>≈ {fmt(form.commission_earned)}</div>
                    )}
                  </Field>
                ) : (
                  <Field label="Commission"><MoneyInput value={form.commission_earned} onChange={set('commission_earned')} /></Field>
                )}
              </>)}

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
                  <FieldRow>
                    <Field label="# of Months"><input style={monoInp} type="number" value={form.post_occupancy_months||''} onChange={set('post_occupancy_months')} /></Field>
                    <Field label="Total Payment"><MoneyInput value={form.post_occupancy_payment} onChange={set('post_occupancy_payment')} /></Field>
                  </FieldRow>
                  <Field label="End Date"><DatePicker style={inp} value={form.post_occupancy_end_date||''} onChange={set('post_occupancy_end_date')} /></Field>
                </>)}
              </div>
            </>
          )}
        </div>
      )}

      {/* ══════════════ REHAB TAB ══════════════ */}
      {tab==='rehab' && (() => {
        // Active renovation work only happens as type='Renovation' (stage set in the drawer
        // header) or a client-funded Reno listing (stage set here, since that's not a full
        // Renovation-type deal). Everything else (Flip/Hold/Wholesale/As-Is Listing) has
        // already forked past renovation — show history only, no editable stage/date controls.
        const isClientReno = type==='Retail Listing' && form.listing_type==='Reno'
        const activeRenovation = type==='Renovation' || isClientReno
        return (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {isClientReno && (
          <FieldRow>
            <Field label="Renovation Stage">
              <select
                value={form.rehab_stage||'Not Started'}
                onChange={e=>{
                  const rs = e.target.value
                  setForm(f=>({
                    ...f, rehab_stage:rs,
                    // Client Reno listings: deal stage follows the work
                    ...(['Reno In Progress','Reno Completed'].includes(f.stage)
                      ? { stage: rs==='Complete' ? 'Reno Completed' : 'Reno In Progress' } : {}),
                  }))
                }}
                style={{
                  ...inp, fontWeight:700, color:'#fff',
                  background: REHAB_COLOR[form.rehab_stage||'Not Started'],
                  border:`1.5px solid ${REHAB_COLOR[form.rehab_stage||'Not Started']}`,
                }}
              >
                {REHAB_STAGES.map(st=><option key={st} value={st} style={{ background:'#fff', color:'#2C2C2C', fontWeight:400 }}>{st}</option>)}
              </select>
            </Field>
          </FieldRow>
          )}

          {activeRenovation ? (<>
            <FieldRow>
              <Field label="Renovation Start Date">
                <DatePicker style={inp} value={form.rehab_start_date||''} onChange={set('rehab_start_date')} />
              </Field>
              <Field label="Renovation Complete Date">
                <DatePicker style={inp} value={form.rehab_complete_date||''} onChange={set('rehab_complete_date')} />
              </Field>
            </FieldRow>
            {form.rehab_start_date && (() => {
              const end = form.rehab_complete_date || new Date().toISOString().slice(0,10)
              const days = daysBetween(form.rehab_start_date, end)
              if (days === null) return null
              return (
                <div style={{ fontSize:11, color:'#9ca3af', marginTop:-8 }}>
                  {form.rehab_complete_date
                    ? `Renovation took ${days} day${days===1?'':'s'} (${form.rehab_start_date} → ${form.rehab_complete_date})`
                    : `${days} day${days===1?'':'s'} in progress so far`}
                </div>
              )
            })()}
          </>) : (form.rehab_start_date || form.rehab_complete_date) && (() => {
            // Read-only history line for deals that already completed renovation before forking
            const end = form.rehab_complete_date || new Date().toISOString().slice(0,10)
            const days = form.rehab_start_date ? daysBetween(form.rehab_start_date, end) : null
            return (
              <div style={{ background:'#F0EDE6', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#6b7280' }}>
                {form.rehab_complete_date
                  ? `Renovated ${form.rehab_start_date} → ${form.rehab_complete_date}${days!==null ? ` (${days} day${days===1?'':'s'})` : ''}`
                  : form.rehab_start_date
                    ? `Renovation started ${form.rehab_start_date}, no completion date logged`
                    : `Renovation completed ${form.rehab_complete_date}`}
              </div>
            )
          })()}

          {form.id ? (<>
            <RehabStatCards propertyId={form.id} onOpenFull={()=>setRehabOpen(true)} closingDate={form.disposition_date || form.sale_date || null} />
            <Btn variant="outline" onClick={()=>setLedgerOpen(true)} style={{ fontSize:12 }}>View Partner Payback</Btn>
          </>) : (
            <div style={{ background:'#F0EDE6', borderRadius:8, padding:'14px', textAlign:'center', fontSize:12, color:'#9ca3af' }}>
              Save the property first to track rehab line items.
            </div>
          )}
        </div>
        )
      })()}

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
          {form.id ? (<>
            <RentOverview propertyId={form.id} onOpenFull={()=>setRentOpen(true)} refreshSignal={rentOpen} onRentChange={()=>onSave()} />
            <Btn variant="outline" onClick={()=>setLedgerOpen(true)} style={{ fontSize:12 }}>View Partner Payback</Btn>
          </>) : (
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
            <Field label="Commission"><MoneyInput value={form.commission_earned} onChange={set('commission_earned')} /></Field>
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
              <Field label="Commission"><MoneyInput value={form.commission_earned} onChange={set('commission_earned')} /></Field>
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
            <SummaryCard
              onClick={()=>setTab('acquisition')}
              footerLabel="Edit on Acquisition tab"
              rows={[
                { label:'Purchase Date', value:form.purchase_date },
                { label:'Purchase Price', value:fmt(form.purchase_price) },
                { label:'Down Payment', value:fmt(form.down_payment), tag:PARTNERS.includes(form.down_payment_paid_by)?form.down_payment_paid_by:null },
                { label:'Closing Costs', value:fmt(form.closing_costs), tag:PARTNERS.includes(form.closing_costs_paid_by)?form.closing_costs_paid_by:null },
              ]}
            />
            <LoanSummaryCard propertyId={form.id} onClick={()=>setTab('loan')} onTotal={setLoanPayoffTotal} />
            <SummaryCard
              onClick={()=>setTab('rehab')}
              footerLabel="Edit on Rehab tab"
              rows={[{ label:'Total Rehab Cost', value:fmt(rc) }]}
            />
            <PartnerPaybackSummary
              propertyId={form.id} property={form} closingDate={form.disposition_date || form.sale_date || null}
              onOpenLedger={()=>setLedgerOpen(true)} onTotal={setPartnerPaybackTotal}
            />

            <div className="drawer-section">Flip</div>
            <FieldRow>
              <Field label="Sale Price"><MoneyInput value={form.sale_price} onChange={set('sale_price')} /></Field>
              <Field label="Sale Date"><DatePicker style={inp} value={form.sale_date||''} onChange={set('sale_date')} /></Field>
            </FieldRow>
            <FieldRow>
              <Field label="Commission % (on Sale)">
                <input style={monoInp} type="number" value={form.sale_commission_pct||''}
                  onChange={e=>{ const e2=calcCommission(e.target.value,form.sale_price); setForm(f=>({...f,sale_commission_pct:e.target.value,sale_commission_earned:e2?e2.toFixed(2):f.sale_commission_earned})) }} />
              </Field>
              <Field label="Commission ($)"><MoneyInput value={form.sale_commission_earned} onChange={set('sale_commission_earned')} /></Field>
            </FieldRow>
            {form.sale_price && (
              <ProfitWaterfall
                salePrice={form.sale_price} commission={form.sale_commission_earned}
                loanPayoff={loanPayoffTotal} partnerPayback={partnerPaybackTotal}
                capGainsPct={form.capital_gains_pct} capGainsOverride={form.capital_gains_override}
                onCapGainsPctChange={v=>setForm(f=>({...f,capital_gains_pct:v}))}
                onCapGainsOverrideChange={v=>setForm(f=>({...f,capital_gains_override:v}))}
              />
            )}
            <Field label="BPV Notes"><textarea style={{ ...inp, minHeight:56, resize:'vertical' }} value={form.bpv_notes||''} onChange={set('bpv_notes')} /></Field>
          </>)}

          {/* ── HOLD ── */}
          {disp==='hold' && (<>
            <div className="drawer-section">Acquisition</div>
            <SummaryCard
              onClick={()=>setTab('acquisition')}
              footerLabel="Edit on Acquisition tab"
              rows={[
                { label:'Purchase Date', value:form.purchase_date },
                { label:'Purchase Price', value:fmt(form.purchase_price) },
                { label:'Down Payment', value:fmt(form.down_payment), tag:PARTNERS.includes(form.down_payment_paid_by)?form.down_payment_paid_by:null },
                { label:'Closing Costs', value:fmt(form.closing_costs), tag:PARTNERS.includes(form.closing_costs_paid_by)?form.closing_costs_paid_by:null },
              ]}
            />
            <LoanSummaryCard propertyId={form.id} onClick={()=>setTab('loan')} onTotal={setLoanPayoffTotal} />
            <SummaryCard
              onClick={()=>setTab('rehab')}
              footerLabel="Edit on Rehab tab"
              rows={[{ label:'Total Rehab Cost', value:fmt(rc) }]}
            />
            <PartnerPaybackSummary
              propertyId={form.id} property={form} closingDate={form.disposition_date || form.sale_date || null}
              onOpenLedger={()=>setLedgerOpen(true)} onTotal={setPartnerPaybackTotal}
            />

            <div className="drawer-section">Sale</div>
            <div style={{ background:'#FAFAF8', borderRadius:8, padding:'12px 14px', border:'0.5px solid #D6D2CA' }}>
              {stage==='Sold' ? (<>
                <div style={{ fontSize:11, color:'#9ca3af', marginBottom:8 }}>Stage is set to Sold — record the sale details below.</div>
                <FieldRow>
                  <Field label="Sale Price ($)"><input style={monoInp} type="number" value={form.sale_price||''} onChange={set('sale_price')} /></Field>
                  <Field label="Sale Date"><DatePicker style={inp} value={form.sale_date||''} onChange={set('sale_date')} /></Field>
                </FieldRow>
                <FieldRow>
                  <Field label="Commission % (on Sale)">
                    <input style={monoInp} type="number" value={form.sale_commission_pct||''}
                      onChange={e=>{ const e2=calcCommission(e.target.value,form.sale_price); setForm(f=>({...f,sale_commission_pct:e.target.value,sale_commission_earned:e2?e2.toFixed(2):f.sale_commission_earned})) }} />
                  </Field>
                  <Field label="Commission ($)"><MoneyInput value={form.sale_commission_earned} onChange={set('sale_commission_earned')} /></Field>
                </FieldRow>
                {form.sale_price && (
                  <div style={{ marginTop:10 }}>
                    <ProfitWaterfall
                      salePrice={form.sale_price} commission={form.sale_commission_earned}
                      loanPayoff={loanPayoffTotal} partnerPayback={partnerPaybackTotal}
                      capGainsPct={form.capital_gains_pct} capGainsOverride={form.capital_gains_override}
                      onCapGainsPctChange={v=>setForm(f=>({...f,capital_gains_pct:v}))}
                      onCapGainsOverrideChange={v=>setForm(f=>({...f,capital_gains_override:v}))}
                    />
                  </div>
                )}
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

      {/* Partner Ledger modal — all Bob/Eric-funded line items in one place */}
      {ledgerOpen && (
        <PartnerLedgerModal
          propertyId={form.id}
          property={form}
          closingDate={form.disposition_date || form.sale_date || null}
          onClose={()=>setLedgerOpen(false)}
          onNavigate={tabKey=>{
            setLedgerOpen(false)
            setTab(tabKey)
            if (tabKey==='rehab') setRehabOpen(true)
          }}
        />
      )}


    </>
  )

  const footerContent = (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
      {!isNew && !isAgentRole ? (
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
    <>
    <Drawer open={open} onClose={guardedClose} hideCloseButton width={580} footer={footerContent}
      title={form.address || 'New Property'}
      headerActions={null}
      subtitle={
        <div style={{ display:'flex', alignItems:'flex-end', gap:10, marginTop:8, flexWrap:'wrap' }}>
          {/* Owner dropdown — first */}
          <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
            <span style={{ fontSize:9, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.6 }}>Owner</span>
            <select
              value={form.owner||'BPV'}
              onChange={set('owner')}
              onClick={e=>e.stopPropagation()}
              disabled={restrictedAgent}
              style={{
                border:'1.5px solid #D6D2CA', borderRadius:6, padding:'3px 8px',
                fontSize:11, fontWeight:600, fontFamily:'inherit', color:'#6b7280', background:'#fff',
                cursor: restrictedAgent ? 'not-allowed' : 'pointer', outline:'none',
                opacity: restrictedAgent ? 0.6 : 1,
              }}>
              {['BPV','Bob Sophiea','Eric Kimble','Other'].map(o=><option key={o}>{o}</option>)}
            </select>
          </div>

          {/* Agent dropdown — who's working this deal */}
          <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
            <span style={{ fontSize:9, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.6 }}>Agent</span>
            <select
              value={form.agent_email||''}
              onChange={set('agent_email')}
              onClick={e=>e.stopPropagation()}
              disabled={restrictedAgent}
              style={{
                border:'1.5px solid #D6D2CA', borderRadius:6, padding:'3px 8px',
                fontSize:11, fontWeight:600, fontFamily:'inherit', color:'#6b7280', background:'#fff',
                cursor: restrictedAgent ? 'not-allowed' : 'pointer', outline:'none',
                opacity: restrictedAgent ? 0.6 : 1, maxWidth:130,
              }}>
              <option value="">— Unassigned —</option>
              {agentList.map(a=><option key={a.email} value={a.email}>{a.full_name||a.email}</option>)}
            </select>
          </div>

          {/* Type dropdown — primary */}
          <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
            <span style={{ fontSize:9, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.6 }}>Deal Type</span>
            <select
              value={type}
              onChange={e=>setType(e.target.value)}
              onClick={e=>e.stopPropagation()}
              disabled={restrictedAgent}
              style={{
                border:`1.5px solid ${typeColor}`, borderRadius:6, padding:'3px 8px',
                fontSize:11, fontWeight:700, fontFamily:'inherit',
                color:typeColor, background:typeColor+'12', cursor: restrictedAgent ? 'not-allowed' : 'pointer', outline:'none',
                opacity: restrictedAgent ? 0.6 : 1,
              }}>
              {TYPE_OPTIONS.map(t=><option key={t.value} value={t.value}>{t.label || t.value}</option>)}
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

          {/* Scoped stage dropdown — hidden for Analyzing/Lost which have no stages.
              Renovation deals show the WORK stages (rehab_stage); the coarse deal
              stage (Purchased/Renovation) is derived underneath, same as the board. */}
          {type==='Renovation' ? (
            <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
              <span style={{ fontSize:9, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.6 }}>Renovation Stage</span>
              <select
                value={form.rehab_stage||'Not Started'}
                onChange={e=>{
                  const rs = e.target.value
                  setForm(f=>({ ...f, rehab_stage:rs, stage: rs==='Not Started' ? 'Purchased' : 'Renovation' }))
                }}
                onClick={e=>e.stopPropagation()}
                style={{
                  border:`1.5px solid ${REHAB_COLOR[form.rehab_stage||'Not Started']}`, borderRadius:6, padding:'3px 8px',
                  fontSize:11, fontWeight:700, fontFamily:'inherit',
                  color:REHAB_COLOR[form.rehab_stage||'Not Started'], background:(REHAB_COLOR[form.rehab_stage||'Not Started'])+'12', cursor:'pointer', outline:'none',
                }}>
                {REHAB_STAGES.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          ) : scopedStages.length>0 && (
            <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
              <span style={{ fontSize:9, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.6 }}>Deal Stage</span>
              <select
                value={stage||''}
                onChange={e=>setVal('stage',e.target.value)}
                onClick={e=>e.stopPropagation()}
                disabled={restrictedAgent}
                style={{
                  border:`1.5px solid ${stageColor}`, borderRadius:6, padding:'3px 8px',
                  fontSize:11, fontWeight:700, fontFamily:'inherit',
                  color:stageColor, background:stageColor+'12', cursor: restrictedAgent ? 'not-allowed' : 'pointer', outline:'none',
                  opacity: restrictedAgent ? 0.6 : 1,
                }}>
                {scopedStages.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
        </div>
      }>
      {innerContent}
    </Drawer>

    {fullViewOpen && form.id && (
      <div
        onClick={e => e.target === e.currentTarget && setFullViewOpen(false)}
        style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.55)',
          zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:20,
        }}
      >
        <div style={{
          background:'#FAFAF8', borderRadius:12, width:'100%', maxWidth:1400, height:'92vh',
          display:'flex', flexDirection:'column', overflow:'hidden',
          boxShadow:'0 24px 70px rgba(0,0,0,0.35)', position:'relative',
        }}>
          <button
            onClick={() => setFullViewOpen(false)}
            title="Close"
            style={{
              position:'absolute', top:14, right:16, width:32, height:32, borderRadius:'50%',
              background:'#fff', border:'1px solid #D6D2CA', fontSize:16, cursor:'pointer',
              color:'#6b7280', zIndex:20, display:'flex', alignItems:'center', justifyContent:'center',
            }}
          >&times;</button>
          <PropertyFullView propertyId={form.id} onClose={()=>setFullViewOpen(false)} isAgentRole={isAgentRole} />
        </div>
      </div>
    )}
    </>
  )
}













