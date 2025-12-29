/**
 * Navigation system types for dance pad keyboard navigation
 */

// Navigation directions
export type Direction = 'up' | 'down' | 'left' | 'right';
export type NavigationAction = Direction | 'select' | 'back';

// Key mappings for dance pad + keyboard
export const KEY_MAP: Record<string, NavigationAction> = {
  'ArrowUp': 'up',
  'ArrowDown': 'down',
  'ArrowLeft': 'left',
  'ArrowRight': 'right',
  'Enter': 'select',
  'Escape': 'back'
};

// Navigation zone types
export type ZoneType = 'grid' | 'list' | 'horizontal';

// Configuration for a navigation zone
export interface ZoneConfig {
  type: ZoneType;
  columns?: number;           // For grid navigation
  wrap?: boolean;             // Wrap at boundaries
  onSelect?: () => void;      // Enter handler
  onBack?: () => void;        // Escape handler
  itemCount: number;          // Total navigable items
}

// Navigation state for a zone
export interface ZoneState {
  id: string;
  config: ZoneConfig;
  focusIndex: number;
  subFocusIndex: number;      // For sub-navigation within items (e.g., song card actions)
}
