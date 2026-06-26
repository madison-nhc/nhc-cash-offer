import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { PageWrap, SectionBar, Card, Field, FieldRow, inp, monoInp, Btn, Badge, EmptyState, LoadingSpinner, StatCard, fmt, fmtK } from '../components/ui.jsx'
import Drawer from '../components/Drawer.jsx'

const STATUS_COLORS = { analyzing:'#B8892A', active:'#2D6FAF', closed:'#3B6D11', passed:'#6b7280' }
const UNIT_COLORS   = { 1:'#3B6D11', 2:'#2D6FAF', 3:'#D97825', 4:'#B8892A', 5:'#6b21a8' }
const UNIT_LABELS   = { 1:'SFR', 2:'Duplex', 3:'Triplex', 4:'Quad' }
const EMPTY_PKG  = { deal_name:'', status:'analyzing', total_arv:'', total_purchase:'', total_rehab:'', notes:'' }
const EMPTY_PROP = { address:'', arv:'', purchase_price:'', rehab_cost:'', unit_count:1, monthly_rent:'', current_rent:'', market_rent:'', condition_rating:null, property_type:'hold', notes:'', excluded:false }

function UnitPicker({ value, onChange }) {
  return (
    <div style={{ display:'flex', gap:6 }}>
      {[1,2,3,4,'5+'].map(n => {
        const val = n==='5+'?5:n
        const active = value===val||(n==='5+'&&value>=5)
        const color = UNIT_COLORS[Math.min(val,5)]||'#6b21a8'
        return (
          <button key={n} onClick={()=>onChange(val)} style={{ flex:1, padding:'8px 4px', border:active?`2px solid ${color}`:'1.5px solid #D6D2CA', borderRadius:6, cursor:'pointer', fontWeight:active?700:400, fontSize:12, fontFamily:'inherit', background:active?color+'15':'#fff', color:active?color:'#6b7280', transition:'all 0.12s' }}>
            {n}{n!=='5+'&&<div style={{ fontSize:9, opacity:0.7, marginTop:1 }}>{UNIT_LABELS[n]}</div>}
          </button>
        )
      })}
    </div>
  )
}

function UnitBadge({ n }) {
  const num = parseInt(n)||1
  const color = UNIT_COLORS[Math.min(num,5)]||'#6b21a8'
  const label = num===1?'SFR':num===2?'Duplex':num===3?'Triplex':num===4?'Quad':`${num} units`
  return <span style={{ display:'inline-block', padding:'2px 7px', borderRadius:4, fontSize:10, fontWeight:700, letterSpacing:0.5, background:color+'18', color, border:`1px solid ${color}40` }}>{label}</span>
}

function ConditionStars({ rating, onChange }) {
  return (
    <div style={{ display:'flex', gap:4 }}>
      {[1,2,3,4,5].map(n => (
        <button key={n} onClick={()=>onChange(n===rating?null:n)} style={{
          background:'none', border:'none', cursor:'pointer', fontSize:18, padding:'2px',
          color: n<=(rating||0) ? '#B8892A' : '#D6D2CA',
          transition:'color 0.1s'
        }}>★</button>
      ))}
      {rating && <span style={{ fontSize:11, color:'#6b7280', alignSelf:'center', marginLeft:2 }}>{['','Poor','Fair','Average','Good','Excellent'][rating]}</span>}
    </div>
  )
}

function ConditionDisplay({ rating }) {
  if (!rating) return <span style={{ color:'#9ca3af', fontSize:12 }}>—</span>
  const labels = ['','Poor','Fair','Average','Good','Excellent']
  const colors = ['','#B91C1C','#D97825','#B8892A','#2D6FAF','#3B6D11']
  return (
    <span style={{ fontSize:12, fontWeight:600, color:colors[rating] }}>
      {'★'.repeat(rating)}{'☆'.repeat(5-rating)} <span style={{ fontSize:11 }}>{labels[rating]}</span>
    </span>
  )
}

