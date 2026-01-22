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

const applyDeadzone = (value) => (Math.abs(value) < DEADZONE ? 0 : value);

const clampAxis = (value) => Math.min(1, Math.max(-1, value));

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

  return <pointLight ref={lightRef} position={[0, 1.6, 0]} />;
};

const World = () => {
  return (
    <>
      <ambientLight intensity={0.35} />
      <HeadLight />
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

    const lerpAlpha = 1 - Math.exp(-delta * POSITION_LERP);
    currentPosition.current.lerp(targetPosition.current, lerpAlpha);
    currentPosition.current.y = CAMERA_HEIGHT;

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
      <Canvas onCreated={handleCreated} camera={{ position: [0, 1.6, 3], fov: 60 }}>
        <color attach="background" args={["#0a0d18"]} />
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
