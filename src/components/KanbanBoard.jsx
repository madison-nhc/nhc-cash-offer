import { useState } from 'react'

// ── Shared drag-and-drop kanban board ─────────────────────────────────────────
// Extracted from the Analyzer board so every pipeline page can reuse it.
//
// Props:
//   columns:    [{ key, color, locked?, exit?, label?, hint? }]
//               locked: display-only — cards inside can't be dragged out and
//                 nothing can be dropped in.
//               exit: a drop zone, not a bucket — deals dropped here leave this
//                 page (rendered dashed/ghosted with an action-style label).
//               label: display name if different from key (key is what onDrop
//                 receives, e.g. the stage value).
//               hint: small text under an exit column's header.
//   items:      array of records to distribute across columns
//   columnFor:  (item) => column key string
//   onOpen:     (item) => void — card click
//   onDrop:     async (itemId, columnKey) => void — persistence is the caller's
//               job (build the payload, write it, surface errors, reload)
//   renderCard: (item) => JSX — inner card content; the draggable shell,
//               border, and click handling live here
// Optional promotion tray:
//   promoZones: [{ key, label, emoji, color }] — while a card is being dragged,
//     a tray of these targets slides up from the bottom of the screen.
//   onPromote: async (itemId, zoneKey, {x,y}) => void — called on drop; x/y are
//     the drop coordinates (for celebration effects).
export default function KanbanBoard({ columns, items, columnFor, onOpen, onDrop, renderCard, promoZones, onPromote }) {
  const [dragOverCol, setDragOverCol] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [overZone, setOverZone] = useState(null)

  async function handleDrop(e, columnKey) {
    e.preventDefault()
    setDragOverCol(null)
    if (columns.find(c => c.key === columnKey)?.locked) return
    const id = e.dataTransfer.getData('text/plain')
    if (!id) return
    await onDrop(id, columnKey)
  }

  return (
    <div style={{ display:'flex', gap:12, overflowX:'auto', paddingBottom:8, alignItems:'flex-start' }}>
      {columns.map(col => {
        const colItems = items.filter(p => columnFor(p) === col.key)
        return (
          <div
            key={col.key}
            onDragOver={col.locked ? undefined : e => { e.preventDefault(); setDragOverCol(col.key) }}
            onDragLeave={col.locked ? undefined : () => setDragOverCol(null)}
            onDrop={col.locked ? undefined : e => handleDrop(e, col.key)}
            style={{
              flex:'0 0 260px', minWidth:260,
              background: dragOverCol===col.key ? '#fef9f0' : col.exit ? '#FAFAF8' : '#F0EDE6',
              border: col.exit ? '1.5px dashed #D6D2CA' : 'none',
              borderRadius:8, padding:10, transition:'background 0.1s',
            }}
          >
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: col.hint ? 2 : 8, padding:'0 2px', borderTop:`3px solid ${col.color}`, paddingTop:8 }}>
              <span style={{ fontSize:12, fontWeight:700, color: col.exit ? '#6b7280' : '#2C2C2C' }}>{col.label || col.key}</span>
              {!col.exit && <span style={{ fontSize:11, color:'#9ca3af', fontWeight:600 }}>{colItems.length}</span>}
            </div>
            {col.hint && <div style={{ fontSize:10, color:'#9ca3af', marginBottom:8, padding:'0 2px' }}>{col.hint}</div>}
            <div style={{ minHeight:40 }}>
              {colItems.map(p => (
                <div
                  key={p.id}
                  draggable={!col.locked}
                  onDragStart={col.locked ? undefined : e => { e.dataTransfer.setData('text/plain', p.id); setDragging(true) }}
                  onDragEnd={() => { setDragging(false); setOverZone(null) }}
                  onClick={() => onOpen(p)}
                  style={{
                    background:'#fff', border:'0.5px solid #D6D2CA', borderRadius:8, padding:'10px 12px',
                    marginBottom:8, cursor: col.locked ? 'pointer' : 'grab',
                  }}
                >
                  {renderCard(p)}
                </div>
              ))}
              {colItems.length===0 && (
                <div style={{ fontSize:11, color:'#9ca3af', textAlign:'center', padding:'12px 0' }}>
                  {col.exit ? 'Drop here' : 'No deals'}
                </div>
              )}
            </div>
          </div>
        )
      })}

      {promoZones && dragging && (
        <div style={{
          position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)',
          display:'flex', gap:12, zIndex:200, background:'#fff', padding:14,
          borderRadius:14, border:'0.5px solid #D6D2CA', boxShadow:'0 8px 32px rgba(0,0,0,0.18)',
        }}>
          {promoZones.map(z => (
            <div
              key={z.key}
              onDragOver={e => { e.preventDefault(); setOverZone(z.key) }}
              onDragLeave={() => setOverZone(null)}
              onDrop={async e => {
                e.preventDefault()
                setDragging(false); setOverZone(null)
                const id = e.dataTransfer.getData('text/plain')
                if (id) await onPromote(id, z.key, { x:e.clientX, y:e.clientY })
              }}
              style={{
                width:120, padding:'14px 8px', textAlign:'center', borderRadius:10, cursor:'copy',
                border:`2px dashed ${z.color}`, transition:'all 0.12s',
                background: overZone===z.key ? z.color : 'transparent',
                transform: overZone===z.key ? 'scale(1.06)' : 'scale(1)',
              }}
            >
              <div style={{ fontSize:22, marginBottom:4 }}>{z.emoji}</div>
              <div style={{ fontSize:11, fontWeight:700, letterSpacing:0.3, color: overZone===z.key ? '#fff' : z.color }}>{z.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
