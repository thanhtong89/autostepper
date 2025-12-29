<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { getReadySongs, getAudioBlob, type Song } from '$lib/storage/library';
  import { getPlaylist, getPlaylistSongs, type Playlist } from '$lib/storage/playlists';
  import { createKeyboardHandler } from '$lib/navigation/keyboard';
  import { navigateList, scrollItemIntoView } from '$lib/navigation/focus';
  import type { NavigationAction } from '$lib/navigation/types';

  let songs = $state<Song[]>([]);
  let playlist = $state<Playlist | null>(null);
  let loading = $state(true);
  let selectedSongId = $state<number | null>(null);
  let selectedDifficulty = $state<'easy' | 'medium' | 'hard' | 'expert'>('medium');

  // Navigation state
  type Panel = 'songs' | 'difficulty' | 'start';
  let activePanel = $state<Panel>('songs');
  let songFocusIndex = $state(0);
  let difficultyFocusIndex = $state(1); // Medium is default (index 1)
  let songElements: HTMLElement[] = [];
  let difficultyElements: HTMLElement[] = [];
  let startButtonElement: HTMLElement;

  // Song preview
  let previewAudio: HTMLAudioElement | null = null;
  let previewUrl: string | null = null;
  let isPreviewPlaying = $state(false);
  let previewTimeout: ReturnType<typeof setTimeout> | null = null;
  let fadeInterval: ReturnType<typeof setInterval> | null = null;

  // Get playlist ID from URL if present
  let playlistId = $derived($page.url.searchParams.get('playlist'));

  onMount(async () => {
    try {
      const plId = $page.url.searchParams.get('playlist');
      if (plId) {
        const pl = await getPlaylist(parseInt(plId));
        if (pl) {
          playlist = pl;
          songs = await getPlaylistSongs(pl.id!);
        }
      } else {
        songs = await getReadySongs();
      }

      // Check for pre-selected song from library
      const preselectedSongId = $page.url.searchParams.get('song');
      if (preselectedSongId) {
        const songId = parseInt(preselectedSongId);
        const songIndex = songs.findIndex(s => s.id === songId);
        if (songIndex >= 0) {
          songFocusIndex = songIndex;
          selectedSongId = songId;
          activePanel = 'difficulty';
          // Start preview
          playPreview(songId);
          // Scroll selected song into view after DOM updates
          requestAnimationFrame(() => {
            scrollItemIntoView(songElements[songIndex]);
          });
        }
      }
    } catch (e) {
      console.error('Failed to load songs:', e);
    }
    loading = false;
  });

  onDestroy(() => {
    stopPreview();
  });

  async function selectSong(songId: number) {
    if (selectedSongId === songId) return;

    selectedSongId = songId;
    await playPreview(songId);
  }

  async function playPreview(songId: number) {
    // Stop any current preview
    stopPreview();

    try {
      const blob = await getAudioBlob(songId);

      // Dump blob stats
      console.log('[playPreview] Blob stats:', {
        songId,
        exists: !!blob,
        size: blob?.size,
        type: blob?.type,
        isBlob: blob instanceof Blob,
      });

      if (!blob || blob.size === 0) {
        console.log('[playPreview] No valid blob for songId:', songId);
        return;
      }

      // Check first few bytes to verify it's valid audio
      const header = await blob.slice(0, 16).arrayBuffer();
      const headerBytes = new Uint8Array(header);
      console.log('[playPreview] First 16 bytes:', Array.from(headerBytes).map(b => b.toString(16).padStart(2, '0')).join(' '));

      // Check if we switched songs while loading
      if (selectedSongId !== songId) return;

      // Get song info for seek position
      const song = songs.find(s => s.id === songId);
      const startTime = song ? song.duration * 0.3 : 0;

      // Ensure blob has correct MIME type (may be lost in IndexedDB storage)
      const typedBlob = blob.type === 'audio/mpeg' ? blob : new Blob([blob], { type: 'audio/mpeg' });
      previewUrl = URL.createObjectURL(typedBlob);
      console.log('[playPreview] Created URL:', previewUrl, 'blob type:', typedBlob.type);

      previewAudio = new Audio();
      previewAudio.volume = 0.5;
      previewAudio.preload = 'auto';

      // Step 1: Set src and wait for metadata (so we can seek)
      await new Promise<void>((resolve, reject) => {
        if (!previewAudio) return reject(new Error('No audio element'));
        previewAudio.onloadedmetadata = () => {
          console.log('[playPreview] Metadata loaded, duration:', previewAudio?.duration);
          resolve();
        };
        previewAudio.onerror = () => reject(previewAudio?.error || new Error('Load failed'));
        previewAudio.src = previewUrl;
      });

      if (selectedSongId !== songId || !previewAudio) return;

      // Step 2: Seek to start position and wait for seek to complete
      await new Promise<void>((resolve, reject) => {
        if (!previewAudio) return reject(new Error('No audio element'));
        previewAudio.onseeked = () => resolve();
        previewAudio.onerror = () => reject(previewAudio?.error || new Error('Seek failed'));
        previewAudio.currentTime = startTime;
      });

      if (selectedSongId !== songId || !previewAudio) return;

      // Step 3: Play, then enable loop
      await previewAudio.play();
      previewAudio.loop = true;
      isPreviewPlaying = true;

      // Fade out after 15 seconds and restart
      previewTimeout = setTimeout(() => {
        if (previewAudio && isPreviewPlaying && selectedSongId === songId) {
          fadeOutAndRestart(songId);
        }
      }, 15000);
    } catch (e) {
      console.error('[playPreview] Failed:', e);
    }
  }

  function fadeOutAndRestart(songId: number) {
    if (!previewAudio) return;

    // Clear any existing fade interval
    if (fadeInterval) {
      clearInterval(fadeInterval);
    }

    fadeInterval = setInterval(() => {
      // Stop if song changed or audio cleared
      if (!previewAudio || selectedSongId !== songId) {
        if (fadeInterval) {
          clearInterval(fadeInterval);
          fadeInterval = null;
        }
        return;
      }

      if (previewAudio.volume > 0.05) {
        previewAudio.volume = Math.max(0, previewAudio.volume - 0.05);
      } else {
        if (fadeInterval) {
          clearInterval(fadeInterval);
          fadeInterval = null;
        }
        // Reset to start of preview section
        const song = songs.find(s => s.id === songId);
        if (song && previewAudio && selectedSongId === songId) {
          previewAudio.currentTime = song.duration * 0.3;
          previewAudio.volume = 0.5;

          // Schedule next fade cycle
          previewTimeout = setTimeout(() => {
            if (previewAudio && isPreviewPlaying && selectedSongId === songId) {
              fadeOutAndRestart(songId);
            }
          }, 15000);
        }
      }
    }, 50);
  }

  function stopPreview() {
    // Clear timers first
    if (previewTimeout) {
      clearTimeout(previewTimeout);
      previewTimeout = null;
    }
    if (fadeInterval) {
      clearInterval(fadeInterval);
      fadeInterval = null;
    }

    // Stop and cleanup audio
    if (previewAudio) {
      previewAudio.pause();
      previewAudio = null;
    }
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = null;
    }
    isPreviewPlaying = false;
  }

  function startGame() {
    if (!selectedSongId) return;
    stopPreview();
    goto(`/play/game?songId=${selectedSongId}&difficulty=${selectedDifficulty}`);
  }

  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  const difficulties = [
    { value: 'easy', label: 'Easy', feet: 2, color: 'text-green-400' },
    { value: 'medium', label: 'Medium', feet: 4, color: 'text-yellow-400' },
    { value: 'hard', label: 'Hard', feet: 6, color: 'text-orange-400' },
    { value: 'expert', label: 'Expert', feet: 8, color: 'text-red-400' },
  ] as const;

  function handleNavigation(action: NavigationAction) {
    if (loading) return;

    if (action === 'back') {
      // Escape behavior depends on current panel
      if (activePanel === 'start') {
        activePanel = 'songs';
      } else {
        stopPreview();
        goto('/');
      }
      return;
    }

    if (action === 'select') {
      handleSelect();
      return;
    }

    // Navigation depends on current panel
    if (activePanel === 'songs') {
      if (songs.length === 0) return;

      if (action === 'up' || action === 'down') {
        const result = navigateList(songFocusIndex, action, songs.length);
        songFocusIndex = result.index;
        // Auto-select and preview the song
        const song = songs[songFocusIndex];
        if (song?.id) {
          selectSong(song.id);
        }
        scrollItemIntoView(songElements[songFocusIndex]);
      } else if (action === 'right' && selectedSongId) {
        // Move to difficulty panel
        activePanel = 'difficulty';
      }
    } else if (activePanel === 'difficulty') {
      // Difficulty panel - locked to up/down only
      if (action === 'up' || action === 'down') {
        const result = navigateList(difficultyFocusIndex, action, 4);
        difficultyFocusIndex = result.index;
        selectedDifficulty = difficulties[difficultyFocusIndex].value;
        scrollItemIntoView(difficultyElements[difficultyFocusIndex]);
      }
      // No left/right - must use Enter to confirm or Escape to go back
    } else if (activePanel === 'start') {
      // Start button focused
      if (action === 'left') {
        activePanel = 'songs';
      } else if (action === 'up') {
        activePanel = 'difficulty';
      }
    }
  }

  function handleSelect() {
    if (activePanel === 'songs') {
      if (songs.length > 0 && songs[songFocusIndex]?.id) {
        selectSong(songs[songFocusIndex].id!);
        // Move to difficulty panel after selecting
        activePanel = 'difficulty';
      }
    } else if (activePanel === 'difficulty') {
      // Confirm difficulty selection, move to start button
      selectedDifficulty = difficulties[difficultyFocusIndex].value;
      activePanel = 'start';
    } else if (activePanel === 'start') {
      // Start the game
      if (selectedSongId) {
        startGame();
      }
    }
  }

  const keyHandler = createKeyboardHandler(handleNavigation);
