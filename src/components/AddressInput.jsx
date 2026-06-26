import { useState, useEffect, useRef } from 'react'
import { inp } from './ui.jsx'

export default function AddressInput({ value, onChange, placeholder = '123 Main St, Lexington KY' }) {
  const [query, setQuery] = useState(value || '')
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounce = useRef(null)
  const wrapRef = useRef(null)

  // Sync external value changes (e.g. loading a saved property)
  useEffect(() => { setQuery(value || '') }, [value])

  // Close on outside click
  useEffect(() => {
    function handler(e) { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function handleChange(e) {
    const val = e.target.value
    setQuery(val)
    onChange(val) // keep parent in sync as user types

    clearTimeout(debounce.current)
    if (val.length < 3) { setSuggestions([]); setOpen(false); return }

    debounce.current = setTimeout(() => search(val), 350)
  }

  async function search(q) {
    setLoading(true)
    try {
      // Bias toward Kentucky — countrycodes=us, viewbox around KY, bounded=0 so it falls back globally
      const params = new URLSearchParams({
        q: q + ', Kentucky',
        format: 'json',
        addressdetails: 1,
        limit: 6,
        countrycodes: 'us',
        viewbox: '-89.57,39.15,-81.96,36.49', // KY bounding box
        bounded: 0,
      })
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: { 'Accept-Language': 'en', 'User-Agent': 'NHC-CashOfferHub/1.0' }
      })
      const data = await res.json()
      setSuggestions(data.slice(0, 6))
      setOpen(data.length > 0)
    } catch {
      setSuggestions([])
      setOpen(false)
    }
    setLoading(false)
  }

  function select(item) {
    // Build a clean US address string
    const a = item.address || {}
    const parts = [
      [a.house_number, a.road].filter(Boolean).join(' '),
      a.city || a.town || a.village || a.county,
      a.state,
      a.postcode,
    ].filter(Boolean)
    const formatted = parts.join(', ')
    setQuery(formatted)
    onChange(formatted)
    setSuggestions([])
    setOpen(false)
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <input
          style={{ ...inp, paddingRight: loading ? 32 : 10 }}
          value={query}
          onChange={handleChange}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
        />
        {loading && (
          <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#B8892A' }}>⟳</div>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
          background: '#fff', border: '1px solid #D6D2CA', borderRadius: 6,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)', marginTop: 2, overflow: 'hidden'
        }}>
          {suggestions.map((s, i) => {
            const a = s.address || {}
            const street = [a.house_number, a.road].filter(Boolean).join(' ')
            const city   = a.city || a.town || a.village || a.county || ''
            const state  = a.state || ''
            const zip    = a.postcode || ''
            return (
              <div key={s.place_id} onMouseDown={()=>select(s)} style={{
                padding: '9px 14px', cursor: 'pointer', fontSize: 13,
                background: i % 2 === 0 ? '#fff' : '#FAFAF8',
                borderTop: i > 0 ? '0.5px solid #F0EDE6' : 'none',
                transition: 'background 0.1s'
              }}
              onMouseEnter={e=>e.currentTarget.style.background='#fef9f0'}
              onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'#fff':'#FAFAF8'}>
                <div style={{ fontWeight: 600, color: '#2C2C2C' }}>{street || s.display_name.split(',')[0]}</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{[city, state, zip].filter(Boolean).join(', ')}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
