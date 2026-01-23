# Feature: Game Room Height, Floor, and Door Adjustments

**Branch:** `feature/game-room-height-and-floor-3e98`
**Date:** 2026-01-23

## Problem

The game room in the VR experience had several issues:
1. The room height felt too short and needed to be approximately twice as tall
2. A decorative floor trim strip connected the two doorways at either end of the room, which the user wanted removed
3. The doors needed to be taller and have arched tops instead of square tops

## Investigation

The room geometry is defined in `src/components/Scene.jsx`. Key findings:

- Room height is controlled by `HALL_HEIGHT = SCALE(16)` constant
- The floor trim was a narrow stone trim mesh running the length of the hall between the doors
- Door dimensions were `DOOR_WIDTH = SCALE(12)` and `DOOR_HEIGHT = SCALE(10)` with rectangular geometry

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

3. **Made doors taller with arched tops**:
   - Increased door width from `SCALE(12)` to `SCALE(14)` for better proportions
   - Increased door height from `SCALE(10)` to `SCALE(18)` (height to arch spring point)
   - Added `ARCH_RADIUS = DOOR_WIDTH / 2` for semicircular arch
   - Added `TOTAL_DOOR_HEIGHT = DOOR_HEIGHT + ARCH_RADIUS` (full height including arch = ~SCALE(25))
   - Created custom geometry functions for arch elements:
     - `createArchInfillGeometry()` - fills corners above the arch in the wall
     - `createArchedPanelGeometry()` - creates door panels with arched tops
   - Added arched frame trim using torus geometry
   - Added decorative keystone at top of arch
   - Created arched void geometry for the black passageway behind doors

## Changes Made

- `src/components/Scene.jsx`:
  - `HALL_HEIGHT = SCALE(32)` (was `SCALE(16)`)
  - `DOOR_WIDTH = SCALE(14)` (was `SCALE(12)`)
  - `DOOR_HEIGHT = SCALE(18)` (was `SCALE(10)`)
  - Added `ARCH_RADIUS` and `TOTAL_DOOR_HEIGHT` constants
  - Removed the floor trim mesh
  - Added `createArchInfillGeometry()` function for arch stone infill
  - Added `createArchedPanelGeometry()` function for arched door panels
  - Rewrote `Doorway` component with:
    - Arch infill geometry (stone corners above arch)
    - Arched frame trim using torus geometry
    - Keystone decorative element
    - Arched door panels
    - Arched void geometry for passageway

## Future Considerations

- Wall bands and ribs use hardcoded height values so they remain at the same height on the now-taller walls
- The arch frame uses a torus with inline material - could be refactored to use the shared trimMaterial
- Door panel arch height is based on panel width for semicircular tops - could be adjusted for different arch proportions
