import useStore from '../state/store'

// Simple diatonic chord sets for major keys (root-based)
const DIATONIC_MAJOR = {
  C: ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim'],
  G: ['G', 'Am', 'Bm', 'C', 'D', 'Em', 'F#dim'],
  D: ['D', 'Em', 'F#m', 'G', 'A', 'Bm', 'C#dim']
}

function randChoice<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function randomizeChords(key: string, measureCount: number, beatsPerMeasure: number) {
  const pool = (DIATONIC_MAJOR as any)[key] || DIATONIC_MAJOR.C
  const chords: string[][] = Array.from({ length: measureCount }, () => Array.from({ length: beatsPerMeasure }, () => ''))
  for (let m = 0; m < measureCount; m++) {
    for (let b = 0; b < beatsPerMeasure; b++) {
      // bias to common progress: V/I chance increased
      const choose = Math.random()
      if (choose > 0.8) chords[m][b] = pool[4] // V
      else if (choose < 0.05) chords[m][b] = pool[6] // vii
      else chords[m][b] = randChoice(pool)
    }
  }
  return chords
}

// Very small melodic generator: pick notes from key scale
const MAJOR_SCALES: Record<string, string[]> = {
  C: ['C4','D4','E4','F4','G4','A4','B4','C5'],
  G: ['G3','A3','B3','C4','D4','E4','F#4','G4'],
  D: ['D3','E3','F#3','G3','A3','B3','C#4','D4']
}

export type RhythmDensity = 'quarter' | 'eighth-low' | 'eighth-high' | 'eighth-only' | 'mixed' | '16th-random'

export function randomizeMelody(key: string, measureCount: number, beatsPerMeasure: number, subdivisionsPerBeat: number = 4, density: RhythmDensity = 'quarter') {
  const scale = (MAJOR_SCALES as any)[key] || MAJOR_SCALES.C
  
  const melody: (string | null)[][][] = Array.from({ length: measureCount }, () => 
    Array.from({ length: beatsPerMeasure }, () => 
      Array.from({ length: subdivisionsPerBeat }, () => null)
    )
  )

  const getRandomNote = () => scale[Math.floor(Math.random() * scale.length)]

  for (let m = 0; m < measureCount; m++) {
    for (let b = 0; b < beatsPerMeasure; b++) {
      
      // Always place a note on the downbeat for now (simplifies musicality)
      // Or maybe not? For '16th-random' we might skip it.
      // Let's stick to the requested "guide the complexity".
      
      const setNote = (sub: number, dur: string) => {
          if (sub < subdivisionsPerBeat) {
             const note = getRandomNote()
             melody[m][b][sub] = `${note}:${dur}` // Store with duration
          }
      }

      if (density === 'quarter') {
          // One note per beat
          setNote(0, '4n')
      } 
      else if (density === 'eighth-only') {
          // Two notes per beat (0 and 2)
          setNote(0, '8n')
          setNote(2, '8n')
      }
      else if (density === 'eighth-low') {
          // 50% chance of 2nd eighth
          setNote(0, Math.random() > 0.5 ? '4n' : '8n')
          if (melody[m][b][0]?.endsWith('8n')) {
               setNote(2, '8n')
          }
      }
      else if (density === 'eighth-high') {
          // 80% chance of 2nd eighth
          const isSplit = Math.random() < 0.8
          setNote(0, isSplit ? '8n' : '4n')
          if (isSplit) setNote(2, '8n')
      }
      else if (density === 'mixed') {
          // Mix of quarters, eighths, and maybe rests?
          const r = Math.random()
          if (r < 0.4) {
              setNote(0, '4n')
          } else if (r < 0.8) {
              setNote(0, '8n')
              setNote(2, '8n')
          } else {
              // partial syncopation?
              setNote(2, '8n') // Rest on 1, play on &
          }
      }
      else if (density === '16th-random') {
          // Chaos mode
          for(let s=0; s<subdivisionsPerBeat; s++) {
              if (Math.random() < 0.4) {
                 setNote(s, '16n')
              }
          }
      }
    }
  }
  return melody
}

