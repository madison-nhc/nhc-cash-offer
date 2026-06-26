import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { PageWrap, StatCard, Card, SectionBar, fmt, fmtK, Badge } from '../components/ui.jsx'

export default function Dashboard({ onNavigate }) {
  const [stats, setStats] = useState(null)
  const [recentActivity, setRecentActivity] = useState([])

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    const [{ data: mailings }, { data: deals }, { data: props }, { data: holdIncome }, { data: packages }] = await Promise.all([
      supabase.from('mailings').select('id, drop_date, list_size'),
      supabase.from('mailing_deals').select('id, status, sale_price, commission_earned'),
      supabase.from('investment_properties').select('id, property_type, status, purchase_price, sale_price, arv, rehab_cost'),
      supabase.from('hold_income').select('rent_received, expenses'),
      supabase.from('package_deals').select('id, status, total_arv, total_purchase'),
    ])

    const totalMailersSent = (mailings || []).reduce((s, m) => s + (m.list_size || 0), 0)
    const dealsSourced = (deals || []).length
    const closedDeals = (deals || []).filter(d => d.status === 'closed').length
    const totalCommission = (deals || []).reduce((s, d) => s + (parseFloat(d.commission_earned) || 0), 0)

    const flips = (props || []).filter(p => p.property_type === 'flip')
    const holds = (props || []).filter(p => p.property_type === 'hold')
    const completedFlips = flips.filter(f => f.status === 'sold')
    const totalFlipProfit = completedFlips.reduce((s, f) => {
      const profit = (f.sale_price || 0) - (f.purchase_price || 0) - (f.rehab_cost || 0)
      return s + profit
    }, 0)

    const totalRent = (holdIncome || []).reduce((s, h) => s + (parseFloat(h.rent_received) || 0), 0)
    const totalExpenses = (holdIncome || []).reduce((s, h) => s + (parseFloat(h.expenses) || 0), 0)
    const netHoldIncome = totalRent - totalExpenses

    const activePackages = (packages || []).filter(p => p.status === 'analyzing' || p.status === 'active').length

    setStats({
      totalMailersSent, dealsSourced, closedDeals, totalCommission,
      activeFlips: flips.filter(f => f.status === 'active').length,
      completedFlips: completedFlips.length, totalFlipProfit,
      activeHolds: holds.filter(h => h.status === 'active').length,
      netHoldIncome, activePackages,
      totalProperties: props?.length || 0,
    })

    // Recent activity — last 8 items across sources, sorted by date
    const activity = [
      ...(deals || []).filter(d => d.address).map(d => ({ type: 'deal', label: d.address, sub: d.status?.replace(/_/g, ' '), ts: d.created_at })),
      ...(props || []).filter(p => p.address).map(p => ({ type: p.property_type, label: p.address, sub: p.status, ts: p.created_at })),
    ].sort((a, b) => new Date(b.ts) - new Date(a.ts)).slice(0, 8)
    setRecentActivity(activity)
  }

  const typeColor = { deal: '#B8892A', flip: '#D97825', hold: '#3B6D11' }

  return (
    <PageWrap>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#2C2C2C', marginBottom: 4 }}>Cash Offer Hub</h1>
        <p style={{ fontSize: 13, color: '#6b7280' }}>Investment pipeline overview · NHC / BE Property Ventures</p>
      </div>

      {/* Mailing + Deals row */}
      <SectionBar>Mailing Pipeline</SectionBar>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 12, marginBottom: 20 }}>
        <StatCard label="Mailers Sent" value={stats ? stats.totalMailersSent.toLocaleString() : '—'} topColor="#B8892A" onClick={() => onNavigate('mailings')} />
        <StatCard label="Deals Sourced" value={stats?.dealsSourced ?? '—'} topColor="#B8892A" onClick={() => onNavigate('mailings')} />
        <StatCard label="Deals Closed" value={stats?.closedDeals ?? '—'} topColor="#3B6D11" onClick={() => onNavigate('mailings')} />
        <StatCard label="Commission Earned" value={stats ? fmtK(stats.totalCommission) : '—'} topColor="#3B6D11" onClick={() => onNavigate('mailings')} />
      </div>

      {/* Flips row */}
      <SectionBar>Flips</SectionBar>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 12, marginBottom: 20 }}>
        <StatCard label="Active Flips" value={stats?.activeFlips ?? '—'} topColor="#D97825" onClick={() => onNavigate('flips')} />
        <StatCard label="Completed Flips" value={stats?.completedFlips ?? '—'} topColor="#D97825" onClick={() => onNavigate('flips')} />
        <StatCard label="Total Flip Profit" value={stats ? fmtK(stats.totalFlipProfit) : '—'} sub="all completed flips" topColor={stats?.totalFlipProfit >= 0 ? '#3B6D11' : '#B91C1C'} onClick={() => onNavigate('flips')} />
      </div>

      {/* Holds row */}
      <SectionBar>Hold Properties</SectionBar>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginTop: 12, marginBottom: 20 }}>
        <StatCard label="Active Holds" value={stats?.activeHolds ?? '—'} topColor="#2D6FAF" onClick={() => onNavigate('holds')} />
        <StatCard label="Net Hold Income (all time)" value={stats ? fmtK(stats.netHoldIncome) : '—'} sub="rent minus expenses" topColor={stats?.netHoldIncome >= 0 ? '#3B6D11' : '#B91C1C'} onClick={() => onNavigate('holds')} />
      </div>

      {/* Packages + Calculator */}
      <SectionBar>Tools</SectionBar>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginTop: 12, marginBottom: 24 }}>
        <StatCard label="Active Package Deals" value={stats?.activePackages ?? '—'} topColor="#6b21a8" onClick={() => onNavigate('packages')} />
        <StatCard label="Cash Offer Calculator" value="Open →" sub="Generate proposals" topColor="#B8892A" onClick={() => onNavigate('calculator')} />
      </div>

      {/* Recent activity */}
      {recentActivity.length > 0 && (
        <>
          <SectionBar>Recent Activity</SectionBar>
          <Card style={{ marginTop: 12, padding: 0 }}>
            {recentActivity.map((item, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 16px',
                borderBottom: i < recentActivity.length - 1 ? '1px solid #F0EDE6' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Badge color={typeColor[item.type] || '#B8892A'}>{item.type}</Badge>
                  <span style={{ fontSize: 13, color: '#2C2C2C' }}>{item.label}</span>
                </div>
                <span style={{ fontSize: 11, color: '#9ca3af', textTransform: 'capitalize' }}>{item.sub?.replace(/_/g, ' ')}</span>
              </div>
            ))}
          </Card>
        </>
      )}
    </PageWrap>
  )
}
