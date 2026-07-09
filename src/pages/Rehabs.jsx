import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { PageWrap, SectionBar, Card, EmptyState, LoadingSpinner, fmt, fmtK, useSort, SortTh } from '../components/ui.jsx'
import PropertyDrawer from '../components/PropertyDrawer.jsx'
import ProposalModal from '../components/ProposalModal.jsx'
import KanbanBoard, { cardPill, cardChip, cardBtn, MoneyBurst } from '../components/KanbanBoard.jsx'
import RehabRoundTracker from '../components/RehabRoundTracker.jsx'

const REHAB_STAGE_COLOR = {
  'Not Started':'#9ca3af','Demo':'#D97825','Rough Work':'#B8892A',
  'Inspections':'#2D6FAF','Finishes':'#6b21a8','Punch List':'#3B6D11','Complete':'#3B6D11',
}
const REHAB_STAGES = ['Not Started','Demo','Rough Work','Inspections','Finishes','Punch List','Complete']

// ── Board: columns are the renovation work stages (rehab_stage) ───────────────
// Dragging a card updates rehab_stage; the deal stage syncs alongside
// (Renovation once work starts; Reno Completed for client Reno listings).
const BOARD_COLUMNS = REHAB_STAGES.map(st => ({ key: st, color: REHAB_STAGE_COLOR[st] }))

// The fork happens here: renovation done → the deal becomes a Flip (List For
// Sale) or a Hold (Rent Ready). Positives left, negatives after the line.
const PROMO_ZONES = [
  { key:'Analyzing',  label:'RE-ANALYZE',      emoji:'\u{1F50D}', color:'#6b7280' },
  { divider:true },
  { key:'Listed',     label:'LIST FOR SALE',   emoji:'\u{1FAA7}', color:'#2D6FAF' },
  { key:'Rent Ready', label:'RENT READY',      emoji:'\u{1F511}', color:'#3B6D11' },
  { divider:true },
  { key:'Cancelled / Expired', label:'CANCEL / EXPIRE', emoji:'\u{1F6AB}', color:'#9ca3af' },
]

const DISP_LABEL = { renovation:'Renovation', listing:'Listing', wholesale:'Wholesale', flip:'Flip', hold:'Hold' }
const DISP_COLOR = { renovation:'#6b21a8', listing:'#3B6D11', wholesale:'#6b21a8', flip:'#D97825', hold:'#B8892A' }

