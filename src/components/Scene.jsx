import React, { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { XR, useXR } from "@react-three/xr";
import * as THREE from "three";

const DEADZONE = 0.1;
const MAX_SPEED = 8;
const LOOK_SPEED = 1.8;
const MOUSE_SENSITIVITY = 0.0025;
const CAMERA_HEIGHT = 1.6;
const MAX_PITCH = Math.PI / 2 - 0.08;
const SYNC_INTERVAL = 50;
const POSITION_LERP = 10;
const REMOTE_LERP = 8;
const AVATAR_HEIGHT = 0.9;
const UP = new THREE.Vector3(0, 1, 0);
const ZERO_AXIS = { x: 0, y: 0 };
const HALL_SCALE = 5;
const SCALE = (value) => value * HALL_SCALE;
// Room dimensions - 5x wider and longer than original
const HALL_WIDTH = SCALE(44 * 5);  // 5x original width
const HALL_LENGTH = SCALE(110 * 5);  // 5x original length
const HALL_HEIGHT = SCALE(32);
// Render distance based on largest room dimension
const MAX_ROOM_DIMENSION = Math.max(HALL_WIDTH, HALL_LENGTH, HALL_HEIGHT);
const RENDER_DISTANCE = MAX_ROOM_DIMENSION * 1.5;
const WALL_THICKNESS = SCALE(1.6);
const FLOOR_THICKNESS = SCALE(1.2);
const CEILING_THICKNESS = SCALE(1.1);
const DOOR_WIDTH = SCALE(14);
const DOOR_HEIGHT = SCALE(18);  // Height to arch spring point
const ARCH_RADIUS = DOOR_WIDTH / 2;  // Semicircular arch
const TOTAL_DOOR_HEIGHT = DOOR_HEIGHT + ARCH_RADIUS;  // Full height including arch
const BOUNDARY_MARGIN = 1.2;
const HALL_HALF_WIDTH = HALL_WIDTH / 2;
const HALL_HALF_LENGTH = HALL_LENGTH / 2;

const applyDeadzone = (value) => (Math.abs(value) < DEADZONE ? 0 : value);

const clampAxis = (value) => Math.min(1, Math.max(-1, value));

const clampToHall = (position) => {
  const limitX = HALL_HALF_WIDTH - BOUNDARY_MARGIN;
  const limitZ = HALL_HALF_LENGTH - BOUNDARY_MARGIN;
  position.x = THREE.MathUtils.clamp(position.x, -limitX, limitX);
  position.z = THREE.MathUtils.clamp(position.z, -limitZ, limitZ);
  return position;
};

const getPrimaryGamepad = () => {
  if (typeof navigator === "undefined" || !navigator.getGamepads) {
    return null;
  }
  const pads = navigator.getGamepads();
  for (const pad of pads) {
    if (pad && pad.connected) {
      return pad;
    }
  }
  return null;
};

const resolveWsUrl = () => {
  const override = import.meta.env?.VITE_WS_URL;
  if (override) {
    return override;
  }
  if (typeof window === "undefined") {
    return "ws://localhost:4000";
  }
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const hostname = window.location.hostname || "localhost";
  return `${protocol}://${hostname}:4000`;
};

const useMultiplayer = () => {
  const [players, setPlayers] = useState([]);
  const socketRef = useRef(null);
  const localIdRef = useRef(null);
  const lastSentRef = useRef(0);

  React.useEffect(() => {
    const socket = new WebSocket(resolveWsUrl());
    socketRef.current = socket;

    socket.addEventListener("message", (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "welcome") {
          localIdRef.current = payload.id;
          setPlayers(Array.isArray(payload.players) ? payload.players : []);
          return;
        }
        if (payload.type === "state") {
          setPlayers(Array.isArray(payload.players) ? payload.players : []);
        }
      } catch (error) {
        console.error("Invalid multiplayer payload", error);
      }
    });

    return () => {
      socket.close();
    };
  }, []);

  const sendMove = useCallback((position, quaternion) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }
    const now = performance.now();
    if (now - lastSentRef.current < SYNC_INTERVAL) {
      return;
    }
    lastSentRef.current = now;
    socket.send(
      JSON.stringify({
        type: "move",
        position: { x: position.x, y: position.y, z: position.z },
        rotation: { x: quaternion.x, y: quaternion.y, z: quaternion.z, w: quaternion.w },
      })
    );
  }, []);

  return { players, localIdRef, sendMove };
};

const createNoiseCanvas = (size, baseColor, accentColor, noiseStrength = 22, veinCount = 18) => {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return canvas;
  }

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, size, size);
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, baseColor);
  gradient.addColorStop(1, accentColor);
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  ctx.globalAlpha = 1;

  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * noiseStrength;
    data[i] = THREE.MathUtils.clamp(data[i] + noise, 0, 255);
    data[i + 1] = THREE.MathUtils.clamp(data[i + 1] + noise, 0, 255);
    data[i + 2] = THREE.MathUtils.clamp(data[i + 2] + noise, 0, 255);
  }
  ctx.putImageData(imageData, 0, 0);

  ctx.strokeStyle = "rgba(15, 15, 15, 0.2)";
  ctx.lineWidth = 1;
  for (let i = 0; i < veinCount; i += 1) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * size, Math.random() * size);
    ctx.lineTo(Math.random() * size, Math.random() * size);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
  for (let i = 0; i < veinCount * 2; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const w = 2 + Math.random() * 6;
    const h = 1 + Math.random() * 3;
    ctx.fillRect(x, y, w, h);
  }

  return canvas;
};

