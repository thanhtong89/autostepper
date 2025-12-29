<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { getSong, getAudioBlob, getChart } from '$lib/storage/library';
  import { GameEngine, type GameState } from '$lib/game/engine';
  import type { GameScore, Judgment } from '$lib/game/scoring';
  import type { Song, ChartData } from '$lib/storage/db';
  import { navigateList } from '$lib/navigation/focus';
  import { KEY_MAP, type NavigationAction } from '$lib/navigation/types';

  // State
  let song = $state<Song | null>(null);
  let chartData = $state<ChartData | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Game state
  let gameState = $state<GameState>('idle');

  // Menu navigation state
  let pauseMenuIndex = $state(0);  // 0=Resume, 1=Restart, 2=Quit
  let resultsMenuIndex = $state(0); // 0=Play Again, 1=Return
  let currentScore = $state<GameScore | null>(null);
  let finalResults = $state<{
    score: number;
    accuracy: number;
    grade: string;
    maxCombo: number;
    judgments: Record<Judgment, number>;
    fullCombo: boolean;
    perfectFullCombo: boolean;
    marvelousFullCombo: boolean;
  } | null>(null);

  // Refs
  let canvas: HTMLCanvasElement;
  let audioElement: HTMLAudioElement;
  let engine: GameEngine | null = null;
  let audioUrl: string | null = null;

  // Get params from URL
  let songId = $derived(parseInt($page.url.searchParams.get('songId') || '0'));
  let difficulty = $derived(($page.url.searchParams.get('difficulty') || 'medium') as 'easy' | 'medium' | 'hard' | 'expert');

  onMount(async () => {
    if (!songId) {
      error = 'No song selected';
      loading = false;
      return;
    }

    try {
      // Load song data
      const loadedSong = await getSong(songId);
      if (!loadedSong) {
        error = 'Song not found';
        loading = false;
        return;
      }
      song = loadedSong;

      // Load audio blob
      const blob = await getAudioBlob(songId);
      if (!blob) {
        error = 'Audio not found';
        loading = false;
        return;
      }
      audioUrl = URL.createObjectURL(blob);

      // Load chart
      const chart = await getChart(songId);
      if (!chart) {
        error = 'Chart not found';
        loading = false;
        return;
      }
      chartData = chart;

      loading = false;

      // Wait for DOM to update, then initialize game
      await tick();
      console.log('Canvas:', canvas, 'Audio:', audioElement);
      await initGame();
    } catch (e) {
      console.error('Failed to load game:', e);
      error = 'Failed to load game data';
      loading = false;
    }
  });

  onDestroy(() => {
    if (engine) {
      engine.stop();
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
  });

  async function initGame() {
    console.log('initGame called', { chartData: !!chartData, audioUrl: !!audioUrl, canvas: !!canvas, audioElement: !!audioElement });
    if (!chartData || !audioUrl || !canvas || !audioElement) {
      console.error('Missing required elements for game init');
      return;
    }

    const difficultyChart = chartData.difficulties[difficulty];
    if (!difficultyChart) {
      error = `Difficulty "${difficulty}" not found`;
      return;
    }

    // Set audio source
    audioElement.src = audioUrl;
    await audioElement.load();

    // Resize canvas
    resizeCanvas();

    // Create engine
    engine = new GameEngine(
      canvas,
      audioElement,
      difficultyChart,
      { scrollSpeed: 1 },
      {
        onStateChange: (state) => {
          gameState = state;
        },
        onScoreUpdate: (score) => {
          currentScore = score;
        },
        onFinish: (results) => {
          finalResults = results;
        }
      }
    );

    // Start game
    engine.start();
  }

  function resizeCanvas() {
    if (!canvas) return;
    const container = canvas.parentElement;
    if (container) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      engine?.resize(canvas.width, canvas.height);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    // During gameplay, only handle Escape for pause
    if (gameState === 'playing') {
      if (e.key === 'Escape') {
        engine?.pause();
        pauseMenuIndex = 0; // Reset to Resume
      }
      return;
    }

    // Menu navigation when paused or finished
    if (gameState === 'paused' || gameState === 'finished') {
      const action = KEY_MAP[e.key] as NavigationAction | undefined;
      if (!action) return;

      e.preventDefault();

      if (gameState === 'paused') {
        handlePauseMenuNavigation(action);
      } else {
        handleResultsMenuNavigation(action);
      }
    }
  }

  function handlePauseMenuNavigation(action: NavigationAction) {
    if (action === 'up' || action === 'down') {
      const result = navigateList(pauseMenuIndex, action, 3);
      pauseMenuIndex = result.index;
    } else if (action === 'select') {
      executePauseMenuAction();
    } else if (action === 'back') {
      // Resume on Escape
      engine?.resume();
    }
  }

  function executePauseMenuAction() {
    switch (pauseMenuIndex) {
      case 0: // Resume
        engine?.resume();
        break;
      case 1: // Restart
        restartGame();
        break;
      case 2: // Quit
        returnToMenu();
        break;
    }
  }

  function handleResultsMenuNavigation(action: NavigationAction) {
    if (action === 'up' || action === 'down') {
      const result = navigateList(resultsMenuIndex, action, 2);
      resultsMenuIndex = result.index;
    } else if (action === 'select') {
      executeResultsMenuAction();
    } else if (action === 'back') {
      // Return to menu on Escape
      returnToMenu();
    }
  }

  function executeResultsMenuAction() {
    switch (resultsMenuIndex) {
      case 0: // Play Again
        restartGame();
        break;
      case 1: // Return to Menu
        returnToMenu();
        break;
    }
  }

  function resumeGame() {
    engine?.resume();
  }

  function restartGame() {
    if (engine) {
      engine.stop();
    }
    finalResults = null;
    currentScore = null;
    gameState = 'idle';
    initGame();
  }

  function returnToMenu() {
    goto('/play');
  }

  // Grade colors
  const gradeColors: Record<string, string> = {
    'AAA': 'text-cyan-400',
    'AA': 'text-yellow-400',
    'A': 'text-green-400',
    'B': 'text-blue-400',
    'C': 'text-purple-400',
    'D': 'text-red-400',
    'F': 'text-gray-400'
  };
</script>

<svelte:head>
  <title>{song ? `Playing: ${song.title}` : 'Game'} - AutoStepper</title>
</svelte:head>

<svelte:window onkeydown={handleKeydown} onresize={resizeCanvas} />

<div class="fixed inset-0 bg-game-bg flex flex-col">
  {#if loading}
    <div class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <div class="text-2xl mb-2">Loading...</div>
        <div class="text-gray-400">Preparing game</div>
      </div>
    </div>
  {:else if error}
    <div class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <div class="text-2xl text-red-400 mb-4">{error}</div>
        <button onclick={returnToMenu} class="btn btn-primary">
          Return to Menu
        </button>
      </div>
    </div>
  {:else}
    <!-- Game UI -->
    <div class="relative flex-1 flex">
      <!-- Game canvas container -->
      <div class="flex-1 relative">
        <canvas
          bind:this={canvas}
          class="absolute inset-0 w-full h-full"
          style="will-change: contents; transform: translateZ(0);"
        ></canvas>

        <!-- Score overlay (top left) -->
        {#if currentScore && (gameState === 'playing' || gameState === 'leadin')}
          <div class="absolute top-4 left-4 text-white">
            <div class="text-3xl font-bold">{currentScore.score.toLocaleString()}</div>
            <div class="text-sm text-gray-400">
              {(currentScore.accuracy * 100).toFixed(2)}%
            </div>
          </div>
        {/if}

        <!-- Song info (top right) -->
        {#if song && (gameState === 'playing' || gameState === 'leadin')}
          <div class="absolute top-4 right-4 text-right">
            <div class="font-medium">{song.title}</div>
            <div class="text-sm text-gray-400 capitalize">{difficulty}</div>
          </div>
        {/if}

        <!-- Get Ready indicator during lead-in -->
        {#if gameState === 'leadin'}
          <div class="absolute top-1/3 left-1/2 -translate-x-1/2 text-center">
            <div class="text-2xl font-bold text-game-accent animate-pulse">Get Ready!</div>
          </div>
        {/if}
      </div>

      <!-- Hidden audio element -->
      <audio bind:this={audioElement} class="hidden"></audio>
    </div>

    <!-- Pause overlay -->
    {#if gameState === 'paused'}
      <div class="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
        <div class="card p-8 text-center">
          <h2 class="text-3xl font-bold mb-6">PAUSED</h2>
          <div class="space-y-3">
            <button
              onclick={resumeGame}
              class="btn btn-primary btn-lg w-full transition-all
                     {pauseMenuIndex === 0 ? 'nav-focused-pulse' : ''}"
            >
              Resume
            </button>
            <button
              onclick={restartGame}
              class="btn btn-secondary btn-lg w-full transition-all
                     {pauseMenuIndex === 1 ? 'nav-focused' : ''}"
            >
              Restart
            </button>
            <button
              onclick={returnToMenu}
              class="btn btn-danger btn-lg w-full transition-all
                     {pauseMenuIndex === 2 ? 'nav-focused' : ''}"
            >
              Quit
            </button>
          </div>
          <p class="text-sm text-gray-500 mt-4">Use ↑↓ to navigate, Enter to select</p>
        </div>
      </div>
    {/if}

    <!-- Results overlay -->
    {#if gameState === 'finished' && finalResults}
      <div class="absolute inset-0 bg-black/90 flex items-center justify-center z-50 overflow-auto py-8">
        <div class="card p-8 max-w-md w-full mx-4">
          <!-- Song info -->
          <div class="text-center mb-6">
            <h2 class="text-2xl font-bold">{song?.title}</h2>
            <div class="text-gray-400 capitalize">{difficulty}</div>
          </div>

          <!-- Grade -->
          <div class="text-center mb-6">
            <div class={`text-8xl font-bold ${gradeColors[finalResults.grade] || 'text-white'}`}>
              {finalResults.grade}
            </div>
            {#if finalResults.marvelousFullCombo}
              <div class="text-cyan-400 font-bold mt-2">MARVELOUS FULL COMBO!</div>
            {:else if finalResults.perfectFullCombo}
              <div class="text-yellow-400 font-bold mt-2">PERFECT FULL COMBO!</div>
            {:else if finalResults.fullCombo}
              <div class="text-green-400 font-bold mt-2">FULL COMBO!</div>
            {/if}
          </div>

          <!-- Score -->
          <div class="text-center mb-6">
            <div class="text-4xl font-bold">{finalResults.score.toLocaleString()}</div>
            <div class="text-xl text-gray-400">
              {(finalResults.accuracy * 100).toFixed(2)}%
            </div>
          </div>

          <!-- Stats -->
          <div class="grid grid-cols-2 gap-4 mb-6 text-sm">
            <div class="text-center">
              <div class="text-2xl font-bold">{finalResults.maxCombo}</div>
              <div class="text-gray-400">Max Combo</div>
            </div>
            <div class="text-center">
              <div class="text-2xl font-bold">{currentScore?.totalNotes || 0}</div>
              <div class="text-gray-400">Total Notes</div>
            </div>
          </div>

          <!-- Judgment breakdown -->
          <div class="space-y-2 mb-8">
            <div class="flex justify-between">
              <span class="text-cyan-400">Marvelous</span>
              <span>{finalResults.judgments.marvelous}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-yellow-400">Perfect</span>
              <span>{finalResults.judgments.perfect}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-green-400">Great</span>
              <span>{finalResults.judgments.great}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-blue-400">Good</span>
              <span>{finalResults.judgments.good}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-red-400">Miss</span>
              <span>{finalResults.judgments.miss}</span>
            </div>
          </div>

          <!-- Actions -->
          <div class="space-y-3">
            <button
              onclick={restartGame}
              class="btn btn-primary btn-lg w-full transition-all
                     {resultsMenuIndex === 0 ? 'nav-focused-pulse' : ''}"
            >
              Play Again
            </button>
            <button
              onclick={returnToMenu}
              class="btn btn-secondary btn-lg w-full transition-all
                     {resultsMenuIndex === 1 ? 'nav-focused' : ''}"
            >
              Return to Menu
            </button>
          </div>
          <p class="text-sm text-gray-500 mt-4">Use ↑↓ to navigate, Enter to select</p>
        </div>
      </div>
    {/if}
  {/if}
</div>
