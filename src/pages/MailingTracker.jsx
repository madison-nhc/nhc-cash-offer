import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { PageWrap, SectionBar, Card, Field, FieldRow, inp, monoInp, Btn, EmptyState, LoadingSpinner, fmt, fmtK, useSort, SortTh } from '../components/ui.jsx'
import Drawer from '../components/Drawer.jsx'

const EMPTY_MAILING = { campaign_name:'', drop_date:'', list_size:'', piece_type:'Postcard', mailer_cost:'', calls_total:'', calls_answered:'', calls_missed:'', notes:'' }

function GroupLabel({ children }) {
  return <div style={{ fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>{children}</div>
}

function MiniStat({ label, value, sub, color='#2C2C2C' }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
      <div style={{ fontSize:10, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.7 }}>{label}</div>
      <div style={{ fontSize:18, fontWeight:700, fontFamily:'monospace', color }}>{value}</div>
      {sub && <div style={{ fontSize:10, color:'#9ca3af' }}>{sub}</div>}
    </div>
  )
}

function StatGroup({ title, color, children }) {
  return (
    <div style={{ background:'#fff', border:'0.5px solid #D6D2CA', borderRadius:8, borderTop:`3px solid ${color}`, padding:'12px 16px' }}>
      <GroupLabel>{title}</GroupLabel>
      <div style={{ display:'flex', gap:24, flexWrap:'wrap' }}>{children}</div>
    </div>
  )
}

export default function MailingTracker() {
  const mobile = useIsMobile()
  const [mailings, setMailings] = useState([])
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [campaignDrawer, setCampaignDrawer] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data:m }, { data:p }] = await Promise.all([
      supabase.from('cashoffer_mailings').select('*').order('drop_date', { ascending:true }),
      supabase.from('cashoffer_properties').select('id,mailing_id,disposition,commission_earned,wholesale_fee,sale_price,purchase_price,closing_costs,rehab_cost'),
    ])
    setMailings(m||[])
    setProperties(p||[])
    setLoading(false)
  }

  // Derive outcome counts from properties
  function outcomesFor(mailingId) {
    const ps = properties.filter(p => p.mailing_id === mailingId)
    return {
      listings:   ps.filter(p => p.disposition === 'listing').length,
      purchased:  ps.filter(p => p.disposition === 'flip' || p.disposition === 'hold').length,
      wholesaled: ps.filter(p => p.disposition === 'wholesale').length,
      total:      ps.length,
      revenue: ps.reduce((s, p) => {
        if (p.disposition === 'listing' || p.disposition === 'wholesale') return s + (parseFloat(p.commission_earned)||0) + (parseFloat(p.wholesale_fee)||0)
        if (p.disposition === 'flip') return s + (parseFloat(p.commission_earned)||0)
        return s
      }, 0),
    }
  }

  const totalPieces    = mailings.reduce((s,m) => s+(m.list_size||0), 0)
  const totalSpend     = mailings.reduce((s,m) => s+(parseFloat(m.mailer_cost)||0), 0)
  const totalCalls     = mailings.reduce((s,m) => s+(m.calls_total||0), 0)
  const totalAnswered  = mailings.reduce((s,m) => s+(m.calls_answered||0), 0)
  const answerRate     = totalCalls > 0 ? ((totalAnswered/totalCalls)*100).toFixed(0) : 0
  const avgRate        = totalPieces > 0 ? ((totalCalls/totalPieces)*1000).toFixed(1) : 0
  const costPerPiece   = totalPieces > 0 && totalSpend > 0 ? (totalSpend/totalPieces).toFixed(2) : null

  const allOutcomes    = properties.filter(p => p.mailing_id)
  const totalListings  = allOutcomes.filter(p => p.disposition === 'listing').length
  const totalPurchased = allOutcomes.filter(p => p.disposition === 'flip' || p.disposition === 'hold').length
  const totalWholesaled= allOutcomes.filter(p => p.disposition === 'wholesale').length
  const totalRevenue   = allOutcomes.reduce((s,p) => s+(parseFloat(p.commission_earned)||0)+(parseFloat(p.wholesale_fee)||0), 0)

  const { sorted, sortKey, sortDir, toggleSort } = useSort(mailings, 'drop_date', 'desc', {
    rate: m => m.list_size && m.calls_total ? (m.calls_total/m.list_size)*1000 : null,
    listings: m => outcomesFor(m.id).listings,
    purchased: m => outcomesFor(m.id).purchased,
    wholesaled: m => outcomesFor(m.id).wholesaled,
  })

  if (loading) return <LoadingSpinner />

  return (
    <PageWrap pad={!mobile}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, color:'#2C2C2C' }}>Mailing Tracker</h1>
          <p style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>Vyral mail campaigns · call performance · deal pipeline</p>
        </div>
        <Btn variant="outline" onClick={()=>setCampaignDrawer({...EMPTY_MAILING})}>+ Campaign</Btn>
      </div>

      {/* Grouped stat cards */}
      <div style={{ display:'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr 1fr', gap:12, marginBottom:24 }}>
        <StatGroup title="Mailer" color="#B8892A">
          <MiniStat label="Pieces" value={totalPieces.toLocaleString()} />
          <MiniStat label="Spend" value={totalSpend>0?fmtK(totalSpend):'—'} />
          {costPerPiece && <MiniStat label="Cost/Piece" value={`$${costPerPiece}`} />}
        </StatGroup>
        <StatGroup title="Call Data" color="#2D6FAF">
          <MiniStat label="Calls" value={totalCalls.toLocaleString()} />
          <MiniStat label="Answered" value={totalAnswered.toLocaleString()} sub={`${answerRate}% rate`} color="#3B6D11" />
          <MiniStat label="Avg/1k" value={avgRate} />
        </StatGroup>
        <StatGroup title="Property Data" color="#3B6D11">
          <MiniStat label="Sourced" value={allOutcomes.length} />
          <MiniStat label="Listings" value={totalListings} color="#3B6D11" />
          <MiniStat label="Purchased" value={totalPurchased} color="#D97825" />
          <MiniStat label="Wholesale" value={totalWholesaled} color="#6b21a8" />
          {totalRevenue > 0 && <MiniStat label="Revenue" value={fmtK(totalRevenue)} color="#B8892A" />}
        </StatGroup>
      </div>

      <SectionBar>Mailing Campaigns ({mailings.length})</SectionBar>

      {mailings.length === 0 ? <EmptyState icon="✉" text="No campaigns yet." /> : (
        <Card style={{ padding:0 }}>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth:700 }}>
              <thead>
                <tr style={{ background:'#2C2C2C' }}>
                  <th style={{ padding:'8px 12px', textAlign:'left', fontSize:10, fontWeight:700, letterSpacing:0.8, color:'#B8892A', textTransform:'uppercase', whiteSpace:'nowrap' }}>#</th>
                  {[['drop_date','Date'],['list_size','Pieces'],['campaign_name','Geography'],['calls_total','Calls'],['calls_answered','Ans.'],['rate','Rate/1k'],['listings','Listings'],['purchased','Purchased'],['wholesaled','Wholesale'],['mailer_cost','Cost']].map(([key,label])=>(
                    <SortTh key={key} sortKeyName={key} {...{sortKey,sortDir,toggleSort}} style={{ color:'#B8892A' }}>{label}</SortTh>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((m, i) => {
                  const rate = m.list_size && m.calls_total ? ((m.calls_total/m.list_size)*1000).toFixed(1) : null
                  const rc = parseFloat(rate)
                  const rateColor = rc>=6?'#3B6D11':rc>=4?'#B8892A':'#2D6FAF'
                  const out = outcomesFor(m.id)
                  return (
                    <tr key={m.id} onClick={()=>setCampaignDrawer({...m})}
                      style={{ background:i%2===0?'#fff':'#FAFAF8', borderTop:'0.5px solid #F0EDE6', cursor:'pointer' }}
                      onMouseEnter={e=>e.currentTarget.style.background='#fef9f0'}
                      onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'#fff':'#FAFAF8'}>
                      <td style={{ padding:'9px 12px', fontSize:12, fontWeight:700, color:'#9ca3af' }}>{i+1}</td>
                      <td style={{ padding:'9px 12px', fontSize:12, whiteSpace:'nowrap' }}>{m.drop_date?new Date(m.drop_date+'T12:00:00').toLocaleDateString():'—'}</td>
                      <td style={{ padding:'9px 12px', fontSize:12, fontFamily:'monospace' }}>{m.list_size?.toLocaleString()||'—'}</td>
                      <td style={{ padding:'9px 12px', fontSize:12, color:'#2D6FAF', maxWidth:180 }}><div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.campaign_name?.replace(/^Campaign \d+ — /,'')||'—'}</div></td>
                      <td style={{ padding:'9px 12px', fontSize:12, fontFamily:'monospace' }}>{m.calls_total??'—'}</td>
                      <td style={{ padding:'9px 12px', fontSize:12, fontFamily:'monospace' }}>{m.calls_answered??'—'}</td>
                      <td style={{ padding:'9px 12px' }}>{rate?<span style={{ fontFamily:'monospace', fontSize:13, fontWeight:700, color:rateColor }}>{rate}</span>:'—'}</td>
                      <td style={{ padding:'9px 12px', fontSize:12, fontFamily:'monospace', color:'#3B6D11', fontWeight:out.listings>0?700:400 }}>{out.listings}</td>
                      <td style={{ padding:'9px 12px', fontSize:12, fontFamily:'monospace', color:'#D97825', fontWeight:out.purchased>0?700:400 }}>{out.purchased}</td>
                      <td style={{ padding:'9px 12px', fontSize:12, fontFamily:'monospace', color:'#6b21a8', fontWeight:out.wholesaled>0?700:400 }}>{out.wholesaled}</td>
                      <td style={{ padding:'9px 12px', fontSize:12, fontFamily:'monospace', color:'#6b7280' }}>{m.mailer_cost?fmt(m.mailer_cost):'—'}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ background:'#2C2C2C', borderTop:'2px solid #B8892A' }}>
                  <td colSpan={2} style={{ padding:'9px 12px', fontSize:11, fontWeight:700, color:'#B8892A', textTransform:'uppercase', letterSpacing:1 }}>TOTAL</td>
                  <td style={{ padding:'9px 12px', fontSize:12, fontFamily:'monospace', fontWeight:700, color:'#fff' }}>{totalPieces.toLocaleString()}</td>
                  <td />
                  <td style={{ padding:'9px 12px', fontSize:12, fontFamily:'monospace', fontWeight:700, color:'#fff' }}>{totalCalls}</td>
                  <td style={{ padding:'9px 12px', fontSize:12, fontFamily:'monospace', fontWeight:700, color:'#fff' }}>{totalAnswered}</td>
                  <td style={{ padding:'9px 12px', fontSize:13, fontFamily:'monospace', fontWeight:700, color:'#B8892A' }}>{avgRate}</td>
                  <td style={{ padding:'9px 12px', fontSize:12, fontFamily:'monospace', fontWeight:700, color:'#3B6D11' }}>{totalListings}</td>
                  <td style={{ padding:'9px 12px', fontSize:12, fontFamily:'monospace', fontWeight:700, color:'#D97825' }}>{totalPurchased}</td>
                  <td style={{ padding:'9px 12px', fontSize:12, fontFamily:'monospace', fontWeight:700, color:'#6b21a8' }}>{totalWholesaled}</td>
                  <td style={{ padding:'9px 12px', fontSize:12, fontFamily:'monospace', fontWeight:700, color:'#fff' }}>{totalSpend>0?fmtK(totalSpend):'—'}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      <CampaignDrawer campaign={campaignDrawer} properties={properties} open={!!campaignDrawer} onClose={()=>setCampaignDrawer(null)} onSave={()=>{setCampaignDrawer(null);load()}} />
    </PageWrap>
  )
}

