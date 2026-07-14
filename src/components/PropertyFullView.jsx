import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase.js'
import { calcOffers } from '../lib/valuation.js'
import { Field, FieldRow, inp, monoInp, fmt, Modal } from './ui.jsx'
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
  { key:'offer', label:'Offer' },
  { key:'tour', label:'3D Tour' },
  { key:'drive', label:'Photos (Drive)' },
  { key:'condition', label:'Condition' },
  { key:'notes', label:'Notes' },
]

function DrivePhotoGrid({ folderId }) {
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [viewIndex, setViewIndex] = useState(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => { if (folderId) load() }, [folderId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true); setError(null)
    try {
      const key = import.meta.env.VITE_GOOGLE_DRIVE_KEY
      if (!key) { setError('Drive API key not configured yet.'); setLoading(false); return }
      const q = encodeURIComponent(`'${folderId}' in parents and mimeType contains 'image/' and trashed = false`)
      const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,thumbnailLink)&pageSize=200&key=${key}`
      const res = await fetch(url)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error?.message || 'Failed to load photos')
      setPhotos(data.files || [])
    } catch (e) {
      setError(e.message || 'Could not load photos from Drive.')
    }
    setLoading(false)
  }

  function bigUrl(thumbnailLink) {
    return (thumbnailLink || '').replace(/=s\d+/, '=s1600')
  }

  function openAt(i) { setViewIndex(i); setPlaying(false) }
  function close() { setViewIndex(null); setPlaying(false) }
  function next() { setViewIndex(i => (i + 1) % photos.length) }
  function prev() { setViewIndex(i => (i - 1 + photos.length) % photos.length) }

  // Slideshow autoplay
  useEffect(() => {
    if (!playing) return
    const t = setInterval(next, 3000)
    return () => clearInterval(t)
  }, [playing, photos.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard navigation while viewer is open
  useEffect(() => {
    if (viewIndex == null) return
    function onKey(e) {
      if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'Escape') close()
      else if (e.key === ' ') { e.preventDefault(); setPlaying(p => !p) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [viewIndex, photos.length]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div style={{ textAlign:'center', padding:16, color:'#9ca3af', fontSize:12 }}>Loading photos...</div>
  if (error) return <div style={{ fontSize:11.5, color:'#B91C1C', padding:'8px 2px' }}>{error}</div>
  if (!photos.length) return <div style={{ fontSize:12, color:'#9ca3af', padding:'8px 2px' }}>No photos found in this folder.</div>

  const current = viewIndex != null ? photos[viewIndex] : null

  return (
    <>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ fontSize:11, color:'#9ca3af' }}>{photos.length} photo{photos.length===1?'':'s'}</div>
        <button
          onClick={()=>{ setPlaying(true); setViewIndex(0) }}
          style={{ background:'#fff', border:'1px solid #D6D2CA', borderRadius:6, padding:'5px 12px', fontSize:11.5, fontWeight:700, color:'#B8892A', cursor:'pointer', fontFamily:'inherit' }}
        >&#9654; Slideshow</button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(90px, 1fr))', gap:6 }}>
        {photos.map((p, i) => (
          <img
            key={p.id} src={p.thumbnailLink} alt={p.name}
            onClick={()=>openAt(i)}
            style={{ width:'100%', aspectRatio:'1', objectFit:'cover', borderRadius:6, border:'1px solid #D6D2CA', cursor:'pointer' }}
          />
        ))}
      </div>
      {current && (
        <Modal title={`${current.name}  (${viewIndex+1} / ${photos.length})`} onClose={close} width={860}>
          <div style={{ position:'relative', display:'flex', alignItems:'center', justifyContent:'center', minHeight:400 }}>
            <button onClick={prev} title="Previous (\u2190)" style={{
              position:'absolute', left:0, width:36, height:36, borderRadius:'50%', background:'#fff',
              border:'1px solid #D6D2CA', fontSize:16, cursor:'pointer', color:'#6b7280', zIndex:1,
            }}>&#8249;</button>
            <img src={bigUrl(current.thumbnailLink)} alt={current.name} style={{ maxWidth:'100%', maxHeight:'70vh', borderRadius:8, display:'block' }} />
            <button onClick={next} title="Next (\u2192)" style={{
              position:'absolute', right:0, width:36, height:36, borderRadius:'50%', background:'#fff',
              border:'1px solid #D6D2CA', fontSize:16, cursor:'pointer', color:'#6b7280', zIndex:1,
            }}>&#8250;</button>
          </div>
          <div style={{ display:'flex', justifyContent:'center', marginTop:12 }}>
            <button
              onClick={()=>setPlaying(p=>!p)}
              style={{ background: playing?'#B8892A':'#fff', color: playing?'#fff':'#B8892A', border:'1px solid #B8892A', borderRadius:6, padding:'6px 16px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}
            >{playing ? '\u23F8 Pause Slideshow' : '\u25B6 Play Slideshow'}</button>
          </div>
        </Modal>
      )}
    </>
  )
}

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
        <>
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
          <DrivePhotoGrid folderId={driveFolderId(link)} />
        </>
      )}
    </div>
  )
}

export default function PropertyFullView({ propertyId, onClose, isAgentRole=false }) {
  const [property, setProperty] = useState(null)
  const [repairs, setRepairs] = useState([])
  const [tab, setTab] = useState('offer')
  const [savedAt, setSavedAt] = useState(null)
  const [notifying, setNotifying] = useState(false)
  const [offerSnapshot, setOfferSnapshot] = useState(null)
  const [offerGeneratedAt, setOfferGeneratedAt] = useState(null)
  const saveTimer = useRef(null)
  const loadedRef = useRef(false)

  useEffect(() => { load() }, [propertyId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    const { data } = await supabase.from('cashoffer_properties').select('*').eq('id', propertyId).single()
    if (!data) return
    setProperty(data)
    setRepairs(data.repair_items?.length ? data.repair_items.map((r,i)=>({...r,id:i})) : DEFAULT_REPAIRS.map((r,i)=>({...r,id:i})))
    setOfferSnapshot(data.offer_snapshot || null)
    setOfferGeneratedAt(data.offer_generated_at || null)
    loadedRef.current = true
  }

  // Only these fields actually change what the offer looks like — comparing the
  // whole property object would falsely flag "changed" for things like notes or
  // the Drive link, which have nothing to do with the offer.
  const OFFER_FIELDS = ['address','beds','baths','sqft','arv','asis_pct','asis_override','profit_margin','profit_override',
    'cash_offer_override','hold_cash_pct','hold_cash_months','hold_opt2_pct','hold_opt2_months','hold_opt3_pct','hold_opt3_months',
    'comm_cash_offer_pct','comm_cash_arv_pct','comm_list_pct']
  function pickOfferFields(prop, reps) {
    const picked = {}
    OFFER_FIELDS.forEach(k => { picked[k] = prop[k] })
    picked.repair_items = reps.filter(r=>r.name||r.cost).map(r=>({ name:r.name, cost:parseFloat(r.cost)||0 }))
    return picked
  }
  // Snapshots taken before a field existed (e.g. comm_cash_offer_pct) simply lack that
  // key, which isn't the same as it being null in JSON.stringify's output — that alone
  // was making every old offer look permanently "out of date". Normalize both sides so
  // a missing key and an explicit null compare as equal.
  function normalizeForCompare(snap) {
    const out = {}
    OFFER_FIELDS.forEach(k => {
      let v = (snap && snap[k] !== undefined) ? snap[k] : null
      if (v === '') v = null
      // Inputs write strings ("875000"), DB reloads give numbers (875000) — same value,
      // different JS type, which made JSON.stringify see a "change" that was never made.
      if (v !== null && k !== 'address') {
        const n = Number(v)
        if (!Number.isNaN(n)) v = n
      }
      out[k] = v
    })
    out.repair_items = ((snap && snap.repair_items) || []).map(r => ({ name: r.name||'', cost: Number(r.cost)||0 }))
    return out
  }
  async function regenerateOffer() {
    const snap = pickOfferFields(property, repairs)
    const now = new Date().toISOString()
    setOfferSnapshot(snap)
    setOfferGeneratedAt(now)
    await supabase.from('cashoffer_properties').update({ offer_snapshot: snap, offer_generated_at: now }).eq('id', propertyId)
  }
  const offerIsDirty = offerSnapshot && JSON.stringify(normalizeForCompare(pickOfferFields(property||{}, repairs))) !== JSON.stringify(normalizeForCompare(offerSnapshot))

  async function notifyAgent() {
    if (!property.agent_email || property.agent_email === '__outside_agent__' || notifying) return
    const { data: { session } } = await supabase.auth.getSession()
    const { error } = await supabase.from('cashoffer_notifications').insert({
      property_id: propertyId,
      recipient_email: property.agent_email,
      sender_email: session?.user?.email || null,
      message: `Your offer for ${property.address || 'this property'} is ready to review.`,
    })
    if (error) { alert(`Could not send notification: ${error.message}`); return }
    setNotifying(true)
    setTimeout(() => setNotifying(false), 2500)
  }

  // Debounced autosave: any change to valuation fields or repairs writes back after a short pause.
  useEffect(() => {
    if (!loadedRef.current || !property) return
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      const repair_items = repairs.filter(r=>r.name||r.cost).map(r=>({ name:r.name, sqft:r.sqft, pricePerSqft:r.pricePerSqft, cost:r.cost }))
      const { id, ...rest } = property
      // Cleared number inputs land here as '' — Postgres numeric columns reject that, so
      // treat blank as "use the calc default" (null) rather than erroring the save.
      const patch = Object.fromEntries(Object.entries(rest).map(([k,v]) => [k, v==='' ? null : v]))
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
        next.cost = (sqft && price) ? String(Math.round(sqft*price)) : ''
      }
      return next
    }))
  }
  function addRepair() { setRepairs(rs => [...rs, { id: Date.now(), name:'', sqft:'', pricePerSqft:'', cost:'' }]) }
  function removeRepair(id) { setRepairs(rs => rs.filter(r => r.id !== id)) }

  if (!property) return <div style={{ padding:40, textAlign:'center', color:'#9ca3af' }}>Loading...</div>

  const d = calcOffers(property, repairs)

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'#FAFAF8', fontFamily:'inherit' }}>
      <div style={{ background:'#fff', borderBottom:'2px solid #B8892A', padding:'14px 24px', display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
        <img src="/nhc-logo.svg" alt="NHC" style={{ width:26, height:26 }} />
        <div style={{ fontSize:16, fontWeight:700, color:'#2C2C2C' }}>{property.address || 'Property'}</div>
        <span style={{ marginLeft:'auto', fontSize:11, color:'#9ca3af', marginRight: onClose ? 36 : 0 }}>{savedAt ? `Saved ${savedAt.toLocaleTimeString()}` : ''}</span>
      </div>

      <div style={{ flex:1, minHeight:0, display:'grid', gridTemplateColumns:'minmax(380px, 460px) 1fr', gap:20, padding:20, alignItems:'stretch' }}>
        <div style={{ background:'#fff', borderRadius:10, border:'0.5px solid #D6D2CA', padding:20, height:'100%', overflowY:'auto', display:'flex', flexDirection:'column', gap:14 }}>
          <div className="drawer-section">Valuation</div>
          <Field label="After Renovation Value ($)">
            <input style={{ ...monoInp, borderLeft:'3px solid #D97825', opacity: isAgentRole ? 0.6 : 1 }} type="number" value={property.arv??''} onChange={set('arv')} disabled={isAgentRole} />
          </Field>
          <FieldRow>
            <Field label="As-Is Deduction %"><input style={{ ...monoInp, minHeight:34, opacity: isAgentRole ? 0.6 : 1 }} type="number" placeholder="50" value={property.asis_pct??''} onChange={set('asis_pct')} disabled={isAgentRole} /></Field>
            <Field label="As-Is Override ($)"><input style={{ ...monoInp, minHeight:34, opacity: isAgentRole ? 0.6 : 1 }} type="number" value={property.asis_override??''} onChange={set('asis_override')} disabled={isAgentRole} /></Field>
          </FieldRow>
          <FieldRow>
            <Field label="Profit Margin %"><input style={{ ...monoInp, minHeight:34, opacity: isAgentRole ? 0.6 : 1 }} type="number" placeholder="15" value={property.profit_margin??''} onChange={set('profit_margin')} disabled={isAgentRole} /></Field>
            <Field label="Cash Offer Override ($)"><input style={{ ...monoInp, minHeight:34, opacity: isAgentRole ? 0.6 : 1 }} type="number" value={property.cash_offer_override??''} onChange={set('cash_offer_override')} disabled={isAgentRole} /></Field>
          </FieldRow>

          <div style={{ fontSize:10, fontWeight:700, color:'#2D6FAF', textTransform:'uppercase', letterSpacing:0.6, marginTop:4 }}>Holding Cost — As-Is Net</div>
          <FieldRow>
            <Field label="As-Is Holding % / mo"><input style={{ ...monoInp, minHeight:34, opacity: isAgentRole ? 0.6 : 1 }} type="number" step="0.05" placeholder="0.5" value={property.hold_opt2_pct??''} onChange={set('hold_opt2_pct')} disabled={isAgentRole} /></Field>
            <Field label="As-Is Holding Months"><input style={{ ...monoInp, minHeight:34, opacity: isAgentRole ? 0.6 : 1 }} type="number" placeholder="3" value={property.hold_opt2_months??''} onChange={set('hold_opt2_months')} disabled={isAgentRole} /></Field>
          </FieldRow>

          <div style={{ fontSize:10, fontWeight:700, color:'#D97825', textTransform:'uppercase', letterSpacing:0.6, marginTop:4 }}>Holding Cost — Full Retail</div>
          <FieldRow>
            <Field label="Full Retail Holding % / mo"><input style={{ ...monoInp, minHeight:34, opacity: isAgentRole ? 0.6 : 1 }} type="number" step="0.05" placeholder="0.5" value={property.hold_opt3_pct??''} onChange={set('hold_opt3_pct')} disabled={isAgentRole} /></Field>
            <Field label="Full Retail Holding Months"><input style={{ ...monoInp, minHeight:34, opacity: isAgentRole ? 0.6 : 1 }} type="number" placeholder="6" value={property.hold_opt3_months??''} onChange={set('hold_opt3_months')} disabled={isAgentRole} /></Field>
          </FieldRow>

          {property.arv && (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {[
                { label:'Cash Offer', value:d.cashOffer, color:'#3B6D11', overridden:!!property.cash_offer_override, overrideField:'cash_offer_override', rows:[
                  { l:'ARV', v:fmt(d.arv) },
                  { l:'Repairs', v:`−${fmt(d.reno)}` },
                  { l:`Comm (${(d.commOfferPct*100).toFixed(1).replace(/\.0$/,'')}% of offer)`, v:`−${fmt(d.commOfferAmt)}` },
                  { l:`Comm (${(d.commArvPct*100).toFixed(1).replace(/\.0$/,'')}% of ARV)`, v:`−${fmt(d.commArvAmt)}` },
                  { l:`Holding (${d.cashHoldMo}mo)`, v:`−${fmt(d.cashHold)}` },
                  { l:'Profit margin', v:`−${fmt(d.profit)}` },
                ]},
                { label:'As-Is Net', value:d.opt2Net, color:'#2D6FAF', overridden:!!property.asis_override, overrideField:'asis_override', rows:[
                  { l:'ARV', v:fmt(d.arv) },
                  { l:'As-Is Deduction', v:`−${fmt(d.asisDeduction)}` },
                  { l:'Listing Price', v:fmt(d.asisVal), strong:true },
                  { l:`Comm (${(d.commListPct*100).toFixed(1).replace(/\.0$/,'')}%)`, v:`−${fmt(d.opt2Comm)}` },
                  { l:`Holding (${d.opt2HoldMo}mo)`, v:`−${fmt(d.opt2Hold)}` },
                ]},
                { label:'Full Retail', value:d.opt3Net, color:'#D97825', rows:[
                  { l:'ARV', v:fmt(d.arv) },
                  { l:'Repairs', v:`−${fmt(d.reno)}` },
                  { l:`Comm (${(d.commListPct*100).toFixed(1).replace(/\.0$/,'')}%)`, v:`−${fmt(d.opt3Comm)}` },
                  { l:`Holding (${d.opt3HoldMo}mo)`, v:`−${fmt(d.opt3Hold)}` },
                ]},
              ].map(card=>(
                <div key={card.label} style={{ background:'#FAFAF8', borderRadius:6, padding:'8px 12px', borderTop:`3px solid ${card.color}` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div style={{ fontSize:11, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.6 }}>{card.label}</div>
                    <div style={{ fontSize:16, fontWeight:700, fontFamily:'monospace', color:card.color }}>{fmt(card.value)}</div>
                  </div>
                  {card.overridden && (
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, marginTop:4, background:'#FEF3C7', border:'1px solid #FDE68A', borderRadius:4, padding:'4px 8px' }}>
                      <span style={{ fontSize:10, color:'#92400E', fontWeight:700 }}>🔒 Override active — edits below won't change this number</span>
                      <button onClick={()=>set(card.overrideField)({ target:{ value:'' } })} disabled={isAgentRole} style={{ fontSize:10, color:'#92400E', background:'none', border:'none', textDecoration:'underline', cursor: isAgentRole ? 'not-allowed' : 'pointer', fontFamily:'inherit', flexShrink:0, opacity: isAgentRole ? 0.6 : 1 }}>Clear</button>
                    </div>
                  )}
                  <div style={{ marginTop:6, paddingTop:6, borderTop:'1px solid #F0EDE6', fontSize:10, color:'#6b7280', lineHeight:1.7 }}>
                    {card.rows.map(r=>(
                      <div key={r.l} style={{
                        display:'flex', justifyContent:'space-between',
                        ...(r.strong ? { borderTop:'1px solid #E5E1DB', marginTop:2, paddingTop:2, color:'#2C2C2C', fontWeight:700 } : {}),
                      }}>
                        <span>{r.l}</span><span style={{ fontFamily:'monospace' }}>{r.v}</span>
                      </div>
                    ))}
                  </div>
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
                  <td style={{ paddingBottom:6, paddingRight:6 }}><input style={{ ...inp, fontSize:12, opacity: isAgentRole ? 0.6 : 1 }} value={r.name||''} onChange={e=>updateRepair(r.id,'name',e.target.value)} disabled={isAgentRole} /></td>
                  <td style={{ paddingBottom:6, paddingRight:6 }}><input style={{ ...monoInp, fontSize:12, textAlign:'center', opacity: isAgentRole ? 0.6 : 1 }} type="number" value={r.sqft||''} onChange={e=>updateRepair(r.id,'sqft',e.target.value)} disabled={isAgentRole} /></td>
                  <td style={{ paddingBottom:6, paddingRight:6 }}><input style={{ ...monoInp, fontSize:12, textAlign:'center', opacity: isAgentRole ? 0.6 : 1 }} type="number" step="0.01" value={r.pricePerSqft||''} onChange={e=>updateRepair(r.id,'pricePerSqft',e.target.value)} disabled={isAgentRole} /></td>
                  <td style={{ paddingBottom:6, paddingRight:6 }}>
                    <div style={{ ...monoInp, fontSize:12, textAlign:'center', background:'#FAFAF8', color:'#2C2C2C', fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center' }}>{r.cost?fmt(r.cost):'—'}</div>
                  </td>
                  <td style={{ paddingBottom:6, textAlign:'center' }}><button onClick={()=>removeRepair(r.id)} disabled={isAgentRole} style={{ background:'none', border:'none', color:'#D6D2CA', cursor: isAgentRole ? 'not-allowed' : 'pointer', fontSize:16, padding:0 }}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={addRepair} disabled={isAgentRole} style={{ background:'transparent', border:'1px dashed #D6D2CA', borderRadius:6, padding:'6px', color:'#9ca3af', fontSize:12, cursor: isAgentRole ? 'not-allowed' : 'pointer', fontFamily:'inherit', width:'100%', opacity: isAgentRole ? 0.6 : 1 }}>+ Add Line Item</button>
        </div>

        <div style={{ background:'#fff', borderRadius:10, border:'0.5px solid #D6D2CA', padding:20, height:'100%', overflowY:'auto' }}>
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

          {tab==='offer' && (
            !property.arv ? (
              <div style={{ fontSize:12, color:'#9ca3af', padding:'20px 0', textAlign:'center' }}>Set an ARV in Valuation to generate an offer.</div>
            ) : !offerSnapshot ? (
              <div style={{ textAlign:'center', padding:'40px 0' }}>
                <div style={{ fontSize:13, color:'#9ca3af', marginBottom:14 }}>No offer generated yet.</div>
                <button onClick={regenerateOffer} style={{ background:'#2D6FAF', color:'#fff', border:'none', borderRadius:6, padding:'10px 20px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                  Generate Offer
                </button>
              </div>
            ) : (
              <div>
                {offerGeneratedAt && (
                  <div style={{ fontSize:10, color:'#9ca3af', marginBottom:8, textAlign:'right' }}>Generated {new Date(offerGeneratedAt).toLocaleString()}</div>
                )}
                <ProposalModal embedded property={offerSnapshot} />
              </div>
            )
          )}
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

      <div style={{ flexShrink:0, background:'#fff', borderTop:'2px solid #B8892A', padding:'12px 24px', display:'flex', justifyContent:'flex-end', alignItems:'center', gap:12, boxShadow:'0 -4px 14px rgba(0,0,0,0.06)' }}>
        {!isAgentRole && property.agent_email && property.agent_email !== '__outside_agent__' && (
          <button
            onClick={notifyAgent}
            disabled={notifying}
            style={{
              marginRight:'auto', background:'#fff', border:'1.5px solid #B8892A', color:'#B8892A',
              borderRadius:6, padding:'10px 16px', cursor: notifying ? 'default' : 'pointer',
              fontSize:12.5, fontWeight:700, fontFamily:'inherit', display:'flex', alignItems:'center', gap:6,
            }}>
            🔔 {notifying ? 'Sent!' : 'Notify Agent'}
          </button>
        )}
        {offerIsDirty && (
          <span style={{ fontSize:11, color:'#92400E', fontWeight:700 }}>⚠ Offer is out of date</span>
        )}
        {offerSnapshot && !offerIsDirty && (
          <span style={{ fontSize:11, color:'#9ca3af', fontWeight:600 }}>✓ Offer is up to date</span>
        )}
        <button
          onClick={()=>{ regenerateOffer(); setTab('offer') }}
          disabled={!property.arv || (offerSnapshot && !offerIsDirty)}
          style={{
            background: !property.arv ? '#D6D2CA'
              : (offerSnapshot && !offerIsDirty) ? '#E5E1DB'
              : offerIsDirty ? '#D97825'
              : '#2D6FAF',
            color: (offerSnapshot && !offerIsDirty && property.arv) ? '#9ca3af' : '#fff',
            border:'none', borderRadius:6, padding:'11px 24px',
            cursor: (property.arv && !(offerSnapshot && !offerIsDirty)) ? 'pointer' : 'not-allowed',
            fontSize:13, fontWeight:700, fontFamily:'inherit',
          }}>
          {!offerSnapshot ? 'Generate Offer' : offerIsDirty ? 'Re-Generate Offer' : 'Most Recent'}
        </button>
      </div>
    </div>
  )
}
