import { useEffect, useRef, useState } from 'react'

const GMAPS_API_KEY = 'AIzaSyD1t3hw0au4bO6byD5y6bW0YvpyWb4f1nI'

// City color palette — distinct, readable on map
const CITY_COLORS = {
  'Lancaster':         '#E63946', // red
  'Nicholasville':     '#2D6FAF', // blue
  'Crab Orchard':      '#3B6D11', // green
  'Harrodsburg':       '#6b21a8', // purple
  'Danville':          '#D97825', // orange
  'Bargain':           '#0891b2', // teal
  'Brodhead':          '#0891b2', // teal (same as Bargain)
  'Stanford':          '#be185d', // pink
}

const CITY_LABEL_COLOR = '#fff'

// Derive city from address string
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

// Build an SVG data URL for a map pin
// isPackage = multi-unit: larger, star-topped, double-border
function pinSvg(color, isPackage) {
  if (isPackage) {
    // Diamond / stacked style for multi-unit
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="34" height="42" viewBox="0 0 34 42">
        <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.35)"/>
        </filter>
        <path d="M17 2 C9 2 3 8 3 16 C3 26 17 40 17 40 C17 40 31 26 31 16 C31 8 25 2 17 2Z"
              fill="${color}" stroke="#fff" stroke-width="2.5" filter="url(#shadow)"/>
        <path d="M17 9 L19.5 14.5 L25.5 15.3 L21 19.5 L22.3 25.5 L17 22.5 L11.7 25.5 L13 19.5 L8.5 15.3 L14.5 14.5Z"
              fill="#fff" opacity="0.95"/>
      </svg>
    `)}`
  } else {
    // Standard teardrop pin
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="26" height="36" viewBox="0 0 26 36">
        <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.3)"/>
        </filter>
        <path d="M13 2 C6.4 2 1 7.4 1 14 C1 22.5 13 34 13 34 C13 34 25 22.5 25 14 C25 7.4 19.6 2 13 2Z"
              fill="${color}" stroke="#fff" stroke-width="2" filter="url(#shadow)"/>
        <circle cx="13" cy="14" r="5" fill="#fff" opacity="0.9"/>
      </svg>
    `)}`
  }
}

// Loads Google Maps JS API once, returns promise
let mapsLoading = null
function loadGoogleMaps() {
  if (window.google?.maps) return Promise.resolve()
  if (mapsLoading) return mapsLoading
  mapsLoading = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GMAPS_API_KEY}`
    script.async = true
    script.onload = resolve
    script.onerror = reject
    document.head.appendChild(script)
  })
  return mapsLoading
}

export default function PropertyMapModal({ properties, packageName, onClose, onOpenProperty }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef([])
  const infoWindowRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activePin, setActivePin] = useState(null) // property id

  // Geocode cache so we don't re-geocode on re-render
  const geocacheRef = useRef({})

  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        await loadGoogleMaps()
        if (cancelled) return

        const google = window.google
        const center = { lat: 37.65, lng: -84.58 } // Central KY

        const map = new google.maps.Map(mapRef.current, {
          center,
          zoom: 10,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          styles: [
            { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
          ],
        })
        mapInstanceRef.current = map

        const infoWindow = new google.maps.InfoWindow()
        infoWindowRef.current = infoWindow

        setLoading(false)

        // Geocode and place markers
        const geocoder = new google.maps.Geocoder()
        const bounds = new google.maps.LatLngBounds()
        let placed = 0

        for (const prop of properties) {
          if (cancelled) return
          const city = cityFromAddress(prop.address)
          const color = cityColor(city)
          const isPackage = (prop.unit_count || 1) > 1

          // Geocode
          let latlng = geocacheRef.current[prop.id]
          if (!latlng) {
            try {
              const result = await new Promise((resolve, reject) => {
                geocoder.geocode({ address: prop.address }, (results, status) => {
                  if (status === 'OK' && results[0]) resolve(results[0].geometry.location)
                  else reject(new Error(status))
                })
              })
              latlng = result
              geocacheRef.current[prop.id] = result
            } catch {
              continue // skip if geocode fails
            }
          }

          if (cancelled) return

          bounds.extend(latlng)
          placed++

          const icon = {
            url: pinSvg(color, isPackage),
            scaledSize: new google.maps.Size(isPackage ? 34 : 26, isPackage ? 42 : 36),
            anchor: new google.maps.Point(isPackage ? 17 : 13, isPackage ? 40 : 34),
          }

          const marker = new google.maps.Marker({
            position: latlng,
            map,
            icon,
            title: prop.address,
            optimized: false,
          })
          marker._propId = prop.id
          markersRef.current.push(marker)

          marker.addListener('click', () => {
            setActivePin(prop.id)
            const svUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${latlng.lat()},${latlng.lng()}&key=${GMAPS_API_KEY}`
            const content = `
              <div style="font-family:Helvetica Neue,sans-serif;min-width:220px;max-width:280px;">
                <div style="font-size:13px;font-weight:700;color:#2C2C2C;margin-bottom:4px;line-height:1.3">${prop.address}</div>
                <div style="font-size:11px;color:${color};font-weight:600;margin-bottom:${isPackage ? 4 : 8}px">${city}</div>
                ${isPackage ? `<div style="font-size:11px;color:#6b7280;margin-bottom:8px">★ Package — ${prop.unit_count} units</div>` : ''}
                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                  <button onclick="window.__nhcOpenProp('${prop.id}')"
                    style="background:#B8892A;color:#fff;border:none;border-radius:4px;padding:5px 11px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit">
                    Open Details
                  </button>
                  <a href="${svUrl}" target="_blank" rel="noopener"
                    style="background:#2D6FAF;color:#fff;border-radius:4px;padding:5px 11px;font-size:11px;font-weight:600;text-decoration:none;display:inline-block">
                    Street View
                  </a>
                </div>
              </div>
            `
            infoWindow.setContent(content)
            infoWindow.open(map, marker)
          })
        }

        // Expose open-property callback to the info window button
        window.__nhcOpenProp = (id) => {
          const prop = properties.find(p => p.id === id)
          if (prop) { infoWindow.close(); onOpenProperty(prop) }
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
      // Clean up markers and global callback
      markersRef.current.forEach(m => m.setMap(null))
      markersRef.current = []
      delete window.__nhcOpenProp
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Build legend from unique cities in this package
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
        width: 'min(1100px, 95vw)', height: 'min(720px, 92vh)',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 8px 40px rgba(0,0,0,0.3)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottom: '1px solid #F0EDE6', flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#2C2C2C' }}>{packageName}</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{properties.length} properties · click a pin to open details or launch Street View</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* Legend */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {cities.map(city => (
                <div key={city} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: cityColor(city), flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: '#6b7280' }}>{city}</span>
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 12 }}>★</span>
                <span style={{ fontSize: 10, color: '#6b7280' }}>Package deal</span>
              </div>
            </div>
            <button onClick={onClose} style={{
              background: 'none', border: 'none', fontSize: 20, cursor: 'pointer',
              color: '#9ca3af', lineHeight: 1, padding: 4,
            }}>✕</button>
          </div>
        </div>

        {/* Map area */}
        <div style={{ flex: 1, position: 'relative' }}>
          {loading && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexDirection: 'column', gap: 10, background: '#FAFAF8',
            }}>
              <div style={{ fontSize: 13, color: '#6b7280' }}>Loading map and geocoding addresses…</div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>This may take a moment for large packages</div>
            </div>
          )}
          {error && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: '#B91C1C', fontSize: 13,
            }}>{error}</div>
          )}
          <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
        </div>
      </div>
    </div>
  )
}
