/**
 * Playlist management operations
 */
import { db, type Playlist, type Song } from './db';
import { getSong } from './library';

// Re-export types for convenience
export type { Playlist } from './db';

/**
 * Get all playlists
 */
export async function getPlaylists(): Promise<Playlist[]> {
  return db.playlists.orderBy('updatedAt').reverse().toArray();
}

/**
 * Get a single playlist by ID
 */
export async function getPlaylist(id: number): Promise<Playlist | undefined> {
  return db.playlists.get(id);
}

/**
 * Create a new playlist
 */
export async function createPlaylist(name: string, songIds: number[] = []): Promise<number> {
  const now = new Date().toISOString();
  return db.playlists.add({
    name,
    songIds,
    createdAt: now,
    updatedAt: now
  });
}

/**
 * Update a playlist
 */
export async function updatePlaylist(id: number, updates: Partial<Omit<Playlist, 'id' | 'createdAt'>>): Promise<void> {
  await db.playlists.update(id, {
    ...updates,
    updatedAt: new Date().toISOString()
  });
}

/**
 * Delete a playlist
 */
export async function deletePlaylist(id: number): Promise<void> {
  await db.playlists.delete(id);
}

/**
 * Add a song to a playlist
 */
export async function addSongToPlaylist(playlistId: number, songId: number): Promise<void> {
  const playlist = await db.playlists.get(playlistId);
  if (!playlist) throw new Error('Playlist not found');

  if (!playlist.songIds.includes(songId)) {
    await updatePlaylist(playlistId, {
      songIds: [...playlist.songIds, songId]
    });
  }
}

/**
 * Remove a song from a playlist
 */
export async function removeSongFromPlaylist(playlistId: number, songId: number): Promise<void> {
  const playlist = await db.playlists.get(playlistId);
  if (!playlist) throw new Error('Playlist not found');

  await updatePlaylist(playlistId, {
    songIds: playlist.songIds.filter(id => id !== songId)
  });
}

/**
 * Reorder songs in a playlist
 */
export async function reorderPlaylistSongs(playlistId: number, songIds: number[]): Promise<void> {
  await updatePlaylist(playlistId, { songIds });
}

/**
 * Get songs in a playlist with full metadata
 */
export async function getPlaylistSongs(playlistId: number): Promise<Song[]> {
  const playlist = await db.playlists.get(playlistId);
  if (!playlist) return [];

  const songs: Song[] = [];
  for (const songId of playlist.songIds) {
    const song = await getSong(songId);
    if (song) {
      songs.push(song);
    }
  }
  return songs;
}

/**
 * Get playlist count for a song (how many playlists contain this song)
 */
export async function getPlaylistCountForSong(songId: number): Promise<number> {
  const playlists = await db.playlists.toArray();
  return playlists.filter(p => p.songIds.includes(songId)).length;
}

/**
 * Duplicate a playlist
 */
export async function duplicatePlaylist(id: number, newName?: string): Promise<number> {
  const playlist = await db.playlists.get(id);
  if (!playlist) throw new Error('Playlist not found');

  return createPlaylist(
    newName || `${playlist.name} (Copy)`,
    [...playlist.songIds]
  );
}
