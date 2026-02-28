
const SHARPS = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b']
const FLATS  = ['c', 'db', 'd', 'eb', 'e', 'f', 'gb', 'g', 'ab', 'a', 'bb', 'b']

// Key Signature Definitions (Affected notes)
export const KEY_SIGNATURE_NOTES: Record<string, string[]> = {
    'C': [],
    'G': ['f#'],
    'D': ['f#', 'c#'],
    'A': ['f#', 'c#', 'g#'],
    'E': ['f#', 'c#', 'g#', 'd#'],
    'B': ['f#', 'c#', 'g#', 'd#', 'a#'],
    'F': ['bb'],
    'Bb': ['bb', 'eb'],
    'Eb': ['bb', 'eb', 'ab'],
    'Ab': ['bb', 'eb', 'ab', 'db'],
    'Db': ['bb', 'eb', 'ab', 'db', 'gb']
}

export function applyKeySignature(note: string, key: string): string {
    // note format ex: "b/4" (natural assumed if no accidental)
    if (!KEY_SIGNATURE_NOTES[key]) return note
    
    const parts = note.split('/')
    if (parts.length < 2) return note

    // Base pitch (e.g. "b" from "b/4")
    const basePitch = parts[0].toLowerCase()
    
    // Check if we are supposed to be sharp/flat
    // Iterate over affected notes in this key
    for (const affected of KEY_SIGNATURE_NOTES[key]) {
        // affected is like "f#" or "bb"
        // Check if our note matches the letter
        if (affected.startsWith(basePitch.charAt(0))) {
            return `${affected}/${parts[1]}`
        }
    }
    
    return note
}

export function transposeNote(note: string, semitones: number): string {
    // Format: "c/4", "f#/5", "bb/3"
    
    // Normalize casing
    const lower = note.toLowerCase()
    const parts = lower.split('/')
    if (parts.length !== 2) return note // Invalid format
    
    let pitch = parts[0]
    let octave = parseInt(parts[1], 10)
    
    // Normalize flats to sharps for calculation (using index in SHARPS)
    // Map flats to sharp equivalents just for finding index
    const flatMap: Record<string, string> = {
        'db': 'c#', 'eb': 'd#', 'gb': 'f#', 'ab': 'g#', 'bb': 'a#'
    }
    const searchPitch = flatMap[pitch] || pitch
    
    let index = SHARPS.indexOf(searchPitch)
    if (index === -1) return note
    
    // Add semitones
    let newIndex = index + semitones
    
    // Handle octave wrap
    const octaveShift = Math.floor(newIndex / 12)
    newIndex = ((newIndex % 12) + 12) % 12 // Positive modulo
    
    octave += octaveShift
    
    // Output preference: Sharps for up, Flats for down?
    // Or stick to source preference? If source was flat, keep flat?
    // User wants B -> Bb (down). Source was B (neutral).
    // If I use FLATS array for output when semitones < 0:
    // B (11) -> Bb (10 in FLATS). Correct.
    // Bb (10) -> A (9). Correct.
    // A (9) -> Ab (8). Correct.
    
    // If I use SHARPS array for output when semitones > 0:
    // C (0) -> C# (1). Correct.
    // C# (1) -> D (2). Correct.
    
    // What if semitones = 0? (No-op)
    
    const scale = semitones < 0 ? FLATS : SHARPS
    return `${scale[newIndex]}/${octave}`
}

export function getVexFlowDuration(d: string): string {
    const base = d.replace(/\.+$/, '')
    if (base === '1n') return 'w'
    if (base === '2n') return 'h'
    if (base === '4n') return 'q'
    if (base === '8n') return '8'
    return '16'
}

export function getDurationTicks(vfDur: string, dots: number = 0): number {
    let ticks = 0
    if (vfDur === 'w') ticks = 16
    else if (vfDur === 'h') ticks = 8
    else if (vfDur === 'q') ticks = 4
    else if (vfDur === '8') ticks = 2
    else ticks = 1
    
    if (dots === 1) ticks += ticks / 2
    if (dots === 2) ticks += (ticks / 2) + (ticks / 4)
    return ticks
}
