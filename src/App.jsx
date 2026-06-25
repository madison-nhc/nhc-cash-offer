import { useState } from 'react'
import Dashboard from './pages/Dashboard.jsx'
import MailingTracker from './pages/MailingTracker.jsx'
import Flips from './pages/Flips.jsx'
import Holds from './pages/Holds.jsx'
import CashOfferCalculator from './pages/CashOfferCalculator.jsx'
import PackageDeals from './pages/PackageDeals.jsx'

const TABS = [
  { id: 'dashboard',    label: 'Dashboard',       icon: '◈' },
  { id: 'mailings',     label: 'Mailing Tracker', icon: '✉' },
  { id: 'flips',        label: 'Flips',           icon: '⟳' },
  { id: 'holds',        label: 'Holds',           icon: '⌂' },
  { id: 'calculator',   label: 'Cash Offer Calc', icon: '⊞' },
  { id: 'packages',     label: 'Package Deals',   icon: '⊕' },
]

const NAV_H = 56

export default function App() {
  const [active, setActive] = useState('dashboard')

  const pages = {
    dashboard:  <Dashboard onNavigate={setActive} />,
    mailings:   <MailingTracker />,
    flips:      <Flips />,
    holds:      <Holds />,
    calculator: <CashOfferCalculator />,
    packages:   <PackageDeals />,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Top nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        height: NAV_H, background: '#fff',
        borderBottom: `2px solid #B8892A`,
        display: 'flex', alignItems: 'center', gap: 0,
        padding: '0 24px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
      }}>
        {/* Wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 28 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: '#2C2C2C', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, color: '#B8892A', fontWeight: 700, letterSpacing: 1
          }}>N</div>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, color: '#2C2C2C', whiteSpace: 'nowrap' }}>
            CASH OFFER HUB
          </span>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2, overflowX: 'auto' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActive(t.id)} style={{
              background: active === t.id ? '#B8892A' : 'transparent',
              color: active === t.id ? '#fff' : '#6b7280',
              border: 'none', borderRadius: 4,
              padding: '6px 14px', cursor: 'pointer',
              fontSize: 12, fontWeight: active === t.id ? 700 : 400,
              letterSpacing: 0.3, whiteSpace: 'nowrap',
              fontFamily: 'inherit', transition: 'all 0.15s'
            }}>
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Page */}
      <main style={{ flex: 1, overflow: 'auto' }}>
        {pages[active]}
      </main>
    </div>
  )
}