const createGrainCanvas = (size, base = 140, variance = 70) => {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return canvas;
  }
  const imageData = ctx.createImageData(size, size);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const value = THREE.MathUtils.clamp(base + (Math.random() - 0.5) * variance, 0, 255);
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
    data[i + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
};

const buildCanvasTexture = (canvas, repeat, isColorTexture) => {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat[0], repeat[1]);
  texture.anisotropy = 8;  // B2: Reduced from 16 for performance
  if (isColorTexture) {
    texture.colorSpace = THREE.SRGBColorSpace;
  }
  return texture;
};

const createTexturedMaterial = ({
  baseColor,
  accentColor,
  repeat = [4, 4],
  roughness = 0.9,
  metalness = 0.1,
  bumpScale = 0.2,
  noiseStrength = 22,
  veinCount = 18,
  grainBase = 140,
  grainVariance = 70,
  textureSize = 512,  // Higher resolution for better quality
}) => {
  if (typeof document === "undefined") {
    return new THREE.MeshStandardMaterial({ color: baseColor, roughness, metalness });
  }

  const diffuseCanvas = createNoiseCanvas(textureSize, baseColor, accentColor, noiseStrength, veinCount);
  const grainCanvas = createGrainCanvas(textureSize, grainBase, grainVariance);
  const map = buildCanvasTexture(diffuseCanvas, repeat, true);
  const roughnessMap = buildCanvasTexture(grainCanvas, repeat, false);
  const bumpMap = buildCanvasTexture(grainCanvas, repeat, false);
  
  // B2: Reduced anisotropy from 16 to 8 for performance (subtle visual impact at oblique angles)
  map.anisotropy = 8;
  roughnessMap.anisotropy = 8;
  bumpMap.anisotropy = 8;

  return new THREE.MeshStandardMaterial({
    color: baseColor,
    map,
    roughnessMap,
    bumpMap,
    bumpScale,
    roughness,
    metalness,
  });
};

// Calculate texture repeats based on room dimensions for consistent tile size
const FLOOR_TILE_SIZE = SCALE(8);  // Each tile represents 8 scaled units
const FLOOR_REPEAT_X = Math.ceil(HALL_WIDTH / FLOOR_TILE_SIZE);
const FLOOR_REPEAT_Z = Math.ceil(HALL_LENGTH / FLOOR_TILE_SIZE);
const WALL_TILE_SIZE = SCALE(6);
const WALL_REPEAT_H = Math.ceil(HALL_LENGTH / WALL_TILE_SIZE);
const WALL_REPEAT_V = Math.ceil(HALL_HEIGHT / WALL_TILE_SIZE);

// Column dimensions (computed once)
const COLUMN_BASE_HEIGHT = SCALE(0.6);
const COLUMN_RING_HEIGHT = SCALE(0.3);
const COLUMN_CAP_HEIGHT = SCALE(0.8);
const COLUMN_TOP_HEIGHT = SCALE(0.4);
const COLUMN_CLEARANCE = SCALE(0.1);
const COLUMN_TOTAL_HEIGHT = Math.max(SCALE(6), HALL_HEIGHT - COLUMN_CLEARANCE);
const COLUMN_SHAFT_HEIGHT = Math.max(
  SCALE(4),
  COLUMN_TOTAL_HEIGHT - COLUMN_BASE_HEIGHT - COLUMN_RING_HEIGHT - COLUMN_CAP_HEIGHT - COLUMN_TOP_HEIGHT
);
const COLUMN_SHAFT_Y = COLUMN_BASE_HEIGHT + COLUMN_RING_HEIGHT + COLUMN_SHAFT_HEIGHT / 2;
const COLUMN_CAP_Y = COLUMN_BASE_HEIGHT + COLUMN_RING_HEIGHT + COLUMN_SHAFT_HEIGHT + COLUMN_CAP_HEIGHT / 2;
const COLUMN_TOP_Y = COLUMN_BASE_HEIGHT + COLUMN_RING_HEIGHT + COLUMN_SHAFT_HEIGHT + COLUMN_CAP_HEIGHT + COLUMN_TOP_HEIGHT / 2;

