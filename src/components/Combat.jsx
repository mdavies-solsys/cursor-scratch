import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useXR } from "@react-three/xr";
import * as THREE from "three";

// Constants
const SWORD_LENGTH = 0.8;
const SWORD_BLADE_WIDTH = 0.06;
const SWORD_BLADE_THICKNESS = 0.015;
const SWORD_GUARD_WIDTH = 0.18;
const SWORD_GUARD_HEIGHT = 0.03;
const SWORD_HANDLE_LENGTH = 0.15;
const SWORD_HANDLE_RADIUS = 0.02;
const SWORD_POMMEL_RADIUS = 0.025;
const ATTACK_COOLDOWN = 300; // ms
const VR_SWING_THRESHOLD = 2.5; // m/s velocity threshold for VR swing attack
const ATTACK_RANGE = 3.0; // meters for non-VR raycast attacks

// Sword blade geometry - procedural medieval sword shape
const createBladeGeometry = () => {
  const shape = new THREE.Shape();
  const halfWidth = SWORD_BLADE_WIDTH / 2;
  const length = SWORD_LENGTH;
  
  // Create blade shape (tapered towards tip)
  shape.moveTo(-halfWidth, 0);
  shape.lineTo(-halfWidth * 0.9, length * 0.1);
  shape.lineTo(-halfWidth * 0.8, length * 0.5);
  shape.lineTo(-halfWidth * 0.4, length * 0.85);
  shape.lineTo(0, length); // Tip
  shape.lineTo(halfWidth * 0.4, length * 0.85);
  shape.lineTo(halfWidth * 0.8, length * 0.5);
  shape.lineTo(halfWidth * 0.9, length * 0.1);
  shape.lineTo(halfWidth, 0);
  shape.lineTo(-halfWidth, 0);
  
  const extrudeSettings = {
    depth: SWORD_BLADE_THICKNESS,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.002,
    bevelSegments: 2,
  };
  
  return new THREE.ExtrudeGeometry(shape, extrudeSettings);
};

// Procedural Sword Component
export const Sword = React.forwardRef(({ isAttacking = false, scale = 1 }, ref) => {
  const bladeGeometry = useMemo(() => createBladeGeometry(), []);
  
  // Materials
  const bladeMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#c0c0c0",
    metalness: 0.9,
    roughness: 0.2,
    emissive: isAttacking ? "#ffffff" : "#000000",
    emissiveIntensity: isAttacking ? 0.3 : 0,
  }), [isAttacking]);
  
  const guardMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#8b7355",
    metalness: 0.6,
    roughness: 0.4,
  }), []);
  
  const handleMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#4a3728",
    metalness: 0.1,
    roughness: 0.8,
  }), []);
  
  const pommelMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#8b7355",
    metalness: 0.7,
    roughness: 0.3,
  }), []);

  return (
    <group ref={ref} scale={scale}>
      {/* Blade */}
      <mesh
        geometry={bladeGeometry}
        material={bladeMaterial}
        position={[0, SWORD_HANDLE_LENGTH + SWORD_GUARD_HEIGHT, -SWORD_BLADE_THICKNESS / 2]}
        castShadow
      />
      
      {/* Guard (cross-guard) */}
      <mesh position={[0, SWORD_HANDLE_LENGTH, 0]} material={guardMaterial} castShadow>
        <boxGeometry args={[SWORD_GUARD_WIDTH, SWORD_GUARD_HEIGHT, SWORD_GUARD_HEIGHT * 1.5]} />
      </mesh>
      
      {/* Handle */}
      <mesh position={[0, SWORD_HANDLE_LENGTH / 2, 0]} material={handleMaterial} castShadow>
        <cylinderGeometry args={[SWORD_HANDLE_RADIUS, SWORD_HANDLE_RADIUS * 1.1, SWORD_HANDLE_LENGTH, 8]} />
      </mesh>
      
      {/* Pommel (bottom of handle) */}
      <mesh position={[0, 0, 0]} material={pommelMaterial} castShadow>
        <sphereGeometry args={[SWORD_POMMEL_RADIUS, 8, 8]} />
      </mesh>
      
      {/* Fuller (blood groove decoration on blade) */}
      <mesh 
        position={[0, SWORD_HANDLE_LENGTH + SWORD_GUARD_HEIGHT + SWORD_LENGTH * 0.4, SWORD_BLADE_THICKNESS * 0.6]}
        castShadow
      >
        <boxGeometry args={[SWORD_BLADE_WIDTH * 0.3, SWORD_LENGTH * 0.6, 0.002]} />
        <meshStandardMaterial color="#888888" metalness={0.95} roughness={0.15} />
      </mesh>
    </group>
  );
});

