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
const HALL_WIDTH = 44;
const HALL_LENGTH = 110;
const HALL_HEIGHT = 16;
const WALL_THICKNESS = 1.6;
const FLOOR_THICKNESS = 1.2;
const CEILING_THICKNESS = 1.1;
const DOOR_WIDTH = 12;
const DOOR_HEIGHT = 10;
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

const HeadLight = () => {
  const lightRef = useRef(null);
  const { camera } = useThree();

  useFrame(() => {
    if (!lightRef.current) {
      return;
    }
    lightRef.current.position.copy(camera.position);
  });

  return (
    <pointLight
      ref={lightRef}
      position={[0, 1.6, 0]}
      intensity={0.6}
      distance={18}
      decay={2}
      color="#f4d3a8"
    />
  );
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
  const baseHeight = 0.6;
  const ringHeight = 0.3;
  const shaftHeight = 7.6;
  const capHeight = 0.8;
  const topHeight = 0.4;
  const shaftY = baseHeight + ringHeight + shaftHeight / 2;
  const capY = baseHeight + ringHeight + shaftHeight + capHeight / 2;
  const topY = baseHeight + ringHeight + shaftHeight + capHeight + topHeight / 2;
  const ringOffsets = [1.4, 3.6, 5.8];

  return (
    <group position={position}>
      <mesh position={[0, baseHeight / 2, 0]} castShadow receiveShadow material={stoneMaterial}>
        <cylinderGeometry args={[1.6, 1.8, baseHeight, 24]} />
      </mesh>
      <mesh position={[0, baseHeight + ringHeight / 2, 0]} castShadow receiveShadow material={trimMaterial}>
        <cylinderGeometry args={[1.45, 1.6, ringHeight, 24]} />
      </mesh>
      <mesh position={[0, shaftY, 0]} castShadow receiveShadow material={stoneMaterial}>
        <cylinderGeometry args={[1.15, 1.25, shaftHeight, 32]} />
      </mesh>
      {ringOffsets.map((offset) => (
        <mesh
          key={`ring-${position[0]}-${position[2]}-${offset}`}
          position={[0, baseHeight + ringHeight + offset, 0]}
          castShadow
          receiveShadow
          material={trimMaterial}
        >
          <cylinderGeometry args={[1.28, 1.28, 0.12, 24]} />
        </mesh>
      ))}
      <mesh position={[0, capY, 0]} castShadow receiveShadow material={trimMaterial}>
        <boxGeometry args={[2.6, capHeight, 2.6]} />
      </mesh>
      <mesh position={[0, topY, 0]} castShadow receiveShadow material={trimMaterial}>
        <boxGeometry args={[2.9, topHeight, 2.9]} />
      </mesh>
    </group>
  );
};

