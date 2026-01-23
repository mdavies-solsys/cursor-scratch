# Feature: Enemy Despawn Investigation and Range Constraints

**Branch:** `feature/enemy-despawn-and-range-20d5`
**Date:** 2026-01-23

## Problem

Players were having difficulty finding enemies in the game. The investigation had two parts:
1. Determine if enemies were unexpectedly disappearing (despawning)
2. Keep enemies within a manageable vicinity of the player spawn point

## Investigation: Enemy Disappearance

### Findings
After reviewing `server.js`, no hidden despawn logic was found. Enemies only become `alive: false` when:
1. A player successfully attacks them via `handleAttack()`
2. All enemies die → they respawn after 5 seconds via `checkRespawn()`

### Root Cause
The real issue was that enemies could spawn anywhere across the massive game map (1100 x 2750 units), while players spawn at (0, 0, 0). Even with the previous enemy pursuit behavior:
- Initial spawn could be 1000+ units away from the player
- When no players are connected, enemies wander randomly and drift far away
- The huge distances made enemies appear to "disappear" when they were simply very far away

## Solution: Spawn Area Constraints and Leash System

### New Configuration Constants
```javascript
const ENEMY_SPAWN_RADIUS = 150;    // Enemies spawn within this radius of center
const ENEMY_MAX_RANGE = 250;       // Enemies won't wander further than this
const ENEMY_LEASH_RANGE = 300;     // Force return if beyond this distance
const SPAWN_AREA_CENTER_X = 0;     // Player spawn point X
const SPAWN_AREA_CENTER_Z = 0;     // Player spawn point Z
```

### Key Changes

1. **Constrained Spawn Area**
   - Enemies now spawn in a circle 75-150 units from the player spawn point
   - Previously could spawn anywhere in the ~1100x2750 unit map
   - Ensures enemies are immediately visible and combat-ready

2. **Leash System**
   - If an enemy somehow gets beyond `ENEMY_LEASH_RANGE` (300 units), it automatically returns to the spawn area
   - Acts as a safety net for edge cases

3. **Patrol Range Enforcement**
   - When pursuing players, enemies check if the next position would exceed `ENEMY_MAX_RANGE` (250 units)
   - If player moves outside patrol area, enemy stops at the boundary instead of following indefinitely
   - During random wandering (no players), enemies reverse direction when hitting the boundary

4. **Spawn Position Tracking**
   - Each enemy now stores its `spawnX` and `spawnZ` for potential future use
   - Helper function `getDistanceFromSpawnArea()` calculates distance from spawn center

### Behavior Summary

| Scenario | Enemy Behavior |
|----------|----------------|
| Player in patrol area | Chase and stop at 12 units |
| Player outside patrol area | Chase until reaching max range (250 units), then wait |
| No players connected | Wander randomly within max range |
| Enemy beyond leash range | Return to spawn area at full speed |

## Design Decisions

- **150-unit spawn radius**: Balances visibility with giving enemies some spread around the spawn
- **250-unit max range**: Large enough for interesting chase gameplay, small enough to keep enemies findable
- **300-unit leash range**: Slightly larger than max range to avoid constant boundary jitter

## Testing Notes

- On server start, logs show enemy spawn positions and distances from center
- All enemies should spawn 75-150 units from (0, 0, 0)
- Enemies should be visible shortly after spawning into the game
- Walking beyond 250 units from spawn should cause enemies to stop following

## Future Considerations

- Consider visual indicator when enemies hit their range limit (retreat animation, glow, etc.)
- Could add multiple spawn areas for larger maps
- Might want to adjust ranges based on player count
