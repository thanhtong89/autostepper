/**
 * IndexedDB database setup using Dexie.js
 */
import Dexie, { type Table } from 'dexie';

// Type definitions
export interface Song {
  id?: number;
  title: string;
  artist: string;
  youtubeUrl: string;
  duration: number;
  bpm: number;
  thumbnail?: string;
  status: 'processing' | 'ready' | 'error';
  errorMessage?: string;
  createdAt: string;
}

export interface AudioBlob {
  songId: number;
  blob: Blob;
}

export interface ChartData {
  version: number;
  difficulties: {
    easy: DifficultyChart;
    medium: DifficultyChart;
    hard: DifficultyChart;
    expert: DifficultyChart;
  };
}

export interface DifficultyChart {
  feet: number;
  noteCount: number;
  notes: Note[];
}

export interface Note {
  time: number;
  type: 'tap' | 'hold' | 'jump';
  lane?: number;       // 0-3 for tap/hold
  lanes?: number[];    // For jumps
  endTime?: number;    // For holds
}

export interface Chart {
  songId: number;
  data: ChartData;
  sscContent?: string;  // Raw SSC file content for export
}

export interface Playlist {
  id?: number;
  name: string;
  songIds: number[];
  createdAt: string;
  updatedAt: string;
}

// Database class
class AutoStepperDB extends Dexie {
  songs!: Table<Song, number>;
  audioBlobs!: Table<AudioBlob, number>;
  charts!: Table<Chart, number>;
  playlists!: Table<Playlist, number>;

  constructor() {
    super('AutoStepperDB');

    this.version(1).stores({
      songs: '++id, title, artist, status, createdAt',
      audioBlobs: 'songId',
      charts: 'songId',
      playlists: '++id, name, createdAt'
    });

    // Version 2: Add youtubeUrl index for duplicate checking
    this.version(2).stores({
      songs: '++id, title, artist, status, createdAt, youtubeUrl',
      audioBlobs: 'songId',
      charts: 'songId',
      playlists: '++id, name, createdAt'
    });

    // Version 3: Add updatedAt index to playlists
    this.version(3).stores({
      songs: '++id, title, artist, status, createdAt, youtubeUrl',
      audioBlobs: 'songId',
      charts: 'songId',
      playlists: '++id, name, createdAt, updatedAt'
    });
  }
}

// Export singleton instance
export const db = new AutoStepperDB();

// Initialize database (call this on app start)
export async function initDB(): Promise<void> {
  try {
    await db.open();
    console.log('IndexedDB initialized successfully');
  } catch (error) {
    console.error('Failed to initialize IndexedDB:', error);
    throw error;
  }
}

// Check storage usage
export async function getStorageEstimate(): Promise<{ used: number; quota: number }> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    return {
      used: estimate.usage || 0,
      quota: estimate.quota || 0
    };
  }
  return { used: 0, quota: 0 };
}

// Request persistent storage
export async function requestPersistentStorage(): Promise<boolean> {
  if ('storage' in navigator && 'persist' in navigator.storage) {
    return await navigator.storage.persist();
  }
  return false;
}
