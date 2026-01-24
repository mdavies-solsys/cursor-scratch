/**
 * Scene Component - Re-export from modular structure
 * 
 * This file maintains backward compatibility for existing imports.
 * The actual implementation has been refactored into the scene/ directory:
 * 
 * scene/
 * ├── constants.js      - Configuration values and dimensions
 * ├── utils.js          - Pure utility functions  
 * ├── materials.js      - Procedural texture/material generation
 * ├── hooks/            - React hooks (useMultiplayer, useEnemyFaceTextures)
 * ├── world/            - Environment components (World, Columns, Doorway, etc.)
 * ├── controls/         - Input handling (MovementRig, FlatControls)
 * ├── session/          - Multiplayer session management
 * └── Scene.jsx         - Main scene component
 * 
 * For new code, consider importing directly from scene/ submodules
 * for better tree-shaking and clearer dependencies.
 */

export { default } from "./scene/Scene.jsx";
