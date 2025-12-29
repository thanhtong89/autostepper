/**
 * YouTube download API client
 *
 * Communicates with the Tauri backend (or local dev server) to download YouTube audio.
 *
 * Set VITE_DOWNLOAD_API_URL in .env for local development:
 *   http://localhost:5000/download
 */

const DOWNLOAD_API_URL = import.meta.env.VITE_DOWNLOAD_API_URL || '';

export interface DownloadResponse {
  id: string;
  title: string;
  artist: string;
  duration: number;
  thumbnail: string;
  downloadUrl: string;
  fileSize: number;
}

export interface DownloadError {
  error: string;
}

/**
 * Request audio download from YouTube
 */
export async function downloadFromYouTube(youtubeUrl: string): Promise<DownloadResponse> {
  if (!DOWNLOAD_API_URL) {
    throw new Error('Download API URL not configured. Set VITE_DOWNLOAD_API_URL in your .env file.');
  }

  const response = await fetch(DOWNLOAD_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: youtubeUrl }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error((data as DownloadError).error || 'Download failed');
  }

  return data as DownloadResponse;
}

/**
 * Fetch audio file from download URL
 */
export async function fetchAudioBlob(downloadUrl: string): Promise<Blob> {
  const response = await fetch(downloadUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch audio: ${response.statusText}`);
  }

  return response.blob();
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
 * Check if download API is configured
 */
export function isDownloadConfigured(): boolean {
  return !!DOWNLOAD_API_URL;
}
