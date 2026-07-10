import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase.js'
import { calcOffers } from '../lib/valuation.js'
import { Field, FieldRow, inp, monoInp, fmt } from './ui.jsx'
import { TourSection, ConditionRatings, PropertyComments } from './PropertyTour.jsx'
import ProposalModal from './ProposalModal.jsx'

const DEFAULT_REPAIRS = [
  { name:'Flooring', sqft:'', pricePerSqft:'', cost:'' },
  { name:'Painting', sqft:'', pricePerSqft:'', cost:'' },
  { name:'Demo / Cleanup', sqft:'', pricePerSqft:'', cost:'' },
  { name:'Drywall', sqft:'', pricePerSqft:'', cost:'' },
  { name:'Appliances', sqft:'', pricePerSqft:'', cost:'' },
  { name:'Plumbing', sqft:'', pricePerSqft:'', cost:'' },
  { name:'Electrical', sqft:'', pricePerSqft:'', cost:'' },
  { name:'Misc', sqft:'', pricePerSqft:'', cost:'' },
]

function driveFolderId(link) {
  if (!link) return null
  const trimmed = link.trim()
  const folderMatch = trimmed.match(/folders\/([a-zA-Z0-9_-]+)/)
  if (folderMatch) return folderMatch[1]
  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (idParamMatch) return idParamMatch[1]
  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed)) return trimmed
  return null
}

const TABS = [
  { key:'tour', label:'3D Tour' },
  { key:'drive', label:'Photos (Drive)' },
  { key:'condition', label:'Condition' },
  { key:'notes', label:'Notes' },
]

