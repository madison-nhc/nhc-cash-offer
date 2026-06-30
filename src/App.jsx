import { useState, useEffect, useCallback } from 'react'
import { useIsMobile } from './hooks/useIsMobile.js'
import Dashboard from './pages/Dashboard.jsx'
import Analyzer from './pages/Analyzer.jsx'
import NHCDeals from './pages/NHCDeals.jsx'
import BPVInvestments from './pages/BPVInvestments.jsx'
import MailingTracker from './pages/MailingTracker.jsx'

const TABS = [
  { id:'dashboard',    label:'Dashboard',        short:'Home',    path:'/' },
  { id:'analyzer',     label:'Analyzer',          short:'Analyze', path:'/analyzer' },
  { id:'nhc',          label:'NHC Deals',         short:'NHC',     path:'/nhc' },
  { id:'bpv',          label:'BPV Investments',   short:'BPV',     path:'/bpv' },
  { id:'mailings',     label:'Mailing Tracker',   short:'Mailers', path:'/mailings' },
]

function tabForPath(pathname) {
  const match = TABS.find(t => t.path === pathname)
  return match ? match.id : null
}

function pathForTab(tab) {
  return TABS.find(t => t.id === tab)?.path || '/'
}

// Resolve the initial tab from the URL first (so a refresh or a bookmarked
// link lands on the right page), falling back to the old localStorage value
// for anyone who had a tab open before this routing existed, then dashboard.
function initialTab() {
  return tabForPath(window.location.pathname) || localStorage.getItem('nhc_hub_tab') || 'dashboard'
}

export default function App() {
  const [active, setActive] = useState(initialTab)
  const mobile = useIsMobile()

  // navigate() is called from clicks inside the app — it pushes a new
  // history entry so the browser's back/forward buttons have something
  // real to move between, instead of every tab sharing the same URL.
  const navigate = useCallback((tab) => {
    localStorage.setItem('nhc_hub_tab', tab)
    const path = pathForTab(tab)
    if (window.location.pathname !== path) {
      window.history.pushState({ tab }, '', path)
    }
    setActive(tab)
  }, [])

  // popstate fires when the user clicks the browser's back/forward
  // buttons — sync React state to whatever the URL now is rather than
  // letting the browser navigate to a path the SPA never registered.
  useEffect(() => {
    function onPopState() {
      const tab = tabForPath(window.location.pathname) || 'dashboard'
      localStorage.setItem('nhc_hub_tab', tab)
      setActive(tab)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  // If we landed here via the localStorage fallback (URL didn't match a
  // known tab — e.g. first load after this update), normalize the URL to
  // match so subsequent back/forward behaves correctly from this point on.
  useEffect(() => {
    const path = pathForTab(active)
    if (window.location.pathname !== path) {
      window.history.replaceState({ tab: active }, '', path)
    }
  }, [])

  const pages = {
    dashboard: <Dashboard onNavigate={navigate} />,
    analyzer:  <Analyzer />,
    nhc:       <NHCDeals />,
    bpv:       <BPVInvestments />,
    mailings:  <MailingTracker />,
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100vh' }}>
      <nav style={{
        position:'sticky', top:0, zIndex:100,
        background:'#fff', borderBottom:'2px solid #B8892A',
        boxShadow:'0 1px 4px rgba(0,0,0,0.06)',
        display:'flex', flexDirection:'column',
      }}>
        <div style={{ display:'flex', alignItems:'center', padding: mobile ? '0 12px' : '0 24px', height:48, gap:10 }}>
          <img src="/nhc-logo.svg" alt="NHC" style={{ width:28, height:28, objectFit:'contain', flexShrink:0 }} />
          {!mobile && <span style={{ fontSize:12, fontWeight:700, letterSpacing:1.5, color:'#2C2C2C', whiteSpace:'nowrap' }}>CASH OFFER HUB</span>}

          {!mobile && (
            <div style={{ display:'flex', gap:2, marginLeft:16 }}>
              {TABS.map(t=>(
                <button key={t.id} onClick={()=>navigate(t.id)} style={{ background:active===t.id?'#B8892A':'transparent', color:active===t.id?'#fff':'#6b7280', border:'none', borderRadius:4, padding:'5px 12px', cursor:'pointer', fontSize:12, fontWeight:active===t.id?700:400, letterSpacing:0.3, whiteSpace:'nowrap', fontFamily:'inherit', transition:'all 0.15s' }}>
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {mobile && (
            <span style={{ fontSize:13, fontWeight:700, color:'#2C2C2C', flex:1, textAlign:'center' }}>
              {TABS.find(t=>t.id===active)?.label||''}
            </span>
          )}
        </div>

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