function CampaignDrawer({ campaign, properties, open, onClose, onSave }) {
  const [form, setForm] = useState({})
  useEffect(() => { if (campaign) setForm({...campaign}) }, [campaign])
  if (!campaign) return null
  const isNew = !form.id
  const set = k => e => setForm(f=>({...f,[k]:e.target.value}))
  const costPerPiece = form.mailer_cost&&form.list_size ? (parseFloat(form.mailer_cost)/parseInt(form.list_size)).toFixed(2) : null
  const rate = form.calls_total&&form.list_size ? ((parseInt(form.calls_total)/parseInt(form.list_size))*1000).toFixed(1) : null

  // Live outcome counts from properties
  const linked = properties.filter(p => p.mailing_id === form.id)
  const listings   = linked.filter(p => p.disposition === 'listing').length
  const purchased  = linked.filter(p => p.disposition === 'flip' || p.disposition === 'hold').length
  const wholesaled = linked.filter(p => p.disposition === 'wholesale').length

  async function save() {
    const payload = { campaign_name:form.campaign_name, drop_date:form.drop_date||null, list_size:parseInt(form.list_size)||null, piece_type:form.piece_type||'Postcard', mailer_cost:form.mailer_cost||null, calls_total:parseInt(form.calls_total)||null, calls_answered:parseInt(form.calls_answered)||null, calls_missed:parseInt(form.calls_missed)||null, notes:form.notes, entity:'NHC' }
    if (isNew) await supabase.from('cashoffer_mailings').insert(payload)
    else await supabase.from('cashoffer_mailings').update(payload).eq('id', form.id)
    onSave()
  }
  async function del() {
    if (!confirm('Delete this campaign?')) return
    await supabase.from('cashoffer_mailings').delete().eq('id', form.id)
    onSave()
  }

  return (
    <Drawer open={open} onClose={onClose} title={form.campaign_name?.replace(/^Campaign \d+ — /,'')||'New Campaign'} subtitle={form.drop_date?`Dropped ${new Date(form.drop_date+'T12:00:00').toLocaleDateString()}`:''}>
      <div style={{ display:'flex', flexDirection:'column', gap:14, paddingTop:12 }}>
        <Field label="Campaign Name / Geography"><input style={inp} value={form.campaign_name||''} onChange={set('campaign_name')} placeholder="Bourbon, Clark, Scott Counties" /></Field>
        <FieldRow>
          <Field label="Drop Date"><input style={inp} type="date" value={form.drop_date||''} onChange={set('drop_date')} /></Field>
          <Field label="Pieces Mailed"><input style={monoInp} type="number" value={form.list_size||''} onChange={set('list_size')} placeholder="10000" /></Field>
        </FieldRow>
        <FieldRow>
          <Field label="Piece Type">
            <select style={inp} value={form.piece_type||'Postcard'} onChange={set('piece_type')}>
              {['Postcard','Letter','Yellow Letter','Handwritten','Email','Other'].map(t=><option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Total Cost ($)"><input style={monoInp} type="number" value={form.mailer_cost||''} onChange={set('mailer_cost')} placeholder="1250" /></Field>
        </FieldRow>
        {costPerPiece && <div style={{ background:'#f0f6ff', borderRadius:6, padding:'7px 12px', fontSize:12, color:'#2D6FAF', fontWeight:600 }}>${costPerPiece}/piece{rate?` · ${rate} calls/1k`:''}</div>}

        <div className="drawer-section">Call Performance</div>
        <FieldRow>
          <Field label="Total Calls"><input style={monoInp} type="number" value={form.calls_total||''} onChange={set('calls_total')} /></Field>
          <Field label="Answered"><input style={monoInp} type="number" value={form.calls_answered||''} onChange={set('calls_answered')} /></Field>
        </FieldRow>
        <Field label="Missed"><input style={monoInp} type="number" value={form.calls_missed||''} onChange={set('calls_missed')} /></Field>

        {!isNew && (
          <>
            <div className="drawer-section">Outcomes (auto from properties)</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
              {[['Listings', listings, '#3B6D11'],['Purchased', purchased, '#D97825'],['Wholesaled', wholesaled, '#6b21a8']].map(([label, val, color])=>(
                <div key={label} style={{ background:'#FAFAF8', border:'0.5px solid #D6D2CA', borderRadius:6, padding:'10px 12px', textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.7, marginBottom:4 }}>{label}</div>
                  <div style={{ fontSize:22, fontWeight:700, fontFamily:'monospace', color: val>0?color:'#D6D2CA' }}>{val}</div>
                </div>
              ))}
            </div>
            {linked.length === 0 && <p style={{ fontSize:12, color:'#9ca3af', fontStyle:'italic' }}>No properties linked to this campaign yet. Select this campaign from a property's Disposition tab.</p>}
          </>
        )}

        <Field label="Notes"><textarea style={{ ...inp, minHeight:56, resize:'vertical' }} value={form.notes||''} onChange={set('notes')} /></Field>
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:8 }}>
          {!isNew && <Btn variant="danger" onClick={del}>Delete</Btn>}
          <div style={{ display:'flex', gap:8, marginLeft:'auto' }}>
            <Btn variant="outline" onClick={onClose}>Cancel</Btn>
            <Btn onClick={save}>Save Campaign</Btn>
          </div>
        </div>
      </div>
    </Drawer>
  )
}
