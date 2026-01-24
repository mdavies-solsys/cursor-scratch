/**
 * Doorway Component
 * Arched doorways with decorative frames and door panels
 */
import React, { useMemo } from "react";
import * as THREE from "three";
import {
  SCALE,
  HALL_WIDTH,
  HALL_HEIGHT,
  WALL_THICKNESS,
  DOOR_WIDTH,
  DOOR_HEIGHT,
  ARCH_RADIUS,
  TOTAL_DOOR_HEIGHT,
} from "../constants.js";

/**
 * Create arch infill geometry (fills corners above the arch in rectangular wall opening)
 */
const createArchInfillGeometry = (radius, depth, segments = 32) => {
  const shape = new THREE.Shape();
  shape.moveTo(-radius, 0);
  shape.lineTo(-radius, radius);
  shape.lineTo(radius, radius);
  shape.lineTo(radius, 0);
  shape.absarc(0, 0, radius, 0, Math.PI, false);
  shape.lineTo(-radius, 0);
  
  const extrudeSettings = {
    depth: depth,
    bevelEnabled: false,
    steps: 1,
  };
  
  return new THREE.ExtrudeGeometry(shape, extrudeSettings);
};

/**
 * Create arched door panel geometry
 */
const createArchedPanelGeometry = (width, height, archRadius, depth, segments = 16) => {
  const shape = new THREE.Shape();
  const halfWidth = width / 2;
  
  shape.moveTo(-halfWidth, 0);
  shape.lineTo(-halfWidth, height);
  shape.absarc(0, height, halfWidth, Math.PI, 0, true);
  shape.lineTo(halfWidth, 0);
  shape.lineTo(-halfWidth, 0);
  
  const extrudeSettings = {
    depth: depth,
    bevelEnabled: false,
    steps: 1,
  };
  
  return new THREE.ExtrudeGeometry(shape, extrudeSettings);
};

/**
 * Doorway - Arched doorway with stone frame and metal doors
 */
