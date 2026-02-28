import * as Tone from 'tone'
import useStore from '../state/store'
import interaction from './interaction'
import RHYTHM_PRESETS from './presets'

let melodySynth: Tone.Synth | null = null
let chordSynth: Tone.PolySynth | null = null
let bassSynth: Tone.Synth | null = null
let kick: Tone.MembraneSynth | null = null
let hiHat: Tone.NoiseSynth | null = null
let snare: Tone.NoiseSynth | null = null
let cymbal: Tone.MetalSynth | null = null
let loop: Tone.Loop | null = null
let playing = false

type SynthProgramConfig = {
  oscillator: Tone.ToneOscillatorType
  attack: number
  decay: number
  sustain: number
}

function programToSynthConfig(program: number, isBass: boolean): SynthProgramConfig {
  // Very lightweight mapping from GM program to basic synth character
  // (not a full GM soundfont, just useful color changes).
  if (isBass) {
    if (program === 33 || program === 34 || program === 35 || program === 44) {
      return { oscillator: 'sawtooth', attack: 0.005, decay: 0.25, sustain: 0.3 }
    }
    if (program === 59) {
      return { oscillator: 'square', attack: 0.01, decay: 0.4, sustain: 0.4 }
    }
    if (program === 90 || program === 93 || program === 95 || program === 96) {
      return { oscillator: 'triangle', attack: 0.02, decay: 0.8, sustain: 0.7 }
    }
    // Default bass-ish
    return { oscillator: 'sawtooth', attack: 0.01, decay: 0.3, sustain: 0.3 }
  }

  // Treble / melody
  if (program === 9 || program === 12 || program === 13) {
    return { oscillator: 'triangle', attack: 0.005, decay: 0.5, sustain: 0.2 }
  }
  if (program === 25 || program === 26) {
    return { oscillator: 'sawtooth', attack: 0.005, decay: 0.4, sustain: 0.3 }
  }
  if (program === 41 || program === 42 || program === 43) {
    return { oscillator: 'sawtooth', attack: 0.01, decay: 0.6, sustain: 0.4 }
  }
  if (program === 57 || program === 58 || program === 61 || program === 66 || program === 67 || program === 72 || program === 74 || program === 78) {
    return { oscillator: 'square', attack: 0.005, decay: 0.35, sustain: 0.3 }
  }
  if (program === 91) {
    return { oscillator: 'sawtooth', attack: 0.02, decay: 0.9, sustain: 0.6 }
  }
  // Default piano-ish
  return { oscillator: 'sine', attack: 0.01, decay: 0.25, sustain: 0.3 }
}

function createInstruments() {
  const state = useStore.getState()
  const melodyCfg = programToSynthConfig(state.melodyProgram ?? 1, false)
  const bassCfg = programToSynthConfig(state.bassProgram ?? 1, true)

  if (!melodySynth) melodySynth = new Tone.Synth({ oscillator: { type: melodyCfg.oscillator }, envelope: { attack: melodyCfg.attack, decay: melodyCfg.decay, sustain: melodyCfg.sustain } }).toDestination()
  if (!chordSynth) chordSynth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.02, decay: 0.1, sustain: 0.1, release: 1 } }).toDestination()
  if (!bassSynth) bassSynth = new Tone.Synth({ oscillator: { type: bassCfg.oscillator }, envelope: { attack: bassCfg.attack, decay: bassCfg.decay, sustain: bassCfg.sustain } }).toDestination()
  
  if (!kick) kick = new Tone.MembraneSynth().toDestination()
  // Rhythm: approximate GM 119 "Synth Drum" with a short, bright noise hit
  if (!hiHat) hiHat = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.12, sustain: 0 } }).toDestination()
  if (!snare) snare = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.2, sustain: 0 } }).toDestination()
  if (!cymbal) cymbal = new Tone.MetalSynth({ frequency: 300, envelope: { attack: 0.001, decay: 1.4, release: 0.2 }, harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5 }).toDestination()
}

