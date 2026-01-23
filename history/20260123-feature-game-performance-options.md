# Performance Optimization Options Analysis

**Branch**: `feature/game-performance-options-646e`  
**Date**: January 23, 2026  
**Status**: Research & Analysis (No Changes Made)

---

## Executive Summary

This document presents a comprehensive analysis of performance optimization options for the Three.js/React Three Fiber game experience. Options are categorized by their **visual impact** - from pure optimizations (invisible to users) to strategic changes (noticeable visual differences that benefit performance).

The current scene is a large virtual hall (1100 × 2750 world units) with:
- **~170+ point lights** (ceiling grid + wall sconces)
- **~130+ columns** using GPU instancing
- **2048×2048 shadow map**
- **PBR materials** with diffuse, roughness, and bump maps
- **16× anisotropic filtering** on all textures

---

## Category A: Pure Optimizations (No Visual Impact)

These changes improve performance without any perceptible difference to users.

### A1. Geometry Merging for Static Elements

**Current State**: Walls, floor, ceiling, beams are separate meshes with individual draw calls.

**Optimization**: Merge static geometry into a single `BufferGeometry` per material type.

**Expected Gain**: Reduce 20-30 draw calls to 3-5 draw calls.

**Visual Impact**: ✅ **None** - Identical rendering output.

---

### A2. Object Pooling & Allocation Reduction

**Current State**: Some `new THREE.Vector3()` and `new THREE.Matrix4()` created in render loops or effects.

**Optimization**: Pre-allocate all temporary math objects outside loops; reuse between frames.

**Expected Gain**: Reduced garbage collection pauses, smoother frame times.

**Visual Impact**: ✅ **None** - Computational optimization only.

---

### A3. Frustum Culling Verification

**Current State**: Three.js default frustum culling is enabled.

**Optimization**: Ensure `frustumCulled = true` on all meshes (especially instanced). Consider tighter bounding spheres.

**Expected Gain**: Prevents rendering off-screen geometry (significant in this large room).

**Visual Impact**: ✅ **None** - Objects outside view aren't rendered anyway.

---

### A4. Material Sharing Audit

**Current State**: Materials created in `useMemo` and reused for similar objects.

**Optimization**: Audit for any duplicate material instances; ensure maximum sharing.

**Expected Gain**: Reduced shader compilation and state changes.

**Visual Impact**: ✅ **None** - Same materials, just fewer instances.

---

### A5. Texture Memory Optimization

**Current State**: Canvas textures generated at 512×512 with 16× anisotropy.

**Optimization**: Ensure textures are power-of-two, consider compressed formats (KTX2/Basis), and dispose unused textures.

**Expected Gain**: Lower GPU memory usage, faster texture sampling.

**Visual Impact**: ✅ **None** - If using same resolution and format.

---

### A6. Render Loop Optimization

**Current State**: Full scene renders every frame regardless of camera movement.

**Optimization**: Implement `frameloop="demand"` mode - only render when camera moves or animations occur.

**Expected Gain**: Battery savings on mobile; reduced GPU load when idle.

**Visual Impact**: ✅ **None** - Scene updates only when needed.

---

## Category B: Subtle Optimizations (Barely Noticeable)

These changes have minor visual differences that most users won't perceive.

### B1. Shadow Map Resolution Reduction

**Current State**: 2048×2048 shadow map covering entire hall.

**Optimization Options**:
| Resolution | Quality | Performance Gain |
|------------|---------|------------------|
| 2048×2048 | Current | Baseline |
| 1024×1024 | Good | ~4× faster shadow rendering |
| 512×512 | Acceptable | ~16× faster shadow rendering |

**Visual Impact**: 🟡 **Subtle** - Slightly softer shadow edges. Most noticeable on fine details close to camera. The large room scale makes this less apparent.

**User Experience**: Shadows become marginally less crisp. On mobile/VR where performance is critical, this trade-off is favorable.

---

### B2. Anisotropic Filtering Reduction

**Current State**: 16× anisotropic filtering on all textures.

**Optimization Options**:
| Level | Quality | Performance |
|-------|---------|-------------|
| 16× | Maximum | Baseline |
| 8× | High | ~10-15% texture sampling improvement |
| 4× | Medium | ~20-30% texture sampling improvement |
| 2× | Low | ~40% texture sampling improvement |

**Visual Impact**: 🟡 **Subtle** - Textures on surfaces viewed at steep angles (floor when looking ahead) may appear slightly blurrier. Not noticeable on surfaces viewed head-on.

**User Experience**: Floor tiles far in the distance become slightly less sharp. Imperceptible in motion.

---

### B3. Texture Size Reduction (Distant Objects)

**Current State**: All textures at 512×512.

