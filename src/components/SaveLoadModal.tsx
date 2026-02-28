import React, { useState, useEffect } from 'react';
import { getSavedSongs, saveSong, deleteSong, SavedSong } from '../lib/storage';
import useStore, { Snapshot } from '../state/store';

type Props = {
    mode: 'save' | 'load';
    onClose: () => void;
}

export default function SaveLoadModal({ mode, onClose }: Props) {
    const [name, setName] = useState('');
    const [songs, setSongs] = useState<SavedSong[]>([]);
    
    // Store access
    const getSnapshot = useStore(state => {
        // We need to return the entire state to extract the snapshot manually
        // OR we can just add a getSnapshot helper to the store, but accessing state directly here is easier.
        // Actually, to get the CURRENT state for saving, we need useStore.getState() in the handler 
        // to avoid subscribing the whole component to every update.
        return null; 
    });
    
    const loadSnapshot = useStore(state => state.setAll);

    useEffect(() => {
        setSongs(getSavedSongs());
    }, []);

    const handleSave = () => {
        if (!name.trim()) return;
        
        // Construct snapshot from current state
        const state = useStore.getState();
        const snapshot: Snapshot = {
            bpm: state.bpm,
            key: state.key,
            timeSig: state.timeSig,
            measureCount: state.measureCount,
            beatsPerMeasure: state.beatsPerMeasure,
            chords: state.chords,
            measurePatterns: state.measurePatterns,
            subdivisionsPerBeat: state.subdivisionsPerBeat,
            melody: state.melody,
            bass: state.bass,
            rhythmTrack: state.rhythmTrack,
            melodyProgram: state.melodyProgram,
            bassProgram: state.bassProgram,
            rhythmProgram: state.rhythmProgram
        };

        saveSong(name, snapshot);
        setSongs(getSavedSongs());
        if (mode === 'save') {
             // Optional feedback?
             onClose();
        }
    };

    const handleLoad = (song: SavedSong) => {
        if (confirm(`Load "${song.name}"? Unsaved changes will be lost.`)) {
            loadSnapshot(song.snapshot);
            onClose();
        }
    };

    const handleDelete = (songName: string) => {
        if (confirm(`Delete "${songName}"?`)) {
            deleteSong(songName);
            setSongs(getSavedSongs());
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
            <div style={{
                background: 'white', padding: 20, borderRadius: 8, width: 400,
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
            }}>
                <h2 style={{ marginTop: 0 }}>{mode === 'save' ? 'Save Song' : 'Load Song'}</h2>
                
                {mode === 'save' && (
                    <div style={{ marginBottom: 20 }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <input 
                                value={name} 
                                onChange={e => setName(e.target.value)} 
                                placeholder="Enter song name..."
                                style={{ flex: 1, padding: 8, borderRadius: 4, border: '1px solid #ddd' }}
                            />
                            <button onClick={handleSave} style={{ padding: '8px 16px', background: '#007bff', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                                Save
                            </button>
                        </div>
                    </div>
                )}

                <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid #eee', borderRadius: 4 }}>
                    {songs.length === 0 && <div style={{ padding: 20, color: '#999', textAlign: 'center' }}>No saved songs found.</div>}
                    {songs.map(song => (
                        <div key={song.name} style={{ 
                            padding: '10px',
                            borderBottom: '1px solid #eee',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: '#fff'
                        }}>
                             <div style={{ display: 'flex', flexDirection: 'column' }}>
                                 <span style={{ fontWeight: 600 }}>{song.name}</span>
                                 <span style={{ fontSize: 11, color: '#999' }}>{new Date(song.date).toLocaleString()}</span>
                             </div>
                             <div style={{ display: 'flex', gap: 8 }}>
                                 {mode === 'load' && (
                                     <button 
                                        onClick={() => handleLoad(song)}
                                        style={{ padding: '4px 8px', cursor: 'pointer', background: '#28a745', color: 'white', border: 'none', borderRadius: 4 }}
                                     >Load</button>
                                 )}
                                 {/* Allow overwriting in save mode by clicking? Maybe just rely on name match */}
                                 {mode === 'save' && (
                                       <button 
                                        onClick={() => setName(song.name)}
                                        style={{ padding: '4px 8px', cursor: 'pointer', background: '#eee', color: '#333', border: 'none', borderRadius: 4 }}
                                     >Select</button>
                                 )}
                                 <button 
                                    onClick={() => handleDelete(song.name)}
                                    style={{ padding: '4px 8px', cursor: 'pointer', background: '#dc3545', color: 'white', border: 'none', borderRadius: 4 }}
                                >X</button>
                             </div>
                        </div>
                    ))}
                </div>

                <div style={{ marginTop: 20, textAlign: 'right' }}>
                    <button onClick={onClose} style={{ padding: '8px 16px', cursor: 'pointer' }}>Close</button>
                </div>
            </div>
        </div>
    );
}
