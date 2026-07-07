import { useEffect, useRef, useState, useCallback } from 'react'
import PropertyDrawer from './PropertyDrawer.jsx'
import ProposalModal from './ProposalModal.jsx'
import { supabase } from '../lib/supabase.js'

const GMAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY

const CITY_COLORS = {
  'Lancaster':     '#E63946',
  'Nicholasville': '#2D6FAF',
  'Crab Orchard':  '#3B6D11',
  'Harrodsburg':   '#6b21a8',
  'Danville':      '#D97825',
  'Bargain':       '#0891b2',
  'Brodhead':      '#0891b2',
  'Stanford':      '#be185d',
}

function cityFromAddress(address) {
  if (!address) return 'Unknown'
  const lower = address.toLowerCase()
  if (lower.includes('lancaster'))     return 'Lancaster'
  if (lower.includes('nicholasville')) return 'Nicholasville'
  if (lower.includes('crab orchard'))  return 'Crab Orchard'
  if (lower.includes('harrodsburg'))   return 'Harrodsburg'
  if (lower.includes('danville'))      return 'Danville'
  if (lower.includes('bargain'))       return 'Bargain'
  if (lower.includes('brodhead'))      return 'Brodhead'
  if (lower.includes('stanford') || lower.includes('standford')) return 'Stanford'
  return 'Unknown'
}

function cityColor(city) {
  return CITY_COLORS[city] || '#9ca3af'
}

function pinSvg(color, isMulti) {
  if (isMulti) {
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="34" height="42" viewBox="0 0 34 42">
        <filter id="s"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.35)"/></filter>
        <path d="M17 2 C9 2 3 8 3 16 C3 26 17 40 17 40 C17 40 31 26 31 16 C31 8 25 2 17 2Z"
              fill="${color}" stroke="#fff" stroke-width="2.5" filter="url(#s)"/>
        <path d="M17 9 L19.5 14.5 L25.5 15.3 L21 19.5 L22.3 25.5 L17 22.5 L11.7 25.5 L13 19.5 L8.5 15.3 L14.5 14.5Z"
              fill="#fff" opacity="0.95"/>
      </svg>
    `)}`
  }
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="26" height="36" viewBox="0 0 26 36">
      <filter id="s"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.3)"/></filter>
      <path d="M13 2 C6.4 2 1 7.4 1 14 C1 22.5 13 34 13 34 C13 34 25 22.5 25 14 C25 7.4 19.6 2 13 2Z"
            fill="${color}" stroke="#fff" stroke-width="2" filter="url(#s)"/>
      <circle cx="13" cy="14" r="5" fill="#fff" opacity="0.9"/>
    </svg>
  `)}`
}

// Street View Static API image URL — returns a placeholder if no coverage
function streetViewUrl(address) {
  return `https://maps.googleapis.com/maps/api/streetview?size=600x180&location=${encodeURIComponent(address)}&key=${GMAPS_API_KEY}&return_error_code=true`
}

