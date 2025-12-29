<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';
  import { createNavigationContext } from '$lib/navigation/context.svelte';

  let { children } = $props();

  // Initialize navigation context for the entire app
  const navContext = createNavigationContext();

  // Navigation items
  const navItems = [
    { href: '/', label: 'Home', icon: '🏠' },
    { href: '/library', label: 'Library', icon: '🎵' },
    { href: '/playlists', label: 'Playlists', icon: '📋' },
    { href: '/play', label: 'Play', icon: '🎮' },
  ];
</script>

<div class="min-h-screen flex flex-col">
  <!-- Header -->
  <header class="bg-game-panel border-b border-game-border">
    <div class="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
      <a href="/" class="flex items-center gap-2 hover:opacity-80 transition-opacity">
        <span class="text-2xl">🕺</span>
        <span class="text-xl font-bold bg-gradient-to-r from-game-accent to-game-accent-light bg-clip-text text-transparent">
          AutoStepper
        </span>
      </a>

      <!-- Navigation -->
      <nav class="flex items-center gap-1">
        {#each navItems as item}
          <a
            href={item.href}
            class="px-3 py-2 rounded-lg transition-colors flex items-center gap-2
                   {$page.url.pathname === item.href
                     ? 'bg-game-accent text-white'
                     : 'text-gray-400 hover:text-white hover:bg-game-border/50'}"
          >
            <span>{item.icon}</span>
            <span class="hidden sm:inline">{item.label}</span>
          </a>
        {/each}
      </nav>
    </div>
  </header>

  <!-- Main content -->
  <main class="flex-1">
    {@render children()}
  </main>

  <!-- Footer -->
  <footer class="bg-game-panel border-t border-game-border py-4 text-center text-gray-500 text-sm">
    <p>AutoStepper Web &mdash; Dance to any YouTube song</p>
  </footer>
</div>
