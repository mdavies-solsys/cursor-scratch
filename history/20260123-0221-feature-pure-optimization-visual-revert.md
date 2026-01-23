# Feature: Pure Optimization Visual Revert

## Problem Being Solved

The previous performance optimization PR (#47) introduced device detection and mobile-specific optimizations that resulted in visually noticeable differences from the original design. The user requested reverting all visual changes while keeping only "pure optimizations" that don't affect the visual appearance.

## Changes Made

### Removed (Device-Specific / Visual Changes)

1. **Device Detection Code**
   - Removed `detectMobile()` function
   - Removed `IS_MOBILE` constant
   - Removed `QUALITY_PRESETS` object (mobile/desktop presets)
   - Removed `QUALITY` constant

2. **Fog Effect**
   - Removed fog that was added to hide distant geometry
   - Fog changed the visual atmosphere significantly

3. **Lighting Changes**
   - Restored original lighting layout with full grid of ceiling lights
   - Restored original wall sconce positioning
   - Removed reduced light count optimization
   - Restored original light intensities (not device-dependent)

4. **Geometry Density**
   - Restored original column spacing (SCALE(28) x SCALE(25))
   - Restored original rib spacing (SCALE(32))
   - Restored original beam spacing (SCALE(40))
   - Restored original longitudinal beam spacing (SCALE(25))
   - Removed device-dependent spacing variations

5. **Material Quality**
   - Restored bump maps for all materials (not removed on mobile)
   - Restored anisotropy to 16 for all textures
   - Restored full texture size (512) for all devices

6. **Renderer Settings**
   - Restored original tone mapping exposure (1.5 for all)
   - Restored original background color (#1a1815)
   - Restored original shadow map size (2048)
   - Restored shadows enabled for all
   - Restored antialiasing for all

7. **Visual Elements**
   - Restored center floor trim for all devices
   - Restored wall bands for all devices
   - Restored emissive light fixtures for all devices
   - Restored column detail rings for all devices

### Kept (Pure Optimizations)

1. **GPU Instanced Columns (`InstancedColumns` component)**
   - This is a pure performance optimization that renders all columns using GPU instancing
   - Instead of creating individual mesh objects for each column, all columns share the same geometry and are rendered in batches
   - This provides the exact same visual output with significantly better GPU performance
   - Kept original geometry quality (24 segments for cylinders, 32 for shafts)

## Technical Notes

- GPU instancing reduces draw calls from ~600+ (many individual column meshes) to ~6 (one per instanced component type)
- The `InstancedColumns` component uses `instancedMesh` with pre-computed transformation matrices
- All visual parameters (segments, dimensions, materials) match the original non-instanced version

## Future Considerations

If performance becomes an issue, the following pure optimizations could be explored:
- Geometry merging for static elements (walls, beams)
- Level-of-detail (LOD) systems that maintain visual quality at close range
- Occlusion culling
- Texture atlasing

These should be evaluated separately from device detection to ensure visual parity is maintained.
