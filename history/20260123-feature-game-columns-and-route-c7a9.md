# Game Columns and Route Update

**Branch**: `feature/game-columns-and-route-c7a9`
**Date**: 2026-01-23

## Problem

Two issues to address:
1. The columns in the game experience were supposed to have a narrower shaft than the base and capital (cathedral-style), but the visual difference was too subtle to notice
2. The game experience route was at `/vr-intro` but should be changed to `/game`

## Investigation

### Column Proportions Issue

The previous implementation had these dimensions:
- Base/Top: `SCALE(11.6)` = 58 units
- Ring/Cap: `SCALE(10.4)` = 52 units
- Shaft: `SCALE(9.2)` = 46 units

The shaft was only about 20% narrower than the base, which is too subtle to create a visible classical column silhouette. Classical columns typically have a shaft that is 55-65% of the base width to create a dramatic tapering effect.

### Root Cause

The original implementation attempted to create different widths but the proportional difference was too small. A 20% width difference is not visually striking, especially when viewing columns from a distance in the game environment.

## Design Decision

Increased the width differential between shaft and base/capital:

### New Column Proportions:
- Plinth (base): `SCALE(11.6)` = 58 units (unchanged, widest)
- Base molding: `SCALE(9.0)` = 45 units (was 10.4)
- **Shaft: `SCALE(7.0)` = 35 units** (was 9.2 - now ~60% of base width)
- Capital: `SCALE(9.0)` = 45 units (was 10.4)
- Abacus (top): `SCALE(11.6)` = 58 units (unchanged, widest)
- Detail rings: `SCALE(7.4)` = 37 units (was 9.6 - matches shaft)

This creates a ~40% width reduction from base to shaft, which is a dramatic and visible difference matching classical column proportions.

## Implementation

### Scene.jsx Changes
- Updated `geometries` useMemo in `InstancedColumns` component
- Shaft reduced from `SCALE(9.2)` to `SCALE(7.0)`
- Ring/Cap reduced from `SCALE(10.4)` to `SCALE(9.0)` for smoother transition
- Detail rings reduced from `SCALE(9.6)` to `SCALE(7.4)` to match shaft

### App.jsx Changes
- Changed route from `/vr-intro` to `/game`

## Visual Effect

The new proportions create a clear visual tapering:
```
   [==========]  <- Abacus (11.6)
    [========]   <- Capital (9.0)
      [====]     <- Shaft (7.0)
    [========]   <- Ring (9.0)
   [==========]  <- Base (11.6)
```

## Future Considerations

- Could add chamfered edges to the transitions between shaft and base/capital for smoother visual flow
- Could vary the shaft width slightly per column for more organic ruins look
- Consider adding fluting (vertical grooves) to the shaft for additional classical detail
