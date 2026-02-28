// Scale definitions for note mapping (treble and bass staves)
// Notes are ordered from high to low to match visual y-positions on the staff.

export const TREBLE_SCALE = [
    'b/5', 'a/5', 'g/5', 'f/5', 'e/5', 'd/5', 'c/5', 
    'b/4', 'a/4', 'g/4', 'f/4', 'e/4', 'd/4', 'c/4', 
    'b/3', 'a/3', 'g/3', 'f/3', 'e/3', 'd/3'
]

export const BASS_SCALE = [
    'd/4', 'c/4', 'b/3', 'a/3', 'g/3', 'f/3', 'e/3', 
    'd/3', 'c/3', 'b/2', 'a/2', 'g/2', 'f/2', 'e/2', 
    'd/2', 'c/2', 'b/1', 'a/1', 'g/1'
]

// Diatonic scales for chord generation
export const DIATONIC_MAJOR = {
  C: ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim'],
  G: ['G', 'Am', 'Bm', 'C', 'D', 'Em', 'F#dim'],
  D: ['D', 'Em', 'F#m', 'G', 'A', 'Bm', 'C#dim']
}

// Full chromatic chord lists for the UI dropdown
export const CHORD_ROWS = {
  top: ['Abm', 'Am', 'A#m', 'Bbm', 'Bm', 'Cm', 'C#m', 'Dbm', 'Dm', 'D#m', 'Ebm', 'Em', 'Fm', 'F#m', 'Gbm', 'Gm', 'G#m'],
  bottom: ['Ab', 'A', 'A#', 'Bb', 'B', 'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#']
}
