import React, { useEffect, useState } from 'react'
import { CHORD_ROWS } from '../lib/constants'

type Props = {
  x: number
  y: number
  value: string
  onConfirm: (value: string) => void
  onCancel: () => void
  keySignature?: string
}

const DIATONIC_C_MAJOR = ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim']
const ROMAN = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']

export default function ChordDropdown({ x, y, value, onConfirm, onCancel, keySignature = 'C' }: Props) {
  const [text, setText] = useState(value || '')
  const [showRoman, setShowRoman] = useState(false)
  const [showAll, setShowAll] = useState(true)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter') onConfirm(text)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [text, onConfirm, onCancel])

  const suggestions = showRoman ? ROMAN : DIATONIC_C_MAJOR

  const DiatonicSection = () => (
    <>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <input type="checkbox" checked={showRoman} onChange={e => setShowRoman(e.target.checked)} /> Roman
      </label>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {suggestions.map(s => (
          <button key={s} onClick={() => { setText(s); onConfirm(s) }} style={{ padding: '6px 8px', borderRadius: 6, background: '#f5f5f5', border: '1px solid #eee' }}>{s}</button>
        ))}
      </div>
    </>
  )

  const AllChordsSection = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10 }}>
       <div style={{fontSize: 10, color: '#999', fontWeight: 600}}>MINOR</div>
       <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {CHORD_ROWS.top.map(c => (
             <button key={c} onClick={() => { setText(c); onConfirm(c) }} style={{ padding: '4px 0', width: 34, fontSize: 11, borderRadius: 4, background: '#eef2ff', border: '1px solid #dde', textAlign: 'center' }}>{c}</button>
          ))}
       </div>
       <div style={{fontSize: 10, color: '#999', fontWeight: 600, marginTop: 4}}>MAJOR</div>
       <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {CHORD_ROWS.bottom.map(c => (
             <button key={c} onClick={() => { setText(c); onConfirm(c) }} style={{ padding: '4px 0', width: 34, fontSize: 11, borderRadius: 4, background: '#fff9db', border: '1px solid #eee', textAlign: 'center' }}>{c}</button>
          ))}
       </div>
    </div>
  )

  // Calculate position logic to prevent overflow
  // Default is left: x + 6. If x is large, we should shift left.
  const maxWidth = 400
  const screenWidth = window.innerWidth
  
  let leftPos = x + 6
  let topPos = y + 6
  
  // If dropdown goes off right screen edge
  if (leftPos + maxWidth > screenWidth) {
      leftPos = x - maxWidth - 6
      if (leftPos < 10) leftPos = 10 // Safety clamping
  }

  // If dropdown goes off bottom screen edge (approx height 300)
  const estHeight = 300
  if (topPos + estHeight > window.innerHeight) {
      topPos = y - estHeight - 6
      if (topPos < 10) topPos = 10
  }

  return (
    <div style={{ position: 'fixed', left: leftPos, top: topPos, zIndex: 2000 }}>
      <div style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 8, padding: 12, boxShadow: '0 6px 18px rgba(0,0,0,0.12)', width: 360 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input autoFocus value={text} onChange={e => setText(e.target.value)} style={{ padding: '6px 8px', width: 80 }} placeholder="Chord..." />
          <button onClick={() => onConfirm(text)} style={{ padding: '6px 8px' }}>OK</button>
          <button onClick={onCancel} style={{ padding: '6px 8px' }}>Cancel</button>
        </div>
        
        {/* Toggle Mode */}
        <div style={{display:'flex', gap: 12, borderBottom: '1px solid #eee', paddingBottom: 6, marginBottom: 6}}>
             <label style={{display:'flex', gap: 4, fontSize: 12, cursor: 'pointer'}}>
                 <input type="radio" checked={showAll} onChange={() => setShowAll(true)} /> All Chords
             </label>
             <label style={{display:'flex', gap: 4, fontSize: 12, cursor: 'pointer'}}>
                 <input type="radio" checked={!showAll} onChange={() => setShowAll(false)} /> Diatonic
             </label>
        </div>

        {showAll ? <AllChordsSection /> : <DiatonicSection />}
      </div>
    </div>
  )
}