export function randomizeBass(key: string, measureCount: number, beatsPerMeasure: number, subdivisionsPerBeat: number = 4, chords: string[][], density: RhythmDensity = 'quarter') {
  const bass: (string | null)[][][] = Array.from({ length: measureCount }, () => 
    Array.from({ length: beatsPerMeasure }, () => 
      Array.from({ length: subdivisionsPerBeat }, () => null)
    )
  )

  for (let m = 0; m < measureCount; m++) {
    for (let b = 0; b < beatsPerMeasure; b++) {
      const chord = chords[m][b]
      if (!chord) continue
      
      const root = chord.match(/^([A-G][#b]?)/)?.[1]
      if (!root) continue

      const noteVal = root + '3' // Bass octave raised to 3 as requested previously

      const setNote = (sub: number, dur: string) => {
          if (sub < subdivisionsPerBeat) {
             bass[m][b][sub] = `${noteVal}:${dur}`
          }
      }

      if (density === 'quarter') {
          setNote(0, '4n')
      } 
      else if (density === 'eighth-only') {
          setNote(0, '8n')
          setNote(2, '8n')
      }
      else if (density === 'eighth-low') {
          setNote(0, Math.random() > 0.5 ? '4n' : '8n')
          if (bass[m][b][0]?.endsWith('8n')) {
               setNote(2, '8n')
          }
      }
      else if (density === 'eighth-high') {
          const isSplit = Math.random() < 0.8
          setNote(0, isSplit ? '8n' : '4n')
          if (isSplit) setNote(2, '8n')
      }
      else if (density === 'mixed') {
          const r = Math.random()
          if (r < 0.4) {
              setNote(0, '4n')
          } else if (r < 0.8) {
              setNote(0, '8n')
              setNote(2, '8n')
          } else {
              setNote(2, '8n') 
          }
      }
      else if (density === '16th-random') {
          for(let s=0; s<subdivisionsPerBeat; s++) {
              if (Math.random() < 0.4) {
                 setNote(s, '16n')
              }
          }
      }
    }
  }
  return bass
}

// Very simple rhythm assignment: use preset lengths per-measure (choose from presets by id)
import RHYTHM_PRESETS from './presets'

export function randomizeRhythms(measureCount: number) {
  const patterns = Array.from({ length: measureCount }, () => '')
  for (let m = 0; m < measureCount; m++) patterns[m] = RHYTHM_PRESETS[Math.floor(Math.random()*RHYTHM_PRESETS.length)].id
  return patterns
}

export function randomizeAll(density: RhythmDensity = 'quarter', targetMeasure: number | 'all' = 'all', targetTrack: 'all' | 'chords' | 'melody' | 'bass' = 'all') {
  const state = useStore.getState()
  const { measureCount, beatsPerMeasure, subdivisionsPerBeat, key } = state
  
  // 1. Generate new content for everything (simplest way to get valid data structure)
  // In a larger app, we'd pass start/end meaningful ranges to generators, but this is fine.
  const newChords = randomizeChords(key, measureCount, beatsPerMeasure)
  const newMelody = randomizeMelody(key, measureCount, beatsPerMeasure, subdivisionsPerBeat, density) 
  // Note: bass depends on chords. If we are only randomizing bass, use EXISTING chords?
  // If we randomize chords, we MUST randomize bass to match new chords?
  // Let's decide: 
  // - If targetTrack includes 'chords', we prioritize newChords.
  // - If targetTrack is 'bass' or 'melody', we use existing chords to generate bass?
  // Ideally, randomizeBass should take a `chords` array. It currently does.

  // Let's grab current state to preserve what we aren't changing
  const currentChords = JSON.parse(JSON.stringify(state.chords)) // Deep copy
  const currentMelody = JSON.parse(JSON.stringify(state.melody))
  const currentBass = JSON.parse(JSON.stringify(state.bass))

  // 2. Logic to merge new content based on targets
  const rangeStart = targetMeasure === 'all' ? 0 : targetMeasure
  const rangeEnd = targetMeasure === 'all' ? measureCount : targetMeasure + 1

  // Chords
  if (targetTrack === 'all' || targetTrack === 'chords') {
      for (let m = rangeStart; m < rangeEnd; m++) {
          currentChords[m] = newChords[m]
      }
  }

  // Melody
  if (targetTrack === 'all' || targetTrack === 'melody') {
      for (let m = rangeStart; m < rangeEnd; m++) {
          currentMelody[m] = newMelody[m]
      }
  }

  // Bass
  // If we changed chords, we should regenerate bass for those measures normally.
  // If we only target bass, we just regenerate bass using CURRENT chords (or new chords if they changed).
  const chordsForBass = (targetTrack === 'all' || targetTrack === 'chords') ? currentChords : state.chords
  
  // We need to generate bass specifically for the chords we are using.
  const refinedBass = randomizeBass(key, measureCount, beatsPerMeasure, subdivisionsPerBeat, chordsForBass, density)

  if (targetTrack === 'all' || targetTrack === 'bass') {
      for (let m = rangeStart; m < rangeEnd; m++) {
          if (refinedBass[m]) {
             if (!currentBass[m]) currentBass[m] = refinedBass[m]
             else {
                 // Deep copy update for bass measures
                 for(let b=0; b<beatsPerMeasure; b++) {
                     currentBass[m][b] = refinedBass[m][b]
                 }
             }
          }
      }
  }

  // Also randomizing rhythm patterns?
  // Only if all tracks?
  const patterns = randomizeRhythms(measureCount)
  const currentPatterns = [...state.measurePatterns]
  if (targetTrack === 'all') {
       for (let m = rangeStart; m < rangeEnd; m++) {
          currentPatterns[m] = patterns[m]
      }
  }

  state.setAll({
      bpm: state.bpm,
      key: state.key,
      timeSig: state.timeSig,
      subdivisionsPerBeat: state.subdivisionsPerBeat,
      measureCount,
      beatsPerMeasure,
      chords: currentChords,
      melody: currentMelody,
      bass: currentBass,
      measurePatterns: currentPatterns
  })
}

export default { randomizeAll, randomizeChords, randomizeMelody, randomizeBass, randomizeRhythms }
