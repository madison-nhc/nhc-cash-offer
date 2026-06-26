import { fmt } from './ui.jsx'

function calcOffers(p) {
  const arv = parseFloat(p.arv)||0
  const reno = (p.repair_items||[]).reduce((s,r)=>s+(parseFloat(r.cost)||0),0)
  const commCash = (parseFloat(p.comm_cash_pct)||9)/100
  const commList = (parseFloat(p.comm_list_pct)||6)/100
  const profitPct = (parseFloat(p.profit_margin)||15)/100
  const profit = p.profit_override ? parseFloat(p.profit_override) : arv*profitPct
  const asisDisc = (parseFloat(p.asis_pct)||50)/100
  const asisVal = p.asis_override ? parseFloat(p.asis_override) : arv-(asisDisc*reno)
  const cashOffer = p.cash_offer_override ? parseFloat(p.cash_offer_override) : arv-reno-(commCash*arv)-((parseFloat(p.hold_cash_pct)||0.75)/100*(parseFloat(p.hold_cash_months)||6)*arv)-profit
  const opt2Comm = commList*asisVal
  const opt2Hold = (parseFloat(p.hold_opt2_pct)||0.5)/100*(parseFloat(p.hold_opt2_months)||3)*arv
  const opt2Net = asisVal-opt2Comm-opt2Hold
  const opt3Comm = commList*arv
  const opt3Hold = (parseFloat(p.hold_opt3_pct)||0.5)/100*(parseFloat(p.hold_opt3_months)||6)*arv
  const opt3Net = arv-reno-opt3Comm-opt3Hold
  return { arv, reno, cashOffer, asisVal, opt2Net, opt3Net, commCash, commList, opt2Comm, opt2Hold, opt3Comm, opt3Hold }
}

const BLUE = '#2D6FAF'
const FONT = "'Helvetica Neue', Arial, sans-serif"

// Matches the PDF exactly — logo in bordered box + color stripe
function PageHeader({ address }) {
  return (
    <div style={{ marginBottom: 24 }}>
      {/* Logo box */}
      <div style={{ border: `1.5px solid ${BLUE}`, borderRadius: 6, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16, marginBottom: 0 }}>
        <img src="/nhc-logo.svg" alt="NHC" style={{ height: 52, width: 52, objectFit: 'contain', flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: BLUE, letterSpacing: 0.5 }}>NEW HOME COLLECTIVE</div>
          <div style={{ fontSize: 12, color: '#666', fontStyle: 'italic', marginTop: 2 }}>Real Estate Solutions • Fast, Fair, Honest</div>
        </div>
      </div>
      {/* Color stripe */}
      <div style={{ display: 'flex', height: 7, marginTop: 5 }}>
        <div style={{ background: BLUE, flex: 25 }} />
        <div style={{ background: '#3B6D11', flex: 25 }} />
        <div style={{ background: '#B8892A', flex: 20 }} />
        <div style={{ background: '#D97825', flex: 15 }} />
        <div style={{ background: '#B91C1C', flex: 15 }} />
      </div>
      {/* Page header line (pages 2+) */}
      {address && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8, fontSize: 11, color: '#888', fontStyle: 'italic' }}>
          New Home Collective • {address}
        </div>
      )}
    </div>
  )
}

function PageFooter({ page, address }) {
  return (
    <div style={{ position: 'absolute', bottom: '0.35in', left: '0.5in', right: '0.5in', display: 'flex', justifyContent: 'center', fontSize: 11, color: '#aaa' }}>
      New Home Collective • Page {page} of 3
    </div>
  )
}

const PAGE = {
  position: 'relative',
  background: '#fff',
  fontFamily: FONT,
  color: '#222',
  width: '100%',
  maxWidth: '8in',
  margin: '0 auto 20px',
  padding: '0.45in 0.5in 0.7in',
  boxShadow: '0 2px 20px rgba(0,0,0,0.12)',
  boxSizing: 'border-box',
  pageBreakAfter: 'always',
  minHeight: '10.5in',
}

const SEC_HDR = {
  fontSize: 14,
  fontWeight: 700,
  color: BLUE,
  marginBottom: 8,
  marginTop: 20,
  paddingBottom: 4,
}

function CostLine({ label, value, bold, indent }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: indent ? '3px 0 3px 12px' : '3px 0', fontSize: 13, fontWeight: bold ? 700 : 400, color: bold ? '#222' : '#444', borderBottom: '1px solid #f0f3f7' }}>
      <span>{label}</span>
      <span style={{ fontFamily: 'monospace' }}>{value}</span>
    </div>
  )
}

