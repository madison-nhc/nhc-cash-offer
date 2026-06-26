import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { PageWrap, SectionBar, Card, Field, FieldRow, inp, monoInp, Btn, Badge, EmptyState, LoadingSpinner, StatCard, fmt, fmtK } from '../components/ui.jsx'
import Drawer from '../components/Drawer.jsx'
import AddressInput from '../components/AddressInput.jsx'

const STATUS_LABELS = { active_listing:'Active', pending:'Pending', closed:'Closed' }
const STATUS_COLORS = { active_listing:'#2D6FAF', pending:'#D97825', closed:'#3B6D11' }
const EMPTY_MAILING = { campaign_name:'', drop_date:'', list_size:'', piece_type:'Postcard', mailer_cost:'', calls_total:'', calls_answered:'', calls_missed:'', listings_sourced:'', purchased:'', wholesaled:'', notes:'' }

export default function MailingTracker() {
  const mobile = useIsMobile()
  const [mailings, setMailings] = useState([])
  const [loading, setLoading] = useState(true)
  const [campaignDrawer, setCampaignDrawer] = useState(null)

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    const [{ data:m }, { data:d }] = await Promise.all([
      supabase.from('mailings').select('*').order('drop_date',{ascending:true})
    ])
    setMailings(m||[])
    setLoading(false)
  }

  const totalPieces   = mailings.reduce((s,m)=>s+(m.list_size||0),0)
  const totalSpend    = mailings.reduce((s,m)=>s+(parseFloat(m.mailer_cost)||0),0)
  const totalCalls    = mailings.reduce((s,m)=>s+(m.calls_total||0),0)
  const totalAnswered = mailings.reduce((s,m)=>s+(m.calls_answered||0),0)
  const totalListings = mailings.reduce((s,m)=>s+(m.listings_sourced||0),0)
  const totalPurchased= mailings.reduce((s,m)=>s+(m.purchased||0),0)
  const totalWholesaled=mailings.reduce((s,m)=>s+(m.wholesaled||0),0)
  const avgRate = totalPieces>0 ? ((totalCalls/totalPieces)*1000).toFixed(1) : 0

  if (loading) return <LoadingSpinner />

  return (
    <PageWrap pad={!mobile}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, color:'#2C2C2C' }}>Mailing Tracker</h1>
          <p style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>Vyral mail campaigns · call performance · deal pipeline</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <Btn variant="outline" onClick={()=>setCampaignDrawer({...EMPTY_MAILING})}>+ Campaign</Btn>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns: mobile ? 'repeat(2,1fr)' : 'repeat(7,1fr)', gap:10, marginBottom:20 }}>
        <StatCard label="Total Pieces" value={totalPieces.toLocaleString()} topColor="#B8892A" />
        <StatCard label="Total Spend" value={totalSpend>0?fmtK(totalSpend):'—'} topColor="#D97825" />
        <StatCard label="Total Calls" value={totalCalls.toLocaleString()} topColor="#2D6FAF" />
        <StatCard label="Answered" value={totalAnswered.toLocaleString()} sub={totalCalls?`${((totalAnswered/totalCalls)*100).toFixed(0)}% answer rate`:''} topColor="#3B6D11" />
        <StatCard label="Avg Rate/1k" value={avgRate} topColor="#B8892A" />
        <StatCard label="Listings" value={totalListings} topColor="#3B6D11" />
        <StatCard label="Purchased" value={totalPurchased} sub={totalWholesaled>0?`${totalWholesaled} wholesaled`:''} topColor="#6b21a8" />
      </div>

      {true && (
        <>
          <SectionBar>Mailing Campaigns ({mailings.length})</SectionBar>
          {mailings.length===0 ? <EmptyState icon="✉" text="No campaigns yet." /> : (
            <Card style={{ padding:0 }}><div style={{ overflowX:'auto', WebkitOverflowScrolling:'touch' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', minWidth:900 }}>
                <thead>
                  <tr style={{ background:'#2C2C2C' }}>
                    {['#','Date','Pieces','Geography','Calls','Answered','Missed','Rate/1k','Listings','Purchased','Wholesaled','Cost'].map(h=>(
                      <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:10, fontWeight:700, letterSpacing:0.8, color:'#B8892A', textTransform:'uppercase', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mailings.map((m,i)=>{
                    const rate = m.list_size&&m.calls_total ? ((m.calls_total/m.list_size)*1000).toFixed(1) : null
                    const rc = parseFloat(rate)
                    const rateColor = rc>=6?'#3B6D11':rc>=4?'#B8892A':'#2D6FAF'
                    return (
                      <tr key={m.id} onClick={()=>setCampaignDrawer({...m})} style={{ background:i%2===0?'#fff':'#FAFAF8', borderTop:'0.5px solid #F0EDE6', cursor:'pointer' }}
                        onMouseEnter={e=>e.currentTarget.style.background='#fef9f0'}
                        onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'#fff':'#FAFAF8'}>
                        <td style={{ padding:'9px 12px', fontSize:12, fontWeight:700, color:'#9ca3af' }}>{i+1}</td>
                        <td style={{ padding:'9px 12px', fontSize:12, whiteSpace:'nowrap' }}>{m.drop_date?new Date(m.drop_date+'T12:00:00').toLocaleDateString():'—'}</td>
                        <td style={{ padding:'9px 12px', fontSize:12, fontFamily:'monospace' }}>{m.list_size?.toLocaleString()||'—'}</td>
                        <td style={{ padding:'9px 12px', fontSize:12, color:'#2D6FAF', maxWidth:200 }}><div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.campaign_name?.replace(/^Campaign \d+ — /,'')||'—'}</div></td>
                        <td style={{ padding:'9px 12px', fontSize:12, fontFamily:'monospace' }}>{m.calls_total??'—'}</td>
                        <td style={{ padding:'9px 12px', fontSize:12, fontFamily:'monospace' }}>{m.calls_answered??'—'}</td>
                        <td style={{ padding:'9px 12px', fontSize:12, fontFamily:'monospace', color:'#B91C1C' }}>{m.calls_missed??'—'}</td>
                        <td style={{ padding:'9px 12px' }}>{rate?<span style={{ fontFamily:'monospace', fontSize:13, fontWeight:700, color:rateColor }}>{rate}</span>:'—'}</td>
                        <td style={{ padding:'9px 12px', fontSize:12, fontFamily:'monospace' }}>{m.listings_sourced??0}</td>
                        <td style={{ padding:'9px 12px', fontSize:12, fontFamily:'monospace' }}>{m.purchased??0}</td>
                        <td style={{ padding:'9px 12px', fontSize:12, fontFamily:'monospace' }}>{m.wholesaled??0}</td>
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
                    <td style={{ padding:'9px 12px', fontSize:12, fontFamily:'monospace', fontWeight:700, color:'#ef4444' }}>{totalCalls-totalAnswered}</td>
                    <td style={{ padding:'9px 12px', fontSize:13, fontFamily:'monospace', fontWeight:700, color:'#B8892A' }}>{avgRate}</td>
                    <td style={{ padding:'9px 12px', fontSize:12, fontFamily:'monospace', fontWeight:700, color:'#fff' }}>{totalListings}</td>
                    <td style={{ padding:'9px 12px', fontSize:12, fontFamily:'monospace', fontWeight:700, color:'#fff' }}>{totalPurchased}</td>
                    <td style={{ padding:'9px 12px', fontSize:12, fontFamily:'monospace', fontWeight:700, color:'#fff' }}>{totalWholesaled}</td>
                    <td style={{ padding:'9px 12px', fontSize:12, fontFamily:'monospace', fontWeight:700, color:'#fff' }}>{totalSpend>0?fmtK(totalSpend):'—'}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            </Card>
          )}
        </>
      )}

      {tab==='deals' && (
        <>
          <SectionBar>Deals Sourced ({deals.length})</SectionBar>
          {deals.length===0 ? <EmptyState icon="○" text="No deals yet." /> : (
            <Card style={{ padding:0 }}>
              <table style={{ width:'100%', borderCollapse:'collapse', minWidth: mobile ? 0 : 600 }}>
                <thead>
                  <tr style={{ background:'#F0EDE6' }}>
                    {['Address','Type','Status','Sale Price','Commission','Source Campaign'].map(h=>(
                      <th key={h} style={{ padding:'8px 16px', textAlign:'left', fontSize:11, fontWeight:600, letterSpacing:0.8, color:'#6b7280', textTransform:'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {deals.map((d,i)=>{
                    const src = mailings.find(m=>m.id===d.mailing_id)
                    return (
                      <tr key={d.id} onClick={()=>setDealDrawer({...d})} style={{ background:i%2===0?'#fff':'#FAFAF8', borderTop:'0.5px solid #F0EDE6', cursor:'pointer' }}
                        onMouseEnter={e=>e.currentTarget.style.background='#fef9f0'}
                        onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'#fff':'#FAFAF8'}>
                        <td style={{ padding:'10px 16px', fontSize:13, fontWeight:600 }}>{d.address}</td>
                        <td style={{ padding:'10px 16px' }}><Badge color={d.deal_type==='listing'?'#3B6D11':'#D97825'}>{d.deal_type}</Badge></td>
                        <td style={{ padding:'10px 16px' }}><Badge color={STATUS_COLORS[d.status]}>{STATUS_LABELS[d.status]}</Badge></td>
                        <td style={{ padding:'10px 16px', fontSize:13, fontFamily:'monospace' }}>{fmt(d.sale_price)}</td>
                        <td style={{ padding:'10px 16px', fontSize:13, fontFamily:'monospace' }}>{fmt(d.commission_earned)}</td>
                        <td style={{ padding:'10px 16px', fontSize:12, color:'#2D6FAF' }}>{src?.campaign_name?.replace(/^Campaign \d+ — /,'')||'—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}

      <CampaignDrawer campaign={campaignDrawer} open={!!campaignDrawer} onClose={()=>setCampaignDrawer(null)} onSave={()=>{setCampaignDrawer(null);load()}} />
    </PageWrap>
  )
}

function CampaignDrawer({ campaign, open, onClose, onSave }) {
  const [form, setForm] = useState({})
  useEffect(()=>{ if(campaign) setForm({...campaign}) },[campaign])
  if (!campaign) return null
  const isNew = !form.id
  const set = k => e => setForm(f=>({...f,[k]:e.target.value}))
  const costPerPiece = form.mailer_cost&&form.list_size ? (parseFloat(form.mailer_cost)/parseInt(form.list_size)).toFixed(2) : null
  const rate = form.calls_total&&form.list_size ? ((parseInt(form.calls_total)/parseInt(form.list_size))*1000).toFixed(1) : null

  async function save() {
    const payload = { campaign_name:form.campaign_name, drop_date:form.drop_date||null, list_size:parseInt(form.list_size)||null, piece_type:form.piece_type||'Postcard', mailer_cost:form.mailer_cost||null, calls_total:parseInt(form.calls_total)||null, calls_answered:parseInt(form.calls_answered)||null, calls_missed:parseInt(form.calls_missed)||null, listings_sourced:parseInt(form.listings_sourced)||0, purchased:parseInt(form.purchased)||0, wholesaled:parseInt(form.wholesaled)||0, notes:form.notes, entity:'NHC' }
    if (isNew) await supabase.from('mailings').insert(payload)
    else await supabase.from('mailings').update(payload).eq('id',form.id)
    onSave()
  }
  async function del() {
    if (!confirm('Delete this campaign?')) return
    await supabase.from('mailings').delete().eq('id',form.id)
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
        <div className="drawer-section">Outcomes</div>
        <FieldRow>
          <Field label="Listings"><input style={monoInp} type="number" value={form.listings_sourced||''} onChange={set('listings_sourced')} /></Field>
          <Field label="Purchased"><input style={monoInp} type="number" value={form.purchased||''} onChange={set('purchased')} /></Field>
        </FieldRow>
        <Field label="Wholesaled"><input style={monoInp} type="number" value={form.wholesaled||''} onChange={set('wholesaled')} /></Field>
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

function DealDrawer({ deal, mailings, open, onClose, onSave }) {
  const [form, setForm] = useState({})
  useEffect(()=>{ if(deal) setForm({...deal}) },[deal])
  if (!deal) return null
  const isNew = !form.id
  const set = k => e => setForm(f=>({...f,[k]:e.target.value}))

  function handlePrice(val) { setForm(f=>({...f,sale_price:val,commission_earned:f.commission_pct&&val?(parseFloat(val)*parseFloat(f.commission_pct)/100).toFixed(2):f.commission_earned})) }
  function handlePct(val)   { setForm(f=>({...f,commission_pct:val,commission_earned:f.sale_price&&val?(parseFloat(f.sale_price)*parseFloat(val)/100).toFixed(2):f.commission_earned})) }

  async function save() {
    if (!form.address) return
    const payload = { address:form.address, deal_type:form.deal_type, status:form.status, sale_price:form.sale_price||null, commission_pct:form.commission_pct||null, commission_earned:form.commission_earned||null, notes:form.notes, mailing_id:form.mailing_id||null, entity:'NHC' }
    if (isNew) await supabase.from('mailing_deals').insert(payload)
    else await supabase.from('mailing_deals').update(payload).eq('id',form.id)
    onSave()
  }
  async function del() {
    if (!confirm('Delete this deal?')) return
    await supabase.from('mailing_deals').delete().eq('id',form.id)
    onSave()
  }

  const typeBtn = (val,color) => ({ flex:1, padding:'7px', border:'none', borderRadius:6, cursor:'pointer', fontWeight:600, fontSize:12, fontFamily:'inherit', background:form.deal_type===val?color:'#F0EDE6', color:form.deal_type===val?'#fff':'#6b7280' })

  return (
    <Drawer open={open} onClose={onClose} title={form.address||'New Deal'} subtitle={form.status ? STATUS_LABELS[form.status] : ''}>
      <div style={{ display:'flex', flexDirection:'column', gap:14, paddingTop:12 }}>
        <Field label="Property Address"><AddressInput value={form.address||''} onChange={v=>setForm(f=>({...f,address:v}))} /></Field>
        <div>
          <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:0.8, marginBottom:6 }}>Type</label>
          <div style={{ display:'flex', gap:8 }}>
            <button style={typeBtn('listing','#3B6D11')} onClick={()=>setForm(f=>({...f,deal_type:'listing'}))}>Listing</button>
            <button style={typeBtn('cash_purchase','#D97825')} onClick={()=>setForm(f=>({...f,deal_type:'cash_purchase'}))}>Cash Purchase</button>
            <button style={typeBtn('wholesale','#6b21a8')} onClick={()=>setForm(f=>({...f,deal_type:'wholesale'}))}>Wholesale</button>
          </div>
        </div>
        <Field label="Status">
          <select style={inp} value={form.status||'active_listing'} onChange={set('status')}>
            <option value="active_listing">Active</option>
            <option value="pending">Pending</option>
            <option value="closed">Closed</option>
          </select>
        </Field>
        <FieldRow>
          <Field label="Sale Price ($)"><input style={monoInp} type="number" value={form.sale_price||''} onChange={e=>handlePrice(e.target.value)} /></Field>
          <Field label="Commission %"><input style={monoInp} type="number" value={form.commission_pct||''} onChange={e=>handlePct(e.target.value)} /></Field>
        </FieldRow>
        <Field label="Commission Earned ($)"><input style={monoInp} type="number" value={form.commission_earned||''} onChange={set('commission_earned')} /></Field>
        <Field label="Source Campaign">
          <select style={inp} value={form.mailing_id||''} onChange={set('mailing_id')}>
            <option value="">No specific campaign</option>
            {mailings.map(m=><option key={m.id} value={m.id}>{m.campaign_name?.replace(/^Campaign \d+ — /,'')} {m.drop_date?`(${m.drop_date})`:''}</option>)}
          </select>
        </Field>
        <Field label="Notes"><textarea style={{ ...inp, minHeight:60, resize:'vertical' }} value={form.notes||''} onChange={set('notes')} /></Field>
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:8 }}>
          {!isNew && <Btn variant="danger" onClick={del}>Delete</Btn>}
          <div style={{ display:'flex', gap:8, marginLeft:'auto' }}>
            <Btn variant="outline" onClick={onClose}>Cancel</Btn>
            <Btn onClick={save}>Save Deal</Btn>
          </div>
        </div>
      </div>
    </Drawer>
  )
}
