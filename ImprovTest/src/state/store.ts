import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { transposeNote } from '../lib/musicHelpers'

export type DrumSelection = {
  kick: boolean
  snare: boolean
  hihatClosed: boolean
  hihatOpen: boolean
  cymbal: boolean
}

export type RhythmTrack = DrumSelection[][][]

export type Snapshot = {
  bpm: number
  key: string
  timeSig: string
  measureCount: number
  beatsPerMeasure: number
  chords: string[][]
  measurePatterns?: string[]
  subdivisionsPerBeat?: number
  melody?: (string | null)[][][]
  bass?: (string | null)[][][]
  rhythmTrack?: RhythmTrack
  melodyProgram?: number
  bassProgram?: number
  rhythmProgram?: number
}

type Store = Snapshot & {
  selectedNoteDuration: string // Current paint tool
  setSelectedNoteDuration: (duration: string) => void
  selectedNote: { m: number; b: number; s: number; staff: 'treble' | 'bass' } | null
  setSelectedNote: (note: { m: number; b: number; s: number; staff: 'treble' | 'bass' } | null) => void
  transposeSelection: (semitones: number) => void
  syncChordToBass: boolean
  setSyncChordToBass: (enabled: boolean) => void
  showRhythmTrack: boolean
  toggleRhythmTrack: () => void
  setRhythmTrack: (track: RhythmTrack) => void
  setRhythmNote: (m: number, b: number, s: number, drum: keyof DrumSelection, active: boolean) => void
  undoStack: Snapshot[]
  redoStack: Snapshot[]
  lastResetSnapshot: Snapshot | null
  setAll: (s: Snapshot) => void
  setBPM: (bpm: number) => void
  setKey: (key: string) => void
  setTimeSig: (ts: string) => void
  setMeasureCount: (n: number) => void
  setBeatsPerMeasure: (n: number) => void
  setMeasurePattern: (m: number, patternId: string) => void
  setSubdivisionsPerBeat: (n: number) => void
  setChords: (chords: string[][]) => void
  setChord: (m: number, b: number, value: string) => void
  setMelody: (melody: (string | null)[][][]) => void

  setMelodyNote: (m: number, b: number, s: number, note: string | null) => void
  setMelodyNoteAndClear: (m: number, b: number, s: number, note: string | null, slots: number) => void
  setBassNoteAndClear: (m: number, b: number, s: number, note: string | null, slots: number) => void
  setBassNote: (m: number, b: number, s: number, note: string | null) => void
  melodyProgram: number
  setMelodyProgram: (p: number) => void
  bassProgram: number
  setBassProgram: (p: number) => void
  rhythmProgram: number
  setRhythmProgram: (p: number) => void
  melodyVolume: number
  setMelodyVolume: (v: number) => void
  chordVolume: number
  setChordVolume: (v: number) => void
  bassVolume: number
  setBassVolume: (v: number) => void
  rhythmVolume: number
  setRhythmVolume: (v: number) => void
  reset: () => void
  revert: () => void
  undo: () => void
  redo: () => void
}

// --- Generic Grid Factory ---
function createGrid<T>(
    measures: number, 
    beats: number, 
    subdivisions: number | null, 
    defaultValueOrFactory: T | (() => T)
): T[][][] | T[][] {
    const getValue = () => (typeof defaultValueOrFactory === 'function' ? (defaultValueOrFactory as () => T)() : defaultValueOrFactory)
    
    // 2D Grid (Measures -> Beats)
    if (subdivisions === null) {
        return Array.from({ length: measures }, () => 
            Array.from({ length: beats }, getValue)
        )
    }

    // 3D Grid (Measures -> Beats -> Subdivisions)
    return Array.from({ length: measures }, () => 
        Array.from({ length: beats }, () => 
            Array.from({ length: subdivisions }, getValue)
        )
    )
}