Sword.displayName = "Sword";

// VR Sword - Attached to right hand controller
// This component renders itself inside the XR controller space
export const VRSword = ({ onAttack, enemies }) => {
  const inputSourceStates = useXR((state) => state.inputSourceStates);
  const swordGroupRef = useRef();
  const prevPositionRef = useRef(new THREE.Vector3());
  const velocityRef = useRef(new THREE.Vector3());
  const lastAttackRef = useRef(0);
  const [isAttacking, setIsAttacking] = useState(false);
  const [controllerPosition, setControllerPosition] = useState(null);
  const [controllerQuaternion, setControllerQuaternion] = useState(null);

  // Find right controller state
  const rightController = useMemo(() => {
    return inputSourceStates.find(
      (state) => state.type === "controller" && state.inputSource?.handedness === "right"
    );
  }, [inputSourceStates]);

  useFrame((state, delta) => {
    if (!rightController) return;
    
    // Get controller position from the controller object
    const controllerObj = rightController.object;
    if (!controllerObj) return;
    
    // Update sword position to follow controller
    const worldPos = new THREE.Vector3();
    const worldQuat = new THREE.Quaternion();
    controllerObj.getWorldPosition(worldPos);
    controllerObj.getWorldQuaternion(worldQuat);
    
    setControllerPosition(worldPos.clone());
    setControllerQuaternion(worldQuat.clone());
    
    // Calculate velocity from position change
    velocityRef.current.subVectors(worldPos, prevPositionRef.current).divideScalar(delta);
    prevPositionRef.current.copy(worldPos);
    
    const speed = velocityRef.current.length();
    
    // Detect swing attack
    const now = performance.now();
    if (speed > VR_SWING_THRESHOLD && now - lastAttackRef.current > ATTACK_COOLDOWN) {
      setIsAttacking(true);
      lastAttackRef.current = now;
      
      // Check collision with enemies
      if (enemies && onAttack) {
        // Calculate sword tip position in world space
        const swordTipLocal = new THREE.Vector3(0, SWORD_LENGTH + SWORD_HANDLE_LENGTH + SWORD_GUARD_HEIGHT, -0.05);
        const swordTip = swordTipLocal.applyQuaternion(worldQuat).add(worldPos);
        
        for (const enemy of enemies) {
          if (!enemy.alive) continue;
          const enemyPos = new THREE.Vector3(enemy.x, enemy.y + 1, enemy.z); // Target torso
          const distance = swordTip.distanceTo(enemyPos);
          if (distance < 1.5) { // Hit radius
            onAttack(enemy.id);
            break;
          }
        }
      }
      
      setTimeout(() => setIsAttacking(false), 150);
    }
  });

  if (!rightController || !controllerPosition || !controllerQuaternion) return null;

  return (
    <group
      ref={swordGroupRef}
      position={controllerPosition}
      quaternion={controllerQuaternion}
    >
      <group
        position={[0, 0, -0.05]} // Offset from grip
        rotation={[Math.PI * 0.1, 0, 0]} // Slight angle for natural grip
      >
        <Sword isAttacking={isAttacking} scale={1} />
      </group>
    </group>
  );
};

