import { useState, useEffect, useCallback, useRef } from 'react'
import { useIsMobile } from './hooks/useIsMobile.js'
import { supabase } from './lib/supabase.js'
import Analyzer from './pages/Analyzer.jsx'
import PropertyDrawer from './components/PropertyDrawer.jsx'
import Rehabs from './pages/Rehabs.jsx'
import Supplies from './pages/Supplies.jsx'
import Listings from './pages/Listings.jsx'
import Holds from './pages/Holds.jsx'
import Wholesale from './pages/Wholesale.jsx'
import Sold from './pages/Sold.jsx'
import DeadDeals from './pages/DeadDeals.jsx'
import MailingTracker from './pages/MailingTracker.jsx'
import Vendors from './pages/Vendors.jsx'
import Inventory from './pages/Inventory.jsx'
import OpsLog from './pages/OpsLog.jsx'
import PropertyFullView from './components/PropertyFullView.jsx'
import LoginPage from './pages/LoginPage.jsx'
import Users from './pages/Users.jsx'

function GlobalSearch({ onSelect, mobile }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const boxRef = useRef(null)

  useEffect(() => {
    if (!query.trim()) { setResults([]); setOpen(false); return }
    setLoading(true)
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('cashoffer_properties')
        .select('id,address,disposition,package_id,arv,rehab_active')
        .ilike('address', `%${query.trim()}%`)
        .order('updated_at', { ascending: false })
        .limit(8)
      setResults(data || [])
      setOpen(true)
      setLoading(false)
    }, 250)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    function onClick(e) { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false) }
    window.addEventListener('mousedown', onClick)
    return () => window.removeEventListener('mousedown', onClick)
  }, [])

  function pick(p) {
    onSelect(p)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  const DISP_LABEL = { listing:'Listing', wholesale:'Wholesale', flip:'Flip', hold:'Hold', lost:'Lost' }

  return (
    <div ref={boxRef} style={{ position:'relative', width: mobile ? '100%' : 220, marginLeft: mobile ? 0 : 'auto' }}>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        onFocus={() => { if (results.length) setOpen(true) }}
        placeholder="Search deals..."
        style={{ width:'100%', padding:'6px 10px', border:'1px solid #D6D2CA', borderRadius:6, fontSize:12, fontFamily:'inherit', outline:'none', background:'#FAFAF8' }}
      />
      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 4px)', right:0, width: mobile ? '100%' : 320, maxHeight:320, overflowY:'auto', background:'#fff', border:'1px solid #D6D2CA', borderRadius:8, boxShadow:'0 4px 16px rgba(0,0,0,0.12)', zIndex:300 }}>
          {loading && <div style={{ padding:'10px 14px', fontSize:12, color:'#9ca3af' }}>Searching...</div>}
          {!loading && results.length === 0 && <div style={{ padding:'10px 14px', fontSize:12, color:'#9ca3af' }}>No matching properties</div>}
          {!loading && results.map(p => (
            <div key={p.id} onClick={() => pick(p)} style={{ padding:'9px 14px', cursor:'pointer', borderBottom:'1px solid #F0EDE6', display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}
              onMouseEnter={e => e.currentTarget.style.background='#fef9f0'}
              onMouseLeave={e => e.currentTarget.style.background='#fff'}>
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:600, color:'#2C2C2C', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.address}</div>
                {p.rehab_active && <div style={{ fontSize:10, color:'#D97825', marginTop:1 }}>Active Rehab</div>}
              </div>
              <span style={{ fontSize:10, color:'#B8892A', fontWeight:600, whiteSpace:'nowrap', flexShrink:0 }}>
                {p.disposition ? DISP_LABEL[p.disposition] : 'Analyzing'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const MARKETING_TABS = [
  { id:'mailings',   label:'Mailing Tracker',  short:'Mailers',   path:'/mailings' },
]
const PIPELINE_TABS = [
  { id:'analyzer',   label:'Analyzer',        short:'Analyze',   path:'/analyzer' },
  { id:'rehabs',     label:'Renovations',      short:'Renos',     path:'/rehabs' },
  { id:'holds',      label:'Holds',            short:'Holds',     path:'/holds' },
  { id:'listings',   label:'Listings',         short:'Listings',  path:'/listings' },
  { id:'wholesale',  label:'Wholesale',        short:'Wholesale', path:'/wholesale' },
  { id:'sold',       label:'Sold',             short:'Sold',      path:'/sold' },
  { id:'deaddeals',  label:'Dead Deals',       short:'Dead',      path:'/dead-deals' },
]
const OPS_TABS = [
  { id:'vendors',    label:'Vendors',          short:'Vendors',   path:'/vendors' },
  { id:'supplies',   label:'Supplies',         short:'Supplies',  path:'/supplies' },
  { id:'inventory',  label:'Inventory',        short:'Inventory', path:'/inventory' },
  { id:'opslog',     label:'Improvements',     short:'Improvements', path:'/ops-log' },
  { id:'users',      label:'Users',            short:'Users',     path:'/users' },
]
const TABS = [...MARKETING_TABS, ...PIPELINE_TABS, ...OPS_TABS]
const ALL_ROUTES = TABS

function tabForPath(pathname) {
  const match = ALL_ROUTES.find(t => t.path === pathname)
  return match ? match.id : null
}

function pathForTab(tab) {
  return ALL_ROUTES.find(t => t.id === tab)?.path || '/analyzer'
}

function initialTab() {
  return tabForPath(window.location.pathname) || localStorage.getItem('nhc_hub_tab') || 'analyzer'
}

export default function App() {
  // ── Auth gate — checked before anything else renders. Any Google account
  // can attempt sign-in (no @nhcnow.com domain restriction, since outside
  // parties like the lender need access), but only emails on the
  // cashoffer_users allowlist table actually get into the app. ──
  const [session, setSession] = useState(undefined)
  const [access, setAccess] = useState(undefined) // undefined = loading, null = not on allowlist, {role,...} = allowed

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session === undefined) return
    if (!session) { setAccess(undefined); return }
    let cancelled = false
    supabase.from('cashoffer_users').select('*').eq('email', session.user.email).maybeSingle()
      .then(({ data }) => { if (!cancelled) setAccess(data || null) })
    return () => { cancelled = true }
  }, [session])

  // Popup route: window.open(`${origin}/?propertyView=<id>`) from the drawer opens a
  // standalone full-page view — no nav chrome, own data loading, own autosave.
  const popupPropertyId = new URLSearchParams(window.location.search).get('propertyView')

  if (session === undefined) return null
  if (!session) return <LoginPage />
  if (access === undefined) return null
  if (!access) return <LoginPage unauthorized email={session.user.email} onSignOut={() => supabase.auth.signOut()} />

  const isAdmin = access.role === 'admin'
  const isAgentRole = access.role === 'agent'
  const userEmail = session.user.email

  if (popupPropertyId) return <div style={{ height:'100vh' }}><PropertyFullView propertyId={popupPropertyId} /></div>

  return <AuthedApp popupPropertyId={popupPropertyId} isAdmin={isAdmin} isAgentRole={isAgentRole} userEmail={userEmail} />
}

function AuthedApp({ isAdmin, isAgentRole, userEmail }) {
  const [active, setActive] = useState(initialTab)
  const [targetProperty, setTargetProperty] = useState(null)
  const [newPropertyOpen, setNewPropertyOpen] = useState(false)

  // Number inputs respond to mouse-wheel scroll when focused, silently changing the value —
  // this blurs the field on scroll instead, app-wide, so scrolling the page never edits a number.
  useEffect(() => {
    function onWheel(e) {
      if (document.activeElement && document.activeElement.type === 'number') {
        document.activeElement.blur()
      }
    }
    document.addEventListener('wheel', onWheel, { passive: true })
    return () => document.removeEventListener('wheel', onWheel)
  }, [])
  const mobile = useIsMobile()
  const compact = useIsMobile(1150)
  const [navMenuOpen, setNavMenuOpen] = useState(false)

  const navigate = useCallback((tab) => {
    localStorage.setItem('nhc_hub_tab', tab)
    const path = pathForTab(tab)
    if (window.location.pathname !== path) {
      window.history.pushState({ tab }, '', path)
    }
    setActive(tab)
    setNavMenuOpen(false)
  }, [])

  useEffect(() => {
    function onPopState() {
      const tab = tabForPath(window.location.pathname) || 'analyzer'
      localStorage.setItem('nhc_hub_tab', tab)
      setActive(tab)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    const path = pathForTab(active)
    if (window.location.pathname !== path) {
      window.history.replaceState({ tab: active }, '', path)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearchSelect = useCallback((property) => {
    setTargetProperty(property)
    navigate('analyzer')
  }, [navigate])

  const visibleOpsTabs = OPS_TABS.filter(t => t.id !== 'users' || isAdmin)

  const pages = {
    analyzer:  <Analyzer openPropertyId={targetProperty?.id} openInPackage={!!targetProperty?.package_id} onOpenedTarget={() => setTargetProperty(null)} onOpenNew={() => setNewPropertyOpen(true)} isAgentRole={isAgentRole} currentUserEmail={userEmail} />,
    rehabs:    <Rehabs onOpenSupplies={() => navigate('supplies')} isAgentRole={isAgentRole} currentUserEmail={userEmail} />,
    supplies:  <Supplies onBack={() => navigate('rehabs')} />,
    listings:  <Listings isAgentRole={isAgentRole} currentUserEmail={userEmail} />,
    holds:     <Holds isAgentRole={isAgentRole} currentUserEmail={userEmail} />,
    wholesale: <Wholesale isAgentRole={isAgentRole} currentUserEmail={userEmail} />,
    sold:      <Sold isAgentRole={isAgentRole} currentUserEmail={userEmail} />,
    deaddeals: <DeadDeals isAgentRole={isAgentRole} currentUserEmail={userEmail} />,
    mailings:  <MailingTracker />,
    vendors:   <Vendors />,
    inventory: <Inventory />,
    opslog:    <OpsLog />,
    users:     <Users isAdmin={isAdmin} userEmail={userEmail} />,
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
          {!mobile && <span style={{ fontSize:12, fontWeight:700, letterSpacing:1.5, color:'#2C2C2C', whiteSpace:'nowrap', flexShrink:0 }}>CASH OFFER HUB</span>}

          {!mobile && compact && (
            <div style={{ position:'relative', flex:'1 1 auto', minWidth:0, marginLeft:16 }}>
              <button
                onClick={() => setNavMenuOpen(o => !o)}
                style={{
                  display:'flex', alignItems:'center', gap:6, background:'#FAFAF8', border:'1px solid #E8E5DE',
                  borderRadius:6, padding:'6px 12px', cursor:'pointer', fontFamily:'inherit',
                  fontSize:12, fontWeight:700, color:'#2C2C2C', maxWidth:220,
                }}
              >
                <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {TABS.find(t => t.id === active)?.label || 'Menu'}
                </span>
                <span style={{ fontSize:10, color:'#9ca3af' }}>{navMenuOpen ? '▲' : '▼'}</span>
              </button>
              {navMenuOpen && (
                <>
                  <div onClick={() => setNavMenuOpen(false)} style={{ position:'fixed', inset:0, zIndex:150 }} />
                  <div style={{
                    position:'absolute', top:'calc(100% + 4px)', left:0, background:'#fff',
                    border:'1px solid #E8E5DE', borderRadius:8, boxShadow:'0 8px 24px rgba(0,0,0,0.12)',
                    zIndex:151, minWidth:200, maxHeight:'70vh', overflowY:'auto', padding:6,
                  }}>
                    {[MARKETING_TABS, PIPELINE_TABS, visibleOpsTabs].map((group, gi) => (
                      <div key={gi}>
                        {gi > 0 && <div style={{ height:1, background:'#F0EDE6', margin:'6px 4px' }} />}
                        {group.map(t => (
                          <button key={t.id} onClick={() => navigate(t.id)} style={{
                            display:'block', width:'100%', textAlign:'left', background: active === t.id ? '#B8892A' : 'transparent',
                            color: active === t.id ? '#fff' : '#2C2C2C', border:'none', borderRadius:5, padding:'8px 10px',
                            cursor:'pointer', fontSize:13, fontWeight: active === t.id ? 700 : 400, fontFamily:'inherit',
                          }}>
                            {t.label}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {!mobile && !compact && (
            <div style={{ display:'flex', alignItems:'center', gap:2, marginLeft:16, flex:'1 1 auto', minWidth:0, overflowX:'auto', scrollbarWidth:'none', WebkitOverflowScrolling:'touch' }}>
              {MARKETING_TABS.map(t => (
                <button key={t.id} onClick={() => navigate(t.id)} style={{
                  background: active === t.id ? '#B8892A' : 'transparent',
                  color: active === t.id ? '#fff' : '#6b7280',
                  border:'none', borderRadius:4, padding:'5px 12px',
                  cursor:'pointer', fontSize:12, fontWeight: active === t.id ? 700 : 400,
                  letterSpacing:0.3, whiteSpace:'nowrap', fontFamily:'inherit', transition:'all 0.15s', flexShrink:0,
                }}>
                  {t.label}
                </button>
              ))}
              <div style={{ width:1, height:20, background:'#D6D2CA', margin:'0 8px', flexShrink:0 }} />
              {PIPELINE_TABS.map(t => (
                <button key={t.id} onClick={() => navigate(t.id)} style={{
                  background: active === t.id ? '#B8892A' : 'transparent',
                  color: active === t.id ? '#fff' : '#6b7280',
                  border:'none', borderRadius:4, padding:'5px 12px',
                  cursor:'pointer', fontSize:12, fontWeight: active === t.id ? 700 : 400,
                  letterSpacing:0.3, whiteSpace:'nowrap', fontFamily:'inherit', transition:'all 0.15s', flexShrink:0,
                }}>
                  {t.label}
                </button>
              ))}
              <div style={{ width:1, height:20, background:'#D6D2CA', margin:'0 8px', flexShrink:0 }} />
              {visibleOpsTabs.map(t => (
                <button key={t.id} onClick={() => navigate(t.id)} style={{
                  background: active === t.id ? '#B8892A' : 'transparent',
                  color: active === t.id ? '#fff' : '#6b7280',
                  border:'none', borderRadius:4, padding:'5px 12px',
                  cursor:'pointer', fontSize:12, fontWeight: active === t.id ? 700 : 400,
                  letterSpacing:0.3, whiteSpace:'nowrap', fontFamily:'inherit', transition:'all 0.15s', flexShrink:0,
                }}>
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {!mobile && <GlobalSearch onSelect={handleSearchSelect} mobile={false} />}

          {!mobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 4, flexShrink:0 }}>
              <span style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap' }}>{userEmail}</span>
              <button
                onClick={() => supabase.auth.signOut()}
                style={{ background: 'none', border: '1px solid #D6D2CA', color: '#6b7280', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
              >
                Sign Out
              </button>
            </div>
          )}

          {/* Global Add Property button */}
          <button
            onClick={() => setNewPropertyOpen(true)}
            style={{
              background:'#B8892A', color:'#fff', border:'none',
              borderRadius:6, padding:'6px 14px', cursor:'pointer', fontSize:12,
              fontWeight:700, fontFamily:'inherit', whiteSpace:'nowrap', flexShrink:0,
            }}>
            + Add Property
          </button>

          {mobile && (
            <span style={{ fontSize:13, fontWeight:700, color:'#2C2C2C', flex:1, textAlign:'center' }}>
              {ALL_ROUTES.find(t => t.id === active)?.label || ''}
            </span>
          )}
          {mobile && (
            <button
              onClick={() => setNewPropertyOpen(true)}
              style={{
                background:'#B8892A', color:'#fff', border:'none',
                borderRadius:6, padding:'5px 10px', cursor:'pointer',
                fontSize:11, fontWeight:700, fontFamily:'inherit', flexShrink:0,
              }}>
              +
            </button>
          )}
          {mobile && (
            <button
              onClick={() => supabase.auth.signOut()}
              title="Sign out"
              style={{
                background:'none', color:'#9ca3af', border:'1px solid #D6D2CA',
                borderRadius:6, padding:'5px 8px', cursor:'pointer',
                fontSize:11, fontWeight:600, fontFamily:'inherit', flexShrink:0,
              }}>
              ⏻
            </button>
          )}
        </div>

        {mobile && (
          <div style={{ display:'flex', alignItems:'center', overflowX:'auto', padding:'0 8px 8px', gap:6, WebkitOverflowScrolling:'touch', scrollbarWidth:'none' }}>
            {MARKETING_TABS.map(t => (
              <button key={t.id} onClick={() => navigate(t.id)} style={{
                background: active === t.id ? '#B8892A' : '#F0EDE6',
                color: active === t.id ? '#fff' : '#6b7280',
                border:'none', borderRadius:20, padding:'5px 14px',
                cursor:'pointer', fontSize:12, fontWeight: active === t.id ? 700 : 500,
                whiteSpace:'nowrap', fontFamily:'inherit', flexShrink:0, transition:'all 0.15s'
              }}>{t.short}</button>
            ))}
            <div style={{ width:1, height:20, background:'#D6D2CA', margin:'0 4px', flexShrink:0 }} />
            {PIPELINE_TABS.map(t => (
              <button key={t.id} onClick={() => navigate(t.id)} style={{
                background: active === t.id ? '#B8892A' : '#F0EDE6',
                color: active === t.id ? '#fff' : '#6b7280',
                border:'none', borderRadius:20, padding:'5px 14px',
                cursor:'pointer', fontSize:12, fontWeight: active === t.id ? 700 : 500,
                whiteSpace:'nowrap', fontFamily:'inherit', flexShrink:0, transition:'all 0.15s'
              }}>{t.short}</button>
            ))}
            <div style={{ width:1, height:20, background:'#D6D2CA', margin:'0 4px', flexShrink:0 }} />
            {visibleOpsTabs.map(t => (
              <button key={t.id} onClick={() => navigate(t.id)} style={{
                background: active === t.id ? '#B8892A' : '#F0EDE6',
                color: active === t.id ? '#fff' : '#6b7280',
                border:'none', borderRadius:20, padding:'5px 14px',
                cursor:'pointer', fontSize:12, fontWeight: active === t.id ? 700 : 500,
                whiteSpace:'nowrap', fontFamily:'inherit', flexShrink:0, transition:'all 0.15s'
              }}>{t.short}</button>
            ))}
          </div>
        )}

        {mobile && (
          <div style={{ padding:'0 12px 8px' }}>
            <GlobalSearch onSelect={handleSearchSelect} mobile={true} />
          </div>
        )}
      </nav>

      <main style={{ flex:1, overflow:'auto' }}>
        {pages[active]}
      </main>

      {/* Global new property drawer — accessible from any page */}
      <PropertyDrawer
        property={newPropertyOpen ? {
          address:'', arv:'', asis_pct:50, profit_margin:15,
          comm_cash_pct:9, comm_list_pct:6, hold_cash_pct:0.75, hold_cash_months:6,
          hold_opt2_pct:0.5, hold_opt2_months:3, hold_opt3_pct:0.5, hold_opt3_months:6,
          repair_items:[], stage:'Analyzing', acquisition_type:'Purchased', owner:'BPV',
          agent_email: isAgentRole ? userEmail : null,
        } : null}
        open={newPropertyOpen}
        onClose={() => setNewPropertyOpen(false)}
        onSave={() => {
          setNewPropertyOpen(false)
          // Refresh the current page by re-navigating to it
          const cur = active
          setActive(null)
          setTimeout(() => setActive(cur), 50)
        }}
        mailings={[]}
        isAgentRole={isAgentRole}
        currentUserEmail={userEmail}
      />
    </div>
  )
}



