# Scene Component Structure Refactor

**Branch:** `feature/scene-component-structure-45eb`  
**Date:** 2026-01-24

## Problem Being Solved

The `Scene.jsx` file had grown to ~1,600 lines containing mixed concerns:
- Constants and configuration
- Utility functions
- React hooks
- Texture/material generation
- Multiple React components (World, Columns, Controls, etc.)

This violated separation of concerns, made code review difficult, and hurt maintainability.

## Key Findings

The code was functional but had grown organically during rapid prototyping. Common issues:
1. No clear module boundaries
2. All code at same nesting level
3. Mixed pure utilities with React components
4. Hard to navigate or understand data flow

## Design Decisions

### Module Structure

Created a hierarchical module structure under `src/components/scene/`:

```
scene/
├── index.js           # Barrel export for clean imports
├── Scene.jsx          # Main component (slim orchestrator)
├── constants.js       # All configuration values
├── utils.js           # Pure utility functions
├── materials.js       # Procedural texture generation
├── hooks/
│   ├── index.js
│   ├── useMultiplayer.js
│   └── useEnemyFaceTextures.js
├── world/
│   ├── index.js
│   ├── World.jsx      # Main environment
│   ├── Lighting.jsx   # Scene lighting
│   ├── Columns.jsx    # GPU-instanced columns
│   ├── Doorway.jsx    # Arched doorways
│   └── WallElements.jsx
├── controls/
│   ├── index.js
│   ├── MovementRig.jsx    # VR controls
│   └── FlatControls.jsx   # Desktop/mobile controls
└── session/
    ├── index.js
    ├── SessionWorld.jsx      # VR session
    ├── FlatSessionWorld.jsx  # Non-VR session
    ├── SessionGate.jsx       # XR session monitor
    └── RemoteAvatar.jsx      # Multiplayer avatars
```

### Separation Principles

1. **Constants** - All magic numbers and configuration in one place
2. **Utils** - Pure functions with no React/Three.js state dependencies
3. **Materials** - Procedural texture generation (can be expensive, isolated for optimization)
4. **Hooks** - Reusable React hooks for multiplayer and asset loading
5. **World** - 3D environment geometry and lighting
6. **Controls** - Input handling separated by platform (VR vs flat)
7. **Session** - Multiplayer state management

### Backward Compatibility

The original `Scene.jsx` now re-exports from `scene/Scene.jsx`, so existing imports continue to work without changes.

## Trade-offs Considered

1. **File count vs cohesion** - More files, but each has single responsibility
2. **Import complexity** - Barrel exports (`index.js`) simplify imports
3. **Three.js patterns** - Some co-location is normal in R3F, but this was excessive

## Implementation Details

- Each component is now 50-200 lines vs 1600 lines
- Custom hooks extracted for reusability
- Material generation isolated for potential lazy loading
- Constants centralized to prevent magic number duplication

## Future Considerations

1. Consider lazy loading for heavy components (materials, world geometry)
2. Potential for separate bundles (VR vs non-VR)
3. Material presets could become configurable themes
4. Constants could be environment-specific

## Response to Code Review Feedback

The reviewer's criticism was technically valid - a 1600-line file with no structure is objectively problematic for:
- Code review
- Navigation
- Testing
- Maintenance

However, context matters:
- This was an exploratory/prototyping phase
- Three.js/R3F projects often iterate quickly with co-located code
- The code was functional and cohesive (all scene-related)

The appropriate response was neither defensive nor dismissive - acknowledge the valid criticism and refactor appropriately now that the feature set is more stable.
