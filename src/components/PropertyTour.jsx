import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase.js'
import { Field, inp, Btn, Modal, fmt } from './ui.jsx'

const COND_CATS = ['Exterior / Curb Appeal', 'Roof', 'Foundation / Structure', 'Kitchen', 'Bathrooms', 'Electrical', 'Plumbing', 'HVAC / Mechanical', 'Flooring', 'Windows & Doors']
const RATINGS = ['Good', 'Fair', 'Poor', 'Unknown']
const RATING_COLOR = { Good: '#3B6D11', Fair: '#B8892A', Poor: '#B91C1C', Unknown: '#9ca3af' }

function relTime(iso) {
  if (!iso) return ''
  const ms = new Date(iso).getTime()
  const diff = Date.now() - ms
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return m + (m === 1 ? ' minute ago' : ' minutes ago')
  const h = Math.floor(m / 60)
  if (h < 24) return h + (h === 1 ? ' hour ago' : ' hours ago')
  const d = Math.floor(h / 24)
  if (d === 1) return 'yesterday'
  if (d < 30) return d + ' days ago'
  return new Date(ms).toLocaleDateString()
}

function zillowBase(url) { return (url || '').split('?')[0] }
function tourEmbedUrl(url, type) {
  const b = zillowBase(url)
  return b ? `${b}?initialViewType=${type}&utm_source=nhc` : ''
}

const getReviewerName = () => localStorage.getItem('nhc_reviewer_name') || ''
const setReviewerName = n => localStorage.setItem('nhc_reviewer_name', (n || '').trim())

// -- Tour embed + link --
export function TourSection({ propertyId, tourUrl, onSaved }) {
  const [editing, setEditing] = useState(!tourUrl)
  const [draft, setDraft] = useState(tourUrl || '')
  const [view, setView] = useState('pano')
  const [saving, setSaving] = useState(false)

  useEffect(() => { setDraft(tourUrl || ''); setEditing(!tourUrl) }, [propertyId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    setSaving(true)
    await supabase.from('cashoffer_properties').update({ zillow_tour_url: draft || null }).eq('id', propertyId)
    setSaving(false)
    setEditing(false)
    onSaved && onSaved()
  }

  const badUrl = draft && !/zillow\.com\/view-imx\//i.test(draft)

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      <div className="drawer-section">3D Tour</div>
      {editing ? (
        <Field label="Zillow 3D Home Tour URL">
          <div style={{ display:'flex', gap:6 }}>
            <input style={{ ...inp, flex:1 }} placeholder="https://www.zillow.com/view-imx/..." value={draft} onChange={e=>setDraft(e.target.value)} />
            <Btn onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Btn>
          </div>
          {badUrl && <div style={{ fontSize:11, color:'#B91C1C', marginTop:6 }}>This may not be a Zillow 3D Home tour link, it should start with zillow.com/view-imx/...</div>}
        </Field>
      ) : (
        <>
          <div style={{ display:'flex', gap:6, alignItems:'stretch' }}>
            <button
              onClick={()=>window.open(tourEmbedUrl(tourUrl, view), 'nhc_tour', 'width=1400,height=950,noopener,noreferrer')}
              style={{ flex:1, background:'#fff', border:'1.5px solid #2D6FAF', borderRadius:8, padding:'10px 16px', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'space-between' }}
            >
              <div style={{ textAlign:'left' }}>
                <div style={{ fontSize:13, fontWeight:700, color:'#2D6FAF' }}>Open 3D Tour - Large View</div>
                <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>Opens the Zillow tour in a separate window</div>
              </div>
              <span style={{ fontSize:18, color:'#2D6FAF' }}>&#8599;</span>
            </button>
            <button onClick={()=>setEditing(true)} title="Edit tour link" style={{ width:40, background:'#fff', border:'1.5px solid #D6D2CA', borderRadius:8, cursor:'pointer', fontSize:15, color:'#9ca3af', flexShrink:0 }}>&#9998;</button>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            {[{ v:'pano', label:'Panorama Tour' }, { v:'floorplan', label:'Floor Plan' }].map(t=>(
              <button key={t.v} onClick={()=>setView(t.v)} style={{
                border:`1px solid ${view===t.v?'#2D6FAF':'#D6D2CA'}`, background: view===t.v?'#2D6FAF18':'#fff',
                color: view===t.v?'#2D6FAF':'#6b7280', borderRadius:6, padding:'5px 12px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit',
              }}>{t.label}</button>
            ))}
          </div>
          <iframe title="Zillow 3D Tour" src={tourEmbedUrl(tourUrl, view)} style={{ width:'100%', height:380, border:'0.5px solid #D6D2CA', borderRadius:8 }} allow="fullscreen; gyroscope; accelerometer" allowFullScreen loading="lazy" />
        </>
      )}
    </div>
  )
}