// Flat-screen Sword (FPS style, bottom-right corner)
export const FlatSword = ({ onAttack, isAttacking }) => {
  const { camera, size } = useThree();
  const swordRef = useRef();
  const baseRotationRef = useRef(new THREE.Euler(-0.3, -0.4, 0.2));
  const attackAnimRef = useRef(0);

  useFrame((state, delta) => {
    if (!swordRef.current) return;
    
    // Position sword relative to camera (bottom-right corner)
    const offset = new THREE.Vector3(0.35, -0.25, -0.6);
    offset.applyQuaternion(camera.quaternion);
    swordRef.current.position.copy(camera.position).add(offset);
    
    // Base rotation follows camera
    swordRef.current.quaternion.copy(camera.quaternion);
    
    // Apply sword-specific rotation
    const swordRotation = new THREE.Euler(-0.3, -0.4, 0.2);
    
    // Attack animation
    if (isAttacking) {
      attackAnimRef.current = Math.min(attackAnimRef.current + delta * 15, 1);
    } else {
      attackAnimRef.current = Math.max(attackAnimRef.current - delta * 8, 0);
    }
    
    // Swing animation - rotate forward and up
    const swingAngle = Math.sin(attackAnimRef.current * Math.PI) * 0.8;
    swordRotation.x -= swingAngle;
    swordRotation.z += swingAngle * 0.3;
    
    const additionalRotation = new THREE.Quaternion().setFromEuler(swordRotation);
    swordRef.current.quaternion.multiply(additionalRotation);
  });

  return (
    <group ref={swordRef}>
      <Sword isAttacking={isAttacking} scale={0.8} />
    </group>
  );
};

// Procedural Enemy Component
export const Enemy = ({ id, x, y, z, alive, faceIndex, faceTextures }) => {
  const groupRef = useRef();
  const [faceTexture, setFaceTexture] = useState(null);
  const floatOffset = useRef(Math.random() * Math.PI * 2);

  // Load face texture
  useEffect(() => {
    if (faceTextures && faceTextures[faceIndex]) {
      setFaceTexture(faceTextures[faceIndex]);
    }
  }, [faceIndex, faceTextures]);

  // Body materials
  const bodyMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#2a2a35",
    roughness: 0.7,
    metalness: 0.3,
  }), []);

  const cloakMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#1a1a20",
    roughness: 0.9,
    metalness: 0.1,
    side: THREE.DoubleSide,
  }), []);

  const headMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#3a3a40",
    roughness: 0.6,
    metalness: 0.2,
  }), []);

  // Floating animation
  useFrame((state) => {
    if (!groupRef.current || !alive) return;
    const time = state.clock.elapsedTime;
    groupRef.current.position.y = y + Math.sin(time * 2 + floatOffset.current) * 0.1;
  });

  if (!alive) return null;

  return (
    <group ref={groupRef} position={[x, y, z]}>
      {/* Body - Main torso */}
      <mesh position={[0, 0.9, 0]} material={bodyMaterial} castShadow>
        <capsuleGeometry args={[0.25, 0.6, 4, 8]} />
      </mesh>
      
      {/* Cloak/Robe bottom */}
      <mesh position={[0, 0.3, 0]} material={cloakMaterial} castShadow>
        <coneGeometry args={[0.4, 0.8, 8]} />
      </mesh>
      
      {/* Head */}
      <mesh position={[0, 1.5, 0]} material={headMaterial} castShadow>
        <sphereGeometry args={[0.2, 16, 16]} />
      </mesh>
      
      {/* Face (profile picture) */}
      {faceTexture && (
        <mesh position={[0, 1.5, 0.21]}>
          <planeGeometry args={[0.35, 0.35]} />
          <meshBasicMaterial map={faceTexture} transparent />
        </mesh>
      )}
      
      {/* Left Arm */}
      <group position={[-0.35, 0.95, 0]} rotation={[0, 0, 0.3]}>
        <mesh material={bodyMaterial} castShadow>
          <capsuleGeometry args={[0.08, 0.4, 4, 8]} />
        </mesh>
      </group>
      
      {/* Right Arm */}
      <group position={[0.35, 0.95, 0]} rotation={[0, 0, -0.3]}>
        <mesh material={bodyMaterial} castShadow>
          <capsuleGeometry args={[0.08, 0.4, 4, 8]} />
        </mesh>
      </group>
      
      {/* Shadow/hover effect */}
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.4, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.3} />
      </mesh>
    </group>
  );
};

