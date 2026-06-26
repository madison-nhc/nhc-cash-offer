import { useState } from 'react'
import { useIsMobile } from './hooks/useIsMobile.js'
import Dashboard from './pages/Dashboard.jsx'
import Analyzer from './pages/Analyzer.jsx'
import Deals from './pages/Deals.jsx'
import Purchases from './pages/Purchases.jsx'
import Flips from './pages/Flips.jsx'
import Holds from './pages/Holds.jsx'
import MailingTracker from './pages/MailingTracker.jsx'

const TABS = [
  { id:'dashboard',  label:'Dashboard',       short:'Home' },
  { id:'analyzer',   label:'Analyzer',         short:'Analyze' },
  { id:'deals',      label:'Deals',            short:'Deals' },
  { id:'purchases',  label:'Purchases',        short:'Buys' },
  { id:'flips',      label:'Flips',            short:'Flips' },
  { id:'holds',      label:'Holds',            short:'Holds' },
  { id:'mailings',   label:'Mailing Tracker',  short:'Mailers' },
]

export default function App() {
  const [active, setActive] = useState(()=>localStorage.getItem('nhc_hub_tab')||'dashboard')
  const mobile = useIsMobile()

  function navigate(tab) {
    localStorage.setItem('nhc_hub_tab', tab)
    setActive(tab)
  }

  const pages = {
    dashboard:  <Dashboard onNavigate={navigate} />,
    analyzer:   <Analyzer />,
    deals:      <Deals />,
    purchases:  <Purchases />,
    flips:      <Flips />,
    holds:      <Holds />,
    mailings:   <MailingTracker />,
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100vh' }}>
      {/* Top nav */}
      <nav style={{
        position:'sticky', top:0, zIndex:100,
        background:'#fff', borderBottom:'2px solid #B8892A',
        boxShadow:'0 1px 4px rgba(0,0,0,0.06)',
        display:'flex', flexDirection:'column',
      }}>
        {/* Logo row */}
        <div style={{ display:'flex', alignItems:'center', padding: mobile ? '0 12px' : '0 24px', height:48, gap:10 }}>
          <div style={{ width:26, height:26, borderRadius:'50%', background:'#2C2C2C', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, color:'#B8892A', fontWeight:700, flexShrink:0 }}>N</div>
          {!mobile && <span style={{ fontSize:12, fontWeight:700, letterSpacing:1.5, color:'#2C2C2C', whiteSpace:'nowrap' }}>CASH OFFER HUB</span>}

          {/* Desktop tabs inline */}
          {!mobile && (
            <div style={{ display:'flex', gap:2, marginLeft:16 }}>
              {TABS.map(t=>(
                <button key={t.id} onClick={()=>navigate(t.id)} style={{ background:active===t.id?'#B8892A':'transparent', color:active===t.id?'#fff':'#6b7280', border:'none', borderRadius:4, padding:'5px 12px', cursor:'pointer', fontSize:12, fontWeight:active===t.id?700:400, letterSpacing:0.3, whiteSpace:'nowrap', fontFamily:'inherit', transition:'all 0.15s' }}>
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {/* Mobile: current page title */}
          {mobile && (
            <span style={{ fontSize:13, fontWeight:700, color:'#2C2C2C', flex:1, textAlign:'center' }}>
              {TABS.find(t=>t.id===active)?.label||''}
            </span>
          )}
        </div>

        {/* Mobile scrollable tab bar */}
        {mobile && (
          <div style={{ display:'flex', overflowX:'auto', padding:'0 8px 8px', gap:6, WebkitOverflowScrolling:'touch', scrollbarWidth:'none' }}>
            {TABS.map(t=>(
              <button key={t.id} onClick={()=>navigate(t.id)} style={{
                background:active===t.id?'#B8892A':'#F0EDE6',
                color:active===t.id?'#fff':'#6b7280',
                border:'none', borderRadius:20, padding:'5px 14px',
                cursor:'pointer', fontSize:12, fontWeight:active===t.id?700:500,
                whiteSpace:'nowrap', fontFamily:'inherit', flexShrink:0,
                transition:'all 0.15s'
              }}>{t.short}</button>
            ))}
          </div>
        )}
      </nav>

      <main style={{ flex:1, overflow:'auto' }}>
        {pages[active]}
      </main>
    </div>
  )
}
