// Shared UI building blocks for NHC Cash Offer Hub
import { useState, useMemo, useRef, useEffect } from 'react'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/dist/style.css'
import { supabase } from '../lib/supabase.js'

export function Card({ children, style = {}, topColor = '#B8892A' }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 8,
      border: '0.5px solid #D6D2CA',
      borderTop: `3px solid ${topColor}`,
      padding: '12px 16px',
      ...style
    }}>
      {children}
    </div>
  )
}

export function StatCard({ label, value, sub, topColor = '#B8892A', onClick }) {
  return (
    <div onClick={onClick} style={{
      background: '#fff', borderRadius: 8,
      border: '0.5px solid #D6D2CA',
      borderTop: `3px solid ${topColor}`,
      padding: '14px 16px',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'box-shadow 0.15s',
    }}
    onMouseEnter={e => { if (onClick) e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)' }}
    onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.2, color: '#6b7280', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: '#2C2C2C', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

export function SectionBar({ children }) {
  return (
    <div style={{
      background: '#2C2C2C', color: '#fff',
      fontSize: 11, fontWeight: 700, letterSpacing: 2,
      textTransform: 'uppercase', padding: '8px 16px'
    }}>
      {children}
    </div>
  )
}

export function Modal({ title, onClose, children, width = 560, footer, isDirty, hideCloseButton = false }) {
  // If the caller passes isDirty (a function returning true when there are unsaved
  // local-draft changes), backdrop clicks and the × button only confirm when there's
  // actually something to lose — a no-op edit session closes silently.
  function guardedClose() {
    if (isDirty && isDirty()) {
      if (!confirm('Discard unsaved changes?')) return
    }
    onClose()
  }
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
      zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16
    }} onClick={e => e.target === e.currentTarget && guardedClose()}>
      <div data-clip-boundary style={{
        background: '#fff', borderRadius: 10, width: '100%', maxWidth: width,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        borderTop: '3px solid #B8892A'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottom: '1px solid #F0EDE6', flexShrink: 0
        }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#2C2C2C' }}>{title}</span>
          {!hideCloseButton && (
            <button onClick={guardedClose} style={{
              background: 'none', border: 'none', fontSize: 20, cursor: 'pointer',
              color: '#6b7280', lineHeight: 1, padding: '0 4px'
            }}>×</button>
          )}
        </div>
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {children}
        </div>
        {footer && (
          <div style={{ padding: '14px 20px', borderTop: '1px solid #F0EDE6', flexShrink: 0 }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

export function EmptyState({ icon = '○', text }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px', color: '#9ca3af' }}>
      <div style={{ fontSize: 36, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontSize: 13 }}>{text}</div>
    </div>
  )
}

export function PageWrap({ children, pad = true }) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
  return (
    <div style={{ padding: pad ? (isMobile ? '16px 12px' : '24px') : 0, width: '100%' }}>
      {children}
    </div>
  )
}

export function FieldRow({ children }) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : `repeat(${children.length || 2}, 1fr)`, gap: 12 }}>
      {children}
    </div>
  )
}

export function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

export const inp = {
  width: '100%', padding: '8px 10px',
  borderRadius: 6, border: '1px solid #D6D2CA',
  fontSize: 13, fontFamily: 'inherit',
  background: '#f9fafb', outline: 'none',
  color: '#2C2C2C'
}

export const monoInp = {
  ...inp, fontFamily: "'DM Mono', monospace"
}

