/**
 * VR Movement Rig
 * Handles VR controller input and XR reference space manipulation
 */
import React, { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useXR } from "@react-three/xr";
import * as THREE from "three";
import {
  MAX_SPEED,
  POSITION_LERP,
  UP,
} from "../constants.js";
import { applyDeadzone, clampToHall } from "../utils.js";

/**
 * MovementRig - VR locomotion using XR reference space offsetting
 */
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

    // Calculate movement direction based on camera orientation
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

    // Update XR reference space offset
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

    // Handle session end (both triggers pressed)
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

export default MovementRig;
