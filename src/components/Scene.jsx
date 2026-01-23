import React, { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { XR, useXR } from "@react-three/xr";
import * as THREE from "three";

// ============================================================================
// PERFORMANCE CONFIGURATION
// ============================================================================

// Detect mobile/low-power devices
const detectMobile = () => {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isLowPower = navigator.hardwareConcurrency ? navigator.hardwareConcurrency <= 4 : false;
  const hasCoarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches;
  return isMobile || isLowPower || hasCoarsePointer;
};

const IS_MOBILE = detectMobile();

// Quality presets based on device capability
const QUALITY_PRESETS = {
  mobile: {
    shadowMapSize: 512,
    shadowsEnabled: false,  // Disable shadows on mobile for major perf gain
    maxLights: 8,  // Drastically reduced
    textureSize: 256,
    anisotropy: 2,
    cylinderSegments: 8,
    columnDetailRings: false,
    pixelRatio: Math.min(window?.devicePixelRatio || 1, 1.5),
    antialias: false,
    lightDistance: 150,  // Shorter light range
    enableEmissiveMeshes: false,  // Skip decorative light fixtures
  },
  desktop: {
    shadowMapSize: 1024,  // Reduced from 2048 for better perf
    shadowsEnabled: true,
    maxLights: 24,  // Still reduced significantly
    textureSize: 512,
    anisotropy: 8,
    cylinderSegments: 16,
    columnDetailRings: true,
    pixelRatio: Math.min(window?.devicePixelRatio || 1, 2),
    antialias: true,
    lightDistance: 300,
    enableEmissiveMeshes: true,
  },
};

const QUALITY = IS_MOBILE ? QUALITY_PRESETS.mobile : QUALITY_PRESETS.desktop;

// ============================================================================
// CONSTANTS
// ============================================================================

const DEADZONE = 0.1;
const MAX_SPEED = 3;
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
const HALL_HEIGHT = SCALE(16);
// Render distance - use fog to hide distant areas instead of rendering everything
const RENDER_DISTANCE = IS_MOBILE ? SCALE(200) : SCALE(400);
const FOG_NEAR = IS_MOBILE ? SCALE(30) : SCALE(60);
const FOG_FAR = IS_MOBILE ? SCALE(150) : SCALE(300);
const WALL_THICKNESS = SCALE(1.6);
const FLOOR_THICKNESS = SCALE(1.2);
const CEILING_THICKNESS = SCALE(1.1);
const DOOR_WIDTH = SCALE(12);
const DOOR_HEIGHT = SCALE(10);
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
  texture.anisotropy = 8;
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
  textureSize = QUALITY.textureSize,  // Use quality preset
}) => {
  if (typeof document === "undefined") {
    return new THREE.MeshStandardMaterial({ color: baseColor, roughness, metalness });
  }

  // On mobile, use simpler materials without bump maps for performance
  if (IS_MOBILE) {
    const diffuseCanvas = createNoiseCanvas(textureSize, baseColor, accentColor, noiseStrength, veinCount);
    const map = buildCanvasTexture(diffuseCanvas, repeat, true);
    map.anisotropy = QUALITY.anisotropy;
    
    return new THREE.MeshStandardMaterial({
      color: baseColor,
      map,
      roughness,
      metalness,
    });
  }

  const diffuseCanvas = createNoiseCanvas(textureSize, baseColor, accentColor, noiseStrength, veinCount);
  const grainCanvas = createGrainCanvas(textureSize, grainBase, grainVariance);
  const map = buildCanvasTexture(diffuseCanvas, repeat, true);
  const roughnessMap = buildCanvasTexture(grainCanvas, repeat, false);
  const bumpMap = buildCanvasTexture(grainCanvas, repeat, false);
  
  // Use quality-appropriate anisotropy
  map.anisotropy = QUALITY.anisotropy;
  roughnessMap.anisotropy = QUALITY.anisotropy;
  bumpMap.anisotropy = QUALITY.anisotropy;

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

// Instanced Columns - renders all columns with GPU instancing (major performance gain)
const InstancedColumns = ({ positions, stoneMaterial, trimMaterial }) => {
  const baseRef = useRef();
  const ringRef = useRef();
  const shaftRef = useRef();
  const capRef = useRef();
  const topRef = useRef();
  const detailRingRefs = useRef([]);

  const segments = QUALITY.cylinderSegments;
  const count = positions.length;
  
  // Pre-create geometries
  const geometries = useMemo(() => ({
    base: new THREE.CylinderGeometry(SCALE(1.6), SCALE(1.8), COLUMN_BASE_HEIGHT, segments),
    ring: new THREE.CylinderGeometry(SCALE(1.45), SCALE(1.6), COLUMN_RING_HEIGHT, segments),
    shaft: new THREE.CylinderGeometry(SCALE(1.15), SCALE(1.25), COLUMN_SHAFT_HEIGHT, segments),
    cap: new THREE.BoxGeometry(SCALE(2.6), COLUMN_CAP_HEIGHT, SCALE(2.6)),
    top: new THREE.BoxGeometry(SCALE(2.9), COLUMN_TOP_HEIGHT, SCALE(2.9)),
    detailRing: new THREE.CylinderGeometry(SCALE(1.28), SCALE(1.28), SCALE(0.12), segments),
  }), [segments]);

  // Set up instance matrices
  useEffect(() => {
    const tempMatrix = new THREE.Matrix4();
    const tempPosition = new THREE.Vector3();
    const tempQuaternion = new THREE.Quaternion();
    const tempScale = new THREE.Vector3(1, 1, 1);

    positions.forEach((pos, i) => {
      // Base
      if (baseRef.current) {
        tempPosition.set(pos[0], COLUMN_BASE_HEIGHT / 2, pos[2]);
        tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
        baseRef.current.setMatrixAt(i, tempMatrix);
      }

      // Ring
      if (ringRef.current) {
        tempPosition.set(pos[0], COLUMN_BASE_HEIGHT + COLUMN_RING_HEIGHT / 2, pos[2]);
        tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
        ringRef.current.setMatrixAt(i, tempMatrix);
      }

      // Shaft
      if (shaftRef.current) {
        tempPosition.set(pos[0], COLUMN_SHAFT_Y, pos[2]);
        tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
        shaftRef.current.setMatrixAt(i, tempMatrix);
      }

      // Cap
      if (capRef.current) {
        tempPosition.set(pos[0], COLUMN_CAP_Y, pos[2]);
        tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
        capRef.current.setMatrixAt(i, tempMatrix);
      }

      // Top
      if (topRef.current) {
        tempPosition.set(pos[0], COLUMN_TOP_Y, pos[2]);
        tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
        topRef.current.setMatrixAt(i, tempMatrix);
      }

      // Detail rings (only on desktop)
      if (QUALITY.columnDetailRings) {
        const ringOffsets = [0.2, 0.5, 0.8];
        ringOffsets.forEach((ratio, ri) => {
          const ringRef = detailRingRefs.current[ri];
          if (ringRef) {
            tempPosition.set(pos[0], COLUMN_BASE_HEIGHT + COLUMN_RING_HEIGHT + ratio * COLUMN_SHAFT_HEIGHT, pos[2]);
            tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
            ringRef.setMatrixAt(i, tempMatrix);
          }
        });
      }
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
  }, [positions]);

  return (
    <group>
      <instancedMesh
        ref={baseRef}
        args={[geometries.base, stoneMaterial, count]}
        castShadow={QUALITY.shadowsEnabled}
        receiveShadow={QUALITY.shadowsEnabled}
      />
      <instancedMesh
        ref={ringRef}
        args={[geometries.ring, trimMaterial, count]}
        castShadow={QUALITY.shadowsEnabled}
        receiveShadow={QUALITY.shadowsEnabled}
      />
      <instancedMesh
        ref={shaftRef}
        args={[geometries.shaft, stoneMaterial, count]}
        castShadow={QUALITY.shadowsEnabled}
        receiveShadow={QUALITY.shadowsEnabled}
      />
      <instancedMesh
        ref={capRef}
        args={[geometries.cap, trimMaterial, count]}
        castShadow={QUALITY.shadowsEnabled}
        receiveShadow={QUALITY.shadowsEnabled}
      />
      <instancedMesh
        ref={topRef}
        args={[geometries.top, trimMaterial, count]}
        castShadow={QUALITY.shadowsEnabled}
        receiveShadow={QUALITY.shadowsEnabled}
      />
      {/* Detail rings only on desktop */}
      {QUALITY.columnDetailRings && [0, 1, 2].map((ri) => (
        <instancedMesh
          key={`detail-ring-${ri}`}
          ref={(el) => { detailRingRefs.current[ri] = el; }}
          args={[geometries.detailRing, trimMaterial, count]}
          castShadow={false}
          receiveShadow={false}
        />
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

const Doorway = ({ z, rotation, stoneMaterial, trimMaterial, metalMaterial }) => {
  const sideWidth = (HALL_WIDTH - DOOR_WIDTH) / 2;
  const lintelHeight = HALL_HEIGHT - DOOR_HEIGHT;
  const frameWidth = SCALE(0.8);
  const frameDepth = WALL_THICKNESS + SCALE(0.4);
  const doorPanelWidth = DOOR_WIDTH / 2 - SCALE(0.8);
  const doorPanelHeight = DOOR_HEIGHT - SCALE(0.4);
  const doorPanelDepth = SCALE(0.4);
  const swing = Math.PI * 0.6;
  const voidDepth = SCALE(22);

  return (
    <group position={[0, 0, z]} rotation={[0, rotation, 0]}>
      <mesh position={[-(DOOR_WIDTH / 2 + sideWidth / 2), HALL_HEIGHT / 2, 0]} material={stoneMaterial} receiveShadow>
        <boxGeometry args={[sideWidth, HALL_HEIGHT, WALL_THICKNESS]} />
      </mesh>
      <mesh position={[DOOR_WIDTH / 2 + sideWidth / 2, HALL_HEIGHT / 2, 0]} material={stoneMaterial} receiveShadow>
        <boxGeometry args={[sideWidth, HALL_HEIGHT, WALL_THICKNESS]} />
      </mesh>
      <mesh position={[0, DOOR_HEIGHT + lintelHeight / 2, 0]} material={stoneMaterial} receiveShadow>
        <boxGeometry args={[DOOR_WIDTH, lintelHeight, WALL_THICKNESS]} />
      </mesh>
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
      <mesh
        position={[0, DOOR_HEIGHT - SCALE(0.2), SCALE(0.2)]}
        material={trimMaterial}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[DOOR_WIDTH - frameWidth * 2, SCALE(0.5), frameDepth]} />
      </mesh>
      <group position={[-DOOR_WIDTH / 2 + frameWidth, 0, SCALE(0.4)]} rotation={[0, swing, 0]}>
        <mesh position={[doorPanelWidth / 2, doorPanelHeight / 2, 0]} material={metalMaterial} castShadow receiveShadow>
          <boxGeometry args={[doorPanelWidth, doorPanelHeight, doorPanelDepth]} />
        </mesh>
      </group>
      <group position={[DOOR_WIDTH / 2 - frameWidth, 0, SCALE(0.4)]} rotation={[0, -swing, 0]}>
        <mesh position={[-doorPanelWidth / 2, doorPanelHeight / 2, 0]} material={metalMaterial} castShadow receiveShadow>
          <boxGeometry args={[doorPanelWidth, doorPanelHeight, doorPanelDepth]} />
        </mesh>
      </group>
      <mesh position={[0, DOOR_HEIGHT / 2, -WALL_THICKNESS / 2 - voidDepth / 2]} castShadow={false}>
        <boxGeometry args={[DOOR_WIDTH - SCALE(1), DOOR_HEIGHT, voidDepth]} />
        <meshBasicMaterial color="#000000" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, SCALE(0.1), SCALE(1.8)]} material={trimMaterial} receiveShadow>
        <boxGeometry args={[DOOR_WIDTH + SCALE(2), SCALE(0.2), SCALE(3)]} />
      </mesh>
    </group>
  );
};

const World = () => {
  const materials = useMemo(() => {
    // Wall material with proper repeat for expanded room
    const stone = createTexturedMaterial({
      baseColor: "#6a7078",
      accentColor: "#5a6068",
      repeat: [WALL_REPEAT_H, WALL_REPEAT_V],
      roughness: 0.75,
      metalness: 0.08,
      bumpScale: 0.25,
      noiseStrength: 30,
      veinCount: 20,
      grainBase: 150,
      grainVariance: 70,
    });
    // Floor material with proper repeat to prevent stretching
    const stoneDark = createTexturedMaterial({
      baseColor: "#525860",
      accentColor: "#484e55",
      repeat: [FLOOR_REPEAT_X, FLOOR_REPEAT_Z],
      roughness: 0.72,
      metalness: 0.05,
      bumpScale: 0.35,
      noiseStrength: 32,
      veinCount: 25,
      grainBase: 140,
      grainVariance: 80,
    });
    const stoneTrim = createTexturedMaterial({
      baseColor: "#787e88",
      accentColor: "#606670",
      repeat: [12, 12],
      roughness: 0.68,
      metalness: 0.12,
      bumpScale: 0.2,
      noiseStrength: 22,
      veinCount: 12,
      grainBase: 135,
      grainVariance: 60,
    });
    const metal = createTexturedMaterial({
      baseColor: "#7a8088",
      accentColor: "#5a6068",
      repeat: [4, 4],
      roughness: 0.4,
      metalness: 0.75,
      bumpScale: 0.15,
      noiseStrength: 18,
      veinCount: 8,
      grainBase: 90,
      grainVariance: 90,
    });
    return {
      stone,
      stoneDark,
      stoneTrim,
      metal,
    };
  }, []);

  const columnPositions = useMemo(() => {
    // Column spacing - increased for better performance with larger room
    const columnSpacingX = SCALE(IS_MOBILE ? 56 : 40);  // Wider spacing on mobile
    const columnSpacingZ = SCALE(IS_MOBILE ? 50 : 35);
    
    // Calculate number of columns needed
    const numColumnsX = Math.floor((HALL_WIDTH - SCALE(16)) / columnSpacingX);
    const numColumnsZ = Math.floor((HALL_LENGTH - SCALE(20)) / columnSpacingZ);
    
    const positions = [];
    
    // Generate column positions symmetrically
    for (let xi = 0; xi < numColumnsX; xi++) {
      const xOffset = (numColumnsX - 1) * columnSpacingX / 2;
      const x = xi * columnSpacingX - xOffset;
      
      // Skip columns too close to center walkway
      if (Math.abs(x) < SCALE(10)) continue;
      
      for (let zi = 0; zi < numColumnsZ; zi++) {
        const zOffset = (numColumnsZ - 1) * columnSpacingZ / 2;
        const z = zi * columnSpacingZ - zOffset;
        positions.push([x, 0, z]);
      }
    }
    
    return positions;
  }, []);

  // Generate rib positions - reduced density on mobile
  const ribZPositions = useMemo(() => {
    const spacing = SCALE(IS_MOBILE ? 64 : 40);
    const count = Math.floor(HALL_LENGTH / spacing);
    const positions = [];
    for (let i = 0; i <= count; i++) {
      positions.push(i * spacing - HALL_LENGTH / 2 + spacing / 2);
    }
    return positions;
  }, []);
  
  // Generate beam positions - reduced on mobile
  const beamZPositions = useMemo(() => {
    const spacing = SCALE(IS_MOBILE ? 80 : 50);
    const count = Math.floor(HALL_LENGTH / spacing);
    const positions = [];
    for (let i = 0; i <= count; i++) {
      positions.push(i * spacing - HALL_LENGTH / 2 + spacing / 2);
    }
    return positions;
  }, []);
  
  // OPTIMIZED LIGHTING: Dramatically reduced light count
  // Instead of many lights, use fewer but more strategic placements
  const lightPositions = useMemo(() => {
    // Limit total lights based on quality preset
    const maxLights = QUALITY.maxLights;
    
    // Calculate optimal grid for available light budget
    // Reserve some lights for wall sconces
    const ceilingLightBudget = Math.floor(maxLights * 0.7);
    const wallLightBudget = maxLights - ceilingLightBudget;
    
    // Ceiling light grid
    const ceilingGridSize = Math.ceil(Math.sqrt(ceilingLightBudget));
    const ceilingSpacingX = HALL_WIDTH / (ceilingGridSize + 1);
    const ceilingSpacingZ = HALL_LENGTH / (ceilingGridSize + 1);
    
    const ceilingLights = [];
    for (let xi = 1; xi <= ceilingGridSize; xi++) {
      for (let zi = 1; zi <= ceilingGridSize; zi++) {
        if (ceilingLights.length >= ceilingLightBudget) break;
        const x = xi * ceilingSpacingX - HALL_WIDTH / 2;
        const z = zi * ceilingSpacingZ - HALL_LENGTH / 2;
        ceilingLights.push({ x, z });
      }
    }
    
    // Wall sconce lights - just a few along the length
    const wallLightSpacing = HALL_LENGTH / (Math.floor(wallLightBudget / 2) + 1);
    const wallLights = [];
    for (let i = 1; i <= Math.floor(wallLightBudget / 2); i++) {
      const z = i * wallLightSpacing - HALL_LENGTH / 2;
      wallLights.push(z);
    }
    
    return { ceilingLights, wallLights };
  }, []);
  
  const ceilingLightY = HALL_HEIGHT - SCALE(4);
  const wallLightY = SCALE(6);

  // Longitudinal beam positions - reduced on mobile
  const longBeamXPositions = useMemo(() => {
    const beamSpacing = SCALE(IS_MOBILE ? 50 : 30);
    const numBeams = Math.floor((HALL_WIDTH - SCALE(20)) / beamSpacing);
    const positions = [];
    for (let i = 0; i <= numBeams; i++) {
      positions.push(i * beamSpacing - (numBeams * beamSpacing) / 2);
    }
    return positions;
  }, []);

  return (
    <>
      {/* Fog for depth and to hide distant geometry - major mobile perf gain */}
      <fog attach="fog" args={["#1a1510", FOG_NEAR, FOG_FAR]} />
      
      {/* OPTIMIZED LIGHTING SYSTEM */}
      {/* Higher ambient to compensate for fewer point lights */}
      <ambientLight intensity={IS_MOBILE ? 1.8 : 1.4} color="#ffcc66" />
      
      {/* Hemisphere light for natural fill */}
      <hemisphereLight color="#ffdd88" groundColor="#553311" intensity={IS_MOBILE ? 1.2 : 0.9} />
      
      {/* Main directional light - shadows only on desktop */}
      <directionalLight
        position={[0, HALL_HEIGHT - SCALE(2), 0]}
        intensity={IS_MOBILE ? 2.5 : 2.0}
        color="#ffbb55"
        castShadow={QUALITY.shadowsEnabled}
        shadow-mapSize-width={QUALITY.shadowMapSize}
        shadow-mapSize-height={QUALITY.shadowMapSize}
        shadow-camera-near={1}
        shadow-camera-far={FOG_FAR}
        shadow-camera-left={-SCALE(100)}
        shadow-camera-right={SCALE(100)}
        shadow-camera-top={SCALE(100)}
        shadow-camera-bottom={-SCALE(100)}
        shadow-bias={-0.0005}
      />
      
      {/* Secondary fill light */}
      <directionalLight
        position={[-SCALE(10), SCALE(12), SCALE(20)]}
        intensity={IS_MOBILE ? 0.8 : 0.6}
        color="#ffaa44"
      />
      
      {/* OPTIMIZED: Limited ceiling point lights */}
      {lightPositions.ceilingLights.map((pos, i) => (
        <pointLight
          key={`ceiling-light-${i}`}
          position={[pos.x, ceilingLightY, pos.z]}
          intensity={IS_MOBILE ? 2000 : 1500}
          distance={QUALITY.lightDistance}
          decay={2}
          color="#ffaa33"
        />
      ))}
      
      {/* OPTIMIZED: Limited wall sconce lights */}
      {lightPositions.wallLights.map((z, i) => (
        <React.Fragment key={`wall-lights-${i}`}>
          <pointLight
            position={[-HALL_HALF_WIDTH + SCALE(2), wallLightY, z]}
            intensity={IS_MOBILE ? 800 : 500}
            distance={QUALITY.lightDistance * 0.5}
            decay={2}
            color="#ff9922"
          />
          <pointLight
            position={[HALL_HALF_WIDTH - SCALE(2), wallLightY, z]}
            intensity={IS_MOBILE ? 800 : 500}
            distance={QUALITY.lightDistance * 0.5}
            decay={2}
            color="#ff9922"
          />
        </React.Fragment>
      ))}
      
      {/* Emissive light fixtures - ONLY on desktop */}
      {QUALITY.enableEmissiveMeshes && lightPositions.ceilingLights.map((pos, i) => (
        <mesh key={`light-fixture-${i}`} position={[pos.x, ceilingLightY + SCALE(0.5), pos.z]}>
          <boxGeometry args={[SCALE(4), SCALE(0.3), SCALE(4)]} />
          <meshStandardMaterial
            color="#ffcc66"
            emissive="#ffaa33"
            emissiveIntensity={3}
            toneMapped={false}
          />
        </mesh>
      ))}
      
      {/* Emissive wall sconces - ONLY on desktop */}
      {QUALITY.enableEmissiveMeshes && lightPositions.wallLights.map((z, i) => (
        <React.Fragment key={`sconce-fixture-${i}`}>
          <mesh position={[-HALL_HALF_WIDTH + SCALE(1), wallLightY, z]}>
            <boxGeometry args={[SCALE(0.4), SCALE(1.5), SCALE(1)]} />
            <meshStandardMaterial
              color="#ffbb55"
              emissive="#ff9922"
              emissiveIntensity={2.5}
              toneMapped={false}
            />
          </mesh>
          <mesh position={[HALL_HALF_WIDTH - SCALE(1), wallLightY, z]}>
            <boxGeometry args={[SCALE(0.4), SCALE(1.5), SCALE(1)]} />
            <meshStandardMaterial
              color="#ffbb55"
              emissive="#ff9922"
              emissiveIntensity={2.5}
              toneMapped={false}
            />
          </mesh>
        </React.Fragment>
      ))}
      
      <group>
        {/* Floor */}
        <mesh position={[0, -FLOOR_THICKNESS / 2, 0]} receiveShadow={QUALITY.shadowsEnabled} material={materials.stoneDark}>
          <boxGeometry args={[HALL_WIDTH + SCALE(6), FLOOR_THICKNESS, HALL_LENGTH + SCALE(6)]} />
        </mesh>
        
        {/* Center floor trim - only on desktop */}
        {!IS_MOBILE && (
          <mesh position={[0, SCALE(0.06), 0]} receiveShadow material={materials.stoneTrim}>
            <boxGeometry args={[SCALE(6.5), SCALE(0.12), HALL_LENGTH - SCALE(12)]} />
          </mesh>
        )}
        
        {/* Ceiling */}
        <mesh
          position={[0, HALL_HEIGHT + CEILING_THICKNESS / 2, 0]}
          receiveShadow={QUALITY.shadowsEnabled}
          material={materials.stone}
        >
          <boxGeometry args={[HALL_WIDTH + SCALE(6), CEILING_THICKNESS, HALL_LENGTH + SCALE(6)]} />
        </mesh>
        
        {/* Walls */}
        <mesh
          position={[-HALL_HALF_WIDTH - WALL_THICKNESS / 2, HALL_HEIGHT / 2, 0]}
          receiveShadow={QUALITY.shadowsEnabled}
          material={materials.stone}
        >
          <boxGeometry args={[WALL_THICKNESS, HALL_HEIGHT, HALL_LENGTH]} />
        </mesh>
        <mesh
          position={[HALL_HALF_WIDTH + WALL_THICKNESS / 2, HALL_HEIGHT / 2, 0]}
          receiveShadow={QUALITY.shadowsEnabled}
          material={materials.stone}
        >
          <boxGeometry args={[WALL_THICKNESS, HALL_HEIGHT, HALL_LENGTH]} />
        </mesh>
        
        {/* Doorways */}
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
        
        {/* OPTIMIZED: Instanced columns instead of individual meshes */}
        <InstancedColumns
          positions={columnPositions}
          stoneMaterial={materials.stone}
          trimMaterial={materials.stoneTrim}
        />
        
        {/* Wall ribs - reduced on mobile */}
        <WallRibs side={-1} material={materials.stoneTrim} ribZPositions={ribZPositions} />
        <WallRibs side={1} material={materials.stoneTrim} ribZPositions={ribZPositions} />
        
        {/* Wall bands - only on desktop */}
        {!IS_MOBILE && (
          <>
            <WallBands side={-1} material={materials.stoneTrim} />
            <WallBands side={1} material={materials.stoneTrim} />
          </>
        )}
        
        {/* Cross beams */}
        {beamZPositions.map((z) => (
          <mesh
            key={`beam-${z}`}
            position={[0, HALL_HEIGHT - SCALE(0.6), z]}
            castShadow={QUALITY.shadowsEnabled}
            receiveShadow={QUALITY.shadowsEnabled}
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
            castShadow={QUALITY.shadowsEnabled}
            receiveShadow={QUALITY.shadowsEnabled}
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
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = IS_MOBILE ? 1.8 : 1.5;
    gl.outputColorSpace = THREE.SRGBColorSpace;
    
    // Log quality settings for debugging (remove in production)
    if (typeof console !== "undefined") {
      console.log(`[Scene] Quality mode: ${IS_MOBILE ? "MOBILE" : "DESKTOP"}`);
      console.log(`[Scene] Max lights: ${QUALITY.maxLights}, Shadows: ${QUALITY.shadowsEnabled}`);
    }
  }, [gl]);
  
  return null;
};

const Scene = ({ store, onSessionChange, onReady, flatControls, xrEnabled = true }) => {
  const handleCreated = useCallback((state) => {
    // Configure renderer on creation for proper lighting
    state.gl.toneMapping = THREE.ACESFilmicToneMapping;
    state.gl.toneMappingExposure = IS_MOBILE ? 1.8 : 1.5;  // Brighter on mobile to compensate
    state.gl.outputColorSpace = THREE.SRGBColorSpace;
    
    // Performance optimizations
    if (IS_MOBILE) {
      state.gl.powerPreference = "high-performance";
    }
    
    if (onReady) {
      onReady();
    }
  }, [onReady]);

  const flatActive = Boolean(flatControls?.active);

  return (
    <div className="vr-scene">
      <Canvas
        shadows={QUALITY.shadowsEnabled}
        onCreated={handleCreated}
        camera={{ position: [0, 1.6, 3], fov: 60, near: 0.1, far: RENDER_DISTANCE }}
        dpr={QUALITY.pixelRatio}  // Device pixel ratio capping
        gl={{ 
          antialias: QUALITY.antialias,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: IS_MOBILE ? 1.8 : 1.5,
          powerPreference: IS_MOBILE ? "high-performance" : "default",
        }}
        performance={{ min: 0.5 }}  // Allow frame rate throttling
      >
        <RendererConfig />
        {/* Background color matches fog for seamless fade */}
        <color attach="background" args={["#1a1510"]} />
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
