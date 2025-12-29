<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { getPlaylists, createPlaylist, deletePlaylist, type Playlist } from '$lib/storage/playlists';
  import { getSongs, type Song } from '$lib/storage/library';
  import { createKeyboardHandler } from '$lib/navigation/keyboard';
  import { navigateList, navigateHorizontal, scrollItemIntoView } from '$lib/navigation/focus';
  import type { NavigationAction } from '$lib/navigation/types';

  let playlists = $state<Playlist[]>([]);
  let songs = $state<Song[]>([]);
  let loading = $state(true);
  let showCreateModal = $state(false);
  let newPlaylistName = $state('');
  let deleteConfirmId = $state<number | null>(null);

  // Navigation state
  type Zone = 'action' | 'list';
  let activeZone = $state<Zone>('action');
  let playlistFocusIndex = $state(0);
  let actionFocusIndex = $state(0); // 0=Play, 1=Delete
  let playlistElements: HTMLElement[] = [];

  async function loadData() {
    try {
      playlists = await getPlaylists();
      songs = await getSongs();
    } catch (e) {
      console.error('Failed to load data:', e);
    }
    loading = false;
  }

  onMount(loadData);

  async function handleCreate() {
    if (!newPlaylistName.trim()) return;

    try {
      await createPlaylist(newPlaylistName.trim());
      newPlaylistName = '';
      showCreateModal = false;
      await loadData();
    } catch (e) {
      console.error('Failed to create playlist:', e);
    }
  }

  async function handleDelete(id: number) {
    try {
      await deletePlaylist(id);
      playlists = playlists.filter(p => p.id !== id);
      deleteConfirmId = null;
    } catch (e) {
      console.error('Failed to delete playlist:', e);
    }
  }

  function getSongCount(playlist: Playlist): number {
    return playlist.songIds.filter(id =>
      songs.some(s => s.id === id && s.status === 'ready')
    ).length;
  }

  function formatDate(isoString: string): string {
    return new Date(isoString).toLocaleDateString();
  }

  function handleNavigation(action: NavigationAction) {
    // Don't navigate when modal is open
    if (showCreateModal || deleteConfirmId !== null) {
      if (action === 'back') {
        showCreateModal = false;
        deleteConfirmId = null;
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
      // On the "New Playlist" button
      if (action === 'down' && playlists.length > 0) {
        activeZone = 'list';
        playlistFocusIndex = 0;
        actionFocusIndex = 0;
      }
    } else {
      // In the playlist list
      if (action === 'up' || action === 'down') {
        const result = navigateList(playlistFocusIndex, action, playlists.length);
        if (result.escaped === 'up') {
          activeZone = 'action';
        } else {
          playlistFocusIndex = result.index;
          actionFocusIndex = 0; // Reset to Play button
          scrollItemIntoView(playlistElements[playlistFocusIndex]);
        }
      } else if (action === 'left' || action === 'right') {
        // Navigate between Play and Delete buttons
        const result = navigateHorizontal(actionFocusIndex, action, 2);
        actionFocusIndex = result.index;
      }
    }
  }

  function handleSelect() {
    if (activeZone === 'action') {
      showCreateModal = true;
    } else {
      const playlist = playlists[playlistFocusIndex];
      if (!playlist?.id) return;

      if (actionFocusIndex === 0) {
        // Play button
        goto(`/play?playlist=${playlist.id}`);
      } else {
        // Delete button
        deleteConfirmId = playlist.id;
      }
    }
  }

  const keyHandler = createKeyboardHandler(handleNavigation);
</script>

<svelte:window onkeydown={keyHandler} />

<svelte:head>
  <title>Playlists - AutoStepper</title>
</svelte:head>

<div class="max-w-4xl mx-auto px-4 py-8">
  <!-- Header -->
  <div class="flex items-center justify-between mb-8">
    <div>
      <h1 class="text-3xl font-bold">Playlists</h1>
      <p class="text-gray-400 mt-1">
        Organize your songs for party mode
      </p>
    </div>
    <button
      onclick={() => showCreateModal = true}
      class="btn-primary btn-lg flex items-center gap-2 transition-all
             {activeZone === 'action' ? 'nav-focused-pulse' : ''}"
    >
      <span>+</span>
      <span>New Playlist</span>
    </button>
  </div>

  <!-- Content -->
  {#if loading}
    <div class="flex items-center justify-center py-20">
      <div class="text-gray-400">Loading...</div>
    </div>
  {:else if playlists.length === 0}
    <!-- Empty state -->
    <div class="card text-center py-16">
      <div class="text-6xl mb-4">📋</div>
      <h2 class="text-xl font-semibold mb-2">No playlists yet</h2>
      <p class="text-gray-400 mb-6">
        Create a playlist to organize your songs for game sessions
      </p>
      <button
        onclick={() => showCreateModal = true}
        class="btn-primary"
      >
        Create Your First Playlist
      </button>
    </div>
  {:else}
    <!-- Playlist list -->
    <div class="space-y-4">
      {#each playlists as playlist, i (playlist.id)}
        <div
          bind:this={playlistElements[i]}
          class="flex items-center justify-between transition-all
                 {activeZone === 'list' && playlistFocusIndex === i
                   ? 'card-nav-focused'
                   : 'card-hover'}"
        >
          <div class="flex-1">
            <h3 class="font-semibold text-lg">{playlist.name}</h3>
            <p class="text-gray-400 text-sm">
              {getSongCount(playlist)} {getSongCount(playlist) === 1 ? 'song' : 'songs'}
              &bull; Created {formatDate(playlist.createdAt)}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <a
              href="/play?playlist={playlist.id}"
              class="btn-primary transition-all
                     {activeZone === 'list' && playlistFocusIndex === i && actionFocusIndex === 0
                       ? 'nav-focused'
                       : ''}"
            >
              Play
            </a>
            <button
              onclick={() => deleteConfirmId = playlist.id ?? null}
              class="btn-secondary text-game-error hover:text-game-error transition-all
                     {activeZone === 'list' && playlistFocusIndex === i && actionFocusIndex === 1
                       ? 'nav-focused'
                       : ''}"
            >
              Delete
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Create Playlist Modal -->
{#if showCreateModal}
  <div class="modal-overlay" onclick={() => showCreateModal = false}>
    <div class="modal-content" onclick={(e) => e.stopPropagation()}>
      <h2 class="text-xl font-semibold mb-4">Create Playlist</h2>

      <form onsubmit={(e) => { e.preventDefault(); handleCreate(); }}>
        <label class="block mb-4">
          <span class="text-gray-400 text-sm">Playlist Name</span>
          <input
            type="text"
            bind:value={newPlaylistName}
            placeholder="My Awesome Playlist"
            class="input mt-1"
            autofocus
          />
        </label>

        <div class="flex gap-3 justify-end">
          <button
            type="button"
            onclick={() => showCreateModal = false}
            class="btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            class="btn-primary"
            disabled={!newPlaylistName.trim()}
          >
            Create
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Delete Confirmation Modal -->
{#if deleteConfirmId !== null}
  {@const playlistToDelete = playlists.find(p => p.id === deleteConfirmId)}
  <div class="modal-overlay" onclick={() => deleteConfirmId = null}>
    <div class="modal-content" onclick={(e) => e.stopPropagation()}>
      <h2 class="text-xl font-semibold mb-4">Delete Playlist?</h2>
      <p class="text-gray-400 mb-6">
        Are you sure you want to delete "{playlistToDelete?.name}"? The songs will remain in your library.
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
