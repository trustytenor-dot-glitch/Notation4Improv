import React from 'react'

type Props = {
  width: number
  measureCount: number
  beatsPerMeasure: number
  chords: string[][]
  onSlotClick?: (m: number, b: number, clientX: number, clientY: number) => void
}

export default function ChordTrack({ width, measureCount, beatsPerMeasure, chords, onSlotClick }: Props) {
  // Must match StaffCanvas layout
  const startX = 10
  const startY = 40
  const chordBandHeight = 30
  
  // StaffCanvas uses: const staveWidth = (width - 20) / measureCount
  const measureWidth = (width - 20) / measureCount

  return (
    <div style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', width, height: startY + chordBandHeight + 20 }}>
      <div style={{ position: 'relative', left: startX, top: startY, height: chordBandHeight }}>
        {Array.from({ length: measureCount }).map((_, m) => (
          <div
            key={m}
            style={{
              position: 'absolute',
              left: m * measureWidth,
              top: 0,
              width: measureWidth,
              height: chordBandHeight,
              pointerEvents: 'none'
            }}
          >
            {Array.from({ length: beatsPerMeasure }).map((__, b) => {
              const slotWidth = measureWidth / beatsPerMeasure
              const value = chords[m] && chords[m][b]
              return (
                <div
                  key={b}
                  onClick={(e) => {
                      e.stopPropagation();
                      onSlotClick && onSlotClick(m, b, (e.nativeEvent as MouseEvent).clientX, (e.nativeEvent as MouseEvent).clientY)
                  }}
                  style={{
                    position: 'absolute',
                    left: b * slotWidth + 2, // Slight padding
                    top: 2,
                    width: slotWidth - 4,
                    height: chordBandHeight - 4,
                    borderRadius: 4,
                    pointerEvents: 'auto',
                    background: value ? '#ffd54f' : 'rgba(255,255,255,0.01)', // Semi-transparent target area
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    color: '#3e2723',
                    cursor: 'pointer',
                    border: value ? '1px solid #ffca28' : '1px dashed rgba(0,0,0,0.1)'
                  }}
                  title={value ? `Change Chord (${value})` : 'Add Chord'}
                >
                  {value || '+'}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