// Formats a Date as a local YYYY-MM-DD string (never UTC — avoids the classic
// off-by-one bug from toISOString() shifting across midnight in local time).
function toYMD(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Drop-in replacement for <input type="date">. Fires onChange with the same
// {target:{value}} shape a native date input would, so existing `set('field')`
// curried handlers work unmodified.
export function DatePicker({ value, onChange, style = {}, placeholder = 'mm/dd/yyyy', disabled = false }) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target) && !e.target.closest('[data-datepicker-popover]')) setOpen(false)
    }
    function close() { setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  useEffect(() => {
    if (!open || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const POPOVER_W = 300, POPOVER_H = 340
    let left = rect.left
    let top = rect.bottom + 4
    if (left + POPOVER_W > window.innerWidth) left = Math.max(8, rect.right - POPOVER_W)
    if (top + POPOVER_H > window.innerHeight) top = rect.top - POPOVER_H - 4
    setCoords({ top, left })
  }, [open])

  const selected = value ? new Date(value + 'T12:00:00') : undefined
  const label = selected
    ? selected.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
    : ''

  function handleSelect(d) {
    if (d) onChange({ target: { value: toYMD(d) } })
    setOpen(false)
  }
  function handleClear(e) {
    e.stopPropagation()
    onChange({ target: { value: '' } })
  }

  return (
    <div ref={ref} style={{ position: 'relative', width: style.width || '100%' }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        style={{
          ...inp, textAlign: 'left', cursor: disabled ? 'default' : 'pointer',
          color: label ? '#2C2C2C' : '#9ca3af', display: 'flex',
          alignItems: 'center', justifyContent: 'space-between', gap: 6,
          ...style,
        }}
      >
        <span>{label || placeholder}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {label && !disabled && (
            <span onClick={handleClear} style={{ color: '#9ca3af', fontSize: 13, lineHeight: 1, cursor: 'pointer' }}>×</span>
          )}
          <span style={{ color: '#B8892A', fontSize: 13 }}>📅</span>
        </span>
      </button>
      {open && (
        <div data-datepicker-popover style={{
          position: 'fixed', zIndex: 9999, top: coords.top, left: coords.left,
          background: '#fff', border: '0.5px solid #D6D2CA', borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.18)', padding: 8,
        }}>
          <DayPicker
            mode="single"
            selected={selected}
            defaultMonth={selected}
            onSelect={handleSelect}
            style={{
              '--rdp-accent-color': '#B8892A',
              '--rdp-accent-background-color': '#B8892A18',
              '--rdp-today-color': '#2D6FAF',
              margin: 0,
            }}
          />
        </div>
      )}
    </div>
  )
}

export function Btn({ children, onClick, variant = 'primary', style: s = {}, disabled = false }) {
  const base = {
    border: 'none', borderRadius: 6, padding: '9px 18px',
    fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit', transition: 'all 0.15s', opacity: disabled ? 0.5 : 1, ...s
  }
  const variants = {
    primary:   { background: '#B8892A', color: '#fff' },
    secondary: { background: '#2C2C2C', color: '#fff' },
    outline:   { background: 'transparent', color: '#2C2C2C', border: '1px solid #D6D2CA' },
    danger:    { background: '#B91C1C', color: '#fff' },
    green:     { background: '#3B6D11', color: '#fff' },
  }
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant] }}>
      {children}
    </button>
  )
}

export function Badge({ children, color = '#B8892A' }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 4,
      fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase',
      background: color + '18', color: color, border: `1px solid ${color}40`
    }}>
      {children}
    </span>
  )
}

export function fmt(n) {
  if (n === null || n === undefined || n === '') return '—'
  const num = parseFloat(n)
  if (isNaN(num)) return '—'
  return '$' + Math.round(num).toLocaleString('en-US')
}

export function fmtK(n) {
  if (!n && n !== 0) return '—'
  const num = parseFloat(n)
  if (isNaN(num)) return '—'
  if (Math.abs(num) >= 1000000) return '$' + (num / 1000000).toFixed(1) + 'M'
  if (Math.abs(num) >= 1000) return '$' + Math.round(num / 1000) + 'K'
  return '$' + num.toLocaleString()
}

export function pct(n) {
  if (!n) return '—'
  return parseFloat(n).toFixed(1) + '%'
}

