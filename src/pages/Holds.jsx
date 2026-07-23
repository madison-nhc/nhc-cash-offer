import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { PageWrap, SectionBar, Card, Badge, EmptyState, LoadingSpinner, fmt, fmtK, useSort, SortTh } from '../components/ui.jsx'
import PropertyDrawer from '../components/PropertyDrawer.jsx'
import ProposalModal from '../components/ProposalModal.jsx'
import KanbanBoard, { cardPill, cardChip, cardBtn, MoneyBurst, shortStreet } from '../components/KanbanBoard.jsx'

const BOARD_COLUMNS = [
  { key:'Vacant',        color:'#D97825' },  // between tenants, needs a turn — expenses live on the Rent tab
  { key:'Rent Ready',    color:'#B8892A' },
  { key:'Rental Listed', color:'#2D6FAF' },
  { key:'Leased',        color:'#3B6D11' },  // drop opens drawer on Rent tab to set up the lease
]

// Exit moves live in the drag tray (appears while dragging a card)
const PROMO_ZONES = [
  { key:'Listed', label:'LIST FOR SALE', emoji:'\u{1FAA7}', color:'#2D6FAF' },
]

function MiniStat({ label, value, sub, color = '#2C2C2C' }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
      <div style={{ fontSize:10, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.7 }}>{label}</div>
      <div style={{ fontSize:22, fontWeight:700, fontFamily:'monospace', color }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize:10, color:'#9ca3af' }}>{sub}</div>}
    </div>
  )
}