**Optimization**: Reduce to 256×256 for ceiling, upper walls (areas users don't focus on).

**Visual Impact**: 🟡 **Subtle** - Ceiling and upper wall textures slightly less detailed. User focus is typically at eye level.

**User Experience**: Virtually unnoticeable as attention focuses on floor, columns, and doorways.

---

### B4. Cylinder Segment Reduction

**Current State**: Columns use 24-32 segments for circular geometry.

**Optimization Options**:
| Segments | Shape Quality | Draw Complexity |
|----------|---------------|-----------------|
| 32 | Smooth circles | Baseline |
| 16 | Slightly polygonal at close range | 50% vertex reduction |
| 12 | Visible faceting up close | 63% vertex reduction |
| 8 | Noticeably octagonal | 75% vertex reduction |

**Visual Impact**: 🟡 **Subtle** (16 segments) to 🟠 **Noticeable** (8 segments) - At 16 segments, only visible when standing directly next to a column. At 8 segments, columns appear octagonal.

**User Experience**: With 16 segments, users moving through the space won't notice. With 8 segments, columns lose their classical round appearance.

---

### B5. Bump Map Removal

**Current State**: Bump maps on all materials add surface detail.

**Optimization**: Remove bump maps - use only diffuse and roughness.

**Visual Impact**: 🟡 **Subtle** - Surfaces appear flatter under directional lighting. Stone texture loses some 3D micro-detail.

**User Experience**: The overall atmosphere remains; the "chiseled stone" look becomes "flat painted stone." Noticeable if comparing before/after directly, not in general gameplay.

---

## Category C: Strategic Optimizations (Noticeable but Beneficial)

These changes have clear visual impact but provide significant performance benefits.

### C1. Light Count Reduction

**Current State**:
- ~55 ceiling point lights (11×5 grid)
- ~32 wall sconce point lights
- ~87 total dynamic lights

Each point light requires fragment shader calculations for every visible pixel.

**Optimization Options**:

| Configuration | Light Count | Performance Impact |
|---------------|-------------|-------------------|
| Current | ~87 | Baseline |
| Reduced Grid (8×3 + 16) | ~40 | ~50% lighting improvement |
| Minimal (4×2 + 8) | ~16 | ~80% lighting improvement |
| Ambient Only | 3-4 | ~95% lighting improvement |

**Visual Impact**: 🟠 **Noticeable**

**What Changes**:
- **40 lights**: Lighting becomes more pooled - bright spots under fixtures, dimmer areas between. Creates more dramatic light/shadow interplay.
- **16 lights**: Distinct zones of illumination. The hall feels like a vast candlelit cathedral rather than uniformly bright.
- **Ambient only**: Flat, even lighting everywhere. Loses the warm, inviting glow aesthetic.

**User Experience**: 
- With 40 lights: Enhances atmosphere - more mysterious, dramatic. Many users prefer this.
- With 16 lights: Significant mood shift to "sparse torchlit dungeon." Works thematically but is clearly different.
- Ambient only: Loses all warmth and atmosphere. Not recommended.

---

### C2. Distance Fog Implementation

**Current State**: No fog - entire hall visible regardless of distance.

**Optimization**: Add exponential or linear fog matching background color.

| Fog Range | Visibility | Performance Gain |
|-----------|------------|------------------|
| Near: 300, Far: 1500 | Most of hall visible | Mild - enables shadow frustum reduction |
| Near: 150, Far: 750 | Half hall visible | Moderate - significant culling benefit |
| Near: 50, Far: 300 | Nearby only | Major - enables aggressive LOD |

**Visual Impact**: 🟠 **Noticeable**

**What Changes**:
- The hall appears to fade into atmospheric haze/darkness at distance
- Creates sense of depth and mystery
- Hides distant geometry (enables aggressive culling)

**User Experience**: 
- **Positive**: Many find fog atmospheric and immersive. Creates "ancient hall lost in time" feeling.
- **Negative**: Users can't see the full extent of the room. May feel enclosed/claustrophobic.

**Recommendation**: Fog at 150-750 range with a warm amber tint (#1a1510) maintains the candle-lit atmosphere while enabling major performance gains.

---

### C3. Shadow Removal

**Current State**: Directional light casts shadows from all geometry.

**Optimization**: Disable `castShadow` on all lights and `receiveShadow` on meshes.

**Visual Impact**: 🔴 **Highly Noticeable**

**What Changes**:
- No shadow under columns, doorways, or player avatars
- Scene loses depth and grounding
- Objects appear to "float" rather than being placed

**User Experience**: 
- The hall loses significant visual quality
- Columns and architectural details lose definition
- Players may feel less present/immersed

**Recommendation**: Only for extreme performance requirements (mobile VR at 72fps). Consider implementing selectively (shadows on nearby objects only).

---

### C4. Emissive Fixture Removal

**Current State**: ~55 ceiling fixtures + ~32 wall sconces with emissive materials (glowing panels).

**Optimization**: Remove emissive mesh fixtures entirely - keep only the point lights.

**Visual Impact**: 🟠 **Noticeable**

**What Changes**:
- No visible glowing light sources
- Light appears to come from nowhere
- Loses visual explanation for the illumination

**User Experience**: 
- Less visually coherent (light without source)
- Slightly breaks immersion
- But practically, users focus on navigation, not light sources

---

### C5. Decorative Detail Reduction

**Current State**:
- Column detail rings (3 per column × 130 columns = 390 rings)
- Wall ribs with decorative trim
- Wall bands running full length
- Ceiling beams (transverse and longitudinal)

**Optimization**: Remove column detail rings, simplify wall trim.

**Visual Impact**: 🟠 **Noticeable**

**What Changes**:
- Columns become plain cylinders with base/cap
- Walls lose some architectural interest
- Space feels less "grand hall," more "industrial corridor"

**User Experience**: 
- Architectural authenticity diminishes
- The "European great hall" aesthetic becomes generic
- Still functional as a game space

---

### C6. Column Count Reduction

**Current State**: ~130 columns filling the expanded hall.

**Optimization Options**:
| Spacing | Column Count | Visual Density |
|---------|--------------|----------------|
| Current (28×25) | ~130 | Dense colonnade |
| 1.5× spacing | ~60 | Moderate - still grand |
| 2× spacing | ~35 | Sparse - more open |
| Perimeter only | ~40 | Open center, framed edges |

**Visual Impact**: 🟠 **Noticeable**

**What Changes**:
- With 60 columns: Still feels like a columned hall, more open for movement
- With 35 columns: Clearly a different design - columns mark zones rather than fill space
- Perimeter only: Transforms from "colonnade" to "pillared courtyard"

**User Experience**:
- Fewer columns = easier navigation, less visual complexity
- Trade-off between "grand architecture" and "open arena" feel
- Some users may prefer the openness

---

### C7. Level of Detail (LOD) System

**Current State**: All geometry rendered at full quality regardless of distance.

**Optimization**: Implement `THREE.LOD` for columns:
- **LOD 0** (< 50 units): Full detail (24 segments, detail rings)
- **LOD 1** (50-150 units): Medium detail (12 segments, no rings)
- **LOD 2** (> 150 units): Low detail (8 segments, simple geometry)
- **LOD 3** (> 300 units): Billboard sprite or culled entirely

**Visual Impact**: 🟡 **Subtle** (if transitions are smooth)

**What Changes**:
- Columns simplify as you walk away from them
- If implemented poorly: visible "popping" when LOD changes
- If implemented well: imperceptible quality reduction at distance

**User Experience**: 
- Done right: No perceptible difference
- Done wrong: Distracting geometry changes in peripheral vision

**Implementation Complexity**: HIGH - Requires careful threshold tuning and potentially smooth transitions.

---

### C8. Baked Lighting (Major Architecture Change)

**Current State**: All lighting calculated in real-time.

**Optimization**: Pre-compute lighting into texture lightmaps.

**Visual Impact**: 🟠 **Noticeable** (but can be higher quality)

**What Changes**:
- Lighting becomes static (can't change dynamically)
- Can achieve higher quality (global illumination, soft shadows) than real-time
- Requires lightmap UV coordinates on geometry

**User Experience**:
- Often looks BETTER than real-time lighting
- But player shadows and dynamic objects need separate treatment
- Moving lights (e.g., flickering candles) would require hybrid approach

**Implementation Complexity**: VERY HIGH - Requires baking pipeline, UV mapping, significant workflow changes.

---

## Category D: Device-Specific Optimizations

These automatically adjust based on device capability.

### D1. Quality Preset System

**Concept**: Detect device capability and apply appropriate settings.

```
MOBILE (< 4 cores, touch device):
- Shadows: OFF
- Shadow Map: N/A
- Lights: 8-12
- Anisotropy: 2-4
- Texture Size: 256
- Cylinder Segments: 8-12
- Fog: Aggressive (50-300)
- Pixel Ratio: 1.0-1.5

DESKTOP:
- Shadows: ON
- Shadow Map: 1024
- Lights: 24-40
- Anisotropy: 8
- Texture Size: 512
- Cylinder Segments: 16-24
- Fog: Moderate (150-750)
- Pixel Ratio: Up to 2.0

HIGH-END:
- Shadows: ON
- Shadow Map: 2048
- Lights: 40+
- Anisotropy: 16
- Texture Size: 512-1024
- Cylinder Segments: 24-32
- Fog: Subtle or none
- Pixel Ratio: Native
```

**Visual Impact**: 🟠 **Varies by device**

**User Experience**: 
- Mobile users get smooth performance with reduced visuals
- Desktop users get full quality
- May cause confusion if same user accesses from different devices

**Note**: This was implemented and reverted in previous PR due to preference for consistent visuals. Could be reconsidered with user-facing quality toggle.

---

### D2. User-Controlled Quality Settings

**Concept**: Let users choose their quality/performance balance.

**Options**:
- Low / Medium / High / Ultra presets
- Or individual toggles (Shadows On/Off, Light Quality, etc.)

**Visual Impact**: 🟢 **User-controlled**

**User Experience**: 
- Users can optimize for their hardware
- Requires UI implementation
- Most effective when combined with performance metrics display

---

## Optimization Priority Matrix

| Optimization | Performance Gain | Visual Impact | Implementation Effort | Recommended |
|--------------|------------------|---------------|----------------------|-------------|
| A1. Geometry Merging | Medium | None | Low | ✅ Yes |
| A2. Object Pooling | Low | None | Low | ✅ Yes |
| A3. Frustum Culling | Medium | None | Trivial | ✅ Yes |
| A4. Material Sharing | Low | None | Low | ✅ Yes |
| A5. Texture Optimization | Low-Medium | None | Medium | ✅ Yes |
| A6. Demand Rendering | Medium | None | Low | ✅ Yes |
| B1. Shadow Map 1024 | Medium | Subtle | Trivial | ✅ Yes |
| B2. Anisotropy 8× | Low | Subtle | Trivial | ✅ Yes |
| B3. Ceiling Tex 256 | Low | Subtle | Low | 🟡 Maybe |
| B4. 16 Segments | Medium | Subtle | Trivial | ✅ Yes |
| B5. No Bump Maps | Low | Subtle | Trivial | 🟡 Maybe |
| C1. 40 Lights | High | Noticeable | Low | 🟡 Consider |
| C2. Fog 150-750 | High | Noticeable | Low | 🟡 Consider |
| C3. No Shadows | Very High | Major | Trivial | ❌ Last resort |
| C4. No Emissives | Medium | Noticeable | Trivial | 🟡 Maybe |
| C5. No Detail Rings | Low | Noticeable | Low | ❌ Affects aesthetic |
| C6. 60 Columns | Medium | Noticeable | Low | 🟡 Consider |
| C7. LOD System | High | Subtle-None | High | 🟡 Worth it if time allows |
| C8. Baked Lighting | Very High | Varies | Very High | ❌ Major refactor |
| D1. Auto Presets | High | Varies | Medium | 🟡 Reconsidered |
| D2. User Settings | High | User choice | Medium | ✅ Best long-term |

---

## Recommended Optimization Path

### Phase 1: Pure Optimizations (No Visual Change)
1. Implement demand-based rendering (`frameloop="demand"`)
2. Merge static geometry (walls, floor, ceiling, beams)
3. Audit material sharing
4. Verify frustum culling
5. Pre-allocate math objects in render loops

### Phase 2: Subtle Improvements
1. Reduce shadow map to 1024×1024
2. Reduce anisotropy to 8×
3. Reduce column segments to 16

### Phase 3: Strategic Choices (User Decision Required)
Choose based on target experience:

**Option A - "Atmospheric Cathedral"**
- Add fog (150-750 range, warm amber)
- Reduce to 40 lights
- Keep shadows

**Option B - "Clean Performance"**
- Disable shadows on mobile only
- Keep all lights but reduce intensity
- Implement user quality toggle

**Option C - "Minimal Mobile"**
- Aggressive fog (50-300)
- 16 lights only
- No shadows
- 8-segment columns

---

## Current Performance Characteristics (Estimated)

| Metric | Current Value | Concern Level |
|--------|---------------|---------------|
| Draw Calls | ~150-200 | Medium |
| Point Lights | ~87 | High |
| Shadow Maps | 1 @ 2048² | Medium |
| Triangle Count | ~50,000 | Low |
| Texture Memory | ~15MB | Low |
| Instanced Objects | ~130 columns × 6 parts | Optimized |

---

## Files Analyzed

- `src/components/Scene.jsx` - Main 3D scene (1100+ lines)
- `src/pages/VrIntro.jsx` - VR entry point
- `src/xrStore.jsx` - XR session configuration
- `history/20260123-0153-feature-large-room-mobile-performance.md` - Prior optimization work
- `history/20260123-0221-feature-pure-optimization-visual-revert.md` - Revert decisions
- `docs/threejs-lighting-research.md` - Lighting reference

---

## References

- [Three.js Performance Tips](https://discoverthreejs.com/tips-and-tricks/)
- [Three.js Manual - Optimization](https://threejs.org/manual/#en/optimize-lots-of-objects)
- [React Three Fiber Performance](https://docs.pmnd.rs/react-three-fiber/advanced/scaling-performance)
- Prior PR history in this repository
