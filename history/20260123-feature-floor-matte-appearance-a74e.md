# Floor Matte Appearance Fix

**Branch:** `feature/floor-matte-appearance-a74e`
**Date:** 2026-01-23

## Problem

The floor appeared shiny/reflective despite a previous attempt to make it matte by setting `roughness: 1.0` and `metalness: 0.0` in the floor material configuration.

## Root Cause Analysis

The previous fix (commit `1cd14e8`) set the floor material properties:
- `roughness: 1.0` (intended: completely matte)
- `metalness: 0.0` (intended: no metallic reflection)

However, the floor still appeared shiny. Investigation revealed the **roughnessMap texture was overriding these values**.

### How Three.js roughnessMap Works

In Three.js `MeshStandardMaterial`, when a `roughnessMap` is used, the effective roughness at each pixel is calculated as:

```
effectiveRoughness = roughness * roughnessMapValue
```

Where `roughnessMapValue` is the grayscale value normalized to [0, 1]:
- Black (0) = 0.0 = very shiny
- White (255) = 1.0 = fully matte

### The Bug

The `createTexturedMaterial` function creates a `roughnessMap` from `createGrainCanvas()`:

```javascript
const grainCanvas = createGrainCanvas(textureSize, grainBase, grainVariance);
// grainBase: 110, grainVariance: 120 for floor
```

This generates grayscale values averaging around **110/255 ≈ 0.43**.

So even though `roughness: 1.0` was set:
```
effectiveRoughness = 1.0 × 0.43 = 0.43 (fairly shiny!)
```

The roughnessMap was effectively cutting the roughness to less than half, making the floor appear reflective.

## Solution

Added a `useRoughnessMap` parameter to `createTexturedMaterial()`:

```javascript
const createTexturedMaterial = ({
  // ...other params
  useRoughnessMap = true,  // Set to false for uniformly matte surfaces
}) => {
  // ...
  if (useRoughnessMap) {
    const roughnessMap = buildCanvasTexture(grainCanvas, repeat, false);
    materialConfig.roughnessMap = roughnessMap;
  }
  // ...
};
```

For the floor material, set `useRoughnessMap: false`:

```javascript
const stoneDark = createTexturedMaterial({
  roughness: 1.0,
  metalness: 0.0,
  useRoughnessMap: false,  // CRITICAL: Disable roughnessMap for true matte
  // ...
});
```

Now the `roughness: 1.0` property is used directly without any multiplication, resulting in a truly matte surface.

## Files Modified

- `src/components/Scene.jsx`
  - Added `useRoughnessMap` parameter to `createTexturedMaterial()`
  - Set `useRoughnessMap: false` for floor material

## Technical Notes

- The `bumpMap` is still applied to maintain the irregular dirt surface texture
- Only the `roughnessMap` is conditionally applied since it affects shininess
- Other materials (walls, columns, trim) continue to use `roughnessMap` for varied surface appearance

## Key Takeaway

When using Three.js `MeshStandardMaterial` with texture maps, remember that `roughnessMap` **multiplies** with the `roughness` property, it doesn't replace it. For uniformly matte surfaces, either:
1. Omit the roughnessMap entirely
2. Use a white (255) roughnessMap
3. Set the roughnessMap to null