</script>

<svelte:window onkeydown={keyHandler} />

<svelte:head>
  <title>Play - AutoStepper</title>
</svelte:head>

<div class="max-w-4xl mx-auto px-4 py-8">
  <!-- Header -->
  <div class="mb-8">
    <h1 class="text-3xl font-bold">
      {playlist ? `Playing: ${playlist.name}` : 'Select a Song'}
    </h1>
    <p class="text-gray-400 mt-1">
      Choose a song and difficulty to start playing
    </p>
  </div>

  <!-- Content -->
  {#if loading}
    <div class="flex items-center justify-center py-20">
      <div class="text-gray-400">Loading...</div>
    </div>
  {:else if songs.length === 0}
    <!-- Empty state -->
    <div class="card text-center py-16">
      <div class="text-6xl mb-4">🎮</div>
      <h2 class="text-xl font-semibold mb-2">No songs available</h2>
      <p class="text-gray-400 mb-6">
        Add songs to your library first, then come back to play
      </p>
      <a href="/library" class="btn-primary">
        Go to Library
      </a>
    </div>
  {:else}
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <!-- Song Selection -->
      <div class="lg:col-span-2">
        <h2 class="text-lg font-semibold mb-4 flex items-center gap-2">
          Songs
          {#if activePanel === 'songs'}
            <span class="text-xs text-game-accent">(active)</span>
          {/if}
        </h2>
        <div class="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
          {#each songs as song, i (song.id)}
            <button
              bind:this={songElements[i]}
              onclick={() => selectSong(song.id!)}
              class="w-full text-left p-3 flex items-center gap-4 rounded-xl transition-all
                     {activePanel === 'songs' && songFocusIndex === i
                       ? 'nav-focused'
                       : selectedSongId === song.id
                         ? 'bg-[var(--color-game-accent)]/20 border-2 border-[var(--color-game-accent)]'
                         : 'bg-[var(--color-game-panel)] border border-[var(--color-game-border)] hover:border-[var(--color-game-accent)]'}"
            >
              {#if song.thumbnail}
                <img
                  src={song.thumbnail}
                  alt={song.title}
                  class="w-16 h-12 object-cover rounded"
                />
              {:else}
                <div class="w-16 h-12 bg-game-border rounded flex items-center justify-center text-2xl">
                  🎵
                </div>
              {/if}
              <div class="flex-1 min-w-0">
                <div class="font-medium truncate">{song.title}</div>
                <div class="text-sm text-gray-400 truncate">{song.artist}</div>
              </div>
              <div class="flex items-center gap-2">
                {#if selectedSongId === song.id && isPreviewPlaying}
                  <span class="text-[var(--color-game-accent)] text-xs animate-pulse">Playing</span>
                {/if}
                <span class="text-gray-500 text-sm">
                  {formatDuration(song.duration)}
                </span>
              </div>
            </button>
          {/each}
        </div>
      </div>

      <!-- Difficulty Selection -->
      <div>
        <h2 class="text-lg font-semibold mb-4 flex items-center gap-2">
          Difficulty
          {#if activePanel === 'difficulty' || activePanel === 'start'}
            <span class="text-xs text-game-accent">(active)</span>
          {/if}
        </h2>
        <div class="space-y-2 mb-8">
          {#each difficulties as diff, i}
            <button
              bind:this={difficultyElements[i]}
              onclick={() => { selectedDifficulty = diff.value; difficultyFocusIndex = i; }}
              class="w-full text-left p-3 flex items-center justify-between rounded-xl transition-all
                     {activePanel === 'difficulty' && difficultyFocusIndex === i
                       ? 'nav-focused'
                       : selectedDifficulty === diff.value
                         ? 'bg-[var(--color-game-accent)]/20 border-2 border-[var(--color-game-accent)]'
                         : 'bg-[var(--color-game-panel)] border border-[var(--color-game-border)] hover:border-[var(--color-game-accent)]'}"
            >
              <div class="flex items-center gap-3">
                <span class={diff.color}>{diff.label}</span>
              </div>
              <div class="flex items-center gap-1 text-gray-500 text-sm">
                {#each Array(diff.feet) as _}
                  <span>👣</span>
                {/each}
              </div>
            </button>
          {/each}
        </div>

        <!-- Start Button -->
        <button
          bind:this={startButtonElement}
          onclick={startGame}
          disabled={!selectedSongId}
          class="btn-primary btn-lg w-full disabled:opacity-50 disabled:cursor-not-allowed transition-all
                 {activePanel === 'start' ? 'nav-focused-pulse' : ''}"
        >
          {selectedSongId ? 'Start Game' : 'Select a Song'}
        </button>

        <!-- Controls reminder -->
        <div class="mt-6 text-sm text-gray-500">
          <p class="mb-2">Controls:</p>
          <div class="flex justify-center gap-4">
            <span>Left Down Up Right</span>
            <span>or</span>
            <span>Dance Pad</span>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>
