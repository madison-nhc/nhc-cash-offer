import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { PageWrap, SectionBar, fmtK } from '../components/ui.jsx'

function ClickCard({ label, value, sub, topColor = '#B8892A', onClick }) {
  const [hover, setHover] = useState(false)
  return (
    <div onClick={onClick} onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)} style={{
      background:'#fff', borderRadius:8, border:'0.5px solid #D6D2CA',
      borderTop:`3px solid ${topColor}`, padding:'14px 16px',
      cursor:'pointer', transition:'box-shadow 0.15s',
      boxShadow: hover ? '0 2px 12px rgba(0,0,0,0.1)' : 'none'
    }}>
      <div style={{ fontSize:11, fontWeight:600, letterSpacing:1.2, color:'#6b7280', textTransform:'uppercase', marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:26, fontWeight:700, color:'#2C2C2C', lineHeight:1 }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize:11, color:'#6b7280', marginTop:4 }}>{sub}</div>}
    </div>
  )
}

export default function Dashboard({ onNavigate }) {
  const mobile = useIsMobile()
  const [stats, setStats] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    // disposition is the single source of truth for routing/reporting —
    // investment_type and status are legacy columns, not used here.
    const [{ data: properties }, { data: income }, { data: mailings }] = await Promise.all([
      supabase.from('cashoffer_properties').select('*'),
      supabase.from('cashoffer_property_income').select('rent_received, expenses'),
      supabase.from('cashoffer_mailings').select('id, list_size, mailer_cost'),
    ])

    const props = properties || []

    // ── Analyzer ──────────────────────────────────────────────────────────
    // "Active" mirrors Analyzer.jsx's isActive(): no disposition yet, or a
    // listing with no close date, or a flip/hold with no sale_date.
    const isActive = p => {
      if (!p.disposition) return true
      if (p.disposition === 'listing' && !p.disposition_date) return true
      if ((p.disposition === 'flip' || p.disposition === 'hold') && !p.sale_date) return true
      return false
    }
    const totalProperties = props.length
    const activePipeline  = props.filter(isActive).length
    const analyzing       = props.filter(p => !p.disposition).length

    // ── NHC Deals — listing / wholesale / flip, commission_earned only ──
    const listings  = props.filter(p => p.disposition === 'listing')
    const wholesale = props.filter(p => p.disposition === 'wholesale')
    const nhcFlips   = props.filter(p => p.disposition === 'flip')
    const nhcCommission = [...listings, ...wholesale, ...nhcFlips]
      .reduce((s,p) => s+(parseFloat(p.commission_earned)||0), 0)
    const activeListings = listings.filter(p => !p.disposition_date).length

    // ── BPV Investments — flip / hold / wholesale ──────────────────────
    const bpvFlips = props.filter(p => p.disposition === 'flip')
    const bpvHolds = props.filter(p => p.disposition === 'hold')
    const activeFlips    = bpvFlips.filter(p => !p.sale_date).length
    const completedFlips = bpvFlips.filter(p => p.sale_date)
    const bpvFlipProfit  = completedFlips.reduce((s,p) => {
      const cost = (parseFloat(p.purchase_price)||0)+(parseFloat(p.closing_costs)||0)+(parseFloat(p.rehab_cost)||0)
      return s + (parseFloat(p.sale_price)||0) - cost
    }, 0)
    const activeHolds = bpvHolds.filter(p => !p.sale_date).length
    const totalRent   = (income||[]).reduce((s,i) => s+(parseFloat(i.rent_received)||0), 0)
    const totalExp    = (income||[]).reduce((s,i) => s+(parseFloat(i.expenses)||0), 0)
    const holdNet     = totalRent - totalExp

    // ── Mailing Tracker — outcomes derived from properties.mailing_id ───
    const totalPieces = (mailings||[]).reduce((s,m) => s+(m.list_size||0), 0)
    const totalSpend  = (mailings||[]).reduce((s,m) => s+(parseFloat(m.mailer_cost)||0), 0)
    const outcomes    = props.filter(p => p.mailing_id)
    const dealsClosed = outcomes.filter(p => ['listing','wholesale','flip','hold'].includes(p.disposition)).length
    const mailingRevenue = outcomes.reduce((s,p) =>
      s+(parseFloat(p.commission_earned)||0)+(parseFloat(p.wholesale_fee)||0), 0)

    // ── Package Deals ────────────────────────────────────────────────────
    const packageProps = props.filter(p => p.package_id)
    const activePackageIds = new Set(
      packageProps.filter(isActive).map(p => p.package_id)
    )

    setStats({
      totalProperties, activePipeline, analyzing,
      nhcCommission, activeListings, listingsCount: listings.length,
      wholesaleCount: wholesale.length, nhcFlipsCount: nhcFlips.length,
      activeFlips, completedFlips: completedFlips.length, bpvFlipProfit,
      activeHolds, holdNet,
      totalPieces, totalSpend, dealsClosed, mailingRevenue,
      activePackages: activePackageIds.size, packagePropsCount: packageProps.length,
    })
  }

  return (
    <PageWrap pad={!mobile}>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:22, fontWeight:700, color:'#2C2C2C', marginBottom:4 }}>NHC Command Center</h1>
        <p style={{ fontSize:13, color:'#6b7280' }}>New Home Collective · BE Property Ventures</p>
      </div>

      {/* Analyzer */}
      <SectionBar>Analyzer</SectionBar>
      <div style={{ display:'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(3,1fr)', gap:12, marginTop:12, marginBottom:20 }}>
        <ClickCard label="Total Properties" value={stats?.totalProperties ?? '—'} topColor="#B8892A" onClick={()=>onNavigate('analyzer')} />
        <ClickCard label="Active Pipeline" value={stats?.activePipeline ?? '—'} sub="not sold or passed" topColor="#2D6FAF" onClick={()=>onNavigate('analyzer')} />
        <ClickCard label="Analyzing" value={stats?.analyzing ?? '—'} sub="awaiting disposition" topColor="#D97825" onClick={()=>onNavigate('analyzer')} />
      </div>

      {/* NHC Deals */}
      <SectionBar>NHC Deals</SectionBar>
      <div style={{ display:'grid', gridTemplateColumns: mobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap:12, marginTop:12, marginBottom:20 }}>
        <ClickCard label="NHC Commission" value={fmtK(stats?.nhcCommission)} sub="listings + wholesale + flips" topColor="#B8892A" onClick={()=>onNavigate('nhc')} />
        <ClickCard label="Active Listings" value={stats?.activeListings ?? '—'} topColor="#3B6D11" onClick={()=>onNavigate('nhc')} />
        <ClickCard label="Wholesale Deals" value={stats?.wholesaleCount ?? '—'} topColor="#6b21a8" onClick={()=>onNavigate('nhc')} />
        <ClickCard label="Flips (NHC side)" value={stats?.nhcFlipsCount ?? '—'} topColor="#D97825" onClick={()=>onNavigate('nhc')} />
      </div>

      {/* BPV Investments */}
      <SectionBar>BPV Investments</SectionBar>
      <div style={{ display:'grid', gridTemplateColumns: mobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap:12, marginTop:12, marginBottom:20 }}>
        <ClickCard label="Active Flips" value={stats?.activeFlips ?? '—'} topColor="#D97825" onClick={()=>onNavigate('bpv')} />
        <ClickCard label="Flip Profit" value={stats?.completedFlips ? fmtK(stats?.bpvFlipProfit) : '—'} sub={`${stats?.completedFlips||0} completed flips`} topColor={stats?.bpvFlipProfit >= 0 ? '#3B6D11' : '#B91C1C'} onClick={()=>onNavigate('bpv')} />
        <ClickCard label="Active Holds" value={stats?.activeHolds ?? '—'} topColor="#2D6FAF" onClick={()=>onNavigate('bpv')} />
        <ClickCard label="Hold Net Income" value={fmtK(stats?.holdNet)} sub="rent minus expenses" topColor={stats?.holdNet >= 0 ? '#3B6D11' : '#B91C1C'} onClick={()=>onNavigate('bpv')} />
      </div>

      {/* Mailing Tracker */}
      <SectionBar>Mailing Tracker</SectionBar>
      <div style={{ display:'grid', gridTemplateColumns: mobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap:12, marginTop:12, marginBottom:20 }}>
        <ClickCard label="Mailers Sent" value={stats?.totalPieces?.toLocaleString() ?? '—'} topColor="#B8892A" onClick={()=>onNavigate('mailings')} />
        <ClickCard label="Total Spend" value={stats?.totalSpend ? fmtK(stats.totalSpend) : '—'} topColor="#D97825" onClick={()=>onNavigate('mailings')} />
        <ClickCard label="Deals Closed" value={stats?.dealsClosed ?? '—'} sub="from mailing outcomes" topColor="#3B6D11" onClick={()=>onNavigate('mailings')} />
        <ClickCard label="Revenue" value={fmtK(stats?.mailingRevenue)} topColor="#3B6D11" onClick={()=>onNavigate('mailings')} />
      </div>

      {/* Package Deals */}
      <SectionBar>Package Deals</SectionBar>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12, marginTop:12, marginBottom:24 }}>
        <ClickCard label="Active Packages" value={stats?.activePackages ?? '—'} topColor="#6b21a8" onClick={()=>onNavigate('analyzer')} />
        <ClickCard label="Properties Tracked" value={stats?.packagePropsCount ?? '—'} sub="across all packages" topColor="#6b21a8" onClick={()=>onNavigate('analyzer')} />
      </div>
    </PageWrap>
  )
}
