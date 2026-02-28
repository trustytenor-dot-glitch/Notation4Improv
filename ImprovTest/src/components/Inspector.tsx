import React, { useState } from 'react'
import useStore from '../state/store'
import { alignMelodyToChord } from '../lib/align'
import { RHYTHM_LABELS, generateRhythm, RhythmPattern } from '../lib/rhythms'

export default function Inspector() {
  const selectedDuration = useStore(s => s.selectedNoteDuration)
  const setDuration = useStore(s => s.setSelectedNoteDuration)
  const measureCount = useStore(s => s.measureCount)
  const showRhythm = useStore(s => s.showRhythmTrack)
  const toggleRhythm = useStore(s => s.toggleRhythmTrack)
  const setRhythmTrack = useStore(s => s.setRhythmTrack)
  const beatsPerMeasure = useStore(s => s.beatsPerMeasure)
  const subdivs = useStore(s => s.subdivisionsPerBeat) || 4
  const transposeSelection = useStore(s => s.transposeSelection)
  const selectedNote = useStore(s => s.selectedNote)
  
  const [density, setDensity] = useState('quarter')
  const [targetMeasure, setTargetMeasure] = useState<string>('all')
  const [targetTrack, setTargetTrack] = useState<string>('all')
  const [selectedPattern, setSelectedPattern] = useState<RhythmPattern>('rock')

  const applyRhythm = () => {
    const track = generateRhythm(selectedPattern, measureCount, beatsPerMeasure, subdivs)
    setRhythmTrack(track)
  }

  const randomizeAll = () => import('../lib/randomize').then(m => {
      const tm = targetMeasure === 'all' ? 'all' : Number(targetMeasure)
      m.randomizeAll(density as any, tm, targetTrack as any)
  })

  const alignMelody = () => {
      const state = useStore.getState();
      const { melody, chords, beatsPerMeasure, subdivisionsPerBeat } = state;
      if (!melody || !chords) return;

      const tm = targetMeasure === 'all' ? 'all' : Number(targetMeasure);
      const newMelody = alignMelodyToChord(
          melody, 
          chords, 
          beatsPerMeasure, 
          subdivisionsPerBeat || 4, 
          tm
      );
      state.setMelody(newMelody);
  }

  // This would eventually be wired to the store if we had state for 'selectedNoteDuration'
  const durations = [
      { label: 'Whole', value: '1n' },
      { label: 'Half', value: '2n' },
      { label: 'Quarter', value: '4n' },
      { label: 'Eighth', value: '8n' },
      { label: '16th', value: '16n' },
  ]

  return (
    <div style={{ 
      marginTop: 12, 
      display: 'flex', 
      gap: 16, 
      alignItems: 'center', 
      padding: '12px', 
      background: '#f8f9fa', 
      borderRadius: 8,
      border: '1px solid #eee'
    }}>
      {/* Measure Selection REMOVED */}

      {/* Note Palette Placeholder */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#666' }}>Note Palette</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {durations.map(d => {
            const isSelected = selectedDuration === d.value
            return (
            <button 
                key={d.value} 
                onClick={() => setDuration(d.value)}
                style={{
                    padding: '6px 10px', 
                    borderRadius: 4, 
                    border: isSelected ? '1px solid #0056b3' : '1px solid #ddd',
                    background: isSelected ? '#e7f5ff' : '#fff',
                    color: isSelected ? '#0056b3' : '#333',
                    fontSize: 12,
                    cursor: 'pointer',
                    fontWeight: isSelected ? 600 : 400
                }}
            >
                {d.label}
            </button>
          )})}
        </div>
      </div>

      <div style={{ width: 1, background: '#ddd', alignSelf: 'stretch' }} />

      {/* Edit Operations */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#666' }}>Edit</div>
        <div style={{ display: 'flex', gap: 4 }}>
           <button 
             onClick={() => transposeSelection(-1)}
             disabled={!selectedNote}
             title="Lower Semitone (-)"
             style={{
               width: 28, height: 28, borderRadius: 4, 
               border: '1px solid #ddd', background: selectedNote ? '#fff' : '#f5f5f5', color: selectedNote ? '#333' : '#aaa',
               cursor: selectedNote ? 'pointer' : 'default',
               fontSize: 14, fontWeight: 'bold'
             }}
           >-</button>
           <button 
             onClick={() => transposeSelection(1)}
             disabled={!selectedNote}
             title="Raise Semitone (=)"
             style={{
               width: 28, height: 28, borderRadius: 4, 
               border: '1px solid #ddd', background: selectedNote ? '#fff' : '#f5f5f5', color: selectedNote ? '#333' : '#aaa',
               cursor: selectedNote ? 'pointer' : 'default',
               fontSize: 14, fontWeight: 'bold'
             }}
           >+</button>
        </div>
      </div>

      <div style={{ width: 1, background: '#ddd', alignSelf: 'stretch' }} />
      
      {/* Randomize Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#666' }}>Randomize</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
             <select 
                value={targetTrack} 
                onChange={e => setTargetTrack(e.target.value)} 
                style={{fontSize: 12, height: 28, borderRadius: 4, border: '1px solid #ddd', minWidth: 80}}
             >
                <option value="all">All Tracks</option>
                <option value="chords">Chords Only</option>
                <option value="melody">Melody Only</option>
                <option value="bass">Bass Only</option>
             </select>

             <select 
                value={targetMeasure} 
                onChange={e => setTargetMeasure(e.target.value)} 
                style={{fontSize: 12, height: 28, borderRadius: 4, border: '1px solid #ddd', minWidth: 80}}
             >
                <option value="all">All Measures</option>
                {Array.from({length: measureCount}).map((_, i) => (
                    <option key={i} value={i}>Meas {i + 1}</option>
                ))}
             </select>

             <select 
                value={density} 
                onChange={e => setDensity(e.target.value)} 
                style={{fontSize: 12, height: 28, borderRadius: 4, border: '1px solid #ddd'}}
             >
              <option value="quarter">1/4 Only</option>
              <option value="eighth-low">Some 1/8</option>
              <option value="eighth-high">More 1/8</option>
              <option value="eighth-only">1/8 Only</option>
              <option value="mixed">Mixed</option>
              <option value="16th-random">Chaos</option>
            </select>
            <button 
              onClick={randomizeAll} 
              style={{
                height: 28, 
                padding: '0 12px',
                background: '#fd7e14',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600
               }}
            >
              Go
            </button>
            <button 
              onClick={alignMelody}
              title="Align melody notes to chord tones" 
              style={{
                height: 28, 
                padding: '0 12px',
                background: '#20c997',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600
               }}
            >
              Align
            </button>
        </div>
      </div>

      <div style={{ width: 1, background: '#ddd', alignSelf: 'stretch' }} />

      {/* Accompaniment */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#666' }}>Accompaniment</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', height: 28 }}>
            <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', userSelect: 'none' }}>
                <input type="checkbox" checked={showRhythm} onChange={toggleRhythm} />
                Show
            </label>
            <select 
               value={selectedPattern} 
               onChange={e => setSelectedPattern(e.target.value as any)}
               style={{fontSize: 12, height: 28, borderRadius: 4, border: '1px solid #ddd'}}
            >
               {Object.entries(RHYTHM_LABELS).map(([k, v]) => (
                   <option key={k} value={k}>{v}</option>
               ))}
            </select>
            <button 
                onClick={applyRhythm}
                style={{
                    height: 28, 
                    padding: '0 12px',
                    background: '#6610f2',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600
                }}
            >
                Apply
            </button>
        </div>
      </div>
      
      {/* Visualizer Help / Info */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
          <div style={{ fontSize: 12, color: '#888' }}>
              Selected: <strong>{durations.find(d => d.value === selectedDuration)?.label}</strong>
          </div>
      </div>
    </div>
  )
}
