import { useIsMobile } from '../hooks/useIsMobile.js'
import OverviewCard, { OverviewSection } from '../components/OverviewCard.jsx'

export default function ToolsHome({ onNavigate, isAdmin }) {
  const isMobile = useIsMobile()
  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: isMobile ? '16px 12px' : '32px 24px' }}>
      <div style={{ marginBottom: isMobile ? 16 : 28 }}>
        <h1 style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700, color: '#2C2C2C', margin: 0 }}>Tools</h1>
        <p style={{ color: '#888', fontSize: isMobile ? 12 : 14, margin: '4px 0 0' }}>Vendors, supplies, inventory, and other shared utilities outside the deal pipeline</p>
      </div>

      <OverviewSection title="Operations">
        <OverviewCard
          icon="🧰"
          title="Vendors"
          description="Manage the vendor list used across rehabs and turns."
          onClick={() => onNavigate('vendors')}
        />
        <OverviewCard
          icon="📦"
          title="Supplies"
          description="Track supply orders and costs tied to renovations."
          onClick={() => onNavigate('supplies')}
        />
        <OverviewCard
          icon="🗄"
          title="Inventory"
          description="Track equipment and signage checkout for the team."
          onClick={() => onNavigate('inventory')}
        />
        <OverviewCard
          icon="🛠"
          title="Improvements"
          description="Log and track app improvement requests and bug reports."
          onClick={() => onNavigate('opslog')}
        />
      </OverviewSection>

      {isAdmin && (
        <OverviewSection title="Admin">
          <OverviewCard
            icon="👤"
            title="Users"
            description="Manage who can sign into Cash Offer Hub and their role."
            onClick={() => onNavigate('users')}
          />
          <OverviewCard
            icon="🏢"
            title="Business"
            description="Manage companies and LLCs (like BE Property Ventures) that can own properties, and the people behind each one."
            onClick={() => onNavigate('business')}
          />
        </OverviewSection>
      )}
    </div>
  )
}
