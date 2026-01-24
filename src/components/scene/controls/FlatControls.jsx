/**
 * Flat (Non-VR) Controls
 * Keyboard, mouse, gamepad, and touch controls for desktop/mobile
 */
import React, { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  MAX_SPEED,
  LOOK_SPEED,
  MOUSE_SENSITIVITY,
  CAMERA_HEIGHT,
  MAX_PITCH,
  POSITION_LERP,
  UP,
  ZERO_AXIS,
} from "../constants.js";
import { applyDeadzone, clampAxis, clampToHall, getPrimaryGamepad } from "../utils.js";

/**
 * FlatControls - Desktop/mobile first-person controls
 */
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
      if (!action) return;
      keysRef.current[action] = pressed;
    };

    const handleKeyDown = (event) => handleKey(event, true);
    const handleKeyUp = (event) => handleKey(event, false);
    const handleBlur = () => {
      keysRef.current = { forward: false, backward: false, left: false, right: false };
    };

    const handleMouseMove = (event) => {
      if (!enablePointerLock) return;
      if (document.pointerLockElement !== gl.domElement) return;
      mouseDeltaRef.current.x += event.movementX;
      mouseDeltaRef.current.y += event.movementY;
    };

    const handlePointerDown = () => {
      if (!enablePointerLock) return;
      if (document.pointerLockElement === gl.domElement) return;
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
    // Initialize position on first frame
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

    // Gather input from all sources
    const leftAxis = leftAxisRef?.current ?? ZERO_AXIS;
    const rightAxis = rightAxisRef?.current ?? ZERO_AXIS;
    const gamepad = getPrimaryGamepad();
    const axes = gamepad?.axes ?? [];
    const gpLX = applyDeadzone(axes[0] ?? 0);
    const gpLY = applyDeadzone(axes[1] ?? 0);
    const gpRX = applyDeadzone(axes[2] ?? 0);
    const gpRY = applyDeadzone(axes[3] ?? 0);

    // Combine keyboard and gamepad input
    const keyboardX = (keysRef.current.right ? 1 : 0) - (keysRef.current.left ? 1 : 0);
    const keyboardY = (keysRef.current.backward ? 1 : 0) - (keysRef.current.forward ? 1 : 0);
    const moveX = clampAxis(keyboardX + leftAxis.x + gpLX);
    const moveY = clampAxis(keyboardY + leftAxis.y + gpLY);

    // Look input (mouse + gamepad + touch)
    const lookX = applyDeadzone(clampAxis(rightAxis.x + gpRX));
    const lookY = applyDeadzone(clampAxis(rightAxis.y + gpRY));
    const mouseDelta = mouseDeltaRef.current;

    // Apply mouse look
    yawRef.current -= mouseDelta.x * MOUSE_SENSITIVITY;
    pitchRef.current -= mouseDelta.y * MOUSE_SENSITIVITY;
    mouseDeltaRef.current.x = 0;
    mouseDeltaRef.current.y = 0;

    // Apply gamepad/touch look
    yawRef.current -= lookX * LOOK_SPEED * delta;
    pitchRef.current -= lookY * LOOK_SPEED * delta;
    pitchRef.current = THREE.MathUtils.clamp(pitchRef.current, -MAX_PITCH, MAX_PITCH);

    camera.rotation.set(pitchRef.current, yawRef.current, 0, "YXZ");

    // Calculate movement direction
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

    // Apply movement
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

export default FlatControls;
