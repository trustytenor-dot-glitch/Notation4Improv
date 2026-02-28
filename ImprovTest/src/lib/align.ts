
// Utility to align melody notes to chord tones
// "Align to Chord" features

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Map flats to sharps
const FLAT_MAP: Record<string, string> = {
    'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#',
    'Cb': 'B', 'Fb': 'E'
};

/**
 * Parses a note string like "C4" or "F#3" into a semitone value (MIDI-like).
 * Middle C (C4) is 60.
 */
function getNoteValue(noteStr: string): number {
    // Regex to match Note Name + Octave. Ignore duration part if present.
    // e.g. "C4:4n" -> "C4", "F#3" -> "F#3"
    const match = noteStr.match(/^([A-G][#b]?)(\d+)/);
    if (!match) return -1;

    let noteName = match[1];
    if (noteName.length > 1 && noteName[1] === 'b') {
        noteName = FLAT_MAP[noteName] || noteName;
    }

    const octave = parseInt(match[2], 10);
    const noteIndex = NOTES.indexOf(noteName);

    if (noteIndex === -1) return -1;

    return (octave + 1) * 12 + noteIndex;
}

/**
 * Converts a semitone value back to a note string.
 */
function getValueToNote(value: number): string {
    const octave = Math.floor(value / 12) - 1;
    const noteIndex = value % 12;
    return `${NOTES[noteIndex]}${octave}`;
}

/**
 * Returns the chord tones (as 0-11 pitch classes) for a given chord name.
 * Handles Major, Minor, Diminished triads.
 * e.g. "C" -> [0, 4, 7] (C, E, G)
 * e.g. "Dm" -> [2, 5, 9] (D, F, A)
 */
function getChordPitchClasses(chordName: string): number[] {
    if (!chordName) return [];

    let root = '';
    let quality = '';

    // Simple parsing: known suffixes: m, dim, maj7, 7, etc.
    // For now, let's assume standard format from randomize.ts (C, Dm, Bdim)
    
    if (chordName.endsWith('dim')) {
        root = chordName.slice(0, -3);
        quality = 'dim';
    } else if (chordName.endsWith('m') && !chordName.endsWith('dim')) { // careful with orders
        root = chordName.slice(0, -1);
        quality = 'm';
    } else {
        root = chordName;
        quality = 'maj';
    }

    // Handle flats in root
    if (root.length > 1 && root[1] === 'b') {
        root = FLAT_MAP[root] || root;
    }

    const rootIndex = NOTES.indexOf(root);
    if (rootIndex === -1) return [];

    const tones = [rootIndex]; // Root

    if (quality === 'maj') {
        tones.push((rootIndex + 4) % 12); // Major 3rd
        tones.push((rootIndex + 7) % 12); // Perfect 5th
    } else if (quality === 'm') {
        tones.push((rootIndex + 3) % 12); // Minor 3rd
        tones.push((rootIndex + 7) % 12); // Perfect 5th
    } else if (quality === 'dim') {
        tones.push((rootIndex + 3) % 12); // Minor 3rd
        tones.push((rootIndex + 6) % 12); // Diminished 5th
    }

    return tones;
}

/**
 * Finds the nearest chord tone for a given note value.
 * If equidistant, prefers the lower tone.
 */
function getNearestChordTone(noteVal: number, chordPitchClasses: number[]): number {
    if (chordPitchClasses.length === 0) return noteVal;

    let closestVal = noteVal;
    let minDiff = Infinity;

    // Check notes in current octave, previous, and next to be safe
    // We generated pitch classes (0-11). We need to project them near the noteVal.
    const currentOctave = Math.floor(noteVal / 12);
    
    // Test octaves around the current note
    for (let oct = currentOctave - 1; oct <= currentOctave + 1; oct++) {
        for (const pc of chordPitchClasses) {
            const candidate = (oct + 1) * 12 + pc;
            const diff = Math.abs(candidate - noteVal);

            if (diff < minDiff) {
                minDiff = diff;
                closestVal = candidate;
            } else if (diff === minDiff) {
                // If equidistant, prefer the lower tone
                if (candidate < closestVal) {
                    closestVal = candidate;
                }
            }
        }
    }

    return closestVal;
}

/**
 * Main function to align melody to chords.
 * Returns a new melody array.
 */
export function alignMelodyToChord(
    melody: (string | null)[][][],
    chords: string[][],
    beatsPerMeasure: number,
    subdivisionsPerBeat: number,
    targetMeasure: number | 'all'
): (string | null)[][][] {
    
    // Deep copy melody to avoid mutating state directly
    const newMelody = melody.map(m => m.map(b => [...b]));

    const startMeasure = targetMeasure === 'all' ? 0 : targetMeasure;
    const endMeasure = targetMeasure === 'all' ? melody.length : targetMeasure + 1;

    for (let m = startMeasure; m < endMeasure; m++) {
        if (!newMelody[m]) continue;

        for (let b = 0; b < beatsPerMeasure; b++) {
            // Determine the chord for this beat. 
            // The store has chords[m][b] but randomize often sets chords per beat or measure?
            // Let's assume chords[m][b] is the source. If empty, maybe look back?
            // The current randomize implementation fills every beat.
            let chord = chords[m] ? chords[m][b] : null;

            // Fallback: if chord is empty string, look backwards in the measure
            if (!chord) {
                for(let bb = b-1; bb >= 0; bb--) {
                    if (chords[m][bb]) {
                        chord = chords[m][bb];
                        break;
                    }
                }
            }
            
            // If still no chord, maybe previous measure? (Simple version: skip)
            if (!chord) continue;

            const chordTones = getChordPitchClasses(chord);
            if (chordTones.length === 0) continue;

            for (let s = 0; s < subdivisionsPerBeat; s++) {
                const cell = newMelody[m][b][s];
                if (!cell) continue;

                // Parse cell: "Note:Duration"
                const [notePart, durationPart] = cell.split(':');
                if (!notePart) continue;

                const noteVal = getNoteValue(notePart);
                if (noteVal === -1) continue;

                // Check if already in chord tones
                const notePC = noteVal % 12;
                if (chordTones.includes(notePC)) {
                    // Already a chord tone
                    continue;
                }

                // Find nearest
                const newVal = getNearestChordTone(noteVal, chordTones);
                const newNoteName = getValueToNote(newVal);

                // Reconstruct cell
                newMelody[m][b][s] = `${newNoteName}:${durationPart || '4n'}`;
            }
        }
    }

    return newMelody;
}
