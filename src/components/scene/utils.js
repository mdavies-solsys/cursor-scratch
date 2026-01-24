/**
 * Utility functions for the Scene
 * Pure helper functions with no dependencies on React or Three.js state
 */
import * as THREE from "three";
import { DEADZONE, BOUNDARY_MARGIN, HALL_HALF_WIDTH, HALL_HALF_LENGTH } from "./constants.js";

/**
 * Apply deadzone to a joystick axis value
 * @param {number} value - Raw axis value
 * @returns {number} - Value with deadzone applied
 */
export const applyDeadzone = (value) => (Math.abs(value) < DEADZONE ? 0 : value);

/**
 * Clamp axis value to [-1, 1] range
 * @param {number} value - Input value
 * @returns {number} - Clamped value
 */
export const clampAxis = (value) => Math.min(1, Math.max(-1, value));

/**
 * Clamp position to stay within hall boundaries
 * @param {THREE.Vector3} position - Position vector to clamp (mutated in place)
 * @returns {THREE.Vector3} - The clamped position
 */
export const clampToHall = (position) => {
  const limitX = HALL_HALF_WIDTH - BOUNDARY_MARGIN;
  const limitZ = HALL_HALF_LENGTH - BOUNDARY_MARGIN;
  position.x = THREE.MathUtils.clamp(position.x, -limitX, limitX);
  position.z = THREE.MathUtils.clamp(position.z, -limitZ, limitZ);
  return position;
};

/**
 * Get the first connected gamepad
 * @returns {Gamepad|null} - Primary gamepad or null
 */
export const getPrimaryGamepad = () => {
  if (typeof navigator === "undefined" || !navigator.getGamepads) {
    return null;
  }
  const pads = navigator.getGamepads();
  for (const pad of pads) {
    if (pad && pad.connected) {
      return pad;
    }
  }
  return null;
};

/**
 * Resolve WebSocket URL for multiplayer connection
 * @returns {string} - WebSocket URL
 */
export const resolveWsUrl = () => {
  const override = import.meta.env?.VITE_WS_URL;
  if (override) {
    return override;
  }
  if (typeof window === "undefined") {
    return "ws://localhost:4000";
  }
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const hostname = window.location.hostname || "localhost";
  return `${protocol}://${hostname}:4000`;
};

/**
 * Seeded random number generator for consistent procedural generation
 * @param {number} seed - Seed value
 * @returns {number} - Pseudo-random value in [0, 1)
 */
export const seededRandom = (seed) => {
  const x = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
};
