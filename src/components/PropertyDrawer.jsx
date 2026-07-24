import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase.js'
import { Field, FieldRow, inp, monoInp, Btn, fmt, fmtK, DatePicker, PAID_BY_OPTIONS, PARTNERS, calcOwed, relTime } from './ui.jsx'
import { calcOffers } from '../lib/valuation.js'
import Drawer from './Drawer.jsx'
import AddressInput from './AddressInput.jsx'
import RehabRoundTracker from './RehabRoundTracker.jsx'
import RehabStatCards from './RehabOverview.jsx'
import LoanTracker from './LoanTracker.jsx'
import RentTracker from './RentTracker.jsx'
import LoanOverview from './LoanOverview.jsx'
import RentOverview from './RentOverview.jsx'
import { CardStatBox } from './KanbanBoard.jsx'
import PartnerLedgerModal from './PartnerLedgerModal.jsx'
import PropertyFullView from './PropertyFullView.jsx'
import PingModal from './PingModal.jsx'
import { useIsMobile } from '../hooks/useIsMobile.js'

// ── Type options (primary) ────────────────────────────────────────────────────
const TYPE_OPTIONS = [
  { value:'Analyzing',       color:'#B8892A', label:'Analyzer' },
  { value:'Renovation',      color:'#6b21a8' },
  { value:'Flip',            color:'#D97825' },
  { value:'Hold',            color:'#B8892A' },
  { value:'Retail Listing',  color:'#3B6D11' },
  { value:'Wholesale',       color:'#6b21a8' },
]
const TYPE_COLOR = Object.fromEntries(TYPE_OPTIONS.map(t=>[t.value,t.color]))

// Legacy disposition <-> new type mapping (disposition kept in sync for Sold/Rehabs/PackageDeals pages)
const TYPE_TO_DISP = { 'Analyzing':null, 'Renovation':'renovation', 'Flip':'flip', 'Hold':'hold', 'Retail Listing':'listing', 'Wholesale':'wholesale' }

// Stages scoped per type.
const STAGE_BY_TYPE = {
  'Analyzing':      ['New Lead','Needs Cash Offer','Offer Submitted','Offer Accepted','Lost'],
  'Renovation':     ['Purchased','Renovation'],
  'Flip':           ['Off Market','Listed','Pending','Sold'],
  'Hold':           ['Vacant','Rent Ready','Rental Listed','Leased','Listed','Sold'],
  'Retail Listing': ['Off Market','Listed','Pending','Sold','Cancelled / Expired'],
  'Wholesale':      ['Pending','Assigned','Closed','Cancelled'],
}
const STAGE_COLOR = {
  'New Lead':'#9ca3af', 'Needs Cash Offer':'#D97825', 'Offer Submitted':'#B8892A', 'Offer Accepted':'#3B6D11', 'Off Market':'#9ca3af',
  Purchased:'#D97825', Renovation:'#6b21a8', Rehab:'#6b21a8', Listed:'#3B6D11', 'Pending':'#2D6FAF', Sold:'#3B6D11',
  Vacant:'#D97825', 'Rent Ready':'#B8892A', 'Rental Listed':'#2D6FAF', Leased:'#3B6D11', 'Reno In Progress':'#D97825', 'Reno Completed':'#B8892A',
  Assigned:'#6b21a8', Closed:'#3B6D11',
  Lost:'#9ca3af', 'Cancelled / Expired':'#9ca3af', Cancelled:'#9ca3af',
}

const OPS_STATUS_COLOR = {
  'New Deal':'#6b7280', 'Listing Signed':'#6b21a8', 'Coming Soon':'#D97825', 'Active Listing':'#2D6FAF',
  'Pending':'#D97825', 'Closed':'#3B6D11', 'Withdrawn':'#B91C1C', 'Lost':'#B91C1C',
}

// The street-number + street-name portion of an address, used to find likely-matching
// Ops Hub deals for this exact property without requiring an exact string match.
function streetPart(address) {
  if (!address) return ''
  return address.split(',')[0].trim()
}