// Attack Input Handler Hook
export const useAttackInput = (isMobile, isVR, onAttack) => {
  const lastAttackRef = useRef(0);
  const [isAttacking, setIsAttacking] = useState(false);

  const triggerAttack = useCallback(() => {
    const now = performance.now();
    if (now - lastAttackRef.current < ATTACK_COOLDOWN) return;
    lastAttackRef.current = now;
    setIsAttacking(true);
    
    if (onAttack) {
      onAttack();
    }
    
    setTimeout(() => setIsAttacking(false), 200);
  }, [onAttack]);

  useEffect(() => {
    if (isVR) return; // VR handles its own input via swing detection

    // Mouse click handler
    const handleMouseClick = (event) => {
      // Only trigger on left click
      if (event.button === 0) {
        triggerAttack();
      }
    };

    // Touch handler
    const handleTouchStart = (event) => {
      // Prevent triggering on joystick touches
      const target = event.target;
      if (target.closest('.touch-controls') || target.closest('.touch-joystick')) {
        return;
      }
      triggerAttack();
    };

    // Gamepad handler - check in animation frame
    let gamepadCheckInterval = null;
    const checkGamepad = () => {
      if (typeof navigator === "undefined" || !navigator.getGamepads) return;
      const pads = navigator.getGamepads();
      for (const pad of pads) {
        if (!pad || !pad.connected) continue;
        // Check triggers (typically buttons 6 and 7 on standard gamepads)
        const rightTrigger = pad.buttons[7]?.value > 0.5;
        const leftTrigger = pad.buttons[6]?.value > 0.5;
        if (rightTrigger || leftTrigger) {
          triggerAttack();
          break;
        }
      }
    };

    if (!isMobile) {
      window.addEventListener("mousedown", handleMouseClick);
      gamepadCheckInterval = setInterval(checkGamepad, 100);
    } else {
      window.addEventListener("touchstart", handleTouchStart, { passive: true });
    }

    return () => {
      if (!isMobile) {
        window.removeEventListener("mousedown", handleMouseClick);
        if (gamepadCheckInterval) clearInterval(gamepadCheckInterval);
      } else {
        window.removeEventListener("touchstart", handleTouchStart);
      }
    };
  }, [isMobile, isVR, triggerAttack]);

  return { isAttacking, triggerAttack };
};

// Raycast attack for non-VR players
export const useRaycastAttack = (camera, enemies, onHit) => {
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  
  const performRaycast = useCallback(() => {
    if (!camera || !enemies || enemies.length === 0) return null;
    
    // Cast ray from camera center
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    raycaster.far = ATTACK_RANGE;
    
    // Check each enemy
    let closestHit = null;
    let closestDistance = Infinity;
    
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      
      const enemyPos = new THREE.Vector3(enemy.x, enemy.y + 1, enemy.z); // Aim at torso level
      const toEnemy = enemyPos.clone().sub(camera.position);
      const distance = toEnemy.length();
      
      if (distance > ATTACK_RANGE) continue;
      
      // Check if enemy is roughly in front of camera
      const cameraDir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      const dot = toEnemy.normalize().dot(cameraDir);
      
      // More lenient hit detection - wider cone
      if (dot > 0.7 && distance < closestDistance) {
        closestHit = enemy.id;
        closestDistance = distance;
      }
    }
    
    if (closestHit && onHit) {
      onHit(closestHit);
    }
    
    return closestHit;
  }, [camera, enemies, onHit, raycaster]);
  
  return performRaycast;
};

export { ATTACK_RANGE, ATTACK_COOLDOWN };
