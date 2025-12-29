/**
 * ZIP file handling for StepMania song import/export
 *
 * Uses JSZip library for ZIP operations
 */

import JSZip from 'jszip';
import { parseSSC, sscToChartData, chartDataToSSC, type SSCFile, type SSCMetadata } from './ssc';
import type { Song, ChartData } from '$lib/storage/db';
import { addSong, saveChartWithSSC, getSong, getAudioBlob, getChartWithSSC, regenerateSSC } from '$lib/storage/library';

// Result of importing a song pack
export interface ImportResult {
  success: boolean;
  songsImported: number;
  errors: string[];
  songs: { title: string; artist: string }[];
}

// Detected song in a ZIP
interface DetectedSong {
  folder: string;
  sscFile?: string;
  smFile?: string;
  audioFile?: string;
  audioFileName?: string;
  bannerFile?: string;
}

/**
 * Export a song to ITGMania-compatible ZIP format
 */
export async function exportSongToZip(songId: number): Promise<Blob> {
  const song = await getSong(songId);
  if (!song) throw new Error('Song not found');

  const audioBlob = await getAudioBlob(songId);
  if (!audioBlob) throw new Error('Audio not found');

  let chartRecord = await getChartWithSSC(songId);
  if (!chartRecord) throw new Error('Chart not found');

  // Generate SSC content if it doesn't exist
  let sscContent = chartRecord.sscContent;
  if (!sscContent) {
    sscContent = await regenerateSSC(songId);
    if (!sscContent) throw new Error('Failed to generate SSC content');
  }

  const zip = new JSZip();

  // Create song folder (sanitized name)
  const folderName = sanitizeFolderName(`${song.artist} - ${song.title}`);
  const folder = zip.folder(folderName)!;

  // Add audio file
  folder.file('song.mp3', audioBlob);

  // Add SSC file
  folder.file(`${sanitizeFolderName(song.title)}.ssc`, sscContent);

  // Add banner/thumbnail if available
  if (song.thumbnail) {
    try {
      const response = await fetch(song.thumbnail);
      if (response.ok) {
        const bannerBlob = await response.blob();
        folder.file('banner.png', bannerBlob);
      }
    } catch {
      // Ignore thumbnail fetch errors
    }
  }

  // Generate ZIP
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

/**
 * Export multiple songs to a song pack ZIP
 */
export async function exportSongPackToZip(songIds: number[], packName: string): Promise<Blob> {
  const zip = new JSZip();
  const packFolder = zip.folder(sanitizeFolderName(packName))!;

  for (const songId of songIds) {
    try {
      const song = await getSong(songId);
      if (!song) continue;

      const audioBlob = await getAudioBlob(songId);
      if (!audioBlob) continue;

      let chartRecord = await getChartWithSSC(songId);
      if (!chartRecord) continue;

      let sscContent = chartRecord.sscContent;
      if (!sscContent) {
        sscContent = await regenerateSSC(songId);
        if (!sscContent) continue;
      }

      const folderName = sanitizeFolderName(`${song.artist} - ${song.title}`);
      const songFolder = packFolder.folder(folderName)!;

      songFolder.file('song.mp3', audioBlob);
      songFolder.file(`${sanitizeFolderName(song.title)}.ssc`, sscContent);

      if (song.thumbnail) {
        try {
          const response = await fetch(song.thumbnail);
          if (response.ok) {
            const bannerBlob = await response.blob();
            songFolder.file('banner.png', bannerBlob);
          }
        } catch {
          // Ignore
        }
      }
    } catch (e) {
      console.error(`Failed to export song ${songId}:`, e);
    }
  }

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

/**
 * Import songs from a ZIP file
 */
export async function importFromZip(file: File, onProgress?: (msg: string) => void): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    songsImported: 0,
    errors: [],
    songs: []
  };

  try {
    onProgress?.('Reading ZIP file...');
    const zip = await JSZip.loadAsync(file);

    // Detect songs in the ZIP
    onProgress?.('Detecting songs...');
    const detectedSongs = detectSongsInZip(zip);

    if (detectedSongs.length === 0) {
      result.errors.push('No valid songs found in ZIP. Expected folders containing .ssc/.sm files and audio.');
      return result;
    }

    onProgress?.(`Found ${detectedSongs.length} song(s) to import`);

    // Import each song
    for (const detected of detectedSongs) {
      try {
        onProgress?.(`Importing: ${detected.folder}`);
        const imported = await importSingleSong(zip, detected);
        if (imported) {
          result.songsImported++;
          result.songs.push({ title: imported.title, artist: imported.artist });
        }
      } catch (e) {
        const error = e instanceof Error ? e.message : 'Unknown error';
        result.errors.push(`Failed to import ${detected.folder}: ${error}`);
      }
    }

    result.success = result.songsImported > 0;
  } catch (e) {
    result.errors.push(`Failed to read ZIP file: ${e instanceof Error ? e.message : 'Unknown error'}`);
  }

  return result;
}