// -- Condition rating checklist --
export function ConditionRatings({ propertyId }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [reviewer, setReviewer] = useState(getReviewerName())
  const [viewPhoto, setViewPhoto] = useState(null)
  const fileInputRef = useRef(null)
  const photoTargetRef = useRef(null)

  useEffect(() => { if (propertyId) load() }, [propertyId])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('cashoffer_condition_ratings').select('*').eq('property_id', propertyId).order('sort_order', { ascending:true })
    setRows(data || [])
    setLoading(false)
  }

  function rowFor(cat) { return rows.find(r => r.category === cat && !r.is_custom) }
  const customRows = rows.filter(r => r.is_custom)

  async function rate(cat, rating, existing) {
    const name = reviewer.trim() || getReviewerName()
    if (!name) { alert('Add your reviewer name first.'); return }
    setReviewerName(name)
    const payload = { property_id: propertyId, category: cat, rating, updated_by: name, updated_at: new Date().toISOString() }
    if (existing) {
      await supabase.from('cashoffer_condition_ratings').update(payload).eq('id', existing.id)
    } else {
      await supabase.from('cashoffer_condition_ratings').insert(payload)
    }
    load()
  }

  function openPhotoPicker(existing, cat) {
    photoTargetRef.current = { existing, cat }
    fileInputRef.current.value = ''
    fileInputRef.current.click()
  }

  function handleFile(e) {
    const f = e.target.files[0]
    const target = photoTargetRef.current
    if (!f || !target) return
    if (!f.type.startsWith('image/')) { alert('Please choose an image file.'); return }
    const rd = new FileReader()
    rd.onload = () => {
      const img = new Image()
      img.onload = async () => {
        const max = 900, scale = Math.min(1, max / Math.max(img.width, img.height))
        const cv = document.createElement('canvas')
        cv.width = Math.round(img.width * scale); cv.height = Math.round(img.height * scale)
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height)
        const photo = cv.toDataURL('image/jpeg', 0.72)
        const { existing, cat } = target
        if (existing) {
          await supabase.from('cashoffer_condition_ratings').update({ photo }).eq('id', existing.id)
        } else {
          await supabase.from('cashoffer_condition_ratings').insert({ property_id: propertyId, category: cat, photo })
        }
        load()
      }
      img.src = rd.result
    }
    rd.readAsDataURL(f)
  }

  async function removePhoto(existing) {
    if (!existing) return
    await supabase.from('cashoffer_condition_ratings').update({ photo: null }).eq('id', existing.id)
    load()
  }

  async function addCustom() {
    await supabase.from('cashoffer_condition_ratings').insert({ property_id: propertyId, category: `custom_${Date.now()}`, is_custom: true, label: '', sort_order: rows.length })
    load()
  }
  async function renameCustom(row, label) {
    await supabase.from('cashoffer_condition_ratings').update({ label }).eq('id', row.id)
  }
  async function deleteCustom(row) {
    await supabase.from('cashoffer_condition_ratings').delete().eq('id', row.id)
    load()
  }

  const rated = rows.filter(r => r.rating && r.rating !== 'Unknown')
  const poorCount = rated.filter(r => r.rating === 'Poor').length
  const overall = !rated.length ? { label:'Not rated yet', color:'#9ca3af' }
    : poorCount > 0 ? { label:`Issues Found (${poorCount} poor rating${poorCount>1?'s':''})`, color:'#B91C1C' }
    : rated.every(r=>r.rating==='Good') ? { label:'Solid', color:'#3B6D11' }
    : { label:'Mixed Condition', color:'#B8892A' }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      <div className="drawer-section">Condition Rating</div>
      <Field label="Reviewer Name"><input style={inp} value={reviewer} onChange={e=>setReviewer(e.target.value)} onBlur={e=>setReviewerName(e.target.value)} placeholder="Your name" /></Field>
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" style={{ display:'none' }} onChange={handleFile} />
      {loading ? <div style={{ textAlign:'center', padding:12, color:'#9ca3af', fontSize:12 }}>Loading...</div> : (
        <div style={{ background:'#FAFAF8', border:'0.5px solid #D6D2CA', borderRadius:8, padding:'6px 12px' }}>
          {COND_CATS.map(cat => {
            const r = rowFor(cat)
            return (
              <div key={cat} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, padding:'8px 0', borderBottom:'1px solid #F0EDE6', flexWrap:'wrap' }}>
                <div style={{ fontSize:12.5, flex:1, minWidth:130 }}>
                  {cat}
                  {r?.rating && <span style={{ display:'block', fontSize:10, color:'#9ca3af' }}>{r.updated_by} - {relTime(r.updated_at)}</span>}
                </div>
                <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                  {r?.photo && (
                    <div style={{ position:'relative' }}>
                      <img src={r.photo} alt={cat} onClick={()=>setViewPhoto({ photo:r.photo, label:cat })} style={{ width:32, height:32, objectFit:'cover', borderRadius:5, border:'1px solid #D6D2CA', cursor:'pointer' }} />
                      <button onClick={()=>removePhoto(r)} style={{ position:'absolute', top:-6, right:-6, width:14, height:14, borderRadius:'50%', background:'#fff', border:'1px solid #D6D2CA', fontSize:8, padding:0, cursor:'pointer', color:'#9ca3af' }}>&times;</button>
                    </div>
                  )}
                  <button onClick={()=>openPhotoPicker(r, cat)} style={{ width:26, height:26, border:'1px solid #D6D2CA', background:'#fff', borderRadius:5, fontSize:12, cursor:'pointer' }}>&#128247;</button>
                  {RATINGS.map(rt=>(
                    <button key={rt} onClick={()=>rate(cat, rt, r)} style={{
                      border:`1px solid ${r?.rating===rt?RATING_COLOR[rt]:'#D6D2CA'}`, background: r?.rating===rt?RATING_COLOR[rt]+'18':'#fff',
                      color: r?.rating===rt?RATING_COLOR[rt]:'#6b7280', borderRadius:5, padding:'4px 8px', fontSize:10.5, fontWeight:700, cursor:'pointer', fontFamily:'inherit',
                    }}>{rt==='Unknown'?'?':rt}</button>
                  ))}
                </div>
              </div>
            )
          })}
          {customRows.map(r => (
            <div key={r.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, padding:'8px 0', borderBottom:'1px solid #F0EDE6', flexWrap:'wrap' }}>
              <input style={{ ...inp, flex:1, minWidth:130, fontSize:12.5, padding:'4px 8px' }} placeholder="e.g. Pool, Generator..." defaultValue={r.label||''} onBlur={e=>renameCustom(r, e.target.value)} />
              <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                {r.photo && (
                  <div style={{ position:'relative' }}>
                    <img src={r.photo} alt={r.label} onClick={()=>setViewPhoto({ photo:r.photo, label:r.label||'Custom item' })} style={{ width:32, height:32, objectFit:'cover', borderRadius:5, border:'1px solid #D6D2CA', cursor:'pointer' }} />
                    <button onClick={()=>removePhoto(r)} style={{ position:'absolute', top:-6, right:-6, width:14, height:14, borderRadius:'50%', background:'#fff', border:'1px solid #D6D2CA', fontSize:8, padding:0, cursor:'pointer', color:'#9ca3af' }}>&times;</button>
                  </div>
                )}
                <button onClick={()=>openPhotoPicker(r, r.category)} style={{ width:26, height:26, border:'1px solid #D6D2CA', background:'#fff', borderRadius:5, fontSize:12, cursor:'pointer' }}>&#128247;</button>
                {RATINGS.map(rt=>(
                  <button key={rt} onClick={()=>rate(r.category, rt, r)} style={{
                    border:`1px solid ${r.rating===rt?RATING_COLOR[rt]:'#D6D2CA'}`, background: r.rating===rt?RATING_COLOR[rt]+'18':'#fff',
                    color: r.rating===rt?RATING_COLOR[rt]:'#6b7280', borderRadius:5, padding:'4px 8px', fontSize:10.5, fontWeight:700, cursor:'pointer', fontFamily:'inherit',
                  }}>{rt==='Unknown'?'?':rt}</button>
                ))}
                <button onClick={()=>deleteCustom(r)} style={{ background:'none', border:'none', color:'#D6D2CA', fontSize:15, cursor:'pointer' }}>&#128465;</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <button onClick={addCustom} style={{ background:'transparent', border:'1px dashed #D6D2CA', borderRadius:6, padding:'7px', color:'#9ca3af', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>+ Add Custom Item</button>
      <div style={{ borderRadius:8, padding:'10px 14px', textAlign:'center', fontWeight:700, fontSize:13, color:overall.color, background:overall.color+'12', border:`1px solid ${overall.color}40` }}>{overall.label}</div>
      {viewPhoto && (
        <Modal title={viewPhoto.label} onClose={()=>setViewPhoto(null)} width={640}>
          <img src={viewPhoto.photo} alt={viewPhoto.label} style={{ width:'100%', borderRadius:8, display:'block' }} />
        </Modal>
      )}
    </div>
  )
}