const WallRibs = ({ side, material, ribZPositions }) => {
  const x = side * (HALL_HALF_WIDTH - 0.45);
  return (
    <group>
      {ribZPositions.map((z) => (
        <group key={`rib-${side}-${z}`} position={[x, 0, z]}>
          <mesh position={[0, 3.2, 0]} castShadow receiveShadow material={material}>
            <boxGeometry args={[0.9, 6.4, 1.8]} />
          </mesh>
          <mesh position={[0, 6.6, 0]} castShadow receiveShadow material={material}>
            <boxGeometry args={[1.2, 0.6, 2.2]} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

const WallBands = ({ side, material }) => {
  const x = side * (HALL_HALF_WIDTH - 0.6);
  return (
    <group>
      <mesh position={[x, 1.1, 0]} castShadow receiveShadow material={material}>
        <boxGeometry args={[1, 1.2, HALL_LENGTH - 4]} />
      </mesh>
      <mesh position={[x, 7.4, 0]} castShadow receiveShadow material={material}>
        <boxGeometry args={[1, 0.6, HALL_LENGTH - 4]} />
      </mesh>
      <mesh position={[x, 10.2, 0]} castShadow receiveShadow material={material}>
        <boxGeometry args={[0.8, 0.5, HALL_LENGTH - 8]} />
      </mesh>
    </group>
  );
};

const Doorway = ({ z, rotation, stoneMaterial, trimMaterial, metalMaterial }) => {
  const sideWidth = (HALL_WIDTH - DOOR_WIDTH) / 2;
  const lintelHeight = HALL_HEIGHT - DOOR_HEIGHT;
  const frameWidth = 0.8;
  const frameDepth = WALL_THICKNESS + 0.4;
  const doorPanelWidth = DOOR_WIDTH / 2 - 0.8;
  const doorPanelHeight = DOOR_HEIGHT - 0.4;
  const doorPanelDepth = 0.4;
  const swing = Math.PI * 0.6;
  const voidDepth = 22;

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
      <mesh position={[-DOOR_WIDTH / 2 + frameWidth / 2, DOOR_HEIGHT / 2, 0.2]} material={trimMaterial} castShadow receiveShadow>
        <boxGeometry args={[frameWidth, DOOR_HEIGHT, frameDepth]} />
      </mesh>
      <mesh position={[DOOR_WIDTH / 2 - frameWidth / 2, DOOR_HEIGHT / 2, 0.2]} material={trimMaterial} castShadow receiveShadow>
        <boxGeometry args={[frameWidth, DOOR_HEIGHT, frameDepth]} />
      </mesh>
      <mesh position={[0, DOOR_HEIGHT - 0.2, 0.2]} material={trimMaterial} castShadow receiveShadow>
        <boxGeometry args={[DOOR_WIDTH - frameWidth * 2, 0.5, frameDepth]} />
      </mesh>
      <group position={[-DOOR_WIDTH / 2 + frameWidth, 0, 0.4]} rotation={[0, swing, 0]}>
        <mesh position={[doorPanelWidth / 2, doorPanelHeight / 2, 0]} material={metalMaterial} castShadow receiveShadow>
          <boxGeometry args={[doorPanelWidth, doorPanelHeight, doorPanelDepth]} />
        </mesh>
      </group>
      <group position={[DOOR_WIDTH / 2 - frameWidth, 0, 0.4]} rotation={[0, -swing, 0]}>
        <mesh position={[-doorPanelWidth / 2, doorPanelHeight / 2, 0]} material={metalMaterial} castShadow receiveShadow>
          <boxGeometry args={[doorPanelWidth, doorPanelHeight, doorPanelDepth]} />
        </mesh>
      </group>
      <mesh position={[0, DOOR_HEIGHT / 2, -WALL_THICKNESS / 2 - voidDepth / 2]} castShadow={false}>
        <boxGeometry args={[DOOR_WIDTH - 1, DOOR_HEIGHT, voidDepth]} />
        <meshBasicMaterial color="#000000" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 0.1, 1.8]} material={trimMaterial} receiveShadow>
        <boxGeometry args={[DOOR_WIDTH + 2, 0.2, 3]} />
      </mesh>
    </group>
  );
};

const World = () => {
  const materials = useMemo(() => {
    const stone = createTexturedMaterial({
      baseColor: "#3a3f45",
      accentColor: "#2b2f33",
      repeat: [4, 4],
      roughness: 0.92,
      metalness: 0.08,
      bumpScale: 0.25,
      noiseStrength: 30,
      veinCount: 20,
      grainBase: 150,
      grainVariance: 70,
    });
    const stoneDark = createTexturedMaterial({
      baseColor: "#2a2e33",
      accentColor: "#23272c",
      repeat: [6, 6],
      roughness: 0.9,
      metalness: 0.05,
      bumpScale: 0.3,
      noiseStrength: 26,
      veinCount: 14,
      grainBase: 140,
      grainVariance: 80,
    });
    const stoneTrim = createTexturedMaterial({
      baseColor: "#474d54",
      accentColor: "#32363c",
      repeat: [3, 3],
      roughness: 0.85,
      metalness: 0.12,
      bumpScale: 0.2,
      noiseStrength: 22,
      veinCount: 12,
      grainBase: 135,
      grainVariance: 60,
    });
    const metal = createTexturedMaterial({
      baseColor: "#4a4e54",
      accentColor: "#2a2d31",
      repeat: [2, 2],
      roughness: 0.45,
      metalness: 0.8,
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
    const xs = [-14, 14];
    const zs = [-40, -15, 15, 40];
    const positions = [];
    xs.forEach((x) => {
      zs.forEach((z) => {
        positions.push([x, 0, z]);
      });
    });
    return positions;
  }, []);

  const ribZPositions = useMemo(() => [-48, -32, -16, 0, 16, 32, 48], []);
  const beamZPositions = useMemo(() => [-40, -20, 0, 20, 40], []);
  const lightZPositions = useMemo(() => [-45, -30, -15, 0, 15, 30, 45], []);
  const sideLightXPositions = useMemo(() => [-12, 12], []);
  const floorLightZPositions = useMemo(() => [-40, -20, 0, 20, 40], []);
  const floorLightXPositions = useMemo(() => [-16, 16], []);

  return (
    <>
      <fog attach="fog" args={["#15110e", 28, 170]} />
      <ambientLight intensity={0.7} />
      <hemisphereLight color="#f7e1c7" groundColor="#2c2521" intensity={0.85} />
      <directionalLight
        position={[18, 24, 14]}
        intensity={1.2}
        color="#f6d8b6"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={110}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
      />
      {lightZPositions.map((z) => (
        <pointLight
          key={`hall-light-${z}`}
          position={[0, 9.6, z]}
          intensity={1.35}
          distance={34}
          decay={2}
          color="#f6d3a8"
        />
      ))}
      {sideLightXPositions.map((x) => (
        <group key={`side-light-row-${x}`}>
          {lightZPositions.map((z) => (
            <pointLight
              key={`side-light-${x}-${z}`}
              position={[x, 7.2, z]}
              intensity={0.75}
              distance={26}
              decay={2}
              color="#f2c89a"
            />
          ))}
        </group>
      ))}
      {floorLightXPositions.map((x) => (
        <group key={`floor-light-row-${x}`}>
          {floorLightZPositions.map((z) => (
            <pointLight
              key={`floor-light-${x}-${z}`}
              position={[x, 2.6, z]}
              intensity={0.55}
              distance={18}
              decay={2}
              color="#f7dcbc"
            />
          ))}
        </group>
      ))}
      <HeadLight />
      <group>
        <mesh position={[0, -FLOOR_THICKNESS / 2, 0]} receiveShadow material={materials.stoneDark}>
          <boxGeometry args={[HALL_WIDTH + 6, FLOOR_THICKNESS, HALL_LENGTH + 6]} />
        </mesh>
        <mesh position={[0, 0.06, 0]} receiveShadow material={materials.stoneTrim}>
          <boxGeometry args={[6.5, 0.12, HALL_LENGTH - 12]} />
        </mesh>
        <mesh
          position={[0, HALL_HEIGHT + CEILING_THICKNESS / 2, 0]}
          receiveShadow
          material={materials.stone}
        >
          <boxGeometry args={[HALL_WIDTH + 6, CEILING_THICKNESS, HALL_LENGTH + 6]} />
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
            position={[0, HALL_HEIGHT - 0.6, z]}
            castShadow
            receiveShadow
            material={materials.stoneTrim}
          >
            <boxGeometry args={[HALL_WIDTH - 2, 0.5, 1.6]} />
          </mesh>
        ))}
        {[-10, 0, 10].map((x) => (
          <mesh
            key={`long-beam-${x}`}
            position={[x, HALL_HEIGHT - 0.9, 0]}
            castShadow
            receiveShadow
            material={materials.stoneTrim}
          >
            <boxGeometry args={[1.2, 0.6, HALL_LENGTH - 8]} />
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

const Scene = ({ store, onSessionChange, onReady, flatControls, xrEnabled = true }) => {
  const handleCreated = useCallback(() => {
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
      >
        <color attach="background" args={["#15110e"]} />
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
