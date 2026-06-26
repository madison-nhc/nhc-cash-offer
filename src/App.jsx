import { useState } from 'react'
import Dashboard from './pages/Dashboard.jsx'
import MailingTracker from './pages/MailingTracker.jsx'
import Flips from './pages/Flips.jsx'
import Holds from './pages/Holds.jsx'
import CashOfferCalculator from './pages/CashOfferCalculator.jsx'
import PackageDeals from './pages/PackageDeals.jsx'
import SavedOffers from './pages/SavedOffers.jsx'

const TABS = [
  { id: 'dashboard',  label: 'Dashboard' },
  { id: 'mailings',   label: 'Mailing Tracker' },
  { id: 'flips',      label: 'Flips' },
  { id: 'holds',      label: 'Holds' },
  { id: 'calculator', label: 'Cash Offer Calc' },
  { id: 'saved',      label: 'Saved Proposals' },
  { id: 'packages',   label: 'Package Deals' },
]

export default function App() {
  const [active, setActive] = useState(() => localStorage.getItem('nhc_hub_tab') || 'dashboard')

  function navigate(tab) {
    localStorage.setItem('nhc_hub_tab', tab)
    setActive(tab)
  }
  const [loadedOffer, setLoadedOffer] = useState(null)

  function handleLoadCalc(offer) {
    setLoadedOffer(offer)
    navigate('calculator')
  }

  const pages = {
    dashboard:  <Dashboard onNavigate={navigate} />,
    mailings:   <MailingTracker />,
    flips:      <Flips />,
    holds:      <Holds />,
    calculator: <CashOfferCalculator key={loadedOffer?.id || 'new'} initialOffer={loadedOffer} />,
    saved:      <SavedOffers onLoadCalc={handleLoadCalc} />,
    packages:   <PackageDeals />,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        height: 56, background: '#fff',
        borderBottom: '2px solid #B8892A',
        display: 'flex', alignItems: 'center', gap: 0,
        padding: '0 24px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 28 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: '#2C2C2C', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, color: '#B8892A', fontWeight: 700
          }}>N</div>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, color: '#2C2C2C', whiteSpace: 'nowrap' }}>
            CASH OFFER HUB
          </span>
        </div>
        <div style={{ display: 'flex', gap: 2, overflowX: 'auto' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => navigate(t.id)} style={{
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
      <main style={{ flex: 1, overflow: 'auto' }}>
        {pages[active]}
      </main>
    </div>
  )
}
