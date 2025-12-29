/**
 * Focus management utilities for keyboard navigation
 */

import type { Direction } from './types';

/**
 * Navigate within a grid layout
 * Returns the new focus index after navigation
 */
export function navigateGrid(
  currentIndex: number,
  direction: Direction,
  columns: number,
  totalItems: number,
  options: { wrap?: boolean } = {}
): { index: number; escaped?: Direction } {
  if (totalItems === 0) return { index: 0 };

  const { wrap = false } = options;
  const row = Math.floor(currentIndex / columns);
  const col = currentIndex % columns;
  const totalRows = Math.ceil(totalItems / columns);

  let newRow = row;
  let newCol = col;
  let escaped: Direction | undefined;

  switch (direction) {
    case 'up':
      if (row === 0) {
        if (wrap) {
          newRow = totalRows - 1;
        } else {
          escaped = 'up';
        }
      } else {
        newRow = row - 1;
      }
      break;

    case 'down':
      if (row >= totalRows - 1) {
        if (wrap) {
          newRow = 0;
        } else {
          escaped = 'down';
        }
      } else {
        newRow = row + 1;
      }
      break;

    case 'left':
      if (col === 0) {
        if (wrap) {
          newCol = columns - 1;
        } else {
          escaped = 'left';
        }
      } else {
        newCol = col - 1;
      }
      break;

    case 'right':
      if (col >= columns - 1) {
        if (wrap) {
          newCol = 0;
        } else {
          escaped = 'right';
        }
      } else {
        newCol = col + 1;
      }
      break;
  }

  let newIndex = newRow * columns + newCol;

  // Clamp to valid range
  newIndex = Math.max(0, Math.min(newIndex, totalItems - 1));

  return { index: newIndex, escaped };
}

/**
 * Navigate within a vertical list
 * Returns the new focus index after navigation
 */
export function navigateList(
  currentIndex: number,
  direction: Direction,
  totalItems: number,
  options: { wrap?: boolean } = {}
): { index: number; escaped?: Direction } {
  if (totalItems === 0) return { index: 0 };

  const { wrap = false } = options;
  let newIndex = currentIndex;
  let escaped: Direction | undefined;

  switch (direction) {
    case 'up':
      if (currentIndex === 0) {
        if (wrap) {
          newIndex = totalItems - 1;
        } else {
          escaped = 'up';
        }
      } else {
        newIndex = currentIndex - 1;
      }
      break;

    case 'down':
      if (currentIndex >= totalItems - 1) {
        if (wrap) {
          newIndex = 0;
        } else {
          escaped = 'down';
        }
      } else {
        newIndex = currentIndex + 1;
      }
      break;

    case 'left':
      escaped = 'left';
      break;

    case 'right':
      escaped = 'right';
      break;
  }

  return { index: newIndex, escaped };
}

/**
 * Navigate within a horizontal row
 * Returns the new focus index after navigation
 */
export function navigateHorizontal(
  currentIndex: number,
  direction: Direction,
  totalItems: number,
  options: { wrap?: boolean } = {}
): { index: number; escaped?: Direction } {
  if (totalItems === 0) return { index: 0 };

  const { wrap = false } = options;
  let newIndex = currentIndex;
  let escaped: Direction | undefined;

  switch (direction) {
    case 'left':
      if (currentIndex === 0) {
        if (wrap) {
          newIndex = totalItems - 1;
        } else {
          escaped = 'left';
        }
      } else {
        newIndex = currentIndex - 1;
      }
      break;

    case 'right':
      if (currentIndex >= totalItems - 1) {
        if (wrap) {
          newIndex = 0;
        } else {
          escaped = 'right';
        }
      } else {
        newIndex = currentIndex + 1;
      }
      break;

    case 'up':
      escaped = 'up';
      break;

    case 'down':
      escaped = 'down';
      break;
  }

  return { index: newIndex, escaped };
}

/**
 * Scroll an element into view smoothly
 */
export function scrollItemIntoView(element: HTMLElement | null): void {
  if (!element) return;

  element.scrollIntoView({
    behavior: 'smooth',
    block: 'nearest',
    inline: 'nearest'
  });
}

/**
 * Check if the currently focused element is a text input
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  const tagName = target.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || target.isContentEditable;
}