/**
 * Detect songs in a ZIP file
 */
function detectSongsInZip(zip: JSZip): DetectedSong[] {
  const songs: Map<string, DetectedSong> = new Map();

  // Iterate through all files
  zip.forEach((relativePath, file) => {
    if (file.dir) return;

    const parts = relativePath.split('/');
    const fileName = parts[parts.length - 1].toLowerCase();
    const ext = fileName.split('.').pop() || '';

    // Determine the song folder (first or second level)
    let folder: string;
    if (parts.length === 1) {
      folder = '';
    } else if (parts.length === 2) {
      folder = parts[0];
    } else {
      // Could be pack/song/file structure
      folder = parts.slice(0, -1).join('/');
    }

    if (!songs.has(folder)) {
      songs.set(folder, { folder });
    }

    const song = songs.get(folder)!;

    // Check file type
    if (ext === 'ssc') {
      song.sscFile = relativePath;
    } else if (ext === 'sm') {
      song.smFile = relativePath;
    } else if (['mp3', 'ogg', 'wav', 'm4a', 'flac'].includes(ext)) {
      // Prefer files named 'song' or the first audio file found
      const baseName = fileName.replace(/\.[^.]+$/, '');
      if (!song.audioFile || baseName === 'song' || baseName === 'audio') {
        song.audioFile = relativePath;
        song.audioFileName = parts[parts.length - 1];
      }
    } else if (['png', 'jpg', 'jpeg', 'gif'].includes(ext)) {
      const baseName = fileName.replace(/\.[^.]+$/, '');
      if (['banner', 'bn', 'jacket'].includes(baseName)) {
        song.bannerFile = relativePath;
      }
    }
  });

  // Filter to only valid songs (has chart and audio)
  return Array.from(songs.values()).filter(s =>
    (s.sscFile || s.smFile) && s.audioFile
  );
}

/**
 * Import a single song from ZIP
 */
async function importSingleSong(zip: JSZip, detected: DetectedSong): Promise<{ title: string; artist: string } | null> {
  // Read chart file
  const chartPath = detected.sscFile || detected.smFile;
  if (!chartPath) return null;

  const chartFile = zip.file(chartPath);
  if (!chartFile) return null;

  const chartContent = await chartFile.async('string');

  // Parse chart
  const ssc = parseSSC(chartContent);
  const chartData = sscToChartData(ssc);

  // Check if any difficulty has notes
  const hasNotes = Object.values(chartData.difficulties).some(d => d.notes.length > 0);
  if (!hasNotes) {
    throw new Error('No playable notes found in chart');
  }

  // Read audio file
  if (!detected.audioFile) return null;
  const audioFile = zip.file(detected.audioFile);
  if (!audioFile) return null;

  const audioBlob = await audioFile.async('blob');

  // Estimate duration from audio blob (rough estimate based on file size)
  // For MP3, assume ~128kbps = 16KB/sec
  const estimatedDuration = audioBlob.size / 16000;

  // Read banner if available
  let thumbnail: string | undefined;
  if (detected.bannerFile) {
    const bannerFile = zip.file(detected.bannerFile);
    if (bannerFile) {
      const bannerBlob = await bannerFile.async('blob');
      thumbnail = URL.createObjectURL(bannerBlob);
    }
  }

  // Create song record
  const songData: Omit<Song, 'id' | 'status' | 'createdAt'> = {
    title: ssc.metadata.title,
    artist: ssc.metadata.artist,
    youtubeUrl: '', // Imported song, no YouTube URL
    duration: estimatedDuration,
    bpm: ssc.metadata.bpm,
    thumbnail
  };

  // Add to database
  const songId = await addSong(songData, audioBlob, chartData);

  // Update with SSC content
  await saveChartWithSSC(songId, chartData, chartContent);

  return { title: ssc.metadata.title, artist: ssc.metadata.artist };
}

/**
 * Sanitize folder/file name for filesystem compatibility
 */
function sanitizeFolderName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '_')  // Replace invalid chars
    .replace(/\s+/g, ' ')            // Normalize spaces
    .trim()
    .slice(0, 100);                  // Limit length
}

/**
 * Download a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
