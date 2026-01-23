# Feature: Game Room Height and Floor Adjustment

**Branch:** `feature/game-room-height-and-floor-3e98`
**Date:** 2026-01-23

## Problem

The game room in the VR experience had two issues:
1. The room height felt too short and needed to be approximately twice as tall
2. A decorative floor trim strip connected the two doorways at either end of the room, which the user wanted removed

## Investigation

The room geometry is defined in `src/components/Scene.jsx`. Key findings:

- Room height is controlled by `HALL_HEIGHT = SCALE(16)` constant at line 24
- The floor trim was a narrow stone trim mesh running the length of the hall between the doors:
  ```jsx
  <mesh position={[0, SCALE(0.06), 0]} receiveShadow material={materials.stoneTrim}>
    <boxGeometry args={[SCALE(6.5), SCALE(0.12), HALL_LENGTH - SCALE(12)]} />
  </mesh>
  ```

The room uses a `SCALE()` function that multiplies values by `HALL_SCALE = 5`, so SCALE(16) = 80 units.

Many elements dynamically adjust based on `HALL_HEIGHT`:
- Column heights (`COLUMN_TOTAL_HEIGHT`, `COLUMN_SHAFT_HEIGHT`, etc.)
- Ceiling beams positioned at `HALL_HEIGHT - SCALE(0.6)`
- Ceiling lights at `HALL_HEIGHT - SCALE(4)`
- Wall texture repeats (`WALL_REPEAT_V`)

## Solution

1. **Doubled room height**: Changed `HALL_HEIGHT` from `SCALE(16)` to `SCALE(32)`
   - This automatically adjusts columns, ceiling beams, lights, and wall textures

2. **Removed floor trim strip**: Deleted the mesh that created the decorative trim connecting the two doors

## Changes Made

- `src/components/Scene.jsx`:
  - Line 24: `HALL_HEIGHT = SCALE(32)` (was `SCALE(16)`)
  - Removed the floor trim mesh (was between the main floor and ceiling meshes)

## Future Considerations

- Wall bands and ribs use hardcoded height values (e.g., `SCALE(3.2)`, `SCALE(7.4)`) so they remain at the same height on the now-taller walls - this may be intentional or could be adjusted if desired
- If the room feels too sparse with the doubled height, additional decorative elements could be added at higher elevations
