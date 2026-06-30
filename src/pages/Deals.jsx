import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { PageWrap, SectionBar, Card, Field, FieldRow, inp, monoInp, Btn, Badge, EmptyState, LoadingSpinner, StatCard, fmt, fmtK } from '../components/ui.jsx'
import Drawer from '../components/Drawer.jsx'
import AddressInput from '../components/AddressInput.jsx'
import MobileCard, { CardRow, CardLabel, CardValue } from '../components/MobileCard.jsx'

const TYPE_COLORS   = { listing:'#3B6D11', wholesale:'#6b21a8', referral:'#2D6FAF' }
const STATUS_COLORS = { active_listing:'#2D6FAF', pending:'#D97825', closed:'#3B6D11', lost:'#9ca3af' }
const STATUS_LABELS = { active_listing:'Active', pending:'Pending', closed:'Closed', lost:'Lost' }
const EMPTY = { address:'', deal_type:'listing', status:'active_listing', sale_price:'', commission_pct:'', commission_earned:'', mailing_id:'', notes:'' }

export default function Deals() {
  const [deals, setDeals] = useState([])
  const [mailings, setMailings] = useState([])
  const [loading, setLoading] = useState(true)
  const [drawer, setDrawer] = useState(null)
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const mobile = useIsMobile()

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    const [{ data:d }, { data:m }] = await Promise.all([
      supabase.from('cashoffer_mailing_deals').select('*').not('deal_type','eq','cash_purchase').order('created_at',{ascending:false}),
      supabase.from('cashoffer_mailings').select('id,campaign_name,drop_date').order('drop_date',{ascending:false}),
    ])
    setDeals(d||[])
    setMailings(m||[])
    setLoading(false)
  }

  const closed      = deals.filter(d=>d.status==='closed')
  const totalComm   = closed.reduce((s,d)=>s+(parseFloat(d.commission_earned)||0),0)
  const totalVolume = closed.filter(d=>d.sale_price).reduce((s,d)=>s+(parseFloat(d.sale_price)||0),0)
  const pipeline    = deals.filter(d=>['active_listing','pending'].includes(d.status))

  const filtered = deals.filter(d=>{
    const matchType   = typeFilter==='all'||d.deal_type===typeFilter
    const matchStatus = statusFilter==='all'||d.status===statusFilter
    return matchType && matchStatus
  })

  if (loading) return <LoadingSpinner />

  return (
    <PageWrap>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <div>
          <h1 style={{ fontSize: mobile?18:20, fontWeight:700, color:'#2C2C2C' }}>Deals</h1>
          <p style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>Listings, wholesales and referrals</p>
        </div>
        <Btn onClick={()=>setDrawer({...EMPTY})} style={{ fontSize:12, padding:'7px 14px' }}>+ Add Deal</Btn>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns: mobile?'repeat(2,1fr)':'repeat(4,1fr)', gap:10, marginBottom:16 }}>
        <StatCard label="Total" value={deals.length} topColor="#B8892A" />
        <StatCard label="Pipeline" value={pipeline.length} topColor="#2D6FAF" />
        <StatCard label="Closed" value={closed.length} topColor="#3B6D11" />
        <StatCard label="NHC Commission" value={fmtK(totalComm)} topColor="#3B6D11" />
      </div>

      {/* Type cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:14 }}>
        {[['listing','Listings','#3B6D11'],['wholesale','Wholesales','#6b21a8'],['referral','Referrals','#2D6FAF']].map(([t,l,color])=>(
          <div key={t} onClick={()=>setTypeFilter(typeFilter===t?'all':t)} style={{ background:'#fff', borderRadius:8, border:`2px solid ${typeFilter===t?color:'#D6D2CA'}`, padding: mobile?'8px 10px':'10px 14px', cursor:'pointer' }}>
            <div style={{ fontSize:10, fontWeight:600, letterSpacing:1, color:typeFilter===t?color:'#6b7280', textTransform:'uppercase' }}>{l}</div>
            <div style={{ fontSize: mobile?18:22, fontWeight:700, color:typeFilter===t?color:'#2C2C2C' }}>{deals.filter(d=>d.deal_type===t).length}</div>
          </div>
        ))}
      </div>

      {/* Status filters */}
      <div style={{ display:'flex', gap:4, marginBottom:12, flexWrap:'wrap' }}>
        {['all','active_listing','pending','closed','lost'].map(s=>(
          <button key={s} onClick={()=>setStatusFilter(s)} style={{ padding:'5px 10px', border:'none', borderRadius:4, cursor:'pointer', background:statusFilter===s?'#2C2C2C':'#F0EDE6', color:statusFilter===s?'#fff':'#6b7280', fontSize:11, fontWeight:statusFilter===s?700:400, fontFamily:'inherit' }}>
            {s==='all'?`All (${deals.length})`:`${STATUS_LABELS[s]||s} (${deals.filter(d=>d.status===s).length})`}
          </button>
        ))}
      </div>

      <SectionBar>Deals ({filtered.length})</SectionBar>

      {filtered.length===0 ? <EmptyState icon="○" text="No deals yet." /> : mobile ? (
        // ── MOBILE CARDS ──
        <div style={{ marginTop:8 }}>
          {filtered.map(d=>{
            const src = mailings.find(m=>m.id===d.mailing_id)
            const sc = STATUS_COLORS[d.status]||'#9ca3af'
            const tc = TYPE_COLORS[d.deal_type]||'#B8892A'
            return (
              <MobileCard key={d.id} onClick={()=>setDrawer({...d})} accent={tc}>
                <CardRow>
                  <span style={{ fontSize:13, fontWeight:700, color:'#2C2C2C', flex:1, marginRight:8 }}>{d.address}</span>
                  <span style={{ background:sc+'20', color:sc, border:`1px solid ${sc}40`, borderRadius:4, padding:'2px 6px', fontSize:10, fontWeight:700, textTransform:'uppercase', whiteSpace:'nowrap' }}>{STATUS_LABELS[d.status]}</span>
                </CardRow>
                <CardRow style={{ marginTop:4 }}>
                  <Badge color={tc}>{d.deal_type}</Badge>
                  {d.commission_earned && <CardValue mono color="#3B6D11">{fmt(d.commission_earned)}</CardValue>}
                  {d.sale_price && <CardValue mono color="#6b7280">{fmt(d.sale_price)}</CardValue>}
                </CardRow>
                {src && <span style={{ fontSize:11, color:'#2D6FAF', marginTop:2 }}>{src.campaign_name?.replace(/^Campaign \d+ — /,'')}</span>}
              </MobileCard>
            )
          })}
        </div>
      ) : (
        // ── DESKTOP TABLE ──
        <Card style={{ padding:0 }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead><tr style={{ background:'#F0EDE6' }}>
              {['Address','Type','Status','Sale Price','Commission','Source Campaign','Notes'].map(h=>(
                <th key={h} style={{ padding:'8px 14px', textAlign:'left', fontSize:11, fontWeight:600, letterSpacing:0.8, color:'#6b7280', textTransform:'uppercase', whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map((d,i)=>{
                const src = mailings.find(m=>m.id===d.mailing_id)
                return (
                  <tr key={d.id} onClick={()=>setDrawer({...d})} style={{ background:i%2===0?'#fff':'#FAFAF8', borderTop:'0.5px solid #F0EDE6', cursor:'pointer' }}
                    onMouseEnter={e=>e.currentTarget.style.background='#fef9f0'}
                    onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'#fff':'#FAFAF8'}>
                    <td style={{ padding:'10px 14px', fontSize:13, fontWeight:600 }}>{d.address}</td>
                    <td style={{ padding:'10px 14px' }}><Badge color={TYPE_COLORS[d.deal_type]||'#B8892A'}>{d.deal_type}</Badge></td>
                    <td style={{ padding:'10px 14px' }}><Badge color={STATUS_COLORS[d.status]||'#9ca3af'}>{STATUS_LABELS[d.status]||d.status}</Badge></td>
                    <td style={{ padding:'10px 14px', fontSize:13, fontFamily:'monospace' }}>{fmt(d.sale_price)}</td>
                    <td style={{ padding:'10px 14px', fontSize:13, fontFamily:'monospace', fontWeight:600, color:'#3B6D11' }}>{fmt(d.commission_earned)}</td>
                    <td style={{ padding:'10px 14px', fontSize:12, color:'#2D6FAF' }}>{src?.campaign_name?.replace(/^Campaign \d+ — /,'')||'—'}</td>
                    <td style={{ padding:'10px 14px', fontSize:12, color:'#6b7280', maxWidth:200 }}><div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.notes||'—'}</div></td>
                  </tr>
                )
              })}
            </tbody>
            {closed.length>0 && (
              <tfoot><tr style={{ borderTop:'2px solid #D6D2CA', background:'#F0EDE6' }}>
                <td colSpan={3} style={{ padding:'8px 14px', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:0.8 }}>Totals</td>
                <td style={{ padding:'8px 14px', fontSize:13, fontFamily:'monospace', fontWeight:700 }}>{fmtK(totalVolume)}</td>
                <td style={{ padding:'8px 14px', fontSize:13, fontFamily:'monospace', fontWeight:700, color:'#3B6D11' }}>{fmtK(totalComm)}</td>
                <td colSpan={2}></td>
              </tr></tfoot>
            )}
          </table>
        </Card>
      )}

      <DealDrawer deal={drawer} mailings={mailings} open={!!drawer} onClose={()=>setDrawer(null)} onSave={()=>{ setDrawer(null); load() }} />
    </PageWrap>
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
    const payload = { address:form.address, deal_type:form.deal_type||'listing', status:form.status||'active_listing', sale_price:form.sale_price||null, commission_pct:form.commission_pct||null, commission_earned:form.commission_earned||null, mailing_id:form.mailing_id||null, notes:form.notes||null, entity:'NHC' }
    if (isNew) await supabase.from('cashoffer_mailing_deals').insert(payload)
    else await supabase.from('cashoffer_mailing_deals').update(payload).eq('id',form.id)
    onSave()
  }
  async function del() {
    if (!confirm('Delete this deal?')) return
    await supabase.from('cashoffer_mailing_deals').delete().eq('id',form.id)
    onSave()
  }

  const typeBtn = (val,color) => ({ flex:1, padding:'8px', border:'none', borderRadius:6, cursor:'pointer', fontWeight:form.deal_type===val?700:400, fontSize:12, fontFamily:'inherit', background:form.deal_type===val?color:'#F0EDE6', color:form.deal_type===val?'#fff':'#6b7280' })

  return (
    <Drawer open={open} onClose={onClose} title={form.address||'New Deal'} subtitle={form.deal_type?`${form.deal_type} · ${STATUS_LABELS[form.status]||form.status}`:''}>
      <div style={{ display:'flex', flexDirection:'column', gap:14, paddingTop:12 }}>
        <Field label="Address"><AddressInput value={form.address||''} onChange={v=>setForm(f=>({...f,address:v}))} /></Field>
        <Field label="Deal Type">
          <div style={{ display:'flex', gap:8 }}>
            <button style={typeBtn('listing','#3B6D11')} onClick={()=>setForm(f=>({...f,deal_type:'listing'}))}>Listing</button>
            <button style={typeBtn('wholesale','#6b21a8')} onClick={()=>setForm(f=>({...f,deal_type:'wholesale'}))}>Wholesale</button>
            <button style={typeBtn('referral','#2D6FAF')} onClick={()=>setForm(f=>({...f,deal_type:'referral'}))}>Referral</button>
          </div>
        </Field>
        <Field label="Status">
          <select style={inp} value={form.status||'active_listing'} onChange={set('status')}>
            <option value="active_listing">Active</option>
            <option value="pending">Pending</option>
            <option value="closed">Closed</option>
            <option value="lost">Lost</option>
          </select>
        </Field>
        <div className="drawer-section">Financials</div>
        <FieldRow>
          <Field label="Sale Price ($)"><input style={monoInp} type="number" value={form.sale_price||''} onChange={e=>handlePrice(e.target.value)} placeholder="285000" /></Field>
          <Field label="Commission %"><input style={monoInp} type="number" value={form.commission_pct||''} onChange={e=>handlePct(e.target.value)} placeholder="3" /></Field>
        </FieldRow>
        <Field label="Commission Earned ($)"><input style={monoInp} type="number" value={form.commission_earned||''} onChange={set('commission_earned')} placeholder="Auto-calculated" /></Field>
        {form.commission_earned && (
          <div style={{ background:'#f0fdf4', borderRadius:6, padding:'10px 14px', display:'flex', justifyContent:'space-between' }}>
            <span style={{ fontSize:12, color:'#6b7280' }}>NHC Commission</span>
            <span style={{ fontSize:15, fontWeight:700, fontFamily:'monospace', color:'#3B6D11' }}>{fmt(form.commission_earned)}</span>
          </div>
        )}
        <div className="drawer-section">Source</div>
        <Field label="Mailing Campaign">
          <select style={inp} value={form.mailing_id||''} onChange={set('mailing_id')}>
            <option value="">No specific campaign</option>
            {mailings.map(m=><option key={m.id} value={m.id}>{m.campaign_name?.replace(/^Campaign \d+ — /,'')} {m.drop_date?`(${m.drop_date})`:''}</option>)}
          </select>
        </Field>
        <Field label="Notes"><textarea style={{ ...inp, minHeight:64, resize:'vertical' }} value={form.notes||''} onChange={set('notes')} placeholder="Agent, seller situation, deal details..." /></Field>
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:8 }}>
          {!isNew && <Btn variant="danger" onClick={del}>Delete</Btn>}
          <div style={{ display:'flex', gap:8, marginLeft:'auto' }}>
            <Btn variant="outline" onClick={onClose}>Cancel</Btn>
            <Btn onClick={save} disabled={!form.address}>Save</Btn>
          </div>
        </div>
      </div>
    </Drawer>
  )
}
