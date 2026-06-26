import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { PageWrap, Card, SectionBar, fmt, fmtK, Badge } from '../components/ui.jsx'

const STATUS_COLORS = {
  analyzing:'#B8892A', offer_made:'#D97825', under_contract:'#2D6FAF',
  purchased:'#6b21a8', active:'#3B6D11', sold:'#2C2C2C', passed:'#9ca3af',
  active_listing:'#2D6FAF', pending:'#D97825', closed:'#3B6D11'
}
const STATUS_LABELS = {
  analyzing:'Analyzing', offer_made:'Offer Made', under_contract:'Under Contract',
  purchased:'Purchased', active:'Active', sold:'Sold', passed:'Passed',
  active_listing:'Active', pending:'Pending', closed:'Closed'
}

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
  const [stats, setStats] = useState(null)
  const [recent, setRecent] = useState([])

  useEffect(() => { load() }, [])

  async function load() {
    const [
      { data: properties },
      { data: income },
      { data: mailings },
      { data: mailingDeals },
      { data: packages },
      { data: packageProps },
    ] = await Promise.all([
      supabase.from('properties').select('*').order('updated_at', { ascending: false }),
      supabase.from('property_income').select('rent_received, expenses'),
      supabase.from('mailings').select('id, list_size, mailer_cost'),
      supabase.from('mailing_deals').select('id, address, status, commission_earned, created_at'),
      supabase.from('package_deals').select('id, status'),
      supabase.from('package_deal_properties').select('id'),
    ])

    const props = properties || []

    // Analyzer stats
    const analyzing     = props.filter(p => p.status === 'analyzing').length
    const pipeline      = props.filter(p => !['sold','passed'].includes(p.status)).length
    const totalAnalyzed = props.length

    // Investment stats
    const flips        = props.filter(p => p.investment_type === 'flip')
    const holds        = props.filter(p => p.investment_type === 'hold')
    const soldFlips    = flips.filter(p => p.sale_price)
    const bpvProfit    = soldFlips.reduce((s, p) => {
      const cost = (parseFloat(p.purchase_price)||0)+(parseFloat(p.closing_costs)||0)+(parseFloat(p.rehab_cost)||0)
      return s + (parseFloat(p.sale_price)||0) - cost
    }, 0)
    const totalRent    = (income||[]).reduce((s,i) => s+(parseFloat(i.rent_received)||0), 0)
    const totalExp     = (income||[]).reduce((s,i) => s+(parseFloat(i.expenses)||0), 0)
    const nhcComm      = props.reduce((s,p) => s+(parseFloat(p.commission_earned)||0), 0)

    // Mailing stats
    const totalPieces  = (mailings||[]).reduce((s,m) => s+(m.list_size||0), 0)
    const totalSpend   = (mailings||[]).reduce((s,m) => s+(parseFloat(m.mailer_cost)||0), 0)
    const mdClosed     = (mailingDeals||[]).filter(d => d.status === 'closed')
    const mdComm       = mdClosed.reduce((s,d) => s+(parseFloat(d.commission_earned)||0), 0)

    // Package stats
    const activePkgs   = (packages||[]).filter(p => ['analyzing','active'].includes(p.status)).length

    setStats({
      analyzing, pipeline, totalAnalyzed,
      flips: flips.length, holds: holds.length, soldFlips: soldFlips.length,
      bpvProfit, nhcComm, totalRent, totalExp, netHold: totalRent - totalExp,
      totalPieces, totalSpend, mdClosed: mdClosed.length, mdComm,
      activePkgs, totalPackageProps: (packageProps||[]).length,
    })

    // Recent activity from properties + mailing deals
    const activity = [
      ...props.filter(p => p.address).map(p => ({
        type: p.investment_type || 'property',
        label: p.address,
        sub: p.status,
        ts: p.updated_at,
        dest: p.investment_type ? 'investments' : 'analyzer'
      })),
      ...(mailingDeals||[]).filter(d => d.address).map(d => ({
        type: 'mailing deal',
        label: d.address,
        sub: d.status,
        ts: d.created_at,
        dest: 'mailings'
      })),
    ].sort((a,b) => new Date(b.ts) - new Date(a.ts)).slice(0, 8)
    setRecent(activity)
  }

  const TYPE_COLORS = { property:'#B8892A', flip:'#D97825', hold:'#2D6FAF', 'mailing deal':'#3B6D11' }

  return (
    <PageWrap>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:22, fontWeight:700, color:'#2C2C2C', marginBottom:4 }}>NHC Command Center</h1>
        <p style={{ fontSize:13, color:'#6b7280' }}>New Home Collective · BE Property Ventures</p>
      </div>

      {/* P&L Banner */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:24, padding:'16px 20px', background:'#2C2C2C', borderRadius:10 }}>
        {[
          ['NHC Commission', fmtK(stats?.nhcComm), 'all properties', '#B8892A'],
          ['BPV Flip Profit', fmtK(stats?.bpvProfit), `${stats?.soldFlips||0} completed flips`, stats?.bpvProfit >= 0 ? '#3B6D11' : '#B91C1C'],
          ['BPV Hold Net',   fmtK(stats?.netHold),  'rent minus expenses', stats?.netHold >= 0 ? '#3B6D11' : '#B91C1C'],
        ].map(([l,v,s,c]) => (
          <div key={l}>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:1.5, color:'#6b7280', textTransform:'uppercase', marginBottom:4 }}>{l}</div>
            <div style={{ fontSize:28, fontWeight:800, color:c, lineHeight:1 }}>{v ?? '—'}</div>
            <div style={{ fontSize:11, color:'#6b7280', marginTop:3 }}>{s}</div>
          </div>
        ))}
      </div>

      {/* Analyzer */}
      <SectionBar>Analyzer</SectionBar>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginTop:12, marginBottom:20 }}>
        <ClickCard label="Total Properties" value={stats?.totalAnalyzed ?? '—'} topColor="#B8892A" onClick={()=>onNavigate('analyzer')} />
        <ClickCard label="Active Pipeline" value={stats?.pipeline ?? '—'} sub="not sold or passed" topColor="#2D6FAF" onClick={()=>onNavigate('analyzer')} />
        <ClickCard label="Analyzing" value={stats?.analyzing ?? '—'} sub="awaiting offer" topColor="#D97825" onClick={()=>onNavigate('analyzer')} />
      </div>

      {/* Investments */}
      <SectionBar>Investments</SectionBar>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginTop:12, marginBottom:20 }}>
        <ClickCard label="Active Flips" value={stats?.flips ?? '—'} topColor="#D97825" onClick={()=>onNavigate('investments')} />
        <ClickCard label="Completed Flips" value={stats?.soldFlips ?? '—'} topColor="#3B6D11" onClick={()=>onNavigate('investments')} />
        <ClickCard label="Active Holds" value={stats?.holds ?? '—'} topColor="#2D6FAF" onClick={()=>onNavigate('investments')} />
        <ClickCard label="Hold Net Income" value={fmtK(stats?.netHold)} sub="all time" topColor={stats?.netHold >= 0 ? '#3B6D11' : '#B91C1C'} onClick={()=>onNavigate('investments')} />
      </div>

      {/* Mailing */}
      <SectionBar>Mailing Tracker</SectionBar>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginTop:12, marginBottom:20 }}>
        <ClickCard label="Mailers Sent" value={stats?.totalPieces?.toLocaleString() ?? '—'} topColor="#B8892A" onClick={()=>onNavigate('mailings')} />
        <ClickCard label="Total Spend" value={stats?.totalSpend ? fmtK(stats.totalSpend) : '—'} topColor="#D97825" onClick={()=>onNavigate('mailings')} />
        <ClickCard label="Deals Closed" value={stats?.mdClosed ?? '—'} topColor="#3B6D11" onClick={()=>onNavigate('mailings')} />
        <ClickCard label="Commission" value={fmtK(stats?.mdComm)} topColor="#3B6D11" onClick={()=>onNavigate('mailings')} />
      </div>

      {/* Package Deals */}
      <SectionBar>Package Deals</SectionBar>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12, marginTop:12, marginBottom:24 }}>
        <ClickCard label="Active Packages" value={stats?.activePkgs ?? '—'} topColor="#6b21a8" onClick={()=>onNavigate('analyzer')} />
        <ClickCard label="Properties Tracked" value={stats?.totalPackageProps ?? '—'} sub="across all packages" topColor="#6b21a8" onClick={()=>onNavigate('analyzer')} />
      </div>

      {/* Recent Activity */}
      {recent.length > 0 && (
        <>
          <SectionBar>Recent Activity</SectionBar>
          <Card style={{ marginTop:12, padding:0 }}>
            {recent.map((item, i) => (
              <div key={i} onClick={()=>onNavigate(item.dest)} style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                padding:'11px 16px', cursor:'pointer',
                borderBottom: i < recent.length-1 ? '1px solid #F0EDE6' : 'none',
                transition:'background 0.1s'
              }}
              onMouseEnter={e=>e.currentTarget.style.background='#fef9f0'}
              onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <Badge color={TYPE_COLORS[item.type]||'#B8892A'}>{item.type}</Badge>
                  <span style={{ fontSize:13, color:'#2C2C2C', fontWeight:500 }}>{item.label}</span>
                </div>
                <span style={{ fontSize:11, color:'#9ca3af', textTransform:'capitalize' }}>
                  {STATUS_LABELS[item.sub] || item.sub?.replace(/_/g,' ')}
                </span>
              </div>
            ))}
          </Card>
        </>
      )}
    </PageWrap>
  )
}
