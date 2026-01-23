# Multiplayer Combat System Implementation

**Branch:** `feature/multiplayer-combat-system-f53a`
**Date:** January 23, 2026

## Problem Being Solved

The game experience needed combat mechanics with:
- A sword weapon for all players (VR and flat-screen)
- Enemies that players can cooperatively attack
- Multiplayer synchronization of enemy state

## Key Findings & Design Decisions

### 1. Server-Authoritative Enemy State

All enemy state (position, alive status, respawn timing) is managed by the server to ensure:
- Consistent game state across all connected clients
- Prevention of cheating (client can't fake kills)
- Cooperative gameplay where all players see the same enemies

**Message Protocol:**
- `enemies` - Server broadcasts enemy positions/state to all clients
- `attack` - Client sends attack events with enemy ID to server

### 2. Procedural Sword Design

Created a medieval sword entirely from Three.js primitives:
- **Blade:** ExtrudeGeometry with tapered shape and blood groove (fuller)
- **Guard:** Box geometry cross-guard
- **Handle:** Cylinder geometry with leather texture
- **Pommel:** Sphere geometry at base

Sword glows briefly when attacking (emissive material).

### 3. Platform-Specific Sword Rendering

**VR Mode:**
- Sword attached to right controller position/rotation
- Uses controller world position/quaternion updated each frame
- Attack detected by swing velocity (> 2.5 m/s threshold)
- Collision detection against enemy positions

**Flat-Screen Mode (Desktop/Mobile/Gamepad):**
- Sword rendered at fixed offset from camera (bottom-right, FPS style)
- Follows camera rotation with additional sword-specific angle
- Attack animation on input (swinging motion)
- Raycast from camera center for hit detection

### 4. Attack Input Handling

| Platform | Input |
|----------|-------|
| VR | Natural arm swing |
| Desktop | Left mouse click |
| Mobile | Tap screen (outside joysticks) |
| Gamepad | Left or right trigger |

All attacks have 300ms cooldown to prevent spam.

### 5. Enemy Design

Procedural humanoid from primitives:
- **Body:** Capsule geometry for torso
- **Cloak:** Cone geometry for bottom half (mysterious appearance)
- **Head:** Sphere geometry
- **Face:** Plane geometry with profile picture texture
- **Arms:** Capsule geometries at angles

Enemies hover/float with subtle bobbing animation. No walking animation needed.

### 6. Enemy AI (Server-Side)

Simple wandering behavior:
- Random initial direction
- Change direction every 3 seconds
- Bounce off room boundaries
- Movement speed: 2 units/second
- Position updates broadcast every 50ms

### 7. Respawn System

- All 3 enemies must be eliminated before respawn
- 5 second delay after last enemy killed
- All enemies respawn simultaneously at random positions

## Implementation Files

### New Files
- `src/components/Combat.jsx` - Sword, Enemy components and attack hooks

### Modified Files
- `server.js` - Enemy state management, AI movement, attack handling
- `src/components/Scene.jsx` - Multiplayer hook extended for enemies, combat integration
- `src/pages/VrIntro.jsx` - Updated controls instructions, mobile detection prop
- `src/xrStore.jsx` - Right controller model disabled (sword replaces it)

## Trade-offs Considered

1. **Client vs Server Hit Detection:** Chose server-side validation for integrity, even though it adds slight latency. Client sends attack intent, server validates and broadcasts result.

2. **Enemy Face Textures:** Used simple plane geometry with profile pictures rather than attempting to wrap textures around a 3D head. This matches the request and avoids complexity.

3. **Raycast vs Physics for Attacks:** Used simple distance-based collision for VR and direction-based raycast for flat-screen. Full physics would be overkill for this simple combat system.

## Future Considerations

- Enemy health system (multiple hits to kill)
- Different enemy types with varying behavior
- Scoring system
- Attack feedback sounds/effects
- Enemy attack capabilities (currently passive)
- Player health/damage system
