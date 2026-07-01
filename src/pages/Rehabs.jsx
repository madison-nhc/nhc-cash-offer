import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { PageWrap, SectionBar, Card, Badge, EmptyState, LoadingSpinner, fmt, useSort, SortTh } from '../components/ui.jsx'
import PropertyDrawer from '../components/PropertyDrawer.jsx'

const STAGE_COLOR = {
  'Not Started': '#9ca3af',
  'Demo':        '#D97825',
  'Rough Work':  '#B8892A',
  'Inspections': '#2D6FAF',
  'Finishes':    '#6b21a8',
  'Punch List':  '#3B6D11',
  'Complete':    '#3B6D11',
}

function MiniStat({ label, value, sub, color = '#2C2C2C' }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
      <div style={{ fontSize:10, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.7 }}>{label}</div>
      <div style={{ fontSize:22, fontWeight:700, fontFamily:'monospace', color }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize:10, color:'#9ca3af' }}>{sub}</div>}
    </div>
  )
}

export default function Rehabs() {
  const mobile = useIsMobile()
  const [properties, setProperties] = useState([])
  const [mailings, setMailings] = useState([])
  const [loading, setLoading] = useState(true)
  const [drawer, setDrawer] = useState(null)
  const [stageFilter, setStageFilter] = useState('all')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: p }, { data: m }] = await Promise.all([
      supabase.from('cashoffer_properties').select('*').eq('rehab_active', true).order('rehab_start_date', { ascending: false }),
      supabase.from('cashoffer_mailings').select('id,campaign_name,drop_date').order('drop_date', { ascending: false }),
    ])
    setProperties(p || [])
    setMailings(m || [])
    setLoading(false)
  }

  // Aggregate rehab stats
  const totalEstimated = properties.reduce((s, p) => s + (parseFloat(p.rehab_estimated_cost) || 0), 0)
  const byStage = {}
  const STAGES = ['Not Started', 'Demo', 'Rough Work', 'Inspections', 'Finishes', 'Punch List', 'Complete']
  STAGES.forEach(st => { byStage[st] = properties.filter(p => p.rehab_stage === st).length })

  const filtered = stageFilter === 'all' ? properties : properties.filter(p => p.rehab_stage === stageFilter)

  const { sorted, sortKey, sortDir, toggleSort } = useSort(filtered, 'rehab_start_date', 'desc', {
    stage: p => STAGES.indexOf(p.rehab_stage),
    days_active: p => p.rehab_start_date ? Math.floor((Date.now() - new Date(p.rehab_start_date)) / 86400000) : null,
  })

  if (loading) return <LoadingSpinner />

  return (
    <PageWrap pad={!mobile}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, color:'#2C2C2C' }}>Rehabs</h1>
          <p style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>Active rehab projects · all entities</p>
        </div>
      </div>

      {/* Summary stat cards */}
      <div style={{ display:'grid', gridTemplateColumns: mobile ? '1fr 1fr' : 'repeat(4,1fr)', gap:12, marginBottom:24 }}>
        {[
          { label:'Active Rehabs',   value: properties.length,                         color:'#D97825' },
          { label:'Est. Budget',     value: totalEstimated > 0 ? `$${Math.round(totalEstimated/1000)}K` : '—', color:'#2C2C2C' },
          { label:'In Progress',     value: properties.filter(p => p.rehab_stage !== 'Not Started' && p.rehab_stage !== 'Complete').length, color:'#B8892A' },
          { label:'Complete',        value: byStage['Complete'] || 0, color:'#3B6D11' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background:'#fff', border:'0.5px solid #D6D2CA', borderRadius:8, borderTop:`3px solid ${color}`, padding:'12px 16px' }}>
            <div style={{ fontSize:10, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.8, marginBottom:6 }}>{label}</div>
            <div style={{ fontSize:24, fontWeight:700, color, fontFamily:'monospace' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Stage filter pills */}
      <div style={{ display:'flex', gap:4, marginBottom:14, flexWrap:'wrap' }}>
        <button onClick={() => setStageFilter('all')} style={{ padding:'5px 14px', border:'none', borderRadius:4, cursor:'pointer', background: stageFilter==='all'?'#2C2C2C':'#F0EDE6', color: stageFilter==='all'?'#fff':'#6b7280', fontSize:11, fontWeight: stageFilter==='all'?700:400, fontFamily:'inherit' }}>
          All ({properties.length})
        </button>
        {STAGES.map(st => (
          <button key={st} onClick={() => setStageFilter(st)} style={{ padding:'5px 14px', border:'none', borderRadius:4, cursor:'pointer', background: stageFilter===st?STAGE_COLOR[st]:'#F0EDE6', color: stageFilter===st?'#fff':'#6b7280', fontSize:11, fontWeight: stageFilter===st?700:400, fontFamily:'inherit', whiteSpace:'nowrap' }}>
            {st} {byStage[st] > 0 ? `(${byStage[st]})` : ''}
          </button>
        ))}
      </div>

      <SectionBar>Rehab Projects ({filtered.length})</SectionBar>

      {filtered.length === 0 ? (
        <EmptyState icon="🔨" text="No active rehabs. Toggle 'Active Rehab' on a property to add it here." />
      ) : (
        <Card style={{ padding:0 }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'#F0EDE6' }}>
                <SortTh sortKeyName="address"     {...{sortKey,sortDir,toggleSort}}>Address</SortTh>
                <SortTh sortKeyName="owner"       {...{sortKey,sortDir,toggleSort}}>Owner</SortTh>
                <SortTh sortKeyName="disposition" {...{sortKey,sortDir,toggleSort}}>Type</SortTh>
                <SortTh sortKeyName="stage"       {...{sortKey,sortDir,toggleSort}}>Stage</SortTh>
                <SortTh sortKeyName="days_active" {...{sortKey,sortDir,toggleSort}}>Days Active</SortTh>
                <SortTh sortKeyName="rehab_estimated_cost" {...{sortKey,sortDir,toggleSort}}>Est. Budget</SortTh>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, i) => {
                const daysActive = p.rehab_start_date
                  ? Math.floor((Date.now() - new Date(p.rehab_start_date)) / 86400000)
                  : null
                const stageColor = STAGE_COLOR[p.rehab_stage] || '#9ca3af'
                const dispLabel = { flip:'Flip', hold:'Hold', listing:'Listing', wholesale:'Wholesale' }
                return (
                  <tr key={p.id} onClick={() => setDrawer(p)}
                    style={{ background: i%2===0?'#fff':'#FAFAF8', borderTop:'0.5px solid #F0EDE6', cursor:'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background='#fef9f0'}
                    onMouseLeave={e => e.currentTarget.style.background=i%2===0?'#fff':'#FAFAF8'}>
                    <td style={{ padding:'10px 14px', fontSize:13, fontWeight:600 }}>{p.address}</td>
                    <td style={{ padding:'10px 14px', fontSize:12, color:'#6b7280' }}>{p.owner || 'BPV'}</td>
                    <td style={{ padding:'10px 14px', fontSize:12 }}>
                      {p.disposition ? <Badge color={stageColor}>{dispLabel[p.disposition] || p.disposition}</Badge> : <span style={{ color:'#B8892A', fontSize:11, fontWeight:600 }}>Analyzing</span>}
                    </td>
                    <td style={{ padding:'10px 14px' }}>
                      <span style={{ background: stageColor + '18', color: stageColor, fontSize:11, fontWeight:700, padding:'3px 8px', borderRadius:4, whiteSpace:'nowrap' }}>
                        {p.rehab_stage || 'Not Started'}
                      </span>
                    </td>
                    <td style={{ padding:'10px 14px', fontSize:13, fontFamily:'monospace', color: daysActive > 60 ? '#B91C1C' : '#6b7280' }}>
                      {daysActive !== null ? `${daysActive}d` : '—'}
                    </td>
                    <td style={{ padding:'10px 14px', fontSize:13, fontFamily:'monospace', color:'#6b7280' }}>
                      {p.rehab_estimated_cost ? fmt(p.rehab_estimated_cost) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}

      <PropertyDrawer property={drawer} open={!!drawer} onClose={() => setDrawer(null)} onSave={() => load()} mailings={mailings} />
    </PageWrap>
  )
}
