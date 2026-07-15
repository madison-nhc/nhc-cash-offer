import { useEffect, useRef, useState, useCallback, Fragment } from 'react'
import PropertyDrawer from './PropertyDrawer.jsx'
import ProposalModal from './ProposalModal.jsx'
import PortfolioProposalModal from './PortfolioProposalModal.jsx'
import AddressInput from './AddressInput.jsx'
import { supabase } from '../lib/supabase.js'
import { PROMO_PAYLOADS } from './KanbanBoard.jsx'
import { fmt, useSort, SortTh } from './ui.jsx'

const STAGE_COLORS = { Purchased:'#3B6D11', Rehab:'#D97825', 'Reno In Progress':'#D97825', 'Reno Completed':'#D97825', Listed:'#2D6FAF', 'Under Contract':'#2D6FAF', Sold:'#3B6D11', Lost:'#9ca3af' }

// Splits "123 Main St, Lexington, KY 40503" into { street:"123 Main St", rest:"Lexington, KY 40503" }
function splitAddress(address) {
  if (!address) return { street: '', rest: '' }
  const idx = address.indexOf(',')
  if (idx === -1) return { street: address, rest: '' }
  return { street: address.slice(0, idx).trim(), rest: address.slice(idx + 1).trim() }
}

function calcCashOffer(p) {
  const arv = parseFloat(p.arv)||0
  if (!arv) return null
  const reno = (p.repair_items||[]).reduce((s,r)=>s+(parseFloat(r.cost)||0),0)
  const commCash = (parseFloat(p.comm_cash_pct)||9)/100
  const profitPct = (parseFloat(p.profit_margin)||15)/100
  const profit = p.profit_override ? parseFloat(p.profit_override) : arv*profitPct
  const cashHold = (parseFloat(p.hold_cash_pct)||0.75)/100*(parseFloat(p.hold_cash_months)||6)*arv
  return p.cash_offer_override ? parseFloat(p.cash_offer_override) : arv-reno-(commCash*arv)-cashHold-profit
}

function unitTypeLabel(count) {
  const n = parseInt(count) || 1
  if (n <= 1) return 'Single'
  if (n === 2) return 'Duplex'
  if (n === 3) return 'Triplex'
  if (n === 4) return 'Quadplex'
  return 'Custom'
}
const UNIT_TYPE_ORDER = ['Single', 'Duplex', 'Triplex', 'Quadplex', 'Custom']

// Small eye / eye-off icon button used to toggle a property's inclusion in the
// portfolio-wide cash offer total and PDF.
function EyeToggle({ excluded, onClick }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick() }}
      title={excluded ? 'Excluded from portfolio offer — click to include' : 'Included in portfolio offer — click to exclude'}
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', color: excluded ? '#c4c0b6' : '#B8892A' }}
    >
      {excluded ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
          <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
          <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
          <line x1="2" y1="2" x2="22" y2="22"/>
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      )}
    </button>
  )
}

