const GOLD = '#B8892A'
const CHARCOAL = '#2C2C2C'

export function OverviewSection({ title, children }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: CHARCOAL, margin: '0 0 12px' }}>{title}</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
        {children}
      </div>
    </div>
  )
}

export default function OverviewCard({ icon, title, description, badgeCount, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, textAlign: 'left',
        background: '#fff', border: '1px solid #E5E1D8', borderRadius: 10, padding: '18px 18px',
        cursor: 'pointer', fontFamily: 'inherit', transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = GOLD; e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.06)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E1D8'; e.currentTarget.style.boxShadow = 'none' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: CHARCOAL }}>{title}</span>
        {!!badgeCount && (
          <span style={{ marginLeft: 'auto', background: '#B22020', color: '#fff', borderRadius: 10, fontSize: 11, fontWeight: 700, padding: '1px 8px' }}>
            {badgeCount}
          </span>
        )}
      </div>
      <p style={{ margin: 0, fontSize: 12.5, color: '#888', lineHeight: 1.4 }}>{description}</p>
    </button>
  )
}
