import { useState, useEffect, useRef } from 'react'
import { inp } from './ui.jsx'

const GMAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY

// Shared loader — reuses script if already injected (e.g. by PropertyMapModal)
let placesLoading = null
function loadPlaces() {
  // Already loaded
  if (window.google?.maps?.places) return Promise.resolve()
  // Script already injected, wait for it
  if (placesLoading) return placesLoading
  placesLoading = new Promise((resolve, reject) => {
    // If Maps is already loaded but Places library isn't, we can't re-load the
    // script — use the callback approach to request just the places library
    if (window.google?.maps && !window.google.maps.places) {
      // Maps loaded but places missing — load places via dynamic import
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GMAPS_API_KEY}&libraries=places&callback=__nhcPlacesReady`
      window.__nhcPlacesReady = () => { delete window.__nhcPlacesReady; resolve() }
      script.onerror = reject
      document.head.appendChild(script)
    } else if (!window.google?.maps) {
      // Nothing loaded yet — load maps + places together
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GMAPS_API_KEY}&libraries=places&callback=__nhcPlacesReady`
      window.__nhcPlacesReady = () => { delete window.__nhcPlacesReady; resolve() }
      script.onerror = reject
      document.head.appendChild(script)
    } else {
      // Places already available
      resolve()
    }
  })
  return placesLoading
}

export default function AddressInput({ value, onChange, placeholder = '123 Main St, Lexington KY' }) {
  const inputRef = useRef(null)
  const autocompleteRef = useRef(null)
  const [query, setQuery] = useState(value || '')
  const [ready, setReady] = useState(false)

  // Sync external value changes (e.g. loading a saved property)
  useEffect(() => { setQuery(value || '') }, [value])

  // Load Places API and attach Autocomplete to the input
  useEffect(() => {
    let cancelled = false
    loadPlaces().then(() => {
      if (cancelled || !inputRef.current) return
      const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
        types: ['address'],
        componentRestrictions: { country: 'us' },
        fields: ['formatted_address', 'address_components', 'geometry'],
      })
      autocompleteRef.current = ac

      ac.addListener('place_changed', () => {
        const place = ac.getPlace()
        if (!place.formatted_address) return

        // Build a clean address: "123 Main St, City, ST ZIP"
        const comps = {}
        for (const c of place.address_components || []) {
          for (const t of c.types) comps[t] = c
        }
        const streetNum  = comps['street_number']?.long_name || ''
        const route      = comps['route']?.long_name || ''
        const city       = comps['locality']?.long_name || comps['sublocality']?.long_name || ''
        const state      = comps['administrative_area_level_1']?.short_name || ''
        const zip        = comps['postal_code']?.long_name || ''

        const formatted = [
          [streetNum, route].filter(Boolean).join(' '),
          city,
          state,
          zip,
        ].filter(Boolean).join(', ')

        const final = formatted || place.formatted_address
        setQuery(final)
        onChange(final)
      })

      setReady(true)
    }).catch(() => {
      // Places failed to load — fall back gracefully (input still works, just no autocomplete)
      setReady(true)
    })

    return () => {
      cancelled = true
      // Clean up listener
      if (autocompleteRef.current && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current)
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleChange(e) {
    const val = e.target.value
    setQuery(val)
    onChange(val) // keep parent in sync as user types
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        style={inp}
        value={query}
        onChange={handleChange}
        placeholder={placeholder}
        autoComplete="off"
      />
    </div>
  )
}