// ── Shared table sorting ─────────────────────────────────────────────────────
// useSort(rows, defaultKey, defaultDir, getValue?) returns { sorted, sortKey,
// sortDir, toggleSort }. getValue lets a column sort by a computed value
// (e.g. a calculated cash offer) rather than a raw row field — pass a map of
// { columnKey: row => value }. Falsy/empty values always sort to the bottom
// regardless of direction, since an empty "—" cell isn't meaningfully
// less-than or greater-than a real value.
export function useSort(rows, defaultKey = null, defaultDir = 'desc', getValue = {}) {
  const [sortKey, setSortKey] = useState(defaultKey)
  const [sortDir, setSortDir] = useState(defaultDir)

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const sorted = useMemo(() => {
    if (!sortKey) return rows
    const extract = getValue[sortKey] || (r => r[sortKey])
    const withVal = rows.map(r => ({ r, v: extract(r) }))
    const empty = withVal.filter(({v}) => v===null || v===undefined || v==='')
    const real = withVal.filter(({v}) => !(v===null || v===undefined || v===''))
    real.sort((a, b) => {
      const av = a.v, bv = b.v
      let cmp
      if (typeof av === 'string' && typeof bv === 'string') cmp = av.localeCompare(bv)
      else cmp = (parseFloat(av)||0) - (parseFloat(bv)||0)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return [...real, ...empty].map(({r}) => r)
  }, [rows, sortKey, sortDir, getValue])

  return { sorted, sortKey, sortDir, toggleSort }
}

// Drop-in replacement for a <th> that's clickable to sort. Pass the same
// sortKey/sortDir/toggleSort returned by useSort, plus this column's own key.
export function SortTh({ children, sortKeyName, sortKey, sortDir, toggleSort, style: s = {}, align = 'left' }) {
  const active = sortKey === sortKeyName
  return (
    <th onClick={()=>toggleSort(sortKeyName)} style={{
      padding:'8px 14px', textAlign:align, fontSize:11, fontWeight:600, letterSpacing:0.8,
      color: active ? '#2C2C2C' : '#6b7280', textTransform:'uppercase', cursor:'pointer',
      userSelect:'none', whiteSpace:'nowrap', ...s
    }}>
      <span style={{ display:'inline-flex', alignItems:'center', gap:4, justifyContent: align==='right' ? 'flex-end' : 'flex-start' }}>
        {children}
        <span style={{ fontSize:9, color: active ? '#B8892A' : '#D6D2CA', lineHeight:1 }}>
          {active ? (sortDir === 'asc' ? '▲' : '▼') : '▼'}
        </span>
      </span>
    </th>
  )
}

export function LoadingSpinner() {
  return (
    <div style={{ textAlign: 'center', padding: 48, color: '#B8892A', fontSize: 24 }}>
      ⟳
    </div>
  )
}

// ── Shared partner-funding ledger (used by Rehab and Rent turn expenses) ─────
export const PAID_BY_OPTIONS = ['BPV', 'Bob', 'Eric']
export const PARTNERS = ['Bob', 'Eric'] // BPV = company money, no interest owed to itself

// Declining-balance simple interest at 10%/yr. Each payment first clears accrued
// interest, then reduces principal — interest going forward accrues only on what's left.
export function calcOwed(originalAmount, datePaid, repayments, asOf = new Date()) {
  const principal0 = parseFloat(originalAmount) || 0
  if (!datePaid || principal0 <= 0) return { balance: principal0, accruedInterest: 0, totalOwed: principal0, totalRepaid: 0 }
  const RATE = 0.10
  const sorted = [...repayments].sort((a,b) => new Date(a.payment_date) - new Date(b.payment_date))
  let balance = principal0
  let accrued = 0
  let lastDate = new Date(datePaid + 'T12:00:00')
  let totalRepaid = 0
  for (const p of sorted) {
    const pd = new Date(p.payment_date + 'T12:00:00')
    const days = Math.max(0, (pd - lastDate) / 86400000)
    accrued += balance * RATE * (days / 365)
    let remaining = parseFloat(p.amount) || 0
    totalRepaid += remaining
    if (remaining <= accrued) { accrued -= remaining }
    else { remaining -= accrued; accrued = 0; balance = Math.max(0, balance - remaining) }
    lastDate = pd
  }
  const daysSince = Math.max(0, (asOf - lastDate) / 86400000)
  accrued += balance * RATE * (daysSince / 365)
  return { balance, accruedInterest: accrued, totalOwed: balance + accrued, totalRepaid }
}

export function PartnerLedger({ sourceType, sourceId, originalAmount, datePaid, onDatePaidChange, closingDate }) {
  const [payments, setPayments] = useState([])

  useEffect(() => {
    supabase.from('cashoffer_partner_repayments').select('*')
      .eq('source_type', sourceType).eq('source_id', sourceId).order('payment_date', { ascending: true })
      .then(({ data }) => setPayments(data || []))
  }, [sourceId])

  const today = new Date()
  const asOf = closingDate ? new Date(Math.min(today, new Date(closingDate + 'T12:00:00'))) : today
  const { accruedInterest } = calcOwed(originalAmount, datePaid, payments, asOf)

  return (
    <div style={{ display:'contents' }}>
      <DatePicker value={datePaid||''} onChange={e=>onDatePaidChange(e.target.value)} style={{ fontSize:11, padding:'4px 6px', marginRight:6 }} />
      <div style={{ fontSize:12, fontWeight:700, fontFamily:'monospace', color:'#B8892A', textAlign:'right', marginRight:6, whiteSpace:'nowrap' }}>
        {fmt(accruedInterest)}
      </div>
    </div>
  )
}

export function NoPartnerCells() {
  return (
    <div style={{ display:'contents' }}>
      <div style={{ fontSize:12, color:'#D6D2CA', textAlign:'center' }}>—</div>
      <div style={{ fontSize:12, color:'#D6D2CA', textAlign:'right', marginRight:6 }}>—</div>
    </div>
  )
}