export default function PackageDeals() {
  const [packages, setPackages] = useState([])
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [pkgDrawer, setPkgDrawer] = useState(null)
  const [propDrawer, setPropDrawer] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [sortConfig, setSortConfig] = useState({}) // { [pkgId]: { key, dir } }

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    const [{ data:p }, { data:pr }] = await Promise.all([
      supabase.from('package_deals').select('*').order('created_at',{ascending:false}),
      supabase.from('package_deal_properties').select('*'),
    ])
    setPackages(p||[])
    setProperties(pr||[])
    setLoading(false)
  }

  async function toggleExclude(pr) {
    await supabase.from('package_deal_properties').update({ excluded: !pr.excluded }).eq('id', pr.id)
    load()
  }

  const totalUnits = properties.filter(p=>!p.excluded).reduce((s,p)=>s+(parseInt(p.unit_count)||1),0)
  const totalRent  = properties.filter(p=>!p.excluded).reduce((s,p)=>s+(parseFloat(p.market_rent||p.monthly_rent)||0),0)

  if (loading) return <LoadingSpinner />

  return (
    <PageWrap>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, color:'#2C2C2C' }}>Package Deals</h1>
          <p style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>Multi-property seller packages — analysis and underwriting</p>
        </div>
        <Btn onClick={()=>setPkgDrawer({...EMPTY_PKG})}>+ New Package</Btn>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        <StatCard label="Total Packages" value={packages.length} topColor="#6b21a8" />
        <StatCard label="Active / Analyzing" value={packages.filter(p=>p.status==='analyzing'||p.status==='active').length} topColor="#B8892A" />
        <StatCard label="Active Units" value={totalUnits.toLocaleString()} sub="excluded properties removed" topColor="#2D6FAF" />
        <StatCard label="Market Rent (active)" value={fmtK(totalRent)} sub="per month" topColor="#3B6D11" />
      </div>

      <SectionBar>All Packages ({packages.length})</SectionBar>

      {packages.length===0 ? <EmptyState icon="⊕" text="No package deals yet." /> : packages.map(pkg => {
        const sc = sortConfig[pkg.id] || { key:'unit_count', dir:'asc' }
        const allProps  = properties
          .filter(pr=>pr.package_id===pkg.id)
          .sort((a,b)=>{
            let av, bv
            if (sc.key==='unit_count') { av=parseInt(a.unit_count)||1; bv=parseInt(b.unit_count)||1 }
            else if (sc.key==='condition_rating') { av=parseInt(a.condition_rating)||0; bv=parseInt(b.condition_rating)||0 }
            else if (sc.key==='address') { return sc.dir==='asc'?(a.address||'').localeCompare(b.address||''):(b.address||'').localeCompare(a.address||'') }
            else { av=parseFloat(a[sc.key])||0; bv=parseFloat(b[sc.key])||0 }
            const diff = sc.dir==='asc' ? av-bv : bv-av
            return diff!==0 ? diff : (a.address||'').localeCompare(b.address||'')
          })
        const active    = allProps.filter(pr=>!pr.excluded)
        const excluded  = allProps.filter(pr=>pr.excluded)

        const calcPurch   = active.reduce((s,pr)=>s+(parseFloat(pr.purchase_price)||0),0)
        const calcRehab   = active.reduce((s,pr)=>s+(parseFloat(pr.rehab_cost)||0),0)
        const calcARV     = active.reduce((s,pr)=>s+(parseFloat(pr.arv)||0),0)
        const calcCurrRent= active.reduce((s,pr)=>s+(parseFloat(pr.current_rent)||0),0)
        const calcMktRent = active.reduce((s,pr)=>s+(parseFloat(pr.market_rent)||0),0)
        const calcUnits   = active.reduce((s,pr)=>s+(parseInt(pr.unit_count)||1),0)

        const purchase  = parseFloat(pkg.total_purchase)||calcPurch
        const rehab     = parseFloat(pkg.total_rehab)||calcRehab
        const arv       = parseFloat(pkg.total_arv)||calcARV
        const profit    = arv - purchase - rehab
        const grossYield= purchase>0 ? ((calcMktRent*12)/purchase*100).toFixed(1) : null
        const isExpanded= expandedId===pkg.id

        const byType = {}
        active.forEach(p=>{ const n=parseInt(p.unit_count)||1; const l=n===1?'SFR':n===2?'Duplex':n===3?'Triplex':n===4?'Quad':`${n}+ Units`; byType[l]=(byType[l]||0)+1 })

        return (
          <Card key={pkg.id} style={{ marginTop:10, padding:0, overflow:'hidden' }}>
            {/* Header */}
            <div onClick={()=>setExpandedId(isExpanded?null:pkg.id)} style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', cursor:'pointer', background:isExpanded?'#FAFAF8':'#fff' }}
              onMouseEnter={e=>{ if(!isExpanded) e.currentTarget.style.background='#fef9f0' }}
              onMouseLeave={e=>{ e.currentTarget.style.background=isExpanded?'#FAFAF8':'#fff' }}>
              <span style={{ fontSize:16, color:'#9ca3af' }}>{isExpanded?'▾':'▸'}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:15, color:'#2C2C2C' }}>{pkg.deal_name}</div>
                <div style={{ fontSize:11, color:'#6b7280', marginTop:3, display:'flex', gap:10, flexWrap:'wrap' }}>
                  <span>{active.length} active · {calcUnits} units</span>
                  {excluded.length>0 && <span style={{ color:'#9ca3af' }}>{excluded.length} excluded</span>}
                  {Object.entries(byType).map(([t,c])=><span key={t} style={{ color:'#9ca3af' }}>{c} {t}</span>)}
                </div>
              </div>
              <Badge color={STATUS_COLORS[pkg.status]}>{pkg.status}</Badge>
              {calcMktRent>0 && <div style={{ textAlign:'right', marginLeft:8 }}>
                <div style={{ fontSize:13, fontFamily:'monospace', fontWeight:700, color:'#3B6D11' }}>{fmtK(calcMktRent)}<span style={{ fontSize:10, color:'#9ca3af' }}>/mo</span></div>
                {grossYield && <div style={{ fontSize:11, color:'#6b7280' }}>{grossYield}% yield</div>}
              </div>}
              <div style={{ textAlign:'right', marginLeft:12 }}>
                <div style={{ fontSize:13, fontFamily:'monospace', fontWeight:700 }}>{fmtK(purchase)}</div>
                <div style={{ fontSize:11, color:'#6b7280' }}>purchase</div>
              </div>
              <button onClick={e=>{e.stopPropagation();setPkgDrawer({...pkg})}} style={{ background:'none', border:'1px solid #D6D2CA', borderRadius:4, color:'#6b7280', cursor:'pointer', fontSize:11, fontFamily:'inherit', padding:'4px 10px', marginLeft:4 }}>Edit</button>
            </div>

            {isExpanded && (
              <div style={{ borderTop:'1px solid #F0EDE6' }}>
                {/* Financials bar */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', background:'#FAFAF8', borderBottom:'1px solid #F0EDE6' }}>
                  {[
                    ['Purchase',fmtK(purchase),'#B8892A'],
                    ['Rehab',fmtK(rehab),'#2D6FAF'],
                    ['ARV',fmtK(arv),'#B8892A'],
                    ['Current Rent',fmtK(calcCurrRent)+'/mo','#6b7280'],
                    ['Market Rent',fmtK(calcMktRent)+'/mo','#3B6D11'],
                    ['Est. Profit',(profit>=0?'+':'')+fmtK(profit),profit>=0?'#3B6D11':'#B91C1C'],
                  ].map(([l,v,c])=>(
                    <div key={l} style={{ padding:'10px 12px', borderRight:'1px solid #F0EDE6' }}>
                      <div style={{ fontSize:10, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.8 }}>{l}</div>
                      <div style={{ fontSize:14, fontWeight:700, fontFamily:'monospace', color:c, marginTop:2 }}>{v}</div>
                    </div>
                  ))}
                </div>

                {/* Properties table */}
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 16px', background:'#F0EDE6' }}>
                  <span style={{ fontSize:11, fontWeight:700, letterSpacing:1.2, color:'#6b7280', textTransform:'uppercase' }}>
                    Properties ({active.length} active{excluded.length>0?`, ${excluded.length} hidden`:''})
                  </span>
                  <button onClick={()=>setPropDrawer({pkg})} style={{ background:'#B8892A', color:'#fff', border:'none', borderRadius:4, padding:'4px 12px', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>+ Add Property</button>
                </div>

                {allProps.length===0
                  ? <div style={{ padding:16, textAlign:'center', color:'#9ca3af', fontSize:12 }}>No properties yet.</div>
                  : (
                    <table style={{ width:'100%', borderCollapse:'collapse' }}>
                      <thead><tr style={{ background:'#F0EDE6' }}>
                        {[
                          {label:'', key:null},
                          {label:'Address', key:'address'},
                          {label:'Units', key:'unit_count'},
                          {label:'Condition', key:'condition_rating'},
                          {label:'Purchase', key:'purchase_price'},
                          {label:'Rehab', key:'rehab_cost'},
                          {label:'ARV', key:'arv'},
                          {label:'Curr Rent', key:'current_rent'},
                          {label:'Mkt Rent', key:'market_rent'},
                          {label:'', key:null},
                        ].map(({label,key})=>{
                          const sc2 = sortConfig[pkg.id]||{key:'unit_count',dir:'asc'}
                          const active2 = sc2.key===key
                          return (
                            <th key={label} onClick={key?()=>setSortConfig(s=>({...s,[pkg.id]:{key,dir:s[pkg.id]?.key===key&&s[pkg.id]?.dir==='asc'?'desc':'asc'}})):undefined}
                              style={{ padding:'7px 10px', textAlign:'left', fontSize:10, fontWeight:700, color:active2?'#B8892A':'#6b7280', textTransform:'uppercase', whiteSpace:'nowrap', cursor:key?'pointer':'default', userSelect:'none' }}>
                              {label}{active2?(sc2.dir==='asc'?' ▲':' ▼'):(key?' ·':'')}
                            </th>
                          )
                        })}
                      </tr></thead>
                      <tbody>
                        {allProps.map((pr,j)=>{
                          const isExcluded = pr.excluded
                          return (
                            <tr key={pr.id} style={{ background:isExcluded?'#f9f9f9':j%2===0?'#fff':'#FAFAF8', borderTop:'0.5px solid #F0EDE6', opacity:isExcluded?0.45:1, transition:'opacity 0.2s' }}>
                              {/* Eye toggle */}
                              <td style={{ padding:'8px 6px 8px 12px', width:28 }}>
                                <button onClick={()=>toggleExclude(pr)} title={isExcluded?'Include in calculation':'Exclude from calculation'} style={{ background:'none', border:'none', cursor:'pointer', fontSize:15, color:isExcluded?'#D6D2CA':'#6b7280', padding:0, lineHeight:1 }}>
                                  {isExcluded?'👁️‍🗨️':'👁'}
                                </button>
                              </td>
                              <td onClick={()=>setPropDrawer({pkg,prop:pr})} style={{ padding:'8px 10px', fontSize:13, fontWeight:600, cursor:'pointer', textDecoration:isExcluded?'line-through':'none', color:isExcluded?'#9ca3af':'#2C2C2C' }}>{pr.address}</td>
                              <td onClick={()=>setPropDrawer({pkg,prop:pr})} style={{ padding:'8px 10px', cursor:'pointer' }}><UnitBadge n={pr.unit_count} /></td>
                              <td onClick={()=>setPropDrawer({pkg,prop:pr})} style={{ padding:'8px 10px', cursor:'pointer' }}><ConditionDisplay rating={pr.condition_rating} /></td>
                              <td onClick={()=>setPropDrawer({pkg,prop:pr})} style={{ padding:'8px 10px', fontSize:13, fontFamily:'monospace', cursor:'pointer' }}>{fmt(pr.purchase_price)}</td>
                              <td onClick={()=>setPropDrawer({pkg,prop:pr})} style={{ padding:'8px 10px', fontSize:13, fontFamily:'monospace', cursor:'pointer' }}>{fmt(pr.rehab_cost)}</td>
                              <td onClick={()=>setPropDrawer({pkg,prop:pr})} style={{ padding:'8px 10px', fontSize:13, fontFamily:'monospace', cursor:'pointer' }}>{fmt(pr.arv)}</td>
                              <td onClick={()=>setPropDrawer({pkg,prop:pr})} style={{ padding:'8px 10px', fontSize:13, fontFamily:'monospace', color:'#6b7280', cursor:'pointer' }}>{fmt(pr.current_rent)}</td>
                              <td onClick={()=>setPropDrawer({pkg,prop:pr})} style={{ padding:'8px 10px', fontSize:13, fontFamily:'monospace', color:'#3B6D11', fontWeight:600, cursor:'pointer' }}>{fmt(pr.market_rent)}</td>
                              <td style={{ padding:'8px 10px' }}></td>
                            </tr>
                          )
                        })}
                      </tbody>
                      {/* Totals footer — active only */}
                      {active.length>0 && (
                        <tfoot>
                          <tr style={{ borderTop:'2px solid #D6D2CA', background:'#F0EDE6' }}>
                            <td></td>
                            <td style={{ padding:'8px 10px', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:0.8 }}>Active ({active.length})</td>
                            <td style={{ padding:'8px 10px', fontSize:12, fontWeight:700 }}>{calcUnits} units</td>
                            <td></td>
                            <td style={{ padding:'8px 10px', fontSize:13, fontFamily:'monospace', fontWeight:700 }}>{fmtK(calcPurch)}</td>
                            <td style={{ padding:'8px 10px', fontSize:13, fontFamily:'monospace', fontWeight:700 }}>{fmtK(calcRehab)}</td>
                            <td style={{ padding:'8px 10px', fontSize:13, fontFamily:'monospace', fontWeight:700 }}>{fmtK(calcARV)}</td>
                            <td style={{ padding:'8px 10px', fontSize:13, fontFamily:'monospace', fontWeight:700, color:'#6b7280' }}>{fmtK(calcCurrRent)}/mo</td>
                            <td style={{ padding:'8px 10px', fontSize:13, fontFamily:'monospace', fontWeight:700, color:'#3B6D11' }}>{fmtK(calcMktRent)}/mo</td>
                            <td></td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  )
                }
                {pkg.notes && <div style={{ padding:'10px 16px', borderTop:'1px solid #F0EDE6', fontSize:12, color:'#6b7280', background:'#FAFAF8' }}><strong>Notes:</strong> {pkg.notes}</div>}
              </div>
            )}
          </Card>
        )
      })}

      <PackageDrawer pkg={pkgDrawer} open={!!pkgDrawer} onClose={()=>setPkgDrawer(null)} onSave={()=>{setPkgDrawer(null);load()}} />
      <PropertyDrawer data={propDrawer} open={!!propDrawer} onClose={()=>setPropDrawer(null)} onSave={()=>{setPropDrawer(null);load()}} />
    </PageWrap>
  )
}

function PackageDrawer({ pkg, open, onClose, onSave }) {
  const [form, setForm] = useState({})
  useEffect(()=>{ if(pkg) setForm({...pkg}) },[pkg])
  if (!pkg) return null
  const isNew = !form.id
  const set = k => e => setForm(f=>({...f,[k]:e.target.value}))

  async function save() {
    const payload = { deal_name:form.deal_name, status:form.status, total_arv:form.total_arv||null, total_purchase:form.total_purchase||null, total_rehab:form.total_rehab||null, notes:form.notes||null, entity:'NHC' }
    if (isNew) await supabase.from('package_deals').insert(payload)
    else await supabase.from('package_deals').update(payload).eq('id',form.id)
    onSave()
  }
  async function del() {
    if (!confirm('Delete this package and all its properties?')) return
    await supabase.from('package_deals').delete().eq('id',form.id)
    onSave()
  }

  return (
    <Drawer open={open} onClose={onClose} title={form.deal_name||'New Package'} subtitle={form.status}>
      <div style={{ display:'flex', flexDirection:'column', gap:14, paddingTop:12 }}>
        <Field label="Package Name / Seller"><input style={inp} value={form.deal_name||''} onChange={set('deal_name')} placeholder="Smith Portfolio — 6 Properties" /></Field>
        <Field label="Status">
          <select style={inp} value={form.status||'analyzing'} onChange={set('status')}>
            <option value="analyzing">Analyzing</option>
            <option value="active">Active / Under Contract</option>
            <option value="closed">Closed</option>
            <option value="passed">Passed</option>
          </select>
        </Field>
        <div className="drawer-section">Override Totals (optional — auto from properties)</div>
        <FieldRow>
          <Field label="Total ARV ($)"><input style={monoInp} type="number" value={form.total_arv||''} onChange={set('total_arv')} placeholder="Auto" /></Field>
          <Field label="Total Purchase ($)"><input style={monoInp} type="number" value={form.total_purchase||''} onChange={set('total_purchase')} placeholder="Auto" /></Field>
        </FieldRow>
        <Field label="Total Rehab ($)"><input style={monoInp} type="number" value={form.total_rehab||''} onChange={set('total_rehab')} placeholder="Auto" /></Field>
        <Field label="Notes"><textarea style={{ ...inp, minHeight:80, resize:'vertical' }} value={form.notes||''} onChange={set('notes')} placeholder="Seller situation, motivation, asking price, strategy..." /></Field>
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:8 }}>
          {!isNew && <Btn variant="danger" onClick={del}>Delete Package</Btn>}
          <div style={{ display:'flex', gap:8, marginLeft:'auto' }}>
            <Btn variant="outline" onClick={onClose}>Cancel</Btn>
            <Btn onClick={save} disabled={!form.deal_name}>Save</Btn>
          </div>
        </div>
      </div>
    </Drawer>
  )
}

