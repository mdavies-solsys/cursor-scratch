# Column Variation and Floor Reflection Adjustments

**Branch:** `feature/column-variation-floor-reflection-5c04`
**Date:** 2026-01-23

## Problem

1. Column base and top proportions were too extreme compared to the main shaft
2. Floor had some reflectivity, which didn't match the intended dirt appearance

## Changes Made

### Column Proportions

Reduced the size difference between column base/top and the shaft:

| Part | Before | After | Notes |
|------|--------|-------|-------|
| Base (plinth) | SCALE(12.0) | SCALE(7.0) | Reduced significantly |
| Ring (molding) | SCALE(8.0) | SCALE(6.2) | Reduced |
| Shaft | SCALE(5.5) | SCALE(5.5) | **Unchanged as requested** |
| Cap (capital) | SCALE(8.0) | SCALE(6.2) | Reduced |
| Top (abacus) | SCALE(12.0) | SCALE(7.0) | Reduced significantly |

The base/top are now only ~27% wider than the shaft (ratio 7.0/5.5 = 1.27x) instead of the previous dramatic 118% wider (ratio 12.0/5.5 = 2.18x).

### Floor Material

Made the floor completely non-reflective to mimic dirt:

| Property | Before | After |
|----------|--------|-------|
| roughness | 0.82 | 1.0 (completely matte) |
| metalness | 0.03 | 0.0 (no metallic reflection) |
| baseColor | #454a48 | #3d3830 (earthy brown-gray) |
| accentColor | #3a3f3d | #2e2a24 (darker earth tones) |

## Files Modified

- `src/components/Scene.jsx` - Column geometry definitions and floor material properties

## Technical Details

The columns use `THREE.BoxGeometry` for square cathedral-style columns with 5 parts (base, ring, shaft, cap, top). The floor uses `createTexturedMaterial()` which generates procedural textures with configurable roughness/metalness.

Setting roughness to 1.0 and metalness to 0.0 creates a perfectly diffuse (Lambertian) surface that reflects no specular highlights, matching the appearance of dirt.