// -- Team comments --
export function PropertyComments({ propertyId }) {
  const [comments, setComments] = useState([])
  const [name, setName] = useState(getReviewerName())
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (propertyId) load() }, [propertyId])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('cashoffer_property_comments').select('*').eq('property_id', propertyId).order('created_at', { ascending:false })
    setComments(data || [])
    setLoading(false)
  }

  async function add() {
    if (!name.trim()) { alert('Add your name first.'); return }
    if (!text.trim()) return
    setReviewerName(name)
    await supabase.from('cashoffer_property_comments').insert({ property_id: propertyId, author: name.trim(), content: text.trim() })
    setText('')
    load()
  }
  async function del(id) {
    if (!confirm('Delete this note?')) return
    await supabase.from('cashoffer_property_comments').delete().eq('id', id)
    load()
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      <div className="drawer-section">Team Notes</div>
      <div style={{ display:'flex', gap:6 }}>
        <input style={{ ...inp, flex:'0 0 34%' }} placeholder="Your name" value={name} onChange={e=>setName(e.target.value)} />
        <textarea style={{ ...inp, flex:1, minHeight:38, resize:'vertical' }} rows={2} placeholder="Leave a note for the team..." value={text} onChange={e=>setText(e.target.value)} />
      </div>
      <div><Btn onClick={add}>Add Note</Btn></div>
      {loading ? <div style={{ textAlign:'center', padding:12, color:'#9ca3af', fontSize:12 }}>Loading...</div> : (
        comments.length === 0 ? <div style={{ fontSize:12, color:'#9ca3af' }}>Be the first to leave a note on this property.</div> : (
          <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
            {comments.map(c => (
              <div key={c.id} style={{ borderBottom:'1px solid #F0EDE6', padding:'8px 0', position:'relative' }}>
                <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
                  <span style={{ color:'#B8892A', fontWeight:700, fontSize:12.5 }}>{c.author || 'Anonymous'}</span>
                  <span style={{ color:'#9ca3af', fontSize:11 }}>{relTime(c.created_at)}</span>
                </div>
                <div style={{ fontSize:13, marginTop:3, whiteSpace:'pre-wrap' }}>{c.content}</div>
                <button onClick={()=>del(c.id)} style={{ position:'absolute', right:0, top:8, background:'none', border:'none', color:'#D6D2CA', fontSize:12, cursor:'pointer' }}>&times;</button>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}

// -- AI floor plan reader --
const FP_FLOORS = ['1st Floor', '2nd Floor', 'Basement', 'Attic / Other']

export function FloorPlanReaderModal({ propertyId, onClose, onSaved }) {
  const [slots, setSlots] = useState([{ label: FP_FLOORS[0], image: null }])
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)
  const uploadTargetRef = useRef(null)

  function addFloor() { if (slots.length < FP_FLOORS.length) setSlots(s => [...s, { label: FP_FLOORS[s.length], image: null }]) }
  function removeSlotImage(i) { setSlots(s => s.map((x, idx) => idx===i ? { ...x, image:null } : x)) }
  function openUpload(i) { uploadTargetRef.current = i; fileInputRef.current.value=''; fileInputRef.current.click() }
  function handleFile(e) {
    const f = e.target.files[0]
    const i = uploadTargetRef.current
    if (!f || i==null) return
    if (!f.type.startsWith('image/')) { alert('Please upload an image file.'); return }
    const rd = new FileReader()
    rd.onload = () => setSlots(s => s.map((x, idx) => idx===i ? { ...x, image: rd.result } : x))
    rd.readAsDataURL(f)
  }

  async function analyze() {
    const pending = slots.filter(s => s.image)
    if (!pending.length) return
    setAnalyzing(true); setError(null); setResult(null)
    try {
      const results = await Promise.all(pending.map(s =>
        fetch('/api/analyze-floorplan', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageDataUrl: s.image }),
        }).then(async r => {
          const data = await r.json()
          if (!r.ok) throw new Error(data.error || 'Analysis failed')
          return data
        })
      ))
      const floors = pending.map((s, i) => ({ label: s.label, totalSqft: results[i].totalSqft ?? null, outdoorSqft: results[i].outdoorSqft ?? null, rooms: results[i].rooms || [], notes: results[i].notes || '' }))
      const sq = floors.map(f=>f.totalSqft).filter(v=>v!=null)
      const osq = floors.map(f=>f.outdoorSqft).filter(v=>v!=null)
      setResult({
        combinedSqft: sq.length ? sq.reduce((a,b)=>a+Number(b),0) : null,
        combinedOutdoorSqft: osq.length ? osq.reduce((a,b)=>a+Number(b),0) : null,
        floors, analyzedAt: new Date().toISOString(),
      })
    } catch (e) {
      setError(e.message || 'Something went wrong analyzing the floor plan.')
    }
    setAnalyzing(false)
  }

  async function apply() {
    if (!result) return
    await supabase.from('cashoffer_properties').update({ floor_plan_data: result }).eq('id', propertyId)
    onSaved && onSaved()
    onClose()
  }

  return (
    <Modal title="AI Floor Plan Reader" onClose={onClose} width={720} footer={
      result ? (
        <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
          <Btn variant="outline" onClick={onClose}>Cancel</Btn>
          <Btn onClick={apply}>Apply to Property</Btn>
        </div>
      ) : (
        <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
          <Btn variant="outline" onClick={onClose}>Cancel</Btn>
          <Btn onClick={analyze} disabled={analyzing || !slots.some(s=>s.image)}>{analyzing ? 'Analyzing...' : 'Analyze All Floors'}</Btn>
        </div>
      )
    }>
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleFile} />
      {!result && (
        <>
          <div style={{ background:'#FAFAF8', border:'1px solid #D6D2CA', borderRadius:8, padding:'12px 14px', fontSize:12.5, lineHeight:1.6, marginBottom:14 }}>
            Switch the Zillow tour to Floor Plan view above, screenshot each floor (Win+Shift+S or Cmd+Shift+4), then upload the screenshots below. Click <b>+ Add Floor</b> for basements or upper floors.
          </div>
          {slots.map((s, i) => (
            <div key={i} style={{ background:'#fff', border:'0.5px solid #D6D2CA', borderRadius:8, padding:'10px 14px', marginBottom:8 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom: s.image?8:0 }}>
                <div style={{ fontWeight:700, fontSize:13, flex:1 }}>{s.label}</div>
                <button onClick={()=>openUpload(i)} style={{ background:'#fff', border:'1px solid #D6D2CA', borderRadius:6, padding:'6px 12px', fontSize:11.5, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Upload</button>
              </div>
              {s.image && (
                <div style={{ position:'relative', display:'inline-block' }}>
                  <img src={s.image} alt={s.label} style={{ maxHeight:130, borderRadius:6, border:'0.5px solid #D6D2CA', display:'block' }} />
                  <button onClick={()=>removeSlotImage(i)} style={{ position:'absolute', top:-8, right:-8, width:20, height:20, borderRadius:'50%', background:'#fff', border:'1px solid #D6D2CA', fontSize:11, cursor:'pointer' }}>&times;</button>
                </div>
              )}
            </div>
          ))}
          {slots.length < FP_FLOORS.length && <button onClick={addFloor} style={{ background:'transparent', border:'1px dashed #D6D2CA', borderRadius:6, padding:'7px', color:'#9ca3af', fontSize:12, cursor:'pointer', fontFamily:'inherit', width:'100%' }}>+ Add Floor</button>}
          {error && <div style={{ color:'#B91C1C', fontSize:12.5, marginTop:12, textAlign:'center' }}>{error}</div>}
        </>
      )}
      {result && (
        <div>
          <div style={{ textAlign:'center', marginBottom:14 }}>
            <div style={{ fontSize:10, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.7 }}>Finished Sq Ft (Living)</div>
            <div style={{ fontSize:32, fontWeight:700, color:'#B8892A', fontFamily:'monospace' }}>{result.combinedSqft?.toLocaleString() ?? '-'}</div>
            <div style={{ fontSize:11, color:'#9ca3af', marginTop:4 }}>Deck / Patio / Outdoor: {result.combinedOutdoorSqft?.toLocaleString() ?? '-'} sq ft</div>
          </div>
          {result.floors.map((f, i) => (
            <div key={i} style={{ marginBottom:10 }}>
              <div style={{ fontWeight:700, fontSize:12.5, marginBottom:4 }}>{f.label} - {f.totalSqft?.toLocaleString() ?? '-'} sq ft</div>
              {f.rooms.length > 0 && (
                <div style={{ border:'0.5px solid #D6D2CA', borderRadius:6, overflow:'hidden' }}>
                  {f.rooms.map((r, ri) => (
                    <div key={ri} style={{ display:'flex', justifyContent:'space-between', padding:'5px 10px', fontSize:12, background: ri%2===0?'#fff':'#FAFAF8', borderTop: ri>0?'0.5px solid #F0EDE6':'none' }}>
                      <span>{r.name}</span>
                      <span style={{ fontFamily:'monospace', color:'#6b7280' }}>{r.sqft ?? '-'} sq ft</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

// -- Combined Tour tab --
export default function PropertyTour({ propertyId, tourUrl, onSaved }) {
  const [fpOpen, setFpOpen] = useState(false)

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <TourSection propertyId={propertyId} tourUrl={tourUrl} onSaved={onSaved} />
      <div>
        <button onClick={()=>setFpOpen(true)} style={{
          background:'#2D6FAF', color:'#fff', border:'none', borderRadius:8, padding:'10px 14px',
          fontSize:12.5, fontWeight:700, cursor:'pointer', fontFamily:'inherit', width:'100%',
        }}>AI Floor Plan Reader</button>
      </div>
      <ConditionRatings propertyId={propertyId} />
      <PropertyComments propertyId={propertyId} />
      {fpOpen && <FloorPlanReaderModal propertyId={propertyId} onClose={()=>setFpOpen(false)} onSaved={onSaved} />}
    </div>
  )
}