function PropertyDrawer({ data, open, onClose, onSave }) {
  const [form, setForm] = useState({...EMPTY_PROP})
  useEffect(()=>{ if(data) setForm(data.prop ? {...data.prop} : {...EMPTY_PROP}) },[data])
  if (!data) return null
  const isNew = !form.id
  const set = k => e => setForm(f=>({...f,[k]:e.target.value}))

  const upside = (parseFloat(form.market_rent)||0) - (parseFloat(form.current_rent)||0)
  const yield_ = form.market_rent&&form.purchase_price ? ((parseFloat(form.market_rent)*12)/parseFloat(form.purchase_price)*100).toFixed(1) : null
  const margin = (parseFloat(form.arv)||0)-(parseFloat(form.purchase_price)||0)-(parseFloat(form.rehab_cost)||0)

  async function save() {
    if (!form.address) return
    const payload = { package_id:data.pkg.id, address:form.address, arv:form.arv||null, purchase_price:form.purchase_price||null, rehab_cost:form.rehab_cost||null, unit_count:form.unit_count||1, monthly_rent:form.market_rent||null, current_rent:form.current_rent||null, market_rent:form.market_rent||null, condition_rating:form.condition_rating||null, property_type:form.property_type||'hold', notes:form.notes||null, excluded:form.excluded||false }
    if (isNew) await supabase.from('package_deal_properties').insert(payload)
    else await supabase.from('package_deal_properties').update(payload).eq('id',form.id)
    onSave()
  }
  async function del() {
    if (!confirm('Remove this property?')) return
    await supabase.from('package_deal_properties').delete().eq('id',form.id)
    onSave()
  }

  return (
    <Drawer open={open} onClose={onClose} title={form.address||'New Property'} subtitle={isNew?`Adding to: ${data.pkg.deal_name}`:data.pkg.deal_name} width={540}>
      <div style={{ display:'flex', flexDirection:'column', gap:14, paddingTop:12 }}>
        <Field label="Address"><input style={inp} value={form.address||''} onChange={set('address')} placeholder="789 Elm St, Lexington KY" /></Field>

        <Field label="Number of Units">
          <UnitPicker value={parseInt(form.unit_count)||1} onChange={v=>setForm(f=>({...f,unit_count:v}))} />
        </Field>

        <Field label="Condition Rating">
          <ConditionStars rating={form.condition_rating} onChange={v=>setForm(f=>({...f,condition_rating:v}))} />
          <div style={{ fontSize:11, color:'#9ca3af', marginTop:4 }}>1 = Poor · 3 = Average · 5 = Excellent · Click again to clear</div>
        </Field>

        <div className="drawer-section">Financials</div>
        <FieldRow>
          <Field label="Purchase Price ($)"><input style={monoInp} type="number" value={form.purchase_price||''} onChange={set('purchase_price')} placeholder="110000" /></Field>
          <Field label="Rehab Estimate ($)"><input style={monoInp} type="number" value={form.rehab_cost||''} onChange={set('rehab_cost')} placeholder="0" /></Field>
        </FieldRow>
        <Field label="ARV ($)"><input style={monoInp} type="number" value={form.arv||''} onChange={set('arv')} placeholder="145000" /></Field>

        <div className="drawer-section">Rent</div>
        <FieldRow>
          <Field label="Current Rent ($)"><input style={monoInp} type="number" value={form.current_rent||''} onChange={set('current_rent')} placeholder="900" /></Field>
          <Field label="Market Rent ($)"><input style={monoInp} type="number" value={form.market_rent||''} onChange={set('market_rent')} placeholder="1100" /></Field>
        </FieldRow>

        {/* Live metrics */}
        {(form.purchase_price || form.current_rent || form.market_rent) && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
            {yield_ && (
              <div style={{ background:'#f0fdf4', borderRadius:6, padding:'8px 10px' }}>
                <div style={{ fontSize:10, color:'#6b7280', textTransform:'uppercase', letterSpacing:0.8 }}>Gross Yield</div>
                <div style={{ fontSize:16, fontWeight:700, fontFamily:'monospace', color:'#3B6D11' }}>{yield_}%</div>
              </div>
            )}
            {upside !== 0 && form.current_rent && form.market_rent && (
              <div style={{ background:upside>0?'#f0fdf4':'#fef2f2', borderRadius:6, padding:'8px 10px' }}>
                <div style={{ fontSize:10, color:'#6b7280', textTransform:'uppercase', letterSpacing:0.8 }}>Rent Upside</div>
                <div style={{ fontSize:16, fontWeight:700, fontFamily:'monospace', color:upside>0?'#3B6D11':'#B91C1C' }}>{upside>0?'+':''}{fmt(upside)}</div>
              </div>
            )}
            {form.purchase_price && (
              <div style={{ background:margin>=0?'#f0fdf4':'#fef2f2', borderRadius:6, padding:'8px 10px' }}>
                <div style={{ fontSize:10, color:'#6b7280', textTransform:'uppercase', letterSpacing:0.8 }}>Flip Margin</div>
                <div style={{ fontSize:16, fontWeight:700, fontFamily:'monospace', color:margin>=0?'#3B6D11':'#B91C1C' }}>{margin>=0?'+':''}{fmt(margin)}</div>
              </div>
            )}
          </div>
        )}

        <Field label="Notes"><input style={inp} value={form.notes||''} onChange={set('notes')} placeholder="Condition notes, tenant status, any issues..." /></Field>

        {!isNew && (
          <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, cursor:'pointer' }}>
            <input type="checkbox" checked={!!form.excluded} onChange={e=>setForm(f=>({...f,excluded:e.target.checked}))} />
            <span>Exclude from package calculation</span>
          </label>
        )}

        <div style={{ display:'flex', justifyContent:'space-between', marginTop:8 }}>
          {!isNew && <Btn variant="danger" onClick={del}>Remove</Btn>}
          <div style={{ display:'flex', gap:8, marginLeft:'auto' }}>
            <Btn variant="outline" onClick={onClose}>Cancel</Btn>
            <Btn onClick={save} disabled={!form.address}>Save</Btn>
          </div>
        </div>
      </div>
    </Drawer>
  )
}
