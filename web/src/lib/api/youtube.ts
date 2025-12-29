/**
 * YouTube download API client
 *
 * Uses Tauri backend for YouTube downloads.
 * Falls back to fetch-based API if not running in Tauri (development).
 */

import { invoke } from '@tauri-apps/api/core';

export interface DownloadResponse {
  id: string;
  title: string;
  artist: string;
  duration: number;
  thumbnail: string;
  downloadUrl: string;
  fileSize: number;
}

export interface DependencyStatus {
  ytdlp: boolean;
  ytdlp_path: string | null;
  deno: boolean;
  deno_path: string | null;
  ffmpeg: boolean;
  cookies_browser: string | null;  // Browser detected for cookies fallback
}

/**
 * Check if running in Tauri
 */
function isTauri(): boolean {
  return '__TAURI_INTERNALS__' in window;
}

/**
 * Request audio download from YouTube via Tauri backend
 */
export async function downloadFromYouTube(youtubeUrl: string): Promise<DownloadResponse> {
  if (!isTauri()) {
    throw new Error('YouTube downloads require the desktop app. Please run with Tauri.');
  }

  return invoke<DownloadResponse>('download_youtube', { youtubeUrl });
}

/**
 * Fetch audio file as Blob from Tauri backend
 * Uses asset protocol for efficient streaming
 */
export async function fetchAudioBlob(downloadUrl: string): Promise<Blob> {
  if (!isTauri()) {
    throw new Error('Audio fetching requires the desktop app.');
  }

  // Extract song ID from the download URL (format: autostepper://audio/{id})
  const songId = downloadUrl.replace('autostepper://audio/', '');
  console.log('[fetchAudioBlob] songId:', songId);

  // Get the file path from Tauri
  const filePath = await invoke<string>('get_audio_path', { songId });
  console.log('[fetchAudioBlob] filePath:', filePath);

  // Use asset protocol for direct streaming
  const { convertFileSrc } = await import('@tauri-apps/api/core');
  const assetUrl = convertFileSrc(filePath);
  console.log('[fetchAudioBlob] assetUrl:', assetUrl);

  const response = await fetch(assetUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
  }

  const blob = await response.blob();
  console.log('[fetchAudioBlob] Got blob, size:', blob.size);
  return blob;
}

/**
 * Check if required dependencies are available
 */
export async function checkDependencies(): Promise<DependencyStatus> {
  if (!isTauri()) {
    return {
      ytdlp: false,
      ytdlp_path: null,
      deno: false,
      deno_path: null,
      ffmpeg: false,
      cookies_browser: null,
    };
  }

  return invoke<DependencyStatus>('check_dependencies');
}

/**
 * Validate a YouTube URL
 */
export function isValidYouTubeUrl(url: string): boolean {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    const validHosts = [
      'youtube.com',
      'www.youtube.com',
      'm.youtube.com',
      'youtu.be',
      'www.youtu.be',
      'youtube-nocookie.com',
      'www.youtube-nocookie.com',
    ];

    return validHosts.includes(parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * Extract video ID from YouTube URL
 */
export function extractVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);

    // youtu.be/VIDEO_ID
    if (parsed.hostname === 'youtu.be' || parsed.hostname === 'www.youtu.be') {
      return parsed.pathname.slice(1);
    }

    // youtube.com/watch?v=VIDEO_ID
    if (parsed.searchParams.has('v')) {
      return parsed.searchParams.get('v');
    }

    // youtube.com/embed/VIDEO_ID
    if (parsed.pathname.startsWith('/embed/')) {
      return parsed.pathname.split('/')[2];
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Get YouTube thumbnail URL
 */
export function getYouTubeThumbnail(videoId: string, quality: 'default' | 'medium' | 'high' | 'max' = 'medium'): string {
  const qualityMap = {
    default: 'default',
    medium: 'mqdefault',
    high: 'hqdefault',
    max: 'maxresdefault',
  };
  return `https://img.youtube.com/vi/${videoId}/${qualityMap[quality]}.jpg`;
}

/**
 * Check if download API is configured (always true in Tauri)
 */
export function isDownloadConfigured(): boolean {
  return isTauri();
}