export default function Rehabs({ onOpenSupplies }) {
  const mobile = useIsMobile()
  const [properties, setProperties] = useState([])
  const [rehabItems, setRehabItems] = useState([])
  const [mailings, setMailings] = useState([])
  const [loading, setLoading] = useState(true)
  const [drawer, setDrawer] = useState(null)
  const [drawerTab, setDrawerTab] = useState('rehab')
  const [proposal, setProposal] = useState(null)
  const [dashboard, setDashboard] = useState(null)  // property whose Renovation Dashboard is open
  const [view, setView] = useState('board')
  const [burst, setBurst] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: p }, { data: ri }, { data: m }] = await Promise.all([
      supabase.from('cashoffer_properties').select('*').in('stage', ['Purchased','Renovation','Reno In Progress','Reno Completed']).order('rehab_start_date', { ascending: false }),
      supabase.from('cashoffer_rehab_items').select('property_id,estimated_cost,actual_cost,status,paid_by'),
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
  // Real money out the door: actual costs only, no estimate fallback
  function spentCost(id){ return itemsFor(id).reduce((s,r) => s+(r.actual_cost!=null?parseFloat(r.actual_cost)||0:0), 0) }
  function doneCount(id){ return itemsFor(id).filter(r=>r.status==='Completed').length }
  function totalCount(id){ return itemsFor(id).length }
  function pctDone(id)  {
    const est = estCost(id)
    const done = itemsFor(id).filter(r=>r.status==='Completed').reduce((s,r)=>{ const v=r.actual_cost!=null?parseFloat(r.actual_cost)||0:parseFloat(r.estimated_cost)||0; return s+v },0)
    return est > 0 ? Math.min(100, Math.round((done/est)*100)) : 0
  }

  // ── Board handlers ──────────────────────────────────────────────────────────
  // Columns are the renovation work stages (rehab_stage); deal stage rides along.
  const columnFor = p => REHAB_STAGES.includes(p.rehab_stage) ? p.rehab_stage : 'Not Started'

  function typeLabel(p) {
    if (p.type === 'Renovation') return { text:'Renovation', color:'#6b21a8' }
    if (p.type === 'Retail Listing') return { text:'Client \u00b7 Reno', color:'#6b21a8' }
    return { text: p.type || '\u2014', color:'#9ca3af' }
  }

  async function handleBoardDrop(id, columnKey) {
    const item = properties.find(p => p.id === id)
    if (!item) return
    const isReno = item.type === 'Retail Listing' && item.listing_type === 'Reno'
    const payload = { rehab_stage: columnKey }
    if (isReno) {
      payload.stage = columnKey === 'Complete' ? 'Reno Completed' : 'Reno In Progress'
    } else if (item.type === 'Renovation') {
      // Work started -> deal stage becomes Renovation; back to Not Started -> Purchased
      payload.stage = columnKey === 'Not Started' ? 'Purchased' : 'Renovation'
      payload.rehab_active = columnKey !== 'Not Started' && columnKey !== 'Complete'
    }
    const { error } = await supabase.from('cashoffer_properties').update(payload).eq('id', id)
    if (error) { alert(`Could not move deal: ${error.message}`) }
    load()
  }

  function openDrawer(p) { setDrawerTab('rehab'); setDrawer(p) }

  async function handlePromote(id, zoneKey, coords) {
    const item = properties.find(p => p.id === id)
    if (!item) return
    const isReno = item.type === 'Retail Listing' && item.listing_type === 'Reno'

    // Back to the Analyzer — owned deals only (a client Reno was never ours to analyze)
    if (zoneKey === 'Analyzing') {
      if (isReno) { alert('Client Reno listings can\'t be re-analyzed — use Cancel / Expire instead.'); return }
      const { error } = await supabase.from('cashoffer_properties')
        .update({ type:'Analyzing', stage:'New Lead', disposition:null, rehab_active:false }).eq('id', id)
      if (error) alert(`Could not move deal: ${error.message}`)
      load()
      return
    }

    // Negative exit: client Reno listings only
    if (zoneKey === 'Cancelled / Expired') {
      if (!isReno) {
        alert('Cancel / Expire applies to client Reno listings only. Owned deals go back through Re-Analyze.')
        return
      }
      const { error } = await supabase.from('cashoffer_properties').update({ stage:'Cancelled / Expired' }).eq('id', id)
      if (error) alert(`Could not move deal: ${error.message}`)
      load()
      return
    }

    // The fork: renovation done -> Flip (List For Sale) or Hold (Rent Ready)
    if (zoneKey === 'Listed') {
      const today = new Date().toISOString().slice(0,10)
      const payload = isReno
        ? { stage:'Listed', ...(item.rehab_complete_date ? {} : { rehab_complete_date: today }) }  // client listing goes to market, type unchanged
        : { type:'Flip', stage:'Listed', disposition:'flip', rehab_active:false,
            ...(item.rehab_complete_date ? {} : { rehab_complete_date: today }) }
      const { error } = await supabase.from('cashoffer_properties').update(payload).eq('id', id)
      if (error) { alert(`Could not move deal: ${error.message}`); load(); return }
      setBurst({ ...coords, key: Date.now() })
      setTimeout(() => setBurst(null), 1600)
      load()
      return
    }
    if (zoneKey === 'Rent Ready') {
      if (isReno) { alert('Rent Ready is for owned renovations — client Reno listings go to market instead.'); return }
      const { error } = await supabase.from('cashoffer_properties')
        .update({ type:'Hold', stage:'Rent Ready', disposition:'hold', rehab_active:false,
                  ...(item.rehab_complete_date ? {} : { rehab_complete_date: new Date().toISOString().slice(0,10) }) }).eq('id', id)
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
    const spent = spentCost(p.id)
    const over = spent > est && est > 0
    const rehabStage = p.rehab_stage || 'Not Started'
    const daysActive = p.rehab_start_date ? Math.floor((Date.now()-new Date(p.rehab_start_date))/86400000) : null
    return (
      <>
        <div style={{ fontSize:13, fontWeight:700, color:'#2C2C2C', marginBottom:3 }}>{p.address?.split(',')[0] || 'New Property'}</div>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8, marginBottom:8 }}>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:11, color:'#6b7280' }}>{p.owner || 'BPV'}</div>
          </div>
          {(spent > 0 || est > 0) ? (
            <div style={{ display:'flex', gap:4, alignItems:'center', flexShrink:0 }}>
              <span style={cardChip('#B8892A','#FBF6EA','#E8D9B5')}>Est {est > 0 ? fmt(est) : '\u2014'}</span>
              <span style={cardChip(over ? '#B91C1C' : '#3B6D11', over ? '#FBEAEA' : '#EEF5E7', over ? '#EFC5C5' : '#CBDDB8')}>Spent {fmt(spent)}</span>
            </div>
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
          {p.type === 'Retail Listing' && <span style={cardPill(badge.color, '#F0EDE6')}>{badge.text}</span>}
          {p.stage === 'Purchased' && <span style={cardPill('#D97825', '#FBF0E4')}>Purchased</span>}
          {daysActive !== null && <span style={{ fontSize:10, color: daysActive > 60 ? '#B91C1C' : '#9ca3af', marginLeft:'auto' }}>{daysActive}d</span>}
        </div>
        <button style={cardBtn} onClick={e => { e.stopPropagation(); setDashboard(p) }}>Renovation Dashboard</button>
      </>
    )
  }


  const filtered = properties

  // Page money totals (shown properties)
  const totalEst   = properties.reduce((s,p) => s + estCost(p.id), 0)
  const totalSpent = properties.reduce((s,p) => s + spentCost(p.id), 0)
  const propIds = new Set(properties.map(p => p.id))
  const contribBy = rehabItems.reduce((acc, r) => {
    if (!propIds.has(r.property_id)) return acc
    if (r.paid_by === 'Bob' || r.paid_by === 'Eric') {
      const v = r.actual_cost!=null ? parseFloat(r.actual_cost)||0 : parseFloat(r.estimated_cost)||0
      acc[r.paid_by] = (acc[r.paid_by]||0) + v
    }
    return acc
  }, {})
  const totalContrib = (contribBy.Bob||0) + (contribBy.Eric||0)

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
          <h1 style={{ fontSize:20, fontWeight:700, color:'#2C2C2C' }}>Renovations</h1>
          <p style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>Owned renovations · client Reno listings</p>
        </div>
        {onOpenSupplies && (
          <button onClick={onOpenSupplies} style={{
            background:'#B8892A', color:'#fff', border:'none', borderRadius:6, padding:'8px 16px',
            cursor:'pointer', fontSize:12, fontWeight:700, fontFamily:'inherit', whiteSpace:'nowrap',
          }}>Supplies List</button>
        )}
      </div>

      {/* Money stat cards */}
      <div style={{ display:'grid', gridTemplateColumns:mobile?'1fr 1fr':'repeat(4,1fr)', gap:12, marginBottom:24 }}>
        {[
          { label:'Active Projects',   value: properties.length,                          color:'#6b21a8' },
          { label:'Est. Rehab Budget', value: totalEst > 0 ? fmtK(totalEst) : '\u2014',     color:'#B8892A' },
          { label:'Current Spend',     value: totalSpent > 0 ? fmtK(totalSpent) : '\u2014', color: totalSpent > totalEst && totalEst > 0 ? '#B91C1C' : '#3B6D11',
            sub: totalEst > 0 ? `${Math.round((totalSpent/totalEst)*100)}% of budget` : null },
          { label:'Partner Contributions', value: totalContrib > 0 ? fmtK(totalContrib) : '\u2014', color:'#2D6FAF',
            sub: totalContrib > 0 ? `Bob ${fmtK(contribBy.Bob||0)} \u00b7 Eric ${fmtK(contribBy.Eric||0)}` : 'none on the books' },
        ].map(({ label, value, color, sub }) => (
          <div key={label} style={{ background:'#fff', border:'0.5px solid #D6D2CA', borderRadius:8, borderTop:`3px solid ${color}`, padding:'12px 16px' }}>
            <div style={{ fontSize:10, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.8, marginBottom:6 }}>{label}</div>
            <div style={{ fontSize:24, fontWeight:700, color, fontFamily:'monospace' }}>{value}</div>
            {sub && <div style={{ fontSize:10, color:'#9ca3af', marginTop:3 }}>{sub}</div>}
          </div>
        ))}
      </div>

      {!mobile && (
        <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:14 }}>
          <div style={{ display:'flex', gap:2 }}>
            {[['board','Board'],['table','Table']].map(([v,l]) => (
              <button key={v} onClick={() => setView(v)} style={{ padding:'6px 14px', border:'none', borderRadius:6, cursor:'pointer', background: view === v ? '#2C2C2C' : '#F0EDE6', color: view === v ? '#fff' : '#6b7280', fontSize:12, fontWeight: view === v ? 700 : 400, fontFamily:'inherit' }}>{l}</button>
            ))}
          </div>
        </div>
      )}

      {view === 'board' && !mobile ? (
        filtered.length === 0 ? (
          <EmptyState icon="🔨" text="No active renovations match this filter." />
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
      <SectionBar>Renovation Projects ({filtered.length})</SectionBar>

      {filtered.length===0 ? (
        <EmptyState icon="🔨" text="No active renovations. Drop an Analyzer deal on the PURCHASED zone to start one." />
      ) : (
        <Card style={{ padding:0 }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'#F0EDE6' }}>
                <SortTh sortKeyName="address"     {...{sortKey,sortDir,toggleSort}}>Address</SortTh>
                <SortTh sortKeyName="owner"       {...{sortKey,sortDir,toggleSort}}>Owner</SortTh>
                <SortTh sortKeyName="disposition" {...{sortKey,sortDir,toggleSort}}>Type</SortTh>
                <SortTh sortKeyName="stage"       {...{sortKey,sortDir,toggleSort}}>Reno Stage</SortTh>
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
      <RehabRoundTracker property={dashboard} repairItems={dashboard?.repair_items || []} onChange={()=>{}} open={!!dashboard} onClose={()=>{ setDashboard(null); load() }} />
      {proposal && <ProposalModal property={proposal} onClose={() => setProposal(null)} />}
    </PageWrap>
  )
}