export default function ProposalModal({ property, onClose }) {
  if (!property) return null
  const d = calcOffers(property)
  const repairs = (property.repair_items||[]).filter(r => r.name || r.cost)
  const addr = property.address || ''
  const sub = [
    property.beds && `${property.beds} Bed`,
    property.baths && `${property.baths} Bath`,
    property.sqft && `~${parseInt(property.sqft).toLocaleString()} sq ft`,
  ].filter(Boolean).join(' • ')

  // Recommendation paragraph — dynamic based on which option wins
  const cashIsHighest = d.cashOffer >= d.opt2Net && d.cashOffer >= d.opt3Net

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,20,40,0.8)', zIndex: 300, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <style>{`
        @media print {
          @page { margin: 0; size: letter; }
          body * { visibility: hidden; }
          #proposal-root, #proposal-root * { visibility: visible; }
          #proposal-root { position: fixed; top: 0; left: 0; width: 100%; background: #fff; }
          .no-print { display: none !important; }
          .proposal-page { box-shadow: none !important; margin: 0 !important; min-height: 100vh !important; page-break-after: always; }
          .proposal-page:last-child { page-break-after: avoid; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="no-print" style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(15,20,40,0.93)', backdropFilter: 'blur(8px)', padding: '12px 20px', display: 'flex', gap: 10, alignItems: 'center' }}>
        <button onClick={() => window.print()} style={{ background: '#B8892A', border: 'none', borderRadius: 6, padding: '10px 22px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
          Print / Save PDF
        </button>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 6, padding: '10px 18px', color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: FONT }}>
          Close
        </button>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginLeft: 6 }}>Print → Save as PDF for best results</span>
      </div>

      <div id="proposal-root" style={{ padding: '20px 12px 40px' }}>

        {/* ══ PAGE 1 — Cover + Repairs ══ */}
        <div className="proposal-page" style={PAGE}>
          <PageHeader />

          {/* Title */}
          <div style={{ textAlign: 'center', margin: '28px 0 24px' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: BLUE, letterSpacing: 1, marginBottom: 6 }}>CASH OFFER PROPOSAL</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#222', marginBottom: 6 }}>{addr}</div>
            {sub && <div style={{ fontSize: 13, color: '#666', fontStyle: 'italic' }}>{sub}</div>}
          </div>

          {/* Property Valuation */}
          <div style={SEC_HDR}>Property Valuation</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: '1px solid #dde3eb', borderRadius: 4, overflow: 'hidden', marginBottom: 4 }}>
            {[
              ['ARV (Retail Value)', fmt(d.arv)],
              ['As-Is Rental / Investor Value', `~${fmt(d.asisVal)}`],
            ].map(([label, value], i) => (
              <div key={label} style={{ padding: '14px 18px', borderRight: i === 0 ? '1px solid #dde3eb' : 'none', background: '#fafbfd' }}>
                <div style={{ fontSize: 11, color: '#777', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: BLUE, fontFamily: 'monospace' }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Repairs */}
          {repairs.length > 0 && (<>
            <div style={SEC_HDR}>Renovation Breakdown</div>
            <div style={{ fontSize: 12, color: '#666', fontStyle: 'italic', marginBottom: 10 }}>
              Estimated repairs required to bring the property to retail condition:
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: BLUE }}>
                  <th style={{ padding: '9px 14px', textAlign: 'left', color: '#fff', fontWeight: 700 }}>Item</th>
                  <th style={{ padding: '9px 14px', textAlign: 'right', color: '#fff', fontWeight: 700 }}>Cost</th>
                </tr>
              </thead>
              <tbody>
                {repairs.map((r, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f7f9fc' }}>
                    <td style={{ padding: '7px 14px', borderBottom: '1px solid #edf0f4' }}>{r.name}</td>
                    <td style={{ padding: '7px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, borderBottom: '1px solid #edf0f4' }}>{fmt(parseFloat(r.cost)||0)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: BLUE }}>
                  <td style={{ padding: '9px 14px', color: '#fff', fontWeight: 700, textTransform: 'uppercase', fontSize: 12, letterSpacing: 0.5 }}>Total Estimated Repairs</td>
                  <td style={{ padding: '9px 14px', textAlign: 'right', color: '#fff', fontFamily: 'monospace', fontWeight: 800, fontSize: 15 }}>{fmt(d.reno)}</td>
                </tr>
              </tfoot>
            </table>
          </>)}

          <PageFooter page={1} />
        </div>

        {/* ══ PAGE 2 — Three Options ══ */}
        <div className="proposal-page" style={PAGE}>
          <PageHeader address={addr} />

          <div style={{ fontSize: 18, fontWeight: 700, color: BLUE, marginBottom: 6 }}>Three-Option Offer</div>
          <p style={{ fontSize: 13, color: '#555', lineHeight: 1.6, marginBottom: 20 }}>
            We're offering you three paths forward. Each one fits a different priority — speed, net amount, or maximum upside. Here's how they compare side by side.
          </p>

          {/* Option 1 */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ background: '#3B6D11', color: '#fff', padding: '9px 14px', borderRadius: '4px 4px 0 0' }}>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>OPTION 1 — CASH OFFER (RECOMMENDED)</div>
              <div style={{ fontSize: 12, fontStyle: 'italic', opacity: 0.9 }}>Fast, As-Is, No Hassle</div>
            </div>
            <div style={{ border: '1px solid #dde3eb', borderTop: 'none', borderRadius: '0 0 4px 4px', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
              <div style={{ padding: '14px 18px', borderRight: '1px solid #edf0f4' }}>
                <div style={{ fontSize: 11, color: '#777', marginBottom: 4 }}>Purchase Price</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#3B6D11', fontFamily: 'monospace', marginBottom: 10 }}>{fmt(d.cashOffer)}</div>
                <CostLine label="Net to Seller:" value={fmt(d.cashOffer)} bold />
              </div>
              <div style={{ padding: '14px 18px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Highlights</div>
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13, lineHeight: 2, color: '#444' }}>
                  <li>Close in 2–3 weeks</li>
                  <li>No repairs required</li>
                  <li>No commissions, no fees</li>
                  <li>Quick, clean sale</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Option 2 */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ background: BLUE, color: '#fff', padding: '9px 14px', borderRadius: '4px 4px 0 0' }}>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>OPTION 2 — AS-IS LISTING</div>
              <div style={{ fontSize: 12, fontStyle: 'italic', opacity: 0.9 }}>Sell on the Open Market to an Investor Buyer</div>
            </div>
            <div style={{ border: '1px solid #dde3eb', borderTop: 'none', borderRadius: '0 0 4px 4px', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
              <div style={{ padding: '14px 18px', borderRight: '1px solid #edf0f4' }}>
                <div style={{ fontSize: 11, color: '#777', marginBottom: 4 }}>List Price</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: BLUE, fontFamily: 'monospace', marginBottom: 10 }}>{fmt(d.asisVal)}</div>
                <div style={{ fontSize: 12, color: '#777', marginBottom: 6 }}>Less Costs:</div>
                <CostLine label={`Commission (${(d.commList*100).toFixed(0)}%):`} value={`−${fmt(d.opt2Comm)}`} indent />
                <CostLine label={`Holding (${property.hold_opt2_months||3} mo):`} value={`−${fmt(d.opt2Hold)}`} indent />
                <CostLine label="Net to Seller:" value={`~${fmt(d.opt2Net)}`} bold />
              </div>
              <div style={{ padding: '14px 18px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Considerations</div>
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13, lineHeight: 2, color: '#444' }}>
                  <li>2–3 month timeline</li>
                  <li>Investor buyer most likely</li>
                  <li>Showings &amp; negotiation required</li>
                  <li>Inspection / financing risk</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Option 3 */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ background: '#D97825', color: '#fff', padding: '9px 14px', borderRadius: '4px 4px 0 0' }}>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>OPTION 3 — FULL RETAIL (After Renovation)</div>
              <div style={{ fontSize: 12, fontStyle: 'italic', opacity: 0.9 }}>Renovate First, Then List at Top of Market</div>
            </div>
            <div style={{ border: '1px solid #dde3eb', borderTop: 'none', borderRadius: '0 0 4px 4px', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
              <div style={{ padding: '14px 18px', borderRight: '1px solid #edf0f4' }}>
                <div style={{ fontSize: 11, color: '#777', marginBottom: 4 }}>Projected Sale Price</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#D97825', fontFamily: 'monospace', marginBottom: 10 }}>{fmt(d.arv)}</div>
                <div style={{ fontSize: 12, color: '#777', marginBottom: 6 }}>Less Costs:</div>
                <CostLine label="Repairs:" value={`−${fmt(d.reno)}`} indent />
                <CostLine label={`Commission (${(d.commList*100).toFixed(0)}%):`} value={`−${fmt(d.opt3Comm)}`} indent />
                <CostLine label={`Holding (${property.hold_opt3_months||6} mo):`} value={`−${fmt(d.opt3Hold)}`} indent />
                <CostLine label="Net to Seller:" value={`~${fmt(d.opt3Net)}`} bold />
              </div>
              <div style={{ padding: '14px 18px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Considerations</div>
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13, lineHeight: 2, color: '#444' }}>
                  <li>4–6 month timeline</li>
                  <li>Full renovation required</li>
                  <li>Project management &amp; coordination</li>
                  <li>Market &amp; cost overrun risk</li>
                </ul>
              </div>
            </div>
          </div>

          <PageFooter page={2} />
        </div>

        {/* ══ PAGE 3 — Comparison + Recommendation ══ */}
        <div className="proposal-page" style={{ ...PAGE, pageBreakAfter: 'avoid' }}>
          <PageHeader address={addr} />

          {/* Comparison table */}
          <div style={{ fontSize: 18, fontWeight: 700, color: BLUE, marginBottom: 4 }}>Seller Comparison</div>
          <p style={{ fontSize: 13, color: '#666', fontStyle: 'italic', marginBottom: 12 }}>
            At a glance — what each option puts in your pocket and what it asks of you.
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 28 }}>
            <thead>
              <tr style={{ background: BLUE }}>
                {['Option', 'Net to Seller', 'Timeline', 'Effort'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#fff', fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr style={{ background: '#f0fdf4' }}>
                <td style={{ padding: '10px 14px', fontWeight: 700, color: '#3B6D11', borderBottom: '1px solid #dde3eb' }}>✓ Cash Offer (Option 1)</td>
                <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#3B6D11', borderBottom: '1px solid #dde3eb' }}>{fmt(d.cashOffer)}</td>
                <td style={{ padding: '10px 14px', fontWeight: 700, color: '#3B6D11', borderBottom: '1px solid #dde3eb' }}>2–3 weeks</td>
                <td style={{ padding: '10px 14px', fontWeight: 700, color: '#3B6D11', borderBottom: '1px solid #dde3eb' }}>Very Low</td>
              </tr>
              <tr style={{ background: '#fff' }}>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid #edf0f4' }}>As-Is Listing (Option 2)</td>
                <td style={{ padding: '10px 14px', fontFamily: 'monospace', borderBottom: '1px solid #edf0f4' }}>~{fmt(d.opt2Net)}</td>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid #edf0f4' }}>2–3 months</td>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid #edf0f4' }}>Low</td>
              </tr>
              <tr style={{ background: '#f7f9fc' }}>
                <td style={{ padding: '10px 14px' }}>Full Retail (Option 3)</td>
                <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>~{fmt(d.opt3Net)}</td>
                <td style={{ padding: '10px 14px' }}>4–6 months</td>
                <td style={{ padding: '10px 14px' }}>High</td>
              </tr>
            </tbody>
          </table>

          {/* Recommendation */}
          <div style={{ fontSize: 15, fontWeight: 700, color: BLUE, marginBottom: 10 }}>Our Recommendation</div>
          <p style={{ fontSize: 13, color: '#444', lineHeight: 1.75, marginBottom: 10 }}>
            The Cash Offer is the cleanest path. While Option 2 looks higher on paper, that number assumes the home sells at full as-is value with no concessions, no extended holding, and no inspection issues — none of which are guaranteed. Option 3 requires you to take on contractor risk, market risk, and four to six months of carrying costs.
          </p>
          <p style={{ fontSize: 13, color: '#222', lineHeight: 1.75, fontWeight: 600, marginBottom: 28 }}>
            With the cash offer, what you see is what you get: {fmt(d.cashOffer)}, in your hands, in 2–3 weeks. No surprises.
          </p>

          {/* CTA */}
          <div style={{ borderTop: '1px solid #dde3eb', paddingTop: 20, textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: BLUE, marginBottom: 6 }}>Ready to move forward? Let's talk.</div>
            <div style={{ fontSize: 13, color: '#666', fontStyle: 'italic' }}>Reach out anytime to accept this offer or ask any questions.</div>
          </div>

          {/* Footer logo box */}
          <div style={{ border: `1.5px solid ${BLUE}`, borderRadius: 6, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <img src="/nhc-logo.svg" alt="NHC" style={{ height: 56, width: 56, objectFit: 'contain', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: BLUE }}>NEW HOME COLLECTIVE</div>
              <div style={{ fontSize: 12, color: '#666', fontStyle: 'italic', marginTop: 2 }}>Real Estate Solutions • Lexington, KY</div>
            </div>
          </div>

          <PageFooter page={3} />
        </div>

      </div>
    </div>
  )
}
