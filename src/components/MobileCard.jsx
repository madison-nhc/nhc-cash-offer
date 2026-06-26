// Compact card for mobile list views — replaces table rows on small screens

export default function MobileCard({ onClick, children, accent = '#B8892A', faded = false }) {
  return (
    <div onClick={onClick} style={{
      background: faded ? '#f9f9f9' : '#fff',
      borderRadius: 8,
      border: '0.5px solid #D6D2CA',
      borderLeft: `3px solid ${accent}`,
      padding: '11px 14px',
      marginBottom: 8,
      cursor: onClick ? 'pointer' : 'default',
      opacity: faded ? 0.55 : 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      WebkitTapHighlightColor: 'transparent',
    }}>
      {children}
    </div>
  )
}

export function CardRow({ children, style = {} }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', ...style }}>
      {children}
    </div>
  )
}

export function CardLabel({ children }) {
  return <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.8, color: '#9ca3af', textTransform: 'uppercase' }}>{children}</span>
}

export function CardValue({ children, color, mono }) {
  return <span style={{ fontSize: 13, fontWeight: 600, color: color || '#2C2C2C', fontFamily: mono ? 'monospace' : 'inherit' }}>{children}</span>
}
