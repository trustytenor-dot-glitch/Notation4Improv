import React, { useState, useEffect } from 'react'
import StaffCanvas from './components/StaffCanvas'
import ChordDropdown from './components/ChordDropdown'
import InstrumentDropdown, { InstrumentOption } from './components/InstrumentDropdown'
import useStore from './state/store'
import Toolbar from './components/Toolbar'
import Inspector from './components/Inspector'
import AudioController from './components/AudioController'

export default function App() {
  const [width, setWidth] = useState(window.innerWidth - 40)
  const height = 480 // Increased height for multiple staves

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth - 40)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const measureCount = useStore(s => s.measureCount)
  const beatsPerMeasure = useStore(s => s.beatsPerMeasure)
  const subdivisionsPerBeat = useStore(s => s.subdivisionsPerBeat)
  const chords = useStore(s => s.chords)
  const setChord = useStore(s => s.setChord)
  const setBassNote = useStore(s => s.setBassNote)
  const syncChordToBass = useStore(s => s.syncChordToBass)
  const melodyProgram = useStore(s => s.melodyProgram)
  const setMelodyProgram = useStore(s => s.setMelodyProgram)
  const bassProgram = useStore(s => s.bassProgram)
  const setBassProgram = useStore(s => s.setBassProgram)
  const [editing, setEditing] = useState<null | { m: number; b: number; x: number; y: number }>(null)
  const [instrumentPicker, setInstrumentPicker] = useState<null | { staff: 'treble' | 'bass'; x: number; y: number }>(null)

  const trebleInstruments: InstrumentOption[] = [
    { program: 1, label: 'Acoustic Grand' },
    { program: 9, label: 'Celesta' },
    { program: 12, label: 'Vibraphone' },
    { program: 13, label: 'Marimba' },
    { program: 25, label: 'Nylon String Guitar' },
    { program: 26, label: 'Steel String Guitar' },
    { program: 41, label: 'Violin' },
    { program: 42, label: 'Viola' },
    { program: 43, label: 'Cello' },
    { program: 57, label: 'Trumpet' },
    { program: 58, label: 'Trombone' },
    { program: 61, label: 'French Horn' },
    { program: 66, label: 'Alto Sax' },
    { program: 67, label: 'Tenor Sax' },
    { program: 72, label: 'Clarinet' },
    { program: 74, label: 'Flute' },
    { program: 78, label: 'Shakuhachi' },
    { program: 91, label: 'Polysynth' },
  ]

  const bassInstruments: InstrumentOption[] = [
    { program: 1, label: 'Acoustic Grand' },
    { program: 33, label: 'Acoustic Bass' },
    { program: 34, label: 'Electric Bass (Finger)' },
    { program: 35, label: 'Electric Bass (Pick)' },
    { program: 43, label: 'Cello' },
    { program: 44, label: 'Contrabass' },
    { program: 59, label: 'Tuba' },
    { program: 67, label: 'Tenor Sax' },
    { program: 68, label: 'Baritone Sax' },
    { program: 90, label: 'Warm Pad' },
    { program: 93, label: 'Bowed Glass' },
    { program: 95, label: 'Halo Pad' },
    { program: 96, label: 'Sweep Pad' },
  ]
  
  function handleChordClick(m: number, b: number, clientX: number, clientY: number) {
    setEditing({ m, b, x: clientX, y: clientY })
  }

  function applyChord(value: string) {
    if (!editing) return
    setChord(editing.m, editing.b, value)
    
    // Sync to Bass (One-way: Chord -> Bass)
    if (value && syncChordToBass) {
        const root = value.match(/^([A-G][#b]?)/)?.[1]
        if (root) {
            // Place root in bass staff (octave 3 is standard for bass roots)
            // Duration matches the beat (quarter note usually, or just placing it)
            // Since bass track is 16th grid, we place at sub-index 0
            setBassNote(editing.m, editing.b, 0, `${root}3:4n`)
        }
    }
    setEditing(null)
  }

  function handleTrebleClefClick(clientX: number, clientY: number) {
    setInstrumentPicker({ staff: 'treble', x: clientX, y: clientY })
  }

  function handleBassClefClick(clientX: number, clientY: number) {
    setInstrumentPicker({ staff: 'bass', x: clientX, y: clientY })
  }

  return (
    <div style={{ padding: 20, fontFamily: 'sans-serif' }}>
      <AudioController />
      <h1>ImprovTest (Beta)</h1>
      <Toolbar />
      <Inspector />
      <div style={{ position: 'relative', width, marginTop: 20 }}>
        <StaffCanvas
          width={width}
          height={height}
          measureCount={measureCount}
          beatsPerMeasure={beatsPerMeasure}
          subdivisionsPerBeat={subdivisionsPerBeat}
          chords={chords}
          onChordClick={handleChordClick}
          onTrebleClefClick={handleTrebleClefClick}
          onBassClefClick={handleBassClefClick}
        />
        {editing && (
          <ChordDropdown
            x={editing.x}
            y={editing.y}
            value={chords[editing.m][editing.b]}
            onConfirm={applyChord}
            onCancel={() => setEditing(null)}
            keySignature={useStore.getState().key}
          />
        )}
        {instrumentPicker && (
          <InstrumentDropdown
            x={instrumentPicker.x}
            y={instrumentPicker.y}
            value={instrumentPicker.staff === 'treble' ? melodyProgram : bassProgram}
            options={instrumentPicker.staff === 'treble' ? trebleInstruments : bassInstruments}
            title={instrumentPicker.staff === 'treble' ? 'Treble Instrument' : 'Bass Instrument'}
            onSelect={(program) => {
              if (instrumentPicker.staff === 'treble') setMelodyProgram(program)
              else setBassProgram(program)
              setInstrumentPicker(null)
            }}
            onCancel={() => setInstrumentPicker(null)}
          />
        )}
      </div>
    </div>
  )
}