function DriveTab({ propertyId, link, onSaved }) {
  const [editing, setEditing] = useState(!link)
  const [draft, setDraft] = useState(link || '')
  const [saving, setSaving] = useState(false)

  useEffect(() => { setDraft(link || ''); setEditing(!link) }, [propertyId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    setSaving(true)
    await supabase.from('cashoffer_properties').update({ photos_drive_link: draft || null }).eq('id', propertyId)
    setSaving(false); setEditing(false); onSaved && onSaved()
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      <div className="drawer-section">Photos (Google Drive)</div>
      {editing ? (
        <Field label="Google Drive folder link">
          <div style={{ display:'flex', gap:6 }}>
            <input style={{ ...inp, flex:1 }} placeholder="Paste a shared Drive folder link" value={draft} onChange={e=>setDraft(e.target.value)} />
            <button onClick={save} disabled={saving} style={{ background:'#B8892A', color:'#fff', border:'none', borderRadius:6, padding:'0 14px', cursor:'pointer', fontSize:12, fontWeight:700, fontFamily:'inherit' }}>{saving?'Saving...':'Save'}</button>
          </div>
          {draft && !driveFolderId(draft) && <div style={{ fontSize:11, color:'#B91C1C', marginTop:6 }}>Couldn't read a folder ID from that link.</div>}
        </Field>
      ) : (
        <div style={{ display:'flex', gap:6 }}>
          <button
            onClick={()=>window.open(`https://drive.google.com/drive/folders/${driveFolderId(link)}`, 'nhc_photos', 'width=1400,height=950,noopener,noreferrer')}
            style={{ flex:1, background:'#fff', border:'1.5px solid #B8892A', borderRadius:8, padding:'10px 16px', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'space-between' }}
          >
            <div style={{ fontSize:13, fontWeight:700, color:'#B8892A' }}>Open Photos Folder</div>
            <span style={{ fontSize:18, color:'#B8892A' }}>&#8599;</span>
          </button>
          <button onClick={()=>setEditing(true)} title="Edit link" style={{ width:40, background:'#fff', border:'1.5px solid #D6D2CA', borderRadius:8, cursor:'pointer', fontSize:15, color:'#9ca3af' }}>&#9998;</button>
        </div>
      )}
    </div>
  )
}

export default function PropertyFullView({ propertyId }) {
  const [property, setProperty] = useState(null)
  const [repairs, setRepairs] = useState([])
  const [tab, setTab] = useState('tour')
  const [proposalOpen, setProposalOpen] = useState(false)
  const [savedAt, setSavedAt] = useState(null)
  const saveTimer = useRef(null)
  const loadedRef = useRef(false)

  useEffect(() => { load() }, [propertyId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    const { data } = await supabase.from('cashoffer_properties').select('*').eq('id', propertyId).single()
    if (!data) return
    setProperty(data)
    setRepairs(data.repair_items?.length ? data.repair_items.map((r,i)=>({...r,id:i})) : DEFAULT_REPAIRS.map((r,i)=>({...r,id:i})))
    loadedRef.current = true
  }

  // Debounced autosave: any change to valuation fields or repairs writes back after a short pause.
  useEffect(() => {
    if (!loadedRef.current || !property) return
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      const repair_items = repairs.filter(r=>r.name||r.cost).map(r=>({ name:r.name, sqft:r.sqft, pricePerSqft:r.pricePerSqft, cost:r.cost }))
      const { id, ...patch } = property
      await supabase.from('cashoffer_properties').update({ ...patch, repair_items }).eq('id', propertyId)
      setSavedAt(new Date())
    }, 700)
    return () => clearTimeout(saveTimer.current)
  }, [property, repairs]) // eslint-disable-line react-hooks/exhaustive-deps

  function set(field) { return e => setProperty(p => ({ ...p, [field]: e.target.value })) }
  function updateRepair(id, field, value) {
    setRepairs(rs => rs.map(r => {
      if (r.id !== id) return r
      const next = { ...r, [field]: value }
      if (field === 'sqft' || field === 'pricePerSqft') {
        const sqft = parseFloat(field==='sqft'?value:next.sqft) || 0
        const price = parseFloat(field==='pricePerSqft'?value:next.pricePerSqft) || 0
        if (sqft && price) next.cost = String(Math.round(sqft*price))
      }
      return next
    }))
  }
  function addRepair() { setRepairs(rs => [...rs, { id: Date.now(), name:'', sqft:'', pricePerSqft:'', cost:'' }]) }
  function removeRepair(id) { setRepairs(rs => rs.filter(r => r.id !== id)) }

  if (!property) return <div style={{ padding:40, textAlign:'center', color:'#9ca3af' }}>Loading...</div>

  const d = calcOffers(property, repairs)

  return (
    <div style={{ minHeight:'100vh', background:'#FAFAF8', fontFamily:'inherit' }}>
      <div style={{ background:'#fff', borderBottom:'2px solid #B8892A', padding:'14px 24px', display:'flex', alignItems:'center', gap:12 }}>
        <img src="/nhc-logo.svg" alt="NHC" style={{ width:26, height:26 }} />
        <div style={{ fontSize:16, fontWeight:700, color:'#2C2C2C' }}>{property.address || 'Property'}</div>
        <span style={{ marginLeft:'auto', fontSize:11, color:'#9ca3af' }}>{savedAt ? `Saved ${savedAt.toLocaleTimeString()}` : ''}</span>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'minmax(380px, 460px) 1fr', gap:20, padding:20, alignItems:'start' }}>
        <div style={{ background:'#fff', borderRadius:10, border:'0.5px solid #D6D2CA', padding:20, position:'sticky', top:20, display:'flex', flexDirection:'column', gap:14 }}>
          <div className="drawer-section">Valuation</div>
          <Field label="After Renovation Value ($)">
            <input style={{ ...monoInp, borderLeft:'3px solid #D97825' }} type="number" value={property.arv||''} onChange={set('arv')} />
          </Field>
          <FieldRow>
            <Field label="As-Is Deduction %"><input style={monoInp} type="number" value={property.asis_pct||50} onChange={set('asis_pct')} /></Field>
            <Field label="As-Is Listing Price Override ($)"><input style={monoInp} type="number" value={property.asis_override||''} onChange={set('asis_override')} /></Field>
          </FieldRow>
          <FieldRow>
            <Field label="Profit Margin %"><input style={monoInp} type="number" value={property.profit_margin||15} onChange={set('profit_margin')} /></Field>
            <Field label="Cash Offer Override ($)"><input style={monoInp} type="number" value={property.cash_offer_override||''} onChange={set('cash_offer_override')} /></Field>
          </FieldRow>
          <FieldRow>
            <Field label="Holding % / mo"><input style={monoInp} type="number" step="0.05" value={property.hold_opt3_pct||0.5} onChange={set('hold_opt3_pct')} /></Field>
            <Field label="Holding Months"><input style={monoInp} type="number" value={property.hold_opt3_months||6} onChange={set('hold_opt3_months')} /></Field>
          </FieldRow>

          {property.arv && (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {[
                { label:'Cash Offer', value:d.cashOffer, color:'#3B6D11' },
                { label:'As-Is Net', value:d.opt2Net, color:'#2D6FAF' },
                { label:'Full Retail', value:d.opt3Net, color:'#D97825' },
              ].map(card=>(
                <div key={card.label} style={{ background:'#FAFAF8', borderRadius:6, padding:'8px 12px', borderTop:`3px solid ${card.color}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ fontSize:11, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.6 }}>{card.label}</div>
                  <div style={{ fontSize:16, fontWeight:700, fontFamily:'monospace', color:card.color }}>{fmt(card.value)}</div>
                </div>
              ))}
            </div>
          )}

          <div className="drawer-section">Repairs ({fmt(d.reno)} total)</div>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>
                {['Item','Sq Ft','$/Sq Ft','Total',''].map((h,i)=>(
                  <th key={h} style={{ textAlign:i===0?'left':i===4?'center':'center', fontSize:10, color:'#9ca3af', fontWeight:600, textTransform:'uppercase', letterSpacing:0.5, paddingBottom:4, width:i===4?24:undefined }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {repairs.map(r=>(
                <tr key={r.id}>
                  <td style={{ paddingBottom:6, paddingRight:6 }}><input style={{ ...inp, fontSize:12 }} value={r.name||''} onChange={e=>updateRepair(r.id,'name',e.target.value)} /></td>
                  <td style={{ paddingBottom:6, paddingRight:6 }}><input style={{ ...monoInp, fontSize:12, textAlign:'center' }} type="number" value={r.sqft||''} onChange={e=>updateRepair(r.id,'sqft',e.target.value)} /></td>
                  <td style={{ paddingBottom:6, paddingRight:6 }}><input style={{ ...monoInp, fontSize:12, textAlign:'center' }} type="number" step="0.01" value={r.pricePerSqft||''} onChange={e=>updateRepair(r.id,'pricePerSqft',e.target.value)} /></td>
                  <td style={{ paddingBottom:6, paddingRight:6 }}>
                    <div style={{ ...monoInp, fontSize:12, textAlign:'center', background:'#FAFAF8', color:'#2C2C2C', fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center' }}>{r.cost?fmt(r.cost):'—'}</div>
                  </td>
                  <td style={{ paddingBottom:6, textAlign:'center' }}><button onClick={()=>removeRepair(r.id)} style={{ background:'none', border:'none', color:'#D6D2CA', cursor:'pointer', fontSize:16, padding:0 }}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={addRepair} style={{ background:'transparent', border:'1px dashed #D6D2CA', borderRadius:6, padding:'6px', color:'#9ca3af', fontSize:12, cursor:'pointer', fontFamily:'inherit', width:'100%' }}>+ Add Line Item</button>

          {property.arv && (
            <button onClick={()=>setProposalOpen(true)}
              style={{ background:'#2D6FAF', color:'#fff', border:'none', borderRadius:6, padding:'11px 16px', cursor:'pointer', fontSize:13, fontWeight:700, fontFamily:'inherit', width:'100%', marginTop:4 }}>
              Generate Offer
            </button>
          )}
        </div>

        <div style={{ background:'#fff', borderRadius:10, border:'0.5px solid #D6D2CA', padding:20 }}>
          <div style={{ display:'flex', gap:0, borderBottom:'2px solid #F0EDE6', marginBottom:16 }}>
            {TABS.map(t=>(
              <button key={t.key} onClick={()=>setTab(t.key)} style={{
                padding:'8px 18px', border:'none', background:'none', cursor:'pointer',
                fontSize:12.5, fontWeight:tab===t.key?700:400, fontFamily:'inherit',
                color:tab===t.key?'#B8892A':'#6b7280',
                borderBottom:tab===t.key?'2px solid #B8892A':'2px solid transparent',
                marginBottom:-2, letterSpacing:0.4,
              }}>{t.label}</button>
            ))}
          </div>

          {tab==='tour' && <TourSection propertyId={propertyId} tourUrl={property.zillow_tour_url} onSaved={load} />}
          {tab==='condition' && <ConditionRatings propertyId={propertyId} />}
          {tab==='notes' && (
            <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <div className="drawer-section">Analyzer Notes</div>
                <textarea style={{ ...inp, minHeight:70, resize:'vertical' }} value={property.nhc_notes||''} onChange={set('nhc_notes')} />
              </div>
              <PropertyComments propertyId={propertyId} />
            </div>
          )}
          {tab==='drive' && <DriveTab propertyId={propertyId} link={property.photos_drive_link} onSaved={load} />}
        </div>
      </div>

      {proposalOpen && (
        <ProposalModal
          property={{ ...property, repair_items: repairs.filter(r=>r.name||r.cost).map(r=>({ name:r.name, cost:parseFloat(r.cost)||0 })) }}
          onClose={()=>setProposalOpen(false)}
        />
      )}
    </div>
  )
}