export default function Holds({ isAgentRole=false, currentUserEmail=null }) {
  const mobile = useIsMobile()
  const [properties, setProperties] = useState([])
  const [leases, setLeases] = useState([])
  const [loans, setLoans] = useState([])
  const [mailings, setMailings] = useState([])
  const [loading, setLoading] = useState(true)
  const [drawer, setDrawer] = useState(null)
  const [drawerTab, setDrawerTab] = useState('analyzer')
  const [autoOpenLease, setAutoOpenLease] = useState(false)
  const [proposal, setProposal] = useState(null)
  const [view, setView] = useState('board')
  const [burst, setBurst] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    let propQuery = supabase.from('cashoffer_properties').select('*').eq('type', 'Hold').order('purchase_date', { ascending: false })
    if (isAgentRole) propQuery = propQuery.eq('agent_email', currentUserEmail)
    const [{ data: p }, { data: l }, { data: ln }, { data: m }] = await Promise.all([
      propQuery,
      supabase.from('cashoffer_leases').select('*').in('status', ['Active', 'Month-to-Month']),
      supabase.from('cashoffer_loans').select('*').eq('is_active', true),
      supabase.from('cashoffer_mailings').select('id,campaign_name,drop_date').order('drop_date', { ascending: false }),
    ])
    setProperties(p || [])
    setLeases(l || [])
    setLoans(ln || [])
    setMailings(m || [])
    setLoading(false)
  }

  // Monthly rent = sum of all active leases for a property
  function monthlyRent(propId) {
    return leases.filter(l => l.property_id === propId).reduce((s, l) => s + (parseFloat(l.rent_amount) || 0), 0)
  }
  // Compute monthly payment from loan inputs (mirrors LoanTracker amortization engine)
  function computePayment(loan) {
    if (!loan) return 0
    if (loan.monthly_payment) return parseFloat(loan.monthly_payment)
    const P = parseFloat(loan.loan_amount) || 0
    const r = (parseFloat(loan.interest_rate) || 0) / 100 / 12
    const n = parseInt(loan.loan_term_months) || 0
    if (!P || !n) return 0
    if (r === 0) return P / n
    return P * (r * Math.pow(1+r,n)) / (Math.pow(1+r,n)-1)
  }
  function loanPayment(propId) {
    const loan = loans.find(l => l.property_id === propId)
    return computePayment(loan)
  }

  const boardItems = properties.filter(p => p.stage !== 'Sold' && p.stage !== 'Listed')

  const columnFor = p => BOARD_COLUMNS.some(c => c.key === p.stage) ? p.stage : 'Rent Ready'

  async function handleDrop(id, columnKey) {
    const { error } = await supabase.from('cashoffer_properties').update({ stage: columnKey }).eq('id', id)
    if (error) { alert(`Could not move deal: ${error.message}`); load(); return }
    if (columnKey === 'Leased' || columnKey === 'Vacant') {
      // Leased: set up the lease. Vacant: log turn expenses. Both live on the Rent tab.
      const { data } = await supabase.from('cashoffer_properties').select('*').eq('id', id).single()
      if (data) { setDrawerTab('rent'); setAutoOpenLease(false); setDrawer(data) }
    }
    load()
  }

  function openDrawer(p) { setDrawerTab('rent'); setAutoOpenLease(false); setDrawer(p) }

  async function handlePromote(id, zoneKey, coords) {
    if (zoneKey === 'Listed') {
      // Sale exit — property leaves this board and appears on Listings (Owned)
      const { error } = await supabase.from('cashoffer_properties').update({ stage:'Listed' }).eq('id', id)
      if (error) { alert(`Could not move deal: ${error.message}`); load(); return }
      setBurst({ ...coords, key: Date.now() })
      setTimeout(() => setBurst(null), 1600)
      load()
    }
  }

  function holdCardContent(p) {
    const rent = monthlyRent(p.id)
    const payment = loanPayment(p.id)
    const lease = leases.find(l => l.property_id === p.id)
    return (
      <>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'#2C2C2C', minWidth:0 }}>{shortStreet(p.address) || 'New Property'}</div>
          <div style={{ fontSize:11, color:'#6b7280', flexShrink:0 }}>{p.owner || 'BPV'}</div>
        </div>
        <div style={{ fontSize:10, color:'#9ca3af', marginTop:1, marginBottom:8 }}>{p.address?.split(',').slice(1,3).join(',').trim() || ''}</div>
        {(rent > 0 || payment > 0) ? (
          <div style={{ display:'flex', gap:4, alignItems:'center', justifyContent:'center', marginBottom:8, flexWrap:'wrap' }}>
            {rent > 0 && <span style={cardChip('#3B6D11','#EEF5E7','#CBDDB8')}>Rent {fmt(rent)}/mo</span>}
            {payment > 0 && <span style={cardChip('#D97825','#FBF0E4','#F2D9BE')}>Loan {fmt(payment)}/mo</span>}
          </div>
        ) : null}
        {lease?.tenant_name ? (
          <div style={{ fontSize:11.5, color:'#3B6D11', fontWeight:600, textAlign:'center', margin:'2px 0 8px' }}>{lease.tenant_name}</div>
        ) : (
          <div style={{ fontSize:10, color:'#9ca3af', fontStyle:'italic', textAlign:'center', margin:'2px 0 8px' }}>No lease yet</div>
        )}
        <button style={cardBtn} onClick={e => { e.stopPropagation(); setDrawerTab('rent'); setAutoOpenLease(true); setDrawer(p) }}>🔑 Lease Dashboard</button>
      </>
    )
  }

  const totalMonthlyRent    = properties.reduce((s, p) => s + monthlyRent(p.id), 0)
  const totalLoanPayments   = properties.reduce((s, p) => s + loanPayment(p.id), 0)
  const totalMonthlyCashFlow = totalMonthlyRent - totalLoanPayments

  const filtered = properties

  const { sorted, sortKey, sortDir, toggleSort } = useSort(filtered, 'purchase_date', 'desc', {
    rent: p => monthlyRent(p.id),
    payment: p => loanPayment(p.id),
    cashflow: p => monthlyRent(p.id) - loanPayment(p.id),
  })

  if (loading) return <LoadingSpinner />

  return (
    <PageWrap pad={!mobile}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, color:'#2C2C2C' }}>Holds</h1>
          <p style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>Rental properties · loan and rent tracking</p>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display:'grid', gridTemplateColumns: mobile ? '1fr 1fr' : 'repeat(4,1fr)', gap:12, marginBottom:24 }}>
        {[
          { label:'Active Holds',     value: properties.length,                                                              color:'#B8892A' },
          { label:'Monthly Rent',     value: totalMonthlyRent > 0 ? fmtK(totalMonthlyRent) : '—',                        color:'#3B6D11' },
          { label:'Loan Payments',    value: totalLoanPayments > 0 ? fmtK(totalLoanPayments) : '—',                      color:'#D97825' },
          { label:'Monthly Cash Flow',value: totalMonthlyCashFlow !== 0 ? fmtK(totalMonthlyCashFlow) : '—',              color: totalMonthlyCashFlow >= 0 ? '#3B6D11' : '#B91C1C' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background:'#fff', border:'0.5px solid #D6D2CA', borderRadius:8, borderTop:`3px solid ${color}`, padding:'12px 16px' }}>
            <div style={{ fontSize:10, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.8, marginBottom:6 }}>{label}</div>
            <div style={{ fontSize:24, fontWeight:700, color, fontFamily:'monospace' }}>{value}</div>
          </div>
        ))}
      </div>



      {!mobile && (
        <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:14 }}>
          <div style={{ display:'flex', gap:2 }}>
            {[['board','Board'],['table','Table']].map(([v,l]) => (
              <button key={v} onClick={() => setView(v)} style={{ padding:'6px 14px', border:'none', borderRadius:6, cursor:'pointer', background: view === v ? '#2C2C2C' : '#F0EDE6', color: view === v ? '#fff' : '#6b7280', fontSize:12, fontWeight: view === v ? 700 : 400, fontFamily:'inherit' }}>{l}</button>
            ))}
          </div>
        </div>
      )}

      {view === 'board' && !mobile ? (
        boardItems.length === 0 ? (
          <EmptyState icon="○" text="No hold properties in the working portfolio. Set deal type to Hold on a property in the Analyzer." />
        ) : (
          <>
            <KanbanBoard
              columnWidth={320}
              columns={BOARD_COLUMNS}
              items={boardItems}
              columnFor={columnFor}
              onOpen={openDrawer}
              onDrop={handleDrop}
              renderCard={holdCardContent}
              promoZones={PROMO_ZONES}
              onPromote={handlePromote}
            />
            {burst && <MoneyBurst key={burst.key} x={burst.x} y={burst.y} />}
          </>
        )
      ) : (
      <>
      <SectionBar>Hold Properties ({filtered.length})</SectionBar>

      {filtered.length === 0 ? (
        <EmptyState icon="○" text="No hold properties yet. Set deal type to Hold on a property in the Analyzer." />
      ) : (
        <Card style={{ padding:0 }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'#F0EDE6' }}>
                <SortTh sortKeyName="address"       {...{sortKey,sortDir,toggleSort}}>Address</SortTh>
                <SortTh sortKeyName="owner"         {...{sortKey,sortDir,toggleSort}}>Owner</SortTh>
                <SortTh sortKeyName="purchase_price"  {...{sortKey,sortDir,toggleSort}}>Purchase</SortTh>
                <SortTh sortKeyName="rent"          {...{sortKey,sortDir,toggleSort}}>Monthly Rent</SortTh>
                <SortTh sortKeyName="payment"       {...{sortKey,sortDir,toggleSort}}>Loan Pmt</SortTh>
                <SortTh sortKeyName="cashflow"      {...{sortKey,sortDir,toggleSort}}>Cash Flow</SortTh>
                <SortTh sortKeyName="purchase_date" {...{sortKey,sortDir,toggleSort}}>Purchased</SortTh>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, i) => {
                const rent      = monthlyRent(p.id)
                const payment   = loanPayment(p.id)
                const cashflow  = rent - payment
                return (
                  <tr key={p.id} onClick={() => openDrawer(p)}
                    style={{ background:i%2===0?'#fff':'#FAFAF8', borderTop:'0.5px solid #F0EDE6', cursor:'pointer' }}
                    onMouseEnter={e=>e.currentTarget.style.background='#fef9f0'}
                    onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'#fff':'#FAFAF8'}>
                    <td style={{ padding:'10px 14px', fontSize:13, fontWeight:600 }}>
                      <div>{p.address}</div>
                      {p.converted_to_sale && <div style={{ fontSize:10, color:'#9ca3af', marginTop:2 }}>Converted to Sale</div>}
                    </td>
                    <td style={{ padding:'10px 14px', fontSize:12, color:'#6b7280' }}>{p.owner || 'BPV'}</td>
                    <td style={{ padding:'10px 14px', fontSize:13, fontFamily:'monospace' }}>{fmt(p.purchase_price) || '—'}</td>
                    <td style={{ padding:'10px 14px', fontSize:13, fontFamily:'monospace', color:'#3B6D11', fontWeight: rent > 0 ? 700 : 400 }}>{rent > 0 ? fmt(rent) : '—'}</td>
                    <td style={{ padding:'10px 14px', fontSize:13, fontFamily:'monospace', color:'#D97825' }}>{payment > 0 ? fmt(payment) : '—'}</td>
                    <td style={{ padding:'10px 14px', fontSize:13, fontFamily:'monospace', fontWeight:700, color: cashflow >= 0 ? '#3B6D11' : '#B91C1C' }}>
                      {rent > 0 || payment > 0 ? `${cashflow >= 0 ? '+' : ''}${fmt(cashflow)}` : '—'}
                    </td>
                    <td style={{ padding:'10px 14px', fontSize:12, color:'#9ca3af' }}>
                      {p.purchase_date ? new Date(p.purchase_date+'T12:00:00').toLocaleDateString() : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}

      </>
      )}

      <PropertyDrawer property={drawer} open={!!drawer} onClose={() => setDrawer(null)} onSave={() => load()} mailings={mailings} onViewOffer={p => setProposal(p)} initialTab={drawerTab} openRentTracker={autoOpenLease} isAgentRole={isAgentRole} currentUserEmail={currentUserEmail} />
      {proposal && <ProposalModal property={proposal} onClose={() => setProposal(null)} />}
    </PageWrap>
  )
}




