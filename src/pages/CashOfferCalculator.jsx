import { useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt(n) {
  if (isNaN(n)) return '$0'
  return '$' + Math.round(n).toLocaleString('en-US')
}

function fmtNeg(n) {
  if (isNaN(n) || n === 0) return '$0'
  return '−$' + Math.round(Math.abs(n)).toLocaleString('en-US')
}

const DEFAULT_REPAIRS = [
  { name: 'Flooring', cost: '' },
  { name: 'Painting', cost: '' },
  { name: 'Demo / Cleanup', cost: '' },
  { name: 'Drywall Work', cost: '' },
  { name: 'Misc Fixtures', cost: '' },
  { name: 'Appliances', cost: '' },
  { name: 'Plumbing', cost: '' },
  { name: 'Electrical', cost: '' },
  { name: 'Landscaping', cost: '' },
]

const DEFAULT_ASSUMPTIONS = {
  commCash: 9, commList: 6,
  holdCashPct: 0.75, holdCashMonths: 6,
  holdOpt2Pct: 0.5, holdOpt2Months: 3,
  holdOpt3Pct: 0.5, holdOpt3Months: 6,
}

// ─── Calculator logic ─────────────────────────────────────────────────────────
function calcOffers(fields, repairs, assumptions) {
  const arv = parseFloat(fields.arv) || 0
  const asisOverrideActive = fields.asisOverride && parseFloat(fields.asisOverride) > 0
  const renoDiscountPct = (parseFloat(fields.asisPct) || 50) / 100
  const profitOverrideActive = fields.profitOverride && parseFloat(fields.profitOverride) > 0
  const cashOfferOverrideActive = fields.cashOfferOverride && parseFloat(fields.cashOfferOverride) > 0
  const commCashPct = assumptions.commCash / 100
  const commListPct = assumptions.commList / 100
  const profitPct = (parseFloat(fields.profitMargin) || 15) / 100

  const reno = repairs.reduce((s, r) => s + (parseFloat(r.cost) || 0), 0)
  const renoDiscount = renoDiscountPct * reno
  const asisValue = asisOverrideActive ? parseFloat(fields.asisOverride) : (arv - renoDiscount)
  const profit = profitOverrideActive ? parseFloat(fields.profitOverride) : arv * profitPct
  const cashHolding = (assumptions.holdCashPct / 100) * assumptions.holdCashMonths * arv
  const cashOfferCalc = arv - reno - (commCashPct * arv) - cashHolding - profit
  const cashOffer = cashOfferOverrideActive ? parseFloat(fields.cashOfferOverride) : cashOfferCalc

  const opt2Comm = commListPct * asisValue
  const opt2Holding = (assumptions.holdOpt2Pct / 100) * assumptions.holdOpt2Months * arv
  const opt2Net = asisValue - opt2Comm - opt2Holding

  const opt3Comm = commListPct * arv
  const opt3Holding = (assumptions.holdOpt3Pct / 100) * assumptions.holdOpt3Months * arv
  const opt3Net = arv - reno - opt3Comm - opt3Holding

  return { arv, asisValue, reno, renoDiscount, renoDiscountPct, commCashPct, commListPct, profit, profitPct, cashOffer, cashHolding, opt2Comm, opt2Holding, opt2Net, opt3Comm, opt3Holding, opt3Net, assumptions, profitOverrideActive, cashOfferOverrideActive, asisOverrideActive }
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function CashOfferCalculator() {
  const [fields, setFields] = useState({ address: '', beds: '', baths: '', sqft: '', arv: '', asisPct: '50', asisOverride: '', profitMargin: '15', profitOverride: '', cashOfferOverride: '' })
  const [repairs, setRepairs] = useState(DEFAULT_REPAIRS.map((r, i) => ({ ...r, id: i })))
  const [assumptions, setAssumptions] = useState(DEFAULT_ASSUMPTIONS)
  const [showAssumptions, setShowAssumptions] = useState(false)
  const [showCsvModal, setShowCsvModal] = useState(false)
  const [csvText, setCsvText] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showProposal, setShowProposal] = useState(false)
  const proposalRef = useRef(null)

  const d = calcOffers(fields, repairs, assumptions)
  const repairTotal = d.reno

  const setField = k => e => setFields(f => ({ ...f, [k]: e.target.value }))
  const setAssume = k => e => setAssumptions(a => ({ ...a, [k]: parseFloat(e.target.value) || 0 }))

  function addRepair() { setRepairs(rs => [...rs, { id: Date.now(), name: '', cost: '' }]) }
  function removeRepair(id) { setRepairs(rs => rs.filter(r => r.id !== id)) }
  function updateRepair(id, key, val) { setRepairs(rs => rs.map(r => r.id === id ? { ...r, [key]: val } : r)) }

  function importCsv(append) {
    const lines = csvText.trim().split(/\r?\n/).filter(l => l.trim())
    const parsed = lines.map(line => {
      const parts = line.split(/[,\t]/)
      const name = (parts[0] || '').trim()
      const cost = (parts[1] || '').trim().replace(/[$,]/g, '')
      return { id: Date.now() + Math.random(), name, cost }
    }).filter(r => r.name)
    setRepairs(append ? [...repairs, ...parsed] : parsed)
    setShowCsvModal(false)
    setCsvText('')
  }

  async function saveToSupabase() {
    if (!fields.arv) return
    setSaving(true)
    const payload = {
      address: fields.address || 'No address',
      beds: fields.beds || null, baths: fields.baths || null, sqft: fields.sqft || null,
      arv: fields.arv || null, asis_pct: fields.asisPct || null,
      asis_override: fields.asisOverride || null,
      profit_margin: fields.profitMargin || null,
      profit_margin_override: fields.profitOverride || null,
      cash_offer_override: fields.cashOfferOverride || null,
      commission_cash_pct: assumptions.commCash?.toString() || null,
      commission_list_pct: assumptions.commList?.toString() || null,
      holding_cash_pct: assumptions.holdCashPct?.toString() || null,
      holding_cash_months: assumptions.holdCashMonths?.toString() || null,
      holding_opt2_pct: assumptions.holdOpt2Pct?.toString() || null,
      holding_opt2_months: assumptions.holdOpt2Months?.toString() || null,
      holding_opt3_pct: assumptions.holdOpt3Pct?.toString() || null,
      holding_opt3_months: assumptions.holdOpt3Months?.toString() || null,
      repair_items: repairs.filter(r => r.name || r.cost).map(r => ({ name: r.name, cost: parseFloat(r.cost) || 0 })),
    }
    await supabase.from('cash_offers').upsert(payload)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  // ── Styles
  const S = {
    wrap: { display: 'flex', minHeight: 'calc(100vh - 56px)', fontFamily: "'DM Sans', sans-serif" },
    sidebar: { width: 380, flexShrink: 0, background: '#fff', borderRight: '1px solid #D6D2CA', padding: '24px 20px', overflowY: 'auto' },
    main: { flex: 1, padding: '24px 28px', overflowY: 'auto', background: '#f4f5f7' },
    sectionLabel: { fontSize: 11, fontWeight: 700, letterSpacing: 2.5, color: '#B8892A', textTransform: 'uppercase', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 },
    labelAfter: { flex: 1, height: 1, background: '#D6D2CA' },
    field: { marginBottom: 14 },
    label: { display: 'block', fontSize: 11, fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5 },
    input: { width: '100%', background: '#f9fafb', border: '1px solid #D6D2CA', borderRadius: 6, padding: '9px 12px', color: '#1a1e2e', fontFamily: "'DM Mono', monospace", fontSize: 13, outline: 'none' },
    fieldRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
    divider: { height: 1, background: '#D6D2CA', margin: '18px 0' },
    optCard: { background: '#fff', borderRadius: 10, padding: 18, border: '1px solid #D6D2CA', position: 'relative', overflow: 'hidden', flex: 1 },
    optLine: { display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: '1px solid #f0f0f0' },
    optNet: { marginTop: 12, paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' },
  }

  return (
    <div style={S.wrap}>
      {/* ── SIDEBAR ── */}
      <div style={S.sidebar}>
        {/* Property Info */}
        <div style={S.sectionLabel}>Property Info <span style={S.labelAfter} /></div>
        <div style={S.field}>
          <label style={S.label}>Property Address</label>
          <input style={{ ...S.input, borderLeft: '3px solid #B8892A' }} value={fields.address} onChange={setField('address')} placeholder="123 Main St, Lexington, KY" />
        </div>
        <div style={S.fieldRow}>
          <div style={S.field}><label style={S.label}>Beds</label><input style={{ ...S.input, borderLeft: '3px solid #B8892A' }} type="number" value={fields.beds} onChange={setField('beds')} placeholder="3" /></div>
          <div style={S.field}><label style={S.label}>Baths</label><input style={{ ...S.input, borderLeft: '3px solid #B8892A' }} type="number" value={fields.baths} onChange={setField('baths')} placeholder="2" /></div>
        </div>
        <div style={S.field}><label style={S.label}>Sq Ft</label><input style={{ ...S.input, borderLeft: '3px solid #B8892A' }} type="number" value={fields.sqft} onChange={setField('sqft')} placeholder="1850" /></div>

        <div style={S.divider} />

        {/* Valuation */}
        <div style={S.sectionLabel}>Valuation <span style={S.labelAfter} /></div>
        <div style={S.field}><label style={S.label}>After Renovation Value ($)</label><input style={{ ...S.input, borderLeft: '3px solid #D97825' }} type="number" value={fields.arv} onChange={setField('arv')} placeholder="385000" /></div>
        <div style={S.fieldRow}>
          <div style={S.field}><label style={S.label}>As-Is Deduction %</label><input style={{ ...S.input, borderLeft: '3px solid #2D6FAF' }} type="number" value={fields.asisPct} onChange={setField('asisPct')} /></div>
          <div style={S.field}><label style={S.label}>As-Is Override ($)</label><input style={{ ...S.input, borderLeft: '3px solid #2D6FAF' }} type="number" value={fields.asisOverride} onChange={setField('asisOverride')} placeholder="Auto" /></div>
        </div>
        <div style={S.fieldRow}>
          <div style={S.field}><label style={S.label}>Profit Margin %</label><input style={{ ...S.input, borderLeft: '3px solid #3B6D11' }} type="number" value={fields.profitMargin} onChange={setField('profitMargin')} /></div>
          <div style={S.field}><label style={S.label}>Profit Override ($)</label><input style={{ ...S.input, borderLeft: '3px solid #3B6D11' }} type="number" value={fields.profitOverride} onChange={setField('profitOverride')} placeholder="Auto" /></div>
        </div>
        <div style={S.field}><label style={S.label}>Cash Offer Override ($)</label><input style={{ ...S.input, borderLeft: '3px solid #3B6D11' }} type="number" value={fields.cashOfferOverride} onChange={setField('cashOfferOverride')} placeholder="Auto" /></div>

        <div style={S.divider} />

        {/* Assumptions toggle */}
        <button onClick={() => setShowAssumptions(a => !a)} style={{ width: '100%', background: 'transparent', border: '1px solid #D6D2CA', borderRadius: 6, padding: '10px 14px', color: '#6b7280', fontSize: 12, cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', fontFamily: 'inherit', marginBottom: 4 }}>
          <span>Program Assumptions</span><span>{showAssumptions ? '▲' : '▼'}</span>
        </button>
        {showAssumptions && (
          <div style={{ padding: '12px 0 4px' }}>
            <div style={S.fieldRow}>
              <div style={S.field}><label style={S.label}>Cash Commission %</label><input style={{ ...S.input, borderLeft: '3px solid #2D6FAF' }} type="number" value={assumptions.commCash} onChange={setAssume('commCash')} /></div>
              <div style={S.field}><label style={S.label}>List Commission %</label><input style={{ ...S.input, borderLeft: '3px solid #2D6FAF' }} type="number" value={assumptions.commList} onChange={setAssume('commList')} /></div>
            </div>
            <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginTop: 4 }}>Cash Offer (Option 1)</div>
            <div style={S.fieldRow}>
              <div style={S.field}><label style={S.label}>Monthly Holding %</label><input style={{ ...S.input }} type="number" value={assumptions.holdCashPct} onChange={setAssume('holdCashPct')} /></div>
              <div style={S.field}><label style={S.label}># of Months</label><input style={{ ...S.input }} type="number" value={assumptions.holdCashMonths} onChange={setAssume('holdCashMonths')} /></div>
            </div>
            <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>As-Is Listing (Option 2)</div>
            <div style={S.fieldRow}>
              <div style={S.field}><label style={S.label}>Monthly Holding %</label><input style={{ ...S.input }} type="number" value={assumptions.holdOpt2Pct} onChange={setAssume('holdOpt2Pct')} /></div>
              <div style={S.field}><label style={S.label}># of Months</label><input style={{ ...S.input }} type="number" value={assumptions.holdOpt2Months} onChange={setAssume('holdOpt2Months')} /></div>
            </div>
            <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Full Retail (Option 3)</div>
            <div style={S.fieldRow}>
              <div style={S.field}><label style={S.label}>Monthly Holding %</label><input style={{ ...S.input }} type="number" value={assumptions.holdOpt3Pct} onChange={setAssume('holdOpt3Pct')} /></div>
              <div style={S.field}><label style={S.label}># of Months</label><input style={{ ...S.input }} type="number" value={assumptions.holdOpt3Months} onChange={setAssume('holdOpt3Months')} /></div>
            </div>
          </div>
        )}

        <div style={S.divider} />

        {/* Repair Breakdown */}
        <div style={S.sectionLabel}>Repair Breakdown <span style={S.labelAfter} /></div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
          <thead>
            <tr>
              <th style={{ fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', color: '#6b7280', fontWeight: 500, padding: '6px 6px', textAlign: 'left', borderBottom: '1px solid #D6D2CA' }}>Item</th>
              <th style={{ fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', color: '#6b7280', fontWeight: 500, padding: '6px 6px', textAlign: 'right', width: 110, borderBottom: '1px solid #D6D2CA' }}>Cost ($)</th>
              <th style={{ width: 28 }}></th>
            </tr>
          </thead>
          <tbody>
            {repairs.map(r => (
              <tr key={r.id}>
                <td style={{ padding: 3 }}><input style={{ ...S.input, border: '1px solid transparent', padding: '6px 8px', fontSize: 13 }} value={r.name} onChange={e => updateRepair(r.id, 'name', e.target.value)} placeholder="Item description" /></td>
                <td style={{ padding: 3 }}><input style={{ ...S.input, border: '1px solid transparent', padding: '6px 8px', fontSize: 13, textAlign: 'right' }} type="number" value={r.cost} onChange={e => updateRepair(r.id, 'cost', e.target.value)} placeholder="0" /></td>
                <td style={{ padding: 3, textAlign: 'center' }}><button onClick={() => removeRepair(r.id)} style={{ background: 'none', border: 'none', color: '#aab0bb', cursor: 'pointer', fontSize: 16, padding: 4 }}>×</button></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '1px solid #D6D2CA' }}>
              <td style={{ padding: '8px 6px', fontSize: 12, fontWeight: 700, color: '#2D6FAF', fontFamily: 'monospace' }}>TOTAL REPAIRS</td>
              <td style={{ padding: '8px 6px', fontSize: 13, fontWeight: 700, color: '#2D6FAF', fontFamily: 'monospace', textAlign: 'right' }}>{fmt(repairTotal)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
        <button onClick={addRepair} style={{ width: '100%', background: 'transparent', border: '1px dashed #D6D2CA', borderRadius: 6, padding: 8, color: '#6b7280', fontSize: 12, cursor: 'pointer', marginBottom: 6, fontFamily: 'inherit' }}>+ Add Line Item</button>
        <button onClick={() => setShowCsvModal(true)} style={{ width: '100%', background: 'transparent', border: '1px dashed #D6D2CA', borderRadius: 6, padding: 8, color: '#6b7280', fontSize: 12, cursor: 'pointer', marginBottom: 16, fontFamily: 'inherit' }}>📋 Import from CSV / Paste List</button>

        {/* Action buttons */}
        <button onClick={saveToSupabase} disabled={saving || !fields.arv} style={{ width: '100%', background: saved ? '#3B6D11' : '#2C2C2C', border: 'none', borderRadius: 8, padding: 14, color: '#fff', fontSize: 13, fontWeight: 700, letterSpacing: 1.5, cursor: !fields.arv ? 'not-allowed' : 'pointer', marginBottom: 8, textTransform: 'uppercase', opacity: !fields.arv ? 0.5 : 1, fontFamily: 'inherit' }}>
          {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Offer'}
        </button>
        <button onClick={() => setShowProposal(p => !p)} style={{ width: '100%', background: '#B8892A', border: 'none', borderRadius: 8, padding: 14, color: '#111', fontSize: 14, fontWeight: 700, letterSpacing: 2, cursor: 'pointer', textTransform: 'uppercase', fontFamily: 'inherit' }}>
          {showProposal ? 'Hide Proposal' : 'Generate Proposal'}
        </button>
      </div>

      {/* ── MAIN AREA ── */}
      <div style={S.main}>
        {/* Live Offer Preview */}
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2.5, color: '#B8892A', textTransform: 'uppercase', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
          Live Offer Preview <span style={S.labelAfter} />
        </div>

        {/* Three option cards */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 28 }}>
          {/* Option 1 */}
          <div style={{ ...S.optCard }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: '#3B6D11' }} />
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: '#6b7280', marginBottom: 4 }}>OPTION 1{d.cashOfferOverrideActive ? ' · manual' : ''}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#3B6D11', marginBottom: 14 }}>Cash Offer</div>
            {[['After Renovation Value', fmt(d.arv)], ['Less: Renovation', `(${fmt(d.reno)})`], [`Less: Commission (${(d.commCashPct * 100).toFixed(1).replace(/\.0$/, '')}%)`, `(${fmt(d.commCashPct * d.arv)})`], [`Less: Holding (${d.assumptions.holdCashMonths} mo)`, `(${fmt(d.cashHolding)})`], [`Less: Profit ${d.profitOverrideActive ? '(manual)' : `(${Math.round(d.profitPct * 100)}% ARV)`}`, `(${fmt(d.profit)})`]].map(([k, v]) => (
              <div key={k} style={S.optLine}><span style={{ color: '#6b7280' }}>{k}</span><span style={{ fontFamily: 'monospace' }}>{v}</span></div>
            ))}
            <div style={S.optNet}>
              <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, color: '#6b7280' }}>Cash Offer</span>
              <span style={{ fontFamily: 'monospace', fontSize: 24, fontWeight: 700, color: '#3B6D11' }}>{fmt(d.cashOffer)}</span>
            </div>
          </div>

          {/* Option 2 */}
          <div style={S.optCard}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: '#2D6FAF' }} />
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: '#6b7280', marginBottom: 4 }}>OPTION 2</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#2D6FAF', marginBottom: 14 }}>As-Is Listing</div>
            {[['After Renovation Value', fmt(d.arv)], [`Less: Renovation (${Math.round(d.renoDiscountPct * 100)}%)`, `(${fmt(d.renoDiscount)})`], [`As-Is Price${d.asisOverrideActive ? ' (manual)' : ''}`, fmt(d.asisValue)], [`Less: Commission (${(d.commListPct * 100).toFixed(1).replace(/\.0$/, '')}%)`, `(${fmt(d.opt2Comm)})`], [`Less: Holding (${d.assumptions.holdOpt2Months} mo)`, `(${fmt(d.opt2Holding)})`]].map(([k, v]) => (
              <div key={k} style={S.optLine}><span style={{ color: '#6b7280' }}>{k}</span><span style={{ fontFamily: 'monospace' }}>{v}</span></div>
            ))}
            <div style={S.optNet}>
              <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, color: '#6b7280' }}>Net to Seller</span>
              <span style={{ fontFamily: 'monospace', fontSize: 24, fontWeight: 700, color: '#2D6FAF' }}>{fmt(d.opt2Net)}</span>
            </div>
          </div>

          {/* Option 3 */}
          <div style={S.optCard}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: '#D97825' }} />
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: '#6b7280', marginBottom: 4 }}>OPTION 3</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#D97825', marginBottom: 14 }}>Full Retail</div>
            {[['After Renovation Value', fmt(d.arv)], ['Less: Renovation', `(${fmt(d.reno)})`], [`Less: Commission (${(d.commListPct * 100).toFixed(1).replace(/\.0$/, '')}%)`, `(${fmt(d.opt3Comm)})`], [`Less: Holding (${d.assumptions.holdOpt3Months} mo)`, `(${fmt(d.opt3Holding)})`]].map(([k, v]) => (
              <div key={k} style={S.optLine}><span style={{ color: '#6b7280' }}>{k}</span><span style={{ fontFamily: 'monospace' }}>{v}</span></div>
            ))}
            <div style={S.optNet}>
              <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, color: '#6b7280' }}>Net to Seller</span>
              <span style={{ fontFamily: 'monospace', fontSize: 24, fontWeight: 700, color: '#D97825' }}>{fmt(d.opt3Net)}</span>
            </div>
          </div>
        </div>

        {/* Proposal */}
        {showProposal && <ProposalDoc fields={fields} repairs={repairs} d={d} />}
      </div>

      {/* CSV Import Modal */}
      {showCsvModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 10, padding: 24, width: '100%', maxWidth: 500, borderTop: '3px solid #B8892A' }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Import from CSV / Paste List</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>One item per line. Comma or tab between name and cost:<br /><code style={{ fontFamily: 'monospace' }}>Flooring, 5200</code></div>
            <textarea value={csvText} onChange={e => setCsvText(e.target.value)} placeholder="Flooring, 5200&#10;Painting, 7800&#10;Demo / Cleanup, 1200" style={{ width: '100%', minHeight: 120, border: '1px solid #D6D2CA', borderRadius: 6, padding: 10, fontFamily: 'monospace', fontSize: 12, outline: 'none', resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={() => importCsv(false)} style={{ flex: 1, background: '#B8892A', color: '#111', border: 'none', borderRadius: 6, padding: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Replace All</button>
              <button onClick={() => importCsv(true)} style={{ flex: 1, background: 'transparent', color: '#2C2C2C', border: '1px solid #D6D2CA', borderRadius: 6, padding: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Append</button>
              <button onClick={() => setShowCsvModal(false)} style={{ background: 'transparent', color: '#6b7280', border: '1px solid #D6D2CA', borderRadius: 6, padding: '9px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Proposal Document ─────────────────────────────────────────────────────
function ProposalDoc({ fields, repairs, d }) {
  const repairItems = repairs.filter(r => r.name || r.cost)
  const addr = fields.address || '— Address Not Entered —'

  const pgStyle = { background: '#fff', color: '#111', width: '8.5in', minHeight: '11in', margin: '20px auto', padding: '0.4in 0.55in', boxShadow: '0 4px 24px rgba(0,0,0,0.1)', fontFamily: "'DM Sans', sans-serif", position: 'relative', pageBreakAfter: 'always' }
  const headerStyle = { border: '1.5px solid #2D6FAF', borderRadius: 6, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 16, marginBottom: 0, height: 78 }
  const stripeStyle = { height: 14, margin: '5px 0 0', display: 'flex' }
  const optBoxStyle = (color) => ({ border: '1px solid #d0d7e0', borderRadius: 4, overflow: 'hidden', marginBottom: 14 })

  function fmtNeg2(n) { if (!n) return '$0'; return '−$' + Math.round(Math.abs(n)).toLocaleString() }

  return (
    <div>
      <button onClick={() => window.print()} style={{ display: 'block', margin: '0 auto 20px', background: '#2D6FAF', border: 'none', borderRadius: 8, padding: '13px 28px', color: '#fff', fontSize: 14, fontWeight: 700, letterSpacing: 2, cursor: 'pointer', textTransform: 'uppercase', fontFamily: 'inherit' }}>
        Print / Save as PDF
      </button>

      {/* PAGE 1 */}
      <div style={pgStyle}>
        <div style={headerStyle}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#2C2C2C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: '#B8892A', fontWeight: 700 }}>N</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#2D6FAF' }}>NEW HOME COLLECTIVE</div>
            <div style={{ fontSize: 12, color: '#888', fontStyle: 'italic' }}>Real Estate Solutions · Fast, Fair, Honest</div>
          </div>
        </div>
        <div style={stripeStyle}>
          <span style={{ background: '#2D6FAF', flex: 25 }} /><span style={{ background: '#3B6D11', flex: 24 }} /><span style={{ background: '#B8892A', flex: 24 }} /><span style={{ background: '#D97825', flex: 13 }} /><span style={{ background: '#B91C1C', flex: 13 }} />
        </div>
        <h1 style={{ fontSize: 36, fontWeight: 800, color: '#2D6FAF', textAlign: 'center', marginTop: 18, marginBottom: 6 }}>CASH OFFER PROPOSAL</h1>
        <div style={{ textAlign: 'center', fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{addr}</div>
        {(fields.beds || fields.baths) && <div style={{ textAlign: 'center', fontSize: 12, fontStyle: 'italic', color: '#555' }}>{[fields.beds && `${fields.beds} Bed`, fields.baths && `${fields.baths} Bath`].filter(Boolean).join(' · ')}</div>}

        <div style={{ fontSize: 18, fontWeight: 700, color: '#2D6FAF', margin: '18px 0 8px' }}>Property Valuation</div>
        <div style={{ border: '1px solid #d0d7e0', borderRadius: 4, padding: '12px 22px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {[['After Renovation Value', d.arv], ['As-Is Market Value', d.asisValue]].map(([l, v]) => (
            <div key={l}><div style={{ fontSize: 11, color: '#888' }}>{l}</div><div style={{ fontSize: 28, fontWeight: 800, color: '#2D6FAF' }}>{fmt(v)}</div></div>
          ))}
        </div>

        <div style={{ fontSize: 18, fontWeight: 700, color: '#2D6FAF', margin: '18px 0 8px' }}>Renovation Breakdown</div>
        <div style={{ fontSize: 12, fontStyle: 'italic', color: '#555', marginBottom: 8 }}>Estimated repairs required to bring the property to retail condition:</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
          <thead><tr><th style={{ background: '#2D6FAF', color: '#fff', padding: '8px 14px', textAlign: 'left' }}>Item</th><th style={{ background: '#2D6FAF', color: '#fff', padding: '8px 14px', textAlign: 'right' }}>Cost</th></tr></thead>
          <tbody>{repairItems.map((r, i) => <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f9f9f9' }}><td style={{ padding: '5px 14px', borderBottom: '1px solid #eee' }}>{r.name}</td><td style={{ padding: '5px 14px', borderBottom: '1px solid #eee', textAlign: 'right', fontWeight: 700 }}>{fmt(parseFloat(r.cost) || 0)}</td></tr>)}</tbody>
          <tfoot><tr style={{ background: '#2D6FAF', color: '#fff' }}><td style={{ padding: '9px 14px', fontWeight: 700 }}>TOTAL ESTIMATED REPAIRS</td><td style={{ padding: '9px 14px', fontWeight: 700, textAlign: 'right' }}>{fmt(d.reno)}</td></tr></tfoot>
        </table>
        <div style={{ position: 'absolute', bottom: '0.3in', right: '0.55in', fontSize: 10, color: '#aaa', fontStyle: 'italic' }}>New Home Collective · Page 1 of 3</div>
      </div>

      {/* PAGE 2 */}
      <div style={pgStyle}>
        <div style={headerStyle}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#2C2C2C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: '#B8892A', fontWeight: 700 }}>N</div>
          <div><div style={{ fontSize: 18, fontWeight: 700, color: '#2D6FAF' }}>NEW HOME COLLECTIVE</div><div style={{ fontSize: 12, color: '#888', fontStyle: 'italic' }}>Real Estate Solutions · Fast, Fair, Honest</div></div>
        </div>
        <div style={stripeStyle}><span style={{ background: '#2D6FAF', flex: 25 }} /><span style={{ background: '#3B6D11', flex: 24 }} /><span style={{ background: '#B8892A', flex: 24 }} /><span style={{ background: '#D97825', flex: 13 }} /><span style={{ background: '#B91C1C', flex: 13 }} /></div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#2D6FAF', margin: '14px 0 6px' }}>Three-Option Offer</div>
        <p style={{ fontSize: 12, color: '#333', lineHeight: 1.45, marginBottom: 14 }}>We're offering you three paths forward. Each one fits a different priority — speed, net amount, or maximum upside.</p>

        {[
          { color: '#3B6D11', title: 'OPTION 1 — CASH OFFER', sub: 'Fast, As-Is, No Hassle', price: fmt(d.cashOffer), netLabel: 'Purchase Price', items: [[`Commission (${(d.commCashPct * 100).toFixed(1)}%)`, fmtNeg2(d.commCashPct * d.arv)], [`Holding (${d.assumptions.holdCashMonths} mo)`, fmtNeg2(d.cashHolding)]], highlights: ['Close in 2–3 weeks', 'No repairs required', 'No commissions, no fees', 'Quick, clean sale'] },
          { color: '#2D6FAF', title: 'OPTION 2 — AS-IS LISTING', sub: 'Sell on the Open Market', price: fmt(d.asisValue), netLabel: 'Net to Seller', items: [[`Commission (${(d.commListPct * 100).toFixed(1)}%)`, fmtNeg2(d.opt2Comm)], [`Holding (${d.assumptions.holdOpt2Months} mo)`, fmtNeg2(d.opt2Holding)]], net: fmt(d.opt2Net), highlights: ['2–3 month timeline', 'Showings & negotiation', 'Inspection / financing risk', 'Carrying costs while listed'] },
          { color: '#D97825', title: 'OPTION 3 — FULL RETAIL', sub: 'Renovate First, Then List', price: fmt(d.arv), netLabel: 'Net to Seller', items: [['Repairs', fmtNeg2(d.reno)], [`Commission (${(d.commListPct * 100).toFixed(1)}%)`, fmtNeg2(d.opt3Comm)], [`Holding (${d.assumptions.holdOpt3Months} mo)`, fmtNeg2(d.opt3Holding)]], net: fmt(d.opt3Net), highlights: ['4–6 month timeline', 'Full renovation required', 'Project management needed', 'Market & cost overrun risk'] },
        ].map(opt => (
          <div key={opt.title} style={optBoxStyle(opt.color)}>
            <div style={{ background: opt.color, color: '#fff', padding: '10px 18px' }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{opt.title}</div>
              <div style={{ fontSize: 11.5, fontStyle: 'italic', opacity: 0.95 }}>{opt.sub}</div>
            </div>
            <div style={{ padding: '12px 18px', display: 'flex', gap: 24 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: '#888' }}>{opt.netLabel}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: opt.color }}>{opt.price}</div>
                {opt.items.map(([l, v]) => <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, padding: '2px 0' }}><span style={{ color: '#555' }}>{l}</span><span style={{ fontWeight: 700, color: '#B91C1C' }}>{v}</span></div>)}
                {opt.net && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, marginTop: 6, paddingTop: 6, borderTop: '1px solid #eee' }}><span>Net to Seller</span><span>~{opt.net}</span></div>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Highlights</div>
                <ul style={{ paddingLeft: 16, fontSize: 11.5, lineHeight: 1.7 }}>{opt.highlights.map(h => <li key={h}>{h}</li>)}</ul>
              </div>
            </div>
          </div>
        ))}
        <div style={{ position: 'absolute', bottom: '0.3in', right: '0.55in', fontSize: 10, color: '#aaa', fontStyle: 'italic' }}>New Home Collective · Page 2 of 3</div>
      </div>

      {/* PAGE 3 */}
      <div style={pgStyle}>
        <div style={headerStyle}><div style={{ width: 48, height: 48, borderRadius: '50%', background: '#2C2C2C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: '#B8892A', fontWeight: 700 }}>N</div><div><div style={{ fontSize: 18, fontWeight: 700, color: '#2D6FAF' }}>NEW HOME COLLECTIVE</div><div style={{ fontSize: 12, color: '#888', fontStyle: 'italic' }}>Real Estate Solutions · Fast, Fair, Honest</div></div></div>
        <div style={stripeStyle}><span style={{ background: '#2D6FAF', flex: 25 }} /><span style={{ background: '#3B6D11', flex: 24 }} /><span style={{ background: '#B8892A', flex: 24 }} /><span style={{ background: '#D97825', flex: 13 }} /><span style={{ background: '#B91C1C', flex: 13 }} /></div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#2D6FAF', margin: '14px 0 8px' }}>Seller Comparison</div>
        <p style={{ fontSize: 12, color: '#333', fontStyle: 'italic', marginBottom: 14 }}>At a glance — what each option puts in your pocket and what it asks of you.</p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead><tr style={{ background: '#2D6FAF', color: '#fff' }}>{['Option', 'Net to Seller', 'Timeline', 'Effort'].map(h => <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 700 }}>{h}</th>)}</tr></thead>
          <tbody>
            {[['Cash Offer (Option 1)', fmt(d.cashOffer), '2–3 weeks', 'Very Low'], ['As-Is Listing (Option 2)', `~${fmt(d.opt2Net)}`, '2–3 months', 'Low'], ['Full Retail (Option 3)', `~${fmt(d.opt3Net)}`, '4–6 months', 'High']].map(([o, n, t, e], i) => (
              <tr key={o} style={{ background: i % 2 === 0 ? '#fff' : '#f9f9f9' }}>{[o, n, t, e].map((v, j) => <td key={j} style={{ padding: '8px 14px', borderBottom: '1px solid #eee' }}>{v}</td>)}</tr>
            ))}
          </tbody>
        </table>
        <div style={{ border: '1px solid #d0d7e0', borderRadius: 6, padding: '20px 24px', marginTop: 24, textAlign: 'center' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, color: '#2D6FAF' }}>Ready to move forward? Let's talk.</h3>
          <p style={{ fontSize: 12, color: '#555' }}>Reach out anytime to accept this offer or ask any questions.</p>
        </div>
        <div style={{ position: 'absolute', bottom: '0.3in', right: '0.55in', fontSize: 10, color: '#aaa', fontStyle: 'italic' }}>New Home Collective · Page 3 of 3</div>
      </div>
    </div>
  )
}
