<script lang="ts">
  import { downloadFromYouTube, fetchAudioBlob, isValidYouTubeUrl, isDownloadConfigured } from '$lib/api/youtube';
  import { addSong, updateSongStatus, saveAudioBlob, saveChart, songExists } from '$lib/storage/library';
  import { analyzeAudio } from '$lib/audio/analyzer';
  import { generateAllDifficulties } from '$lib/charts/generator';

  interface Props {
    onClose: () => void;
    onSuccess: () => void;
  }

  let { onClose, onSuccess }: Props = $props();

  let youtubeUrl = $state('');
  let status = $state<'idle' | 'validating' | 'downloading' | 'fetching' | 'analyzing' | 'generating' | 'saving' | 'success' | 'error'>('idle');
  let errorMessage = $state('');
  let progress = $state('');

  const statusMessages = {
    idle: '',
    validating: 'Validating URL...',
    downloading: 'Downloading from YouTube...',
    fetching: 'Fetching audio file...',
    analyzing: 'Analyzing audio...',
    generating: 'Generating charts...',
    saving: 'Saving to library...',
    success: 'Song added successfully!',
    error: 'An error occurred'
  };

  async function handleSubmit() {
    if (!youtubeUrl.trim()) return;

    errorMessage = '';

    // Check if download API is configured
    if (!isDownloadConfigured()) {
      errorMessage = 'Download API not configured. Please set VITE_DOWNLOAD_API_URL in your .env file.';
      status = 'error';
      return;
    }

    // Validate URL
    status = 'validating';
    if (!isValidYouTubeUrl(youtubeUrl)) {
      errorMessage = 'Please enter a valid YouTube URL';
      status = 'error';
      return;
    }

    // Check if song already exists
    try {
      const exists = await songExists(youtubeUrl);
      if (exists) {
        errorMessage = 'This song is already in your library';
        status = 'error';
        return;
      }
    } catch (e) {
      console.error('Failed to check for existing song:', e);
    }

    let songId: number | null = null;

    try {
      // Download audio via Lambda
      status = 'downloading';
      progress = 'Requesting download from server...';
      const downloadResult = await downloadFromYouTube(youtubeUrl);

      // Add song to library (processing status)
      songId = await addSong({
        title: downloadResult.title,
        artist: downloadResult.artist,
        youtubeUrl,
        duration: downloadResult.duration,
        bpm: 0,
        thumbnail: downloadResult.thumbnail
      });

      // Fetch audio blob
      status = 'fetching';
      progress = 'Downloading audio file...';
      const audioBlob = await fetchAudioBlob(downloadResult.downloadUrl);

      // Save audio blob
      await saveAudioBlob(songId, audioBlob);

      // Analyze audio
      status = 'analyzing';
      progress = 'Detecting beats and tempo...';

      // Convert blob to AudioBuffer
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      const analysis = await analyzeAudio(audioBuffer);

      // Generate charts
      status = 'generating';
      progress = 'Creating step patterns...';
      const chartData = generateAllDifficulties(analysis);

      // Save everything
      status = 'saving';
      progress = 'Saving to library...';
      await saveChart(songId, chartData);
      await updateSongStatus(songId, 'ready');

      // Update song with BPM
      const { updateSong } = await import('$lib/storage/library');
      await updateSong(songId, { bpm: analysis.bpm });

      status = 'success';
      setTimeout(() => {
        onSuccess();
      }, 1000);

    } catch (e) {
      console.error('Failed to add song:', e);
      errorMessage = e instanceof Error ? e.message : 'An unknown error occurred';
      status = 'error';

      // Update song status to error if we created one
      if (songId) {
        try {
          await updateSongStatus(songId, 'error', errorMessage);
        } catch (e2) {
          console.error('Failed to update song status:', e2);
        }
      }
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
    }
  }

  const isProcessing = $derived(
    ['validating', 'downloading', 'fetching', 'analyzing', 'generating', 'saving'].includes(status)
  );
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="modal-overlay" onclick={onClose}>
  <div class="modal-content max-w-lg" onclick={(e) => e.stopPropagation()}>
    <h2 class="text-xl font-semibold mb-4">Add Song from YouTube</h2>

    <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
      <label class="block mb-4">
        <span class="text-gray-400 text-sm">YouTube URL</span>
        <input
          type="url"
          bind:value={youtubeUrl}
          placeholder="https://www.youtube.com/watch?v=..."
          class="input mt-1"
          disabled={isProcessing}
          autofocus
        />
      </label>

      <!-- Status display -->
      {#if status !== 'idle'}
        <div class="mb-4 p-4 rounded-lg {status === 'error' ? 'bg-game-error/20' : status === 'success' ? 'bg-game-success/20' : 'bg-game-panel'}">
          <div class="flex items-center gap-3">
            {#if isProcessing}
              <div class="w-5 h-5 border-2 border-game-accent border-t-transparent rounded-full animate-spin"></div>
            {:else if status === 'success'}
              <div class="text-game-success text-xl">✓</div>
            {:else if status === 'error'}
              <div class="text-game-error text-xl">✕</div>
            {/if}
            <div>
              <div class="font-medium">{statusMessages[status]}</div>
              {#if progress && isProcessing}
                <div class="text-sm text-gray-400">{progress}</div>
              {/if}
              {#if errorMessage}
                <div class="text-sm text-game-error">{errorMessage}</div>
              {/if}
            </div>
          </div>
        </div>
      {/if}

      <div class="flex gap-3 justify-end">
        <button
          type="button"
          onclick={onClose}
          class="btn-secondary"
          disabled={isProcessing}
        >
          {status === 'success' ? 'Close' : 'Cancel'}
        </button>
        {#if status !== 'success'}
          <button
            type="submit"
            class="btn-primary"
            disabled={!youtubeUrl.trim() || isProcessing}
          >
            {isProcessing ? 'Processing...' : 'Add Song'}
          </button>
        {/if}
      </div>
    </form>

    <!-- Help text -->
    <div class="mt-6 text-xs text-gray-500">
      <p>Paste a YouTube video URL. The audio will be downloaded and analyzed to generate dance charts automatically.</p>
      <p class="mt-1">This process may take 30-60 seconds depending on the song length.</p>
    </div>
  </div>
</div>
