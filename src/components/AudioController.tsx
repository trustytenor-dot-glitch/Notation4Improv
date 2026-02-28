import { useEffect } from 'react'
import useStore from '../state/store'
import AudioPlayer from '../lib/audio'

export default function AudioController() {
  const melodyVolume = useStore(s => s.melodyVolume)
  const chordVolume = useStore(s => s.chordVolume)
  const bassVolume = useStore(s => s.bassVolume)
  const rhythmVolume = useStore(s => s.rhythmVolume)
  const melodyProgram = useStore(s => s.melodyProgram)
  const bassProgram = useStore(s => s.bassProgram)
  const rhythmProgram = useStore(s => s.rhythmProgram)

  useEffect(() => {
    AudioPlayer.setVolumes(melodyVolume, chordVolume, bassVolume, rhythmVolume)
  }, [melodyVolume, chordVolume, bassVolume, rhythmVolume])

  useEffect(() => {
    AudioPlayer.setInstrumentPrograms(melodyProgram, bassProgram, rhythmProgram)
  }, [melodyProgram, bassProgram, rhythmProgram])

  return null
}
