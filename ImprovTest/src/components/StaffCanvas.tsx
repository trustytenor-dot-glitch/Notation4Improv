import React, { useEffect, useRef, useState } from 'react'
import { Renderer, Stave, StaveNote, Voice, Formatter, Beam, StaveTie, Dot, Fraction, Accidental } from 'vexflow'
import useStore from '../state/store'
import AudioPlayer from '../lib/audio' 
import { TREBLE_SCALE, BASS_SCALE } from '../lib/constants'
import { applyKeySignature, KEY_SIGNATURE_NOTES, getVexFlowDuration, getDurationTicks } from '../lib/musicHelpers'

type Props = {
  width?: number
  height?: number
  measureCount?: number
  beatsPerMeasure?: number
  subdivisionsPerBeat?: number
  chords?: string[][]
  onChordClick?: (measureIndex: number, beatIndex: number, clientX: number, clientY: number) => void
    onTrebleClefClick?: (clientX: number, clientY: number) => void
    onBassClefClick?: (clientX: number, clientY: number) => void
}

export default function StaffCanvas({
  width = window.innerWidth - 40,
  height = 500,
  measureCount = 4,
  beatsPerMeasure = 4,
  subdivisionsPerBeat = 4,
  chords,
    onChordClick,
    onTrebleClefClick,
    onBassClefClick
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const currentKey = useStore(s => s.key)
  const melody = useStore(s => s.melody)
  const bass = useStore(s => s.bass)
  const rhythmTrack = useStore(s => s.rhythmTrack)
  const showRhythmTrack = useStore(s => s.showRhythmTrack)
  const setMelodyNote = useStore(s => s.setMelodyNote)
  const setBassNote = useStore(s => s.setBassNote)
    const setRhythmNote = useStore(s => s.setRhythmNote)
  const syncChordToBass = useStore(s => s.syncChordToBass)
  const setSyncChordToBass = useStore(s => s.setSyncChordToBass)
  const setMelodyNoteAndClear = useStore(s => s.setMelodyNoteAndClear)
  const setBassNoteAndClear = useStore(s => s.setBassNoteAndClear)
  const selectedDuration = useStore(s => s.selectedNoteDuration)
  const selectedNote = useStore(s => s.selectedNote)
  const setSelectedNote = useStore(s => s.setSelectedNote)
  const transposeSelection = useStore(s => s.transposeSelection)

  // NOTE: We do NOT subscribe to volumes here to avoid re-rendering the canvas during slider drag.
  // Instead, we read current volumes from store transiently (via getState or passed refs) inside event handlers if needed.
  // Visual updates of sliders are handled manually via DOM manipulation during drag.
  // Initial render of sliders reads from store via getState() or similar non-subscription method.
  
  useEffect(() => {
    if (!containerRef.current) return
    containerRef.current.innerHTML = ''

    const renderer = new Renderer(containerRef.current, Renderer.Backends.SVG)
    renderer.resize(width, height)
    const ctx = renderer.getContext()

    // Calculate measure width
    const startX = 10
    const startY = 40
    const chordBandHeight = 30
    const totalAvailableWidth = width - 20
    
    // Estimate extra width for Key Signature in Measure 1
    // Each accidental is approx 12-15px width.
    const keySigNotes = (currentKey && KEY_SIGNATURE_NOTES[currentKey]) ? KEY_SIGNATURE_NOTES[currentKey] : []
    const keySigCount = keySigNotes.length
    
    // Base 60px covers Clef + Time Sig. Add ~15px per accidental if any.
    // If key is C (0 accidentals), extra is 60.
    // If key is Db (5 flats), extra is 60 + (5 * 12) = 120.
    const keyScaleFactor = 12
    const keySigWidth = keySigCount * keyScaleFactor
    
    // We want the measures to be proportional to how much "stuff" is in them?
    // Or do we want equitable musical space?
    // We want equitable musical space.
    // Total Width = (MeasureCount * MusicalWidth) + NonMusicalWidth_M1
    // MusicalWidth = (TotalWidth - NonMusicalWidth_M1) / MeasureCount
    
    const m1Extra = 70 + keySigWidth
    const standardStaveWidth = Math.max(10, (totalAvailableWidth - m1Extra) / measureCount)
    
    // Group references for SVG interaction layer
    const measureLayouts: { noteStartX: number; noteWidth: number; startX: number; endX: number; tickX: number[] }[] = []
    
    // Track ties across measures
    let lastTrebleNote: StaveNote | null = null
    let lastBassNote: StaveNote | null = null

    let currentX = startX
    for (let m = 0; m < measureCount; m++) {
      const staveWidth = (m === 0) ? standardStaveWidth + m1Extra : standardStaveWidth
      const x = currentX
      currentX += staveWidth
      
      // 1. Treble Stave (Melody)
      const trebleStave = new Stave(x, startY + chordBandHeight, staveWidth)
      if (m === 0) {
        trebleStave.addClef('treble').addTimeSignature(`${beatsPerMeasure}/4`)
        if (currentKey) trebleStave.addKeySignature(currentKey)
      }
      trebleStave.setContext(ctx).draw()

      // 2. Bass Stave
      const bassStave = new Stave(x, startY + chordBandHeight + 100, staveWidth)
      if (m === 0) {
        bassStave.addClef('bass').addTimeSignature(`${beatsPerMeasure}/4`)
        if (currentKey) bassStave.addKeySignature(currentKey)
      }
      bassStave.setContext(ctx).draw()

      // 3. Rhythm Stave (Percussion)
      let rhythmStave: Stave | null = null
      if (showRhythmTrack) {
          // Ensure enough space. If width/height constrained, it might be clipped.
          rhythmStave = new Stave(x, startY + chordBandHeight + 200, staveWidth)
          if (m === 0) rhythmStave.addClef('percussion').addTimeSignature(`${beatsPerMeasure}/4`)
          
          // Debug Stave drawing
          // rhythmStave.setContext(ctx).draw() 
          
          // Explicitly set style to ensure visibility against background?
          // Default is black. Background is white. Should be fine.
          rhythmStave.setContext(ctx).draw()
      }

      // Helper: Create Rhythm Voice
      const createRhythmVoice = (measureNotes: any[][], stave: Stave): { voice: Voice; notes: StaveNote[] } | null => {
          if (!measureNotes) return null
          const notes: StaveNote[] = []
          
          // Internal rhythm resolution is always 16th-notes (4 per beat)
          // even if the visible grid is quarter/eighth. This keeps the
          // VexFlow voice at a consistent 4/4 = 16 sixteenth-note ticks.
          const subdivisions = 4
          const totalTicks = beatsPerMeasure * subdivisions

          // Flatten the measure into a linear array of events (or null)
          const flatTrack: any[] = []
          for (let b = 0; b < beatsPerMeasure; b++) {
              const beat = measureNotes[b] || []
              for (let s = 0; s < subdivisions; s++) {
                  flatTrack.push(beat[s])
              }
          }

          // Render loop with lookahead for duration optimization
          let t = 0
          while (t < totalTicks) {
              const drum = flatTrack[t]
              
              // Define keys for current tick
              const keys: string[] = []
              if (drum) {
                  if (drum.kick) keys.push('f/4')      
                  if (drum.snare) keys.push('c/5')     
                  if (drum.hihatClosed) keys.push('g/5/x') 
                  if (drum.hihatOpen) keys.push('a/5/x')   
                  if (drum.cymbal) keys.push('f/5/x')  
              }

              // Determine max possible duration from here until next event or end of beat/measure
              // We prefer durations: 4 (quarter), 2 (eighth), 1 (16th).
              // We generally don't want to cross beat boundaries with a single note unless it's a syncopation tie,
              // but for simple drum reading, keeping within the beat is safer for now.
              // Let's find the distance to the next event.
              
              // Check how much space until next event
              let space = 1
              for(let i = t + 1; i < totalTicks; i++) {
                  const d = flatTrack[i]
                  const hasHit = d && (d.kick || d.snare || d.hihatClosed || d.hihatOpen || d.cymbal)
                  if (hasHit) break
                  space++
              }

              let bestTicks = 1
              let durationType = '16'
              
              // Find max duration (power of 2) that fits in space and aligns to grid
              if (space >= 4 && (t % 4 === 0)) {
                  bestTicks = 4
                  durationType = 'q'
              } else if (space >= 2 && (t % 2 === 0)) {
                  bestTicks = 2
                  durationType = '8'
              } else {
                  bestTicks = 1
                  durationType = '16'
              }

              // Create Note or Rest
              if (keys.length > 0) {
                  const note = new StaveNote({
                      keys: keys,
                      duration: durationType,
                      clef: 'percussion'
                  })
                   // @ts-ignore
                  note.tickStart = t
                  notes.push(note)
              } else {
                  const rest = new StaveNote({
                      keys: ['b/4'],
                      duration: durationType + 'r', // e.g. "qr", "8r", "16r"
                      clef: 'percussion'
                  })
                   // @ts-ignore
                  rest.tickStart = t
                  notes.push(rest)
              }

              // Update t
              t += bestTicks
          }
          
          if (notes.length === 0) return null
  
          const voice = new Voice({ num_beats: beatsPerMeasure, beat_value: 4 })
          // Soft mode? No.
          // VexFlow might complain if ticks don't sum up perfectly in complex signatures, 
          // but our logic (greedy alignment) should sum to exactly 16 ticks for 4/4.
          voice.addTickables(notes)
          return { voice, notes }
        }

      // Helper: Create Voice from Track
      // Returns notes array for later manual alignment
      const createVoice = (
        track: (string | null)[][], 
        clef: 'treble' | 'bass', 
        stave: Stave
      ): { voice: Voice; notes: StaveNote[] } | null => {
        if (!track) return null

        const notes: StaveNote[] = []

        // Determine how many grid slots exist per beat in this track.
        // We then map those slots onto a fixed 16th-note timeline (4 slots per beat).
        const slotsPerBeat = track[0] && track[0][0] ? track[0].length : (track[0] ? track[0].length : 4)
        const safeSlotsPerBeat = slotsPerBeat || 4
        const slotSize = 4 / safeSlotsPerBeat // 16th-note ticks per slot (1, 2, or 4)
        const totalTicks = beatsPerMeasure * 4

        // Precompute events on the 16th-note grid
        const events = new Map<number, string>()
        track.forEach((beat, beatIndex) => {
             beat.forEach((sub, subIndex) => {
                 if (!sub) return
                 const tick = beatIndex * 4 + Math.round(subIndex * slotSize)
                 if (tick >= 0 && tick < totalTicks) {
                     events.set(tick, sub)
                 }
             })
        })

           // Walk the measure in 16th-note ticks, filling with either notes or grouped rests
           let t = 0
           while (t < totalTicks) {
               const sub = events.get(t)
               if (sub) {
                 const parts = sub.split(':')
                 const pitch = parts[0]
                 const durStr = parts[1] || '16n'
                 const isTied = parts.includes('tie')
                 const vfDur = getVexFlowDuration(durStr)
                 const dots = (durStr.match(/\./g) || []).length
                 const key = pitch.includes('/') 
                     ? pitch.toLowerCase() 
                     : pitch.replace(/(\D)(\d+)/, '$1/$2').toLowerCase()

                 try {
                        const note = new StaveNote({ keys: [key], duration: vfDur + (dots > 0 ? 'd'.repeat(dots) : ''), clef: clef })

                        // Match standard VexFlow keys: note[accidental]/octave (e.g., "c/4", "fb/5", "c#/4")
                        // Note: Only capture explicit accidentals
                        const accMatch = key.match(/^[a-g]([#b]+)\/\d+$/)
                        if (accMatch) {
                            note.addModifier(new Accidental(accMatch[1]), 0)
                        }

                        if (dots > 0) note.addModifier(new Dot(), 0)
                        if (dots > 1) note.addModifier(new Dot(), 0)

                    // @ts-ignore
                    note.tickStart = t
                    if (isTied) {
                        // @ts-ignore
                        note.isTied = true
                    }
                    notes.push(note)

                    let durSlots = getDurationTicks(vfDur, dots)
                    if (t + durSlots > totalTicks) {
                        durSlots = totalTicks - t
                    }
                    t += Math.max(durSlots, 1)
                 } catch (e) {
                    const restKey = clef === 'treble' ? "b/4" : "d/3"
                    const note = new StaveNote({ keys: [restKey], duration: "16r", clef: clef })
                    // @ts-ignore
                    note.tickStart = t
                    notes.push(note)
                    t += 1
                 }
             } else {
                 // Group consecutive empty ticks into the longest appropriate rest
                 let run = 0
                 while (t + run < totalTicks && !events.has(t + run)) {
                     run++
                 }

                 let restDuration = "16r"
                 let restSlots = 1

                 // Prefer quarter rests starting on beat boundaries
                 if ((t % 4 === 0) && run >= 4) {
                     restDuration = "qr"
                     restSlots = 4
                 // Otherwise try eighth rests on 8th-note boundaries
                 } else if ((t % 2 === 0) && run >= 2) {
                     restDuration = "8r"
                     restSlots = 2
                 }

                 const restKey = clef === 'treble' ? "b/4" : "d/3"
                 const note = new StaveNote({ keys: [restKey], duration: restDuration, clef: clef })
                 // @ts-ignore
                 note.tickStart = t
                 notes.push(note)
                 t += restSlots
             }
        }

        if (notes.length === 0) return null
        const voice = new Voice({ num_beats: beatsPerMeasure, beat_value: 4 })
        voice.addTickables(notes)
        return { voice, notes }
      }

      // Instantiate Voices
      const trebleData = (melody && melody[m]) ? createVoice(melody[m], 'treble', trebleStave) : null
      const bassData = (bass && bass[m]) ? createVoice(bass[m], 'bass', bassStave) : null

      // Debug check for rhythm
      // console.log('Measure', m, 'Show:', showRhythmTrack, 'Stave:', !!rhythmStave, 'Track:', !!(rhythmTrack && rhythmTrack[m]))

      const rhythmData = (showRhythmTrack && rhythmTrack && rhythmTrack[m] && rhythmStave) 
        ? createRhythmVoice(rhythmTrack[m], rhythmStave) 
        : null

      // STRICT LINEAR GRID CALCULATION
      const noteStartX = trebleStave.getNoteStartX()
      const noteEndX = trebleStave.getNoteEndX() 
      const noteWidth = noteEndX - noteStartX
      const totalTicks = beatsPerMeasure * subdivisionsPerBeat
      
      // Calculate tickX array for Grid (Independent of notes)
      const tickX: number[] = []
      // We divide the AVAILABLE note width by ticks.
      // Tick 0 is at noteStartX.
      // Tick 1 is at noteStartX + step.
      const tickStep = noteWidth / totalTicks
      
      for(let t=0; t<=totalTicks; t++) {
        tickX.push(noteStartX + t * tickStep)
      }

      // Formatting & Manual Alignment
      const voicesToFormat = []
      if (trebleData) voicesToFormat.push(trebleData.voice)
      if (bassData) voicesToFormat.push(bassData.voice)
      // Do NOT include rhythmData in the main formatter if we want independent positioning
      // or at least handle it carefully.
      // If we join them, they share TickContexts.
      // If we want to shift the Rhythm Stave's notes INDEPENDENTLY of the grid (because the clef is different),
      // we shouldn't let VexFlow lock them together in the same TickContexts, 
      // OR we need to use a StaveModifier or offset that is specific to the Note, not the TickContext.
      // Actually, StaveNote has setXShift / setX ?
      
      // Let's try formatting rhythm separately to decouple TickContexts
      if (rhythmData && rhythmStave) {
           const rFormatter = new Formatter()
           rFormatter.joinVoices([rhythmData.voice])
           try {
              rFormatter.format([rhythmData.voice], noteWidth)
           } catch(e) { console.warn(e) }
      }

      if (voicesToFormat.length > 0) {
          // Standard VexFlow Format to set Y positions, beams, etc.
          const formatter = new Formatter()
          voicesToFormat.forEach(v => formatter.joinVoices([v]))
          try {
             formatter.format(voicesToFormat, noteWidth)
          } catch(e) {
             console.warn(e)
          }

          // OVERRIDE X positions for STRICT LINEARITY
          // Define constant scaling for notes regardless of grid display
          const pixelsPer16th = noteWidth / (beatsPerMeasure * 4)

          const applyLinearX = (data: {  voice: Voice; notes: StaveNote[] }, currentStave: Stave) => {
              // Calculate alignment offset relative to the Treble Stave (which defines the grid)
              // If currentStave starts earlier (e.g. narrow percussion clef), we need to shift notes RIGHT (positive offset)
              // If currentStave starts later (e.g. wide fancy clef), we need to shift notes LEFT (negative offset)
              const alignOffset = noteStartX - currentStave.getNoteStartX()

              data.notes.forEach(note => {
                  // @ts-ignore
                  const t = note.tickStart
                  if (typeof t === 'number') {
                      
                      // Using TickContext is safer for alignment across staves
                      const tc = note.getTickContext()
                      if (tc) {
                          // Standardize position relative to the GRID (trebleStave)
                          // User requested 7px offset to the left for better alignment generally
                          let relativeX = (t * pixelsPer16th) - 7
                          
                          // Apply correction for stave start difference (only if this is the rhythm stave on measure 0 usually)
                          relativeX += alignOffset

                          // Additional nudging based on user feedback (specifically for rhythm track)
                          // The user says it is still to the left by at least 7 pixels.
                          // If currentStave is rhythmStave, add extra padding.
                          // if (currentStave === rhythmStave && m === 0) {
                          //    relativeX += 20 
                          // }

                          // If this TickContext is shared (becasue notes align with Treble/Bass), setX moves ALL of them.
                          // We only want to move THIS note if it's rhythm.
                          // But wait, we separated rhythmData from 'voicesToFormat' above!
                          // So rhythm notes now have their OWN TickContexts, independent of Treble/Bass.
                          // So setting X here is safe and specific to rhythm.
                          // UNLESS the formatter logic above accidentally linked them? No, separate format calls.
                          
                          tc.setX(relativeX)
                          tc.setPadding(0)
                      }
                  }
              })
          }

          if (rhythmData && rhythmStave) applyLinearX(rhythmData, rhythmStave)
          if (trebleData) applyLinearX(trebleData, trebleStave)
          if (bassData) applyLinearX(bassData, bassStave)
          
          if (rhythmData) {
              const beams = Beam.generateBeams(rhythmData.notes)
              rhythmData.voice.draw(ctx, rhythmStave!)
              beams.forEach(b => b.setContext(ctx).draw())
          }

          if(trebleData) {
              // Generate beams BEFORE drawing notes so notes know to hide flags
              const beams = Beam.generateBeams(trebleData.notes)
              trebleData.voice.draw(ctx, trebleStave)
              beams.forEach(b => b.setContext(ctx).draw())

              // Handle Cross-Measure Ties
              if (lastTrebleNote) {
                  // Find the first note of this measure (skip rests if desired, but typically tie goes to first event)
                  // Actually, tie should go to the first NOTE, unless it's a rest which breaks the tie.
                  const firstNote = trebleData.notes.find(n => !n.isRest())
                  // Also check if firstNote is at tick 0? Yes.
                  // @ts-ignore.
                  if (firstNote && firstNote.tickStart === 0) {
                      const tie = new StaveTie({ first_note: lastTrebleNote, last_note: firstNote })
                      tie.setContext(ctx).draw()
                  }
                  lastTrebleNote = null
              }

              // Check if the last note of THIS measure is tied
              const lastNote = trebleData.notes[trebleData.notes.length - 1]
              // @ts-ignore
              if (lastNote && !lastNote.isRest() && lastNote.isTied) {
                  lastTrebleNote = lastNote
              } else {
                  lastTrebleNote = null
              }
          } else {
              lastTrebleNote = null
          }

          if(bassData) {
              const beams = Beam.generateBeams(bassData.notes)
              bassData.voice.draw(ctx, bassStave)
              beams.forEach(b => b.setContext(ctx).draw())
              
               // Handle Cross-Measure Ties
              if (lastBassNote) {
                  const firstNote = bassData.notes.find(n => !n.isRest())
                  // @ts-ignore.
                  if (firstNote && firstNote.tickStart === 0) {
                      const tie = new StaveTie({ first_note: lastBassNote, last_note: firstNote })
                      tie.setContext(ctx).draw()
                  }
                  lastBassNote = null
              }

              // Check if the last note of THIS measure is tied
              const lastNote = bassData.notes[bassData.notes.length - 1]
              // @ts-ignore
              if (lastNote && !lastNote.isRest() && lastNote.isTied) {
                  lastBassNote = lastNote
              } else {
                  lastBassNote = null
              }
          } else {
              lastBassNote = null
          }
      }

      measureLayouts.push({
          noteStartX,
          noteWidth,
          startX: x,
          endX: x + staveWidth,
          tickX
      })
    }

    // Interaction Layer (Chord Band & Click Area)
    const svg = containerRef.current.querySelector('svg')
    if (svg) {
       // Draw Chord Band Background
       // Need to account for the actual note start X for alignment if we want it perfect,
       // but typically the chord band spans the whole measure including clef area?
       // The user complains about misalignment. 
       // "Is this tied to the fact that the chord track above is not aligned with the notes to the right of the clef"
       // Yes. The chord track should probably align with the NOTES, not the measure box.
       // However, chords are usually valid for the whole measure.
       // BUT, the visual "cells" in the chord track (if they existed) or the text placement might be off.
       
       // Actually, the user says "the rest in the first measure appear to be progressively displaced".
       // This implies VexFlow's layout is squeezing things because of the clef, but our Grid is linear.
       // VexFlow's formatter is NOT linear by default! It spaces based on note density.
       // We forced it to be linear by not adding other voices? No, we used `new Formatter().joinVoices([voice]).format([voice], staveWidth)`.
       // This format call tries to space notes "nicely", not "linearly"
       
       // To force linear timing (where x is proportional to time), we need to tell VexFlow.
       // OR, simpler: We can ask VexFlow where the notes are?
       // But we want to CLICK based on a linear grid (because the user thinks in a grid).
       // So we should force VexFlow to be linear IF possible.
       // Or, we render "Ghost Notes" for every 16th beat to force spacing.
       // This is the robust way to ensure linear spacing in VexFlow.
       
       const bandY = startY
       
       // Change: Background starts at the first note of the first measure (after clef)
       // This prevents the yellow band from covering the clef area.
       const bgStartX = measureLayouts[0]?.noteStartX || startX
       const bgWidth = (width - 10) - bgStartX // Right edge is approximately width - 10
       
       // Render Permanent Chords (Always Visible)
       for (let m = 0; m < measureCount; m++) {
           const layout = measureLayouts[m]
           if (!layout) continue
           
           if (chords && chords[m]) {
               const ticks = layout.tickX || []
               for (let b = 0; b < beatsPerMeasure; b++) {
                   const chord = chords[m][b]
                   const tickIndex = b * subdivisionsPerBeat
                   // Only draw if we have a chord defined (not empty string)
                   // The '+' placeholder will be drawn in the grid overlay instead
                   if (ticks.length > tickIndex && chord) {
                       const tx = ticks[tickIndex]
                       const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
                       text.setAttribute('x', String(tx + 2))
                       text.setAttribute('y', String(startY + chordBandHeight / 2 + 5))
                       text.setAttribute('font-family', 'sans-serif')
                       text.setAttribute('font-size', '14')
                       text.setAttribute('fill', '#000')
                       text.setAttribute('font-weight', 'bold')
                       text.style.pointerEvents = 'none'
                       text.textContent = chord
                       svg.appendChild(text)
                   }
               }
           }
       }

           // Keyboard Listener: pitch shift, navigation, and delete
           const handleKeyDown = (e: KeyboardEvent) => {
               if (!selectedNote) return

               const { m, b, s, staff } = selectedNote
               const track = staff === 'treble' ? melody : bass

               // Delete selected note
               if (e.key === 'Backspace' || e.key === 'Delete') {
                   e.preventDefault()
                   if (staff === 'treble') {
                       setMelodyNote(m, b, s, null)
                   } else {
                       setBassNote(m, b, s, null)
                   }
                   setSelectedNote(null)
                   return
               }

               // Horizontal navigation: move selection to previous/next note
               if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                   e.preventDefault()
                   const direction = e.key === 'ArrowRight' ? 1 : -1

                   let cm = m, cb = b, cs = s
                   let steps = 0
                   while (steps < 200) {
                       steps++
                       cs += direction
                       if (cs >= subdivisionsPerBeat) { cs = 0; cb++ }
                       if (cs < 0) { cs = subdivisionsPerBeat - 1; cb-- }
                       if (cb >= beatsPerMeasure) { cb = 0; cm++ }
                       if (cb < 0) { cb = beatsPerMeasure - 1; cm-- }

                       if (cm < 0 || cm >= measureCount) break

                       const val = track?.[cm]?.[cb]?.[cs]
                       if (val) {
                           setSelectedNote({ m: cm, b: cb, s: cs, staff })
                           break
                       }
                   }
                   return
               }

               // Vertical pitch shift
               if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                   e.preventDefault()

                   const measureData = track?.[m]
                   const beatData = measureData?.[b]
                   const noteStr = beatData?.[s]
                   if (!noteStr) return

                   const [currentPitch, duration] = noteStr.includes(':') ? noteStr.split(':') : [noteStr, '16n']

                   // Strip accidentals to find position in diatonic scale
                   const basePitch = currentPitch.replace(/[#b]+/g, '')
                   const scale = staff === 'treble' ? TREBLE_SCALE : BASS_SCALE
                   const currentIndex = scale.indexOf(basePitch)
                   
                   if (currentIndex === -1) return

                   const direction = e.key === 'ArrowUp' ? -1 : 1
                   const newIndex = currentIndex + direction

                   if (newIndex < 0 || newIndex >= scale.length) return

                   const rawNewPitch = scale[newIndex]
                   const newPitch = applyKeySignature(rawNewPitch, currentKey)

                   const newNoteStr = `${newPitch}:${duration}${noteStr.includes(':tie') ? ':tie' : ''}`
                   if (staff === 'treble') setMelodyNote(m, b, s, newNoteStr)
                   else setBassNote(m, b, s, newNoteStr)
               }
               
               // Transpose Semitone (- / =)
               if (e.key === '-' || e.key === '_') {
                   e.preventDefault()
                   transposeSelection(-1)
               }
               if (e.key === '=' || e.key === '+') {
                   e.preventDefault()
                   transposeSelection(1)
               }
           }
           window.addEventListener('keydown', handleKeyDown)

           // --- GRID LOGIC ---
           let gridGroup: SVGGElement | null = null
       let isDraggingSlider = false

       const showGrid = () => {
           if (gridGroup) return
           gridGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g')
           gridGroup.setAttribute('id', 'grid-group')
           gridGroup.style.pointerEvents = 'none'

           // --- VOLUME SLIDERS ---
           // Helper to create a slider
           const createSlider = (label: string, yPos: number, initialValue: number, onChange: (v: number) => void, showTitle = false) => {
               // Apply requested offset: 15px left, 12px up
               const xOffset = 10 // 25 - 15
               const yOffset = -12 // Up 12px pixels (7 + 5)
               const adjustedYPos = yPos + yOffset

               const sliderGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g')
               sliderGroup.style.pointerEvents = 'all'
               sliderGroup.style.cursor = 'grab'
               sliderGroup.addEventListener('click', (e) => e.stopPropagation())
               
               // Background track
               const trackHeight = 60
               const track = document.createElementNS('http://www.w3.org/2000/svg', 'line')
               track.setAttribute('x1', String(xOffset))
               track.setAttribute('y1', String(adjustedYPos))
               track.setAttribute('x2', String(xOffset))
               track.setAttribute('y2', String(adjustedYPos + trackHeight))
               track.setAttribute('stroke', '#ccc')
               track.setAttribute('stroke-width', '4')
               track.setAttribute('stroke-linecap', 'round')
               sliderGroup.appendChild(track)

               // Title "Vol"
               if (showTitle) {
                   const title = document.createElementNS('http://www.w3.org/2000/svg', 'text')
                   title.setAttribute('x', String(xOffset))
                   title.setAttribute('y', String(adjustedYPos - 12))
                   title.setAttribute('text-anchor', 'middle')
                   title.setAttribute('font-size', '10')
                   title.setAttribute('font-family', 'sans-serif')
                   title.setAttribute('fill', '#999')
                   title.textContent = "Vol"
                   sliderGroup.appendChild(title)
               }

               // Handle position
               // Mapping: -30dB (bottom) to +1dB (top)
               const minVol = -30
               const maxVol = 1
               const range = maxVol - minVol
               
               const getHandleY = (v: number) => {
                   const clamped = Math.max(minVol, Math.min(maxVol, v))
                   const pct = (clamped - minVol) / range
                   // Inverted Y: Top is adjustedYPos, Bottom is adjustedYPos + height
                   return (adjustedYPos + trackHeight) - (pct * trackHeight)
               }

               const handle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
               handle.setAttribute('cx', String(xOffset))
               handle.setAttribute('cy', String(getHandleY(initialValue)))
               handle.setAttribute('r', '6')
               handle.setAttribute('fill', '#666')
               sliderGroup.appendChild(handle)

               // Interaction
               const updateValue = (ey: number) => {
                   const rect = svg.getBoundingClientRect()
                   const relativeY = ey - rect.top
                   
                   // Dist from top of slider
                   let dist = relativeY - adjustedYPos
                   dist = Math.max(0, Math.min(trackHeight, dist))
                   
                   // Calculate value from position
                   // 0 dist -> maxVol
                   // height dist -> minVol
                   const pct = 1 - (dist / trackHeight)
                   const newVal = minVol + (pct * range)
                   
                   onChange(newVal)
                   handle.setAttribute('cy', String(adjustedYPos + dist))
               }

               const onMouseDown = (e: MouseEvent) => {
                   e.stopPropagation() 
                   isDraggingSlider = true
                   sliderGroup.style.cursor = 'grabbing'
                   handle.setAttribute('fill', '#444')
                   
                   const onMouseMove = (me: MouseEvent) => {
                       updateValue(me.clientY)
                   }
                   
                   const onMouseUp = () => {
                       isDraggingSlider = false
                       sliderGroup.style.cursor = 'grab'
                       handle.setAttribute('fill', '#666')
                       window.removeEventListener('mousemove', onMouseMove)
                       window.removeEventListener('mouseup', onMouseUp)
                       
                       // If mouse is out of bounds, we might want to hide logic,
                       // but hideGrid handles mouseleave. 
                       // Check if we are currently verifying toggle.
                   }
                   
                   window.addEventListener('mousemove', onMouseMove)
                   window.addEventListener('mouseup', onMouseUp)
                   
                   updateValue(e.clientY)
               }
               
               sliderGroup.addEventListener('mousedown', onMouseDown as any)
               gridGroup?.appendChild(sliderGroup)
           }

           // Retrieve fresh values directly from store state to avoid closure staleness
           const state = useStore.getState()
           
           // 1. Chord Volume (Topmost)
           // y approx startY (40).
           createSlider("Chord", startY, state.chordVolume, state.setChordVolume, true) 
           
           // 2. Melody Volume
           // Treble Stave at startY + 30 + chordHeight approx?
           // Treble Stave Y defined as: startY + chordBandHeight (which is 30) = 70.
           // Center of Treble Stave (5 lines ~ 40px) is ~90.
           // Let's place slider at 80.
           createSlider("Melody", startY + 80, state.melodyVolume, state.setMelodyVolume)

           // 3. Bass Volume
           // Bass Stave Y: startY + 130 = 170.
           // Place at 180.
           createSlider("Bass", startY + 180, state.bassVolume, state.setBassVolume)
           
           // 4. Rhythm Volume
           if (showRhythmTrack) {
              // Rhythm Stave Y: startY + 230 = 270.
              // Place at 280.
              createSlider("Rhythm", startY + 280, state.rhythmVolume, state.setRhythmVolume)
           }

           const totalSubdivisions = beatsPerMeasure * subdivisionsPerBeat

               // Draw Yellow Chord Band in Grid Layer (Visible on Hover)
               const bgStartX = measureLayouts[0]?.noteStartX || startX
               const bgWidth = (width - 10) - bgStartX
               const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
               bg.setAttribute('x', String(bgStartX))
               bg.setAttribute('y', String(startY))
               bg.setAttribute('width', String(Math.max(0, bgWidth)))
               bg.setAttribute('height', String(chordBandHeight))
               bg.setAttribute('fill', '#fff8e1')
               bg.setAttribute('style', 'pointer-events: none;')
               gridGroup.appendChild(bg)

               // Render Sync Toggle Button (To the left of the chord track)
               // Chord track starts at bgStartX.
               // We place the button at startX (canvas left edge) to bgStartX.
               // It's a small toggle switch / button.
               const btnX = startX + 10
               const btnY = startY + 5
               
               const btnGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g')
               btnGroup.setAttribute('class', 'sync-btn')
               btnGroup.style.cursor = 'pointer'
               
               // Background Pill
               const btnWidth = 50 // Decreased from 60
               const btnHeight = 16 // Decreased from 20
               const btnRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
               btnRect.setAttribute('x', String(btnX))
               btnRect.setAttribute('y', String(btnY))
               btnRect.setAttribute('width', String(btnWidth))
               btnRect.setAttribute('height', String(btnHeight))
               btnRect.setAttribute('rx', '4')
               btnRect.setAttribute('fill', syncChordToBass ? '#4caf50' : '#ddd')
               btnGroup.appendChild(btnRect)

               // Label
               const btnText = document.createElementNS('http://www.w3.org/2000/svg', 'text')
               btnText.setAttribute('x', String(btnX + btnWidth / 2))
               btnText.setAttribute('y', String(btnY + 11)) // Centered vertically for 16px height
               btnText.setAttribute('text-anchor', 'middle')
               btnText.setAttribute('font-size', '9') // Decreased from 10
               btnText.setAttribute('fill', syncChordToBass ? 'white' : '#666')
               btnText.textContent = syncChordToBass ? 'Sync: ON' : 'Sync: OFF'
               btnRect.style.pointerEvents = 'all' // Rect receives clicks
               btnText.style.pointerEvents = 'none' // Text lets clicks pass through
               
               // Event listener for toggle must be added to the element, but element is recreated on every showGrid.
               // We need to attach the listener here.
               btnGroup.appendChild(btnText)
               
               // NOTE: Because showGrid is called on mouseenter, this element is created dynamically.
               // We need to handle the click. Since we can't easily use React onClick here, we add DOM listener.
               // But we need to be careful about not adding duplicates or memory leaks if showGrid is called often?
               // showGrid creates gridGroup from scratch if it doesn't exist. So we are good.
               
               btnRect.addEventListener('click', (e) => {
                   e.stopPropagation() // Prevent triggering staff click
                   // Toggle store value
                   // We need access current value because closure might be stale?
                   // Actually, useStore hooks update the component, so `syncChordToBass` variable is fresh.
                   setSyncChordToBass(!syncChordToBass)
                   // We need to re-render the grid immediately to show new state?
                   // Updating the store triggers React re-render of StaffCanvas.
                   // React re-render calls showGrid again? 
                   // No, showGrid is an event handler, React re-render updates the DOM refs.
                   // We might need to manually update the button appearance or let React re-render handle it.
                   // If we rely on React re-render, it might create a new gridGroup?
                   // Currently gridGroup is managed manually.
                   // Let's just force a re-render of the grid by removing it so next mouseenter (or manual call) recreates it?
                   // Or just update the attributes here.
                   const newState = !syncChordToBass
                   btnRect.setAttribute('fill', newState ? '#4caf50' : '#ddd')
                   btnText.setAttribute('fill', newState ? 'white' : '#666')
                   btnText.textContent = newState ? 'Sync: ON' : 'Sync: OFF'
               })
               
               gridGroup.appendChild(btnGroup)

               for (let m = 0; m < measureCount; m++) {
                   const layout = measureLayouts[m]
                   if (!layout) continue

                   // Highlight Selected Note
                   if (selectedNote && selectedNote.m === m) {
                       // Calculate position for selection highlight
                       // We need the tick index
                       const totalTick = (selectedNote.b * subdivisionsPerBeat) + selectedNote.s
                       if (layout.tickX && layout.tickX[totalTick] !== undefined) {
                           const selX = layout.tickX[totalTick]
                           // Width of one tick slot
                           const nextX = layout.tickX[totalTick + 1] || (layout.noteStartX + layout.noteWidth)
                           const width = (nextX - selX)
                           
                           // Determine Y based on staff
                           const selY = selectedNote.staff === 'treble' 
                               ? startY + chordBandHeight + 40 // approximate middle of treble
                               : startY + chordBandHeight + 140 // approximate middle of bass 
                           
                           // Draw selection box
                           const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
                           rect.setAttribute('x', String(selX - 2)) // buffer
                           // Full height of stave area?
                           const staffTop = selectedNote.staff === 'treble' ? startY + chordBandHeight : startY + chordBandHeight + 100
                           rect.setAttribute('y', String(staffTop))
                           rect.setAttribute('width', String(width + 4))
                           rect.setAttribute('height', '100')
                           rect.setAttribute('fill', 'rgba(64, 169, 255, 0.2)')
                           rect.setAttribute('stroke', 'rgba(64, 169, 255, 0.5)')
                           gridGroup.appendChild(rect)
                       }
                   }

                   // Vertical lines for each subdivision based on VexFlow Tick Alignment
               const ticks = layout.tickX || []
               
               // Draw lines for each tick
               ticks.forEach((tx, t) => {
                   const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
                   line.setAttribute('x1', String(tx))
                   line.setAttribute('x2', String(tx))
                   line.setAttribute('y1', String(startY)) // From top of staff area (including chords)
                   line.setAttribute('y2', String(height - 10)) // full height
                   
                   // Style based on beat vs subdivision
                   const isBeat = t % subdivisionsPerBeat === 0
                   line.setAttribute('stroke', isBeat ? '#bbb' : '#eee') 
                   line.setAttribute('stroke-width', isBeat ? '1' : '0.5')
                   gridGroup?.appendChild(line)
               })

               // Re-added Double Line Feature:
               // Draw end line for measure (visual guide) which creates the double-line effect
               const endX = layout.noteStartX + layout.noteWidth
               const endLine = document.createElementNS('http://www.w3.org/2000/svg', 'line')
               endLine.setAttribute('x1', String(endX))
               endLine.setAttribute('x2', String(endX))
               endLine.setAttribute('y1', String(startY))
               endLine.setAttribute('y2', String(height - 10))
               endLine.setAttribute('stroke', '#bbb') 
               gridGroup.appendChild(endLine)

               // Render Chords Aligned to Beats
               if (chords && chords[m]) {
                   for (let b = 0; b < beatsPerMeasure; b++) {
                       const chord = chords[m][b]
                       const tickIndex = b * subdivisionsPerBeat
                       if (ticks.length > tickIndex) {
                           // Always redraw chord in the overlay to ensure it sits ON TOP of the yellow bad
                           // OR draw '+' if empty
                           const tx = ticks[tickIndex]
                           const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
                           text.setAttribute('x', String(tx + 2))
                           text.setAttribute('y', String(startY + chordBandHeight / 2 + 5))
                           text.setAttribute('font-family', 'sans-serif')
                           
                           if (chord) {
                               text.setAttribute('font-size', '14')
                               text.setAttribute('fill', '#000')
                               text.setAttribute('font-weight', 'bold')
                               text.textContent = chord
                           } else {
                               text.setAttribute('font-size', '10')
                               text.setAttribute('fill', '#ccc')
                               text.setAttribute('font-weight', 'normal')
                               text.textContent = '+'
                           }
                           
                           text.style.pointerEvents = 'none'
                           gridGroup.appendChild(text)
                       }
                   }
               }
           }
           svg.appendChild(gridGroup)
       }

       const hideGrid = () => {
           if (isDraggingSlider) return // Only hide if not actively dragging a slider
           if (gridGroup) {
               gridGroup.remove()
               gridGroup = null
           }
       }

       svg.addEventListener('mouseenter', showGrid)
       svg.addEventListener('mouseleave', hideGrid)

       // Add Click Listener
       const handleClick = (e: MouseEvent) => {
           const rect = svg.getBoundingClientRect()
           const x = e.clientX - rect.left
           const y = e.clientY - rect.top
           
           // Determine measure based on Layouts
           let m = -1
           let ticks: number[] = []
           for(let i=0; i<measureLayouts.length; i++) {
               // Hit test the whole measure width, not just note width, to catch clicks in margins
               if (x >= measureLayouts[i].startX && x < measureLayouts[i].endX) {
                   m = i
                   ticks = measureLayouts[i].tickX || []
                   break
               }
           }

           if (m === -1) return

           // Clef click regions (only on first measure, left of noteStartX)
           const trebleY = startY + chordBandHeight
           const bassY = startY + chordBandHeight + 100
           const clefRightX = measureLayouts[0]?.noteStartX ?? (startX + 40)

           if (m === 0 && x >= startX && x < clefRightX) {
               if (y >= trebleY - 20 && y <= trebleY + 60 && onTrebleClefClick) {
                   onTrebleClefClick(e.clientX, e.clientY)
                   return
               }
               if (y >= bassY - 20 && y <= bassY + 60 && onBassClefClick) {
                   onBassClefClick(e.clientX, e.clientY)
                   return
               }
           }
           
           // Snap to floor (grid slot)
               let closestIndex = 0
               
               if (ticks.length > 0) {
                   for (let i = 0; i < ticks.length - 1; i++) {
                       if (x >= ticks[i] && x < ticks[i+1]) {
                           closestIndex = i
                           break
                       }
                   }
                   if (x >= ticks[ticks.length - 1]) closestIndex = ticks.length - 1
               }
               
               // Corrected Offset for Pitch Mapping 
               // Standard stave line spacing is 10px, so 5px per note step
               let targetTrack: 'melody' | 'bass' | 'chord' | 'rhythm' | null = null
               
               // Determine track based on Y proximity
               const rhythmY = startY + chordBandHeight + 200

               if (y >= startY && y < startY + chordBandHeight) {
                   targetTrack = 'chord'
               } else if (y >= trebleY - 50 && y < trebleY + 120) {
                   targetTrack = 'melody'
               } else if (y >= bassY - 50 && y < bassY + 120) {
                   targetTrack = 'bass'
               } else if (showRhythmTrack && y >= rhythmY - 50 && y < rhythmY + 120) {
                   targetTrack = 'rhythm'
               }
               
               if (!targetTrack) return

               const b = Math.floor(closestIndex / subdivisionsPerBeat)

               if (targetTrack === 'chord') {
                   if (onChordClick) onChordClick(m, b, e.clientX, e.clientY)
                   return
               }

               // Rhythm track: click to toggle a simple shaker (closed hi-hat) hit
               if (targetTrack === 'rhythm') {
                   if (!rhythmTrack || !rhythmTrack[m]) return
                   const beat = rhythmTrack[m][b]
                   if (!beat) return

                   const subIndex = closestIndex % subdivisionsPerBeat
                   const current = beat[subIndex]
                   const isOn = current?.hihatClosed || false
                   setRhythmNote(m, b, subIndex, 'hihatClosed', !isOn)
                   return
               }

               // Fix subdivision mapping for 8th notes (Issue 2)
               const visualS = closestIndex % subdivisionsPerBeat
               const s = Math.floor(visualS * (4/subdivisionsPerBeat))

               // Determine pitch from Y coordinate relative to stave top
               // Standard stave line spacing is 10px, so 5px per note step
               const staveTop = targetTrack === 'melody' ? trebleY : bassY
               const relativeY = y - staveTop
               // Calibrate: 0 is approx top line (F5 treble, A3 bass).
               // TREBLE_SCALE: B5 (idx 0), A5 (idx 1), G5 (idx 2), F5 (idx 3)...
               // BASS_SCALE: D4 (idx 0), C4 (idx 1), B3 (idx 2), A3 (idx 3)...
               
               // Pitch Calibration:
               // 0 relativeY is the Top Line.
               // User reported notes appearing "1 note lower" than clicked.
               // Calculated index was too HIGH (lower pitch).
               // Adjusting offset from -4 to -5 to shift pitch UP by 1 step.
               const noteIndex = Math.round(relativeY / 5) - 5
               
               // Clamp index
               const scale = targetTrack === 'melody' ? TREBLE_SCALE : BASS_SCALE
               const clampedIndex = Math.max(0, Math.min(noteIndex, scale.length - 1))
               const rawNote = scale[clampedIndex]
               const note = applyKeySignature(rawNote, currentKey)
               
               let slotsToClear = 1
               if (selectedDuration === '4n') slotsToClear = 3
               if (selectedDuration === '2n') slotsToClear = 7
               if (selectedDuration === '1n') slotsToClear = 15

               const currentTrack = targetTrack === 'melody' ? melody : bass
               const currentNote = currentTrack?.[m]?.[b]?.[s]
               const noteWithDuration = `${note}:${selectedDuration}`
               const staffTag = targetTrack === 'melody' ? 'treble' : 'bass'

               // CLICK BEHAVIOR FOR NOTE ENTRY
               // - If clicking on an existing notehead with the same pitch, erase it.
               // - If clicking on a different line/space in the same slot, move the note (change pitch, keep duration).
               // - If slot is empty, paint a new note using the selected duration (existing behavior).

               if (currentNote) {
                   const [existingPitch] = currentNote.split(':')

                   if (existingPitch === note) {
                       // Toggle off: erase existing note at this slot
                       if (targetTrack === 'melody') {
                           setMelodyNote(m, b, s, null)
                       } else {
                           setBassNote(m, b, s, null)
                       }
                       setSelectedNote(null)
                       return
                   } else {
                       // Move: keep duration/tie suffix, just change pitch
                       const suffix = currentNote.includes(':') ? currentNote.slice(currentNote.indexOf(':')) : ''
                       const movedNote = `${note}${suffix}`
                       if (targetTrack === 'melody') {
                           setMelodyNote(m, b, s, movedNote)
                       } else {
                           setBassNote(m, b, s, movedNote)
                       }
                       setSelectedNote({ m, b, s, staff: staffTag })
                       return
                   }
               } else {
                   // Calculate remaining ticks from this position to end of measure
                   // m, b, s are current indices.
                   // beatsPerMeasure: total beats.
                   // subdivisionsPerBeat: 4 (constant in store logic for timing, visualized differently)
                   // Total ticks in measure = beatsPerMeasure * 4
                   // Current tick index = b * 4 + s
                   const totalTicks = beatsPerMeasure * 4
                   const currentTick = b * 4 + s
                   // slotsToClear is length - 1. E.g. '1n' (16 ticks) -> 15 clears. Total length = 16.
                   const noteDurationTicks = slotsToClear + 1
                   
                   // Helper for converting ticks to duration strings
                   const getDurationFromTicks = (t: number) => {
                       if (t === 16) return '1n'
                       if (t === 14) return '2n..' // Very rare, but possible (3.5 beats)
                       if (t === 12) return '2n.'
                       if (t === 8) return '2n'
                       if (t === 7) return '4n..' // 1.75 beats
                       if (t === 6) return '4n.'
                       if (t === 4) return '4n'
                       if (t === 3) return '8n.'
                       if (t === 2) return '8n'
                       if (t === 1) return '16n'
                       return null
                   }

                   if (currentTick + noteDurationTicks > totalTicks) {
                       // Handle Barline Overflow with Ties
                       const remainingTicks = totalTicks - currentTick
                       const overflowTicks = noteDurationTicks - remainingTicks
                       
                       const dur1 = getDurationFromTicks(remainingTicks)
                       const dur2 = getDurationFromTicks(overflowTicks)
                       
                       // Only proceed if we have valid splits (powers of 2 usually safe)
                       if (dur1 && dur2) {
                           // Part 1: Current Measure (Tied)
                           const note1 = `${note}:${dur1}:tie`
                           if (targetTrack === 'melody') {
                               setMelodyNoteAndClear(m, b, s, note1, remainingTicks - 1)
                           } else {
                               setBassNoteAndClear(m, b, s, note1, remainingTicks - 1)
                           }

                           // Part 2: Next Measure (Start)
                           if (m + 1 < measureCount) {
                               const note2 = `${note}:${dur2}`
                               if (targetTrack === 'melody') {
                                   // Write to start of next measure (Beat 0, Sub 0)
                                   // Warning: This overwrites whatever is there.
                                   setMelodyNoteAndClear(m + 1, 0, 0, note2, overflowTicks - 1)
                               } else {
                                   setBassNoteAndClear(m + 1, 0, 0, note2, overflowTicks - 1)
                               }
                           }
                           return
                       } else {
                           console.warn("Cannot split note cleanly across barline.", { remainingTicks, overflowTicks })
                           return
                       }
                   }

                   if (targetTrack === 'melody') {
                       setMelodyNoteAndClear(m, b, s, noteWithDuration, slotsToClear)
                       setSelectedNote({ m, b, s, staff: 'treble' })
                   } else {
                       setBassNoteAndClear(m, b, s, noteWithDuration, slotsToClear)
                       setSelectedNote({ m, b, s, staff: 'bass' })
                   }
               }
       }
       svg.addEventListener('click', handleClick)
       // Add Key Listener to cleanup
       const cleanupKey = () => window.removeEventListener('keydown', handleKeyDown)
       
       svg.addEventListener('mouseenter', showGrid)
       svg.addEventListener('mouseleave', hideGrid)

       return () => {
           svg.removeEventListener('click', handleClick)
           cleanupKey()
           svg.removeEventListener('mouseenter', showGrid)
           svg.removeEventListener('mouseleave', hideGrid)
           hideGrid()
       }
    }

  }, [
    width, height, measureCount, beatsPerMeasure, subdivisionsPerBeat, 
    melody, bass, rhythmTrack, showRhythmTrack,
        onChordClick, onTrebleClefClick, onBassClefClick,
        setMelodyNote, setBassNote, selectedDuration, setMelodyNoteAndClear, setBassNoteAndClear, selectedNote,
        currentKey
  ])

  return (
    <div className="notation-wrap" style={{width: '100%', overflowX: 'auto'}}>
      <div ref={containerRef} />
    </div>
  )
}
