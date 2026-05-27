import React, { useEffect, useRef } from 'react'
import { Renderer, Stave, StaveNote, Voice, Formatter, Beam, StaveTie, Dot, Accidental } from 'vexflow'
import useStore from '../state/store'
import { TREBLE_SCALE, BASS_SCALE } from '../lib/constants'
import { KEY_SIGNATURE_NOTES, getVexFlowDuration, getDurationTicks } from '../lib/musicHelpers'

// US Letter at 96dpi: 816×1056, with 30px margins → 756px usable width
const PAGE_WIDTH = 756
const MIN_MEASURE_WIDTH = 160

type Props = {
  onClose: () => void
}

export default function PrintView({ onClose }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const currentKey = useStore(s => s.key)
  const bpm = useStore(s => s.bpm)
  const timeSig = useStore(s => s.timeSig)
  const melody = useStore(s => s.melody)
  const bass = useStore(s => s.bass)
  const rhythmTrack = useStore(s => s.rhythmTrack)
  const measureCount = useStore(s => s.measureCount)
  const beatsPerMeasure = useStore(s => s.beatsPerMeasure)
  const subdivisionsPerBeat = useStore(s => s.subdivisionsPerBeat)
  const chords = useStore(s => s.chords)
  const ptv = useStore(s => s.printTrackVisibility)
  const measuresPerSystem = useStore(s => s.measuresPerSystem)

  const showMelody = ptv.melody
  const showBass = ptv.bass
  const showRhythm = ptv.rhythm
  const setPrintTrackVisibility = useStore(s => s.setPrintTrackVisibility)

  useEffect(() => {
    if (!containerRef.current) return
    containerRef.current.innerHTML = ''

    const startX = 10
    const startY = 60 // room for title
    const chordBandHeight = 20
    const totalAvailableWidth = PAGE_WIDTH - 20

    const keySigNotes = (currentKey && KEY_SIGNATURE_NOTES[currentKey]) ? KEY_SIGNATURE_NOTES[currentKey] : []
    const keySigWidth = keySigNotes.length * 12
    const m1Extra = 70 + keySigWidth

    // Compute systems — respect manual measuresPerSystem setting
    const availableForMusic = totalAvailableWidth - m1Extra
    let effectiveMPS: number
    if (measuresPerSystem === 'auto') {
      effectiveMPS = Math.max(1, Math.min(measureCount, 1 + Math.floor(availableForMusic / MIN_MEASURE_WIDTH)))
    } else {
      effectiveMPS = Math.max(1, Math.min(measureCount, measuresPerSystem))
    }

    const systems: { startMeasure: number; count: number }[] = []
    for (let i = 0; i < measureCount; i += effectiveMPS) {
      systems.push({ startMeasure: i, count: Math.min(effectiveMPS, measureCount - i) })
    }

    // Compute heights based on visible tracks
    let staveBlockHeight = chordBandHeight
    if (showMelody) staveBlockHeight += 100
    if (showBass) staveBlockHeight += 100
    if (showRhythm) staveBlockHeight += 100

    const systemGap = 30
    const systemHeight = staveBlockHeight + systemGap
    const totalHeight = startY + systems.length * systemHeight + 40

    const renderer = new Renderer(containerRef.current, Renderer.Backends.SVG)
    renderer.resize(PAGE_WIDTH, totalHeight)
    const ctx = renderer.getContext()

    // Title
    const svg = containerRef.current.querySelector('svg')
    if (svg) {
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      title.setAttribute('x', String(PAGE_WIDTH / 2))
      title.setAttribute('y', '30')
      title.setAttribute('text-anchor', 'middle')
      title.setAttribute('font-family', 'sans-serif')
      title.setAttribute('font-size', '16')
      title.setAttribute('font-weight', 'bold')
      title.textContent = `Key: ${currentKey} | ${timeSig} | ${bpm} BPM`
      svg.appendChild(title)
    }

    // Helper: Create Voice from Track (simplified, no interaction)
    const createVoice = (
      track: (string | null)[][],
      clef: 'treble' | 'bass',
    ): { voice: Voice; notes: StaveNote[] } | null => {
      if (!track) return null
      const notes: StaveNote[] = []
      const slotsPerBeat = track[0]?.length || 4
      const slotSize = 4 / slotsPerBeat
      const totalTicks = beatsPerMeasure * 4
      const events = new Map<number, string>()
      track.forEach((beat, bi) => {
        beat.forEach((sub, si) => {
          if (!sub) return
          const tick = bi * 4 + Math.round(si * slotSize)
          if (tick >= 0 && tick < totalTicks) events.set(tick, sub)
        })
      })
      let t = 0
      while (t < totalTicks) {
        const sub = events.get(t)
        if (sub) {
          const parts = sub.split(':')
          const pitch = parts[0]
          const durStr = parts[1] || '16n'
          const vfDur = getVexFlowDuration(durStr)
          const dots = (durStr.match(/\./g) || []).length
          const key = pitch.includes('/') ? pitch.toLowerCase() : pitch.replace(/(\D)(\d+)/, '$1/$2').toLowerCase()
          try {
            const note = new StaveNote({ keys: [key], duration: vfDur + (dots > 0 ? 'd'.repeat(dots) : ''), clef })
            const accMatch = key.match(/^[a-g]([#b]+)\/\d+$/)
            if (accMatch) note.addModifier(new Accidental(accMatch[1]), 0)
            if (dots > 0) note.addModifier(new Dot(), 0)
            if (dots > 1) note.addModifier(new Dot(), 0)
            // @ts-ignore
            note.tickStart = t
            notes.push(note)
            let durSlots = getDurationTicks(vfDur, dots)
            if (t + durSlots > totalTicks) durSlots = totalTicks - t
            t += Math.max(durSlots, 1)
          } catch {
            const restKey = clef === 'treble' ? 'b/4' : 'd/3'
            notes.push(new StaveNote({ keys: [restKey], duration: '16r', clef }))
            t += 1
          }
        } else {
          let run = 0
          while (t + run < totalTicks && !events.has(t + run)) run++
          let restDuration = '16r', restSlots = 1
          if ((t % 4 === 0) && run >= 4) { restDuration = 'qr'; restSlots = 4 }
          else if ((t % 2 === 0) && run >= 2) { restDuration = '8r'; restSlots = 2 }
          const restKey = clef === 'treble' ? 'b/4' : 'd/3'
          const note = new StaveNote({ keys: [restKey], duration: restDuration, clef })
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

    const createRhythmVoice = (measureNotes: any[][], stave: Stave): { voice: Voice; notes: StaveNote[] } | null => {
      if (!measureNotes) return null
      const notes: StaveNote[] = []
      const subdivisions = 4
      const totalTicks = beatsPerMeasure * subdivisions
      const flatTrack: any[] = []
      for (let b = 0; b < beatsPerMeasure; b++) {
        const beat = measureNotes[b] || []
        for (let s = 0; s < subdivisions; s++) flatTrack.push(beat[s])
      }
      let t = 0
      while (t < totalTicks) {
        const drum = flatTrack[t]
        const keys: string[] = []
        if (drum) {
          if (drum.kick) keys.push('f/4')
          if (drum.snare) keys.push('c/5')
          if (drum.hihatClosed) keys.push('g/5/x')
          if (drum.hihatOpen) keys.push('a/5/x')
          if (drum.cymbal) keys.push('f/5/x')
        }
        let space = 1
        for (let i = t + 1; i < totalTicks; i++) {
          const d = flatTrack[i]
          if (d && (d.kick || d.snare || d.hihatClosed || d.hihatOpen || d.cymbal)) break
          space++
        }
        let bestTicks = 1, durationType = '16'
        if (space >= 4 && (t % 4 === 0)) { bestTicks = 4; durationType = 'q' }
        else if (space >= 2 && (t % 2 === 0)) { bestTicks = 2; durationType = '8' }
        if (keys.length > 0) {
          const note = new StaveNote({ keys, duration: durationType, clef: 'percussion' })
          // @ts-ignore
          note.tickStart = t
          notes.push(note)
        } else {
          const rest = new StaveNote({ keys: ['b/4'], duration: durationType + 'r', clef: 'percussion' })
          // @ts-ignore
          rest.tickStart = t
          notes.push(rest)
        }
        t += bestTicks
      }
      if (notes.length === 0) return null
      const voice = new Voice({ num_beats: beatsPerMeasure, beat_value: 4 })
      voice.addTickables(notes)
      return { voice, notes }
    }

    // Render systems
    let lastTrebleNote: StaveNote | null = null
    let lastBassNote: StaveNote | null = null

    for (let sys = 0; sys < systems.length; sys++) {
      const { startMeasure, count: sysMeasureCount } = systems[sys]
      const systemBaseY = startY + sys * systemHeight
      lastTrebleNote = null
      lastBassNote = null

      const sysStaveWidth = Math.max(10, (totalAvailableWidth - m1Extra) / sysMeasureCount)

      let currentX = startX
      for (let localM = 0; localM < sysMeasureCount; localM++) {
        const m = startMeasure + localM
        const isFirst = localM === 0
        const staveWidth = isFirst ? sysStaveWidth + m1Extra : sysStaveWidth
        const x = currentX
        currentX += staveWidth

        let staveY = systemBaseY + chordBandHeight

        // Treble
        let trebleStave: Stave | null = null
        if (showMelody) {
          trebleStave = new Stave(x, staveY, staveWidth)
          if (isFirst) {
            trebleStave.addClef('treble').addTimeSignature(`${beatsPerMeasure}/4`)
            if (currentKey) trebleStave.addKeySignature(currentKey)
          }
          trebleStave.setContext(ctx).draw()
          staveY += 100
        }

        // Bass
        let bassStave: Stave | null = null
        if (showBass) {
          bassStave = new Stave(x, staveY, staveWidth)
          if (isFirst) {
            bassStave.addClef('bass').addTimeSignature(`${beatsPerMeasure}/4`)
            if (currentKey) bassStave.addKeySignature(currentKey)
          }
          bassStave.setContext(ctx).draw()
          staveY += 100
        }

        // Rhythm
        let rhythmStave: Stave | null = null
        if (showRhythm && rhythmTrack) {
          rhythmStave = new Stave(x, staveY, staveWidth)
          if (isFirst) rhythmStave.addClef('percussion').addTimeSignature(`${beatsPerMeasure}/4`)
          rhythmStave.setContext(ctx).draw()
        }

        // Reference stave for noteStartX / noteWidth
        const refStave = trebleStave || bassStave || rhythmStave
        if (!refStave) continue
        const noteStartX = refStave.getNoteStartX()
        const noteWidth = refStave.getNoteEndX() - noteStartX

        // Voices
        const trebleData = (showMelody && trebleStave && melody?.[m]) ? createVoice(melody[m], 'treble') : null
        const bassData = (showBass && bassStave && bass?.[m]) ? createVoice(bass[m], 'bass') : null
        const rhythmData = (showRhythm && rhythmStave && rhythmTrack?.[m]) ? createRhythmVoice(rhythmTrack[m], rhythmStave) : null

        // Format rhythm independently
        if (rhythmData && rhythmStave) {
          const rf = new Formatter()
          rf.joinVoices([rhythmData.voice])
          try { rf.format([rhythmData.voice], noteWidth) } catch {}
        }

        const voicesToFormat: Voice[] = []
        if (trebleData) voicesToFormat.push(trebleData.voice)
        if (bassData) voicesToFormat.push(bassData.voice)

        if (voicesToFormat.length > 0) {
          const formatter = new Formatter()
          voicesToFormat.forEach(v => formatter.joinVoices([v]))
          try { formatter.format(voicesToFormat, noteWidth) } catch {}
        }

        // Linear X alignment
        const pixelsPer16th = noteWidth / (beatsPerMeasure * 4)
        const applyLinearX = (data: { voice: Voice; notes: StaveNote[] }, stave: Stave) => {
          const alignOffset = noteStartX - stave.getNoteStartX()
          data.notes.forEach(note => {
            // @ts-ignore
            const t = note.tickStart
            if (typeof t === 'number') {
              const tc = note.getTickContext()
              if (tc) {
                tc.setX((t * pixelsPer16th) - 7 + alignOffset)
                tc.setPadding(0)
              }
            }
          })
        }

        if (rhythmData && rhythmStave) applyLinearX(rhythmData, rhythmStave)
        if (trebleData && trebleStave) applyLinearX(trebleData, trebleStave)
        if (bassData && bassStave) applyLinearX(bassData, bassStave)

        // Draw
        if (rhythmData && rhythmStave) {
          const beams = Beam.generateBeams(rhythmData.notes)
          rhythmData.voice.draw(ctx, rhythmStave)
          beams.forEach(b => b.setContext(ctx).draw())
        }

        if (trebleData && trebleStave) {
          const beams = Beam.generateBeams(trebleData.notes)
          trebleData.voice.draw(ctx, trebleStave)
          beams.forEach(b => b.setContext(ctx).draw())
          if (lastTrebleNote) {
            const firstNote = trebleData.notes.find(n => !n.isRest())
            // @ts-ignore
            if (firstNote && firstNote.tickStart === 0) {
              new StaveTie({ first_note: lastTrebleNote, last_note: firstNote }).setContext(ctx).draw()
            }
            lastTrebleNote = null
          }
          const lastNote = trebleData.notes[trebleData.notes.length - 1]
          // @ts-ignore
          lastTrebleNote = (lastNote && !lastNote.isRest() && lastNote.isTied) ? lastNote : null
        } else {
          lastTrebleNote = null
        }

        if (bassData && bassStave) {
          const beams = Beam.generateBeams(bassData.notes)
          bassData.voice.draw(ctx, bassStave)
          beams.forEach(b => b.setContext(ctx).draw())
          if (lastBassNote) {
            const firstNote = bassData.notes.find(n => !n.isRest())
            // @ts-ignore
            if (firstNote && firstNote.tickStart === 0) {
              new StaveTie({ first_note: lastBassNote, last_note: firstNote }).setContext(ctx).draw()
            }
            lastBassNote = null
          }
          const lastNote = bassData.notes[bassData.notes.length - 1]
          // @ts-ignore
          lastBassNote = (lastNote && !lastNote.isRest() && lastNote.isTied) ? lastNote : null
        } else {
          lastBassNote = null
        }

        // Chords
        if (chords?.[m] && svg) {
          const tickStep = noteWidth / (beatsPerMeasure * subdivisionsPerBeat)
          for (let b = 0; b < beatsPerMeasure; b++) {
            const chord = chords[m][b]
            if (!chord) continue
            const tx = noteStartX + b * subdivisionsPerBeat * tickStep
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
            text.setAttribute('x', String(tx + 2))
            text.setAttribute('y', String(systemBaseY + chordBandHeight / 2 + 5))
            text.setAttribute('font-family', 'sans-serif')
            text.setAttribute('font-size', '12')
            text.setAttribute('font-weight', 'bold')
            text.style.pointerEvents = 'none'
            text.textContent = chord
            svg.appendChild(text)
          }
        }
      }
    }
  }, [currentKey, bpm, timeSig, melody, bass, rhythmTrack, measureCount, beatsPerMeasure, subdivisionsPerBeat, chords, showMelody, showBass, showRhythm, measuresPerSystem])

  return (
    <div className="print-view">
      <div className="print-controls no-print">
        <label><input type="checkbox" checked={showMelody} onChange={e => setPrintTrackVisibility('melody', e.target.checked)} /> Melody</label>
        <label><input type="checkbox" checked={showBass} onChange={e => setPrintTrackVisibility('bass', e.target.checked)} /> Bass</label>
        <label><input type="checkbox" checked={showRhythm} onChange={e => setPrintTrackVisibility('rhythm', e.target.checked)} /> Rhythm</label>
        <button onClick={() => window.print()}>Print</button>
        <button onClick={onClose}>Close</button>
      </div>
      <div className="print-page" ref={containerRef} />
    </div>
  )
}
