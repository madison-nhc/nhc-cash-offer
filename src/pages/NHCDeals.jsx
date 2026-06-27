import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { PageWrap, SectionBar, Card, EmptyState, LoadingSpinner, StatCard, fmt, fmtK } from '../components/ui.jsx'
import PropertyDrawer from '../components/PropertyDrawer.jsx'

const DISP_COLORS = { listing:'#3B6D11', wholesale:'#6b21a8', flip:'#D97825' }
const DISP_LABELS = { listing:'Listing', wholesale:'Wholesale', flip:'Flip' }

export default function NHCDeals() {
  const mobile = useIsMobile()
  const [properties, setProperties] = useState([])
  const [mailings, setMailings] = useState([])
  const [loading, setLoading] = useState(true)
  const [drawer, setDrawer] = useState(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data:p }, { data:m }] = await Promise.all([
      supabase.from('properties').select('*').in('disposition',['listing','wholesale','flip']).order('updated_at',{ascending:false}),
      supabase.from('mailings').select('id,campaign_name,drop_date').order('drop_date',{ascending:false}),
    ])
    setProperties(p||[])
    setMailings(m||[])
    setLoading(false)
  }

  const filtered = filter==='all' ? properties : properties.filter(p=>p.disposition===filter)
  const totalComm = properties.reduce((s,p)=>s+(parseFloat(p.commission_earned)||0),0)
  const listings  = properties.filter(p=>p.disposition==='listing')
  const wholesale = properties.filter(p=>p.disposition==='wholesale')
  const flips     = properties.filter(p=>p.disposition==='flip')
  const closedComm = properties.filter(p=>p.disposition_date||p.sale_price)

  if (loading) return <LoadingSpinner />

  return (
    <PageWrap pad={!mobile}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, color:'#2C2C2C' }}>NHC Deals</h1>
          <p style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>New Home Collective · commission tracking</p>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns: mobile?'repeat(2,1fr)':'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        <StatCard label="Total Deals" value={properties.length} topColor="#B8892A" />
        <StatCard label="Listings" value={listings.length} topColor="#3B6D11" />
        <StatCard label="Wholesale" value={wholesale.length} topColor="#6b21a8" />
        <StatCard label="NHC Commission" value={fmtK(totalComm)} sub="all time" topColor="#3B6D11" />
      </div>

      <div style={{ display:'flex', gap:4, marginBottom:14, flexWrap:'wrap' }}>
        {[['all',`All (${properties.length})`],['listing',`Listings (${listings.length})`],['wholesale',`Wholesale (${wholesale.length})`],['flip',`Flips (${flips.length})`]].map(([f,l])=>(
          <button key={f} onClick={()=>setFilter(f)} style={{ padding:'5px 14px', border:'none', borderRadius:4, cursor:'pointer', background:filter===f?'#2C2C2C':'#F0EDE6', color:filter===f?'#fff':'#6b7280', fontSize:11, fontWeight:filter===f?700:400, fontFamily:'inherit' }}>{l}</button>
        ))}
      </div>

      <SectionBar>Deals ({filtered.length})</SectionBar>

      {filtered.length===0 ? (
        <EmptyState icon="○" text="No NHC deals yet. Add a property in the Analyzer and set the disposition to Listing, Wholesale, or Flip." />
      ) : (
        <Card style={{ padding:0 }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead><tr style={{ background:'#F0EDE6' }}>
              {['Address','Type','Sale Price','Commission','Source Campaign','Close Date'].map(h=>(
                <th key={h} style={{ padding:'8px 14px', textAlign:'left', fontSize:11, fontWeight:600, letterSpacing:0.8, color:'#6b7280', textTransform:'uppercase', whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map((p,i)=>{
                const src = mailings.find(m=>m.id===p.mailing_id)
                const c = DISP_COLORS[p.disposition]||'#B8892A'
                return (
                  <tr key={p.id} onClick={()=>setDrawer(p)} style={{ background:i%2===0?'#fff':'#FAFAF8', borderTop:'0.5px solid #F0EDE6', cursor:'pointer' }}
                    onMouseEnter={e=>e.currentTarget.style.background='#fef9f0'}
                    onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'#fff':'#FAFAF8'}>
                    <td style={{ padding:'10px 14px', fontSize:13, fontWeight:600 }}>{p.address}</td>
                    <td style={{ padding:'10px 14px' }}>
                      <span style={{ background:c+'20', color:c, border:`1px solid ${c}40`, borderRadius:4, padding:'2px 7px', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:0.8, whiteSpace:'nowrap' }}>
                        {DISP_LABELS[p.disposition]||p.disposition}
                      </span>
                    </td>
                    <td style={{ padding:'10px 14px', fontSize:13, fontFamily:'monospace' }}>{fmt(p.sale_price)}</td>
                    <td style={{ padding:'10px 14px', fontSize:13, fontFamily:'monospace', fontWeight:700, color:'#3B6D11' }}>{fmt(p.commission_earned)}</td>
                    <td style={{ padding:'10px 14px', fontSize:12, color:'#2D6FAF' }}>{src?.campaign_name?.replace(/^Campaign \d+ — /,'')||'—'}</td>
                    <td style={{ padding:'10px 14px', fontSize:12, color:'#6b7280' }}>{p.disposition_date?new Date(p.disposition_date+'T12:00:00').toLocaleDateString():p.sale_date?new Date(p.sale_date+'T12:00:00').toLocaleDateString():'—'}</td>
                  </tr>
                )
              })}
            </tbody>
            {properties.length>0 && (
              <tfoot><tr style={{ borderTop:'2px solid #D6D2CA', background:'#F0EDE6' }}>
                <td colSpan={3} style={{ padding:'8px 14px', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:0.8 }}>Total Commission</td>
                <td style={{ padding:'8px 14px', fontSize:14, fontFamily:'monospace', fontWeight:700, color:'#3B6D11' }}>{fmtK(totalComm)}</td>
                <td colSpan={2}></td>
              </tr></tfoot>
            )}
          </table>
        </Card>
      )}

      <PropertyDrawer property={drawer} open={!!drawer} onClose={()=>setDrawer(null)} onSave={()=>{ load() }} mailings={mailings} />
    </PageWrap>
  )
}
