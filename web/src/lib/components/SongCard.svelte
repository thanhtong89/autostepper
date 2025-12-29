<script lang="ts">
  import type { Song } from '$lib/storage/db';
  import { extractVideoId, getYouTubeThumbnail } from '$lib/api/youtube';
  import { exportSongToZip, downloadBlob } from '$lib/formats/zip';

  interface Props {
    song: Song;
    focused?: boolean;
    onDelete?: () => void;
    onExport?: () => void;
  }

  let { song, focused = false, onDelete, onExport }: Props = $props();

  let exporting = $state(false);

  async function handleExport() {
    if (exporting || !song.id) return;
    exporting = true;

    try {
      const blob = await exportSongToZip(song.id);
      const filename = `${song.artist} - ${song.title}.zip`.replace(/[<>:"/\\|?*]/g, '_');
      downloadBlob(blob, filename);
      onExport?.();
    } catch (e) {
      console.error('Failed to export song:', e);
      alert('Failed to export song: ' + (e instanceof Error ? e.message : 'Unknown error'));
    } finally {
      exporting = false;
    }
  }

  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function getThumbnail(): string {
    if (song.thumbnail) return song.thumbnail;
    const videoId = extractVideoId(song.youtubeUrl);
    if (videoId) return getYouTubeThumbnail(videoId, 'medium');
    return '';
  }

  const statusColors = {
    ready: 'bg-game-success',
    processing: 'bg-game-warning',
    error: 'bg-game-error'
  };

  const statusLabels = {
    ready: 'Ready',
    processing: 'Processing...',
    error: 'Error'
  };
</script>

<div class="group relative overflow-hidden transition-all duration-150
            {focused ? 'card-nav-focused' : 'card-hover'}">
  <!-- Thumbnail -->
  <div class="aspect-video bg-game-border rounded-lg overflow-hidden mb-3 relative">
    {#if getThumbnail()}
      <img
        src={getThumbnail()}
        alt={song.title}
        class="w-full h-full object-cover"
      />
    {:else}
      <div class="w-full h-full flex items-center justify-center text-4xl">
        🎵
      </div>
    {/if}

    <!-- Status badge -->
    <div class="absolute top-2 right-2">
      <span class="px-2 py-1 rounded-full text-xs font-medium {statusColors[song.status]} bg-opacity-90">
        {statusLabels[song.status]}
      </span>
    </div>

    <!-- Duration badge -->
    <div class="absolute bottom-2 right-2">
      <span class="px-2 py-1 rounded bg-black/70 text-xs">
        {formatDuration(song.duration)}
      </span>
    </div>
  </div>

  <!-- Info -->
  <div class="mb-2">
    <h3 class="font-semibold truncate" title={song.title}>
      {song.title}
    </h3>
    <p class="text-gray-400 text-sm truncate" title={song.artist}>
      {song.artist}
    </p>
  </div>

  <!-- BPM -->
  <div class="flex items-center justify-between text-sm">
    <span class="text-gray-500">
      {song.bpm ? `${Math.round(song.bpm)} BPM` : 'Analyzing...'}
    </span>
    {#if song.status === 'ready'}
      <a
        href="/play?song={song.id}"
        class="text-game-accent hover:text-game-accent-light"
      >
        Play →
      </a>
    {/if}
  </div>

  <!-- Error message -->
  {#if song.status === 'error' && song.errorMessage}
    <p class="mt-2 text-xs text-game-error truncate" title={song.errorMessage}>
      {song.errorMessage}
    </p>
  {/if}

  <!-- Action buttons (shown on hover or focus) -->
  <div class="absolute top-2 left-2 flex gap-1 transition-opacity
              {focused ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}">
    {#if song.status === 'ready'}
      <button
        onclick={(e) => { e.preventDefault(); e.stopPropagation(); handleExport(); }}
        disabled={exporting}
        class="p-1.5 rounded-full bg-black/50 text-white hover:bg-game-accent disabled:opacity-50"
        title="Export for ITGMania"
      >
        {#if exporting}
          <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
        {:else}
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
        {/if}
      </button>
    {/if}

    {#if onDelete}
      <button
        onclick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete?.(); }}
        class="p-1.5 rounded-full bg-black/50 text-white hover:bg-game-error"
        title="Delete song"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
        </svg>
      </button>
    {/if}
  </div>
</div>
