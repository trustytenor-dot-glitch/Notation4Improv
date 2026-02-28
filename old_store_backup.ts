import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

export type DrumSelection = {
  kick: boolean
  snare: boolean
  hihatClosed: boolean
  hihatOpen: boolean
  cymbal: boolean
}

export type RhythmTrack = DrumSelection[][][]

type Snapshot = {
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
  melodyVolume: number;
  setMelodyVolume: (v: number) => void;
  chordVolume: number;
  setChordVolume: (v: number) => void;
  bassVolume: number;
  setBassVolume: (v: number) => void;
  rhythmVolume: number;
  setRhythmVolume: (v: number) => void;
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

function makeEmptyChords(measureCount: number, beatsPerMeasure: number) {
  return Array.from({ length: measureCount }, () => Array.from({ length: beatsPerMeasure }, () => ''))
}

export function makeEmptyRhythm(measureCount: number, beatsPerMeasure: number, subdivisions = 4): RhythmTrack {
  return Array.from({ length: measureCount }, () => 
    Array.from({ length: beatsPerMeasure }, () => 
      Array.from({ length: subdivisions }, () => ({
        kick: false,
        snare: false,
        hihatClosed: false,
        hihatOpen: false,
        cymbal: false
      }))
    )
  )
}

function makeEmptyMelody(measureCount: number, beatsPerMeasure: number, subdivisions = 4) {
  return Array.from({ length: measureCount }, () => 
    Array.from({ length: beatsPerMeasure }, () => 
      Array.from({ length: subdivisions }, () => null)
    )
  )
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
        for (let i = 0; i < Math.min(n, state.rhythmTrack.length); i++) {
            for (let j = 0; j < Math.min(state.beatsPerMeasure, state.rhythmTrack[i].length); j++) {
                for (let k = 0; k < Math.min(state.subdivisionsPerBeat || 4, state.rhythmTrack[i][j].length); k++) {
                    newRhythm[i][j][k] = { ...state.rhythmTrack[i][j][k] }
                }
            }
        }
    }

    // Resize Melody
    const newMelody = makeEmptyMelody(n, state.beatsPerMeasure, state.subdivisionsPerBeat || 4)
    if (state.melody) {
        for (let i = 0; i < Math.min(n, state.melody.length); i++) {
             for (let j = 0; j < Math.min(state.beatsPerMeasure, state.melody[i].length); j++) {
                  newMelody[i][j] = state.melody[i][j].slice()
             }
        }
    }

    // Resize Bass
    const newBass = makeEmptyMelody(n, state.beatsPerMeasure, state.subdivisionsPerBeat || 4)
    if (state.bass) {
        for (let i = 0; i < Math.min(n, state.bass.length); i++) {
             for (let j = 0; j < Math.min(state.beatsPerMeasure, state.bass[i].length); j++) {
                  newBass[i][j] = state.bass[i][j].slice()
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
        // Safe access for chords
        if (state.chords[i]) {
            for (let j = 0; j < Math.min(n, state.chords[i].length); j++) {
                newChords[i][j] = state.chords[i][j]
            }
        }
    }
    
    // Resize Melody & Bass to match new beats
    const newMelody = makeEmptyMelody(state.measureCount, n, state.subdivisionsPerBeat || 4)
    if (state.melody) {
        for (let i = 0; i < Math.min(state.measureCount, state.melody.length); i++) {
            for (let j = 0; j < Math.min(n, state.melody[i].length); j++) {
                // Copy the beat array (subdivisions)
                newMelody[i][j] = state.melody[i][j].slice()
            }
        }
    }

    const newBass = makeEmptyMelody(state.measureCount, n, state.subdivisionsPerBeat || 4)
    if (state.bass) {
        for (let i = 0; i < Math.min(state.measureCount, state.bass.length); i++) {
            for (let j = 0; j < Math.min(n, state.bass[i].length); j++) {
                newBass[i][j] = state.bass[i][j].slice()
            }
        }
    }

    // Resize Rhythm
    const newRhythm = makeEmptyRhythm(state.measureCount, n, state.subdivisionsPerBeat || 4)
    if (state.rhythmTrack) {
        for (let i = 0; i < Math.min(state.measureCount, state.rhythmTrack.length); i++) {
            for (let j = 0; j < Math.min(n, state.rhythmTrack[i].length); j++) {
                for(let k = 0; k < (state.subdivisionsPerBeat || 4); k++) {
                    if (state.rhythmTrack[i][j][k]) {
                        newRhythm[i][j][k] = { ...state.rhythmTrack[i][j][k] }
                    }
                }
            }
        }
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

      // Helper for duration strings
      const getDurationFromTicks = (t: number) => {
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

      // Helper for duration strings (duplicate to avoid scope issues or refactor later)
      const getDurationFromTicks = (t: number) => {
           if (t === 16) return '1n'
           if (t === 15) return '1n' 
           if (t === 14) return '2n..' 
           if (t === 12) return '2n.'
           if (t === 11) return '2n.' 
           if (t === 10) return '2n' 
           if (t === 8) return '2n'
           if (t === 7) return '4n..'
           if (t === 6) return '4n.'
           if (t === 5) return '4n' 
           if (t === 4) return '4n'
           if (t === 3) return '8n.'
           if (t === 2) return '8n'
           if (t === 1) return '16n'
           return '16n' 
      }

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
