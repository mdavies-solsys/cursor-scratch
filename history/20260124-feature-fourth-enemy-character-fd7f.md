# Fourth Enemy Character Feature

**Branch:** `feature/fourth-enemy-character-fd7f`
**Date:** 2026-01-24

## Problem

The game experience needed a fourth enemy character using a newly added Twitter profile picture (IMG_2372.jpeg).

## Solution

Added support for a fourth enemy by:

1. **Scene.jsx** - Updated `useEnemyFaceTextures` hook:
   - Expanded initial state from 3 to 4 texture slots
   - Added `/IMG_2372.jpeg` to the texture paths array
   - Refactored hardcoded texture count to use `paths.length` for better maintainability

2. **server.js** - Updated enemy configuration:
   - Changed `ENEMY_COUNT` constant from 3 to 4

## Implementation Details

The existing code architecture made this change straightforward:
- The `createEnemy()` function in `server.js` already assigns `faceIndex = i` for each enemy
- The `Enemy` component in `Combat.jsx` already receives `faceIndex` and `faceTextures` props
- The fourth enemy (index 3) automatically uses the fourth texture in the array

### Files Changed

- `src/components/Scene.jsx` - Added fourth texture path
- `server.js` - Increased ENEMY_COUNT to 4

## Testing Notes

The fourth enemy will spawn within the existing spawn radius (150 units from center) and will use IMG_2372.jpeg as its face texture. The enemy behavior (pursuit, wandering, leashing) remains unchanged.
