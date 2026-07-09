import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { PageWrap, SectionBar, Card, EmptyState, LoadingSpinner, fmt, fmtK, useSort, SortTh } from '../components/ui.jsx'
import PropertyDrawer from '../components/PropertyDrawer.jsx'
import ProposalModal from '../components/ProposalModal.jsx'
import KanbanBoard, { cardPill, cardChip, MoneyBurst } from '../components/KanbanBoard.jsx'

const REHAB_STAGE_COLOR = {
  'Not Started':'#9ca3af','Demo':'#D97825','Rough Work':'#B8892A',
  'Inspections':'#2D6FAF','Finishes':'#6b21a8','Punch List':'#3B6D11','Complete':'#3B6D11',
}
const REHAB_STAGES = ['Not Started','Demo','Rough Work','Inspections','Finishes','Punch List','Complete']

// ── Board: deal stages that live on this page ─────────────────────────────────
// Purchased/Rehab are Flip+Hold territory; the Reno columns are client Reno
// listings only. validDropTarget keeps deals in their own lane.
const BOARD_COLUMNS = [
  { key:'Purchased',        color:'#D97825' },
  { key:'Rehab',            color:'#6b21a8' },
  { key:'Reno In Progress', color:'#B8892A' },
  { key:'Reno Completed',   color:'#3B6D11' },
]

function validDropTarget(p, col) {
  const isReno = p.type === 'Retail Listing' && p.listing_type === 'Reno'
  if (col === 'Reno In Progress' || col === 'Reno Completed') return isReno
  return p.type === 'Flip' || p.type === 'Hold'  // Purchased / Rehab
}

// Exit moves live in the drag tray — positives left, negatives after the line
const PROMO_ZONES = [
  { key:'Flip',       label:'FLIP',          emoji:'\u{1F528}', color:'#D97825' },
  { key:'Hold',       label:'HOLD',          emoji:'\u{1F3E0}', color:'#B8892A' },
  { key:'Listed',     label:'LIST FOR SALE', emoji:'\u{1FAA7}', color:'#2D6FAF' },
  { key:'Rent Ready', label:'RENT READY',    emoji:'\u{1F511}', color:'#3B6D11' },
  { divider:true },
  { key:'Cancelled / Expired', label:'CANCEL / EXPIRE', emoji:'\u{1F6AB}', color:'#9ca3af' },
]

const DISP_LABEL = { listing:'Listing', wholesale:'Wholesale', flip:'Flip', hold:'Hold' }
const DISP_COLOR = { listing:'#3B6D11', wholesale:'#6b21a8', flip:'#D97825', hold:'#B8892A' }

