import { useState, useEffect, useCallback, useRef } from 'react'
import { useIsMobile } from './hooks/useIsMobile.js'
import { supabase } from './lib/supabase.js'
import Analyzer from './pages/Analyzer.jsx'
import Rehabs from './pages/Rehabs.jsx'
import Listings from './pages/Listings.jsx'
import Holds from './pages/Holds.jsx'
import Wholesale from './pages/Wholesale.jsx'
import Sold from './pages/Sold.jsx'
import MailingTracker from './pages/MailingTracker.jsx'

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

const TABS = [
  { id:'analyzer',   label:'Analyzer',        short:'Analyze',   path:'/analyzer' },
  { id:'rehabs',     label:'Rehabs',           short:'Rehabs',    path:'/rehabs' },
  { id:'listings',   label:'Listings',         short:'Listings',  path:'/listings' },
  { id:'holds',      label:'Holds',            short:'Holds',     path:'/holds' },
  { id:'wholesale',  label:'Wholesale',        short:'Wholesale', path:'/wholesale' },
  { id:'sold',       label:'Sold',             short:'Sold',      path:'/sold' },
  { id:'mailings',   label:'Mailing Tracker',  short:'Mailers',   path:'/mailings' },
]

function tabForPath(pathname) {
  const match = TABS.find(t => t.path === pathname)
  return match ? match.id : null
}

function pathForTab(tab) {
  return TABS.find(t => t.id === tab)?.path || '/analyzer'
}

function initialTab() {
  return tabForPath(window.location.pathname) || localStorage.getItem('nhc_hub_tab') || 'analyzer'
}

export default function App() {
  const [active, setActive] = useState(initialTab)
  const [targetProperty, setTargetProperty] = useState(null)
  const mobile = useIsMobile()

  const navigate = useCallback((tab) => {
    localStorage.setItem('nhc_hub_tab', tab)
    const path = pathForTab(tab)
    if (window.location.pathname !== path) {
      window.history.pushState({ tab }, '', path)
    }
    setActive(tab)
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

  const pages = {
    analyzer:  <Analyzer openPropertyId={targetProperty?.id} openInPackage={!!targetProperty?.package_id} onOpenedTarget={() => setTargetProperty(null)} />,
    rehabs:    <Rehabs />,
    listings:  <Listings />,
    holds:     <Holds />,
    wholesale: <Wholesale />,
    sold:      <Sold />,
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
              {TABS.map(t => (
                <button key={t.id} onClick={() => navigate(t.id)} style={{
                  background: active === t.id ? '#B8892A' : 'transparent',
                  color: active === t.id ? '#fff' : '#6b7280',
                  border:'none', borderRadius:4, padding:'5px 12px',
                  cursor:'pointer', fontSize:12, fontWeight: active === t.id ? 700 : 400,
                  letterSpacing:0.3, whiteSpace:'nowrap', fontFamily:'inherit', transition:'all 0.15s'
                }}>
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {!mobile && <GlobalSearch onSelect={handleSearchSelect} mobile={false} />}

          {mobile && (
            <span style={{ fontSize:13, fontWeight:700, color:'#2C2C2C', flex:1, textAlign:'center' }}>
              {TABS.find(t => t.id === active)?.label || ''}
            </span>
          )}
        </div>

        {mobile && (
          <div style={{ display:'flex', overflowX:'auto', padding:'0 8px 8px', gap:6, WebkitOverflowScrolling:'touch', scrollbarWidth:'none' }}>
            {TABS.map(t => (
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
    </div>
  )
}
