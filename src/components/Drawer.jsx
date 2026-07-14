import { useEffect } from 'react'

export default function Drawer({ open, onClose, title, subtitle, children, width = 520, headerActions, hideCloseButton = false, footer }) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
  const actualWidth = isMobile ? '100vw' : width
  // Lock scroll when open
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Escape key
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
        zIndex: 200, transition: 'opacity 0.2s'
      }} />

      {/* Drawer panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: actualWidth, maxWidth: '100vw',
        background: '#fff', zIndex: 201,
        boxShadow: '-4px 0 32px rgba(0,0,0,0.15)',
        display: 'flex', flexDirection: 'column',
        borderLeft: isMobile ? 'none' : '3px solid #B8892A',
        borderTop: isMobile ? '3px solid #B8892A' : 'none',
        animation: 'slideIn 0.22s ease-out'
      }}>
        <style>{`
          @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to   { transform: translateX(0);    opacity: 1; }
          }
          .drawer-row { display: flex; justify-content: space-between; align-items: baseline; padding: 7px 0; border-bottom: 1px solid #F0EDE6; font-size: 13px; }
          .drawer-row:last-child { border-bottom: none; }
          .drawer-label { font-size: 11px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.8px; }
          .drawer-value { font-weight: 600; color: #2C2C2C; }
          .drawer-section { font-size: 10px; font-weight: 700; letter-spacing: 2px; color: #B8892A; text-transform: uppercase; padding: 14px 0 6px; border-bottom: 1px solid #F0EDE6; margin-bottom: 2px; }
        `}</style>

        {/* Header */}
        <div style={{ padding: '18px 24px 14px', borderBottom: '1px solid #F0EDE6', flexShrink: 0, overflowX: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div style={{ minWidth: 0, flex: '1 1 auto' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#2C2C2C', lineHeight: 1.3 }}>{title}</div>
              {subtitle && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3 }}>{subtitle}</div>}
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:14, flexShrink:0 }}>
              {headerActions}
              {!hideCloseButton && (
                <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#9ca3af', lineHeight: 1, padding: 0 }}>×</button>
              )}
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 24px 24px' }}>
          {children}
        </div>

        {footer && (
          <div style={{ padding: '14px 24px', borderTop: '1px solid #F0EDE6', flexShrink: 0, background: '#fff' }}>
            {footer}
          </div>
        )}
      </div>
    </>
  )
}


