# Feature: Enemy Movement Toward Players

**Branch:** `feature/enemy-movement-to-player-f6e0`
**Date:** 2026-01-23

## Problem

The game map is very large (5x scale: 1100x2750 units), making it difficult for players to find the enemies. With only 3 enemies spawning at random positions across this vast space, gameplay became frustrating as players spent most of their time searching rather than engaging in combat.

## Solution

Implemented server-side enemy AI that actively tracks and pursues the closest player:

### Key Changes (server.js)

1. **New `findClosestPlayer()` function**
   - Iterates through all connected players
   - Calculates distance from enemy to each player using Euclidean distance
   - Returns closest player within detection range with direction vector

2. **Updated `updateEnemyPosition()` behavior**
   - **Pursuit mode**: When players are present, enemies calculate direction toward closest player and move toward them
   - **Stop distance**: Enemies halt at 12 units from target (ready to be attacked, not running through players)
   - **Fallback behavior**: Random wandering at half speed when no players connected

3. **Configuration constants**
   - `ENEMY_SPEED`: 4 units/second (increased from 2 for more aggressive pursuit)
   - `ENEMY_STOP_DISTANCE`: 12 units (combat engagement range)
   - `ENEMY_DETECTION_RANGE`: 1000 units (covers entire map)

### Design Decisions

- **Server-side AI**: All enemy movement logic runs on server to ensure consistent behavior for all clients and prevent cheating
- **Stop distance**: 12 units chosen as balance between being close enough to engage but far enough that enemy doesn't overlap with player model
- **Aggressive speed**: 4 units/second ensures enemies can catch up to players who move at 8 units/second max, creating tension
- **Single target per enemy**: Each enemy tracks its own closest player, which naturally distributes enemies when multiple players are present

## Testing Notes

- Enemies should visibly move toward player when game starts
- Multiple players cause enemies to potentially split between targets
- Enemy stops ~12 units away and holds position
- When player moves away, enemy resumes pursuit
- Empty server: enemies wander randomly

## Future Considerations

- Add obstacle avoidance around columns
- Consider different enemy types with varying speeds/behaviors
- Add visual indicator showing enemy is targeting player (eyes following, etc.)
