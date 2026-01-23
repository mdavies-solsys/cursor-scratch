# Cathedral Column Design - Square Geometry

**Branch**: `feature/cathedral-column-design-93d3`
**Date**: 2026-01-23

## Problem

The current columns in the game experience use cylindrical geometry (CylinderGeometry). The user requested:
1. Square columns instead of cylindrical
2. Larger at the top and bottom (base and capital) vs the main shaft
3. Cathedral-like aesthetic with concrete appearance
4. Keep current size and count

## Investigation

The columns are implemented in `src/components/Scene.jsx` using the `InstancedColumns` component with GPU instancing for performance. Current geometry:
- Base: CylinderGeometry (SCALE(6.4) to SCALE(7.2) radius)
- Ring: CylinderGeometry (SCALE(5.8) to SCALE(6.4) radius)
- Shaft: CylinderGeometry (SCALE(4.6) to SCALE(5.0) radius)
- Cap: BoxGeometry SCALE(10.4) - already square!
- Top: BoxGeometry SCALE(11.6) - already square!
- Detail rings: CylinderGeometry

## Design Decision

Replace cylindrical geometries with BoxGeometry while maintaining the cathedral column profile:

### Classical Column Parts (adapted to square geometry):
1. **Plinth (base)** - Wide square block at floor level
2. **Base molding** - Transitional piece between plinth and shaft
3. **Shaft** - Main square column body (narrower than base/capital)
4. **Capital** - Decorative top section (wider than shaft)
5. **Abacus (top)** - Square block at very top supporting ceiling

### Size Proportions:
- Plinth: SCALE(11.6) x SCALE(11.6) - widest at base
- Base molding: SCALE(10.4) x SCALE(10.4)
- Shaft: SCALE(9.2) x SCALE(9.2) - narrower main body
- Capital: SCALE(10.4) x SCALE(10.4) - widens again
- Abacus: SCALE(11.6) x SCALE(11.6) - widest at top

This creates the classic cathedral column silhouette with flared base and capital.

## Implementation

- Changed all CylinderGeometry to BoxGeometry
- Adjusted dimensions for square profile
- Replaced detail rings with square trim bands
- Maintained imperfection system (tilts, height variations, position offsets)
- Kept GPU instancing for performance

## Future Considerations

- Could add beveled edges for softer look
- Could add surface details like fluting (vertical grooves) adapted to square form
- Could vary column designs (some with more ornate capitals)
