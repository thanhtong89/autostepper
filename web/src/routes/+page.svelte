<script lang="ts">
  import { onMount } from 'svelte';
  import { getSongs } from '$lib/storage/library';
  import { getPlaylists } from '$lib/storage/playlists';

  let songCount = $state(0);
  let playlistCount = $state(0);
  let loading = $state(true);

  onMount(async () => {
    try {
      const songs = await getSongs();
      const playlists = await getPlaylists();
      songCount = songs.length;
      playlistCount = playlists.length;
    } catch (e) {
      console.error('Failed to load stats:', e);
    }
    loading = false;
  });
</script>

<svelte:head>
  <title>AutoStepper - Dance Game</title>
</svelte:head>

<div class="max-w-4xl mx-auto px-4 py-12">
  <!-- Hero -->
  <div class="text-center mb-12">
    <h1 class="text-5xl font-bold mb-4">
      <span class="bg-gradient-to-r from-game-accent via-purple-500 to-pink-500 bg-clip-text text-transparent">
        AutoStepper
      </span>
    </h1>
    <p class="text-xl text-gray-400 mb-2">
      Dance to any YouTube song
    </p>
    <p class="text-gray-500">
      Auto-generated step charts &bull; Play with keyboard or dance pad
    </p>
  </div>

  <!-- Main Actions -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
    <!-- Song Library -->
    <a href="/library" class="card-hover group">
      <div class="text-4xl mb-3">🎵</div>
      <h2 class="text-xl font-semibold mb-2 group-hover:text-game-accent transition-colors">
        Song Library
      </h2>
      <p class="text-gray-400 text-sm mb-3">
        Add songs from YouTube and manage your collection
      </p>
      {#if loading}
        <div class="text-gray-500 text-sm">Loading...</div>
      {:else}
        <div class="text-game-accent font-medium">
          {songCount} {songCount === 1 ? 'song' : 'songs'}
        </div>
      {/if}
    </a>

    <!-- Playlists -->
    <a href="/playlists" class="card-hover group">
      <div class="text-4xl mb-3">📋</div>
      <h2 class="text-xl font-semibold mb-2 group-hover:text-game-accent transition-colors">
        Playlists
      </h2>
      <p class="text-gray-400 text-sm mb-3">
        Create playlists for party mode or practice sessions
      </p>
      {#if loading}
        <div class="text-gray-500 text-sm">Loading...</div>
      {:else}
        <div class="text-game-accent font-medium">
          {playlistCount} {playlistCount === 1 ? 'playlist' : 'playlists'}
        </div>
      {/if}
    </a>

    <!-- Play -->
    <a href="/play" class="card-hover group">
      <div class="text-4xl mb-3">🎮</div>
      <h2 class="text-xl font-semibold mb-2 group-hover:text-game-accent transition-colors">
        Play Now
      </h2>
      <p class="text-gray-400 text-sm mb-3">
        Start a game session with your favorite songs
      </p>
      <div class="text-game-accent font-medium">
        Start Game →
      </div>
    </a>
  </div>

  <!-- Quick Start Guide -->
  <div class="card">
    <h2 class="text-lg font-semibold mb-4">Quick Start</h2>
    <ol class="space-y-3 text-gray-300">
      <li class="flex items-start gap-3">
        <span class="flex-shrink-0 w-6 h-6 rounded-full bg-game-accent text-white text-sm flex items-center justify-center">
          1
        </span>
        <span>Go to <a href="/library" class="text-game-accent hover:underline">Song Library</a> and add a YouTube URL</span>
      </li>
      <li class="flex items-start gap-3">
        <span class="flex-shrink-0 w-6 h-6 rounded-full bg-game-accent text-white text-sm flex items-center justify-center">
          2
        </span>
        <span>Wait for the song to download and charts to generate</span>
      </li>
      <li class="flex items-start gap-3">
        <span class="flex-shrink-0 w-6 h-6 rounded-full bg-game-accent text-white text-sm flex items-center justify-center">
          3
        </span>
        <span>Go to <a href="/play" class="text-game-accent hover:underline">Play</a> and select your song</span>
      </li>
      <li class="flex items-start gap-3">
        <span class="flex-shrink-0 w-6 h-6 rounded-full bg-game-accent text-white text-sm flex items-center justify-center">
          4
        </span>
        <span>Use arrow keys or connect a dance pad to play!</span>
      </li>
    </ol>
  </div>

  <!-- Controls Reference -->
  <div class="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
    <div class="card">
      <h3 class="font-semibold mb-3 flex items-center gap-2">
        <span>⌨️</span>
        Keyboard Controls
      </h3>
      <div class="grid grid-cols-2 gap-2 text-sm">
        <div class="flex items-center gap-2">
          <kbd class="px-2 py-1 bg-game-bg rounded border border-game-border">←</kbd>
          <span class="text-gray-400">Left</span>
        </div>
        <div class="flex items-center gap-2">
          <kbd class="px-2 py-1 bg-game-bg rounded border border-game-border">↓</kbd>
          <span class="text-gray-400">Down</span>
        </div>
        <div class="flex items-center gap-2">
          <kbd class="px-2 py-1 bg-game-bg rounded border border-game-border">↑</kbd>
          <span class="text-gray-400">Up</span>
        </div>
        <div class="flex items-center gap-2">
          <kbd class="px-2 py-1 bg-game-bg rounded border border-game-border">→</kbd>
          <span class="text-gray-400">Right</span>
        </div>
        <div class="flex items-center gap-2 col-span-2 mt-2">
          <kbd class="px-2 py-1 bg-game-bg rounded border border-game-border">Esc</kbd>
          <span class="text-gray-400">Pause</span>
        </div>
      </div>
    </div>

    <div class="card">
      <h3 class="font-semibold mb-3 flex items-center gap-2">
        <span>🎮</span>
        Dance Pad
      </h3>
      <p class="text-gray-400 text-sm">
        Connect any USB dance pad that's recognized as a game controller.
        The Gamepad API will automatically detect button presses.
      </p>
      <p class="text-gray-500 text-xs mt-2">
        Tested with DDRPad, L-TEK, and StepMania pads.
      </p>
    </div>
  </div>
</div>
