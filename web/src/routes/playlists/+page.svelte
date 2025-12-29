<script lang="ts">
  import { onMount } from 'svelte';
  import { getPlaylists, createPlaylist, deletePlaylist, type Playlist } from '$lib/storage/playlists';
  import { getSongs, type Song } from '$lib/storage/library';

  let playlists = $state<Playlist[]>([]);
  let songs = $state<Song[]>([]);
  let loading = $state(true);
  let showCreateModal = $state(false);
  let newPlaylistName = $state('');
  let deleteConfirmId = $state<number | null>(null);

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
</script>

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
      class="btn-primary btn-lg flex items-center gap-2"
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
      {#each playlists as playlist (playlist.id)}
        <div class="card-hover flex items-center justify-between">
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
              class="btn-primary"
            >
              Play
            </a>
            <button
              onclick={() => deleteConfirmId = playlist.id ?? null}
              class="btn-secondary text-game-error hover:text-game-error"
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
