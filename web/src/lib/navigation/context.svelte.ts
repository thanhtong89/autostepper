/**
 * Navigation context for dance pad keyboard navigation
 * Uses Svelte 5 runes for reactive state management
 */

import { getContext, setContext } from 'svelte';

const NAV_CONTEXT_KEY = Symbol('navigation');

export interface NavigationState {
  /** Whether keyboard navigation is enabled globally */
  enabled: boolean;
  /** Whether a modal is currently open (blocks page navigation) */
  modalOpen: boolean;
}

export interface NavigationContext {
  /** Get current navigation state */
  getState: () => NavigationState;
  /** Enable/disable navigation globally (e.g., during gameplay) */
  setEnabled: (enabled: boolean) => void;
  /** Set modal open state (blocks page navigation when open) */
  setModalOpen: (open: boolean) => void;
  /** Check if navigation is currently active */
  isActive: () => boolean;
}

/**
 * Create a navigation context
 * Call this in the root layout component
 */
export function createNavigationContext(): NavigationContext {
  let enabled = $state(true);
  let modalOpen = $state(false);

  const context: NavigationContext = {
    getState() {
      return { enabled, modalOpen };
    },

    setEnabled(value: boolean) {
      enabled = value;
    },

    setModalOpen(open: boolean) {
      modalOpen = open;
    },

    isActive() {
      return enabled && !modalOpen;
    }
  };

  setContext(NAV_CONTEXT_KEY, context);
  return context;
}

/**
 * Get the navigation context
 * Call this in child components that need navigation state
 */
export function getNavigationContext(): NavigationContext {
  const ctx = getContext<NavigationContext>(NAV_CONTEXT_KEY);
  if (!ctx) {
    throw new Error('Navigation context not found. Make sure to call createNavigationContext() in a parent component.');
  }
  return ctx;
}

/**
 * Try to get navigation context, returns null if not available
 */
export function tryGetNavigationContext(): NavigationContext | null {
  return getContext<NavigationContext>(NAV_CONTEXT_KEY) ?? null;
}
