/**
 * Scene Component
 * Main entry point for the 3D game environment
 * 
 * This is a slim orchestration component that composes the scene
 * from modular sub-components. See the scene/ directory for:
 * - world/     - Environment geometry and lighting
 * - controls/  - Input handling
 * - session/   - Multiplayer session management
 * - hooks/     - Shared React hooks
 */
import React, { useCallback } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { XR } from "@react-three/xr";
import * as THREE from "three";
import { RENDER_DISTANCE } from "./constants.js";
import { World } from "./world/index.js";
import { SessionGate, FlatSessionWorld } from "./session/index.js";

/**
 * RendererConfig - Configure Three.js renderer settings
 */
const RendererConfig = () => {
  const { gl } = useThree();
  
  React.useEffect(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.5;
    gl.outputColorSpace = THREE.SRGBColorSpace;
  }, [gl]);
  
  return null;
};

/**
 * Scene - Main 3D game environment component
 * 
 * @param {Object} props
 * @param {Object} props.store - XR store for VR session management
 * @param {Function} props.onSessionChange - Callback when XR session changes
 * @param {Function} props.onReady - Callback when scene is ready
 * @param {Object} props.flatControls - Configuration for non-VR controls
 * @param {boolean} props.xrEnabled - Whether to enable VR support
 * @param {boolean} props.isMobile - Whether running on mobile device
 */
const Scene = ({ 
  store, 
  onSessionChange, 
  onReady, 
  flatControls, 
  xrEnabled = true, 
  isMobile = false 
}) => {
  const handleCreated = useCallback((state) => {
    // Configure renderer on creation
    state.gl.toneMapping = THREE.ACESFilmicToneMapping;
    state.gl.toneMappingExposure = 1.5;
    state.gl.outputColorSpace = THREE.SRGBColorSpace;
    
    if (onReady) {
      onReady();
    }
  }, [onReady]);

  const flatActive = Boolean(flatControls?.active);

  return (
    <div className="vr-scene">
      <Canvas
        shadows
        onCreated={handleCreated}
        camera={{ 
          position: [0, 1.6, 3], 
          fov: 60, 
          near: 0.1, 
          far: RENDER_DISTANCE 
        }}
        gl={{ 
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.5,
        }}
      >
        <RendererConfig />
        
        {/* Dark greenish background for ruins atmosphere */}
        <color attach="background" args={["#12140f"]} />
        
        {xrEnabled ? (
          <XR store={store}>
            <World />
            <SessionGate onSessionChange={onSessionChange} />
          </XR>
        ) : (
          <World />
        )}
        
        {flatActive && (
          <FlatSessionWorld
            leftAxisRef={flatControls?.leftAxisRef}
            rightAxisRef={flatControls?.rightAxisRef}
            enablePointerLock={Boolean(flatControls?.enablePointerLock)}
            isMobile={isMobile}
          />
        )}
      </Canvas>
    </div>
  );
};

export default Scene;
