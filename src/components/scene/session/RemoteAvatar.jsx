/**
 * Remote Player Avatar
 * Represents other players in the multiplayer session
 */
import React, { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { REMOTE_LERP, AVATAR_HEIGHT } from "../constants.js";

/**
 * RemoteAvatar - Smoothly interpolated avatar for remote players
 */
const RemoteAvatar = ({ color, position, rotation }) => {
  const meshRef = useRef(null);
  const targetPosition = useRef(new THREE.Vector3());
  const targetQuaternion = useRef(new THREE.Quaternion());

  useEffect(() => {
    const safeY = Number.isFinite(position.y) ? position.y : AVATAR_HEIGHT;
    targetPosition.current.set(position.x, safeY, position.z);
    targetQuaternion.current.set(rotation.x, rotation.y, rotation.z, rotation.w);
  }, [position, rotation]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    
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

export default RemoteAvatar;
