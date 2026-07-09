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
export default function KanbanBoard({ columns, items, columnFor, onOpen, onDrop, renderCard }) {
  const [dragOverCol, setDragOverCol] = useState(null)

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
                  onDragStart={col.locked ? undefined : e => e.dataTransfer.setData('text/plain', p.id)}
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
    </div>
  )
}
