import { useState, useEffect, useCallback, useRef } from 'react'
import { useIsMobile } from './hooks/useIsMobile.js'
import { supabase } from './lib/supabase.js'
import Analyzer from './pages/Analyzer.jsx'
import AddressInput from './components/AddressInput.jsx'
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
import Business from './pages/Business.jsx'
import ToolsHome from './pages/ToolsHome.jsx'

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

function relTime(iso) {
  if (!iso) return ''
  const ms = new Date(iso).getTime()
  const diff = Date.now() - ms
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return m + (m === 1 ? ' minute ago' : ' minutes ago')
  const h = Math.floor(m / 60)
  if (h < 24) return h + (h === 1 ? ' hour ago' : ' hours ago')
  const d = Math.floor(h / 24)
  if (d === 1) return 'yesterday'
  if (d < 30) return d + ' days ago'
  return new Date(ms).toLocaleDateString()
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
  { id:'business',   label:'Business',         short:'Business',  path:'/business' },
]
const TOOLS_TAB = { id:'tools', label:'Tools', short:'Tools', path:'/tools' }
// TABS is what renders as top-level nav buttons — the individual Ops utilities are
// grouped behind the single Tools card page instead of each getting their own tab.
const TABS = [...MARKETING_TABS, ...PIPELINE_TABS, TOOLS_TAB]
// ALL_ROUTES keeps every real route resolvable (so /vendors, /users etc. still work
// as direct links / from card clicks), even though they don't have their own nav button.
const ALL_ROUTES = [...MARKETING_TABS, ...PIPELINE_TABS, ...OPS_TABS, TOOLS_TAB]
const OPS_TAB_IDS = OPS_TABS.map(t => t.id)

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

