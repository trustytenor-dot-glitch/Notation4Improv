// Helpers for mapping pointer events to musical positions and basic pitch math

export function pointToMeasureBeat(svgRect: DOMRect, clientX: number, width: number, measureCount: number, beatsPerMeasure: number, margin = 12) {
  const x = clientX - svgRect.left
  const localX = x - margin
  const measureWidth = (width - margin * 2) / measureCount
  let measureIndex = Math.floor(localX / measureWidth)
  if (measureIndex < 0) measureIndex = 0
  if (measureIndex >= measureCount) measureIndex = measureCount - 1
  const withinMeasureX = localX - measureIndex * measureWidth
  let beatIndex = Math.floor((withinMeasureX / measureWidth) * beatsPerMeasure)
  if (beatIndex < 0) beatIndex = 0
  if (beatIndex >= beatsPerMeasure) beatIndex = beatsPerMeasure - 1
  return { measureIndex, beatIndex }
}

export function quantizeOffset(offset: number, resolution: number) {
  // offset is fractional position within measure [0..1]
  const steps = Math.max(1, Math.round(1 / resolution))
  const q = Math.round(offset * steps) / steps
  return q
}

const NOTE_NAME_TO_SEMITONE: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11
}

export function pitchNameToMidi(name: string): number | null {
  // Accepts like C4, C#4, Db3, Bb2
  const m = name.match(/^([A-Ga-g])([#b]?)(-?\d+)$/)
  if (!m) return null
  const letter = m[1].toUpperCase()
  const accidental = m[2]
  const octave = parseInt(m[3], 10)
  let semitone = NOTE_NAME_TO_SEMITONE[letter]
  if (accidental === '#') semitone += 1
  if (accidental === 'b') semitone -= 1
  const midi = (octave + 1) * 12 + (semitone % 12)
  return midi
}

export function midiToPitchName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1
  const note = midi % 12
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const name = names[(note + 12) % 12]
  return `${name}${octave}`
}

export function nudgePitch(pitch: string, semitones: number): string | null {
  const m = pitchNameToMidi(pitch)
  if (m === null) return null
  return midiToPitchName(m + semitones)
}

// Estimate staff line/pitch from Y coordinate — simple linear mapping for prototyping.
export function yToPitchApprox(y: number, staffTopY: number, staffHeight: number, topPitch = 'G5', bottomPitch = 'E3') {
  const topMidi = pitchNameToMidi(topPitch) ?? 79
  const bottomMidi = pitchNameToMidi(bottomPitch) ?? 64
  const t = Math.min(1, Math.max(0, (y - staffTopY) / staffHeight))
  const midi = Math.round(topMidi + t * (bottomMidi - topMidi))
  return midiToPitchName(midi)
}

export default {
  pointToMeasureBeat,
  quantizeOffset,
  pitchNameToMidi,
  midiToPitchName,
  nudgePitch,
  yToPitchApprox
}
