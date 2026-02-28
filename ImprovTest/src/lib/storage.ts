import { Snapshot } from '../state/store';

const STORAGE_KEY = 'improv_songs';

export type SavedSong = {
    name: string;
    date: string;
    snapshot: Snapshot;
}

export function getSavedSongs(): SavedSong[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        return JSON.parse(raw);
    } catch (e) {
        console.error("Failed to parse saved songs", e);
        return [];
    }
}

export function saveSong(name: string, snapshot: Snapshot) {
    const songs = getSavedSongs();
    const newSong: SavedSong = {
        name,
        date: new Date().toISOString(),
        snapshot
    };
    
    // Check if song exists, if so overwrite
    const index = songs.findIndex(s => s.name === name);
    if (index >= 0) {
        songs[index] = newSong;
    } else {
        songs.push(newSong);
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(songs));
}

export function deleteSong(name: string) {
    const songs = getSavedSongs();
    const filtered = songs.filter(s => s.name !== name);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export function loadSong(name: string): Snapshot | null {
    const songs = getSavedSongs();
    const song = songs.find(s => s.name === name);
    return song ? song.snapshot : null;
}
