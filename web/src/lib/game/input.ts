/**
 * Input handling for dance pad (Gamepad API) and keyboard
 */

export type Lane = 'left' | 'down' | 'up' | 'right';
export type InputState = Record<Lane, boolean>;
export type InputEvent = { lane: Lane; time: number; pressed: boolean };

const LANE_ORDER: Lane[] = ['left', 'down', 'up', 'right'];

// Keyboard state
const keyboardState: InputState = {
  left: false,
  down: false,
  up: false,
  right: false
};

// Previous frame state for edge detection
let prevState: InputState = { ...keyboardState };

// Event queue for this frame
let inputEvents: InputEvent[] = [];

// Keyboard mapping
const KEY_MAP: Record<string, Lane> = {
  'ArrowLeft': 'left',
  'ArrowDown': 'down',
  'ArrowUp': 'up',
  'ArrowRight': 'right',
  // WASD alternative
  'a': 'left',
  's': 'down',
  'w': 'up',
  'd': 'right',
  'A': 'left',
  'S': 'down',
  'W': 'up',
  'D': 'right'
};

// Track if input system is initialized
let initialized = false;

/**
 * Initialize input listeners
 */
export function initInput(): void {
  if (initialized) return;

  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keyup', handleKeyUp);

  initialized = true;
}

/**
 * Cleanup input listeners
 */
export function destroyInput(): void {
  document.removeEventListener('keydown', handleKeyDown);
  document.removeEventListener('keyup', handleKeyUp);

  // Reset state
  keyboardState.left = false;
  keyboardState.down = false;
  keyboardState.up = false;
  keyboardState.right = false;

  initialized = false;
}

function handleKeyDown(e: KeyboardEvent): void {
  const lane = KEY_MAP[e.key];
  if (lane && !keyboardState[lane]) {
    keyboardState[lane] = true;
    // Don't prevent default for non-game keys
    e.preventDefault();
  }
}

function handleKeyUp(e: KeyboardEvent): void {
  const lane = KEY_MAP[e.key];
  if (lane) {
    keyboardState[lane] = false;
    e.preventDefault();
  }
}

/**
 * Poll gamepad state
 */
function pollGamepad(): InputState | null {
  const gamepads = navigator.getGamepads();

  // Find first connected gamepad
  for (const gp of gamepads) {
    if (!gp) continue;

    // Standard gamepad mapping for d-pad
    // Most dance pads map as standard gamepads
    const state: InputState = {
      left: false,
      down: false,
      up: false,
      right: false
    };

    // D-pad buttons (standard mapping)
    if (gp.buttons[14]?.pressed) state.left = true;   // D-pad left
    if (gp.buttons[13]?.pressed) state.down = true;   // D-pad down
    if (gp.buttons[12]?.pressed) state.up = true;     // D-pad up
    if (gp.buttons[15]?.pressed) state.right = true;  // D-pad right

    // Also check axes for analog input
    if (gp.axes[0] < -0.5) state.left = true;
    if (gp.axes[0] > 0.5) state.right = true;
    if (gp.axes[1] < -0.5) state.up = true;
    if (gp.axes[1] > 0.5) state.down = true;

    // Some dance pads use face buttons
    // Map them as alternatives
    if (gp.buttons[2]?.pressed) state.left = true;    // X button
    if (gp.buttons[0]?.pressed) state.down = true;    // A button
    if (gp.buttons[3]?.pressed) state.up = true;      // Y button
    if (gp.buttons[1]?.pressed) state.right = true;   // B button

    return state;
  }

  return null;
}

/**
 * Get current input state (combined gamepad + keyboard)
 */
export function getInputState(): InputState {
  const gamepadState = pollGamepad();

  if (gamepadState) {
    // Combine gamepad and keyboard (OR together)
    return {
      left: gamepadState.left || keyboardState.left,
      down: gamepadState.down || keyboardState.down,
      up: gamepadState.up || keyboardState.up,
      right: gamepadState.right || keyboardState.right
    };
  }

  return { ...keyboardState };
}

/**
 * Poll input and detect press events (edges)
 * Call once per frame at the start of the game loop
 * Returns array of new press events this frame
 */
export function pollInput(currentTime: number): InputEvent[] {
  const state = getInputState();
  inputEvents = [];

  // Detect rising edges (just pressed)
  for (const lane of LANE_ORDER) {
    if (state[lane] && !prevState[lane]) {
      inputEvents.push({ lane, time: currentTime, pressed: true });
    }
    if (!state[lane] && prevState[lane]) {
      inputEvents.push({ lane, time: currentTime, pressed: false });
    }
  }

  // Store for next frame
  prevState = { ...state };

  return inputEvents;
}

/**
 * Get lane index (0-3) from lane name
 */
export function getLaneIndex(lane: Lane): number {
  return LANE_ORDER.indexOf(lane);
}

/**
 * Get lane name from index
 */
export function getLaneName(index: number): Lane {
  return LANE_ORDER[index];
}

/**
 * Check if any gamepad is connected
 */
export function hasGamepad(): boolean {
  const gamepads = navigator.getGamepads();
  return gamepads.some(gp => gp !== null);
}
