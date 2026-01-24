/**
 * Scene Module - Main barrel export
 * 
 * This module provides a clean API for the 3D game environment.
 * 
 * Structure:
 * - constants.js    - Configuration values and dimensions
 * - utils.js        - Pure utility functions
 * - materials.js    - Procedural texture/material generation
 * - hooks/          - React hooks (useMultiplayer, useEnemyFaceTextures)
 * - world/          - Environment components (World, Columns, Doorway, etc.)
 * - controls/       - Input handling (MovementRig, FlatControls)
 * - session/        - Multiplayer session management
 */

// Main scene component
export { default as Scene } from "./Scene.jsx";

// Constants
export * from "./constants.js";

// Utilities
export * from "./utils.js";

// Materials
export * from "./materials.js";

// Hooks
export * from "./hooks/index.js";

// World components
export * from "./world/index.js";

// Controls
export * from "./controls/index.js";

// Session components
export * from "./session/index.js";