// Search-and-link to a matching Ops Hub deal (pipeline_deals.cashoffer_property_id
// points back at this property, tagged with a role so a property can carry two
// separate links: the Acquisition-side deal (buying it) and the Disposition-side
// deal (selling it) — each is a different Ops Hub transaction). Shows the current
// link (if any) with a small card showing Deal Stage, Agent, and a stage-appropriate
// price (List/Pending/Sale) + commission if entered. Writes happen immediately (not
// gated behind the drawer's main Save button) since this is a cross-table relationship.
function LinkedOpsDealField({ propertyId, propertyAddress, role, label, onApply }) {
  const [linked, setLinked] = useState(undefined) // undefined = loading, null = none
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const wrapRef = useRef(null)

  const SELECT_COLS = 'id, client_name, property_address, status, primary_agent, deal_type, volume, list_price, original_list_price, commission_pct, commission_flat_fee, commission_rate, closing_date'

  async function loadLinked() {
    if (!propertyId) { setLinked(null); return }
    const { data } = await supabase.from('pipeline_deals')
      .select(SELECT_COLS)
      .eq('cashoffer_property_id', propertyId)
      .eq('cashoffer_link_role', role)
      .maybeSingle()
    setLinked(data || null)
  }

  useEffect(() => { loadLinked() }, [propertyId, role]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function handler(e) { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Address is the primary match — client name is a fallback only. Address hits are
  // sorted to the top since that's almost always what identifies the right deal.
  async function search(q) {
    if (!q || q.trim().length < 2) { loadRecommended(); return }
    setLoading(true)
    const { data } = await supabase.from('pipeline_deals')
      .select(SELECT_COLS)
      .or(`property_address.ilike.%${q}%,client_name.ilike.%${q}%`)
      .limit(10)
    const sorted = (data || []).sort((a, b) => {
      const aAddr = a.property_address?.toLowerCase().includes(q.toLowerCase()) ? 0 : 1
      const bAddr = b.property_address?.toLowerCase().includes(q.toLowerCase()) ? 0 : 1
      return aAddr - bAddr
    }).slice(0, 8)
    setResults(sorted)
    setOpen(true)
    setLoading(false)
  }

  // Shown on focus, before typing — deals whose address matches this property's own
  // address, since that's the overwhelmingly likely candidate. Falls back to recent
  // deals generally if nothing matches (e.g. this property hasn't been listed in Ops yet).
  async function loadRecommended() {
    setLoading(true)
    const street = streetPart(propertyAddress)
    let data = []
    if (street) {
      const { data: addrMatches } = await supabase.from('pipeline_deals')
        .select(SELECT_COLS)
        .ilike('property_address', `%${street}%`)
        .order('created_at', { ascending: false })
        .limit(8)
      data = addrMatches || []
    }
    if (data.length === 0) {
      const { data: recent } = await supabase.from('pipeline_deals')
        .select(SELECT_COLS)
        .eq('is_archived', false)
        .order('created_at', { ascending: false })
        .limit(8)
      data = recent || []
    }
    setResults(data)
    setOpen(true)
    setLoading(false)
  }

  function handleChange(e) {
    const v = e.target.value
    setQuery(v)
    search(v)
  }

  async function linkDeal(dealId) {
    await supabase.from('pipeline_deals').update({ cashoffer_property_id: propertyId, cashoffer_link_role: role }).eq('id', dealId)
    setOpen(false)
    setQuery('')
    setResults([])
    loadLinked()
  }

  async function unlink() {
    if (!linked) return
    await supabase.from('pipeline_deals').update({ cashoffer_property_id: null, cashoffer_link_role: null }).eq('id', linked.id)
    setLinked(null)
  }

  const isClosed = linked?.status === 'Closed'
  // NHC Commission: prefer a flat fee if one was set, otherwise compute from rate × the
  // stage-appropriate price. Only shown if actually entered on the Ops side.
  const priceLabel = linked?.status === 'Closed' ? 'Sale Price'
    : linked?.status === 'Pending' ? 'Pending Price'
    : (linked?.status === 'Active Listing' || linked?.status === 'Listing Signed' || linked?.status === 'Coming Soon' || linked?.status === 'New Deal') ? 'List Price'
    : 'Price'
  const priceAmt = linked ? (linked.volume || linked.list_price || linked.original_list_price) : null
  const commissionAmt = linked ? (linked.commission_flat_fee || (priceAmt && linked.commission_rate ? priceAmt * linked.commission_rate / 100 : null)) : null

  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5 }}>
        {label}
      </label>

      {linked === undefined ? (
        <div style={{ fontSize: 12, color: '#9ca3af' }}>Loading…</div>
      ) : linked ? (
        <div style={{ background: '#FAF6EF', border: '0.5px solid #E8DFC8', borderRadius: 6, padding: '8px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#2C2C2C' }}>{linked.client_name || linked.property_address || '—'}</div>
              <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                {linked.deal_type}{linked.primary_agent ? ` · ${linked.primary_agent}` : ''}
              </div>
            </div>
            <span style={{ flexShrink:0, fontSize:9, fontWeight:700, color:'#fff', background: OPS_STATUS_COLOR[linked.status] || '#6b7280', borderRadius:5, padding:'3px 8px', textTransform:'uppercase', letterSpacing:0.4, whiteSpace:'nowrap' }}>
              {linked.status}
            </span>
          </div>

          {(priceAmt || commissionAmt != null) && (
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              {priceAmt != null && <CardStatBox label={priceLabel} value={fmt(priceAmt)} color="#2C2C2C" bg="#F0EDE6" />}
              {commissionAmt != null && <CardStatBox label="NHC Commission" value={fmt(commissionAmt)} color="#B8892A" bg="#FBF6EA" />}
            </div>
          )}

          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            {onApply && (
              <button
                onClick={() => isClosed && onApply(linked)}
                disabled={!isClosed}
                title={isClosed ? 'Copy price and commission from this Ops Hub deal into the property' : 'Available once this Ops Hub deal is Closed'}
                style={{ flex:1, background: isClosed ? '#3B6D11' : '#E5E1DB', border: 'none', borderRadius: 6, padding: '6px 10px', fontSize: 11, fontWeight: 700, color: isClosed ? '#fff' : '#9ca3af', cursor: isClosed ? 'pointer' : 'not-allowed' }}
              >↻ Pull In{!isClosed ? ' (once Closed)' : ''}</button>
            )}
            <button
              onClick={() => window.open(`https://ops.nhcnow.com/?page=pipeline&deal=${linked.id}`, '_blank', 'noopener,noreferrer')}
              style={{ background: '#B8892A', border: 'none', borderRadius: 6, padding: '6px 10px', fontSize: 11, fontWeight: 700, color: '#fff', cursor: 'pointer', whiteSpace:'nowrap' }}
            >↗ Open in Ops Hub</button>
            <button onClick={unlink} title="Unlink" style={{ background: 'none', border: '1px solid #D6D2CA', borderRadius: 6, color: '#9ca3af', cursor: 'pointer', width: 28, flexShrink:0 }}>×</button>
          </div>
        </div>
      ) : (
        <div ref={wrapRef} style={{ position: 'relative' }}>
          <input
            style={inp}
            value={query}
            onChange={handleChange}
            onFocus={() => { if (results.length > 0) setOpen(true); else loadRecommended() }}
            placeholder={propertyAddress ? `Search by address or client — try "${streetPart(propertyAddress)}"` : 'Search Ops Hub by address or client name'}
          />
          {open && (loading || results.length > 0 || query.trim().length < 2) && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 500, marginTop: 4,
              background: '#fff', border: '1px solid #E0DDD6', borderRadius: 8,
              boxShadow: '0 6px 20px rgba(0,0,0,0.14)', maxHeight: 240, overflowY: 'auto',
            }}>
              {!loading && results.length > 0 && (
                <div style={{ padding: '7px 12px', fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, background: '#FAFAF8', borderBottom: '1px solid #F0EDE6' }}>
                  {query.trim().length < 2 ? 'Matching This Address' : 'Matching Deals'}
                </div>
              )}
              {loading && <div style={{ padding: '10px 12px', fontSize: 12, color: '#9ca3af' }}>Loading…</div>}
              {!loading && results.length === 0 && (
                <div style={{ padding: '10px 12px', fontSize: 12, color: '#9ca3af' }}>No matching Ops Hub deals</div>
              )}
              {!loading && results.map(d => (
                <div
                  key={d.id}
                  onMouseDown={() => linkDeal(d.id)}
                  style={{ padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid #F5F2EB' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#FAFAF8'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#2C2C2C' }}>{d.property_address || d.client_name || '—'}</div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                    {d.client_name || 'No client'} · {d.deal_type} · {d.status}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function stagesForType(type) {
  return STAGE_BY_TYPE[type] || []
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

// NHC Commission and Co-op Commission — both plain dollar fields. Percentages aren't
// tracked here anymore since the Linked Ops Hub Deal's Pull In button already supplies
// the real NHC commission dollar amount once the deal is Closed. Co-op commission has
// no % field either — it still needs manual entry since Ops doesn't track that dollar
// figure at all (it only names the co-op agent, not what they were paid).
function SaleCommission({ form, setForm }) {
  const nhcAmt = parseFloat(form.sale_commission_seller_amt) || 0
  const coopAmt = parseFloat(form.sale_commission_buyer_amt) || 0
  const totalAmt = nhcAmt + coopAmt

  return (
    <>
      <FieldRow>
        <Field label="NHC Commission ($)">
          <MoneyInput value={form.sale_commission_seller_amt} onChange={v=>setForm(f=>({ ...f, sale_commission_seller_amt:v }))} />
        </Field>
        <Field label="Co-op Commission ($) — not tracked in Ops">
          <MoneyInput value={form.sale_commission_buyer_amt} onChange={v=>setForm(f=>({ ...f, sale_commission_buyer_amt:v }))} />
        </Field>
      </FieldRow>
      {(nhcAmt > 0 || coopAmt > 0) && (
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#6b7280', padding:'8px 2px 2px', borderTop:'1px dashed #E5E1D8', marginTop:6 }}>
          <span>Total Commission (deducted from sale)</span>
          <span style={{ fontWeight:700, color:'#2C2C2C' }}>${totalAmt.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
        </div>
      )}
    </>
  )
}

// Uniform pill-style <select> matching the Ops Hub's PillDropdown look: solid
// color fill + white bold uppercase text once a value is set, muted grey pill
// beforehand. Fixed width so header selects line up cleanly across rows.
const PILL_WIDTH = 152
function HeaderPillSelect({ value, onChange, disabled, title, color, hasValue, children }) {
  return (
    <div style={{ position:'relative', width:PILL_WIDTH }}>
      <select
        value={value}
        onChange={onChange}
        onClick={e=>e.stopPropagation()}
        disabled={disabled}
        title={title}
        style={{
          appearance:'none', WebkitAppearance:'none', MozAppearance:'none',
          border:'none', borderRadius:5, padding:'6px 22px 6px 10px', width:'100%', boxSizing:'border-box',
          fontSize:11, fontWeight:700, fontFamily:'inherit', textTransform:'uppercase', letterSpacing:'0.05em',
          whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
          color: hasValue ? '#fff' : '#9ca3af',
          background: hasValue ? color : '#F0EDE6',
          cursor: disabled ? 'not-allowed' : 'pointer', outline:'none',
          opacity: disabled ? 0.6 : 1,
        }}>
        {children}
      </select>
      <span style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', fontSize:8, opacity:0.8, pointerEvents:'none', color: hasValue ? '#fff' : '#9ca3af' }}>▼</span>
    </div>
  )
}

// Owner + Agent pickers — shown in the header for every deal type, and again on the
// Purchase tab for types that have one. The Owner select is greyed out (ownerDisabled)
// while a deal is still type 'Analyzing' — nothing to own until it's actually purchased —
// and unlocks once the deal moves into a purchased type (Flip/Hold/Renovation/Wholesale)
// or for Retail Listing, which is never 'Analyzing' to begin with. Owner combines people
// flagged as Property Owners (Users page) and businesses (Business page); legacy `owner`
// text field kept in sync for the existing card display across Rehabs/Holds/Listings/Wholesale/Sold.
function OwnerAgentPicker({ form, setForm, set, entityList, ownerUserList, agentList, restrictedAgent, ownerDisabled=false }) {
  const ownerLocked = restrictedAgent || ownerDisabled
  const ownerValue = form.owner_entity_id ? `entity:${form.owner_entity_id}` : form.owner_user_email ? `user:${form.owner_user_email}` : form.owner==='Client' ? 'client' : ''
  const agentValue = form.agent_email || ''
  return (
    <>
      <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
        <span style={{ fontSize:9, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.6 }}>Owner</span>
        <HeaderPillSelect
          value={ownerValue}
          hasValue={!!ownerValue}
          color="#4B5563"
          disabled={ownerLocked}
          title={ownerDisabled && !restrictedAgent ? 'Owner is set once the property is purchased' : undefined}
          onChange={e=>{
            const val = e.target.value
            if (!val) { setForm(f=>({ ...f, owner_user_email:null, owner_entity_id:null, owner:null })); return }
            if (val === 'client') { setForm(f=>({ ...f, owner_user_email:null, owner_entity_id:null, owner:'Client' })); return }
            const [kind, id] = val.split(':')
            if (kind === 'entity') {
              const ent = entityList.find(x=>x.id===id)
              setForm(f=>({ ...f, owner_entity_id:id, owner_user_email:null, owner: ent?.name || f.owner }))
            } else {
              const u = ownerUserList.find(x=>x.email===id)
              setForm(f=>({ ...f, owner_user_email:id, owner_entity_id:null, owner: u?.full_name || f.owner }))
            }
          }}>
          <option value="">Not yet selected</option>
          <option value="client">Client (not NHC/BPV owned)</option>
          {ownerUserList.length > 0 && (
            <optgroup label="People">
              {ownerUserList.map(u=><option key={u.email} value={`user:${u.email}`}>{u.full_name||u.email}</option>)}
            </optgroup>
          )}
          {entityList.length > 0 && (
            <optgroup label="Businesses">
              {entityList.map(ent=><option key={ent.id} value={`entity:${ent.id}`}>{ent.name}</option>)}
            </optgroup>
          )}
        </HeaderPillSelect>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
        <span style={{ fontSize:9, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.6 }}>NHC Agent</span>
        <HeaderPillSelect
          value={agentValue}
          hasValue={!!agentValue}
          color="#B8892A"
          disabled={restrictedAgent}
          onChange={set('agent_email')}>
          <option value="">No Agent</option>
          <option value="__outside_agent__">Outside Agent</option>
          {agentList.map(a=><option key={a.email} value={a.email}>{a.full_name||a.email}</option>)}
        </HeaderPillSelect>
      </div>
    </>
  )
}

export default function PropertyDrawer({ property, open, onClose, onSave, mailings=[], onViewOffer, inlineMode=false, initialTab='analyzer', openRentTracker=false, currentUserEmail=null, isAgentRole=false }) {
  const isFullViewMobile = useIsMobile()
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
  const [pingOpen, setPingOpen] = useState(false)
  const [sendingOffer, setSendingOffer] = useState(false)
  const [agentList, setAgentList] = useState([])
  const [ownerUserList, setOwnerUserList] = useState([])
  const [entityList, setEntityList] = useState([])

  function nameFor(email) {
    if (!email) return ''
    const a = agentList.find(a => a.email === email)
    return a?.full_name || email
  }

  useEffect(() => {
    supabase.from('cashoffer_users').select('email,full_name,role').in('role',['agent','admin']).order('full_name')
      .then(({ data }) => setAgentList(data || []))
    supabase.from('cashoffer_users').select('email,full_name').eq('is_property_owner', true).order('full_name')
      .then(({ data }) => setOwnerUserList(data || []))
    supabase.from('cashoffer_entities').select('id,name').order('name')
      .then(({ data }) => setEntityList(data || []))
  }, [])

  const [units, setUnits] = useState([])
  useEffect(() => {
    if (!form.id) { setUnits([]); return }
    supabase.from('cashoffer_units').select('*').eq('property_id', form.id).order('sort_order', { ascending:true })
      .then(({ data }) => {
        const count = parseInt(form.unit_count) || 1
        if ((!data || data.length === 0) && count > 1) {
          // Multi-unit property with no per-unit rows yet (e.g. unit_count was set
          // before this feature existed, or imported directly) — seed blank editable rows.
          setUnits(Array.from({ length: count }, (_, i) => ({
            id: `new-${Date.now()}-${i}`, unit_label: `Unit ${i+1}`, beds:'', baths:'', sqft:'', market_rent:'', current_rent:'',
          })))
        } else {
          setUnits(data || [])
        }
      })
  }, [form.id])

  const unitCount = parseInt(form.unit_count) || 1
  const isMultiUnit = unitCount > 1
  function unitTypeLabelFor(n) {
    if (n <= 1) return 'Single'
    if (n === 2) return 'Duplex'
    if (n === 3) return 'Triplex'
    if (n === 4) return 'Quadplex'
    return 'Custom'
  }
  function setUnitCountAndSync(n) {
    const count = Math.max(1, n)
    setForm(f => {
      if (count === 1 && unitCount > 1) {
        // Preserve the current unit totals as the single-family values so nothing is lost
        // if they switch back to multi-unit later in this same session.
        return { ...f, unit_count: count, beds: unitTotals.beds || f.beds, baths: unitTotals.baths || f.baths, sqft: unitTotals.sqft || f.sqft }
      }
      return { ...f, unit_count: count }
    })
    if (count === 1) {
      // Leave `units` alone — don't clear them — so toggling back to multi-unit
      // restores exactly what was there before.
      return
    }
    setUnits(us => {
      const next = [...us]
      if (next.length === 0) {
        // First time going multi-unit: seed unit 1 with the prior single-family values.
        next.push({ id:`new-${Date.now()}-0`, unit_label:'Unit 1', beds: form.beds||'', baths: form.baths||'', sqft: form.sqft||'', market_rent:'', current_rent:'' })
      }
      while (next.length < count) next.push({ id:`new-${Date.now()}-${next.length}`, unit_label:`Unit ${next.length+1}`, beds:'', baths:'', sqft:'', market_rent:'', current_rent:'' })
      while (next.length > count) next.pop()
      return next
    })
  }
  function updateUnit(id, k, v) { setUnits(us => us.map(u => u.id===id ? { ...u, [k]:v } : u)) }
  const unitTotals = units.reduce((acc,u) => ({
    beds: acc.beds + (parseFloat(u.beds)||0),
    baths: acc.baths + (parseFloat(u.baths)||0),
    sqft: acc.sqft + (parseFloat(u.sqft)||0),
    rent: acc.rent + (parseFloat(u.market_rent)||0),
    currentRent: acc.currentRent + (parseFloat(u.current_rent)||0),
  }), { beds:0, baths:0, sqft:0, rent:0, currentRent:0 })

  const isNew   = !form.id
  // An agent editing an existing deal only gets the Analyzer tab and can't touch
  // Owner/Type/Stage classification or delete — everything else stays admin/viewer-only.
  const restrictedAgent = isAgentRole && !isNew

  // Record locking — who (if anyone) else is editing this property right now
  const [lockedByOther, setLockedByOther] = useState(null)
  const ownLock = useRef(false)
  const LOCK_STALE_MS = 5 * 60 * 1000

  async function claimLock(force = false) {
    if (!form.id || !currentUserEmail) return
    const cutoff = new Date(Date.now() - LOCK_STALE_MS).toISOString()
    let q = supabase.from('cashoffer_properties')
      .update({ locked_by: currentUserEmail, locked_at: new Date().toISOString() })
      .eq('id', form.id)
    if (!force) q = q.or(`locked_by.is.null,locked_by.eq.${currentUserEmail},locked_at.lt.${cutoff}`)
    const { data } = await q.select('id')
    if (data && data.length) {
      ownLock.current = true
      setLockedByOther(null)
    } else {
      const { data: row } = await supabase.from('cashoffer_properties')
        .select('locked_by, locked_at').eq('id', form.id).single()
      if (row?.locked_by && row.locked_by !== currentUserEmail) setLockedByOther(row.locked_by)
    }
  }

  // Claim on open, heartbeat while open, release on close/switch
  useEffect(() => {
    if (!form.id || !currentUserEmail) { setLockedByOther(null); return }
    claimLock()
    const hb = setInterval(() => {
      if (ownLock.current) {
        supabase.from('cashoffer_properties')
          .update({ locked_at: new Date().toISOString() })
          .eq('id', form.id).eq('locked_by', currentUserEmail).then(() => {})
      }
    }, 120000)
    return () => {
      clearInterval(hb)
      if (ownLock.current) {
        supabase.from('cashoffer_properties')
          .update({ locked_by: null, locked_at: null })
          .eq('id', form.id).eq('locked_by', currentUserEmail).then(() => {})
        ownLock.current = false
      }
    }
  }, [form.id, currentUserEmail]) // eslint-disable-line react-hooks/exhaustive-deps

  const type       = form.type || 'Analyzing'
  const disp    = form.stage === 'Lost' ? 'lost' : TYPE_TO_DISP[type] // derived — kept in sync for Sold/Rehabs/PackageDeals pages
  const scopedStages = stagesForType(type)
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
      const stages = stagesForType(t)
      const nextForm = { ...property, type:t, stage: property.stage || stages[0] || null }
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

  // When type changes, snap stage to the first valid stage for the new scope
  function setType(newType) {
    const stages = stagesForType(newType)
    setForm(f=>({ ...f, type:newType, stage: stages[0] || null }))
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
    if (lockedByOther) { alert(`This property is currently being edited by ${lockedByOther}. Your changes were not saved.`); return false }
    const rehab = rehabCost !== null ? rehabCost : (form.rehab_cost||null)
    const payload = {
      address:form.address,
      updated_by: currentUserEmail || null,
      beds: isMultiUnit ? (unitTotals.beds||null) : (form.beds||null),
      baths: isMultiUnit ? (unitTotals.baths||null) : (form.baths||null),
      seller_name:form.seller_name||null, seller_fub_link:form.seller_fub_link||null,
      photos_drive_link:form.photos_drive_link||null,
      sqft: isMultiUnit ? (unitTotals.sqft||null) : (form.sqft||null), unit_count:parseInt(form.unit_count)||null, unit_names:form.unit_names||null,
      market_rent: isMultiUnit ? (unitTotals.rent||null) : (form.market_rent||null),
      current_rent: isMultiUnit ? (unitTotals.currentRent||null) : (form.current_rent||null),
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
      sale_commission_pct: form.sale_commission_pct || null,
      sale_commission_earned: ((parseFloat(form.sale_commission_seller_amt)||0) + (parseFloat(form.sale_commission_buyer_amt)||0)) || form.sale_commission_earned || null,
      sale_commission_seller_amt:form.sale_commission_seller_amt||null,
      sale_commission_buyer_amt:form.sale_commission_buyer_amt||null,
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
      type:type, listing_type:null,
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
      owner:form.owner||null, managed_by_bpv:form.managed_by_bpv||false,
      owner_user_email:form.owner_user_email||null, owner_entity_id:form.owner_entity_id||null,
      agent_email:form.agent_email||null,
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
    let savedId = form.id
    if (isNew) {
      const { data, error } = await supabase.from('cashoffer_properties').insert(payload).select('id').single()
      if (error) {
        alert(`Couldn't save this property.\n\n${error.message}\n\nYour changes are still in the form — please try again or let Madison know if this keeps happening.`)
        return false
      }
      savedId = data.id
    } else {
      const { error } = await supabase.from('cashoffer_properties').update(payload).eq('id',form.id)
      if (error) {
        alert(`Couldn't save this property.\n\n${error.message}\n\nYour changes are still in the form — please try again or let Madison know if this keeps happening.`)
        return false
      }
    }

    // Sync the unit breakdown: simplest consistent approach is replace-all —
    // clear existing rows for this property, then re-insert the current set.
    await supabase.from('cashoffer_units').delete().eq('property_id', savedId)
    if (isMultiUnit && units.length) {
      const unitRows = units.map((u,i) => ({
        property_id: savedId,
        unit_label: u.unit_label || `Unit ${i+1}`,
        beds: u.beds ? parseFloat(u.beds) : null,
        baths: u.baths ? parseFloat(u.baths) : null,
        sqft: u.sqft ? parseFloat(u.sqft) : null,
        market_rent: u.market_rent ? parseFloat(u.market_rent) : null,
        current_rent: u.current_rent ? parseFloat(u.current_rent) : null,
        sort_order: i,
      }))
      const { error: unitError } = await supabase.from('cashoffer_units').insert(unitRows)
      if (unitError) {
        alert(`Property saved, but the unit breakdown couldn't be saved.\n\n${unitError.message}`)
      }
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
  async function sendOfferToAgent() {
    if (!form.agent_email || form.agent_email === '__outside_agent__' || sendingOffer) return
    setSendingOffer(true)
    const { error } = await supabase.from('cashoffer_notifications').insert({
      property_id: form.id,
      recipient_email: form.agent_email,
      sender_email: currentUserEmail || null,
      message: `Your offer for ${form.address || 'this property'} is ready to review.`,
    })
    if (error) { setSendingOffer(false); alert(`Could not send: ${error.message}`); return }
    setTimeout(() => setSendingOffer(false), 2500)
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
    if (tab==='acquisition' && type==='Retail Listing') setTab('analyzer')
    if (restrictedAgent && tab!=='analyzer') setTab('analyzer')
  }, [showLoanTab, showRentTab, restrictedAgent]) // eslint-disable-line react-hooks/exhaustive-deps

  const TABS = restrictedAgent ? [{ key:'analyzer', label:'Analyzer' }] : [
    { key:'analyzer',    label:'Analyzer' },
    ...(type==='Retail Listing' ? [] : [{ key:'acquisition', label:'Purchase' }]),
    ...(showLoanTab ? [{ key:'loan', label:'Loan' }] : []),
    { key:'rehab',       label:'Renovation' },
    ...(showRentTab ? [{ key:'rent', label:'Lease' }] : []),
    { key:'disposition', label:'Sold' },
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
    <div style={{
      pointerEvents: lockedByOther ? 'none' : 'auto',
      opacity: lockedByOther ? 0.55 : 1,
      transition: 'opacity 0.15s',
    }}>
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

          <Field label="Unit Type">
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <select
                value={unitTypeLabelFor(unitCount)}
                onChange={e => {
                  const v = e.target.value
                  if (v==='Single') setUnitCountAndSync(1)
                  else if (v==='Duplex') setUnitCountAndSync(2)
                  else if (v==='Triplex') setUnitCountAndSync(3)
                  else if (v==='Quadplex') setUnitCountAndSync(4)
                  else setUnitCountAndSync(Math.max(5, unitCount))
                }}
                style={{ ...inp, maxWidth:150 }}>
                {['Single','Duplex','Triplex','Quadplex','Custom'].map(o=><option key={o}>{o}</option>)}
              </select>
              {unitCount>=5 && (
                <input
                  type="number" min={5} value={unitCount}
                  onChange={e=>setUnitCountAndSync(parseInt(e.target.value)||5)}
                  style={{ ...monoInp, width:70 }}
                />
              )}
            </div>
          </Field>

          <FieldRow forceRow>
            <Field label="Beds">
              {isMultiUnit
                ? <div style={{ ...monoInp, background:'#FAFAF8', color:'#6b7280', display:'flex', alignItems:'center' }}>{unitTotals.beds || '—'}</div>
                : <input style={monoInp} type="number" value={form.beds||''} onChange={set('beds')} />}
            </Field>
            <Field label="Baths">
              {isMultiUnit
                ? <div style={{ ...monoInp, background:'#FAFAF8', color:'#6b7280', display:'flex', alignItems:'center' }}>{unitTotals.baths || '—'}</div>
                : <input style={monoInp} type="number" value={form.baths||''} onChange={set('baths')} />}
            </Field>
            <Field label="Sq Ft">
              {isMultiUnit
                ? <div style={{ ...monoInp, background:'#FAFAF8', color:'#6b7280', display:'flex', alignItems:'center' }}>{unitTotals.sqft || '—'}</div>
                : <input style={monoInp} type="number" value={form.sqft||''} onChange={set('sqft')} />}
            </Field>
          </FieldRow>

          {!isMultiUnit && (
            <FieldRow forceRow>
              <Field label="Market Rent">
                <input style={monoInp} type="number" value={form.market_rent||''} onChange={set('market_rent')} placeholder="0" />
              </Field>
              <Field label="Current Rent">
                <input style={monoInp} type="number" value={form.current_rent||''} onChange={set('current_rent')} placeholder="0" />
              </Field>
            </FieldRow>
          )}

          {isMultiUnit && (
            <div>
              <div className="drawer-section">Units ({unitCount})</div>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr>
                    {['Unit','Beds','Baths','Sq Ft','Market Rent','Current Rent'].map((h,i)=>(
                      <th key={h} style={{ textAlign:i===0?'left':'center', fontSize:10, color:'#9ca3af', fontWeight:600, textTransform:'uppercase', letterSpacing:0.5, paddingBottom:4 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {units.map(u => (
                    <tr key={u.id}>
                      <td style={{ paddingBottom:6, paddingRight:6 }}><input style={{ ...inp, fontSize:12 }} value={u.unit_label||''} onChange={e=>updateUnit(u.id,'unit_label',e.target.value)} /></td>
                      <td style={{ paddingBottom:6, paddingRight:6 }}><input style={{ ...monoInp, fontSize:12, textAlign:'center' }} type="number" value={u.beds||''} onChange={e=>updateUnit(u.id,'beds',e.target.value)} /></td>
                      <td style={{ paddingBottom:6, paddingRight:6 }}><input style={{ ...monoInp, fontSize:12, textAlign:'center' }} type="number" value={u.baths||''} onChange={e=>updateUnit(u.id,'baths',e.target.value)} /></td>
                      <td style={{ paddingBottom:6, paddingRight:6 }}><input style={{ ...monoInp, fontSize:12, textAlign:'center' }} type="number" value={u.sqft||''} onChange={e=>updateUnit(u.id,'sqft',e.target.value)} /></td>
                      <td style={{ paddingBottom:6, paddingRight:6 }}><input style={{ ...monoInp, fontSize:12, textAlign:'center' }} type="number" value={u.market_rent||''} onChange={e=>updateUnit(u.id,'market_rent',e.target.value)} /></td>
                      <td style={{ paddingBottom:6 }}><input style={{ ...monoInp, fontSize:12, textAlign:'center' }} type="number" value={u.current_rent||''} onChange={e=>updateUnit(u.id,'current_rent',e.target.value)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ fontSize:11, color:'#9ca3af', marginTop:6, textAlign:'right' }}>
                Total Market Rent: <strong style={{ color:'#2C2C2C' }}>{fmt(unitTotals.rent)}</strong> / mo
                <span style={{ marginLeft:14 }}>Total Current Rent: <strong style={{ color:'#2C2C2C' }}>{fmt(unitTotals.currentRent)}</strong> / mo</span>
              </div>
            </div>
          )}
          <div className="drawer-section">Owner / Seller</div>
          {form.owner && (
            <div style={{ fontSize:11.5, color:'#B8892A', fontWeight:600, marginTop:-8 }}>
              Owned by {form.owner}
            </div>
          )}
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
              <span>Open Valuation Workspace</span>
              <span style={{ fontSize:16 }}>&#8599;</span>
            </button>
          )}
          {form.arv && (
            <button onClick={()=>onViewOffer&&onViewOffer({...form, repair_items:repairs.filter(r=>r.name||r.cost).map(r=>({name:r.name,cost:parseFloat(r.cost)||0}))})}
              style={{ background:'#2D6FAF', color:'#fff', border:'none', borderRadius:6, padding:'10px 16px', cursor:'pointer', fontSize:13, fontWeight:700, fontFamily:'inherit', width:'100%' }}>
              View Offer PDF
            </button>
          )}
          {!isNew && form.arv && form.agent_email && form.agent_email !== '__outside_agent__' && (
            <button onClick={sendOfferToAgent} disabled={sendingOffer} style={{ background:'#fff', border:'1.5px solid #B8892A', color:'#B8892A', borderRadius:6, padding:'10px 16px', cursor: sendingOffer ? 'default' : 'pointer', fontSize:13, fontWeight:700, fontFamily:'inherit', width:'100%' }}>
              {sendingOffer ? 'Sent!' : 'Send Offer to Agent'}
            </button>
          )}
          <Field label="Notes"><textarea style={{ ...inp, minHeight:56, resize:'vertical' }} value={form.nhc_notes||''} onChange={set('nhc_notes')} /></Field>
        </div>
      )}

      {/* ══════════════ ACQUISITION TAB ══════════════ */}
      {tab==='acquisition' && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div className="drawer-section">Linked Records</div>
          <LinkedOpsDealField
            propertyId={form.id} propertyAddress={form.address} role="acquisition" label="Linked Ops Hub Deal (Acquisition)"
            onApply={linked => {
              const price = linked.volume || linked.list_price || null
              const commission = linked.commission_flat_fee || (price && linked.commission_rate ? price*linked.commission_rate/100 : null)
              setForm(f=>({
                ...f,
                purchase_price: price != null ? String(price) : f.purchase_price,
                commission_pct: linked.commission_rate || linked.commission_pct || f.commission_pct,
                commission_earned: commission != null ? commission.toFixed(2) : f.commission_earned,
              }))
            }}
          />

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
        // header). Everything else (Flip/Hold/Wholesale/Retail Listing) has already forked
        // past renovation — show history only, no editable stage/date controls.
        const activeRenovation = type==='Renovation'
        return (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
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

          {disp && (<>
            <div className="drawer-section">Linked Records</div>
            <LinkedOpsDealField
              propertyId={form.id} propertyAddress={form.address} role="disposition"
              label="Linked Ops Hub Deal (Sold)"
              onApply={linked => {
                const price = linked.volume || linked.list_price || null
                const commissionAmt = linked.commission_flat_fee || (price && linked.commission_rate ? price*linked.commission_rate/100 : null)
                setForm(f=>({
                  ...f,
                  sale_price: price != null ? String(price) : f.sale_price,
                  disposition_date: linked.closing_date || f.disposition_date,
                  sale_commission_seller_amt: commissionAmt != null ? commissionAmt.toFixed(2) : f.sale_commission_seller_amt,
                }))
              }}
            />
          </>)}

          {/* ── LISTING ── */}
          {disp==='listing' && (<>
            <div className="drawer-section">Sale</div>
            <FieldRow>
              <Field label="Sale Price ($)"><input style={monoInp} type="number" value={form.sale_price||''} onChange={set('sale_price')} /></Field>
              <Field label="Close Date"><DatePicker style={inp} value={form.disposition_date||''} onChange={set('disposition_date')} /></Field>
            </FieldRow>
            <SaleCommission form={form} setForm={setForm} />
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
            <SaleCommission form={form} setForm={setForm} />
            {form.sale_price && (
              <ProfitWaterfall
                salePrice={form.sale_price} commission={(parseFloat(form.sale_commission_seller_amt)||0) + (parseFloat(form.sale_commission_buyer_amt)||0)}
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
                <SaleCommission form={form} setForm={setForm} />
                {form.sale_price && (
                  <div style={{ marginTop:10 }}>
                    <ProfitWaterfall
                      salePrice={form.sale_price} commission={(parseFloat(form.sale_commission_seller_amt)||0) + (parseFloat(form.sale_commission_buyer_amt)||0)}
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

      {/* Ping modal — message any teammate about this property */}
      {pingOpen && form.id && (
        <PingModal
          propertyId={form.id}
          propertyAddress={form.address}
          senderEmail={currentUserEmail}
          agentList={agentList}
          onClose={()=>setPingOpen(false)}
        />
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


    </div>
  )

  const footerContent = (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {lockedByOther ? (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, background:'#FFF3CD', border:'1px solid #E8DFC8', borderRadius:6, padding:'7px 12px' }}>
          <span style={{ fontSize:12, color:'#856404', fontWeight:600 }}>🔒 {nameFor(lockedByOther)} is editing this property — read only</span>
          {!isAgentRole && (
            <button onClick={()=>claimLock(true)} style={{ background:'none', border:'1px solid #B8892A', color:'#B8892A', borderRadius:4, padding:'3px 10px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>Take Over</button>
          )}
        </div>
      ) : form.updated_at ? (
        <span style={{ fontSize:11, color:'#9ca3af' }}>
          Last saved {relTime(form.updated_at)}{form.updated_by ? ` by ${nameFor(form.updated_by)}` : ''}
        </span>
      ) : null}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
        {!isNew && !isAgentRole ? (
          <button onClick={del} style={{ background:'#B91C1C', border:'1px solid #B91C1C', color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit', borderRadius:6, padding:'6px 12px' }}>
            Delete Property
          </button>
        ) : <span />}
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <Btn variant="outline" onClick={onClose}>Cancel</Btn>
          <Btn onClick={handleClose} disabled={!!lockedByOther}>Save</Btn>
        </div>
      </div>
    </div>
  )

  const fullViewModal = fullViewOpen && form.id && (
    <div
      onClick={e => e.target === e.currentTarget && setFullViewOpen(false)}
      style={{
        position:'fixed', inset:0, background:'rgba(0,0,0,0.55)',
        zIndex:300, display:'flex', alignItems:'center', justifyContent:'center',
        padding: isFullViewMobile ? 0 : 20,
      }}
    >
      <div style={{
        background:'#FAFAF8', borderRadius: isFullViewMobile ? 0 : 12, width:'100%',
        maxWidth: isFullViewMobile ? '100%' : 1400, height: isFullViewMobile ? '100dvh' : '92vh',
        display:'flex', flexDirection:'column', overflow:'hidden',
        boxShadow: isFullViewMobile ? 'none' : '0 24px 70px rgba(0,0,0,0.35)', position:'relative',
      }}>
        <button
          onClick={() => setFullViewOpen(false)}
          title="Close"
          style={{
            position:'absolute', top: isFullViewMobile ? 10 : 14, right: isFullViewMobile ? 12 : 16,
            width:32, height:32, borderRadius:'50%',
            background:'#fff', border:'1px solid #D6D2CA', fontSize:16, cursor:'pointer',
            color:'#6b7280', zIndex:20, display:'flex', alignItems:'center', justifyContent:'center',
          }}
        >&times;</button>
        <PropertyFullView propertyId={form.id} onClose={()=>setFullViewOpen(false)} isAgentRole={isAgentRole} currentUserEmail={currentUserEmail} agentList={agentList} />
      </div>
    </div>
  )

  if (inlineMode) return (
    <>
      <div style={{ padding:'0 16px 24px' }}>{innerContent}<div style={{ marginTop:20, paddingTop:16, borderTop:'1px solid #F0EDE6' }}>{footerContent}</div></div>
      {fullViewModal}
    </>
  )

  return (
    <>
    <Drawer open={open} onClose={guardedClose} hideCloseButton width={580} footer={footerContent}
      title={form.address || 'New Property'}
      headerActions={!isNew && (
        <button onClick={()=>setPingOpen(true)} title="Ping a teammate about this property" style={{ background:'#fff', border:'1px solid #D6D2CA', color:'#6b7280', borderRadius:6, padding:'6px 12px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6, whiteSpace:'nowrap' }}>
          🔔 Ping
        </button>
      )}
      subtitle={
        <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:8 }}>
          {/* Row 1: Owner + NHC Agent — always shown, Owner greyed out until purchased */}
          <div style={{ display:'flex', alignItems:'flex-end', gap:10, flexWrap:'wrap' }}>
            <OwnerAgentPicker form={form} setForm={setForm} setVal={setVal} set={set} entityList={entityList} ownerUserList={ownerUserList} agentList={agentList} restrictedAgent={restrictedAgent} ownerDisabled={type==='Analyzing'} />
          </div>

          {/* Row 2: Deal Type + Deal/Renovation Stage */}
          <div style={{ display:'flex', alignItems:'flex-end', gap:10, flexWrap:'wrap' }}>
            {/* Type dropdown — primary */}
            <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
              <span style={{ fontSize:9, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.6 }}>Deal Type</span>
              <HeaderPillSelect
                value={type}
                hasValue={true}
                color={typeColor}
                disabled={restrictedAgent}
                onChange={e=>setType(e.target.value)}>
                {TYPE_OPTIONS.map(t=><option key={t.value} value={t.value}>{t.label || t.value}</option>)}
              </HeaderPillSelect>
            </div>

            {/* Scoped stage dropdown — hidden for Analyzing/Lost which have no stages.
                Renovation deals show the WORK stages (rehab_stage); the coarse deal
                stage (Purchased/Renovation) is derived underneath, same as the board. */}
            {type==='Renovation' ? (
              <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                <span style={{ fontSize:9, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.6 }}>Renovation Stage</span>
                <HeaderPillSelect
                  value={form.rehab_stage||'Not Started'}
                  hasValue={true}
                  color={REHAB_COLOR[form.rehab_stage||'Not Started']}
                  onChange={e=>{
                    const rs = e.target.value
                    setForm(f=>({ ...f, rehab_stage:rs, stage: rs==='Not Started' ? 'Purchased' : 'Renovation' }))
                  }}>
                  {REHAB_STAGES.map(s=><option key={s} value={s}>{s}</option>)}
                </HeaderPillSelect>
              </div>
            ) : scopedStages.length>0 && (
              <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                <span style={{ fontSize:9, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.6 }}>Deal Stage</span>
                <HeaderPillSelect
                  value={stage||''}
                  hasValue={!!stage}
                  color={stageColor}
                  disabled={restrictedAgent}
                  onChange={e=>setVal('stage',e.target.value)}>
                  {scopedStages.map(s=><option key={s} value={s}>{s}</option>)}
                </HeaderPillSelect>
              </div>
            )}
          </div>
        </div>
      }>
      {innerContent}
    </Drawer>

    {fullViewModal}
    </>
  )
}














