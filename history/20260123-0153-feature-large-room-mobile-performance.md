# PR: Large Room Mobile Performance Optimizations

**Branch**: `feature/large-room-mobile-performance-32d2`  
**Date**: January 2026  
**Status**: Implemented

---

## Problem Statement

After increasing the room size by 5x in both width and length (25x total floor area), mobile devices experienced a massive frame rate drop in the WebXR/Three.js scene.

### Room Dimensions

| Dimension | Original | Expanded | Scale Factor |
|-----------|----------|----------|--------------|
| Width | `SCALE(44)` = 220 | `SCALE(44 * 5)` = 1100 | 5x |
| Length | `SCALE(110)` = 550 | `SCALE(110 * 5)` = 2750 | 5x |
| Height | `SCALE(16)` = 80 | `SCALE(16)` = 80 | 1x |
| Floor Area | 121,000 sq units | 3,025,000 sq units | 25x |

---

## Analysis: Performance Bottlenecks Identified

### 1. Excessive Light Count (CRITICAL)

The lighting system dynamically generated lights based on room dimensions:

| Light Type | Count | Impact |
|------------|-------|--------|
| Ceiling point lights | ~55 (5×11 grid) | Very High |
| Wall sconce point lights | ~32 (16 per side × 2) | High |
| Emissive ceiling fixtures | ~55 meshes | Medium |
| Emissive wall sconces | ~32 meshes | Medium |
| **Total** | **~170+ light-related objects** | Critical |

Point lights are expensive because each one requires the GPU to calculate lighting contribution for every visible fragment.

### 2. Column Draw Calls (CRITICAL)

Columns were rendered as individual mesh groups:

- Column grid: ~6 rows × 22 columns = ~132 columns
- Each column: 8 meshes (base, ring, shaft, 3 detail rings, cap, top)
- **Total**: ~1000+ individual draw calls

Draw call overhead is a major mobile GPU bottleneck.

### 3. Shadow Map Configuration (HIGH)

- Single 2048×2048 shadow map covering 1100×2750 area
- Effective resolution: ~0.7 pixels per world unit
- Shadow calculations for entire room regardless of player position

### 4. Geometry Complexity (MEDIUM)

- Cylinder geometries using 24-32 segments
- Decorative trim rings on every column
- Wall bands running full room length

### 5. Material/Texture Overhead (MEDIUM)

- 512×512 canvas textures with 16x anisotropy
- Multiple texture maps per material (diffuse, roughness, bump)
- All materials using `MeshStandardMaterial` (PBR)

---

## Solution: Optimizations Implemented

### 1. Quality Preset System

Added automatic device detection with two quality tiers:

```javascript
const QUALITY_PRESETS = {
  mobile: {
    shadowMapSize: 512,
    shadowsEnabled: false,
    maxLights: 8,
    textureSize: 256,
    anisotropy: 2,
    cylinderSegments: 8,
    columnDetailRings: false,
    pixelRatio: Math.min(devicePixelRatio, 1.5),
    antialias: false,
    lightDistance: 150,
    enableEmissiveMeshes: false,
  },
  desktop: {
    shadowMapSize: 1024,
    shadowsEnabled: true,
    maxLights: 24,
    textureSize: 512,
    anisotropy: 8,
    cylinderSegments: 16,
    columnDetailRings: true,
    pixelRatio: Math.min(devicePixelRatio, 2),
    antialias: true,
    lightDistance: 300,
    enableEmissiveMeshes: true,
  },
};
```

Detection criteria:
- User agent mobile patterns
- `navigator.hardwareConcurrency <= 4`
- `pointer: coarse` media query

### 2. GPU Instancing for Columns

Replaced ~1000 individual meshes with `InstancedMesh`:

```javascript
<instancedMesh
  ref={shaftRef}
  args={[geometry, material, count]}  // Single draw call for ALL shafts
  castShadow={QUALITY.shadowsEnabled}
/>
```

Result: ~1000 draw calls → 6-9 instanced draw calls

### 3. Optimized Lighting Grid

Instead of filling room with lights, use a fixed budget:

```javascript
const lightPositions = useMemo(() => {
  const maxLights = QUALITY.maxLights;  // 8 on mobile, 24 on desktop
  const ceilingLightBudget = Math.floor(maxLights * 0.7);
  // ... calculate optimal grid placement
}, []);
```

Compensate with higher ambient/hemisphere intensity.

### 4. Fog-Based Distance Culling

Added distance fog to naturally hide far geometry:

```javascript
const FOG_NEAR = IS_MOBILE ? SCALE(30) : SCALE(60);   // 150 : 300 units
const FOG_FAR = IS_MOBILE ? SCALE(150) : SCALE(300);  // 750 : 1500 units

<fog attach="fog" args={["#1a1510", FOG_NEAR, FOG_FAR]} />
```

Benefits:
- Reduces effective render distance
- Hides LOD transitions
- Creates atmospheric depth
- Shadow camera frustum can match fog distance

### 5. Shadow Optimization

- **Mobile**: Shadows completely disabled
- **Desktop**: 
  - Reduced from 2048 to 1024 resolution
  - Shadow camera frustum limited to fog distance
  - Added shadow bias to reduce artifacts

### 6. Geometry Reduction

| Element | Desktop | Mobile |
|---------|---------|--------|
| Cylinder segments | 16 | 8 |
| Column detail rings | Yes | No |
| Wall bands | Yes | No |
| Center floor trim | Yes | No |
| Column spacing | `SCALE(40)` | `SCALE(56)` |
| Rib spacing | `SCALE(40)` | `SCALE(64)` |

### 7. Material Optimization

Mobile materials skip bump maps:

```javascript
if (IS_MOBILE) {
  return new THREE.MeshStandardMaterial({
    color: baseColor,
    map,  // Only diffuse texture
    roughness,
    metalness,
  });
}
```

---

## Design Decisions & Trade-offs

### Decision 1: Disable Shadows on Mobile

**Chosen**: Complete shadow removal on mobile  
**Trade-off**: Less visual depth, but massive performance gain  
**Rationale**: Shadow maps are one of the most expensive operations. Mobile GPUs struggle with even simple shadow maps at 72+ FPS.

### Decision 2: Fixed Light Budget vs. Density-Based

**Chosen**: Fixed budget (8/24 lights)  
**Alternative**: Maintain light density (would be ~85 lights)  
**Rationale**: Point lights scale poorly. Better to use fewer, brighter lights with higher ambient fill.

### Decision 3: InstancedMesh vs. Merged Geometry

**Chosen**: InstancedMesh  
**Alternative**: Merge all columns into single geometry  
**Rationale**: Instancing allows material sharing and potential future per-instance variations. Merged geometry would require baking materials.

### Decision 4: Fog Distance on Mobile

**Chosen**: 150-750 unit fog (vs 300-1500 desktop)  
**Trade-off**: Less visible room area  
**Rationale**: Mobile users accept shorter view distances. The room is so large that fog creates mystical atmosphere rather than feeling limiting.

---

## Future Considerations

### If More Optimization Needed

1. **Level of Detail (LOD) System**
   - Close columns: Full geometry
   - Medium: No decorative rings  
   - Far: Billboard sprites or remove entirely

2. **Baked Lighting**
   - Pre-compute lightmaps for static geometry
   - Eliminates all real-time light calculations
   - Requires static scene (no moving lights)

3. **Occlusion Culling**
   - Don't render objects behind columns/walls
   - Significant in enclosed spaces
   - Three.js doesn't include this by default

4. **Progressive Zone Loading**
   - Divide room into sections
   - Only render nearby zones
   - Load/unload based on player position

5. **Dedicated Mobile Scene**
   - Completely separate scene with 50% fewer decorative elements
   - Simpler `MeshBasicMaterial` for distant objects
   - Pre-merged static geometry

### If Room Gets Larger

The current optimizations scale reasonably, but at 10x+ original size consider:
- Streaming/chunked world loading
- Virtual texturing for floor/walls
- Impostor system for distant columns

---

## Key Files Modified

| File | Changes |
|------|---------|
| `src/components/Scene.jsx` | Quality presets, instancing, lighting optimization, fog |

## Performance Metrics

| Metric | Before (Est.) | After Mobile | After Desktop |
|--------|---------------|--------------|---------------|
| Point lights | ~85 | 8 | 24 |
| Draw calls (columns) | ~1000 | ~6-9 | ~9 |
| Shadow maps | 1 @ 2048² | 0 | 1 @ 1024² |
| Emissive meshes | ~85 | 0 | ~24 |

---

## Related Documentation

- `docs/threejs-lighting-research.md` - Comprehensive Three.js lighting reference
- Three.js InstancedMesh: https://threejs.org/docs/#api/en/objects/InstancedMesh
- React Three Fiber performance: https://docs.pmnd.rs/react-three-fiber/advanced/scaling-performance