function getDurationFromTicks(t: number) {
  if (t === 16) return '1n'
  if (t === 15) return '1n' // Approx capture for truncation logic
  if (t === 14) return '2n..' 
  if (t === 12) return '2n.'
  if (t === 11) return '2n.' // Approx
  if (t === 10) return '2n' // Approx to half note? No, 10 is 4n + 4n + 8n
  if (t === 8) return '2n'
  if (t === 7) return '4n..'
  if (t === 6) return '4n.'
  if (t === 5) return '4n' // Approx
  if (t === 4) return '4n'
  if (t === 3) return '8n.'
  if (t === 2) return '8n'
  if (t === 1) return '16n'
  return '16n' // Fallback
}

// --- Specific Factories using Generic ---
const makeEmptyChords = (m: number, b: number) => createGrid(m, b, null, '') as string[][]
const makeEmptyMelody = (m: number, b: number, s = 4) => createGrid(m, b, s, null) as (string | null)[][][]
export const makeEmptyRhythm = (m: number, b: number, s = 4): RhythmTrack => createGrid(m, b, s, () => ({
    kick: false,
    snare: false,
    hihatClosed: false,
    hihatOpen: false,
    cymbal: false
})) as RhythmTrack

function copyRhythmTrack(source: RhythmTrack, target: RhythmTrack, measures: number, beats: number, subdivisions: number) {
  for (let i = 0; i < Math.min(measures, source.length); i++) {
    if (!source[i]) continue
    if (!target[i]) continue // Ensure target measure exists
    for (let j = 0; j < Math.min(beats, source[i].length); j++) {
      if (!source[i][j]) continue
      if (!target[i][j]) continue // Ensure target beat exists
      for (let k = 0; k < Math.min(subdivisions, source[i][j].length); k++) {
        if (source[i][j][k]) {
          target[i][j][k] = { ...source[i][j][k] }
        }
      }
    }
  }
}

const DEFAULT_MEASURES = 4
const DEFAULT_BEATS = 4

const initial: Snapshot = {
  bpm: 120,
  key: 'C',
  timeSig: '4/4',
  measureCount: DEFAULT_MEASURES,
  beatsPerMeasure: DEFAULT_BEATS,
  chords: makeEmptyChords(DEFAULT_MEASURES, DEFAULT_BEATS),
  melody: makeEmptyMelody(DEFAULT_MEASURES, DEFAULT_BEATS, 4),
  bass: makeEmptyMelody(DEFAULT_MEASURES, DEFAULT_BEATS, 4),
  rhythmTrack: makeEmptyRhythm(DEFAULT_MEASURES, DEFAULT_BEATS, 4),
  measurePatterns: Array.from({ length: DEFAULT_MEASURES }, () => ''),
  subdivisionsPerBeat: 4,
  // Default both staves to Acoustic Grand (GM 1) on startup
  melodyProgram: 1,
  bassProgram: 1,
  // Rhythm kit tagged as GM 119 Synth Drum
  rhythmProgram: 119
}
// Selected note duration for manual entry (not part of undo/redo snapshot)
const DEFAULT_NOTE_DURATION = '4n'

