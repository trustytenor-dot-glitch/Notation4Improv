export type RhythmPreset = {
  id: string
  label: string
  pattern: string[] // simple representation: array of durations like ['4n','8n','8n']
}

export const RHYTHM_PRESETS: RhythmPreset[] = [
  { id: 'four_quarter', label: '4 x quarter', pattern: ['4n', '4n', '4n', '4n'] },
  { id: 'alternating_eighths', label: 'Eighths', pattern: ['8n', '8n', '8n', '8n', '8n', '8n', '8n', '8n'] },
  { id: 'syncopated', label: 'Syncopated', pattern: ['8n', '4n', '8n', '4n'] },
  { id: 'half_dotted', label: 'Half + dotted', pattern: ['2n', '4n.', '4n'] },
  { id: 'sparse', label: 'Sparse', pattern: ['1m'] }
]

export default RHYTHM_PRESETS
