/**
 * Flat (Non-VR) Session World
 * Manages multiplayer state and desktop/mobile interactions
 */
import React, { useCallback, useMemo, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Enemy, FlatSword, useAttackInput, useRaycastAttack } from "../../Combat.jsx";
import { useMultiplayer, useEnemyFaceTextures } from "../hooks/index.js";
import { FlatControls } from "../controls/index.js";
import { AVATAR_HEIGHT } from "../constants.js";
import RemoteAvatar from "./RemoteAvatar.jsx";

/**
 * FlatSessionWorld - Desktop/mobile session with multiplayer and combat
 */
const FlatSessionWorld = ({ leftAxisRef, rightAxisRef, enablePointerLock, isMobile }) => {
  const { camera } = useThree();
  const { players, enemies, localIdRef, sendMove, sendAttack } = useMultiplayer();
  const sendPositionRef = useRef(new THREE.Vector3(0, AVATAR_HEIGHT, 0));
  const faceTextures = useEnemyFaceTextures();

  const remotePlayers = useMemo(
    () => players.filter((player) => player.id && player.id !== localIdRef.current),
    [players, localIdRef]
  );
  
  const handleMove = useCallback(
    (position, quaternion) => {
      sendPositionRef.current.set(position.x, AVATAR_HEIGHT, position.z);
      sendMove(sendPositionRef.current, quaternion);
    },
    [sendMove]
  );

  // Raycast attack handler
  const performRaycastAttack = useRaycastAttack(camera, enemies, sendAttack);
  
  // Attack input handling
  const { isAttacking } = useAttackInput(isMobile, false, performRaycastAttack);

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
      
      {/* Enemies */}
      {enemies.map((enemy) => (
        <Enemy
          key={enemy.id}
          id={enemy.id}
          x={enemy.x}
          y={enemy.y}
          z={enemy.z}
          alive={enemy.alive}
          faceIndex={enemy.faceIndex}
          faceTextures={faceTextures}
        />
      ))}
      
      {/* FPS-style sword */}
      <FlatSword onAttack={sendAttack} isAttacking={isAttacking} />
      
      <FlatControls
        onMove={handleMove}
        leftAxisRef={leftAxisRef}
        rightAxisRef={rightAxisRef}
        enablePointerLock={enablePointerLock}
      />
    </>
  );
};

export default FlatSessionWorld;
