/**
 * VR Session World
 * Manages multiplayer state and VR interactions
 */
import React, { useCallback, useMemo, useRef } from "react";
import * as THREE from "three";
import { Enemy } from "../../Combat.jsx";
import { useMultiplayer, useEnemyFaceTextures } from "../hooks/index.js";
import { MovementRig } from "../controls/index.js";
import { AVATAR_HEIGHT } from "../constants.js";
import RemoteAvatar from "./RemoteAvatar.jsx";
import { useVRCombatSync } from "../../../xrStore.jsx";

/**
 * SessionWorld - VR session with multiplayer and combat
 * 
 * Note: The VR sword is rendered directly inside the right controller model
 * (see xrStore.jsx). Combat callbacks are synced via useVRCombatSync hook,
 * which uses a module-level state to communicate with the controller model
 * since it's rendered outside our component tree by @react-three/xr.
 */
const SessionWorld = () => {
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

  const handleAttack = useCallback(
    (enemyId) => {
      sendAttack(enemyId);
    },
    [sendAttack]
  );

  // Sync combat state to the VR sword component (rendered in controller model)
  useVRCombatSync(handleAttack, enemies);

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
      
      {/* VR Sword is rendered inside the right controller model - see xrStore.jsx */}
      <MovementRig onMove={handleMove} />
    </>
  );
};

export default SessionWorld;
