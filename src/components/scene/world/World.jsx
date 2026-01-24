/**
 * World Component
 * Main 3D environment with hall geometry, columns, and decorations
 */
import React, { useMemo } from "react";
import * as THREE from "three";
import {
  SCALE,
  HALL_WIDTH,
  HALL_LENGTH,
  HALL_HEIGHT,
  HALL_HALF_WIDTH,
  HALL_HALF_LENGTH,
  WALL_THICKNESS,
  FLOOR_THICKNESS,
  CEILING_THICKNESS,
  FLOOR_REPEAT_X,
  FLOOR_REPEAT_Z,
  WALL_REPEAT_H,
  WALL_REPEAT_V,
} from "../constants.js";
import { createTexturedMaterial } from "../materials.js";
import SceneLighting from "./Lighting.jsx";
import InstancedColumns from "./Columns.jsx";
import Doorway from "./Doorway.jsx";
import { WallCracks, WallRibs, WallBands } from "./WallElements.jsx";

/**
 * Create all materials for the world
 */
const useWorldMaterials = () => {
  return useMemo(() => {
    // Wall material - weathered ruins aesthetic with more imperfections
    const stone = createTexturedMaterial({
      baseColor: "#5a6058",
      accentColor: "#4a5048",
      repeat: [WALL_REPEAT_H, WALL_REPEAT_V],
      roughness: 0.85,
      metalness: 0.05,
      bumpScale: 0.4,
      noiseStrength: 45,
      veinCount: 35,
      grainBase: 140,
      grainVariance: 90,
      textureSize: 512,
    });
    
    // Floor material - dirt/earth floor with no reflection
    const stoneDark = createTexturedMaterial({
      baseColor: "#3d3830",
      accentColor: "#2e2a24",
      repeat: [FLOOR_REPEAT_X, FLOOR_REPEAT_Z],
      roughness: 1.0,
      metalness: 0.0,
      bumpScale: 0.6,
      noiseStrength: 60,
      veinCount: 25,
      grainBase: 110,
      grainVariance: 120,
      textureSize: 512,
      useRoughnessMap: false,
    });
    
    // Trim material - aged architectural detail
    const stoneTrim = createTexturedMaterial({
      baseColor: "#686e68",
      accentColor: "#505850",
      repeat: [12, 12],
      roughness: 0.78,
      metalness: 0.08,
      bumpScale: 0.35,
      noiseStrength: 35,
      veinCount: 25,
      grainBase: 130,
      grainVariance: 75,
      textureSize: 512,
    });
    
    // Metal material - corroded, ancient
    const metal = createTexturedMaterial({
      baseColor: "#5a6858",
      accentColor: "#4a5848",
      repeat: [4, 4],
      roughness: 0.6,
      metalness: 0.55,
      bumpScale: 0.3,
      noiseStrength: 40,
      veinCount: 20,
      grainBase: 100,
      grainVariance: 100,
      textureSize: 512,
    });
    
    // Dark void material for cracks
    const voidMaterial = new THREE.MeshBasicMaterial({ color: "#0a0a08" });
    
    return { stone, stoneDark, stoneTrim, metal, voidMaterial };
  }, []);
};

/**
 * Generate column positions for the hall
 */
const useColumnPositions = () => {
  return useMemo(() => {
    const columnSpacingX = SCALE(42);
    const columnSpacingZ = SCALE(38);
    
    const numColumnsX = Math.floor((HALL_WIDTH - SCALE(16)) / columnSpacingX);
    const numColumnsZ = Math.floor((HALL_LENGTH - SCALE(20)) / columnSpacingZ);
    
    const positions = [];
    
    for (let xi = 0; xi < numColumnsX; xi++) {
      const xOffset = (numColumnsX - 1) * columnSpacingX / 2;
      const x = xi * columnSpacingX - xOffset;
      
      // Skip columns too close to center walkway
      if (Math.abs(x) < SCALE(8)) continue;
      
      for (let zi = 0; zi < numColumnsZ; zi++) {
        const zOffset = (numColumnsZ - 1) * columnSpacingZ / 2;
        const z = zi * columnSpacingZ - zOffset;
        positions.push([x, 0, z]);
      }
    }
    
    return positions;
  }, []);
};

/**
 * Generate rib positions along the walls
 */
const useRibPositions = () => {
  return useMemo(() => {
    const spacing = SCALE(32);
    const count = Math.floor(HALL_LENGTH / spacing);
    const positions = [];
    for (let i = 0; i <= count; i++) {
      positions.push(i * spacing - HALL_LENGTH / 2 + spacing / 2);
    }
    return positions;
  }, []);
};

/**
 * Generate beam positions for ceiling
 */