let mapsLoading = null
function loadGoogleMaps() {
  if (window.google?.maps) return Promise.resolve()
  if (mapsLoading) return mapsLoading
  mapsLoading = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GMAPS_API_KEY}&libraries=places`
    script.async = true
    script.onload = resolve
    script.onerror = reject
    document.head.appendChild(script)
  })
  return mapsLoading
}

export default function PropertyMapModal({ properties: initialProperties, packageName, onClose, onSaveProperty }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef([])
  const infoWindowRef = useRef(null)
  const geocacheRef = useRef({})

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // Live property list — updated after saves so re-opened pins show fresh data
  const [properties, setProperties] = useState(initialProperties)
  // Property currently open in the side drawer (null = drawer closed)
  const [drawerProp, setDrawerProp] = useState(null)
  const [proposal, setProposal] = useState(null)

  // Refresh property data from DB after a save (keeps drawer open)
  const handleSave = useCallback(async () => {
    if (!drawerProp) return
    const { data } = await supabase
      .from('cashoffer_properties')
      .select('*')
      .eq('id', drawerProp.id)
      .single()
    if (data) {
      setProperties(prev => prev.map(p => p.id === data.id ? data : p))
      setDrawerProp(data)
    }
    onSaveProperty && onSaveProperty()
  }, [drawerProp, onSaveProperty])

  // Refresh data then close drawer — used as onClose in PropertyDrawer
  // so save-on-close works correctly without the drawer re-opening
  const handleDrawerClose = useCallback(async () => {
    if (drawerProp) {
      const { data } = await supabase
        .from('cashoffer_properties')
        .select('*')
        .eq('id', drawerProp.id)
        .single()
      if (data) {
        setProperties(prev => prev.map(p => p.id === data.id ? data : p))
      }
      onSaveProperty && onSaveProperty()
    }
    setDrawerProp(null)
  }, [drawerProp, onSaveProperty])

  // Wire __nhcOpenProp so info-window buttons can open the drawer
  // Re-run whenever the live properties list changes so drawer gets fresh data
  useEffect(() => {
    window.__nhcOpenProp = (id) => {
      infoWindowRef.current?.close()
      const prop = properties.find(p => p.id === id)
      if (prop) setDrawerProp(prop)
    }
    return () => { delete window.__nhcOpenProp }
  }, [properties])

  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        await loadGoogleMaps()
        if (cancelled) return

        const google = window.google
        const map = new google.maps.Map(mapRef.current, {
          center: { lat: 37.65, lng: -84.58 },
          zoom: 10,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          styles: [{ featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }],
        })
        mapInstanceRef.current = map

        const infoWindow = new google.maps.InfoWindow({ maxWidth: 320 })
        infoWindowRef.current = infoWindow

        setLoading(false)

        const geocoder = new google.maps.Geocoder()
        const bounds = new google.maps.LatLngBounds()
        let placed = 0

        for (const prop of properties) {
          if (cancelled) return
          const city = cityFromAddress(prop.address)
          const color = cityColor(city)
          const isMulti = (prop.unit_count || 1) > 1

          let latlng = geocacheRef.current[prop.id]
          if (!latlng) {
            try {
              latlng = await new Promise((resolve, reject) => {
                geocoder.geocode({ address: prop.address }, (results, status) => {
                  if (status === 'OK' && results[0]) resolve(results[0].geometry.location)
                  else reject(new Error(status))
                })
              })
              geocacheRef.current[prop.id] = latlng
            } catch { continue }
          }

          if (cancelled) return
          bounds.extend(latlng)
          placed++

          const marker = new google.maps.Marker({
            position: latlng,
            map,
            icon: {
              url: pinSvg(color, isMulti),
              scaledSize: new google.maps.Size(isMulti ? 34 : 26, isMulti ? 42 : 36),
              anchor: new google.maps.Point(isMulti ? 17 : 13, isMulti ? 40 : 34),
            },
            title: prop.address,
            optimized: false,
          })
          marker._propId = prop.id

          marker.addListener('click', () => {
            const svStaticUrl = streetViewUrl(prop.address)
            const svLiveUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${latlng.lat()},${latlng.lng()}`
            const content = `
              <div style="font-family:Helvetica Neue,sans-serif;width:300px;">
                <div style="position:relative;width:100%;height:160px;background:#f0ede6;border-radius:6px;overflow:hidden;margin-bottom:10px;">
                  <img
                    src="${svStaticUrl}"
                    alt="Street View"
                    style="width:100%;height:100%;object-fit:cover;display:block;"
                    onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"
                  />
                  <div style="display:none;position:absolute;inset:0;align-items:center;justify-content:center;flex-direction:column;gap:4px;color:#9ca3af;font-size:11px;">
                    <span style="font-size:24px;">📷</span>
                    No Street View available
                  </div>
                  <a href="${svLiveUrl}" target="_blank" rel="noopener"
                    style="position:absolute;bottom:6px;right:6px;background:rgba(0,0,0,0.6);color:#fff;border-radius:4px;padding:3px 8px;font-size:10px;font-weight:600;text-decoration:none;">
                    Open Street View ↗
                  </a>
                </div>
                <div style="font-size:13px;font-weight:700;color:#2C2C2C;margin-bottom:3px;line-height:1.3">${prop.address}</div>
                <div style="font-size:11px;color:${color};font-weight:600;margin-bottom:${isMulti ? 3 : 8}px">${city}</div>
                ${isMulti ? `<div style="font-size:11px;color:#6b7280;margin-bottom:8px">★ Package — ${prop.unit_count} units</div>` : ''}
                <button onclick="window.__nhcOpenProp('${prop.id}')"
                  style="width:100%;background:#B8892A;color:#fff;border:none;border-radius:5px;padding:7px 0;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">
                  Open Property Details →
                </button>
              </div>
            `
            infoWindow.setContent(content)
            infoWindow.open(map, marker)
          })
        }

        if (placed > 0) {
          map.fitBounds(bounds)
          if (placed === 1) map.setZoom(15)
        }
      } catch (e) {
        console.error('Map init error', e)
        setError('Could not load the map. Check your connection and try again.')
        setLoading(false)
      }
    }

    init()
    return () => {
      cancelled = true
      markersRef.current.forEach(m => m.setMap(null))
      markersRef.current = []
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const cities = [...new Set(properties.map(p => cityFromAddress(p.address)).filter(c => c !== 'Unknown'))]

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: '#fff', borderRadius: 12, overflow: 'hidden',
        width: 'min(1200px, 96vw)', height: 'min(780px, 94vh)',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 8px 40px rgba(0,0,0,0.3)',
        position: 'relative',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 20px', borderBottom: '1px solid #F0EDE6', flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#2C2C2C' }}>{packageName}</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
              {properties.length} properties · click a pin for Street View + details
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {cities.map(city => (
                <div key={city} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 9, height: 9, borderRadius: 2, background: cityColor(city), flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: '#6b7280' }}>{city}</span>
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 11 }}>★</span>
                <span style={{ fontSize: 10, color: '#6b7280' }}>Multi-unit</span>
              </div>
            </div>
            <button onClick={onClose} style={{
              background: 'none', border: 'none', fontSize: 20, cursor: 'pointer',
              color: '#9ca3af', lineHeight: 1, padding: 4, flexShrink: 0,
            }}>✕</button>
          </div>
        </div>

        {/* Map + drawer row */}
        <div style={{ flex: 1, position: 'relative', display: 'flex', overflow: 'hidden' }}>
          {/* Loading overlay */}
          {loading && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexDirection: 'column', gap: 10,
              background: '#FAFAF8', zIndex: 10,
            }}>
              <div style={{ fontSize: 13, color: '#6b7280' }}>Loading map and geocoding addresses…</div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>This may take a moment for large packages</div>
            </div>
          )}
          {error && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: '#B91C1C', fontSize: 13, zIndex: 10,
            }}>{error}</div>
          )}

          {/* Map — always rendered, shrinks when drawer is open */}
          <div ref={mapRef} style={{
            flex: 1,
            transition: 'flex 0.25s ease',
            minWidth: 0,
          }} />

          {/* Property drawer panel — slides in from the right, overlays the map */}
          {drawerProp && (
            <div style={{
              width: 480,
              flexShrink: 0,
              borderLeft: '1px solid #F0EDE6',
              background: '#fff',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              animation: 'slideInRight 0.2s ease',
            }}>
              <style>{`
                @keyframes slideInRight {
                  from { transform: translateX(100%); opacity: 0; }
                  to   { transform: translateX(0);    opacity: 1; }
                }
              `}</style>
              {/* Drawer header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', borderBottom: '1px solid #F0EDE6',
                background: '#FAFAF8', flexShrink: 0, position: 'sticky', top: 0, zIndex: 5,
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#2C2C2C', lineHeight: 1.3 }}>
                    {drawerProp.address}
                  </div>
                  <div style={{ fontSize: 11, color: cityColor(cityFromAddress(drawerProp.address)), marginTop: 2, fontWeight: 600 }}>
                    {cityFromAddress(drawerProp.address)}
                    {(drawerProp.unit_count || 1) > 1 && ` · ★ ${drawerProp.unit_count} units`}
                  </div>
                </div>
                <button
                  onClick={handleDrawerClose}
                  style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#9ca3af', padding: 4 }}
                >✕</button>
              </div>

              {/* Inline PropertyDrawer content — rendered inside our panel */}
              <div style={{ flex: 1 }}>
                <PropertyDrawer
                  property={drawerProp}
                  open={true}
                  onClose={handleDrawerClose}
                  onSave={handleSave}
                  mailings={[]}
                  onViewOffer={p => setProposal(p)}
                  inlineMode={true}
                />
              </div>
            </div>
          )}
          {proposal && <ProposalModal property={proposal} onClose={() => setProposal(null)} />}
        </div>
      </div>
    </div>
  )
}