export const useStore = create<Store>()(devtools((set, get) => ({
  ...initial,
  selectedNoteDuration: DEFAULT_NOTE_DURATION,
  selectedNote: null,
  setSelectedNote: (note) => set({ selectedNote: note }),
  transposeSelection: (semitones: number) => {
      const state = get()
      if (!state.selectedNote) return

      const { m, b, s, staff } = state.selectedNote
      const track = staff === 'treble' ? state.melody : state.bass
      // Safe access
      if (!track || !track[m] || !track[m][b]) return

      const noteStr = track[m][b][s]
      if (!noteStr) return

      // Parse current note: "C#4:4n" or "C#4:4n:tie"
      const parts = noteStr.split(':')
      const currentPitch = parts[0]
      const duration = parts[1] || '16n'
      const tie = parts[2] ? `:${parts[2]}` : ''

      const newPitch = transposeNote(currentPitch, semitones)
      if (newPitch === currentPitch) return // No change or invalid

      const newNoteStr = `${newPitch}:${duration}${tie}`
      
      if (staff === 'treble') {
          // Use existing setter to keep undo/redo consistent
          state.setMelodyNote(m, b, s, newNoteStr)
      } else {
          state.setBassNote(m, b, s, newNoteStr)
      }
      // Note: setMelodyNote handles creating the undo snapshot
  },
  syncChordToBass: true,
  setSyncChordToBass: (enabled) => set({ syncChordToBass: enabled }),
  showRhythmTrack: true,
  toggleRhythmTrack: () => set(state => ({ showRhythmTrack: !state.showRhythmTrack })),
  melodyProgram: initial.melodyProgram!,
  setMelodyProgram: (p: number) => set({ melodyProgram: p }),
  bassProgram: initial.bassProgram!,
  setBassProgram: (p: number) => set({ bassProgram: p }),
  rhythmProgram: initial.rhythmProgram!,
  setRhythmProgram: (p: number) => set({ rhythmProgram: p }),
  melodyVolume: -11,
  setMelodyVolume: (v) => set({ melodyVolume: v }),
  chordVolume: -11,
  setChordVolume: (v) => set({ chordVolume: v }),
  bassVolume: -11,
  setBassVolume: (v) => set({ bassVolume: v }),
  rhythmVolume: -11,
  setRhythmVolume: (v) => set({ rhythmVolume: v }),
  setRhythmTrack: (track) => {
    const before = getSnapshot(get())
    set(state => ({ undoStack: [...state.undoStack, before], redoStack: [], rhythmTrack: track }))
  },
  setRhythmNote: (m: number, b: number, s: number, drum: keyof DrumSelection, active: boolean) => {
    const state = get()
    if (!state.rhythmTrack) return
    const newRhythm = state.rhythmTrack.map((meas, iMeasure) => 
       iMeasure===m ? meas.map((beat, iBeat) => 
         iBeat===b ? beat.map((sub, iSub) => 
           iSub===s ? { ...sub, [drum]: active } : sub
         ) : beat
       ) : meas
    )
    set({ rhythmTrack: newRhythm })
  },
  undoStack: [],
  redoStack: [],
  lastResetSnapshot: null,

  setSelectedNoteDuration(duration: string) {
    set({ selectedNoteDuration: duration })
  },

  setBPM(bpm) {
    const before = getSnapshot(get())
    set(state => ({ undoStack: [...state.undoStack, before], redoStack: [] }))
    set({ bpm })
  },

  setKey(key) {
    const before = getSnapshot(get())
    set(state => ({ undoStack: [...state.undoStack, before], redoStack: [] }))
    set({ key })
  },

  setTimeSig(timeSig) {
    const before = getSnapshot(get())
    set(state => ({ undoStack: [...state.undoStack, before], redoStack: [] }))
    set({ timeSig })
  },

  setMeasureCount(n) {
    const state = get()
    const before = getSnapshot(state)
    const newChords = makeEmptyChords(n, state.beatsPerMeasure)
    // copy existing where possible
    for (let i = 0; i < Math.min(n, state.chords.length); i++) {
      for (let j = 0; j < Math.min(state.chords[i].length, state.beatsPerMeasure); j++) {
        newChords[i][j] = state.chords[i][j]
      }
    }
    const newPatterns = Array.from({ length: n }, () => '')
    for (let i = 0; i < Math.min(n, (state.measurePatterns || []).length); i++) {
      newPatterns[i] = state.measurePatterns ? state.measurePatterns[i] : ''
    }

    // Resize Rhythm
    const newRhythm = makeEmptyRhythm(n, state.beatsPerMeasure, state.subdivisionsPerBeat || 4)
    if (state.rhythmTrack) {
        copyRhythmTrack(state.rhythmTrack, newRhythm, n, state.beatsPerMeasure, state.subdivisionsPerBeat || 4)
    }

    // Resize Melody
    const newMelody = makeEmptyMelody(n, state.beatsPerMeasure, state.subdivisionsPerBeat || 4)
    if (state.melody) {
        for (let i = 0; i < Math.min(n, state.melody.length); i++) {
             if (!state.melody[i]) continue;
             for (let j = 0; j < Math.min(state.beatsPerMeasure, state.melody[i].length); j++) {
                  if (state.melody[i][j]) {
                      newMelody[i][j] = state.melody[i][j].slice()
                  }
             }
        }
    }

    // Resize Bass
    const newBass = makeEmptyMelody(n, state.beatsPerMeasure, state.subdivisionsPerBeat || 4)
    if (state.bass) {
        for (let i = 0; i < Math.min(n, state.bass.length); i++) {
             if (!state.bass[i]) continue;
             for (let j = 0; j < Math.min(state.beatsPerMeasure, state.bass[i].length); j++) {
                  if (state.bass[i][j]) {
                      newBass[i][j] = state.bass[i][j].slice()
                  }
             }
        }
    }

    set({ measureCount: n, chords: newChords, measurePatterns: newPatterns, rhythmTrack: newRhythm, melody: newMelody, bass: newBass, undoStack: [...state.undoStack, before], redoStack: [] })
  },

  setBeatsPerMeasure(n) {
    const state = get()
    const before = getSnapshot(state)
    const newChords = makeEmptyChords(state.measureCount, n)
    for (let i = 0; i < state.measureCount; i++) {
        // Safe access for chords - Handle sparse/incomplete arrays by checking length
        if (state.chords && state.chords[i]) {
            for (let j = 0; j < Math.min(n, state.chords[i].length); j++) {
                newChords[i][j] = state.chords[i][j]
            }
        }
    }
    
    // Resize Melody & Bass to match new beats
    const newMelody = makeEmptyMelody(state.measureCount, n, state.subdivisionsPerBeat || 4)
    if (state.melody) {
        // Iterate up to existing melody length, not measureCount (which might be larger if desynced)
        for (let i = 0; i < Math.min(state.measureCount, state.melody.length); i++) {
            if (!state.melody[i]) continue;
            for (let j = 0; j < Math.min(n, state.melody[i].length); j++) {
                // Copy the beat array (subdivisions)
                if (state.melody[i][j]) {
                    newMelody[i][j] = state.melody[i][j].slice()
                }
            }
        }
    }

    const newBass = makeEmptyMelody(state.measureCount, n, state.subdivisionsPerBeat || 4)
    if (state.bass) {
        for (let i = 0; i < Math.min(state.measureCount, state.bass.length); i++) {
            if (!state.bass[i]) continue;
            for (let j = 0; j < Math.min(n, state.bass[i].length); j++) {
                if (state.bass[i][j]) {
                    newBass[i][j] = state.bass[i][j].slice()
                }
            }
        }
    }

    // Resize Rhythm
    const newRhythm = makeEmptyRhythm(state.measureCount, n, state.subdivisionsPerBeat || 4)
    if (state.rhythmTrack) {
        copyRhythmTrack(state.rhythmTrack, newRhythm, state.measureCount, n, state.subdivisionsPerBeat || 4)
    }

    set({ beatsPerMeasure: n, chords: newChords, melody: newMelody, bass: newBass, rhythmTrack: newRhythm, undoStack: [...state.undoStack, before], redoStack: [] })
  },

  setSubdivisionsPerBeat(n) {
    // limit allowed subdivisions to 1,2,4 (quarter, eighth, sixteenth)
    const allowed = [1, 2, 4]
    const val = allowed.includes(n) ? n : 4
    const state = get()
    const before = getSnapshot(state)
    set({ subdivisionsPerBeat: val, undoStack: [...state.undoStack, before], redoStack: [] })
  },

  setMeasurePattern(m, patternId) {
    const state = get()
    const before = getSnapshot(state)
    const patterns = state.measurePatterns ? state.measurePatterns.slice() : []
    if (m < 0 || m >= state.measureCount) return
    patterns[m] = patternId
    set({ measurePatterns: patterns, undoStack: [...state.undoStack, before], redoStack: [] })
  },

  setChords(chords) {
    const state = get()
    const before = getSnapshot(state)
    set({ chords: chords.map(r => r.slice()), undoStack: [...state.undoStack, before], redoStack: [] })
  },

  setMelody(melody) {
    const state = get()
    const before = getSnapshot(state)
    set({ melody: melody.map(r => r.map(b => b.slice())), undoStack: [...state.undoStack, before], redoStack: [] })
  },
  
  setMelodyNote(m, b, s, note) {
    const state = get()
    // Optimization: Don't snapshot if unchanged? No, we need undo history.
    // Use batch update externally? Or make a setMelodyNotes (plural)?
    // For now, let's just make it robust.
    const before = getSnapshot(state)
    const melody = state.melody ? state.melody.map(r => r.map(beat => beat.slice())) : []
    if (!melody[m]) return
    if (!melody[m][b]) return
    melody[m][b][s] = note
    set({ melody, undoStack: [...state.undoStack, before], redoStack: [] })
  },

  // Optimized for multi-slot clearing with smart truncation
  setMelodyNoteAndClear(m, b, s, note, slotsToClear) {
      const state = get()
      const before = getSnapshot(state)
      // Deep copy to ensure mutation safety
      const melody = state.melody ? state.melody.map(r => r.map(beat => beat.slice())) : []
      if (!melody[m] || !melody[m][b]) return

      const subdivisions = state.subdivisionsPerBeat || 4
      const targetTick = b * subdivisions + s

      // --- TRUNCATE BACKWARD OVERLAPS ---
      // We must scan the WHOLE measure backwards because a Whole Note at 0,0 overlaps everything
      // Start scanning from the tick immediately before the new note
      for (let t = targetTick - 1; t >= 0; t--) {
          const pb = Math.floor(t / subdivisions)
          const ps = t % subdivisions
          const prevNoteStr = melody[m][pb][ps]
          
          if (prevNoteStr) {
               // Found a note starting at t
               const parts = prevNoteStr.split(':')
               const pitch = parts[0]
               const durStr = parts.length > 1 ? parts[1] : '16n'
               
               let oldSlots = 1
               if (durStr === '1n') oldSlots = 16
               else if (durStr === '2n.') oldSlots = 12
               else if (durStr === '2n') oldSlots = 8
               else if (durStr === '4n.') oldSlots = 6
               else if (durStr === '4n') oldSlots = 4
               else if (durStr === '8n.') oldSlots = 3
               else if (durStr === '8n') oldSlots = 2
               else oldSlots = 1

               const oldEndTick = t + oldSlots

               // Check if it actually overlaps our target start tick
               if (oldEndTick > targetTick) {
                   // Calculate new truncated length
                   const newLength = targetTick - t
                   
                   if (newLength > 0) {
                       const newDurStr = getDurationFromTicks(newLength)
                       const isTied = prevNoteStr.includes(':tie')
                       melody[m][pb][ps] = `${pitch}:${newDurStr}${isTied ? ':tie' : ''}`
                   } else {
                       // Should not happen if loop checks t < targetTick, unless logic error
                       melody[m][pb][ps] = null
                   }
               }
               // Stop after finding the first active note going backwards (notes don't overlap each other in a monophonic track usually)
               // Assuming monophonic per staff
               break 
          }
      }

      // Set main note
      melody[m][b][s] = note

      // Clear subsequent slots (standard overwrite behavior for the NEW note's duration)
      // This part remains 'destructive' for forward overlap because the new note is "on top"
      let currentM = m
      let currentB = b
      let currentS = s + 1
      let remaining = slotsToClear
      const measureCount = state.measureCount
      const beatsPerMeasure = state.beatsPerMeasure

      while (remaining > 0) {
           if (currentS >= subdivisions) {
               currentS = 0
               currentB++
               if (currentB >= beatsPerMeasure) {
                   currentB = 0
                   currentM++
               }
           }
           if (currentM >= measureCount) break
           
           if (melody[currentM] && melody[currentM][currentB]) {
                melody[currentM][currentB][currentS] = null
           }
           remaining--
           currentS++
      }
      set({ melody, undoStack: [...state.undoStack, before], redoStack: [] })
  },

  
  // Optimized for multi-slot clearing
  setBassNoteAndClear(m, b, s, note, slotsToClear) {
      const state = get()
      const before = getSnapshot(state)
      const bass = state.bass ? state.bass.map(r => r.map(beat => beat.slice())) : []
      if (!bass[m] || !bass[m][b]) return

      const subdivisions = state.subdivisionsPerBeat || 4
      const targetTick = b * subdivisions + s

      // --- TRUNCATE BACKWARD OVERLAPS ---
      for (let t = targetTick - 1; t >= 0; t--) {
          const pb = Math.floor(t / subdivisions)
          const ps = t % subdivisions
          const prevNoteStr = bass[m][pb][ps]
          
          if (prevNoteStr) {
               const parts = prevNoteStr.split(':')
               const pitch = parts[0]
               const durStr = parts.length > 1 ? parts[1] : '16n'
               
               let oldSlots = 1
               if (durStr === '1n') oldSlots = 16
               else if (durStr === '2n.') oldSlots = 12
               else if (durStr === '2n') oldSlots = 8
               else if (durStr === '4n.') oldSlots = 6
               else if (durStr === '4n') oldSlots = 4
               else if (durStr === '8n.') oldSlots = 3
               else if (durStr === '8n') oldSlots = 2
               else oldSlots = 1

               const oldEndTick = t + oldSlots

               if (oldEndTick > targetTick) {
                   const newLength = targetTick - t
                   if (newLength > 0) {
                       const newDurStr = getDurationFromTicks(newLength)
                       const isTied = prevNoteStr.includes(':tie')
                       bass[m][pb][ps] = `${pitch}:${newDurStr}${isTied ? ':tie' : ''}`
                   }
               }
               break 
          }
      }

      // Set main note
      bass[m][b][s] = note

      // Clear subsequent slots
      let currentM = m
      let currentB = b
      let currentS = s + 1
      let remaining = slotsToClear
      const measureCount = state.measureCount
      const beatsPerMeasure = state.beatsPerMeasure

      while (remaining > 0) {
           if (currentS >= subdivisions) {
               currentS = 0
               currentB++
               if (currentB >= beatsPerMeasure) {
                   currentB = 0
                   currentM++
               }
           }
           if (currentM >= measureCount) break
           
           if (bass[currentM] && bass[currentM][currentB]) {
                bass[currentM][currentB][currentS] = null
           }
           remaining--
           currentS++
      }
      set({ bass, undoStack: [...state.undoStack, before], redoStack: [] })
  },


  setBassNote(m, b, s, note) {
    const state = get()
    const before = getSnapshot(state)
    const bass = state.bass ? state.bass.map(r => r.map(beat => beat.slice())) : []
    // Ensure structure exists
    if (!bass[m]) return
    if (!bass[m][b]) return
    bass[m][b][s] = note
    set({ bass, undoStack: [...state.undoStack, before], redoStack: [] })
  },

  setChord(m, b, value) {
    const state = get()
    const before = getSnapshot(state)
    const chordsCopy = state.chords.map(row => row.slice())
    if (!chordsCopy[m]) return
    chordsCopy[m][b] = value
    set({ chords: chordsCopy, undoStack: [...state.undoStack, before], redoStack: [] })
  },

  setAll(snapshot: Snapshot) {
      const state = get()
      const before = getSnapshot(state)
      set({
          ...snapshot,
          undoStack: [...state.undoStack, before],
          redoStack: []
      })
  },

  reset() {
    const state = get()
    const before = getSnapshot(state)
    const emptyChords = makeEmptyChords(state.measureCount, state.beatsPerMeasure)
    const emptyMelody = makeEmptyMelody(state.measureCount, state.beatsPerMeasure, state.subdivisionsPerBeat || 4)
    const emptyBass = makeEmptyMelody(state.measureCount, state.beatsPerMeasure, state.subdivisionsPerBeat || 4)
    const emptyRhythm = makeEmptyRhythm(state.measureCount, state.beatsPerMeasure, state.subdivisionsPerBeat || 4)
    
    set({ 
      chords: emptyChords, 
      melody: emptyMelody, 
      bass: emptyBass, 
      rhythmTrack: emptyRhythm, 
      lastResetSnapshot: before, 
      undoStack: [...state.undoStack, before], 
      redoStack: [] 
    })
  },

  revert() {
    const state = get()
    if (!state.lastResetSnapshot) return
    const before = getSnapshot(state)
    const s = state.lastResetSnapshot
    set({
      bpm: s.bpm,
      key: s.key,
      timeSig: s.timeSig,
      measureCount: s.measureCount,
      beatsPerMeasure: s.beatsPerMeasure,
      chords: s.chords.map(r => r.slice()),
      melody: s.melody ? s.melody.map(m => m.map(b => b.slice())) : [],
      bass: s.bass ? s.bass.map(m => m.map(b => b.slice())) : [],
      rhythmTrack: s.rhythmTrack ? s.rhythmTrack.map(m => m.map(b => b.map(x => ({...x})))) : [],
      measurePatterns: s.measurePatterns ? s.measurePatterns.slice() : undefined,
      melodyProgram: s.melodyProgram ?? initial.melodyProgram!,
      bassProgram: s.bassProgram ?? initial.bassProgram!,
      rhythmProgram: s.rhythmProgram ?? initial.rhythmProgram!,
      undoStack: [...state.undoStack, before],
      redoStack: []
    })
  },

  undo() {
    const state = get()
    if (state.undoStack.length === 0) return
    const prev = state.undoStack[state.undoStack.length - 1]
    const before = getSnapshot(state)
    const newUndo = state.undoStack.slice(0, -1)
    set({
      bpm: prev.bpm,
      key: prev.key,
      timeSig: prev.timeSig,
      measureCount: prev.measureCount,
      beatsPerMeasure: prev.beatsPerMeasure,
      chords: prev.chords.map(r => r.slice()),
      melody: prev.melody ? prev.melody.map(m => m.map(b => b.slice())) : [],
      bass: prev.bass ? prev.bass.map(m => m.map(b => b.slice())) : [],
      rhythmTrack: prev.rhythmTrack ? prev.rhythmTrack.map(m => m.map(b => b.map(x => ({...x})))) : [],
      measurePatterns: prev.measurePatterns ? prev.measurePatterns.slice() : undefined,
      melodyProgram: prev.melodyProgram ?? initial.melodyProgram!,
      bassProgram: prev.bassProgram ?? initial.bassProgram!,
      rhythmProgram: prev.rhythmProgram ?? initial.rhythmProgram!,
      undoStack: newUndo,
      redoStack: [...state.redoStack, before]
    })
  },

  redo() {
    const state = get()
    if (state.redoStack.length === 0) return
    const next = state.redoStack[state.redoStack.length - 1]
    const before = getSnapshot(state)
    const newRedo = state.redoStack.slice(0, -1)
    set({
      bpm: next.bpm,
      key: next.key,
      timeSig: next.timeSig,
      measureCount: next.measureCount,
      beatsPerMeasure: next.beatsPerMeasure,
      chords: next.chords.map(r => r.slice()),
      melody: next.melody ? next.melody.map(m => m.map(b => b.slice())) : [],
      bass: next.bass ? next.bass.map(m => m.map(b => b.slice())) : [],
      rhythmTrack: next.rhythmTrack ? next.rhythmTrack.map(m => m.map(b => b.map(x => ({...x})))) : [],
      measurePatterns: next.measurePatterns ? next.measurePatterns.slice() : undefined,
      melodyProgram: next.melodyProgram ?? initial.melodyProgram!,
      bassProgram: next.bassProgram ?? initial.bassProgram!,
      rhythmProgram: next.rhythmProgram ?? initial.rhythmProgram!,
      redoStack: newRedo,
      undoStack: [...state.undoStack, before]
    })
  }
}), { name: 'ImprovTest Store' }))

function getSnapshot(s: Snapshot): Snapshot {
  return {
    bpm: s.bpm,
    key: s.key,
    timeSig: s.timeSig,
    measureCount: s.measureCount,
    beatsPerMeasure: s.beatsPerMeasure,
    chords: s.chords.map(r => r.slice()),
    melody: s.melody ? s.melody.map(m => m.map(b => b.slice())) : [],
    bass: s.bass ? s.bass.map(m => m.map(b => b.slice())) : [],
    rhythmTrack: s.rhythmTrack ? s.rhythmTrack.map(m => m.map(b => b.map(s => ({...s})))) : [],
    measurePatterns: s.measurePatterns ? s.measurePatterns.slice() : undefined,
    melodyProgram: s.melodyProgram,
    bassProgram: s.bassProgram,
    rhythmProgram: s.rhythmProgram
  }
}

export default useStore