const useBeamPositions = () => {
  return useMemo(() => {
    // Transverse beams
    const spacing = SCALE(40);
    const count = Math.floor(HALL_LENGTH / spacing);
    const transverse = [];
    for (let i = 0; i <= count; i++) {
      transverse.push(i * spacing - HALL_LENGTH / 2 + spacing / 2);
    }
    
    // Longitudinal beams
    const beamSpacing = SCALE(25);
    const numBeams = Math.floor((HALL_WIDTH - SCALE(20)) / beamSpacing);
    const longitudinal = [];
    for (let i = 0; i <= numBeams; i++) {
      longitudinal.push(i * beamSpacing - (numBeams * beamSpacing) / 2);
    }
    
    return { transverse, longitudinal };
  }, []);
};

/**
 * World - Main 3D environment component
 */
const World = () => {
  const materials = useWorldMaterials();
  const columnPositions = useColumnPositions();
  const ribZPositions = useRibPositions();
  const { transverse: beamZPositions, longitudinal: longBeamXPositions } = useBeamPositions();

  return (
    <>
      <SceneLighting />
      
      <group>
        {/* Floor */}
        <mesh position={[0, -FLOOR_THICKNESS / 2, 0]} receiveShadow material={materials.stoneDark}>
          <boxGeometry args={[HALL_WIDTH + SCALE(6), FLOOR_THICKNESS, HALL_LENGTH + SCALE(6)]} />
        </mesh>
        
        {/* Ceiling */}
        <mesh
          position={[0, HALL_HEIGHT + CEILING_THICKNESS / 2, 0]}
          receiveShadow
          material={materials.stone}
        >
          <boxGeometry args={[HALL_WIDTH + SCALE(6), CEILING_THICKNESS, HALL_LENGTH + SCALE(6)]} />
        </mesh>
        
        {/* Left Wall */}
        <mesh
          position={[-HALL_HALF_WIDTH - WALL_THICKNESS / 2, HALL_HEIGHT / 2, 0]}
          receiveShadow
          material={materials.stone}
        >
          <boxGeometry args={[WALL_THICKNESS, HALL_HEIGHT, HALL_LENGTH]} />
        </mesh>
        
        {/* Right Wall */}
        <mesh
          position={[HALL_HALF_WIDTH + WALL_THICKNESS / 2, HALL_HEIGHT / 2, 0]}
          receiveShadow
          material={materials.stone}
        >
          <boxGeometry args={[WALL_THICKNESS, HALL_HEIGHT, HALL_LENGTH]} />
        </mesh>
        
        {/* Front Doorway */}
        <Doorway
          z={-HALL_HALF_LENGTH - WALL_THICKNESS / 2}
          rotation={0}
          stoneMaterial={materials.stone}
          trimMaterial={materials.stoneTrim}
          metalMaterial={materials.metal}
        />
        
        {/* Back Doorway */}
        <Doorway
          z={HALL_HALF_LENGTH + WALL_THICKNESS / 2}
          rotation={Math.PI}
          stoneMaterial={materials.stone}
          trimMaterial={materials.stoneTrim}
          metalMaterial={materials.metal}
        />
        
        {/* GPU Instanced columns */}
        <InstancedColumns
          positions={columnPositions}
          stoneMaterial={materials.stone}
          trimMaterial={materials.stoneTrim}
        />
        
        {/* Wall decorations */}
        <WallRibs side={-1} material={materials.stoneTrim} ribZPositions={ribZPositions} />
        <WallRibs side={1} material={materials.stoneTrim} ribZPositions={ribZPositions} />
        <WallBands side={-1} material={materials.stoneTrim} />
        <WallBands side={1} material={materials.stoneTrim} />
        
        {/* Ruins imperfections - wall damage */}
        <WallCracks side={-1} material={materials.voidMaterial} />
        <WallCracks side={1} material={materials.voidMaterial} />
        
        {/* Transverse ceiling beams */}
        {beamZPositions.map((z) => (
          <mesh
            key={`beam-${z}`}
            position={[0, HALL_HEIGHT - SCALE(0.6), z]}
            castShadow
            receiveShadow
            material={materials.stoneTrim}
          >
            <boxGeometry args={[HALL_WIDTH - SCALE(2), SCALE(0.5), SCALE(1.6)]} />
          </mesh>
        ))}
        
        {/* Longitudinal ceiling beams */}
        {longBeamXPositions.map((x) => (
          <mesh
            key={`long-beam-${x}`}
            position={[x, HALL_HEIGHT - SCALE(0.9), 0]}
            castShadow
            receiveShadow
            material={materials.stoneTrim}
          >
            <boxGeometry args={[SCALE(1.2), SCALE(0.6), HALL_LENGTH - SCALE(40)]} />
          </mesh>
        ))}
      </group>
    </>
  );
};

export default World;