const Doorway = ({ z, rotation, stoneMaterial, trimMaterial, metalMaterial }) => {
  const sideWidth = (HALL_WIDTH - DOOR_WIDTH) / 2;
  const lintelHeight = HALL_HEIGHT - TOTAL_DOOR_HEIGHT;
  const frameWidth = SCALE(0.8);
  const frameDepth = WALL_THICKNESS + SCALE(0.4);
  const doorPanelWidth = DOOR_WIDTH / 2 - SCALE(1);
  const doorPanelHeight = DOOR_HEIGHT - SCALE(0.4);
  const doorPanelDepth = SCALE(0.4);
  const swing = Math.PI * 0.6;
  const voidDepth = SCALE(22);
  
  // Memoized geometries
  const archInfillGeometry = useMemo(
    () => createArchInfillGeometry(ARCH_RADIUS, WALL_THICKNESS, 32),
    []
  );
  
  const archFrameGeometry = useMemo(
    () => createArchInfillGeometry(ARCH_RADIUS + frameWidth, frameDepth, 32),
    []
  );
  
  const archedPanelGeometry = useMemo(
    () => createArchedPanelGeometry(doorPanelWidth, doorPanelHeight, doorPanelWidth / 2, doorPanelDepth, 16),
    [doorPanelWidth, doorPanelHeight, doorPanelDepth]
  );
  
  // Arch void geometry for the black passageway
  const archVoidGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    const halfWidth = (DOOR_WIDTH - SCALE(1)) / 2;
    const rectHeight = DOOR_HEIGHT;
    
    shape.moveTo(-halfWidth, 0);
    shape.lineTo(-halfWidth, rectHeight);
    shape.absarc(0, rectHeight, halfWidth, Math.PI, 0, true);
    shape.lineTo(halfWidth, 0);
    shape.lineTo(-halfWidth, 0);
    
    const extrudeSettings = {
      depth: voidDepth,
      bevelEnabled: false,
      steps: 1,
    };
    
    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
  }, [voidDepth]);

  return (
    <group position={[0, 0, z]} rotation={[0, rotation, 0]}>
      {/* Side walls */}
      <mesh position={[-(DOOR_WIDTH / 2 + sideWidth / 2), HALL_HEIGHT / 2, 0]} material={stoneMaterial} receiveShadow>
        <boxGeometry args={[sideWidth, HALL_HEIGHT, WALL_THICKNESS]} />
      </mesh>
      <mesh position={[DOOR_WIDTH / 2 + sideWidth / 2, HALL_HEIGHT / 2, 0]} material={stoneMaterial} receiveShadow>
        <boxGeometry args={[sideWidth, HALL_HEIGHT, WALL_THICKNESS]} />
      </mesh>
      
      {/* Lintel above the arch */}
      <mesh position={[0, TOTAL_DOOR_HEIGHT + lintelHeight / 2, 0]} material={stoneMaterial} receiveShadow>
        <boxGeometry args={[DOOR_WIDTH, lintelHeight, WALL_THICKNESS]} />
      </mesh>
      
      {/* Arch infill - the stone that fills the corners above the arch */}
      <mesh
        position={[0, DOOR_HEIGHT, -WALL_THICKNESS / 2]}
        material={stoneMaterial}
        geometry={archInfillGeometry}
        receiveShadow
      />
      
      {/* Side frames (trim) - up to arch spring point */}
      <mesh
        position={[-DOOR_WIDTH / 2 + frameWidth / 2, DOOR_HEIGHT / 2, SCALE(0.2)]}
        material={trimMaterial}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[frameWidth, DOOR_HEIGHT, frameDepth]} />
      </mesh>
      <mesh
        position={[DOOR_WIDTH / 2 - frameWidth / 2, DOOR_HEIGHT / 2, SCALE(0.2)]}
        material={trimMaterial}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[frameWidth, DOOR_HEIGHT, frameDepth]} />
      </mesh>
      
      {/* Arch frame trim - outer arch */}
      <mesh
        position={[0, DOOR_HEIGHT, SCALE(0.2) - frameDepth / 2]}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow
        receiveShadow
      >
        <torusGeometry args={[ARCH_RADIUS + frameWidth / 2, frameWidth / 2, 8, 32, Math.PI]} />
        <meshStandardMaterial color={trimMaterial.color} roughness={0.68} metalness={0.12} />
      </mesh>
      
      {/* Keystone at top of arch */}
      <mesh
        position={[0, DOOR_HEIGHT + ARCH_RADIUS + SCALE(0.3), SCALE(0.3)]}
        material={trimMaterial}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[SCALE(1.5), SCALE(1.2), frameDepth]} />
      </mesh>
      
      {/* Left door panel with arched top */}
      <group position={[-DOOR_WIDTH / 2 + frameWidth, 0, SCALE(0.4)]} rotation={[0, swing, 0]}>
        <mesh
          position={[doorPanelWidth / 2, 0, -doorPanelDepth / 2]}
          material={metalMaterial}
          geometry={archedPanelGeometry}
          castShadow
          receiveShadow
        />
      </group>
      
      {/* Right door panel with arched top */}
      <group position={[DOOR_WIDTH / 2 - frameWidth, 0, SCALE(0.4)]} rotation={[0, -swing, 0]}>
        <mesh
          position={[-doorPanelWidth / 2, 0, -doorPanelDepth / 2]}
          rotation={[0, Math.PI, 0]}
          material={metalMaterial}
          geometry={archedPanelGeometry}
          castShadow
          receiveShadow
        />
      </group>
      
      {/* Black void behind door - arched shape */}
      <mesh
        position={[0, 0, -WALL_THICKNESS / 2 - voidDepth]}
        geometry={archVoidGeometry}
        castShadow={false}
      >
        <meshBasicMaterial color="#000000" side={THREE.BackSide} />
      </mesh>
      
      {/* Threshold at bottom */}
      <mesh position={[0, SCALE(0.1), SCALE(1.8)]} material={trimMaterial} receiveShadow>
        <boxGeometry args={[DOOR_WIDTH + SCALE(2), SCALE(0.2), SCALE(3)]} />
      </mesh>
    </group>
  );
};

export default Doorway;
