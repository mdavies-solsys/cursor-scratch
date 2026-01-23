# Game Experience: Column Sizing Fix and Route Updates

**Branch**: `feature/game-experience-columns-routes-feb9`
**Date**: 2026-01-23

## Problems Addressed

1. **Home screen button route**: The button on the home page was pointing to `/vr-intro` but the game experience route had been changed to `/game`
2. **Old route backwards compatibility**: Users with old links to `/vr-intro` needed to still be able to access the game
3. **Column sizing issue (third attempt)**: The column shaft was supposed to be visibly narrower than the base and capital, but appeared uniform in size
4. **Decorative detail rings**: Unwanted decorative bands were wrapping around the columns and needed to be removed

## Root Cause Analysis - Column Sizing

### Previous Attempts
This was the third attempt at fixing the column sizing. Previous history files documented:
- `20260123-feature-cathedral-column-design-93d3.md` - Changed from cylindrical to square columns
- `20260123-feature-game-columns-and-route-c7a9.md` - Attempted to increase width difference between shaft and base

### Why Previous Fixes Failed

**The actual root cause** was that the base and capital parts were **extremely short** compared to the shaft:

```
Previous dimensions (with HALL_SCALE = 5):
- COLUMN_BASE_HEIGHT = SCALE(0.6) = 3 units
- COLUMN_RING_HEIGHT = SCALE(0.3) = 1.5 units  
- COLUMN_CAP_HEIGHT = SCALE(0.8) = 4 units
- COLUMN_TOP_HEIGHT = SCALE(0.4) = 2 units
- SHAFT HEIGHT = ~149 units (remainder of ~160 unit column)
```

The non-shaft parts totaled only **10.5 units** out of ~160 units total column height = **6.5% of column height**.

Even though the shaft was narrower (35 units vs 58 units at base), the wider parts were so short they were barely visible - tiny slivers at the very top and bottom of the column.

### The Fix

1. **Made base and capital parts much taller** so the width difference is actually visible:
   - `COLUMN_BASE_HEIGHT`: 0.6 → 4.0 (6.7x taller)
   - `COLUMN_RING_HEIGHT`: 0.3 → 1.5 (5x taller)
   - `COLUMN_CAP_HEIGHT`: 0.8 → 3.0 (3.75x taller)
   - `COLUMN_TOP_HEIGHT`: 0.4 → 2.0 (5x taller)

2. **Made the shaft even narrower** for more dramatic contrast:
   - Base width: 11.6 → 12.0 (widest)
   - Ring width: 9.0 → 8.0 (transition)
   - **Shaft width: 7.0 → 5.5** (narrowest - now 46% of base, was 60%)
   - Cap width: 9.0 → 8.0 (transition)
   - Top width: 11.6 → 12.0 (widest)

3. **Removed decorative detail rings** - the three square bands at 20%, 50%, 80% of shaft height that were wrapping around the columns

### New Column Proportions (Visual)

```
    [============]  <- Abacus/Top (12.0 wide, 10 units tall)
      [========]    <- Capital (8.0 wide, 15 units tall)
        [====]      <- Shaft (5.5 wide, ~107 units tall)
      [========]    <- Ring (8.0 wide, 7.5 units tall)
    [============]  <- Base (12.0 wide, 20 units tall)
```

The non-shaft parts now total **52.5 units** = ~33% of column height (was 6.5%).

## Route Changes

### App.jsx
- Added `/vr-intro` route that also points to `VrIntro` component for backwards compatibility
- Routes now include both `/game` (new) and `/vr-intro` (legacy)

### Home.jsx
- Updated "Enter Matt's world" button link from `/vr-intro` to `/game`

## Technical Changes

### Scene.jsx
- Updated column dimension constants (BASE_HEIGHT, RING_HEIGHT, CAP_HEIGHT, TOP_HEIGHT)
- Updated geometry definitions with new widths (base 12.0, ring 8.0, shaft 5.5, cap 8.0, top 12.0)
- Removed `detailRingRefs` ref
- Removed `detailRing` geometry
- Removed detail ring positioning code in useEffect
- Removed detail ring update in instance matrix updates
- Removed detail ring instancedMesh rendering (3 meshes removed)

## Lessons Learned

1. **Width differences don't matter if parts are too short** - Even a 40% width reduction is invisible when the wider parts are only 2% of the object's height
2. **Check proportions holistically** - Previous attempts focused only on the width ratios without considering height proportions
3. **Test visually at actual scale** - What looks like a dramatic difference in code may be imperceptible at runtime scale

## Future Considerations

- If columns still don't look right, consider adding chamfered edges between shaft and base/capital
- Could add subtle surface details like weathering patterns to break up the flat surfaces
- The height variation system (`heightVar`) may need adjustment now that base/cap are taller
