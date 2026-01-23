import React, { useCallback, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { XR, useXR } from "@react-three/xr";
import * as THREE from "three";

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
const HALL_WIDTH = SCALE(44);
const HALL_LENGTH = SCALE(110);
const HALL_HEIGHT = SCALE(16);
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
}) => {
  if (typeof document === "undefined") {
    return new THREE.MeshStandardMaterial({ color: baseColor, roughness, metalness });
  }

  const diffuseCanvas = createNoiseCanvas(256, baseColor, accentColor, noiseStrength, veinCount);
  const grainCanvas = createGrainCanvas(256, grainBase, grainVariance);
  const map = buildCanvasTexture(diffuseCanvas, repeat, true);
  const roughnessMap = buildCanvasTexture(grainCanvas, repeat, false);
  const bumpMap = buildCanvasTexture(grainCanvas, repeat, false);

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

const Column = ({ position, stoneMaterial, trimMaterial }) => {
  const baseHeight = SCALE(0.6);
  const ringHeight = SCALE(0.3);
  const capHeight = SCALE(0.8);
  const topHeight = SCALE(0.4);
  const columnClearance = SCALE(0.1);
  const totalHeight = Math.max(SCALE(6), HALL_HEIGHT - columnClearance);
  const shaftHeight = Math.max(
    SCALE(4),
    totalHeight - baseHeight - ringHeight - capHeight - topHeight
  );
  const shaftY = baseHeight + ringHeight + shaftHeight / 2;
  const capY = baseHeight + ringHeight + shaftHeight + capHeight / 2;
  const topY = baseHeight + ringHeight + shaftHeight + capHeight + topHeight / 2;
  const ringOffsets = [0.2, 0.5, 0.8].map((ratio) => ratio * shaftHeight);
  const shaftRadiusTop = SCALE(1.15);
  const shaftRadiusBottom = SCALE(1.25);

  return (
    <group position={position}>
      <mesh position={[0, baseHeight / 2, 0]} castShadow receiveShadow material={stoneMaterial}>
        <cylinderGeometry args={[SCALE(1.6), SCALE(1.8), baseHeight, 24]} />
      </mesh>
      <mesh position={[0, baseHeight + ringHeight / 2, 0]} castShadow receiveShadow material={trimMaterial}>
        <cylinderGeometry args={[SCALE(1.45), SCALE(1.6), ringHeight, 24]} />
      </mesh>
      <mesh position={[0, shaftY, 0]} castShadow receiveShadow material={stoneMaterial}>
        <cylinderGeometry args={[shaftRadiusTop, shaftRadiusBottom, shaftHeight, 32]} />
      </mesh>
      {ringOffsets.map((offset) => (
        <mesh
          key={`ring-${position[0]}-${position[2]}-${offset}`}
          position={[0, baseHeight + ringHeight + offset, 0]}
          castShadow
          receiveShadow
          material={trimMaterial}
        >
          <cylinderGeometry args={[SCALE(1.28), SCALE(1.28), SCALE(0.12), 24]} />
        </mesh>
      ))}
      <mesh position={[0, capY, 0]} castShadow receiveShadow material={trimMaterial}>
        <boxGeometry args={[SCALE(2.6), capHeight, SCALE(2.6)]} />
      </mesh>
      <mesh position={[0, topY, 0]} castShadow receiveShadow material={trimMaterial}>
        <boxGeometry args={[SCALE(2.9), topHeight, SCALE(2.9)]} />
      </mesh>
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
        <boxGeometry args={[SCALE(1), SCALE(1.2), HALL_LENGTH - SCALE(4)]} />
      </mesh>
      <mesh position={[x, SCALE(7.4), 0]} castShadow receiveShadow material={material}>
        <boxGeometry args={[SCALE(1), SCALE(0.6), HALL_LENGTH - SCALE(4)]} />
      </mesh>
      <mesh position={[x, SCALE(10.2), 0]} castShadow receiveShadow material={material}>
        <boxGeometry args={[SCALE(0.8), SCALE(0.5), HALL_LENGTH - SCALE(8)]} />
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
    // BRIGHTENED material colors - original colors were too dark (#3a3f45 etc.)
    // absorbing most light. Increased base colors by ~40-60% luminance.
    const stone = createTexturedMaterial({
      baseColor: "#6a7078",
      accentColor: "#5a6068",
      repeat: [4, 4],
      roughness: 0.75,
      metalness: 0.08,
      bumpScale: 0.25,
      noiseStrength: 30,
      veinCount: 20,
      grainBase: 150,
      grainVariance: 70,
    });
    const stoneDark = createTexturedMaterial({
      baseColor: "#525860",
      accentColor: "#484e55",
      repeat: [6, 6],
      roughness: 0.72,
      metalness: 0.05,
      bumpScale: 0.3,
      noiseStrength: 26,
      veinCount: 14,
      grainBase: 140,
      grainVariance: 80,
    });
    const stoneTrim = createTexturedMaterial({
      baseColor: "#787e88",
      accentColor: "#606670",
      repeat: [3, 3],
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
      repeat: [2, 2],
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
    const xs = [-14, 14].map(SCALE);
    const zs = [-40, -15, 15, 40].map(SCALE);
    const positions = [];
    xs.forEach((x) => {
      zs.forEach((z) => {
        positions.push([x, 0, z]);
      });
    });
    return positions;
  }, []);

  const ribZPositions = useMemo(() => [-48, -32, -16, 0, 16, 32, 48].map(SCALE), []);
  const beamZPositions = useMemo(() => [-40, -20, 0, 20, 40].map(SCALE), []);
  // More ceiling lights spread throughout the hall for even coverage
  const ceilingLightZPositions = useMemo(() => [-45, -30, -15, 0, 15, 30, 45].map(SCALE), []);
  // Lower the ceiling lights to get better coverage (was too close to ceiling)
  const ceilingLightY = HALL_HEIGHT - SCALE(4);
  // Wall sconce positions for additional fill lighting
  const wallLightZPositions = useMemo(() => [-40, -20, 0, 20, 40].map(SCALE), []);
  const wallLightY = SCALE(6);

  return (
    <>
      {/* SIGNIFICANTLY increased ambient light - interior spaces need strong ambient
          Original 0.45 was far too low for an enclosed hall with dark materials */}
      <ambientLight intensity={1.8} />
      
      {/* Increased hemisphere light for better sky/ground color blending */}
      <hemisphereLight color="#fff5e6" groundColor="#4a4540" intensity={1.2} />
      
      {/* Directional light repositioned INSIDE the hall space, angled down
          Original position was outside the walls, light couldn't enter */}
      <directionalLight
        position={[0, HALL_HEIGHT - SCALE(2), 0]}
        intensity={2.5}
        color="#fff8f0"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={SCALE(120)}
        shadow-camera-left={-HALL_HALF_WIDTH}
        shadow-camera-right={HALL_HALF_WIDTH}
        shadow-camera-top={HALL_HALF_LENGTH}
        shadow-camera-bottom={-HALL_HALF_LENGTH}
        shadow-bias={-0.0001}
      />
      
      {/* Secondary directional for fill - reduces harsh shadows */}
      <directionalLight
        position={[-SCALE(10), SCALE(12), SCALE(20)]}
        intensity={0.8}
        color="#e8f0ff"
      />
      
      {/* MASSIVELY increased point light intensity - original 0.9 with decay=2
          meant essentially zero light reached the floor in this huge space.
          Physical light units: a 100W bulb ~1600 lumens. We need much higher
          values for a space this large (550 units long, 80 units high) */}
      {ceilingLightZPositions.map((z) => (
        <pointLight
          key={`ceiling-light-${z}`}
          position={[0, ceilingLightY, z]}
          intensity={800}
          distance={SCALE(100)}
          decay={2}
          color="#fff0dd"
        />
      ))}
      
      {/* Additional row of ceiling lights along the sides for better coverage */}
      {ceilingLightZPositions.map((z) => (
        <React.Fragment key={`side-lights-${z}`}>
          <pointLight
            position={[-SCALE(12), ceilingLightY, z]}
            intensity={400}
            distance={SCALE(80)}
            decay={2}
            color="#fff0dd"
          />
          <pointLight
            position={[SCALE(12), ceilingLightY, z]}
            intensity={400}
            distance={SCALE(80)}
            decay={2}
            color="#fff0dd"
          />
        </React.Fragment>
      ))}
      
      {/* Wall sconce lights - warm fill light at eye level */}
      {wallLightZPositions.map((z) => (
        <React.Fragment key={`wall-lights-${z}`}>
          <pointLight
            position={[-HALL_HALF_WIDTH + SCALE(2), wallLightY, z]}
            intensity={200}
            distance={SCALE(40)}
            decay={2}
            color="#ffddaa"
          />
          <pointLight
            position={[HALL_HALF_WIDTH - SCALE(2), wallLightY, z]}
            intensity={200}
            distance={SCALE(40)}
            decay={2}
            color="#ffddaa"
          />
        </React.Fragment>
      ))}
      
      {/* Emissive ceiling light fixtures - visible glowing panels */}
      {ceilingLightZPositions.map((z) => (
        <mesh key={`light-fixture-${z}`} position={[0, ceilingLightY + SCALE(0.5), z]}>
          <boxGeometry args={[SCALE(4), SCALE(0.3), SCALE(4)]} />
          <meshStandardMaterial
            color="#fff8ee"
            emissive="#fff0dd"
            emissiveIntensity={3}
            toneMapped={false}
          />
        </mesh>
      ))}
      
      {/* Emissive wall sconce fixtures */}
      {wallLightZPositions.map((z) => (
        <React.Fragment key={`sconce-fixture-${z}`}>
          <mesh position={[-HALL_HALF_WIDTH + SCALE(1), wallLightY, z]}>
            <boxGeometry args={[SCALE(0.4), SCALE(1.5), SCALE(1)]} />
            <meshStandardMaterial
              color="#fff0dd"
              emissive="#ffddaa"
              emissiveIntensity={2}
              toneMapped={false}
            />
          </mesh>
          <mesh position={[HALL_HALF_WIDTH - SCALE(1), wallLightY, z]}>
            <boxGeometry args={[SCALE(0.4), SCALE(1.5), SCALE(1)]} />
            <meshStandardMaterial
              color="#fff0dd"
              emissive="#ffddaa"
              emissiveIntensity={2}
              toneMapped={false}
            />
          </mesh>
        </React.Fragment>
      ))}
      <group>
        <mesh position={[0, -FLOOR_THICKNESS / 2, 0]} receiveShadow material={materials.stoneDark}>
          <boxGeometry args={[HALL_WIDTH + SCALE(6), FLOOR_THICKNESS, HALL_LENGTH + SCALE(6)]} />
        </mesh>
        <mesh position={[0, SCALE(0.06), 0]} receiveShadow material={materials.stoneTrim}>
          <boxGeometry args={[SCALE(6.5), SCALE(0.12), HALL_LENGTH - SCALE(12)]} />
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
        {columnPositions.map((position, index) => (
          <Column
            key={`column-${index}`}
            position={position}
            stoneMaterial={materials.stone}
            trimMaterial={materials.stoneTrim}
          />
        ))}
        <WallRibs side={-1} material={materials.stoneTrim} ribZPositions={ribZPositions} />
        <WallRibs side={1} material={materials.stoneTrim} ribZPositions={ribZPositions} />
        <WallBands side={-1} material={materials.stoneTrim} />
        <WallBands side={1} material={materials.stoneTrim} />
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
        {[-10, 0, 10].map(SCALE).map((x) => (
          <mesh
            key={`long-beam-${x}`}
            position={[x, HALL_HEIGHT - SCALE(0.9), 0]}
            castShadow
            receiveShadow
            material={materials.stoneTrim}
          >
            <boxGeometry args={[SCALE(1.2), SCALE(0.6), HALL_LENGTH - SCALE(8)]} />
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

  return (
    <div className="vr-scene">
      <Canvas
        shadows
        onCreated={handleCreated}
        camera={{ position: [0, 1.6, 3], fov: 60, near: 0.1, far: 200 }}
        gl={{ 
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.5,
        }}
      >
        <RendererConfig />
        {/* Lighter background color - dark backgrounds make scenes feel darker */}
        <color attach="background" args={["#1a1815"]} />
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
