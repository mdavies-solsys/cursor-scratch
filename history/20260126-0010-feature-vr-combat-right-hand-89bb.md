# VR Combat Right Hand Controller Fix

**Branch:** `feature/vr-right-hand-missing-71d0`
**Date:** 2026-01-26

## Problem

When entering the game in VR mode:
1. The sword was not visible in the right hand
2. The right controller was not visible at all (unlike the left controller which displayed correctly)
3. VR attacks could not be performed

## Investigation

### Previous Attempt (Branch 89bb)

The first attempt changed `RightControllerModel` from returning `null` to `<group />`, hoping that the `inputSourceState.object` property would become available to the `VRSword` component. This fix was insufficient.

### Root Cause Analysis

The actual issue is more fundamental:

1. **`VRSword` component** in `Combat.jsx` was rendering as a standalone component in `SessionWorld`
2. It accessed controller state via `useXR((state) => state.inputSourceStates)`
3. It used `useMemo` to find the right controller and cached the result
4. In `useFrame`, it checked `rightController.object` for the Three.js object

**Problems identified:**
- The `inputSourceState.object` property in @react-three/xr v6 doesn't reliably reference the custom model component's rendered group
- Even with `<group />` instead of `null`, the object reference wasn't being properly set or was stale
- The `useMemo` cache prevented updates when the object became available later
- The external `VRSword` component couldn't reliably track controller position

## Solution

Complete architectural refactor: **render the sword directly inside the controller model component**.

### Approach

1. **Inline the sword in `RightControllerModel`**: Instead of rendering `VRSword` separately and trying to track controller position externally, the sword is now rendered as a direct child of the controller's grip space

2. **Module-level shared state**: Since the controller models are rendered by @react-three/xr outside our component tree (not as children of SessionWorld), React context doesn't work. Instead, we use a module-level state object:
   ```jsx
   const vrCombatState = {
     onAttack: null,
     enemies: [],
   };
   ```

3. **Sync hook for SessionWorld**: A `useVRCombatSync` hook allows SessionWorld to update the combat state when it mounts

### Key Benefits

- The sword automatically inherits the controller's transform (position, rotation)
- No need to track controller position externally - just use `groupRef.current.getWorldPosition()`
- Combat callbacks are available via module-level state, bypassing React's component tree limitations
- Swing detection and enemy hit checking work correctly

## Files Changed

- `src/xrStore.jsx` - Major refactor:
  - Added `RightControllerWithSword` component that renders the sword and handles swing detection
  - Added `ControllerSword` component (inline sword geometry)
  - Added module-level `vrCombatState` for combat callbacks
  - Added `setVRCombatState()` function and `useVRCombatSync()` hook
  
- `src/components/scene/session/SessionWorld.jsx`:
  - Removed `VRSword` import (sword now rendered in controller model)
  - Added `useVRCombatSync` hook to sync combat state
  - Removed `VRCombatProvider` wrapper (replaced with hook)

## Technical Details

### Controller Model Rendering in @react-three/xr

When using `createXRStore({ controller: { right: RightControllerModel } })`:
- @react-three/xr renders the model component inside the controller's grip space
- The model is a React component but rendered at a different point in the tree than our scene components
- This is why React context from SessionWorld doesn't reach the controller model

### Sword Position Tracking

```jsx
useFrame(() => {
  if (!groupRef.current) return;
  groupRef.current.getWorldPosition(worldPosRef.current);
  groupRef.current.getWorldQuaternion(worldQuatRef.current);
  // ... velocity calculation and swing detection
});
```

The `groupRef` is attached to a group inside the controller model, so `getWorldPosition()` returns the actual world position of the controller.

## Testing Notes

- Build passes successfully
- VR mode should show the sword attached to the right controller
- Sword should move and rotate with the right controller
- Swinging the controller fast enough should trigger attacks
- Attacks should hit enemies when sword tip is close enough
