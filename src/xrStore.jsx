import React, { useRef, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { createXRStore, XRControllerModel } from "@react-three/xr";
import * as THREE from "three";

// Module-level shared state for VR combat
// This allows the sword component (rendered by @react-three/xr) to access
// combat callbacks and enemy data set by SessionWorld
const vrCombatState = {
  onAttack: null,
  enemies: [],
};

// Function to update VR combat state from SessionWorld
export const setVRCombatState = (onAttack, enemies) => {
  vrCombatState.onAttack = onAttack;
  vrCombatState.enemies = enemies;
};

// Sword constants (shared with Combat.jsx)
const SWORD_LENGTH = 0.8;
const SWORD_BLADE_WIDTH = 0.06;
const SWORD_BLADE_THICKNESS = 0.015;
const SWORD_GUARD_WIDTH = 0.18;
const SWORD_GUARD_HEIGHT = 0.03;
const SWORD_HANDLE_LENGTH = 0.15;
const SWORD_HANDLE_RADIUS = 0.02;
const SWORD_POMMEL_RADIUS = 0.025;
const VR_SWING_THRESHOLD = 2.5;
const ATTACK_COOLDOWN = 300;

// Create blade geometry for the sword
const createBladeGeometry = () => {
  const shape = new THREE.Shape();
  const halfWidth = SWORD_BLADE_WIDTH / 2;
  const length = SWORD_LENGTH;
  
  shape.moveTo(-halfWidth, 0);
  shape.lineTo(-halfWidth * 0.9, length * 0.1);
  shape.lineTo(-halfWidth * 0.8, length * 0.5);
  shape.lineTo(-halfWidth * 0.4, length * 0.85);
  shape.lineTo(0, length);
  shape.lineTo(halfWidth * 0.4, length * 0.85);
  shape.lineTo(halfWidth * 0.8, length * 0.5);
  shape.lineTo(halfWidth * 0.9, length * 0.1);
  shape.lineTo(halfWidth, 0);
  shape.lineTo(-halfWidth, 0);
  
  return new THREE.ExtrudeGeometry(shape, {
    depth: SWORD_BLADE_THICKNESS,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.002,
    bevelSegments: 2,
  });
};

// Inline sword component for controller model
const ControllerSword = ({ isAttacking }) => {
  const bladeGeometry = React.useMemo(() => createBladeGeometry(), []);
  
  const bladeMaterial = React.useMemo(() => new THREE.MeshStandardMaterial({
    color: "#c0c0c0",
    metalness: 0.9,
    roughness: 0.2,
    emissive: isAttacking ? "#ffffff" : "#000000",
    emissiveIntensity: isAttacking ? 0.3 : 0,
  }), [isAttacking]);
  
  const guardMaterial = React.useMemo(() => new THREE.MeshStandardMaterial({
    color: "#8b7355", metalness: 0.6, roughness: 0.4,
  }), []);
  
  const handleMaterial = React.useMemo(() => new THREE.MeshStandardMaterial({
    color: "#4a3728", metalness: 0.1, roughness: 0.8,
  }), []);
  
  const pommelMaterial = React.useMemo(() => new THREE.MeshStandardMaterial({
    color: "#8b7355", metalness: 0.7, roughness: 0.3,
  }), []);

  return (
    <group>
      <mesh
        geometry={bladeGeometry}
        material={bladeMaterial}
        position={[0, SWORD_HANDLE_LENGTH + SWORD_GUARD_HEIGHT, -SWORD_BLADE_THICKNESS / 2]}
        castShadow
      />
      <mesh position={[0, SWORD_HANDLE_LENGTH, 0]} material={guardMaterial} castShadow>
        <boxGeometry args={[SWORD_GUARD_WIDTH, SWORD_GUARD_HEIGHT, SWORD_GUARD_HEIGHT * 1.5]} />
      </mesh>
      <mesh position={[0, SWORD_HANDLE_LENGTH / 2, 0]} material={handleMaterial} castShadow>
        <cylinderGeometry args={[SWORD_HANDLE_RADIUS, SWORD_HANDLE_RADIUS * 1.1, SWORD_HANDLE_LENGTH, 8]} />
      </mesh>
      <mesh position={[0, 0, 0]} material={pommelMaterial} castShadow>
        <sphereGeometry args={[SWORD_POMMEL_RADIUS, 8, 8]} />
      </mesh>
      <mesh position={[0, SWORD_HANDLE_LENGTH + SWORD_GUARD_HEIGHT + SWORD_LENGTH * 0.4, SWORD_BLADE_THICKNESS * 0.6]} castShadow>
        <boxGeometry args={[SWORD_BLADE_WIDTH * 0.3, SWORD_LENGTH * 0.6, 0.002]} />
        <meshStandardMaterial color="#888888" metalness={0.95} roughness={0.15} />
      </mesh>
    </group>
  );
};

// Right controller with sword - renders sword and handles swing detection
const RightControllerWithSword = () => {
  const groupRef = useRef();
  const prevPositionRef = useRef(new THREE.Vector3());
  const velocityRef = useRef(new THREE.Vector3());
  const lastAttackRef = useRef(0);
  const [isAttacking, setIsAttacking] = useState(false);
  const worldPosRef = useRef(new THREE.Vector3());
  const worldQuatRef = useRef(new THREE.Quaternion());

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    
    // Get world position/rotation of the controller (parent of this group)
    groupRef.current.getWorldPosition(worldPosRef.current);
    groupRef.current.getWorldQuaternion(worldQuatRef.current);
    
    // Calculate velocity from position change
    velocityRef.current.subVectors(worldPosRef.current, prevPositionRef.current).divideScalar(delta);
    prevPositionRef.current.copy(worldPosRef.current);
    
    const speed = velocityRef.current.length();
    
    // Detect swing attack
    const now = performance.now();
    if (speed > VR_SWING_THRESHOLD && now - lastAttackRef.current > ATTACK_COOLDOWN) {
      setIsAttacking(true);
      lastAttackRef.current = now;
      
      // Check collision with enemies using module-level state
      const { enemies, onAttack } = vrCombatState;
      if (enemies && enemies.length > 0 && onAttack) {
        const swordTipLocal = new THREE.Vector3(0, SWORD_LENGTH + SWORD_HANDLE_LENGTH + SWORD_GUARD_HEIGHT, -0.05);
        const swordTip = swordTipLocal.applyQuaternion(worldQuatRef.current).add(worldPosRef.current);
        
        for (const enemy of enemies) {
          if (!enemy.alive) continue;
          const enemyPos = new THREE.Vector3(enemy.x, enemy.y + 1, enemy.z);
          const distance = swordTip.distanceTo(enemyPos);
          if (distance < 1.5) {
            onAttack(enemy.id);
            break;
          }
        }
      }
      
      setTimeout(() => setIsAttacking(false), 150);
    }
  });

  return (
    <group ref={groupRef}>
      <group position={[0, 0, -0.05]} rotation={[Math.PI * 0.1, 0, 0]}>
        <ControllerSword isAttacking={isAttacking} />
      </group>
    </group>
  );
};

const LeftControllerModel = () => <XRControllerModel />;
const RightControllerModel = () => <RightControllerWithSword />;

const xrStore = createXRStore({
  offerSession: false,
  controller: {
    left: LeftControllerModel,
    right: RightControllerModel,
  },
  hand: false,
  transientPointer: false,
  gaze: false,
  screenInput: false,
  optionalFeatures: ["local-floor", "bounded-floor"],
});

// Hook for SessionWorld to sync combat state
export const useVRCombatSync = (onAttack, enemies) => {
  useEffect(() => {
    setVRCombatState(onAttack, enemies);
    return () => {
      setVRCombatState(null, []);
    };
  }, [onAttack, enemies]);
};

export default xrStore;
