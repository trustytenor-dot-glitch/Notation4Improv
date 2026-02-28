import React, { useEffect, useRef } from 'react'
import { Renderer, Stave } from 'vexflow'

type Props = {
  width?: number
  height?: number
}

export default function NotationRenderer({ width = 900, height = 420 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Clear previous content
    containerRef.current.innerHTML = ''

    const renderer = new Renderer(containerRef.current, Renderer.Backends.SVG)
    renderer.resize(width, height)
    const ctx = renderer.getContext()

    const margin = 10
    const staffHeight = 80

    const staves = [
      { clef: 'treble', label: 'Melody' },
      { clef: 'bass', label: 'Bass' },
      { clef: 'percussion', label: 'Drums' }
    ]

    staves.forEach((s, i) => {
      const y = margin + i * staffHeight
      const stave = new Stave(margin, y + 10, width - margin * 2)
      stave.addClef(s.clef)
      stave.setContext(ctx).draw()
    })

    // Draw chord track header band above melody
    const svg = containerRef.current.querySelector('svg') as SVGSVGElement | null
    if (svg) {
      const band = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
      band.setAttribute('x', String(margin))
      band.setAttribute('y', String(margin + 2))
      band.setAttribute('width', String(width - margin * 2))
      band.setAttribute('height', '24')
      band.setAttribute('fill', '#fff7e6')
      band.setAttribute('opacity', '0.9')
      svg.insertBefore(band, svg.firstChild)
    }

    // Note: This component is a lightweight wrapper for initial layout.
    // Detailed rendering (measures/notes/interaction) will be implemented in StaffCanvas.
  }, [width, height])

  return (
    <div className="notation-wrap">
      <div ref={containerRef} />
    </div>
  )
}
