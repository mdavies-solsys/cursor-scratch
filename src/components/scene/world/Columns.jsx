/**
 * Instanced Columns Component
 * GPU-instanced cathedral-style columns with ruins imperfections
 */
import React, { useRef, useMemo, useEffect } from "react";
import * as THREE from "three";
import {
  SCALE,
  COLUMN_BASE_HEIGHT,
  COLUMN_RING_HEIGHT,
  COLUMN_CAP_HEIGHT,
  COLUMN_TOP_HEIGHT,
  COLUMN_SHAFT_HEIGHT,
} from "../constants.js";
import { seededRandom } from "../utils.js";

/**
 * InstancedColumns - Renders all columns using GPU instancing
 * Square cathedral-style columns with wider base and capital
 * Includes random tilts and position offsets for ruins aesthetic
 */
const InstancedColumns = ({ positions, stoneMaterial, trimMaterial }) => {
  const baseRef = useRef();
  const ringRef = useRef();
  const shaftRef = useRef();
  const capRef = useRef();
  const topRef = useRef();

  const count = positions.length;
  
  // Pre-create geometries - SQUARE cathedral columns
  const geometries = useMemo(() => ({
    // Plinth (base) - slightly wider than shaft for visual grounding
    base: new THREE.BoxGeometry(SCALE(7.0), COLUMN_BASE_HEIGHT, SCALE(7.0)),
    // Base molding - transition between plinth and shaft
    ring: new THREE.BoxGeometry(SCALE(6.2), COLUMN_RING_HEIGHT, SCALE(6.2)),
    // Main shaft - the primary column body
    shaft: new THREE.BoxGeometry(SCALE(5.5), COLUMN_SHAFT_HEIGHT, SCALE(5.5)),
    // Capital - subtle widening from shaft
    cap: new THREE.BoxGeometry(SCALE(6.2), COLUMN_CAP_HEIGHT, SCALE(6.2)),
    // Abacus (top) - slightly wider to support ceiling, matching base
    top: new THREE.BoxGeometry(SCALE(7.0), COLUMN_TOP_HEIGHT, SCALE(7.0)),
  }), []);

  // Generate random imperfections per column (seeded by position for consistency)
  const columnImperfections = useMemo(() => {
    return positions.map((pos) => {
      const seed = pos[0] * 1000 + pos[2];
      const tiltX = (seededRandom(seed) - 0.5) * 0.06;
      const tiltZ = (seededRandom(seed + 1) - 0.5) * 0.06;
      const offsetX = (seededRandom(seed + 2) - 0.5) * SCALE(0.4);
      const offsetZ = (seededRandom(seed + 3) - 0.5) * SCALE(0.4);
      const scaleVar = 0.92 + seededRandom(seed + 4) * 0.16;
      const heightVar = 0.85 + seededRandom(seed + 5) * 0.18;
      return { tiltX, tiltZ, offsetX, offsetZ, scaleVar, heightVar };
    });
  }, [positions]);

  // Set up instance matrices with imperfections
  useEffect(() => {
    const tempMatrix = new THREE.Matrix4();
    const tempPosition = new THREE.Vector3();
    const tempQuaternion = new THREE.Quaternion();
    const tempEuler = new THREE.Euler();
    const tempScale = new THREE.Vector3(1, 1, 1);

    positions.forEach((pos, i) => {
      const imp = columnImperfections[i];
      const baseX = pos[0] + imp.offsetX;
      const baseZ = pos[2] + imp.offsetZ;
      
      // Apply tilt to rotation
      tempEuler.set(imp.tiltX, 0, imp.tiltZ);
      tempQuaternion.setFromEuler(tempEuler);
      tempScale.set(imp.scaleVar, 1, imp.scaleVar);

      // Base (less tilt for grounded appearance)
      if (baseRef.current) {
        tempPosition.set(baseX, COLUMN_BASE_HEIGHT / 2, baseZ);
        tempEuler.set(imp.tiltX * 0.3, 0, imp.tiltZ * 0.3);
        tempQuaternion.setFromEuler(tempEuler);
        tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
        baseRef.current.setMatrixAt(i, tempMatrix);
      }

      // Ring
      if (ringRef.current) {
        tempPosition.set(baseX, COLUMN_BASE_HEIGHT + COLUMN_RING_HEIGHT / 2, baseZ);
        tempEuler.set(imp.tiltX * 0.5, 0, imp.tiltZ * 0.5);
        tempQuaternion.setFromEuler(tempEuler);
        tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
        ringRef.current.setMatrixAt(i, tempMatrix);
      }

      // Shaft (full tilt, height variation for broken columns)
      if (shaftRef.current) {
        const shaftHeight = COLUMN_SHAFT_HEIGHT * imp.heightVar;
        tempPosition.set(
          baseX + Math.sin(imp.tiltZ) * shaftHeight * 0.5,
          COLUMN_BASE_HEIGHT + COLUMN_RING_HEIGHT + shaftHeight / 2,
          baseZ + Math.sin(imp.tiltX) * shaftHeight * 0.5
        );
        tempEuler.set(imp.tiltX, 0, imp.tiltZ);
        tempQuaternion.setFromEuler(tempEuler);
        tempScale.set(imp.scaleVar, imp.heightVar, imp.scaleVar);
        tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
        shaftRef.current.setMatrixAt(i, tempMatrix);
      }

      // Cap (follows shaft tilt)
      if (capRef.current) {
        const shaftHeight = COLUMN_SHAFT_HEIGHT * imp.heightVar;
        tempPosition.set(
          baseX + Math.sin(imp.tiltZ) * shaftHeight,
          COLUMN_BASE_HEIGHT + COLUMN_RING_HEIGHT + shaftHeight + COLUMN_CAP_HEIGHT / 2,
          baseZ + Math.sin(imp.tiltX) * shaftHeight
        );
        tempEuler.set(imp.tiltX * 1.2, seededRandom(i) * 0.1, imp.tiltZ * 1.2);
        tempQuaternion.setFromEuler(tempEuler);
        tempScale.set(imp.scaleVar, 1, imp.scaleVar);
        tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
        capRef.current.setMatrixAt(i, tempMatrix);
      }

      // Top (more tilt at the peak)
      if (topRef.current) {
        const shaftHeight = COLUMN_SHAFT_HEIGHT * imp.heightVar;
        tempPosition.set(
          baseX + Math.sin(imp.tiltZ) * (shaftHeight + COLUMN_CAP_HEIGHT),
          COLUMN_BASE_HEIGHT + COLUMN_RING_HEIGHT + shaftHeight + COLUMN_CAP_HEIGHT + COLUMN_TOP_HEIGHT / 2,
          baseZ + Math.sin(imp.tiltX) * (shaftHeight + COLUMN_CAP_HEIGHT)
        );
        tempEuler.set(imp.tiltX * 1.5, seededRandom(i + 100) * 0.15, imp.tiltZ * 1.5);
        tempQuaternion.setFromEuler(tempEuler);
        tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
        topRef.current.setMatrixAt(i, tempMatrix);
      }
    });

    // Update instance matrices
    [baseRef, ringRef, shaftRef, capRef, topRef].forEach(ref => {
      if (ref.current) {
        ref.current.instanceMatrix.needsUpdate = true;
      }
    });
  }, [positions, columnImperfections]);

  return (
    <group>
      <instancedMesh
        ref={baseRef}
        args={[geometries.base, stoneMaterial, count]}
        castShadow
        receiveShadow
        frustumCulled={false}
      />
      <instancedMesh
        ref={ringRef}
        args={[geometries.ring, trimMaterial, count]}
        castShadow
        receiveShadow
        frustumCulled={false}
      />
      <instancedMesh
        ref={shaftRef}
        args={[geometries.shaft, stoneMaterial, count]}
        castShadow
        receiveShadow
        frustumCulled={false}
      />
      <instancedMesh
        ref={capRef}
        args={[geometries.cap, trimMaterial, count]}
        castShadow
        receiveShadow
        frustumCulled={false}
      />
      <instancedMesh
        ref={topRef}
        args={[geometries.top, trimMaterial, count]}
        castShadow
        receiveShadow
        frustumCulled={false}
      />
    </group>
  );
};

export default InstancedColumns;