// Address-only add flow, plus one small branch: is this a property still being
// analyzed, or one already owned? If owned, who owns it? Agents only see their
// own deals, so the property is always attributed to whoever is adding it.
function QuickAddPropertyModal({ open, onClose, onAdd }) {
  const [address, setAddress] = useState('')
  const [owned, setOwned] = useState(false)
  const [owner, setOwner] = useState('BPV')
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (open) { setAddress(''); setOwned(false); setOwner('BPV') } }, [open])
  if (!open) return null

  async function submit() {
    if (!address) return
    setSaving(true)
    await onAdd(address, { owned, owner })
    setSaving(false)
  }

  const pillBase = { flex:1, textAlign:'center', padding:'8px 10px', borderRadius:6, fontSize:12.5, fontWeight:700, cursor:'pointer', border:'1.5px solid #D6D2CA', fontFamily:'inherit' }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position:'fixed', inset:0, zIndex:400, background:'rgba(0,0,0,0.55)', display:'flex', alignItems:'center', justifyContent:'center' }}
    >
      <div style={{ background:'#fff', borderRadius:12, width:420, maxWidth:'92vw', padding:24, boxShadow:'0 8px 40px rgba(0,0,0,0.3)' }}>
        <div style={{ fontSize:15, fontWeight:700, color:'#2C2C2C', marginBottom:16 }}>Add Property</div>
        <label style={{ fontSize:11, fontWeight:600, color:'#6b7280', display:'block', marginBottom:4 }}>Address</label>
        <AddressInput value={address} onChange={setAddress} />

        <label style={{ fontSize:11, fontWeight:600, color:'#6b7280', display:'block', marginTop:16, marginBottom:6 }}>Status</label>
        <div style={{ display:'flex', gap:8 }}>
          <div
            onClick={() => setOwned(false)}
            style={{ ...pillBase, background: !owned ? '#2D6FAF' : '#fff', color: !owned ? '#fff' : '#6b7280', borderColor: !owned ? '#2D6FAF' : '#D6D2CA' }}
          >Property to Analyze</div>
          <div
            onClick={() => setOwned(true)}
            style={{ ...pillBase, background: owned ? '#3B6D11' : '#fff', color: owned ? '#fff' : '#6b7280', borderColor: owned ? '#3B6D11' : '#D6D2CA' }}
          >Already Owned</div>
        </div>

        {owned && (
          <div style={{ marginTop:14 }}>
            <label style={{ fontSize:11, fontWeight:600, color:'#6b7280', display:'block', marginBottom:4 }}>Owned By</label>
            <select
              value={owner}
              onChange={e => setOwner(e.target.value)}
              style={{ width:'100%', border:'1.5px solid #D6D2CA', borderRadius:6, padding:'8px 10px', fontSize:13, fontWeight:600, fontFamily:'inherit', color:'#2C2C2C', background:'#fff', cursor:'pointer', outline:'none' }}
            >
              {['BPV','Bob Sophiea','Eric Kimble','Other'].map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
        )}

        <div style={{ display:'flex', gap:8, marginTop:20 }}>
          <button
            onClick={onClose}
            style={{ flex:1, background:'none', border:'1px solid #D6D2CA', borderRadius:6, padding:'9px 14px', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', color:'#6b7280' }}
          >Cancel</button>
          <button
            onClick={submit}
            disabled={saving || !address}
            style={{ flex:1, background:'#B8892A', border:'none', borderRadius:6, padding:'9px 14px', fontSize:13, fontWeight:700, cursor: saving ? 'default' : 'pointer', fontFamily:'inherit', color:'#fff', opacity: (saving || !address) ? 0.6 : 1 }}
          >{saving ? 'Adding…' : 'Add Property'}</button>
        </div>
      </div>
    </div>
  )
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

  // ── Notifications ("pings") ──────────────────────────────────────────
  const [notifications, setNotifications] = useState([])
  const [notifMenuOpen, setNotifMenuOpen] = useState(false)
  const unreadCount = notifications.filter(n => !n.read_at).length

  const loadNotifications = useCallback(() => {
    supabase.from('cashoffer_notifications').select('*')
      .eq('recipient_email', userEmail)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => setNotifications(data || []))
  }, [userEmail])

  useEffect(() => {
    loadNotifications()
    const t = setInterval(loadNotifications, 30000)
    return () => clearInterval(t)
  }, [loadNotifications])

  async function openNotification(n) {
    setNotifMenuOpen(false)
    if (!n.read_at) {
      await supabase.from('cashoffer_notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id)
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x))
    }
    if (n.property_id) {
      setTargetProperty({ id: n.property_id })
      navigate('analyzer')
    }
  }

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
    business:  <Business isAdmin={isAdmin} />,
    tools:     <ToolsHome onNavigate={navigate} isAdmin={isAdmin} />,
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
                    {[MARKETING_TABS, PIPELINE_TABS, [TOOLS_TAB]].map((group, gi) => (
                      <div key={gi}>
                        {gi > 0 && <div style={{ height:1, background:'#F0EDE6', margin:'6px 4px' }} />}
                        {group.map(t => {
                          const isActive = active === t.id || (t.id === 'tools' && OPS_TAB_IDS.includes(active))
                          return (
                            <button key={t.id} onClick={() => navigate(t.id)} style={{
                              display:'block', width:'100%', textAlign:'left', background: isActive ? '#B8892A' : 'transparent',
                              color: isActive ? '#fff' : '#2C2C2C', border:'none', borderRadius:5, padding:'8px 10px',
                              cursor:'pointer', fontSize:13, fontWeight: isActive ? 700 : 400, fontFamily:'inherit',
                            }}>
                              {t.label}
                            </button>
                          )
                        })}
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
              <button onClick={() => navigate('tools')} style={{
                background: (active === 'tools' || OPS_TAB_IDS.includes(active)) ? '#B8892A' : 'transparent',
                color: (active === 'tools' || OPS_TAB_IDS.includes(active)) ? '#fff' : '#6b7280',
                border:'none', borderRadius:4, padding:'5px 12px',
                cursor:'pointer', fontSize:12, fontWeight: (active === 'tools' || OPS_TAB_IDS.includes(active)) ? 700 : 400,
                letterSpacing:0.3, whiteSpace:'nowrap', fontFamily:'inherit', transition:'all 0.15s', flexShrink:0,
              }}>
                Tools
              </button>
            </div>
          )}

          {!mobile && <GlobalSearch onSelect={handleSearchSelect} mobile={false} />}

          <div style={{ position:'relative', flexShrink:0 }}>
            <button
              onClick={() => setNotifMenuOpen(o => !o)}
              title="Notifications"
              style={{
                position:'relative', background:'none', border:'1px solid #D6D2CA', borderRadius:6,
                padding:'5px 9px', cursor:'pointer', fontSize:14, lineHeight:1, color:'#6b7280',
              }}
            >
              🔔
              {unreadCount > 0 && (
                <span style={{
                  position:'absolute', top:-5, right:-5, background:'#B91C1C', color:'#fff',
                  fontSize:9, fontWeight:700, borderRadius:10, minWidth:15, height:15,
                  display:'flex', alignItems:'center', justifyContent:'center', padding:'0 3px',
                }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
              )}
            </button>
            {notifMenuOpen && (
              <>
                <div onClick={() => setNotifMenuOpen(false)} style={{ position:'fixed', inset:0, zIndex:150 }} />
                <div style={{
                  position:'absolute', top:'calc(100% + 6px)', right:0, background:'#fff',
                  border:'1px solid #E8E5DE', borderRadius:8, boxShadow:'0 8px 24px rgba(0,0,0,0.12)',
                  zIndex:151, width:300, maxHeight:'70vh', overflowY:'auto',
                }}>
                  <div style={{ padding:'10px 14px', borderBottom:'1px solid #F0EDE6', fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.5 }}>
                    Notifications
                  </div>
                  {notifications.length === 0 ? (
                    <div style={{ padding:'20px 14px', textAlign:'center', color:'#bbb', fontSize:12 }}>Nothing yet.</div>
                  ) : notifications.map(n => (
                    <button key={n.id} onClick={() => openNotification(n)} style={{
                      display:'block', width:'100%', textAlign:'left', background: n.read_at ? 'transparent' : '#FEF9EC',
                      border:'none', borderBottom:'1px solid #F0EDE6', padding:'10px 14px', cursor:'pointer', fontFamily:'inherit',
                    }}>
                      <div style={{ fontSize:12.5, color:'#2C2C2C', fontWeight: n.read_at ? 400 : 700, lineHeight:1.4 }}>{n.message}</div>
                      <div style={{ fontSize:10, color:'#9ca3af', marginTop:3 }}>{relTime(n.created_at)}{n.sender_email ? ` · from ${n.sender_email}` : ''}</div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

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
            <button onClick={() => navigate('tools')} style={{
              background: (active === 'tools' || OPS_TAB_IDS.includes(active)) ? '#B8892A' : '#F0EDE6',
              color: (active === 'tools' || OPS_TAB_IDS.includes(active)) ? '#fff' : '#6b7280',
              border:'none', borderRadius:20, padding:'5px 14px',
              cursor:'pointer', fontSize:12, fontWeight: (active === 'tools' || OPS_TAB_IDS.includes(active)) ? 700 : 500,
              whiteSpace:'nowrap', fontFamily:'inherit', flexShrink:0, transition:'all 0.15s'
            }}>Tools</button>
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

      {/* Global quick-add — just the address; the adding user is always set as
          the agent so the property shows up correctly in their filtered view */}
      <QuickAddPropertyModal
        open={newPropertyOpen}
        onClose={() => setNewPropertyOpen(false)}
        onAdd={async (address, details) => {
          const payload = details?.owned
            ? { address, type:'Renovation', stage:'Purchased', disposition:'renovation', owner: details.owner || null, agent_email: userEmail || null }
            : { address, type:'Analyzing', stage:'Analyzing', owner:null, agent_email: userEmail || null }
          const { error } = await supabase.from('cashoffer_properties').insert(payload)
          if (error) { alert(`Couldn't add this property.\n\n${error.message}`); return }
          setNewPropertyOpen(false)
          // Refresh the current page by re-navigating to it
          const cur = active
          setActive(null)
          setTimeout(() => setActive(cur), 50)
        }}
      />
    </div>
  )
}



