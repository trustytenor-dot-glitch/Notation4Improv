import React, { useEffect, useState } from 'react'

export type InstrumentOption = {
  program: number
  label: string
}

type Props = {
  x: number
  y: number
  value: number
  options: InstrumentOption[]
  title: string
  onSelect: (program: number) => void
  onCancel: () => void
}

export default function InstrumentDropdown({ x, y, value, options, title, onSelect, onCancel }: Props) {
  const [selected, setSelected] = useState<number>(value)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter') onSelect(selected)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, onSelect, onCancel])

  return (
    <div style={{ position: 'fixed', left: x + 6, top: y + 6, zIndex: 2100 }}>
      <div style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 8, padding: 8, boxShadow: '0 6px 18px rgba(0,0,0,0.15)', minWidth: 220 }}>
        <div style={{ marginBottom: 6, fontSize: 12, fontWeight: 600, color: '#555' }}>{title}</div>
        <div style={{ maxHeight: 260, overflowY: 'auto', marginBottom: 8 }}>
          {options.map(opt => (
            <label key={opt.program} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', fontSize: 12, cursor: 'pointer' }}>
              <input
                type="radio"
                name="instrument"
                value={opt.program}
                checked={selected === opt.program}
                onChange={() => setSelected(opt.program)}
              />
              <span>{opt.program.toString().padStart(3, '0')} - {opt.label}</span>
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
          <button onClick={() => onSelect(selected)} style={{ padding: '4px 10px', fontSize: 12 }}>OK</button>
          <button onClick={onCancel} style={{ padding: '4px 10px', fontSize: 12 }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
