/**
 * Song library operations
 */
import { db, type Song, type AudioBlob, type Chart, type ChartData } from './db';
import { chartDataToSSC, type SSCMetadata } from '$lib/formats/ssc';

// Re-export types for convenience
export type { Song, ChartData } from './db';

/**
 * Get all songs from the library
 */
export async function getSongs(): Promise<Song[]> {
  return db.songs.orderBy('createdAt').reverse().toArray();
}

/**
 * Get a single song by ID
 */
export async function getSong(id: number): Promise<Song | undefined> {
  return db.songs.get(id);
}

/**
 * Add a new song to the library
 */
export async function addSong(
  metadata: Omit<Song, 'id' | 'status' | 'createdAt'>,
  audioBlob?: Blob,
  chartData?: ChartData
): Promise<number> {
  // Add song record
  const songId = await db.songs.add({
    ...metadata,
    status: audioBlob && chartData ? 'ready' : 'processing',
    createdAt: new Date().toISOString()
  });

  // Add audio blob if provided
  if (audioBlob) {
    await db.audioBlobs.put({ songId, blob: audioBlob });
  }

  // Add chart if provided
  if (chartData) {
    await db.charts.put({ songId, data: chartData });
  }

  return songId;
}

/**
 * Update a song's metadata
 */
export async function updateSong(id: number, updates: Partial<Song>): Promise<void> {
  await db.songs.update(id, updates);
}

/**
 * Update song status
 */
export async function updateSongStatus(
  id: number,
  status: Song['status'],
  errorMessage?: string
): Promise<void> {
  await db.songs.update(id, { status, errorMessage });
}

/**
 * Save audio blob for a song
 */
export async function saveAudioBlob(songId: number, blob: Blob): Promise<void> {
  await db.audioBlobs.put({ songId, blob });
}

/**
 * Save chart data for a song
 */
export async function saveChart(songId: number, data: ChartData, song?: Song): Promise<void> {
  // Generate SSC content if we have song metadata
  let sscContent: string | undefined;

  if (song) {
    const metadata: SSCMetadata = {
      title: song.title,
      artist: song.artist,
      music: 'song.mp3',
      offset: 0,
      sampleStart: song.duration * 0.3,
      sampleLength: 15,
      bpm: song.bpm
    };
    sscContent = chartDataToSSC(data, metadata);
  }

  await db.charts.put({ songId, data, sscContent });
}

/**
 * Save chart with SSC content directly (for imports)
 */
export async function saveChartWithSSC(songId: number, data: ChartData, sscContent: string): Promise<void> {
  await db.charts.put({ songId, data, sscContent });
}

/**
 * Get audio blob for a song
 */
export async function getAudioBlob(songId: number): Promise<Blob | undefined> {
  const record = await db.audioBlobs.get(songId);
  return record?.blob;
}

/**
 * Get chart data for a song
 */
export async function getChart(songId: number): Promise<ChartData | undefined> {
  const record = await db.charts.get(songId);
  return record?.data;
}

/**
 * Delete a song and its associated data
 */
export async function deleteSong(id: number): Promise<void> {
  await db.transaction('rw', [db.songs, db.audioBlobs, db.charts], async () => {
    await db.songs.delete(id);
    await db.audioBlobs.delete(id);
    await db.charts.delete(id);
  });
}

/**
 * Get songs that are ready to play
 */
export async function getReadySongs(): Promise<Song[]> {
  return db.songs.where('status').equals('ready').toArray();
}

/**
 * Get total library size in bytes
 */
export async function getLibrarySize(): Promise<number> {
  const audioBlobs = await db.audioBlobs.toArray();
  return audioBlobs.reduce((total, record) => total + record.blob.size, 0);
}

/**
 * Check if a YouTube URL already exists in the library
 */
export async function songExists(youtubeUrl: string): Promise<boolean> {
  const count = await db.songs.where('youtubeUrl').equals(youtubeUrl).count();
  return count > 0;
}

/**
 * Get full chart record including SSC content
 */
export async function getChartWithSSC(songId: number): Promise<{ data: ChartData; sscContent?: string } | undefined> {
  const record = await db.charts.get(songId);
  if (!record) return undefined;
  return { data: record.data, sscContent: record.sscContent };
}

/**
 * Regenerate SSC content for a song (for existing songs without SSC)
 */
export async function regenerateSSC(songId: number): Promise<string | undefined> {
  const song = await getSong(songId);
  const record = await db.charts.get(songId);

  if (!song || !record) return undefined;

  const metadata: SSCMetadata = {
    title: song.title,
    artist: song.artist,
    music: 'song.mp3',
    offset: 0,
    sampleStart: song.duration * 0.3,
    sampleLength: 15,
    bpm: song.bpm
  };

  const sscContent = chartDataToSSC(record.data, metadata);
  await db.charts.update(songId, { sscContent });

  return sscContent;
}
