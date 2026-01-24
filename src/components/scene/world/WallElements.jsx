/**
 * Wall Decorative Elements
 * Cracks, ribs, and bands for the ruins aesthetic
 */
import React, { useMemo } from "react";
import {
  SCALE,
  HALL_LENGTH,
  HALL_HEIGHT,
  HALL_HALF_WIDTH,
} from "../constants.js";
import { seededRandom } from "../utils.js";

/**
 * WallCracks - Procedural crack damage on walls
 */
export const WallCracks = ({ side, material }) => {
  const crackPositions = useMemo(() => {
    const positions = [];
    const crackCount = 12;
    for (let i = 0; i < crackCount; i++) {
      const seed = (side + 2) * 1000 + i * 137;
      const z = (seededRandom(seed) - 0.5) * (HALL_LENGTH - SCALE(40));
      const y = SCALE(2) + seededRandom(seed + 1) * (HALL_HEIGHT - SCALE(8));
      const width = SCALE(0.3 + seededRandom(seed + 2) * 0.4);
      const height = SCALE(1 + seededRandom(seed + 3) * 3);
      const depth = SCALE(0.2 + seededRandom(seed + 4) * 0.3);
      positions.push({ z, y, width, height, depth });
    }
    return positions;
  }, [side]);

  const x = side * (HALL_HALF_WIDTH - SCALE(0.3));

  return (
    <group>
      {crackPositions.map((crack, i) => (
        <mesh
          key={`crack-${side}-${i}`}
          position={[x, crack.y, crack.z]}
          material={material}
        >
          <boxGeometry args={[crack.depth, crack.height, crack.width]} />
        </mesh>
      ))}
    </group>
  );
};

/**
 * WallRibs - Vertical architectural ribs along walls
 */
export const WallRibs = ({ side, material, ribZPositions }) => {
  const x = side * (HALL_HALF_WIDTH - SCALE(0.45));
  
  return (
    <group>
      {ribZPositions.map((z) => (
        <group key={`rib-${side}-${z}`} position={[x, 0, z]}>
          <mesh position={[0, SCALE(3.2), 0]} castShadow receiveShadow material={material}>
            <boxGeometry args={[SCALE(0.9), SCALE(6.4), SCALE(1.8)]} />
          </mesh>
          <mesh position={[0, SCALE(6.6), 0]} castShadow receiveShadow material={material}>
            <boxGeometry args={[SCALE(1.2), SCALE(0.6), SCALE(2.2)]} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

/**
 * WallBands - Horizontal decorative bands
 */
export const WallBands = ({ side, material }) => {
  const x = side * (HALL_HALF_WIDTH - SCALE(0.6));
  
  return (
    <group>
      <mesh position={[x, SCALE(1.1), 0]} castShadow receiveShadow material={material}>
        <boxGeometry args={[SCALE(1), SCALE(1.2), HALL_LENGTH - SCALE(20)]} />
      </mesh>
      <mesh position={[x, SCALE(7.4), 0]} castShadow receiveShadow material={material}>
        <boxGeometry args={[SCALE(1), SCALE(0.6), HALL_LENGTH - SCALE(20)]} />
      </mesh>
      <mesh position={[x, SCALE(10.2), 0]} castShadow receiveShadow material={material}>
        <boxGeometry args={[SCALE(0.8), SCALE(0.5), HALL_LENGTH - SCALE(40)]} />
      </mesh>
    </group>
  );
};