export default function Rehabs({ onOpenSupplies }) {
  const mobile = useIsMobile()
  const [properties, setProperties] = useState([])
  const [rehabItems, setRehabItems] = useState([])
  const [mailings, setMailings] = useState([])
  const [loading, setLoading] = useState(true)
  const [drawer, setDrawer] = useState(null)
  const [drawerTab, setDrawerTab] = useState('rehab')
  const [proposal, setProposal] = useState(null)
  const [stageFilter, setStageFilter] = useState('all')
  const [view, setView] = useState('board')
  const [burst, setBurst] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: p }, { data: ri }, { data: m }] = await Promise.all([
      supabase.from('cashoffer_properties').select('*').in('stage', ['Purchased','Rehab','Reno In Progress','Reno Completed']).order('rehab_start_date', { ascending: false }),
      supabase.from('cashoffer_rehab_items').select('property_id,estimated_cost,actual_cost,status'),
      supabase.from('cashoffer_mailings').select('id,campaign_name,drop_date'),
    ])
    setProperties(p || [])
    setRehabItems(ri || [])
    setMailings(m || [])
    setLoading(false)
  }

  // Per-property helpers from rehab_items table
  function itemsFor(id) { return rehabItems.filter(r => r.property_id === id) }
  function estCost(id)  { return itemsFor(id).reduce((s,r) => s+(parseFloat(r.estimated_cost)||0), 0) }
  function actCost(id)  { return itemsFor(id).reduce((s,r) => { const v=r.actual_cost!=null?parseFloat(r.actual_cost)||0:parseFloat(r.estimated_cost)||0; return s+v }, 0) }
  function doneCount(id){ return itemsFor(id).filter(r=>r.status==='Completed').length }
  function totalCount(id){ return itemsFor(id).length }
  function pctDone(id)  {
    const est = estCost(id)
    const done = itemsFor(id).filter(r=>r.status==='Completed').reduce((s,r)=>{ const v=r.actual_cost!=null?parseFloat(r.actual_cost)||0:parseFloat(r.estimated_cost)||0; return s+v },0)
    return est > 0 ? Math.min(100, Math.round((done/est)*100)) : 0
  }

  const byRehabStage   = {}
  REHAB_STAGES.forEach(st => { byRehabStage[st] = properties.filter(p=>(p.rehab_stage||'Not Started')===st).length })

  // ── Board handlers ──────────────────────────────────────────────────────────
  const columnFor = p => BOARD_COLUMNS.some(c => c.key === p.stage) ? p.stage : 'Purchased'

  function typeLabel(p) {
    if (p.type === 'Flip') return { text:'Flip', color:'#D97825' }
    if (p.type === 'Hold') return { text:'Hold', color:'#B8892A' }
    if (p.type === 'Retail Listing') return { text:'Client · Reno', color:'#6b21a8' }
    return { text: p.type || '—', color:'#9ca3af' }
  }

  async function handleBoardDrop(id, columnKey) {
    const item = properties.find(p => p.id === id)
    if (item && !validDropTarget(item, columnKey)) {
      alert(`"${columnKey}" doesn't apply to ${typeLabel(item).text} deals.`)
      return
    }
    const { error } = await supabase.from('cashoffer_properties').update({ stage: columnKey }).eq('id', id)
    if (error) { alert(`Could not move deal: ${error.message}`) }
    load()
  }

  function openDrawer(p) { setDrawerTab('rehab'); setDrawer(p) }

  async function handlePromote(id, zoneKey, coords) {
    const item = properties.find(p => p.id === id)
    if (!item) return
    const isReno = item.type === 'Retail Listing' && item.listing_type === 'Reno'

    // Negative exit: client Reno listings only
    if (zoneKey === 'Cancelled / Expired') {
      if (!isReno) {
        alert('Cancel / Expire applies to client Reno listings only. Owned deals stay in the portfolio.')
        return
      }
      const { error } = await supabase.from('cashoffer_properties').update({ stage:'Cancelled / Expired' }).eq('id', id)
      if (error) alert(`Could not move deal: ${error.message}`)
      load()
      return
    }

    // Rehab-done exits
    if (zoneKey === 'Listed') {
      const { error } = await supabase.from('cashoffer_properties').update({ stage:'Listed' }).eq('id', id)
      if (error) { alert(`Could not move deal: ${error.message}`); load(); return }
      setBurst({ ...coords, key: Date.now() })
      setTimeout(() => setBurst(null), 1600)
      load()
      return
    }
    if (zoneKey === 'Rent Ready') {
      if (item.type !== 'Hold') {
        alert('Rent Ready is a Hold stage. Pivot the deal to Hold first if you\'re keeping it as a rental.')
        return
      }
      const { error } = await supabase.from('cashoffer_properties').update({ stage:'Rent Ready' }).eq('id', id)
      if (error) { alert(`Could not move deal: ${error.message}`); load(); return }
      setBurst({ ...coords, key: Date.now() })
      setTimeout(() => setBurst(null), 1600)
      load()
      return
    }

    // Flip ↔ Hold pivot — stage carries over (Purchased/Rehab valid in both sets)
    if (zoneKey === 'Flip' || zoneKey === 'Hold') {
      if (item.type === zoneKey) { alert(`Already a ${zoneKey} deal.`); return }
      if (!['Purchased','Rehab'].includes(item.stage)) {
        alert(`Only deals in Purchased or Rehab can pivot to ${zoneKey}.`)
        return
      }
      const { error } = await supabase.from('cashoffer_properties')
        .update({ type: zoneKey, disposition: zoneKey.toLowerCase() }).eq('id', id)
      if (error) { alert(`Could not move deal: ${error.message}`); load(); return }
      setBurst({ ...coords, key: Date.now() })
      setTimeout(() => setBurst(null), 1600)
      load()
    }
  }

  function rehabCardContent(p) {
    const badge = typeLabel(p)
    const pct = pctDone(p.id)
    const est = estCost(p.id)
    const act = actCost(p.id)
    const over = act > est && est > 0
    const rehabStage = p.rehab_stage || 'Not Started'
    const daysActive = p.rehab_start_date ? Math.floor((Date.now()-new Date(p.rehab_start_date))/86400000) : null
    return (
      <>
        <div style={{ fontSize:13, fontWeight:700, color:'#2C2C2C', marginBottom:3 }}>{p.address?.split(',')[0] || 'New Property'}</div>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8, marginBottom:8 }}>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:11, color:'#6b7280' }}>{p.owner || 'BPV'}</div>
          </div>
          {(act > 0 || est > 0) ? (
            <span style={cardChip(over ? '#B91C1C' : '#B8892A', over ? '#FBEAEA' : '#FBF6EA', over ? '#EFC5C5' : '#E8D9B5')}>
              {fmt(act > 0 ? act : est)}
            </span>
          ) : null}
        </div>
        {est > 0 && (
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
            <div style={{ flex:1, height:5, background:'#E5E1DB', borderRadius:99, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${pct}%`, background: pct>=100 ? '#3B6D11' : '#B8892A', borderRadius:99 }} />
            </div>
            <span style={{ fontSize:10, color:'#6b7280', fontWeight:600, whiteSpace:'nowrap' }}>{pct}%</span>
          </div>
        )}
        <div style={{ display:'flex', flexWrap:'wrap', gap:4, alignItems:'center' }}>
          <span style={cardPill(badge.color, '#F0EDE6')}>{badge.text}</span>
          <span style={cardPill(REHAB_STAGE_COLOR[rehabStage] || '#9ca3af', '#F0EDE6')}>{rehabStage}</span>
          {daysActive !== null && <span style={{ fontSize:10, color: daysActive > 60 ? '#B91C1C' : '#9ca3af', marginLeft:'auto' }}>{daysActive}d</span>}
        </div>
      </>
    )
  }


  const filtered = stageFilter==='all' ? properties
    : stageFilter==='in_progress' ? properties.filter(p=>{ const st=p.rehab_stage||'Not Started'; return st!=='Not Started' && st!=='Complete' })
    : properties.filter(p=>(p.rehab_stage||'Not Started')===stageFilter)

  const { sorted, sortKey, sortDir, toggleSort } = useSort(filtered, 'rehab_start_date', 'desc', {
    stage:       p => REHAB_STAGES.indexOf(p.rehab_stage||'Not Started'),
    days_active: p => p.rehab_start_date ? Math.floor((Date.now()-new Date(p.rehab_start_date))/86400000) : null,
    est_cost:    p => estCost(p.id),
    pct:         p => pctDone(p.id),
  })

  if (loading) return <LoadingSpinner />

  return (
    <PageWrap pad={!mobile}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, color:'#2C2C2C' }}>Rehabs</h1>
          <p style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>Active rehab projects · all entities</p>
        </div>
        {onOpenSupplies && (
          <button onClick={onOpenSupplies} style={{
            background:'#B8892A', color:'#fff', border:'none', borderRadius:6, padding:'8px 16px',
            cursor:'pointer', fontSize:12, fontWeight:700, fontFamily:'inherit', whiteSpace:'nowrap',
          }}>Supplies List</button>
        )}
      </div>

      {/* Stat cards */}
      <div style={{ display:'grid', gridTemplateColumns:mobile?'1fr 1fr':'repeat(3,1fr)', gap:12, marginBottom:24 }}>
        {[
          { label:'Not Started',    value:byRehabStage['Not Started']||0,                                         color:'#9ca3af', filterVal:'Not Started' },
          { label:'In Progress',    value:properties.filter(p=>p.rehab_stage&&p.rehab_stage!=='Not Started'&&p.rehab_stage!=='Complete').length, color:'#B8892A', filterVal:'in_progress' },
          { label:'Completed',      value:byRehabStage['Complete']||0,                                            color:'#3B6D11', filterVal:'Complete' },
        ].map(({label,value,color,filterVal})=>{
          const active = stageFilter===filterVal
          return (
            <button key={label}
              onClick={()=>setStageFilter(active ? 'all' : filterVal)}
              style={{
                background: active ? color+'12' : '#fff',
                border: active ? `1.5px solid ${color}` : '0.5px solid #D6D2CA',
                borderTop:`3px solid ${color}`, borderRadius:8, padding:'12px 16px',
                cursor:'pointer', textAlign:'left', fontFamily:'inherit',
              }}>
              <div style={{ fontSize:10, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.8, marginBottom:6 }}>{label}</div>
              <div style={{ fontSize:24, fontWeight:700, color, fontFamily:'monospace' }}>{value}</div>
            </button>
          )
        })}
      </div>

      {/* Rehab stage filter pills + view toggle */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, marginBottom:14, flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
          <button onClick={()=>setStageFilter('all')} style={{ padding:'5px 14px', border:'none', borderRadius:4, cursor:'pointer', background:stageFilter==='all'?'#2C2C2C':'#F0EDE6', color:stageFilter==='all'?'#fff':'#6b7280', fontSize:11, fontWeight:stageFilter==='all'?700:400, fontFamily:'inherit' }}>
            All ({properties.length})
          </button>
          {REHAB_STAGES.map(st=>(
            byRehabStage[st]>0 && (
              <button key={st} onClick={()=>setStageFilter(st)} style={{ padding:'5px 14px', border:'none', borderRadius:4, cursor:'pointer', background:stageFilter===st?REHAB_STAGE_COLOR[st]:'#F0EDE6', color:stageFilter===st?'#fff':'#6b7280', fontSize:11, fontWeight:stageFilter===st?700:400, fontFamily:'inherit', whiteSpace:'nowrap' }}>
                {st} ({byRehabStage[st]})
              </button>
            )
          ))}
        </div>
        {!mobile && (
          <div style={{ display:'flex', gap:2 }}>
            {[['board','Board'],['table','Table']].map(([v,l]) => (
              <button key={v} onClick={() => setView(v)} style={{ padding:'6px 14px', border:'none', borderRadius:6, cursor:'pointer', background: view === v ? '#2C2C2C' : '#F0EDE6', color: view === v ? '#fff' : '#6b7280', fontSize:12, fontWeight: view === v ? 700 : 400, fontFamily:'inherit' }}>{l}</button>
            ))}
          </div>
        )}
      </div>

      {view === 'board' && !mobile ? (
        filtered.length === 0 ? (
          <EmptyState icon="🔨" text="No active rehabs match this filter." />
        ) : (
          <>
            <KanbanBoard
              columns={BOARD_COLUMNS}
              items={filtered}
              columnFor={columnFor}
              onOpen={openDrawer}
              onDrop={handleBoardDrop}
              renderCard={rehabCardContent}
              promoZones={PROMO_ZONES}
              onPromote={handlePromote}
            />
            {burst && <MoneyBurst key={burst.key} x={burst.x} y={burst.y} />}
          </>
        )
      ) : (
      <>
      <SectionBar>Rehab Projects ({filtered.length})</SectionBar>

      {filtered.length===0 ? (
        <EmptyState icon="🔨" text="No active rehabs. Set a property's stage to Rehabbing to add it here." />
      ) : (
        <Card style={{ padding:0 }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'#F0EDE6' }}>
                <SortTh sortKeyName="address"     {...{sortKey,sortDir,toggleSort}}>Address</SortTh>
                <SortTh sortKeyName="owner"       {...{sortKey,sortDir,toggleSort}}>Owner</SortTh>
                <SortTh sortKeyName="disposition" {...{sortKey,sortDir,toggleSort}}>Type</SortTh>
                <SortTh sortKeyName="stage"       {...{sortKey,sortDir,toggleSort}}>Rehab Stage</SortTh>
                <SortTh sortKeyName="rehab_start_date" {...{sortKey,sortDir,toggleSort}}>Start Date</SortTh>
                <SortTh sortKeyName="pct"         {...{sortKey,sortDir,toggleSort}}>Progress</SortTh>
                <SortTh sortKeyName="est_cost"    {...{sortKey,sortDir,toggleSort}}>Budget</SortTh>
                <SortTh sortKeyName="days_active" {...{sortKey,sortDir,toggleSort}}>Days</SortTh>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p,i)=>{
                const daysActive = p.rehab_start_date ? Math.floor((Date.now()-new Date(p.rehab_start_date))/86400000) : null
                const pct = pctDone(p.id)
                const est = estCost(p.id)
                const act = actCost(p.id)
                const over = act > est && est > 0
                const rehabStage = p.rehab_stage||'Not Started'
                const stageColor = REHAB_STAGE_COLOR[rehabStage]
                const dispColor = DISP_COLOR[p.disposition]||'#9ca3af'
                return (
                  <tr key={p.id} onClick={()=>openDrawer(p)}
                    style={{ background:i%2===0?'#fff':'#FAFAF8', borderTop:'0.5px solid #F0EDE6', cursor:'pointer' }}
                    onMouseEnter={e=>e.currentTarget.style.background='#fef9f0'}
                    onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'#fff':'#FAFAF8'}>
                    <td style={{ padding:'10px 14px', fontSize:13, fontWeight:600 }}>
                      <div>{p.address?.split(',')[0]}</div>
                      <div style={{ fontSize:10, color:'#9ca3af', marginTop:1 }}>{p.address?.split(',').slice(1,3).join(',').trim()}</div>
                    </td>
                    <td style={{ padding:'10px 14px', fontSize:12, color:'#6b7280' }}>{p.owner||'BPV'}</td>
                    <td style={{ padding:'10px 14px' }}>
                      {p.disposition
                        ? <span style={{ background:dispColor+'18', color:dispColor, fontSize:10, fontWeight:700, padding:'3px 7px', borderRadius:4 }}>{DISP_LABEL[p.disposition]||p.disposition}</span>
                        : <span style={{ fontSize:10, color:'#B8892A', fontWeight:600 }}>Analyzing</span>}
                    </td>
                    <td style={{ padding:'10px 14px' }}>
                      <span style={{ background:stageColor+'18', color:stageColor, fontSize:11, fontWeight:700, padding:'3px 8px', borderRadius:4, whiteSpace:'nowrap' }}>{rehabStage}</span>
                    </td>
                    <td style={{ padding:'10px 14px', fontSize:12, color:'#6b7280', whiteSpace:'nowrap' }}>
                      {p.rehab_start_date ? (() => {
                        const [y,m,d] = p.rehab_start_date.split('-')
                        return `${parseInt(m)}/${parseInt(d)}/${y}`
                      })() : '—'}
                    </td>
                    <td style={{ padding:'10px 14px', minWidth:100 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ flex:1, height:5, background:'#E5E1DB', borderRadius:99, overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${pct}%`, background:pct>=100?'#3B6D11':'#B8892A', borderRadius:99 }} />
                        </div>
                        <span style={{ fontSize:10, color:'#6b7280', fontWeight:600, whiteSpace:'nowrap' }}>{pct}%</span>
                      </div>
                      <div style={{ fontSize:10, color:'#9ca3af', marginTop:2 }}>{doneCount(p.id)}/{totalCount(p.id)} items</div>
                    </td>
                    <td style={{ padding:'10px 14px', fontSize:12, fontFamily:'monospace' }}>
                      <div style={{ color:over?'#B91C1C':'#2C2C2C' }}>{act>0?fmt(act):est>0?fmt(est):'—'}</div>
                      {est>0&&act>0&&over && <div style={{ fontSize:10, color:'#B91C1C' }}>+{fmt(act-est)} over</div>}
                      {est>0 && <div style={{ fontSize:10, color:'#9ca3af' }}>est {fmt(est)}</div>}
                    </td>
                    <td style={{ padding:'10px 14px', fontSize:13, fontFamily:'monospace', color:daysActive>60?'#B91C1C':'#6b7280' }}>
                      {daysActive!==null?`${daysActive}d`:'—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}
      </>
      )}

      <PropertyDrawer property={drawer} open={!!drawer} onClose={()=>setDrawer(null)} onSave={()=>load()} mailings={mailings} initialTab={drawerTab} onViewOffer={p => setProposal(p)} />
      {proposal && <ProposalModal property={proposal} onClose={() => setProposal(null)} />}
    </PageWrap>
  )
}

