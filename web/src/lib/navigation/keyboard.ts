/**
 * Keyboard event handling for dance pad navigation
 */

import { KEY_MAP, type NavigationAction } from './types';
import { isTypingTarget } from './focus';

export interface KeyboardHandlerOptions {
  /** Function to check if navigation is enabled */
  enabled?: () => boolean;
  /** Prevent default for navigation keys */
  preventDefault?: boolean;
}

/**
 * Create a keyboard event handler for navigation
 */
export function createKeyboardHandler(
  onAction: (action: NavigationAction, event: KeyboardEvent) => void,
  options: KeyboardHandlerOptions = {}
): (event: KeyboardEvent) => void {
  const { enabled, preventDefault = true } = options;

  return function handleKeydown(event: KeyboardEvent): void {
    // Skip if navigation disabled
    if (enabled && !enabled()) return;

    // Skip if typing in input/textarea
    if (isTypingTarget(event.target)) {
      // But still allow Escape to work in inputs
      if (event.key !== 'Escape') return;
    }

    const action = KEY_MAP[event.key];
    if (!action) return;

    // Prevent default browser behavior (scrolling, form submission)
    if (preventDefault) {
      event.preventDefault();
    }

    onAction(action, event);
  };
}

/**
 * Check if a key is a navigation key
 */
export function isNavigationKey(key: string): boolean {
  return key in KEY_MAP;
}
