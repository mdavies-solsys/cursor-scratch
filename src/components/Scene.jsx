import React, { useCallback, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { XR, useXR } from "@react-three/xr";
import * as THREE from "three";

const DEADZONE = 0.1;
const MAX_SPEED = 3;
const SYNC_INTERVAL = 50;
const POSITION_LERP = 10;
const REMOTE_LERP = 8;
const AVATAR_HEIGHT = 0.9;

const applyDeadzone = (value) => (Math.abs(value) < DEADZONE ? 0 : value);

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
  const localColorRef = useRef(null);
  const lastSentRef = useRef(0);

  React.useEffect(() => {
    const socket = new WebSocket(resolveWsUrl());
    socketRef.current = socket;

    socket.addEventListener("message", (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "welcome") {
          localIdRef.current = payload.id;
          localColorRef.current = payload.color;
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

  return { players, localIdRef, localColorRef, sendMove };
};

const World = () => {
  return (
    <>
      <pointLight position={[0, 1.6, 0]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[50, 50]} />
        <meshStandardMaterial color="#cccccc" />
      </mesh>
      <mesh position={[0, 1, 0]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={0.5} />
      </mesh>
    </>
  );
};

const MovementRig = ({ onMove }) => {
  const inputSourceStates = useXR((state) => state.inputSourceStates);
  const { gl, camera } = useThree();
  const baseRefSpace = useRef(null);
  const currentPosition = useRef(new THREE.Vector3());
  const targetPosition = useRef(new THREE.Vector3());
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

    const direction = new THREE.Vector3(axisX, 0, axisY);
    if (direction.lengthSq() > 1) {
      direction.normalize();
    }
    const velocity = direction.multiplyScalar(MAX_SPEED * delta);
    targetPosition.current.add(velocity);

    const lerpAlpha = 1 - Math.exp(-delta * POSITION_LERP);
    currentPosition.current.lerp(targetPosition.current, lerpAlpha);

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

const LocalAvatar = ({ color, poseRef }) => {
  const meshRef = useRef(null);
  const fallbackColor = useMemo(() => {
    const hue = Math.random();
    return new THREE.Color().setHSL(hue, 0.7, 0.55);
  }, []);
  const avatarColor = color ? new THREE.Color(color) : fallbackColor;

  useFrame(() => {
    if (!meshRef.current || !poseRef.current) {
      return;
    }
    meshRef.current.position.copy(poseRef.current.position);
    meshRef.current.quaternion.copy(poseRef.current.quaternion);
  });

  return (
    <mesh ref={meshRef}>
      <capsuleGeometry args={[0.25, 1, 4, 8]} />
      <meshStandardMaterial color={avatarColor} />
    </mesh>
  );
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

const Scene = ({ store }) => {
  const { players, localIdRef, localColorRef, sendMove } = useMultiplayer();
  const localPoseRef = useRef({
    position: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
  });
  const sendPositionRef = useRef(new THREE.Vector3(0, AVATAR_HEIGHT, 0));

  const remotePlayers = useMemo(
    () => players.filter((player) => player.id && player.id !== localIdRef.current),
    [players]
  );
  const localPlayer = players.find((player) => player.id === localIdRef.current);
  const localColor = localPlayer?.color || localColorRef.current;

  const handleMove = useCallback(
    (position, quaternion) => {
      sendPositionRef.current.set(position.x, AVATAR_HEIGHT, position.z);
      localPoseRef.current.position.copy(sendPositionRef.current);
      localPoseRef.current.quaternion.copy(quaternion);
      sendMove(sendPositionRef.current, quaternion);
    },
    [sendMove]
  );

  return (
    <div className="vr-scene">
      <Canvas>
        <XR store={store}>
          <World />
          <LocalAvatar color={localColor} poseRef={localPoseRef} />
          {remotePlayers.map((player) => (
            <RemoteAvatar
              key={player.id}
              color={player.color}
              position={player.position || { x: 0, y: AVATAR_HEIGHT, z: 0 }}
              rotation={player.rotation || { x: 0, y: 0, z: 0, w: 1 }}
            />
          ))}
          <MovementRig onMove={handleMove} />
        </XR>
      </Canvas>
    </div>
  );
};

export default Scene;
