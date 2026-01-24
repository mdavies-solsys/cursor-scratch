/**
 * Scene Lighting Configuration
 * All lighting components for the ruins environment
 */
import React, { useMemo } from "react";
import {
  SCALE,
  HALL_HEIGHT,
  HALL_HALF_WIDTH,
  HALL_HALF_LENGTH,
  RENDER_DISTANCE,
} from "../constants.js";

const ceilingLightY = HALL_HEIGHT - SCALE(4);
const wallLightY = SCALE(6);

/**
 * Fixed ceiling light positions - 4x2 grid covering key areas
 */
const CEILING_LIGHT_POSITIONS = [
  // Front section
  { x: -SCALE(80), z: -SCALE(180) },
  { x: SCALE(80), z: -SCALE(180) },
  // Center-front
  { x: -SCALE(80), z: -SCALE(60) },
  { x: SCALE(80), z: -SCALE(60) },
  // Center-back
  { x: -SCALE(80), z: SCALE(60) },
  { x: SCALE(80), z: SCALE(60) },
  // Back section
  { x: -SCALE(80), z: SCALE(180) },
  { x: SCALE(80), z: SCALE(180) },
];

/**
 * Fixed wall sconce positions - 4 per side at key intervals
 */
const WALL_SCONCE_POSITIONS = [
  // Left wall
  { x: -HALL_HALF_WIDTH + SCALE(2), z: -SCALE(200) },
  { x: -HALL_HALF_WIDTH + SCALE(2), z: -SCALE(65) },
  { x: -HALL_HALF_WIDTH + SCALE(2), z: SCALE(65) },
  { x: -HALL_HALF_WIDTH + SCALE(2), z: SCALE(200) },
  // Right wall
  { x: HALL_HALF_WIDTH - SCALE(2), z: -SCALE(200) },
  { x: HALL_HALF_WIDTH - SCALE(2), z: -SCALE(65) },
  { x: HALL_HALF_WIDTH - SCALE(2), z: SCALE(65) },
  { x: HALL_HALF_WIDTH - SCALE(2), z: SCALE(200) },
];

/**
 * SceneLighting - All lighting for the ruins environment
 * Fixed 16-light configuration for performance
 */
const SceneLighting = () => {
  return (
    <>
      {/* Atmospheric fog - near 300, far 1500 for depth and mystery */}
      <fog attach="fog" args={["#1a1a18", 300, 1500]} />
      
      {/* Ambient light - green-white tint */}
      <ambientLight intensity={1.8} color="#e8f0e0" />
      
      {/* Hemisphere light for better fill - green-white tint */}
      <hemisphereLight color="#f0f8e8" groundColor="#404838" intensity={1.2} />
      
      {/* Main directional light with green-white tint for ancient ruins feel */}
      <directionalLight
        position={[0, HALL_HEIGHT - SCALE(2), 0]}
        intensity={2.0}
        color="#e8f0d8"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={1}
        shadow-camera-far={RENDER_DISTANCE}
        shadow-camera-left={-HALL_HALF_WIDTH}
        shadow-camera-right={HALL_HALF_WIDTH}
        shadow-camera-top={HALL_HALF_LENGTH}
        shadow-camera-bottom={-HALL_HALF_LENGTH}
        shadow-bias={-0.0001}
      />
      
      {/* Secondary fill light with green-white tint */}
      <directionalLight
        position={[-SCALE(10), SCALE(12), SCALE(20)]}
        intensity={0.6}
        color="#dde8cc"
      />
      
      {/* Fixed 8 ceiling point lights - green-white tint */}
      {CEILING_LIGHT_POSITIONS.map((pos, i) => (
        <pointLight
          key={`ceiling-light-${i}`}
          position={[pos.x, ceilingLightY, pos.z]}
          intensity={2400}
          distance={SCALE(200)}
          decay={2}
          color="#e0f0d0"
        />
      ))}
      
      {/* Fixed 8 wall sconce lights - green-white tint */}
      {WALL_SCONCE_POSITIONS.map((pos, i) => (
        <pointLight
          key={`wall-sconce-${i}`}
          position={[pos.x, wallLightY, pos.z]}
          intensity={800}
          distance={SCALE(100)}
          decay={2}
          color="#d8e8c8"
        />
      ))}
      
      {/* Emissive ceiling light fixtures - green-white tint */}
      {CEILING_LIGHT_POSITIONS.map((pos, i) => (
        <mesh key={`light-fixture-${i}`} position={[pos.x, ceilingLightY + SCALE(0.5), pos.z]}>
          <boxGeometry args={[SCALE(4), SCALE(0.3), SCALE(4)]} />
          <meshStandardMaterial
            color="#e8f8e0"
            emissive="#d0e8c0"
            emissiveIntensity={3}
            toneMapped={false}
          />
        </mesh>
      ))}
      
      {/* Emissive wall sconce fixtures - green-white tint */}
      {WALL_SCONCE_POSITIONS.map((pos, i) => (
        <mesh key={`sconce-fixture-${i}`} position={[pos.x < 0 ? pos.x + SCALE(1) : pos.x - SCALE(1), wallLightY, pos.z]}>
          <boxGeometry args={[SCALE(0.4), SCALE(1.5), SCALE(1)]} />
          <meshStandardMaterial
            color="#e0f0d8"
            emissive="#c8e0b8"
            emissiveIntensity={2.5}
            toneMapped={false}
          />
        </mesh>
      ))}
    </>
  );
};

export default SceneLighting;
