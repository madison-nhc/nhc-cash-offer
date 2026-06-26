import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { PageWrap, SectionBar, Card, Modal, Btn, Badge, EmptyState, LoadingSpinner, StatCard, fmt, fmtK } from '../components/ui.jsx'

export default function SavedOffers({ onLoadCalc }) {
  const [offers, setOffers] = useState([])
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('cash_offers')
      .select('*')
      .order('created_at', { ascending: false })
    setOffers(data || [])
    setLoading(false)
  }

  async function del(id) {
    if (!confirm('Delete this saved offer?')) return
    await supabase.from('cash_offers').delete().eq('id', id)
    load()
  }

  const totalARV = offers.reduce((s, o) => s + (parseFloat(o.arv) || 0), 0)

  if (loading) return <LoadingSpinner />

  return (
    <PageWrap>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#2C2C2C' }}>Saved Proposals</h1>
          <p style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>All saved cash offer calculations</p>
        </div>
        <Btn onClick={() => onLoadCalc(null)}>+ New Offer</Btn>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        <StatCard label="Total Saved Offers" value={offers.length} topColor="#B8892A" />
        <StatCard label="Total ARV Analyzed" value={fmtK(totalARV)} topColor="#3B6D11" />
        <StatCard label="Avg ARV" value={offers.length ? fmtK(totalARV / offers.length) : '—'} topColor="#2D6FAF" />
      </div>

      <SectionBar>All Offers ({offers.length})</SectionBar>

      {offers.length === 0 ? (
        <EmptyState icon="⊞" text="No saved offers yet. Use the Cash Offer Calc tab to generate and save proposals." />
      ) : (
        <Card style={{ padding: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F0EDE6' }}>
                {['Address', 'ARV', 'Cash Offer', 'As-Is Net', 'Retail Net', 'Repairs', 'Saved', ''].map(h => (
                  <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, letterSpacing: 0.8, color: '#6b7280', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {offers.map((o, i) => {
                // Recalculate the three options from stored values
                const arv = parseFloat(o.arv) || 0
                const reno = (o.repair_items || []).reduce((s, r) => s + (parseFloat(r.cost) || 0), 0)
                const commCash = (parseFloat(o.commission_cash_pct) || 9) / 100
                const commList = (parseFloat(o.commission_list_pct) || 6) / 100
                const holdCashPct = parseFloat(o.holding_cash_pct) || 0.75
                const holdCashMo = parseFloat(o.holding_cash_months) || 6
                const holdOpt2Pct = parseFloat(o.holding_opt2_pct) || 0.5
                const holdOpt2Mo = parseFloat(o.holding_opt2_months) || 3
                const holdOpt3Pct = parseFloat(o.holding_opt3_pct) || 0.5
                const holdOpt3Mo = parseFloat(o.holding_opt3_months) || 6
                const profitPct = (parseFloat(o.profit_margin) || 15) / 100

                const cashOffer = o.cash_offer_override
                  ? parseFloat(o.cash_offer_override)
                  : arv - reno - (commCash * arv) - ((holdCashPct / 100) * holdCashMo * arv) - (o.profit_margin_override ? parseFloat(o.profit_margin_override) : arv * profitPct)

                const asisDiscount = (parseFloat(o.asis_pct) || 50) / 100
                const asisVal = o.asis_override ? parseFloat(o.asis_override) : arv - (asisDiscount * reno)
                const opt2Net = asisVal - (commList * asisVal) - ((holdOpt2Pct / 100) * holdOpt2Mo * arv)
                const opt3Net = arv - reno - (commList * arv) - ((holdOpt3Pct / 100) * holdOpt3Mo * arv)

                return (
                  <tr key={o.id} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAF8', borderTop: '0.5px solid #F0EDE6' }}>
                    <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600, maxWidth: 220 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.address || '—'}</div>
                      {(o.beds || o.baths) && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{[o.beds && `${o.beds}bd`, o.baths && `${o.baths}ba`, o.sqft && `${parseInt(o.sqft).toLocaleString()} sqft`].filter(Boolean).join(' · ')}</div>}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 13, fontFamily: 'monospace', fontWeight: 700 }}>{fmt(arv)}</td>
                    <td style={{ padding: '10px 16px', fontSize: 13, fontFamily: 'monospace', fontWeight: 700, color: '#3B6D11' }}>{fmt(cashOffer)}</td>
                    <td style={{ padding: '10px 16px', fontSize: 13, fontFamily: 'monospace', color: '#2D6FAF' }}>~{fmt(opt2Net)}</td>
                    <td style={{ padding: '10px 16px', fontSize: 13, fontFamily: 'monospace', color: '#D97825' }}>~{fmt(opt3Net)}</td>
                    <td style={{ padding: '10px 16px', fontSize: 13, fontFamily: 'monospace', color: '#6b7280' }}>{reno > 0 ? fmt(reno) : '—'}</td>
                    <td style={{ padding: '10px 16px', fontSize: 11, color: '#9ca3af' }}>{new Date(o.created_at).toLocaleDateString()}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => onLoadCalc(o)} style={{ background: 'none', border: 'none', color: '#B8892A', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>Load</button>
                        <button onClick={() => setPreview(o)} style={{ background: 'none', border: 'none', color: '#2D6FAF', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>View</button>
                        <button onClick={() => del(o.id)} style={{ background: 'none', border: 'none', color: '#B91C1C', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>Delete</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}

      {preview && <OfferPreviewModal offer={preview} onClose={() => setPreview(null)} onLoad={() => { setPreview(null); onLoadCalc(preview) }} />}
    </PageWrap>
  )
}

function OfferPreviewModal({ offer, onClose, onLoad }) {
  const repairs = offer.repair_items || []
  const totalRepairs = repairs.reduce((s, r) => s + (parseFloat(r.cost) || 0), 0)

  return (
    <Modal title={offer.address || 'Offer Details'} onClose={onClose} width={580}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Summary grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {[['ARV', fmt(offer.arv), '#B8892A'], ['Total Repairs', fmt(totalRepairs), '#2D6FAF'], ['Profit Margin', `${offer.profit_margin || 15}%`, '#3B6D11']].map(([l, v, c]) => (
            <div key={l} style={{ background: '#FAFAF8', borderRadius: 6, padding: '10px 12px', borderTop: `3px solid ${c}` }}>
              <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8 }}>{l}</div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: c, marginTop: 2 }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Repair items */}
        {repairs.length > 0 && (
          <>
            <SectionBar>Repair Items</SectionBar>
            <div style={{ fontSize: 13 }}>
              {repairs.map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F0EDE6' }}>
                  <span style={{ color: '#6b7280' }}>{r.name}</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{fmt(r.cost)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontWeight: 700 }}>
                <span>Total</span><span style={{ fontFamily: 'monospace' }}>{fmt(totalRepairs)}</span>
              </div>
            </div>
          </>
        )}

        <div style={{ fontSize: 11, color: '#9ca3af' }}>Saved {new Date(offer.created_at).toLocaleString()}</div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="outline" onClick={onClose}>Close</Btn>
          <Btn onClick={onLoad}>Load into Calculator</Btn>
        </div>
      </div>
    </Modal>
  )
}
