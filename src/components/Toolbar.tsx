import React, { useState } from 'react'
import useStore from '../state/store'
import SaveLoadModal from './SaveLoadModal'

export default function Toolbar({ onPrint }: { onPrint?: () => void }) {
  const [modalMode, setModalMode] = useState<'save' | 'load' | null>(null)
  const bpm = useStore(s => s.bpm)
  const key = useStore(s => s.key)
  const timeSig = useStore(s => s.timeSig)
  const measureCount = useStore(s => s.measureCount)
  const beatsPerMeasure = useStore(s => s.beatsPerMeasure)
  const subdivisionsPerBeat = useStore(s => s.subdivisionsPerBeat)
  const setBPM = useStore(s => s.setBPM)
  const setKey = useStore(s => s.setKey)
  const setTimeSig = useStore(s => s.setTimeSig)
  const setMeasureCount = useStore(s => s.setMeasureCount)
  const setBeatsPerMeasure = useStore(s => s.setBeatsPerMeasure)
  const setSubdivisionsPerBeat = useStore(s => s.setSubdivisionsPerBeat)
  const measuresPerSystem = useStore(s => s.measuresPerSystem)
  const setMeasuresPerSystem = useStore(s => s.setMeasuresPerSystem)
  const reset = useStore(s => s.reset)
  // const revert = useStore(s => s.revert) // Use load modal instead
  const undo = useStore(s => s.undo)
  const redo = useStore(s => s.redo)
  const play = () => import('../lib/audio').then(m => m.startPlayback())
  const stop = () => import('../lib/audio').then(m => m.stopPlayback())

  return (
    <>
    {modalMode && <SaveLoadModal mode={modalMode} onClose={() => setModalMode(null)} />}
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
      <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        Key:
        <select value={key} onChange={e => setKey(e.target.value)}>
          <option value="Db">Db (5 flats)</option>
          <option value="Ab">Ab (4 flats)</option>
          <option value="Eb">Eb (3 flats)</option>
          <option value="Bb">Bb (2 flats)</option>
          <option value="F">F (1 flat)</option>
          <option value="C">C</option>
          <option value="G">G (1 sharp)</option>
          <option value="D">D (2 sharps)</option>
          <option value="A">A (3 sharps)</option>
          <option value="E">E (4 sharps)</option>
          <option value="B">B (5 sharps)</option>
        </select>
      </label>

      <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        Time:
        <select value={timeSig} onChange={e => setTimeSig(e.target.value)}>
          <option value="4/4">4/4</option>
          <option value="3/4">3/4</option>
          <option value="6/8">6/8</option>
        </select>
      </label>

      <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        BPM:
        <input type="number" value={bpm} onChange={e => setBPM(Number(e.target.value)||60)} style={{width:72}} />
      </label>

      <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        Measures:
        <input type="number" min={1} max={32} value={measureCount} onChange={e => setMeasureCount(Number(e.target.value)||1)} style={{width:64}} />
      </label>

      <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        Beats/Measure:
        <input type="number" min={1} max={12} value={beatsPerMeasure} onChange={e => setBeatsPerMeasure(Number(e.target.value)||4)} style={{width:64}} />
      </label>

      <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        Subdivision:
        <select value={subdivisionsPerBeat} onChange={e => setSubdivisionsPerBeat(Number(e.target.value)||4)}>
          <option value={1}>Quarter</option>
          <option value={2}>Eighth</option>
          <option value={4}>Sixteenth</option>
        </select>
      </label>

      <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        Per Line:
        <select value={String(measuresPerSystem)} onChange={e => {
          const v = e.target.value
          setMeasuresPerSystem(v === 'auto' ? 'auto' : Number(v))
        }}>
          <option value="auto">Auto</option>
          {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>

      <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <button onClick={play}>Play</button>
          <button onClick={stop}>Stop</button>
          <button onClick={undo}>Undo</button>
          <button onClick={redo}>Redo</button>
          <button onClick={reset}>Reset</button>
          {onPrint && <button onClick={onPrint}>Print</button>}
          <button onClick={() => setModalMode('save')}>Save</button>
          <button onClick={() => setModalMode('load')}>Revert</button>
      </div>
    </div>
    </>
  )
}
