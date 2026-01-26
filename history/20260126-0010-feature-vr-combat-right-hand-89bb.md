# VR Combat Right Hand Controller Fix

**Branch:** `feature/vr-combat-right-hand-89bb`
**Date:** 2026-01-26

## Problem

When entering the game in VR mode:
1. The sword was not visible in the right hand
2. The right controller was not visible at all (unlike the left controller which displayed correctly)

These issues were linked - both stemmed from the same root cause.

## Investigation

Traced through the code:

1. **`xrStore.jsx`** - XR store configuration
   - Left controller: `<XRControllerModel />` (renders the controller model)
   - Right controller: `() => null` (intended to hide controller to show sword instead)

2. **`Combat.jsx` - VRSword component**
   - Uses `useXR((state) => state.inputSourceStates)` to get controller states
   - Finds right controller by filtering for `handedness === "right"`
   - Tries to get position from `rightController.object`
   - Early returns if `controllerObj` is null/undefined

3. **Root cause identified**
   - When `RightControllerModel` returns `null`, the @react-three/xr library doesn't create a proper Three.js object reference for that controller
   - The `object` property in `inputSourceState` ends up being null
   - `VRSword` component bails out early because it can't track controller position
   - No sword renders, and no right controller visual exists

## Solution

Changed the right controller model from returning `null` to returning an empty `<group />`:

```jsx
// Before
const RightControllerModel = () => null;

// After
const RightControllerModel = () => <group />;
```

This ensures:
- A valid Three.js Group object is created for the right controller
- The `object` property in `inputSourceState` references this group
- `VRSword` can successfully track controller position via `getWorldPosition()` and `getWorldQuaternion()`
- The sword renders attached to the right hand controller position
- The empty group is invisible, so only the sword shows (as intended)

## Files Changed

- `src/xrStore.jsx` - Fixed right controller model component

## Testing Notes

- Build passes successfully
- VR mode should now show sword in right hand
- Sword should track right controller position/rotation
- Swing detection for attacks should work as expected
