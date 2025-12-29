/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        // ITGMania-inspired dark theme
        'game-bg': '#0a0a0f',
        'game-panel': '#12121a',
        'game-border': '#2a2a3a',
        'game-accent': '#6366f1',
        'game-accent-light': '#818cf8',
        'game-success': '#22c55e',
        'game-warning': '#f59e0b',
        'game-error': '#ef4444',
        // Arrow colors
        'arrow-left': '#ff6b9d',
        'arrow-down': '#4ecdc4',
        'arrow-up': '#95e1d3',
        'arrow-right': '#ffd93d',
      },
      fontFamily: {
        game: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-fast': 'pulse 0.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
