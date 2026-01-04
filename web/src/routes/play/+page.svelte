<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { getReadySongs, getAudioBlob, type Song } from '$lib/storage/library';
  import { getPlaylist, getPlaylistSongs, type Playlist } from '$lib/storage/playlists';
  import { createKeyboardHandler } from '$lib/navigation/keyboard';
  import { navigateList, scrollItemIntoView } from '$lib/navigation/focus';
  import { audioService } from '$lib/audio/audioService';
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

  // Audio loading state
  let audioLoading = $state(false);
  let loadedSongId = $state<number | null>(null);

  // Get playlist ID from URL if present
  let playlistId = $derived($page.url.searchParams.get('playlist'));

  // Preview plays when audio is loaded and we're in difficulty/start panel
  let isPreviewPlaying = $derived(loadedSongId !== null && activePanel !== 'songs');

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
          // Load audio and move to difficulty panel
          await loadAndPlayPreview(songId);
          activePanel = 'difficulty';
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

  async function loadAndPlayPreview(songId: number) {
    // Stop any current preview
    stopPreview();

    audioLoading = true;

    try {
      const blob = await getAudioBlob(songId);
      if (!blob || blob.size === 0) {
        console.error('No valid audio blob for song:', songId);
        audioLoading = false;
        return;
      }

      // Check if user switched songs while loading
      if (selectedSongId !== songId) {
        audioLoading = false;
        return;
      }

      // Decode audio (this blocks until done - intentional)
      console.log('[Preview] Loading audio for song:', songId);
      const duration = await audioService.loadAudio(blob);
      console.log('[Preview] Audio loaded, duration:', duration);

      // Check again if user switched
      if (selectedSongId !== songId) {
        audioLoading = false;
        return;
      }

      loadedSongId = songId;
      audioLoading = false;

      // Play 15-second looping preview starting at 30% into the song
      const previewStart = duration * 0.3;
      const previewDuration = Math.min(15, duration - previewStart);

      audioService.play({
        offset: previewStart,
        duration: previewDuration,
        loop: true,
        volume: 0.5
      });

    } catch (e) {
      console.error('Failed to load audio:', e);
      audioLoading = false;
    }
  }

  function stopPreview() {
    audioService.stop();
    // Note: We keep the audio loaded so the game can reuse it
    // Only unload when selecting a different song
  }

  function unloadAudio() {
    audioService.unload();
    loadedSongId = null;
  }

  function startGame() {
    if (!selectedSongId) return;
    // Stop preview but keep audio loaded for game
    audioService.stop();
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
    if (loading || audioLoading) return;

    if (action === 'back') {
      // Escape behavior depends on current panel
      if (activePanel === 'start') {
        activePanel = 'difficulty';
      } else if (activePanel === 'difficulty') {
        // Go back to song list, stop preview
        stopPreview();
        activePanel = 'songs';
      } else {
        // On song list, unload audio and go home
        unloadAudio();
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
        // Just highlight, don't select or play preview yet
        scrollItemIntoView(songElements[songFocusIndex]);
      } else if (action === 'right' && selectedSongId && loadedSongId === selectedSongId) {
        // Move to difficulty panel only if audio is loaded
        activePanel = 'difficulty';
        // Resume preview if it was stopped
        if (!audioService.isPlaying() && loadedSongId) {
          const song = songs.find(s => s.id === loadedSongId);
          if (song) {
            const previewStart = song.duration * 0.3;
            const previewDuration = Math.min(15, song.duration - previewStart);
            audioService.play({
              offset: previewStart,
              duration: previewDuration,
              loop: true,
              volume: 0.5
            });
          }
        }
      }
    } else if (activePanel === 'difficulty') {
      if (action === 'up' || action === 'down') {
        const result = navigateList(difficultyFocusIndex, action, 4);
        difficultyFocusIndex = result.index;
        selectedDifficulty = difficulties[difficultyFocusIndex].value;
        scrollItemIntoView(difficultyElements[difficultyFocusIndex]);
      }
      // No left/right - must use Enter to confirm or Escape to go back
    } else if (activePanel === 'start') {
      if (action === 'left') {
        activePanel = 'difficulty';
      } else if (action === 'up') {
        activePanel = 'difficulty';
      }
    }
  }

  async function handleSelect() {
    if (activePanel === 'songs') {
      if (songs.length > 0 && songs[songFocusIndex]?.id) {
        const songId = songs[songFocusIndex].id!;

        // If selecting a different song, unload previous
        if (loadedSongId !== null && loadedSongId !== songId) {
          unloadAudio();
        }

        selectedSongId = songId;

        // Load audio and play preview (blocks until loaded)
        await loadAndPlayPreview(songId);

        // Move to difficulty panel after loading
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
              onclick={async () => {
                if (song.id) {
                  songFocusIndex = i;
                  if (loadedSongId !== song.id) {
                    if (loadedSongId !== null) unloadAudio();
                    selectedSongId = song.id;
                    await loadAndPlayPreview(song.id);
                  }
                  activePanel = 'difficulty';
                }
              }}
              disabled={audioLoading}
              class="w-full text-left p-3 flex items-center gap-4 rounded-xl transition-all
                     {activePanel === 'songs' && songFocusIndex === i
                       ? 'nav-focused'
                       : selectedSongId === song.id
                         ? 'bg-[var(--color-game-accent)]/20 border-2 border-[var(--color-game-accent)]'
                         : 'bg-[var(--color-game-panel)] border border-[var(--color-game-border)] hover:border-[var(--color-game-accent)]'}
                     disabled:opacity-50"
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
                {#if audioLoading && selectedSongId === song.id}
                  <span class="text-game-accent text-xs">Loading...</span>
                {:else if loadedSongId === song.id && isPreviewPlaying}
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
              disabled={!selectedSongId || audioLoading}
              class="w-full text-left p-3 flex items-center justify-between rounded-xl transition-all
                     {activePanel === 'difficulty' && difficultyFocusIndex === i
                       ? 'nav-focused'
                       : selectedDifficulty === diff.value
                         ? 'bg-[var(--color-game-accent)]/20 border-2 border-[var(--color-game-accent)]'
                         : 'bg-[var(--color-game-panel)] border border-[var(--color-game-border)] hover:border-[var(--color-game-accent)]'}
                     disabled:opacity-50"
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
          disabled={!selectedSongId || audioLoading}
          class="btn-primary btn-lg w-full disabled:opacity-50 disabled:cursor-not-allowed transition-all
                 {activePanel === 'start' ? 'nav-focused-pulse' : ''}"
        >
          {#if audioLoading}
            Loading Audio...
          {:else if selectedSongId}
            Start Game
          {:else}
            Select a Song
          {/if}
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
