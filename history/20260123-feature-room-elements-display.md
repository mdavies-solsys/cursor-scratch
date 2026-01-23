# Room Elements Display Adjustments

**Branch:** `feature/room-elements-display-e375`
**Date:** 2026-01-23

## Problem

Recent changes to the game experience needed adjustments:
1. Green lights were too yellowish/amber, needed to be more green-white
2. Ground debris (floor rubble) was not desired
3. Column count was inadvertently reduced when spacing was increased for larger columns
4. Columns were disappearing when moving around the room (frustum culling bug)

## Key Findings

### Light Colors
The lights had been changed to greenish-yellow tones (`#c9b833`, `#d9d968`, etc.) in the "ruins refinements" commit. These needed to be shifted toward white with a subtle green tint.

### Column Count Reduction
In commit `72ff30b` (ruins experience refinements), the column spacing was increased from:
- X spacing: `SCALE(42)` → `SCALE(60)`
- Z spacing: `SCALE(38)` → `SCALE(55)`
- Wall margin: `SCALE(16)` → `SCALE(30)`
- Center corridor: `SCALE(8)` → `SCALE(20)`

This significantly reduced the number of columns, which was unintended.

### Column Disappearing Bug
The bug where columns disappear when walking around the room was caused by Three.js frustum culling on `instancedMesh` components. When instances are spread across a large area, the bounding sphere calculation can cause incorrect culling decisions, making columns appear to flash or disappear when the camera moves.

## Changes Made

### 1. Green-White Light Colors
Changed all light colors to white with subtle green undertones:
- Ambient: `#d9d968` → `#e8f0e0`
- Hemisphere sky: `#d9dd78` → `#f0f8e8`
- Hemisphere ground: `#3d4422` → `#404838`
- Main directional: `#d4c955` → `#e8f0d8`
- Secondary directional: `#d4b844` → `#dde8cc`
- Ceiling point lights: `#c9b833` → `#e0f0d0`
- Wall sconces: `#c99922` → `#d8e8c8`
- Emissive ceiling: `#d9d966`/`#c9b833` → `#e8f8e0`/`#d0e8c0`
- Emissive sconces: `#d4bb55`/`#c99922` → `#e0f0d8`/`#c8e0b8`
- Fog: `#181812` → `#1a1a18`

### 2. Removed Floor Debris
Removed the `FloorDebris` component entirely, including its JSX usage and component definition.

### 3. Restored Column Count
Reverted column spacing to original values:
- X spacing: `SCALE(42)` (was `SCALE(60)`)
- Z spacing: `SCALE(38)` (was `SCALE(55)`)
- Wall margin: `SCALE(16)` (was `SCALE(30)`)
- Center corridor: `SCALE(8)` (was `SCALE(20)`)

### 4. Fixed Frustum Culling Bug
Added `frustumCulled={false}` to all `instancedMesh` components (8 total):
- Column base
- Column ring
- Column shaft
- Column cap
- Column top
- 3x detail rings

This prevents Three.js from incorrectly culling column instances based on bounding sphere calculations.

## Technical Notes

The frustum culling fix trades a small amount of GPU efficiency for correctness. Since the columns are the main visual feature of the room and the instanced meshes are already highly optimized, this tradeoff is acceptable.

## Future Considerations

If performance becomes an issue with frustum culling disabled, consider:
1. Manually computing and setting a correct bounding sphere for each instanced mesh
2. Using a custom frustum culling implementation that properly handles spread-out instances
