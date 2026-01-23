# Ruins Experience Refinements

**Branch:** `feature/ruins-experience-refinements-995c`
**Date:** January 23, 2026

## Problem

The game experience needed refinements to:
1. Increase movement speed (was too slow)
2. Make columns more imposing (larger diameter)
3. Add atmospheric lighting with a subtle green tint
4. Create a ruins aesthetic with architectural imperfections

## Changes Made

### 1. Movement Speed Increase
- **File:** `src/components/Scene.jsx`
- **Change:** Increased `MAX_SPEED` from `3` to `8`
- **Impact:** Players can now traverse the large hall more efficiently

### 2. Column Diameter (4x Increase)
- **File:** `src/components/Scene.jsx`
- **Changes:**
  - Base geometry: `SCALE(1.6-1.8)` → `SCALE(6.4-7.2)`
  - Ring geometry: `SCALE(1.45-1.6)` → `SCALE(5.8-6.4)`
  - Shaft geometry: `SCALE(1.15-1.25)` → `SCALE(4.6-5.0)`
  - Cap geometry: `SCALE(2.6)` → `SCALE(10.4)`
  - Top geometry: `SCALE(2.9)` → `SCALE(11.6)`
  - Detail rings: `SCALE(1.28)` → `SCALE(5.12)`
- **Also adjusted:**
  - Column spacing from `SCALE(42, 38)` to `SCALE(60, 55)` to accommodate larger columns
  - Central corridor clearance from `SCALE(8)` to `SCALE(20)`

### 3. Light Color Green Tint
- **File:** `src/components/Scene.jsx`
- **Color changes (warm amber → greenish-amber):**
  - Fog: `#1a1510` → `#181812`
  - Ambient: `#ffcc66` → `#d9d968`
  - Hemisphere sky: `#ffdd88` → `#d9dd78`
  - Hemisphere ground: `#553311` → `#3d4422`
  - Main directional: `#ffbb55` → `#d4c955`
  - Secondary directional: `#ffaa44` → `#d4b844`
  - Ceiling point lights: `#ffaa33` → `#c9b833`
  - Wall sconces: `#ff9922` → `#c99922`
  - Light fixture emissives updated to match
- **Background:** `#1a1815` → `#12140f`

### 4. Ruins Aesthetic Imperfections
- **File:** `src/components/Scene.jsx`
- **New features:**
  
  #### Column Imperfections
  - Added seeded random number generator for consistent imperfections
  - Each column now has:
    - Random tilt (±0.03 radians X and Z)
    - Position offset (±0.4 scaled units)
    - Scale variation (92-108%)
    - Height variation (85-103%) - some columns appear broken/shorter
  - Tilt increases from base to top (grounded base, leaning peak)
  
  #### Floor Debris Component
  - Added `FloorDebris` component with ~100 scattered rubble pieces
  - Four debris shapes: boxes, cylinders, dodecahedrons, tetrahedrons
  - Random positions, rotations, and scales
  - Pieces appear half-buried in floor
  
  #### Wall Cracks Component
  - Added `WallCracks` component for both walls
  - 12 crack marks per wall
  - Dark void material (`#0a0a08`) for shadow-like appearance
  - Random heights, widths, and depths
  
  #### Weathered Textures
  - Stone: More noise (45), more veins (35), higher roughness (0.85)
  - Floor: Heavy weathering (noise 50, veins 40), deeper bumps (0.5)
  - Trim: Greenish tint, more weathered appearance
  - Metal: Oxidized/corroded patina, reduced metalness (0.55)

## Technical Details

- All imperfections use seeded random to ensure consistency across sessions
- Column positions serve as seeds for their individual imperfections
- GPU instancing preserved for performance despite imperfections
- Materials use procedural canvas textures (no external assets)

## Future Considerations

- Could add crumbled/collapsed columns as individual mesh groups
- Moss or vegetation growth on surfaces
- Atmospheric particles (dust motes)
- More dramatic shadows from partial ceiling collapse
