<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { getSongs, deleteSong, type Song } from '$lib/storage/library';
  import { importFromZip, exportSongToZip, downloadBlob, type ImportResult } from '$lib/formats/zip';
  import AddSongModal from '$lib/components/AddSongModal.svelte';
  import SongCard from '$lib/components/SongCard.svelte';
  import { createKeyboardHandler } from '$lib/navigation/keyboard';
  import { navigateGrid, navigateHorizontal, navigateList, scrollItemIntoView } from '$lib/navigation/focus';
  import type { NavigationAction } from '$lib/navigation/types';

  let songs = $state<Song[]>([]);
  let loading = $state(true);
  let showAddModal = $state(false);
  let deleteConfirmId = $state<number | null>(null);

  // Song action menu state
  let songMenuId = $state<number | null>(null);
  let songMenuIndex = $state(0); // 0=Play, 1=Export, 2=Delete
  let exporting = $state(false);

  // Import state
  let importing = $state(false);
  let importProgress = $state('');
  let importResult = $state<ImportResult | null>(null);
  let fileInput: HTMLInputElement;

  // Navigation state
  type Zone = 'action' | 'grid';
  let activeZone = $state<Zone>('action');
  let actionFocusIndex = $state(0); // 0=Import, 1=Add Song
  let gridFocusIndex = $state(0);
  let songElements: HTMLElement[] = [];
  let gridContainer: HTMLElement;

  // Dynamic grid columns based on actual layout
  let gridColumns = $state(4);

  function updateGridColumns() {
    if (!gridContainer || songElements.length < 2) {
      gridColumns = 4;
      return;
    }
    // Count how many items share the same top offset (same row)
    const firstTop = songElements[0]?.offsetTop;
    let cols = 1;
    for (let i = 1; i < songElements.length; i++) {
      if (songElements[i]?.offsetTop === firstTop) {
        cols++;
      } else {
        break;
      }
    }
    gridColumns = cols;
  }

  async function loadSongs() {
    try {
      songs = await getSongs();
    } catch (e) {
      console.error('Failed to load songs:', e);
    }
    loading = false;
    // Update grid columns after DOM updates
    requestAnimationFrame(updateGridColumns);
  }

  onMount(loadSongs);

  function handleResize() {
    updateGridColumns();
  }

  async function handleSongAdded() {
    showAddModal = false;
    await loadSongs();
  }

  async function handleDelete(id: number) {
    try {
      await deleteSong(id);
      songs = songs.filter(s => s.id !== id);
      deleteConfirmId = null;
    } catch (e) {
      console.error('Failed to delete song:', e);
    }
  }

  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function triggerImport() {
    fileInput?.click();
  }

  async function handleFileSelect(e: Event) {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    importing = true;
    importProgress = '';
    importResult = null;

    try {
      const result = await importFromZip(file, (msg) => {
        importProgress = msg;
      });
      importResult = result;

      if (result.songsImported > 0) {
        await loadSongs();
      }
    } catch (e) {
      importResult = {
        success: false,
        songsImported: 0,
        errors: [e instanceof Error ? e.message : 'Unknown error'],
        songs: []
      };
    } finally {
      importing = false;
      // Reset file input
      target.value = '';
    }
  }

  function handleNavigation(action: NavigationAction) {
    // Handle song action menu navigation
    if (songMenuId !== null) {
      if (action === 'back') {
        songMenuId = null;
        songMenuIndex = 0;
      } else if (action === 'up' || action === 'down') {
        const result = navigateList(songMenuIndex, action, 3);
        songMenuIndex = result.index;
      } else if (action === 'select') {
        executeSongMenuAction();
      }
      return;
    }

    // Don't navigate when modal is open
    if (showAddModal || deleteConfirmId !== null || importing || importResult) {
      if (action === 'back') {
        showAddModal = false;
        deleteConfirmId = null;
        importResult = null;
      }
      return;
    }

    if (loading) return;

    if (action === 'back') {
      goto('/');
      return;
    }

    if (action === 'select') {
      handleSelect();
      return;
    }

    if (activeZone === 'action') {
      // Action bar navigation
      if (action === 'left' || action === 'right') {
        const result = navigateHorizontal(actionFocusIndex, action, 2);
        actionFocusIndex = result.index;
      } else if (action === 'down' && songs.length > 0) {
        activeZone = 'grid';
        gridFocusIndex = 0;
      }
    } else {
      // Grid navigation
      const result = navigateGrid(gridFocusIndex, action, gridColumns, songs.length);
      if (result.escaped === 'up') {
        activeZone = 'action';
      } else {
        gridFocusIndex = result.index;
        scrollItemIntoView(songElements[gridFocusIndex]);
      }
    }
  }

  async function executeSongMenuAction() {
    const song = songs.find(s => s.id === songMenuId);
    if (!song?.id) return;

    switch (songMenuIndex) {
      case 0: // Play
        if (song.status === 'ready') {
          goto(`/play?song=${song.id}`);
        }
        songMenuId = null;
        break;
      case 1: // Export
        if (song.status === 'ready' && !exporting) {
          exporting = true;
          try {
            const blob = await exportSongToZip(song.id);
            const filename = `${song.artist} - ${song.title}.zip`.replace(/[<>:"/\\|?*]/g, '_');
            downloadBlob(blob, filename);
          } catch (e) {
            console.error('Failed to export song:', e);
            alert('Failed to export song: ' + (e instanceof Error ? e.message : 'Unknown error'));
          } finally {
            exporting = false;
          }
        }
        songMenuId = null;
        break;
      case 2: // Delete
        deleteConfirmId = song.id;
        songMenuId = null;
        break;
    }
    songMenuIndex = 0;
  }

  function handleSelect() {
    if (activeZone === 'action') {
      if (actionFocusIndex === 0) {
        triggerImport();
      } else {
        showAddModal = true;
      }
    } else {
      // Grid - open song action menu
      const song = songs[gridFocusIndex];
      if (song?.id) {
        songMenuId = song.id;
        songMenuIndex = 0;
      }
    }
  }

  const keyHandler = createKeyboardHandler(handleNavigation);
</script>

<svelte:window onkeydown={keyHandler} onresize={handleResize} />

<svelte:head>
  <title>Song Library - AutoStepper</title>
</svelte:head>

<div class="max-w-6xl mx-auto px-4 py-8">
  <!-- Hidden file input for import -->
  <input
    type="file"
    accept=".zip"
    bind:this={fileInput}
    onchange={handleFileSelect}
    class="hidden"
  />

  <!-- Header -->
  <div class="flex items-center justify-between mb-8">
    <div>
      <h1 class="text-3xl font-bold">Song Library</h1>
      <p class="text-gray-400 mt-1">
        {songs.length} {songs.length === 1 ? 'song' : 'songs'} in your library
      </p>
    </div>
    <div class="flex gap-3">
      <button
        onclick={triggerImport}
        disabled={importing}
        class="btn-secondary btn-lg flex items-center gap-2 transition-all
               {activeZone === 'action' && actionFocusIndex === 0 ? 'nav-focused' : ''}"
        title="Import StepMania songs (.zip with .ssc/.sm files)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clip-rule="evenodd" />
        </svg>
        <span>{importing ? 'Importing...' : 'Import'}</span>
      </button>
      <button
        onclick={() => showAddModal = true}
        class="btn-primary btn-lg flex items-center gap-2 transition-all
               {activeZone === 'action' && actionFocusIndex === 1 ? 'nav-focused-pulse' : ''}"
      >
        <span>+</span>
        <span>Add Song</span>
      </button>
    </div>
  </div>

  <!-- Content -->
  {#if loading}
    <div class="flex items-center justify-center py-20">
      <div class="text-gray-400">Loading...</div>
    </div>
  {:else if songs.length === 0}
    <!-- Empty state -->
    <div class="card text-center py-16">
      <div class="text-6xl mb-4">🎵</div>
      <h2 class="text-xl font-semibold mb-2">No songs yet</h2>
      <p class="text-gray-400 mb-6">
        Add your first song from YouTube to get started
      </p>
      <button
        onclick={() => showAddModal = true}
        class="btn-primary"
      >
        Add Your First Song
      </button>
    </div>
  {:else}
    <!-- Song grid -->
    <div bind:this={gridContainer} class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {#each songs as song, i (song.id)}
        <div bind:this={songElements[i]}>
          <SongCard
            {song}
            focused={activeZone === 'grid' && gridFocusIndex === i}
            onDelete={() => deleteConfirmId = song.id ?? null}
          />
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Add Song Modal -->
{#if showAddModal}
  <AddSongModal
    onClose={() => showAddModal = false}
    onSuccess={handleSongAdded}
  />
{/if}

<!-- Song Action Menu -->
{#if songMenuId !== null}
  {@const menuSong = songs.find(s => s.id === songMenuId)}
  <div class="modal-overlay" onclick={() => { songMenuId = null; songMenuIndex = 0; }}>
    <div class="modal-content max-w-xs" onclick={(e) => e.stopPropagation()}>
      <h2 class="text-lg font-semibold mb-1 truncate">{menuSong?.title}</h2>
      <p class="text-sm text-gray-400 mb-4 truncate">{menuSong?.artist}</p>

      <div class="space-y-2">
        <button
          onclick={() => executeSongMenuAction()}
          disabled={menuSong?.status !== 'ready'}
          class="w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-all
                 {songMenuIndex === 0 ? 'nav-focused-pulse' : 'bg-[var(--color-game-panel)] hover:bg-[var(--color-game-border)]'}
                 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span class="text-xl">▶</span>
          <span>Play</span>
        </button>

        <button
          onclick={() => { songMenuIndex = 1; executeSongMenuAction(); }}
          disabled={menuSong?.status !== 'ready' || exporting}
          class="w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-all
                 {songMenuIndex === 1 ? 'nav-focused' : 'bg-[var(--color-game-panel)] hover:bg-[var(--color-game-border)]'}
                 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span class="text-xl">{exporting ? '...' : '⬇'}</span>
          <span>{exporting ? 'Exporting...' : 'Export'}</span>
        </button>

        <button
          onclick={() => { songMenuIndex = 2; executeSongMenuAction(); }}
          class="w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-all text-game-error
                 {songMenuIndex === 2 ? 'nav-focused' : 'bg-[var(--color-game-panel)] hover:bg-[var(--color-game-border)]'}"
        >
          <span class="text-xl">✕</span>
          <span>Delete</span>
        </button>
      </div>

      <p class="text-xs text-gray-500 mt-4 text-center">Use ↑↓ to navigate, Enter to select, Esc to close</p>
    </div>
  </div>
{/if}

<!-- Delete Confirmation Modal -->
{#if deleteConfirmId !== null}
  {@const songToDelete = songs.find(s => s.id === deleteConfirmId)}
  <div class="modal-overlay" onclick={() => deleteConfirmId = null}>
    <div class="modal-content" onclick={(e) => e.stopPropagation()}>
      <h2 class="text-xl font-semibold mb-4">Delete Song?</h2>
      <p class="text-gray-400 mb-6">
        Are you sure you want to delete "{songToDelete?.title}"? This will remove the song and all its data.
      </p>
      <div class="flex gap-3 justify-end">
        <button
          onclick={() => deleteConfirmId = null}
          class="btn-secondary"
        >
          Cancel
        </button>
        <button
          onclick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
          class="btn-danger"
        >
          Delete
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Import Progress Modal -->
{#if importing}
  <div class="modal-overlay">
    <div class="modal-content text-center">
      <div class="animate-spin h-12 w-12 border-4 border-[var(--color-game-accent)] border-t-transparent rounded-full mx-auto mb-4"></div>
      <h2 class="text-xl font-semibold mb-2">Importing Songs</h2>
      <p class="text-gray-400">{importProgress || 'Please wait...'}</p>
    </div>
  </div>
{/if}

<!-- Import Result Modal -->
{#if importResult}
  <div class="modal-overlay" onclick={() => importResult = null}>
    <div class="modal-content" onclick={(e) => e.stopPropagation()}>
      <h2 class="text-xl font-semibold mb-4">
        {importResult.success ? 'Import Complete' : 'Import Failed'}
      </h2>

      {#if importResult.songsImported > 0}
        <div class="mb-4">
          <p class="text-green-400 mb-2">
            Successfully imported {importResult.songsImported} song{importResult.songsImported > 1 ? 's' : ''}:
          </p>
          <ul class="text-sm text-gray-400 space-y-1 max-h-32 overflow-y-auto">
            {#each importResult.songs as song}
              <li>{song.artist} - {song.title}</li>
            {/each}
          </ul>
        </div>
      {/if}

      {#if importResult.errors.length > 0}
        <div class="mb-4">
          <p class="text-red-400 mb-2">Errors:</p>
          <ul class="text-sm text-gray-400 space-y-1 max-h-32 overflow-y-auto">
            {#each importResult.errors as error}
              <li class="text-red-300">{error}</li>
            {/each}
          </ul>
        </div>
      {/if}

      <div class="flex justify-end">
        <button
          onclick={() => importResult = null}
          class="btn-primary"
        >
          OK
        </button>
      </div>
    </div>
  </div>
{/if}