// Seeded random number generator for consistent imperfections
const seededRandom = (seed) => {
  const x = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

// Instanced Columns - renders all columns with GPU instancing (pure performance optimization)
// Now includes random tilts and position offsets for ruins aesthetic
// Square cathedral-style columns with wider base and capital
const InstancedColumns = ({ positions, stoneMaterial, trimMaterial }) => {
  const baseRef = useRef();
  const ringRef = useRef();
  const shaftRef = useRef();
  const capRef = useRef();
  const topRef = useRef();
  const detailRingRefs = useRef([]);

  const count = positions.length;
  
  // Pre-create geometries - SQUARE cathedral columns
  // Profile: Wide plinth -> base molding -> MUCH narrower shaft -> capital -> wide abacus
  // Classical column proportions: shaft is ~60% of base width for dramatic silhouette
  const geometries = useMemo(() => ({
    // Plinth (base) - widest at bottom for stability
    base: new THREE.BoxGeometry(SCALE(11.6), COLUMN_BASE_HEIGHT, SCALE(11.6)),
    // Base molding - transition between plinth and shaft
    ring: new THREE.BoxGeometry(SCALE(9.0), COLUMN_RING_HEIGHT, SCALE(9.0)),
    // Main shaft - significantly narrower than base and capital for classical cathedral silhouette
    // At 7.0 vs 11.6, the shaft is about 60% of base width - creates visible tapering
    shaft: new THREE.BoxGeometry(SCALE(7.0), COLUMN_SHAFT_HEIGHT, SCALE(7.0)),
    // Capital - widens dramatically from shaft back toward base width
    cap: new THREE.BoxGeometry(SCALE(9.0), COLUMN_CAP_HEIGHT, SCALE(9.0)),
    // Abacus (top) - widest at top to support ceiling structure
    top: new THREE.BoxGeometry(SCALE(11.6), COLUMN_TOP_HEIGHT, SCALE(11.6)),
    // Square trim bands sized to match shaft width
    detailRing: new THREE.BoxGeometry(SCALE(7.4), SCALE(0.15), SCALE(7.4)),
  }), []);

  // Generate random imperfections per column (seeded by position for consistency)
  const columnImperfections = useMemo(() => {
    return positions.map((pos, i) => {
      const seed = pos[0] * 1000 + pos[2];
      const tiltX = (seededRandom(seed) - 0.5) * 0.06;  // Random tilt ±0.03 radians
      const tiltZ = (seededRandom(seed + 1) - 0.5) * 0.06;
      const offsetX = (seededRandom(seed + 2) - 0.5) * SCALE(0.4);  // Small position offset
      const offsetZ = (seededRandom(seed + 3) - 0.5) * SCALE(0.4);
      const scaleVar = 0.92 + seededRandom(seed + 4) * 0.16;  // 92-108% scale variation
      const heightVar = 0.85 + seededRandom(seed + 5) * 0.18;  // Some columns shorter (damaged)
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

      // Detail rings
      const ringOffsets = [0.2, 0.5, 0.8];
      ringOffsets.forEach((ratio, ri) => {
        const ringRefEl = detailRingRefs.current[ri];
        if (ringRefEl) {
          const shaftHeight = COLUMN_SHAFT_HEIGHT * imp.heightVar;
          const ringY = COLUMN_BASE_HEIGHT + COLUMN_RING_HEIGHT + ratio * shaftHeight;
          tempPosition.set(
            baseX + Math.sin(imp.tiltZ) * ratio * shaftHeight,
            ringY,
            baseZ + Math.sin(imp.tiltX) * ratio * shaftHeight
          );
          tempEuler.set(imp.tiltX * (0.5 + ratio * 0.5), 0, imp.tiltZ * (0.5 + ratio * 0.5));
          tempQuaternion.setFromEuler(tempEuler);
          tempScale.set(imp.scaleVar, 1, imp.scaleVar);
          tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
          ringRefEl.setMatrixAt(i, tempMatrix);
        }
      });
    });

    // Update instance matrices
    [baseRef, ringRef, shaftRef, capRef, topRef].forEach(ref => {
      if (ref.current) {
        ref.current.instanceMatrix.needsUpdate = true;
      }
    });
    detailRingRefs.current.forEach(ref => {
      if (ref) ref.instanceMatrix.needsUpdate = true;
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
      {/* Detail rings */}
      {[0, 1, 2].map((ri) => (
        <instancedMesh
          key={`detail-ring-${ri}`}
          ref={(el) => { detailRingRefs.current[ri] = el; }}
          args={[geometries.detailRing, trimMaterial, count]}
          castShadow
          receiveShadow
          frustumCulled={false}
        />
      ))}
    </group>
  );
};

// Wall cracks and damage for ruins aesthetic
const WallCracks = ({ side, material }) => {
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

const WallRibs = ({ side, material, ribZPositions }) => {
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

const WallBands = ({ side, material }) => {
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

// Create arch infill geometry (fills the corners above the arch in the rectangular wall opening)
const createArchInfillGeometry = (radius, depth, segments = 32) => {
  const shape = new THREE.Shape();
  // Start at bottom-left of the square that contains the semicircle
  shape.moveTo(-radius, 0);
  shape.lineTo(-radius, radius);
  shape.lineTo(radius, radius);
  shape.lineTo(radius, 0);
  // Cut out the semicircle (arch) from the bottom
  shape.absarc(0, 0, radius, 0, Math.PI, false);
  shape.lineTo(-radius, 0);
  
  const extrudeSettings = {
    depth: depth,
    bevelEnabled: false,
    steps: 1,
  };
  
  return new THREE.ExtrudeGeometry(shape, extrudeSettings);
};

// Create arched door panel geometry
const createArchedPanelGeometry = (width, height, archRadius, depth, segments = 16) => {
  const shape = new THREE.Shape();
  const halfWidth = width / 2;
  
  // Start at bottom-left
  shape.moveTo(-halfWidth, 0);
  shape.lineTo(-halfWidth, height);
  // Arch at top
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
  
  // Geometries for arch elements
  const archInfillGeometry = useMemo(
    () => createArchInfillGeometry(ARCH_RADIUS, WALL_THICKNESS, 32),
    []
  );
  
  const archFrameGeometry = useMemo(
    () => createArchInfillGeometry(ARCH_RADIUS + frameWidth, frameDepth, 32),
    []
  );
  
  const archFrameInnerGeometry = useMemo(
    () => createArchInfillGeometry(ARCH_RADIUS, frameDepth + 0.1, 32),
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

const World = () => {
  const materials = useMemo(() => {
    // Wall material - weathered ruins aesthetic with more imperfections
    const stone = createTexturedMaterial({
      baseColor: "#5a6058",  // Slightly greenish gray for aged stone
      accentColor: "#4a5048",
      repeat: [WALL_REPEAT_H, WALL_REPEAT_V],
      roughness: 0.85,  // More weathered
      metalness: 0.05,
      bumpScale: 0.4,  // More pronounced surface detail
      noiseStrength: 45,  // More noise for weathered look
      veinCount: 35,  // More cracks and veins
      grainBase: 140,
      grainVariance: 90,  // More variance for patchy weathering
      textureSize: 512,
    });
    // Floor material - worn, cracked ancient stone
    const stoneDark = createTexturedMaterial({
      baseColor: "#454a48",  // Darker, aged floor
      accentColor: "#3a3f3d",
      repeat: [FLOOR_REPEAT_X, FLOOR_REPEAT_Z],  // Scale with room size
      roughness: 0.82,  // More worn
      metalness: 0.03,
      bumpScale: 0.5,  // Deep cracks and wear patterns
      noiseStrength: 50,  // Heavy weathering
      veinCount: 40,  // Lots of cracks for ancient floor
      grainBase: 130,
      grainVariance: 100,
      textureSize: 512,
    });
    // Trim material - aged architectural detail
    const stoneTrim = createTexturedMaterial({
      baseColor: "#686e68",  // Slightly greenish for moss/age
      accentColor: "#505850",
      repeat: [12, 12],  // Fine detail for trim pieces
      roughness: 0.78,  // Weathered
      metalness: 0.08,
      bumpScale: 0.35,
      noiseStrength: 35,
      veinCount: 25,  // More detail for age
      grainBase: 130,
      grainVariance: 75,
      textureSize: 512,
    });
    // Metal material - corroded, ancient
    const metal = createTexturedMaterial({
      baseColor: "#5a6858",  // Oxidized greenish patina
      accentColor: "#4a5848",
      repeat: [4, 4],
      roughness: 0.6,  // More corroded
      metalness: 0.55,  // Less shiny due to corrosion
      bumpScale: 0.3,
      noiseStrength: 40,  // Corrosion texture
      veinCount: 20,
      grainBase: 100,
      grainVariance: 100,
      textureSize: 512,
    });
    // Dark void material for cracks
    const voidMaterial = new THREE.MeshBasicMaterial({ color: "#0a0a08" });
    
    return {
      stone,
      stoneDark,
      stoneTrim,
      metal,
      voidMaterial,
    };
  }, []);

  const columnPositions = useMemo(() => {
    // C5: Column spacing for larger columns while maintaining high column count
    const columnSpacingX = SCALE(42);  // Original spacing
    const columnSpacingZ = SCALE(38);  // Original spacing
    
    // Calculate number of columns needed to fill the expanded room
    const numColumnsX = Math.floor((HALL_WIDTH - SCALE(16)) / columnSpacingX);  // Leave margin from walls
    const numColumnsZ = Math.floor((HALL_LENGTH - SCALE(20)) / columnSpacingZ);
    
    const positions = [];
    
    // Generate column positions symmetrically
    for (let xi = 0; xi < numColumnsX; xi++) {
      // Center the columns, leaving space from walls
      const xOffset = (numColumnsX - 1) * columnSpacingX / 2;
      const x = xi * columnSpacingX - xOffset;
      
      // Skip columns too close to center walkway (leave a corridor)
      if (Math.abs(x) < SCALE(8)) continue;
      
      for (let zi = 0; zi < numColumnsZ; zi++) {
        const zOffset = (numColumnsZ - 1) * columnSpacingZ / 2;
        const z = zi * columnSpacingZ - zOffset;
        positions.push([x, 0, z]);
      }
    }
    
    return positions;
  }, []);

  // Generate rib positions to cover the expanded room
  const ribZPositions = useMemo(() => {
    const spacing = SCALE(32);
    const count = Math.floor(HALL_LENGTH / spacing);
    const positions = [];
    for (let i = 0; i <= count; i++) {
      positions.push(i * spacing - HALL_LENGTH / 2 + spacing / 2);
    }
    return positions;
  }, []);
  
  // Generate beam positions for expanded room
  const beamZPositions = useMemo(() => {
    const spacing = SCALE(40);
    const count = Math.floor(HALL_LENGTH / spacing);
    const positions = [];
    for (let i = 0; i <= count; i++) {
      positions.push(i * spacing - HALL_LENGTH / 2 + spacing / 2);
    }
    return positions;
  }, []);
  
  // C1: Fixed 16-light configuration for performance (was ~87 dynamic lights)
  // 8 ceiling lights (4x2 grid) + 8 wall sconces (4 per side)
  const ceilingLightY = HALL_HEIGHT - SCALE(4);
  const wallLightY = SCALE(6);
  
  // Fixed ceiling light positions - 4x2 grid covering key areas
  const fixedCeilingLights = useMemo(() => [
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
  ], []);
  
  // Fixed wall sconce positions - 4 per side at key intervals
  const fixedWallSconces = useMemo(() => [
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
  ], []);

  // Longitudinal beam positions
  const longBeamXPositions = useMemo(() => {
    const beamSpacing = SCALE(25);
    const numBeams = Math.floor((HALL_WIDTH - SCALE(20)) / beamSpacing);
    const positions = [];
    for (let i = 0; i <= numBeams; i++) {
      positions.push(i * beamSpacing - (numBeams * beamSpacing) / 2);
    }
    return positions;
  }, []);

  return (
    <>
      {/* C2: Atmospheric fog - near 300, far 1500 for depth and mystery */}
      <fog attach="fog" args={["#1a1a18", 300, 1500]} />
      
      {/* C1: Increased ambient to compensate for fewer point lights - green-white tint */}
      <ambientLight intensity={1.8} color="#e8f0e0" />
      
      {/* C1: Increased hemisphere for better fill with fewer point lights - green-white tint */}
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
      
      {/* C1: Fixed 8 ceiling point lights (was ~55 dynamic) - green-white tint */}
      {fixedCeilingLights.map((pos, i) => (
        <pointLight
          key={`ceiling-light-${i}`}
          position={[pos.x, ceilingLightY, pos.z]}
          intensity={2400}
          distance={SCALE(200)}
          decay={2}
          color="#e0f0d0"
        />
      ))}
      
      {/* C1: Fixed 8 wall sconce lights (was ~32 dynamic) - green-white tint */}
      {fixedWallSconces.map((pos, i) => (
        <pointLight
          key={`wall-sconce-${i}`}
          position={[pos.x, wallLightY, pos.z]}
          intensity={800}
          distance={SCALE(100)}
          decay={2}
          color="#d8e8c8"
        />
      ))}
      
      {/* Emissive ceiling light fixtures - only for the 8 fixed positions - green-white tint */}
      {fixedCeilingLights.map((pos, i) => (
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
      
      {/* Emissive wall sconce fixtures - only for the 8 fixed positions - green-white tint */}
      {fixedWallSconces.map((pos, i) => (
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
      <group>
        <mesh position={[0, -FLOOR_THICKNESS / 2, 0]} receiveShadow material={materials.stoneDark}>
          <boxGeometry args={[HALL_WIDTH + SCALE(6), FLOOR_THICKNESS, HALL_LENGTH + SCALE(6)]} />
        </mesh>
        <mesh
          position={[0, HALL_HEIGHT + CEILING_THICKNESS / 2, 0]}
          receiveShadow
          material={materials.stone}
        >
          <boxGeometry args={[HALL_WIDTH + SCALE(6), CEILING_THICKNESS, HALL_LENGTH + SCALE(6)]} />
        </mesh>
        <mesh
          position={[-HALL_HALF_WIDTH - WALL_THICKNESS / 2, HALL_HEIGHT / 2, 0]}
          receiveShadow
          material={materials.stone}
        >
          <boxGeometry args={[WALL_THICKNESS, HALL_HEIGHT, HALL_LENGTH]} />
        </mesh>
        <mesh
          position={[HALL_HALF_WIDTH + WALL_THICKNESS / 2, HALL_HEIGHT / 2, 0]}
          receiveShadow
          material={materials.stone}
        >
          <boxGeometry args={[WALL_THICKNESS, HALL_HEIGHT, HALL_LENGTH]} />
        </mesh>
        <Doorway
          z={-HALL_HALF_LENGTH - WALL_THICKNESS / 2}
          rotation={0}
          stoneMaterial={materials.stone}
          trimMaterial={materials.stoneTrim}
          metalMaterial={materials.metal}
        />
        <Doorway
          z={HALL_HALF_LENGTH + WALL_THICKNESS / 2}
          rotation={Math.PI}
          stoneMaterial={materials.stone}
          trimMaterial={materials.stoneTrim}
          metalMaterial={materials.metal}
        />
        {/* GPU Instanced columns - pure performance optimization */}
        <InstancedColumns
          positions={columnPositions}
          stoneMaterial={materials.stone}
          trimMaterial={materials.stoneTrim}
        />
        <WallRibs side={-1} material={materials.stoneTrim} ribZPositions={ribZPositions} />
        <WallRibs side={1} material={materials.stoneTrim} ribZPositions={ribZPositions} />
        <WallBands side={-1} material={materials.stoneTrim} />
        <WallBands side={1} material={materials.stoneTrim} />
        {/* Ruins imperfections - wall damage */}
        <WallCracks side={-1} material={materials.voidMaterial} />
        <WallCracks side={1} material={materials.voidMaterial} />
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
        {/* Longitudinal ceiling beams distributed across the wider hall */}
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

const MovementRig = ({ onMove }) => {
  const inputSourceStates = useXR((state) => state.inputSourceStates);
  const { gl, camera } = useThree();
  const baseRefSpace = useRef(null);
  const currentPosition = useRef(new THREE.Vector3());
  const targetPosition = useRef(new THREE.Vector3());
  const moveDirection = useRef(new THREE.Vector3());
  const forwardDirection = useRef(new THREE.Vector3());
  const rightDirection = useRef(new THREE.Vector3());
  const endingRef = useRef(false);
  const controllersRef = useRef({ left: null, right: null });

  React.useEffect(() => {
    const leftController = inputSourceStates.find(
      (state) => state.type === "controller" && state.inputSource?.handedness === "left"
    );
    const rightController = inputSourceStates.find(
      (state) => state.type === "controller" && state.inputSource?.handedness === "right"
    );
    controllersRef.current = { left: leftController, right: rightController };
  }, [inputSourceStates]);

  useFrame((state, delta) => {
    const { left, right } = controllersRef.current;
    const axes = left?.inputSource?.gamepad?.axes || [];
    const axisX = applyDeadzone(axes[2] ?? 0);
    const axisY = applyDeadzone(axes[3] ?? 0);

    forwardDirection.current.set(0, 0, -1).applyQuaternion(camera.quaternion);
    forwardDirection.current.y = 0;
    if (forwardDirection.current.lengthSq() < 0.0001) {
      forwardDirection.current.set(0, 0, -1);
    } else {
      forwardDirection.current.normalize();
    }
    rightDirection.current.crossVectors(forwardDirection.current, UP).normalize();

    moveDirection.current
      .copy(rightDirection.current)
      .multiplyScalar(axisX)
      .addScaledVector(forwardDirection.current, -axisY);

    if (moveDirection.current.lengthSq() > 1) {
      moveDirection.current.normalize();
    }
    const velocity = moveDirection.current.multiplyScalar(MAX_SPEED * delta);
    targetPosition.current.add(velocity);
    clampToHall(targetPosition.current);

    const lerpAlpha = 1 - Math.exp(-delta * POSITION_LERP);
    currentPosition.current.lerp(targetPosition.current, lerpAlpha);
    clampToHall(currentPosition.current);

    const session = gl.xr.getSession();
    if (!session) {
      return;
    }

    if (!baseRefSpace.current) {
      baseRefSpace.current = gl.xr.getReferenceSpace();
    }
    if (baseRefSpace.current && typeof XRRigidTransform !== "undefined") {
      const offset = new XRRigidTransform({
        x: -currentPosition.current.x,
        y: -currentPosition.current.y,
        z: -currentPosition.current.z,
      });
      const offsetSpace = baseRefSpace.current.getOffsetReferenceSpace(offset);
      gl.xr.setReferenceSpace(offsetSpace);
    }

    const leftTrigger = left?.inputSource?.gamepad?.buttons?.[0]?.value > 0.7;
    const rightTrigger = right?.inputSource?.gamepad?.buttons?.[0]?.value > 0.7;

    if (leftTrigger && rightTrigger && !endingRef.current) {
      endingRef.current = true;
      session.end();
    }

    if (onMove) {
      onMove(currentPosition.current, camera.quaternion);
    }
  });

  return null;
};

const FlatControls = ({ onMove, leftAxisRef, rightAxisRef, enablePointerLock }) => {
  const { camera, gl } = useThree();
  const keysRef = useRef({ forward: false, backward: false, left: false, right: false });
  const mouseDeltaRef = useRef({ x: 0, y: 0 });
  const currentPosition = useRef(new THREE.Vector3());
  const targetPosition = useRef(new THREE.Vector3());
  const moveDirection = useRef(new THREE.Vector3());
  const forwardDirection = useRef(new THREE.Vector3());
  const rightDirection = useRef(new THREE.Vector3());
  const yawRef = useRef(0);
  const pitchRef = useRef(0);
  const activeRef = useRef(false);

  React.useEffect(() => {
    const keyMap = {
      KeyW: "forward",
      ArrowUp: "forward",
      KeyS: "backward",
      ArrowDown: "backward",
      KeyA: "left",
      ArrowLeft: "left",
      KeyD: "right",
      ArrowRight: "right",
    };

    const handleKey = (event, pressed) => {
      const action = keyMap[event.code];
      if (!action) {
        return;
      }
      keysRef.current[action] = pressed;
    };

    const handleKeyDown = (event) => handleKey(event, true);
    const handleKeyUp = (event) => handleKey(event, false);
    const handleBlur = () => {
      keysRef.current = { forward: false, backward: false, left: false, right: false };
    };

    const handleMouseMove = (event) => {
      if (!enablePointerLock) {
        return;
      }
      if (document.pointerLockElement !== gl.domElement) {
        return;
      }
      mouseDeltaRef.current.x += event.movementX;
      mouseDeltaRef.current.y += event.movementY;
    };

    const handlePointerDown = () => {
      if (!enablePointerLock) {
        return;
      }
      if (document.pointerLockElement === gl.domElement) {
        return;
      }
      gl.domElement.requestPointerLock?.();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("mousemove", handleMouseMove);
    gl.domElement.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("mousemove", handleMouseMove);
      gl.domElement.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [enablePointerLock, gl]);

  useFrame((state, delta) => {
    if (!activeRef.current) {
      currentPosition.current.copy(camera.position);
      targetPosition.current.copy(camera.position);
      currentPosition.current.y = CAMERA_HEIGHT;
      targetPosition.current.y = CAMERA_HEIGHT;
      camera.rotation.order = "YXZ";
      yawRef.current = camera.rotation.y;
      pitchRef.current = camera.rotation.x;
      activeRef.current = true;
    }

    const leftAxis = leftAxisRef?.current ?? ZERO_AXIS;
    const rightAxis = rightAxisRef?.current ?? ZERO_AXIS;
    const gamepad = getPrimaryGamepad();
    const axes = gamepad?.axes ?? [];
    const gpLX = applyDeadzone(axes[0] ?? 0);
    const gpLY = applyDeadzone(axes[1] ?? 0);
    const gpRX = applyDeadzone(axes[2] ?? 0);
    const gpRY = applyDeadzone(axes[3] ?? 0);

    const keyboardX = (keysRef.current.right ? 1 : 0) - (keysRef.current.left ? 1 : 0);
    const keyboardY = (keysRef.current.backward ? 1 : 0) - (keysRef.current.forward ? 1 : 0);
    const moveX = clampAxis(keyboardX + leftAxis.x + gpLX);
    const moveY = clampAxis(keyboardY + leftAxis.y + gpLY);

    const lookX = applyDeadzone(clampAxis(rightAxis.x + gpRX));
    const lookY = applyDeadzone(clampAxis(rightAxis.y + gpRY));
    const mouseDelta = mouseDeltaRef.current;

    yawRef.current -= mouseDelta.x * MOUSE_SENSITIVITY;
    pitchRef.current -= mouseDelta.y * MOUSE_SENSITIVITY;
    mouseDeltaRef.current.x = 0;
    mouseDeltaRef.current.y = 0;

    yawRef.current -= lookX * LOOK_SPEED * delta;
    pitchRef.current -= lookY * LOOK_SPEED * delta;
    pitchRef.current = THREE.MathUtils.clamp(pitchRef.current, -MAX_PITCH, MAX_PITCH);

    camera.rotation.set(pitchRef.current, yawRef.current, 0, "YXZ");

    forwardDirection.current.set(0, 0, -1).applyQuaternion(camera.quaternion);
    forwardDirection.current.y = 0;
    if (forwardDirection.current.lengthSq() < 0.0001) {
      forwardDirection.current.set(0, 0, -1);
    } else {
      forwardDirection.current.normalize();
    }
    rightDirection.current.crossVectors(forwardDirection.current, UP).normalize();

    moveDirection.current
      .copy(rightDirection.current)
      .multiplyScalar(moveX)
      .addScaledVector(forwardDirection.current, -moveY);

    if (moveDirection.current.lengthSq() > 1) {
      moveDirection.current.normalize();
    }

    const velocity = moveDirection.current.multiplyScalar(MAX_SPEED * delta);
    targetPosition.current.add(velocity);
    targetPosition.current.y = CAMERA_HEIGHT;
    clampToHall(targetPosition.current);

    const lerpAlpha = 1 - Math.exp(-delta * POSITION_LERP);
    currentPosition.current.lerp(targetPosition.current, lerpAlpha);
    currentPosition.current.y = CAMERA_HEIGHT;
    clampToHall(currentPosition.current);

    camera.position.copy(currentPosition.current);

    if (onMove) {
      onMove(currentPosition.current, camera.quaternion);
    }
  });

  return null;
};

const RemoteAvatar = ({ color, position, rotation }) => {
  const meshRef = useRef(null);
  const targetPosition = useRef(new THREE.Vector3());
  const targetQuaternion = useRef(new THREE.Quaternion());

  React.useEffect(() => {
    const safeY = Number.isFinite(position.y) ? position.y : AVATAR_HEIGHT;
    targetPosition.current.set(position.x, safeY, position.z);
    targetQuaternion.current.set(rotation.x, rotation.y, rotation.z, rotation.w);
  }, [position, rotation]);

  useFrame((_, delta) => {
    if (!meshRef.current) {
      return;
    }
    const lerpAlpha = 1 - Math.exp(-delta * REMOTE_LERP);
    meshRef.current.position.lerp(targetPosition.current, lerpAlpha);
    meshRef.current.quaternion.slerp(targetQuaternion.current, lerpAlpha);
  });

  return (
    <mesh ref={meshRef}>
      <capsuleGeometry args={[0.25, 1, 4, 8]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
};

const SessionWorld = () => {
  const { players, localIdRef, sendMove } = useMultiplayer();
  const sendPositionRef = useRef(new THREE.Vector3(0, AVATAR_HEIGHT, 0));

  const remotePlayers = useMemo(
    () => players.filter((player) => player.id && player.id !== localIdRef.current),
    [players]
  );
  const handleMove = useCallback(
    (position, quaternion) => {
      sendPositionRef.current.set(position.x, AVATAR_HEIGHT, position.z);
      sendMove(sendPositionRef.current, quaternion);
    },
    [sendMove]
  );

  return (
    <>
      {remotePlayers.map((player) => (
        <RemoteAvatar
          key={player.id}
          color={player.color}
          position={player.position || { x: 0, y: AVATAR_HEIGHT, z: 0 }}
          rotation={player.rotation || { x: 0, y: 0, z: 0, w: 1 }}
        />
      ))}
      <MovementRig onMove={handleMove} />
    </>
  );
};

const FlatSessionWorld = ({ leftAxisRef, rightAxisRef, enablePointerLock }) => {
  const { players, localIdRef, sendMove } = useMultiplayer();
  const sendPositionRef = useRef(new THREE.Vector3(0, AVATAR_HEIGHT, 0));

  const remotePlayers = useMemo(
    () => players.filter((player) => player.id && player.id !== localIdRef.current),
    [players]
  );
  const handleMove = useCallback(
    (position, quaternion) => {
      sendPositionRef.current.set(position.x, AVATAR_HEIGHT, position.z);
      sendMove(sendPositionRef.current, quaternion);
    },
    [sendMove]
  );

  return (
    <>
      {remotePlayers.map((player) => (
        <RemoteAvatar
          key={player.id}
          color={player.color}
          position={player.position || { x: 0, y: AVATAR_HEIGHT, z: 0 }}
          rotation={player.rotation || { x: 0, y: 0, z: 0, w: 1 }}
        />
      ))}
      <FlatControls
        onMove={handleMove}
        leftAxisRef={leftAxisRef}
        rightAxisRef={rightAxisRef}
        enablePointerLock={enablePointerLock}
      />
    </>
  );
};

const SessionGate = ({ onSessionChange }) => {
  const session = useXR((state) => state.session);

  React.useEffect(() => {
    if (onSessionChange) {
      onSessionChange(session ?? null);
    }
  }, [onSessionChange, session]);

  if (!session) {
    return null;
  }

  return <SessionWorld />;
};

// Configure renderer for proper lighting display
const RendererConfig = () => {
  const { gl } = useThree();
  
  React.useEffect(() => {
    // Use NoToneMapping to prevent ACES from darkening the scene
    // Or use ACESFilmicToneMapping with higher exposure
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.5; // Increase exposure to brighten overall scene
    gl.outputColorSpace = THREE.SRGBColorSpace;
  }, [gl]);
  
  return null;
};

const Scene = ({ store, onSessionChange, onReady, flatControls, xrEnabled = true }) => {
  const handleCreated = useCallback((state) => {
    // Configure renderer on creation for proper lighting
    state.gl.toneMapping = THREE.ACESFilmicToneMapping;
    state.gl.toneMappingExposure = 1.5;
    state.gl.outputColorSpace = THREE.SRGBColorSpace;
    
    if (onReady) {
      onReady();
    }
  }, [onReady]);

  const flatActive = Boolean(flatControls?.active);

  // Note: A6 demand-based rendering not applicable - continuous game with movement/multiplayer

  return (
    <div className="vr-scene">
      <Canvas
        shadows
        onCreated={handleCreated}
        camera={{ position: [0, 1.6, 3], fov: 60, near: 0.1, far: RENDER_DISTANCE }}
        gl={{ 
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.5,
        }}
      >
        <RendererConfig />
        {/* Dark greenish background for ruins atmosphere */}
        <color attach="background" args={["#12140f"]} />
        {xrEnabled ? (
          <XR store={store}>
            <World />
            <SessionGate onSessionChange={onSessionChange} />
          </XR>
        ) : (
          <World />
        )}
        {flatActive ? (
          <FlatSessionWorld
            leftAxisRef={flatControls?.leftAxisRef}
            rightAxisRef={flatControls?.rightAxisRef}
            enablePointerLock={Boolean(flatControls?.enablePointerLock)}
          />
        ) : null}
      </Canvas>
    </div>
  );
};

export default Scene;