// Properties table for the List view — its own component (not inline JSX)
// because useSort is a hook and needs a stable component instance.
function PackagePropertiesTable({ pkgProps, onOpenProperty, rentByProperty, onToggleExclude, onPromote }) {
  const { sorted, sortKey, sortDir, toggleSort } = useSort(pkgProps, 'address', 'asc', {
    cash_offer: p => calcCashOffer(p),
    stage: p => p.stage || 'Analyzing',
    rent_current: p => rentByProperty?.[p.id]?.current || 0,
    market_rent: p => rentByProperty?.[p.id]?.market || 0,
  })

  // Group the already-sorted rows by unit type, preserving sort order within each group
  const groups = UNIT_TYPE_ORDER
    .map(label => ({ label, rows: sorted.filter(p => unitTypeLabel(p.unit_count) === label) }))
    .filter(g => g.rows.length > 0)

  // Subtotal helper — only sums rows NOT excluded from the portfolio offer
  function subtotal(rows) {
    const included = rows.filter(p => !p.excluded_from_offer)
    return included.reduce((acc, p) => ({
      cashOffer: acc.cashOffer + (calcCashOffer(p) || 0),
      rehab: acc.rehab + (parseFloat(p.rehab_cost) || 0),
      arv: acc.arv + (parseFloat(p.arv) || 0),
      rentCurrent: acc.rentCurrent + (rentByProperty?.[p.id]?.current || 0),
      marketRent: acc.marketRent + (rentByProperty?.[p.id]?.market || 0),
      count: acc.count + 1,
    }), { cashOffer: 0, rehab: 0, arv: 0, rentCurrent: 0, marketRent: 0, count: 0 })
  }
  const grandTotal = subtotal(sorted)

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ background: '#F0EDE6', position:'sticky', top:0 }}>
          <th style={{ width: 32 }}></th>
          <SortTh sortKeyName="address" {...{sortKey,sortDir,toggleSort}}>Address</SortTh>
          <SortTh sortKeyName="cash_offer" {...{sortKey,sortDir,toggleSort}}>Cash Offer</SortTh>
          <SortTh sortKeyName="rehab_cost" {...{sortKey,sortDir,toggleSort}}>Est. Rehab</SortTh>
          <SortTh sortKeyName="arv" {...{sortKey,sortDir,toggleSort}}>ARV</SortTh>
          <SortTh sortKeyName="stage" {...{sortKey,sortDir,toggleSort}}>Status</SortTh>
          <SortTh sortKeyName="rent_current" {...{sortKey,sortDir,toggleSort}}>Total Rent Current</SortTh>
          <SortTh sortKeyName="market_rent" {...{sortKey,sortDir,toggleSort}}>Total Market Rent</SortTh>
        </tr>
      </thead>
      <tbody>
        {groups.map(group => {
          const groupTotal = subtotal(group.rows)
          return (
          <Fragment key={group.label}>
            <tr>
              <td colSpan={8} style={{ padding: '10px 14px 6px', fontSize: 11, fontWeight: 700, color: '#B8892A', textTransform: 'uppercase', letterSpacing: 0.6, background: '#FAF7F0', borderTop: '1px solid #F0EDE6' }}>
                {group.label} <span style={{ color: '#9ca3af', fontWeight: 600 }}>({group.rows.length})</span>
              </td>
            </tr>
            {group.rows.map((p, i) => {
              const cashOffer = calcCashOffer(p)
              const rent = rentByProperty?.[p.id]
              const excluded = !!p.excluded_from_offer
              const baseBg = i % 2 === 0 ? '#fff' : '#FAFAF8'
              return (
                <tr
                  key={p.id}
                  onClick={() => onOpenProperty(p)}
                  style={{ background: baseBg, borderTop: '0.5px solid #F0EDE6', cursor: 'pointer', opacity: excluded ? 0.45 : 1 }}
                  onMouseEnter={e => e.currentTarget.style.background = '#fef9f0'}
                  onMouseLeave={e => e.currentTarget.style.background = baseBg}
                >
                  <td style={{ padding: '9px 0 9px 10px' }}>
                    <EyeToggle excluded={excluded} onClick={() => onToggleExclude(p)} />
                  </td>
                  <td style={{ padding: '9px 14px', fontSize: 13, fontWeight: 600 }}>
                    {(() => { const { street, rest } = splitAddress(p.address); return (
                      <>
                        <div>{street}</div>
                        {rest && <div style={{ fontSize: 11, fontWeight: 400, color: '#9ca3af', marginTop: 1 }}>{rest}</div>}
                      </>
                    )})()}
                    {p.unit_count > 1 && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{p.unit_count} units</div>}
                  </td>
                  <td style={{ padding: '9px 14px', fontSize: 12, fontFamily: 'monospace', color: '#3B6D11', fontWeight: 600 }}>{cashOffer ? fmt(cashOffer) : '—'}</td>
                  <td style={{ padding: '9px 14px', fontSize: 12, fontFamily: 'monospace', color: '#6b7280' }}>{fmt(p.rehab_cost)||'—'}</td>
                  <td style={{ padding: '9px 14px', fontSize: 12, fontFamily: 'monospace', fontWeight: 700 }}>{fmt(p.arv)||'—'}</td>
                  <td style={{ padding: '9px 14px' }} onClick={e => e.stopPropagation()}>
                    {(!p.stage || p.stage === 'Analyzing') ? (
                      <button
                        onClick={() => onPromote(p, PROMO_PAYLOADS['Renovation'])}
                        style={{ background: 'none', border: '1px solid #3B6D1155', color: '#3B6D11', borderRadius: 5, padding: '3px 7px', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                      >Mark Purchased</button>
                    ) : (
                      (() => { const c = STAGE_COLORS[p.stage] || '#9ca3af'; return (
                        <span style={{ background: c + '20', color: c, border: `1px solid ${c}40`, borderRadius: 4, padding: '2px 7px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                          {p.stage}
                        </span>
                      )})()
                    )}
                  </td>
                  <td style={{ padding: '9px 14px', fontSize: 12, fontFamily: 'monospace', color: '#3B6D11', fontWeight: 600 }}>{rent?.current ? fmt(rent.current) : '—'}</td>
                  <td style={{ padding: '9px 14px', fontSize: 12, fontFamily: 'monospace', color: '#6b7280' }}>{rent?.market ? fmt(rent.market) : '—'}</td>
                </tr>
              )
            })}
            <tr style={{ background: '#FAFAF8', borderTop: '1px solid #E5E0D5' }}>
              <td></td>
              <td style={{ padding: '7px 14px', fontSize: 10.5, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {group.label} Subtotal{groupTotal.count < group.rows.length ? ` (${groupTotal.count} of ${group.rows.length} included)` : ''}
              </td>
              <td style={{ padding: '7px 14px', fontSize: 12, fontFamily: 'monospace', color: '#3B6D11', fontWeight: 700 }}>{groupTotal.cashOffer ? fmt(groupTotal.cashOffer) : '—'}</td>
              <td style={{ padding: '7px 14px', fontSize: 12, fontFamily: 'monospace', color: '#6b7280', fontWeight: 600 }}>{groupTotal.rehab ? fmt(groupTotal.rehab) : '—'}</td>
              <td style={{ padding: '7px 14px', fontSize: 12, fontFamily: 'monospace', fontWeight: 700 }}>{groupTotal.arv ? fmt(groupTotal.arv) : '—'}</td>
              <td></td>
              <td style={{ padding: '7px 14px', fontSize: 12, fontFamily: 'monospace', color: '#3B6D11', fontWeight: 700 }}>{groupTotal.rentCurrent ? fmt(groupTotal.rentCurrent) : '—'}</td>
              <td style={{ padding: '7px 14px', fontSize: 12, fontFamily: 'monospace', color: '#6b7280', fontWeight: 600 }}>{groupTotal.marketRent ? fmt(groupTotal.marketRent) : '—'}</td>
            </tr>
          </Fragment>
        )})}
        {sorted.length === 0 && (
          <tr><td colSpan={8} style={{ padding: '24px 14px', textAlign:'center', color:'#bbb', fontSize:12 }}>No properties in this package yet.</td></tr>
        )}
        {sorted.length > 0 && (
          <tr style={{ background: '#2C2C2C', borderTop: '2px solid #B8892A' }}>
            <td></td>
            <td style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.6 }}>
              Portfolio Total{grandTotal.count < sorted.length ? ` (${grandTotal.count} of ${sorted.length} included)` : ''}
            </td>
            <td style={{ padding: '10px 14px', fontSize: 13, fontFamily: 'monospace', color: '#7CC576', fontWeight: 700 }}>{grandTotal.cashOffer ? fmt(grandTotal.cashOffer) : '—'}</td>
            <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'monospace', color: '#d1d1d1', fontWeight: 600 }}>{grandTotal.rehab ? fmt(grandTotal.rehab) : '—'}</td>
            <td style={{ padding: '10px 14px', fontSize: 13, fontFamily: 'monospace', color: '#fff', fontWeight: 700 }}>{grandTotal.arv ? fmt(grandTotal.arv) : '—'}</td>
            <td></td>
            <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'monospace', color: '#7CC576', fontWeight: 700 }}>{grandTotal.rentCurrent ? fmt(grandTotal.rentCurrent) : '—'}</td>
            <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'monospace', color: '#d1d1d1', fontWeight: 600 }}>{grandTotal.marketRent ? fmt(grandTotal.marketRent) : '—'}</td>
          </tr>
        )}
      </tbody>
    </table>
  )
}

const GMAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY

// Read-only Follow Up Boss preview — pulls contact info on demand from our
// serverless /api/fub-contact endpoint (server holds the real FUB API key).
// Pulls the person id out of a stored FUB link like ".../people/view/4105".
function FubPreviewPanel({ fubLink }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [open, setOpen] = useState(false)

  const personId = (fubLink || '').match(/(\d+)\/?$/)?.[1] || null

  async function load() {
    setOpen(true)
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/fub-contact?id=${personId}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Lookup failed')
      setData(json)
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (personId) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId])

  if (!personId) return null

  const initials = (data?.person?.name || '')
    .split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()

  return (
    <div style={{ width: 260, flexShrink: 0 }}>
      {!open ? (
        <button onClick={load} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'none', border: '1px dashed #D6D2CA', borderRadius: 8, padding: '9px 12px', fontSize: 12, fontWeight: 600, color: '#888', cursor: 'pointer', fontFamily: 'inherit' }}>
          ↓ Pull Contact Info from FUB
        </button>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #E8E5DE', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ background: '#B8892A', height: 3 }} />
          <div style={{ padding: '10px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#B8892A', textTransform: 'uppercase', letterSpacing: 0.6 }}>Follow Up Boss</span>
              <button onClick={load} disabled={loading} title="Refresh" style={{ background: 'none', border: 'none', cursor: loading ? 'default' : 'pointer', color: '#9ca3af', fontSize: 13 }}>{loading ? '…' : '↻'}</button>
            </div>
            {loading && <div style={{ fontSize: 12, color: '#9ca3af' }}>Loading…</div>}
            {error && <div style={{ fontSize: 11.5, color: '#B22020', fontWeight: 600 }}>⚠ {error}</div>}
            {data?.person && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#F7F5F0', border: '1px solid #E8E5DE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#B8892A', flexShrink: 0 }}>
                    {initials || '?'}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#2C2C2C', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {data.person.name || 'No name on file'}
                    </div>
                    {data.person.phone && <div style={{ fontSize: 10.5, color: '#888' }}>{data.person.phone}</div>}
                    {data.person.email && <div style={{ fontSize: 10.5, color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{data.person.email}</div>}
                  </div>
                </div>
                {(data.person.stage || data.person.source) && (
                  <div style={{ fontSize: 10.5, color: '#666', lineHeight: 1.6, marginBottom: data.activity?.length ? 8 : 0 }}>
                    {data.person.stage && <div>Stage: <span style={{ fontWeight: 600, color: '#2C2C2C' }}>{data.person.stage}</span></div>}
                    {data.person.source && <div>Source: <span style={{ fontWeight: 600, color: '#2C2C2C' }}>{data.person.source}</span></div>}
                  </div>
                )}
              </>
            )}
            {data?.activity?.length > 0 && (() => {
              const last = data.activity[0]
              return (
                <div style={{ borderTop: '0.5px solid #F0EDE6', paddingTop: 6 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3 }}>Last Contact</div>
                  <div style={{ fontSize: 10.5, color: '#666' }}>
                    <span style={{ color: '#999' }}>
                      {new Date(last.date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </span>
                    {last.text && <span> — {String(last.text).slice(0, 70)}</span>}
                  </div>
                </div>
              )
            })()}
            {data && !data.person && !error && <div style={{ fontSize: 12, color: '#9ca3af' }}>No contact info found for this link.</div>}
            {(data?.person || data?.activity?.length > 0) && (
              <div style={{ marginTop: 8 }}>
                <button
                  onClick={() => window.open(fubLink, 'nhc_fub', 'width=1400,height=950,noopener,noreferrer')}
                  style={{ width: '100%', background: '#E0A526', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 0', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                >↗ Open in FUB</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const CITY_COLORS = {
  'Lancaster':     '#E63946',
  'Nicholasville': '#2D6FAF',
  'Crab Orchard':  '#3B6D11',
  'Harrodsburg':   '#6b21a8',
  'Danville':      '#D97825',
  'Bargain':       '#0891b2',
  'Brodhead':      '#0891b2',
  'Stanford':      '#be185d',
}

function cityFromAddress(address) {
  if (!address) return 'Unknown'
  const lower = address.toLowerCase()
  if (lower.includes('lancaster'))     return 'Lancaster'
  if (lower.includes('nicholasville')) return 'Nicholasville'
  if (lower.includes('crab orchard'))  return 'Crab Orchard'
  if (lower.includes('harrodsburg'))   return 'Harrodsburg'
  if (lower.includes('danville'))      return 'Danville'
  if (lower.includes('bargain'))       return 'Bargain'
  if (lower.includes('brodhead'))      return 'Brodhead'
  if (lower.includes('stanford') || lower.includes('standford')) return 'Stanford'
  return 'Unknown'
}

function cityColor(city) {
  return CITY_COLORS[city] || '#9ca3af'
}

function pinSvg(color, isMulti) {
  if (isMulti) {
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="34" height="42" viewBox="0 0 34 42">
        <filter id="s"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.35)"/></filter>
        <path d="M17 2 C9 2 3 8 3 16 C3 26 17 40 17 40 C17 40 31 26 31 16 C31 8 25 2 17 2Z"
              fill="${color}" stroke="#fff" stroke-width="2.5" filter="url(#s)"/>
        <path d="M17 9 L19.5 14.5 L25.5 15.3 L21 19.5 L22.3 25.5 L17 22.5 L11.7 25.5 L13 19.5 L8.5 15.3 L14.5 14.5Z"
              fill="#fff" opacity="0.95"/>
      </svg>
    `)}`
  }
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="26" height="36" viewBox="0 0 26 36">
      <filter id="s"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.3)"/></filter>
      <path d="M13 2 C6.4 2 1 7.4 1 14 C1 22.5 13 34 13 34 C13 34 25 22.5 25 14 C25 7.4 19.6 2 13 2Z"
            fill="${color}" stroke="#fff" stroke-width="2" filter="url(#s)"/>
      <circle cx="13" cy="14" r="5" fill="#fff" opacity="0.9"/>
    </svg>
  `)}`
}

// Street View Static API image URL — returns a placeholder if no coverage.
// fov narrows the frame a bit (tighter on the subject); heading, when known,
// points the camera at the actual building instead of Google's road-facing default.
function streetViewUrl(address, heading) {
  const params = new URLSearchParams({ size: '600x180', location: address, key: GMAPS_API_KEY, return_error_code: 'true', fov: '80' })
  if (heading != null) params.set('heading', heading)
  return `https://maps.googleapis.com/maps/api/streetview?${params.toString()}`
}

// Street View's default framing points the camera down the road, not at the
// building — this fetches the panorama's own location and computes the
// bearing from there to the building's geocoded point, so the image actually
// centers on the house instead of whatever happens to be roadside.
async function streetViewHeadingTo(targetLatLng) {
  try {
    const url = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${targetLatLng.lat()},${targetLatLng.lng()}&key=${GMAPS_API_KEY}`
    const res = await fetch(url)
    const data = await res.json()
    if (data.status !== 'OK' || !data.location) return null
    const toRad = d => d * Math.PI / 180
    const panoLat = toRad(data.location.lat), panoLng = toRad(data.location.lng)
    const destLat = toRad(targetLatLng.lat()), destLng = toRad(targetLatLng.lng())
    const dLng = destLng - panoLng
    const y = Math.sin(dLng) * Math.cos(destLat)
    const x = Math.cos(panoLat) * Math.sin(destLat) - Math.sin(panoLat) * Math.cos(destLat) * Math.cos(dLng)
    return Math.round(((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360)
  } catch {
    return null
  }
}

let mapsLoading = null
function loadGoogleMaps() {
  if (window.google?.maps) return Promise.resolve()
  if (mapsLoading) return mapsLoading
  mapsLoading = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GMAPS_API_KEY}&libraries=places`
    script.async = true
    script.onload = resolve
    script.onerror = reject
    document.head.appendChild(script)
  })
  return mapsLoading
}

// Persistent left sidebar inside the package overlay — shows portfolio-wide
// totals by default, and switches to the selected property's own quick
// summary when a row is opened (mirrors PropertyFullView's meta rail, just
// on the opposite side and always present).
function PortfolioSummaryFooter({ properties, rentByProperty }) {
  const included = (properties||[]).filter(p => !p.excluded_from_offer)
  const totals = included.reduce((acc, p) => ({
    cashOffer: acc.cashOffer + (calcCashOffer(p) || 0),
    arv: acc.arv + (parseFloat(p.arv) || 0),
    rentCurrent: acc.rentCurrent + (rentByProperty?.[p.id]?.current || 0),
    marketRent: acc.marketRent + (rentByProperty?.[p.id]?.market || 0),
  }), { cashOffer: 0, arv: 0, rentCurrent: 0, marketRent: 0 })

  const label = { fontSize: 9.5, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700, marginBottom: 2 }
  const Stat = ({ children: valueEl, title, color }) => (
    <div style={{ flexShrink: 0 }}>
      <div style={label}>{title}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: color || '#2C2C2C', fontFamily: 'monospace' }}>{valueEl}</div>
    </div>
  )

  return (
    <div style={{
      flexShrink: 0, borderTop: '2px solid #B8892A', background: '#fff',
      padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 26,
      overflowX: 'auto', whiteSpace: 'nowrap',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#B8892A', textTransform: 'uppercase', letterSpacing: 0.6, flexShrink: 0 }}>Portfolio Summary</div>
      <Stat title="Properties Included">{included.length} <span style={{ fontSize: 11, fontWeight: 500, color: '#9ca3af', fontFamily: 'inherit' }}>of {properties.length}</span></Stat>
      <Stat title="Total Cash Offer" color="#3B6D11">{totals.cashOffer ? fmt(totals.cashOffer) : '—'}</Stat>
      <Stat title="Combined ARV">{totals.arv ? fmt(totals.arv) : '—'}</Stat>
      <Stat title="Total Rent Current" color="#3B6D11">{totals.rentCurrent ? fmt(totals.rentCurrent) : '—'}</Stat>
      <Stat title="Total Market Rent" color="#6b7280">{totals.marketRent ? fmt(totals.marketRent) : '—'}</Stat>
      <div style={{ fontSize: 10, color: '#9ca3af', marginLeft: 'auto', flexShrink: 0 }}>Excluded properties aren't counted above.</div>
    </div>
  )
}

export default function PropertyMapModal({
  properties: initialProperties, packageName, fubLink, pkg, onClose, onSaveProperty, onAddProperty, isAgentRole, currentUserEmail, defaultView='list' }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef([])
  const infoWindowRef = useRef(null)
  const infoWindowClickTokenRef = useRef(0)
  const geocacheRef = useRef({})
  const mapInitedRef = useRef(false)

  const [view, setView] = useState(defaultView) // 'list' | 'map'
  const [mapEverOpened, setMapEverOpened] = useState(defaultView === 'map')
  useEffect(() => { if (view === 'map') setMapEverOpened(true) }, [view])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  // Live property list — updated after saves so re-opened pins show fresh data
  const [properties, setProperties] = useState(initialProperties)
  // Property currently open in the side drawer (null = drawer closed)
  const [drawerProp, setDrawerProp] = useState(null)
  const [proposal, setProposal] = useState(null)
  const [portfolioProposalOpen, setPortfolioProposalOpen] = useState(false)
  // Aggregated per-property rent figures for the list table: { [property_id]: { current, market } }
  const [rentByProperty, setRentByProperty] = useState({})
  // Add-property panel — rendered inline (same overlay), same pattern as the package metadata panel
  const [addingProperty, setAddingProperty] = useState(false)
  const [newAddress, setNewAddress] = useState('')
  const [addSaving, setAddSaving] = useState(false)

  // Toggle a property's inclusion in the portfolio-wide cash offer total/PDF.
  // Optimistic local update so the row greys out immediately; persists in the background.
  async function toggleExclude(p) {
    const nextVal = !p.excluded_from_offer
    setProperties(prev => prev.map(x => x.id === p.id ? { ...x, excluded_from_offer: nextVal } : x))
    const { error } = await supabase.from('cashoffer_properties').update({ excluded_from_offer: nextVal }).eq('id', p.id)
    if (error) {
      // Revert on failure
      setProperties(prev => prev.map(x => x.id === p.id ? { ...x, excluded_from_offer: !nextVal } : x))
      alert(`Couldn't update this property.\n\n${error.message}`)
    }
  }

  // Promote a property's stage/type from the package list (e.g. Mark Purchased) — Rehab is the
  // automatic next phase once Purchased, so it already shows up on the Rehabs page, no extra step needed
  async function promoteProperty(p, payload) {
    const prevValues = { type: p.type, stage: p.stage, disposition: p.disposition }
    setProperties(prev => prev.map(x => x.id === p.id ? { ...x, ...payload } : x))
    const { error } = await supabase.from('cashoffer_properties').update(payload).eq('id', p.id)
    if (error) {
      setProperties(prev => prev.map(x => x.id === p.id ? { ...x, ...prevValues } : x))
      alert(`Couldn't update this property.\n\n${error.message}`)
      return
    }
    onSaveProperty && onSaveProperty()
  }

  function openAddProperty() {
    setNewAddress('')
    setAddingProperty(true)
  }

  async function saveNewProperty() {
    if (!newAddress) return
    setAddSaving(true)
    await onAddProperty(newAddress)
    setAddSaving(false)
    setAddingProperty(false)
    setNewAddress('')
  }

  // Refresh property data from DB after a save (keeps drawer open)
  const handleSave = useCallback(async () => {
    if (!drawerProp) return
    const { data } = await supabase
      .from('cashoffer_properties')
      .select('*')
      .eq('id', drawerProp.id)
      .single()
    if (data) {
      setProperties(prev => prev.map(p => p.id === data.id ? data : p))
      setDrawerProp(data)
    }
    onSaveProperty && onSaveProperty()
  }, [drawerProp, onSaveProperty])

  // Refresh data then close drawer — used as onClose in PropertyDrawer
  // so save-on-close works correctly without the drawer re-opening
  const handleDrawerClose = useCallback(async () => {
    if (drawerProp) {
      const { data } = await supabase
        .from('cashoffer_properties')
        .select('*')
        .eq('id', drawerProp.id)
        .single()
      if (data) {
        setProperties(prev => prev.map(p => p.id === data.id ? data : p))
      }
      onSaveProperty && onSaveProperty()
    }
    setDrawerProp(null)
  }, [drawerProp, onSaveProperty])

  // Fetch + aggregate rent totals (active lease rent, and unit market rent) per property.
  // Keyed on the actual set of ids so it doesn't refire on every unrelated property refresh.
  const propIdsKey = properties.map(p => p.id).sort().join(',')
  useEffect(() => {
    const ids = properties.map(p => p.id)
    if (ids.length === 0) { setRentByProperty({}); return }
    let cancelled = false
    async function loadRent() {
      const [{ data: leases }, { data: units }] = await Promise.all([
        supabase.from('cashoffer_leases').select('property_id, rent_amount, status').in('property_id', ids),
        supabase.from('cashoffer_units').select('property_id, market_rent').in('property_id', ids),
      ])
      if (cancelled) return
      const byProp = {}
      for (const id of ids) byProp[id] = { current: 0, market: 0 }
      for (const l of (leases || [])) {
        if (l.status === 'Active' || l.status === 'Month-to-Month') {
          if (!byProp[l.property_id]) byProp[l.property_id] = { current: 0, market: 0 }
          byProp[l.property_id].current += parseFloat(l.rent_amount) || 0
        }
      }
      for (const u of (units || [])) {
        if (!byProp[u.property_id]) byProp[u.property_id] = { current: 0, market: 0 }
        byProp[u.property_id].market += parseFloat(u.market_rent) || 0
      }
      // Fallback to the property-level market_rent/current_rent fields — this is the
      // only source for single-unit properties (no cashoffer_units rows), and a safety
      // net for any property without an active lease or unit rows yet.
      for (const p of properties) {
        const entry = byProp[p.id] || { current: 0, market: 0 }
        if (!entry.market) entry.market = parseFloat(p.market_rent) || 0
        if (!entry.current) entry.current = parseFloat(p.current_rent) || 0
        byProp[p.id] = entry
      }
      setRentByProperty(byProp)
    }
    loadRent()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propIdsKey])


  // Re-run whenever the live properties list changes so drawer gets fresh data
  useEffect(() => {
    window.__nhcOpenProp = (id) => {
      infoWindowRef.current?.close()
      const prop = properties.find(p => p.id === id)
      if (prop) setDrawerProp(prop)
    }
    return () => { delete window.__nhcOpenProp }
  }, [properties])

  useEffect(() => {
    if (!mapEverOpened || mapInitedRef.current) return
    mapInitedRef.current = true
    let cancelled = false

    async function init() {
      try {
        setLoading(true)
        await loadGoogleMaps()
        if (cancelled) return

        const google = window.google
        const map = new google.maps.Map(mapRef.current, {
          center: { lat: 37.65, lng: -84.58 },
          zoom: 10,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          styles: [{ featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }],
        })
        mapInstanceRef.current = map

        const infoWindow = new google.maps.InfoWindow({ maxWidth: 320 })
        // Google's InfoWindow wraps content in a scrollable div that often shows a
        // sliver of unnecessary scrollbar even when content fits — this is a well-known
        // quirk, fixed by forcing that inner wrapper to not scroll.
        if (!document.getElementById('nhc-gm-iw-fix')) {
          const style = document.createElement('style')
          style.id = 'nhc-gm-iw-fix'
          style.textContent = `.gm-style-iw-d { overflow: hidden !important; } .gm-style-iw-c { padding-bottom: 12px !important; }`
          document.head.appendChild(style)
        }
        infoWindowRef.current = infoWindow

        setLoading(false)

        const geocoder = new google.maps.Geocoder()
        const bounds = new google.maps.LatLngBounds()
        let placed = 0

        for (const prop of properties) {
          if (cancelled) return
          const city = cityFromAddress(prop.address)
          const color = cityColor(city)
          const isMulti = (prop.unit_count || 1) > 1

          let latlng = geocacheRef.current[prop.id]
          if (!latlng) {
            try {
              latlng = await new Promise((resolve, reject) => {
                geocoder.geocode({ address: prop.address }, (results, status) => {
                  if (status === 'OK' && results[0]) resolve(results[0].geometry.location)
                  else reject(new Error(status))
                })
              })
              geocacheRef.current[prop.id] = latlng
            } catch { continue }
          }

          if (cancelled) return
          bounds.extend(latlng)
          placed++

          const marker = new google.maps.Marker({
            position: latlng,
            map,
            icon: {
              url: pinSvg(color, isMulti),
              scaledSize: new google.maps.Size(isMulti ? 34 : 26, isMulti ? 42 : 36),
              anchor: new google.maps.Point(isMulti ? 17 : 13, isMulti ? 40 : 34),
            },
            title: prop.address,
            optimized: false,
          })
          marker._propId = prop.id
          markersRef.current.push(marker)

          marker.addListener('click', async () => {
            const { street, rest } = splitAddress(prop.address)
            const svLiveUrlBase = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${latlng.lat()},${latlng.lng()}`

            function buildContent(heading) {
              const svStaticUrl = streetViewUrl(prop.address, heading)
              const svLiveUrl = heading != null ? `${svLiveUrlBase}&heading=${heading}` : svLiveUrlBase
              return `
                <div style="font-family:Helvetica Neue,sans-serif;width:300px;">
                  <div style="position:relative;width:100%;height:160px;background:#f0ede6;border-radius:6px;overflow:hidden;margin-bottom:10px;">
                    <img
                      src="${svStaticUrl}"
                      alt="Street View"
                      style="width:100%;height:100%;object-fit:cover;display:block;"
                      onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"
                    />
                    <div style="display:none;position:absolute;inset:0;align-items:center;justify-content:center;flex-direction:column;gap:4px;color:#9ca3af;font-size:11px;">
                      <span style="font-size:24px;">📷</span>
                      No Street View available
                    </div>
                    <a href="${svLiveUrl}" target="_blank" rel="noopener"
                      style="position:absolute;bottom:6px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.6);color:#fff;border-radius:4px;padding:3px 8px;font-size:10px;font-weight:600;text-decoration:none;white-space:nowrap;">
                      Open Street View ↗
                    </a>
                  </div>
                  <div style="font-size:13px;font-weight:700;color:#2C2C2C;line-height:1.3">${street}</div>
                  <div style="font-size:11px;color:${color};font-weight:600;margin-bottom:${isMulti ? 3 : 8}px">${rest}</div>
                  ${isMulti ? `<div style="font-size:11px;color:#6b7280;margin-bottom:8px">★ Package — ${prop.unit_count} units</div>` : ''}
                  <button onclick="window.__nhcOpenProp('${prop.id}')"
                    style="width:100%;background:#B8892A;color:#fff;border:none;border-radius:5px;padding:7px 0;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">
                    Open Property Details →
                  </button>
                </div>
              `
            }

            const clickToken = ++infoWindowClickTokenRef.current
            infoWindow.setContent(buildContent(null))
            infoWindow.open(map, marker)

            const heading = await streetViewHeadingTo(latlng)
            // Only apply if this is still the most recent click (user hasn't opened another pin since)
            if (heading != null && infoWindowClickTokenRef.current === clickToken) {
              infoWindow.setContent(buildContent(heading))
            }
          })
        }

        if (placed > 0) {
          map.fitBounds(bounds)
          if (placed === 1) map.setZoom(15)
        }
      } catch (e) {
        console.error('Map init error', e)
        setError('Could not load the map. Check your connection and try again.')
        setLoading(false)
      }
    }

    init()
    return () => {
      cancelled = true
      markersRef.current.forEach(m => m.setMap(null))
      markersRef.current = []
    }
  }, [mapEverOpened]) // eslint-disable-line react-hooks/exhaustive-deps

  // Google Maps renders blank if resized while its container was display:none —
  // nudge it back into shape whenever the user switches back to Map view.
  useEffect(() => {
    if (view !== 'map' || !mapInstanceRef.current) return
    const map = mapInstanceRef.current
    setTimeout(() => {
      window.google?.maps.event.trigger(map, 'resize')
      const bounds = new window.google.maps.LatLngBounds()
      let any = false
      markersRef.current.forEach(m => { bounds.extend(m.getPosition()); any = true })
      if (any) map.fitBounds(bounds)
    }, 0)
  }, [view])

  const cities = [...new Set(properties.map(p => cityFromAddress(p.address)).filter(c => c !== 'Unknown'))]

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: '#fff', borderRadius: 12, overflow: 'hidden',
        width: '100%', maxWidth: 1400, height: '92vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 8px 40px rgba(0,0,0,0.3)',
        position: 'relative',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 20px', borderBottom: '1px solid #F0EDE6', flexShrink: 0, gap: 12,
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#2C2C2C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{packageName}</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {properties.length} propert{properties.length===1?'y':'ies'}
              {view==='map' ? ' · click a pin for Street View + details' : ' · click a row to open it'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'nowrap' }}>
            {fubLink && <FubPreviewPanel fubLink={fubLink} />}
            {view==='map' && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 0, maxWidth: 220 }}>
                {cities.map(city => (
                  <div key={city} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 9, height: 9, borderRadius: 2, background: cityColor(city), flexShrink: 0 }} />
                    <span style={{ fontSize: 10, color: '#6b7280' }}>{city}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 11 }}>★</span>
                  <span style={{ fontSize: 10, color: '#6b7280' }}>Multi-unit</span>
                </div>
              </div>
            )}
            {/* List / Map segmented toggle */}
            <div style={{ display: 'flex', border: '1.5px solid #D6D2CA', borderRadius: 7, overflow: 'hidden', flexShrink: 0 }}>
              {['list','map'].map(v => (
                <button key={v} onClick={() => setView(v)} style={{
                  padding: '6px 14px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: 12, fontWeight: 700, textTransform: 'capitalize',
                  background: view===v ? '#B8892A' : '#fff',
                  color: view===v ? '#fff' : '#6b7280',
                }}>{v}</button>
              ))}
            </div>
            {onAddProperty && (
              <button onClick={openAddProperty} style={{ background:'#B8892A', border:'none', borderRadius:6, padding:'6px 12px', fontSize:11.5, fontWeight:700, color:'#fff', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap', flexShrink:0 }}>
                + Property
              </button>
            )}
            <button onClick={() => setPortfolioProposalOpen(true)} style={{ background:'#2C2C2C', border:'none', borderRadius:6, padding:'6px 12px', fontSize:11.5, fontWeight:700, color:'#fff', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap', flexShrink:0 }}>
              Portfolio Offer
            </button>
            <button onClick={onClose} style={{
              background: 'none', border: 'none', fontSize: 20, cursor: 'pointer',
              color: '#9ca3af', lineHeight: 1, padding: 4, flexShrink: 0,
            }}>✕</button>
          </div>
        </div>

        {/* Body + drawer row */}
        <div style={{ flex: 1, position: 'relative', display: 'flex', overflow: 'hidden' }}>
          {/* Loading overlay (map only) */}
          {view==='map' && loading && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexDirection: 'column', gap: 10,
              background: '#FAFAF8', zIndex: 10,
            }}>
              <div style={{ fontSize: 13, color: '#6b7280' }}>Loading map and geocoding addresses…</div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>This may take a moment for large packages</div>
            </div>
          )}
          {view==='map' && error && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: '#B91C1C', fontSize: 13, zIndex: 10,
            }}>{error}</div>
          )}

          {/* List view */}
          {view==='list' && (
            <div style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
              <PackagePropertiesTable pkgProps={properties} onOpenProperty={setDrawerProp} rentByProperty={rentByProperty} onToggleExclude={toggleExclude} onPromote={promoteProperty} />
            </div>
          )}

          {/* Map — kept mounted once opened (hidden via display, not unmounted) so markers survive toggling */}
          <div ref={mapRef} style={{
            flex: 1,
            minWidth: 0,
            display: view==='map' ? 'block' : 'none',
          }} />

          {/* Add-property panel — inline, same overlay (matches the package-edit pattern) */}
          {addingProperty && (
            <div style={{
              width: 420,
              flexShrink: 0,
              borderLeft: '1px solid #F0EDE6',
              background: '#fff',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              animation: 'slideInRight 0.2s ease',
            }}>
              <style>{`
                @keyframes slideInRight {
                  from { transform: translateX(100%); opacity: 0; }
                  to   { transform: translateX(0);    opacity: 1; }
                }
              `}</style>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', borderBottom: '1px solid #F0EDE6',
                background: '#FAFAF8', flexShrink: 0, position: 'sticky', top: 0, zIndex: 5,
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#2C2C2C' }}>Add Property to Package</div>
                <button
                  onClick={() => setAddingProperty(false)}
                  style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#9ca3af', padding: 4 }}
                >✕</button>
              </div>
              <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Address</label>
                  <AddressInput value={newAddress} onChange={v => setNewAddress(v)} />
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button onClick={() => setAddingProperty(false)} style={{ flex: 1, background: 'none', border: '1px solid #D6D2CA', borderRadius: 6, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: '#6b7280' }}>
                    Cancel
                  </button>
                  <button onClick={saveNewProperty} disabled={addSaving || !newAddress} style={{ flex: 1, background: '#B8892A', border: 'none', borderRadius: 6, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: addSaving ? 'default' : 'pointer', fontFamily: 'inherit', color: '#fff', opacity: (addSaving || !newAddress) ? 0.6 : 1 }}>
                    {addSaving ? 'Adding…' : 'Add Property'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Property drawer panel — slides in from the right, overlays the map or list */}
          {drawerProp && (
            <div style={{
              width: 480,
              flexShrink: 0,
              borderLeft: '1px solid #F0EDE6',
              background: '#fff',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              animation: 'slideInRight 0.2s ease',
            }}>
              <style>{`
                @keyframes slideInRight {
                  from { transform: translateX(100%); opacity: 0; }
                  to   { transform: translateX(0);    opacity: 1; }
                }
              `}</style>
              {/* Drawer header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', borderBottom: '1px solid #F0EDE6',
                background: '#FAFAF8', flexShrink: 0, position: 'sticky', top: 0, zIndex: 5,
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#2C2C2C', lineHeight: 1.3 }}>
                    {drawerProp.address}
                  </div>
                  <div style={{ fontSize: 11, color: cityColor(cityFromAddress(drawerProp.address)), marginTop: 2, fontWeight: 600 }}>
                    {cityFromAddress(drawerProp.address)}
                    {(drawerProp.unit_count || 1) > 1 && ` · ★ ${drawerProp.unit_count} units`}
                  </div>
                </div>
                <button
                  onClick={handleDrawerClose}
                  style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#9ca3af', padding: 4 }}
                >✕</button>
              </div>

              {/* Inline PropertyDrawer content — rendered inside our panel */}
              <div style={{ flex: 1 }}>
                <PropertyDrawer
                  property={drawerProp}
                  open={true}
                  onClose={handleDrawerClose}
                  onSave={handleSave}
                  mailings={[]}
                  onViewOffer={p => setProposal(p)}
                  inlineMode={true}
                  isAgentRole={isAgentRole}
                  currentUserEmail={currentUserEmail}
                />
              </div>
            </div>
          )}
          {proposal && <ProposalModal property={proposal} onClose={() => setProposal(null)} />}
          {portfolioProposalOpen && (
            <PortfolioProposalModal
              packageName={packageName}
              properties={properties}
              onClose={() => setPortfolioProposalOpen(false)}
            />
          )}
        </div>

        {/* Portfolio summary footer — always visible across the bottom, regardless of list/map view or drawer state */}
        <PortfolioSummaryFooter properties={properties} rentByProperty={rentByProperty} />
      </div>
    </div>
  )
}


