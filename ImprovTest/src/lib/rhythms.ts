import { DrumSelection, RhythmTrack, makeEmptyRhythm } from '../state/store'

export type RhythmPattern = 'rock' | 'disco' | 'bossa' | 'clave' | 'waltz' | 'jazz-swing' | 'clear'

export const RHYTHM_LABELS: Record<RhythmPattern, string> = {
  'clear': 'None',
  'rock': 'Rock Beat',
  'disco': 'Disco / House',
  'bossa': 'Bossa Nova',
  'clave': 'Son Clave (3-2)',
  'waltz': 'Waltz (3/4)',
  'jazz-swing': 'Jazz Swing'
}

export function generateRhythm(pattern: RhythmPattern, measureCount: number, beatsPerMeasure: number, subdivisions = 4): RhythmTrack {
  const track = makeEmptyRhythm(measureCount, beatsPerMeasure, subdivisions)
  if (pattern === 'clear') return track

  for (let m = 0; m < measureCount; m++) {
    for (let b = 0; b < beatsPerMeasure; b++) {
      for (let s = 0; s < subdivisions; s++) {
        const tick = b * subdivisions + s // 0 to 15 for 4/4 with 16ths
        
        let drum: Partial<DrumSelection> = {}

        if (pattern === 'rock') {
           // Kick on 1 and 3 (beats 0 and 2)
           if (b === 0 && s === 0) drum.kick = true
           if (b === 2 && s === 0) drum.kick = true
           
           // Snare on 2 and 4 (beats 1 and 3)
           if (b === 1 && s === 0) drum.snare = true
           if (b === 3 && s === 0) drum.snare = true

           // Hat on 8ths (s=0, s=2 in 16th grid)
           if (s === 0 || s === 2) drum.hihatClosed = true
        }

        else if (pattern === 'disco') {
           // Four on the floor
           if (s === 0) drum.kick = true // Every beat
           
           // Snare on 2 and 4
           if ((b === 1 || b === 3) && s === 0) drum.snare = true

           // Open hat on offbeats (&) -> s=2
           if (s === 2) drum.hihatOpen = true
           // Closed hat on beats? optional.
           if (s === 0) drum.hihatClosed = true
        }

        else if (pattern === 'bossa') {
           // Bossa Nova key pattern (1 measure loop simplified)
           // Kick: 1, 2&, 3, 4& (dotted quarter + eighth feel)
           // In 16ths: 0, (4+2)=6, 8, (12+2)=14 ? 
           // Standard: 1, (a of 1), 2&, (a of 2)... wait.
           // Bossa Kick often: 1 . . . | . . 2& . | 3 . . . | . . 4& .
           // Indices: 0, 6, 8, 14. (if 16ths)
           const t = tick % 16
           if (t === 0 || t === 6 || t === 8 || t === 14) drum.kick = true

           // Clave (Rim/Snare): 3-2 Son Clave approx or Bossa Clave
           // Standard Bossa Clave: 1, 2&, 3&, 4
           // Indices: 0, 6, 10, 12?
           // Let's use:
           if (t === 0 || t === 6 || t === 10 || t === 12) drum.snare = true // Rim click feel
           
           // Shaker/Hat: Continuous 8ths or 16ths
           if (s === 0 || s === 2) drum.hihatClosed = true
        }


        else if (pattern === 'clave') {
           // Son Clave 3-2 (Spread across 2 measures)
           // Side 1 (3 notes): 1, 2&, 4 (in measure 1)
           // Side 2 (2 notes): 2, 3 (in measure 2)
           
           // We need to know if we are in an even or odd measure to make the 2-bar pattern work.
           // m (measure index) is 0-based.
           // Measure 1 (m=0, even): 3-side
           // Measure 2 (m=1, odd): 2-side
           
           const isThreeSide = (m % 2 === 0)
           
           if (isThreeSide) {
             // 3-side: Hits on 1 (beat 0), 2& (beat 1.5 -> tick 6), 4 (beat 3)
             // Tick indices (0-15): 
             // Beat 0: 0
             // Beat 1: 4 (+2=6) -> Tick 6
             // Beat 2: 8 ... Wait. standard is 1, 2&, 4.
             // 1 (tick 0)
             // 2& (tick 4 + 2 = 6)
             // 4 (tick 12)
             if (b === 0 && s === 0) { drum.kick = true; drum.snare = true; } // 1
             if (b === 1 && s === 2) { drum.kick = true; drum.snare = true; } // 2&
             if (b === 3 && s === 0) { drum.kick = true; drum.snare = true; } // 4
           } else {
             // 2-side: Hits on 2, 3
             // Beat 0: -
             // Beat 1: Hit (tick 4)
             // Beat 2: Hit (tick 8)
             // Beat 3: -
             if (b === 1 && s === 0) { drum.kick = true; drum.snare = true; } // 2
             if (b === 2 && s === 0) { drum.kick = true; drum.snare = true; } // 3
           }

           // Constant pulse on HiHat?
           if (s === 0) drum.hihatClosed = true 
        }

        else if (pattern === 'waltz') {
           // 3/4 time usually. If 4/4, this will sound weird but strict waltz is 1, 2, 3.
           if (beatsPerMeasure === 3) {
               if (b === 0 && s === 0) drum.kick = true
               if ((b === 1 || b === 2) && s === 0) drum.snare = true
               if (s === 0 || s === 2) drum.hihatClosed = true
           } else {
               // Fake waltz in 4/4? Ternary feel?
               // Just do simple Kick Snare Snare Rest?
               // 1 2 3 4
               if (b === 0) drum.kick = true
               if (b === 1 || b === 2) drum.snare = true
               if (b === 3) drum.hihatClosed = true 
           }
        }

        else if (pattern === 'jazz-swing') {
           // Spang-a-lang pattern on Ride (Cymbal)
           // 1, 2, 2a, 3, 4, 4a
           // Triplets needed? We have 16ths.
           // Approx swing with 16ths: 1 (0), 2 (4), 2a (7..wait 6/8/12?), 3 (8), 4 (12)
           // close enough: 0, 4, 7(shuffle), 8, 12, 15?
           // Let's place Ride on: 0, 4, 7, 8, 12, 15 (using idx 3 for swing feel?)
           // Standard 16th swing: 0, 1, 2, 3. Swing 8ths: 0, 3.
           // Ride: 0, 3, 4, 7, 8, 11, 12, 15 ? 
           // Ride Pattern: 1, 2 a, 3, 4 a
           // Beats: 0, 1, 2, 3.
           // 0: Ding (s=0)
           // 1: Ding-a (s=0, s=3??) -> let's use s=0, s=3 for shuffle feel
           if (s === 0) drum.cymbal = true
           if ((b === 1 || b === 3) && s === 3) drum.cymbal = true // the "a" of 2 and 4
           
           // HiHat Foot on 2 and 4
           if ((b === 1 || b === 3) && s === 0) drum.hihatClosed = true
           // Feather kick
           if (s === 0) drum.kick = true // optional
        }

        // Apply drum to track
        track[m][b][s] = { ...track[m][b][s], ...drum }
      }
    }
  }
  return track
}