function parseChordRoot(chord: string) {
  const m = chord.match(/^([A-G][#b]?)/)
  return m ? m[1] : null
}

function chordToNotes(chord: string) {
  const root = parseChordRoot(chord)
  if (!root) return []
  const quality = chord.includes('m') && !chord.includes('maj') ? 'm' : chord.includes('dim') || chord.includes('°') ? 'dim' : 'maj'
  const rootMidi = interaction.pitchNameToMidi(root + '3') || 48
  let intervals = [0, 4, 7]
  if (quality === 'm') intervals = [0, 3, 7]
  if (quality === 'dim') intervals = [0, 3, 6]
  return intervals.map(i => interaction.midiToPitchName(rootMidi + i))
}

function durationToSixteenthCount(dur: string) {
  // Map common Tone.js notation to sixteenth counts (assuming quarter-note beat)
  const map: Record<string, number> = {
    '16n': 1,
    '8n': 2,
    '8n.': 3,
    '4n': 4,
    '4n.': 6,
    '2n': 8,
    '1n': 16,
    '1m': 16
  }
  return map[dur] || 0
}

function vexToTone(pitch: string): string {
  if (!pitch) return ''
  if (!pitch.includes('/')) return pitch
  const [note, octave] = pitch.split('/')
  return note.charAt(0).toUpperCase() + note.slice(1) + octave
}

function patternToOnsetMap(patternId: string, measureTicks: number) {
  const preset = RHYTHM_PRESETS.find(p => p.id === patternId)
  const map = new Array(measureTicks).fill(false)
  if (!preset) return map
  // iterate durations, mark onsets sequentially
  let cursor = 0
  for (const dur of preset.pattern) {
    const count = durationToSixteenthCount(dur)
    if (count <= 0) continue
    if (cursor < measureTicks) map[cursor] = true
    cursor += count
    if (cursor >= measureTicks) break
  }
  return map
}

export async function startPlayback() {
  if (playing) return
  await Tone.start()
  createInstruments()
  const store = useStore.getState()
  Tone.Transport.bpm.value = store.bpm

  const subdivisionsPerBeat = store.subdivisionsPerBeat || 4
  const subdivisionNote = subdivisionsPerBeat === 1 ? '4n' : subdivisionsPerBeat === 2 ? '8n' : '16n'

  let tick = 0
  
  loop = new Tone.Loop((time) => {
    const state = useStore.getState()
    // dynamic safety: recompute derived values if time signature changed
    const currentMeasureTicks = state.beatsPerMeasure * subdivisionsPerBeat
    const currentTotalTicks = state.measureCount * currentMeasureTicks
    if (tick >= currentTotalTicks) tick = 0

    const measureIndex = Math.floor(tick / currentMeasureTicks)
    const withinMeasureTick = tick % currentMeasureTicks
    const beatIndex = Math.floor(withinMeasureTick / subdivisionsPerBeat)
    const withinBeatSub = withinMeasureTick % subdivisionsPerBeat

    // chords: trigger on beat onset (withinBeatSub === 0)
    const chord = state.chords?.[measureIndex]?.[beatIndex]
    if (chord && withinBeatSub === 0 && chordSynth) {
      const notes = chordToNotes(chord)
      if (notes.length > 0) chordSynth.triggerAttackRelease(notes, '8n', time)
    }

    // Melody: 3D access
    const melodyMeasure = state.melody?.[measureIndex]
    if (melodyMeasure) {
      const melodyBeat = melodyMeasure[beatIndex]
      if (melodyBeat) {
        // melodyBeat is (string | null)[]
        const rawNote = melodyBeat[withinBeatSub]
        if (rawNote && melodySynth) {
          const [pitch, duration] = rawNote.split(':')
          if (pitch) {
            const tonePitch = vexToTone(pitch)
            // console.log('Playing Melody:', tonePitch, duration)
            melodySynth.triggerAttackRelease(tonePitch, duration || '16n', time)
          }
        }
      }
    }

    // Bass: 3D access
    const bassMeasure = state.bass?.[measureIndex] // bass might be simpler?
    // Assume bass follows same [measure][beat][sub] structure?
    if (bassMeasure) {
      const bassBeat = bassMeasure[beatIndex]
      if (bassBeat) {
         const rawNote = bassBeat[withinBeatSub]
         if (rawNote && bassSynth) {
            const [pitch, duration] = rawNote.split(':')
            if (pitch) {
              const tonePitch = vexToTone(pitch)
              bassSynth.triggerAttackRelease(tonePitch, duration || '8n', time)
            }
         }
      }
    }

    // Rhythm / Drum Track
    const rhythmTrack = state.rhythmTrack
     if (rhythmTrack && rhythmTrack[measureIndex] && kick && snare && hiHat && cymbal) {
       const drumBeat = rhythmTrack[measureIndex][beatIndex]
       if (drumBeat) {
          const drumSel = drumBeat[withinBeatSub]
          if (drumSel) {
             if (drumSel.kick) kick.triggerAttackRelease('C2', '8n', time)
           if (drumSel.snare) snare.triggerAttackRelease('8n', time)
           // Use NoiseSynth as a softer shaker instead of Metal hi-hat
           if (drumSel.hihatClosed) hiHat.triggerAttackRelease('16n', time, 0.4)
           if (drumSel.hihatOpen) hiHat.triggerAttackRelease('8n', time, 0.6)
             if (drumSel.cymbal) cymbal.triggerAttackRelease(300, '32n', time)
          }
       }
    } else {
        // Fallback if no rhythm track defined (legacy behavior or just starting up)
        // Actually, store initializes it to empty. Silence is correct if track is empty.
        // User can use "Default" preset to get sound back.
    }

    tick++
  }, subdivisionNote)

  loop.start(0)
  Tone.Transport.start()
  playing = true
}

export function stopPlayback() {
  if (!playing) return
  Tone.Transport.stop()
  loop?.stop()
  loop?.dispose()
  loop = null
  playing = false
}

export function isPlaying() {
  return playing
}

export function setVolumes(melodyVol: number, chordVol: number, bassVol: number, rhythmVol: number) {
  if (melodySynth) melodySynth.volume.value = melodyVol
  if (chordSynth) chordSynth.volume.value = chordVol
  if (bassSynth) bassSynth.volume.value = bassVol
  
  // Rhythm
  if (kick) kick.volume.value = rhythmVol
  if (snare) snare.volume.value = rhythmVol
  if (hiHat) hiHat.volume.value = rhythmVol
  if (cymbal) cymbal.volume.value = rhythmVol
}
export function setInstrumentPrograms(melodyProgram: number, bassProgram: number, rhythmProgram: number) {
  // Ensure instruments exist
  createInstruments()

  const melodyCfg = programToSynthConfig(melodyProgram, false)
  const bassCfg = programToSynthConfig(bassProgram, true)

  if (melodySynth) {
    melodySynth.oscillator.type = melodyCfg.oscillator
    melodySynth.envelope.attack = melodyCfg.attack
    melodySynth.envelope.decay = melodyCfg.decay
    melodySynth.envelope.sustain = melodyCfg.sustain
  }

  if (bassSynth) {
    bassSynth.oscillator.type = bassCfg.oscillator
    bassSynth.envelope.attack = bassCfg.attack
    bassSynth.envelope.decay = bassCfg.decay
    bassSynth.envelope.sustain = bassCfg.sustain
  }

  // Rhythm program is stored for potential MIDI/export usage; audio kit stays consistent.
}

export default { startPlayback, stopPlayback, isPlaying, setVolumes, setInstrumentPrograms }
