/**
 * Multiplayer WebSocket hook
 * Handles connection, state synchronization, and player interactions
 */
import { useCallback, useRef, useState, useEffect } from "react";
import { resolveWsUrl } from "../utils.js";
import { SYNC_INTERVAL } from "../constants.js";

/**
 * Hook for multiplayer game state via WebSocket
 * @returns {Object} - { players, enemies, localIdRef, sendMove, sendAttack }
 */
export const useMultiplayer = () => {
  const [players, setPlayers] = useState([]);
  const [enemies, setEnemies] = useState([]);
  const socketRef = useRef(null);
  const localIdRef = useRef(null);
  const lastSentRef = useRef(0);

  useEffect(() => {
    const socket = new WebSocket(resolveWsUrl());
    socketRef.current = socket;

    socket.addEventListener("message", (event) => {
      try {
        const payload = JSON.parse(event.data);
        
        if (payload.type === "welcome") {
          localIdRef.current = payload.id;
          setPlayers(Array.isArray(payload.players) ? payload.players : []);
          setEnemies(Array.isArray(payload.enemies) ? payload.enemies : []);
          return;
        }
        
        if (payload.type === "state") {
          setPlayers(Array.isArray(payload.players) ? payload.players : []);
        }
        
        if (payload.type === "enemies") {
          setEnemies(Array.isArray(payload.enemies) ? payload.enemies : []);
        }
      } catch (error) {
        console.error("Invalid multiplayer payload", error);
      }
    });

    return () => {
      socket.close();
    };
  }, []);

  /**
   * Send position/rotation update to server
   */
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

  /**
   * Send attack command to server
   */
  const sendAttack = useCallback((enemyId) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }
    socket.send(
      JSON.stringify({
        type: "attack",
        enemyId,
      })
    );
  }, []);

  return { players, enemies, localIdRef, sendMove, sendAttack };
};
