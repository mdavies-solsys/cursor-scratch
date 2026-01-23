# Three.js Lighting Research

This document covers Three.js lighting concepts, best practices, and recommendations for the WebXR hall scene in this project.

## Table of Contents

1. [Light Types Overview](#light-types-overview)
2. [Current Implementation Analysis](#current-implementation-analysis)
3. [Detailed Light Type Reference](#detailed-light-type-reference)
4. [Shadow Configuration](#shadow-configuration)
5. [Performance Considerations](#performance-considerations)
6. [Advanced Techniques](#advanced-techniques)
7. [Recommendations](#recommendations)

---

## Light Types Overview

Three.js provides several light types, each simulating different real-world lighting scenarios:

| Light Type | Performance | Shadows | Use Case |
|------------|-------------|---------|----------|
| AmbientLight | Cheapest | No | Base fill light |
| HemisphereLight | Cheap | No | Outdoor sky/ground bounce |
| DirectionalLight | Medium | Yes | Sunlight, distant sources |
| PointLight | Medium-High | Yes | Lamps, bulbs |
| SpotLight | Higher | Yes | Flashlights, stage lights |
| RectAreaLight | Highest | No | Area lights, soft boxes |

---

## Current Implementation Analysis

The `Scene.jsx` currently uses a well-balanced lighting setup:

```jsx
// Global ambient fill
<ambientLight intensity={0.45} />

// Sky/ground color gradient
<hemisphereLight color="#f6e2c8" groundColor="#2f2a26" intensity={0.4} />

// Main directional "sun" light with shadows
<directionalLight
  position={[SCALE(18), SCALE(24), SCALE(14)]}
  intensity={1.05}
  color="#f6d8b6"
  castShadow
  shadow-mapSize-width={2048}
  shadow-mapSize-height={2048}
  shadow-camera-near={1}
  shadow-camera-far={SCALE(110)}
  shadow-camera-left={-SCALE(40)}
  shadow-camera-right={SCALE(40)}
  shadow-camera-top={SCALE(40)}
  shadow-camera-bottom={-SCALE(40)}
/>

// Ceiling point lights (3x)
<pointLight
  position={[0, ceilingLightY, z]}
  intensity={0.9}
  distance={SCALE(70)}
  decay={2}
  color="#f6d4aa"
/>
```

### Strengths
- Good layering of ambient, hemisphere, and directional lights
- Warm color palette creates cohesive atmosphere
- Shadow map resolution (2048x2048) provides good quality
- Point lights add localized interest

### Areas for Improvement
- Point lights don't cast shadows (performance trade-off)
- No light probes for indirect lighting
- Could benefit from environment mapping

---

## Detailed Light Type Reference

### 1. AmbientLight

The simplest light type - illuminates all objects equally from all directions.

```javascript
const ambientLight = new THREE.AmbientLight(color, intensity);

// Parameters:
// color - Hexadecimal color (default: 0xffffff)
// intensity - Numeric value (default: 1)
```

**Best Practices:**
- Keep intensity low (0.1-0.5) to avoid washing out shadows
- Use to simulate indirect/bounce lighting
- Combine with other light types; never use alone

**React-Three-Fiber:**
```jsx
<ambientLight intensity={0.3} color="#ffffff" />
```

---

### 2. HemisphereLight

Simulates outdoor lighting with a sky color above and ground color below.

```javascript
const hemiLight = new THREE.HemisphereLight(skyColor, groundColor, intensity);
```

**Best Practices:**
- Sky color should be brighter/cooler, ground color warmer/darker
- Great for outdoor scenes or large interior spaces with windows
- Intensity typically 0.3-0.6

**React-Three-Fiber:**
```jsx
<hemisphereLight 
  color="#87ceeb"      // Sky color
  groundColor="#8b4513" // Ground bounce color
  intensity={0.5}
  position={[0, 50, 0]} // Usually above scene
/>
```

---

### 3. DirectionalLight

Parallel rays simulating distant light sources like the sun.

```javascript
const dirLight = new THREE.DirectionalLight(color, intensity);
dirLight.position.set(10, 20, 10);
dirLight.castShadow = true;

// Shadow configuration
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 500;
dirLight.shadow.camera.left = -50;
dirLight.shadow.camera.right = 50;
dirLight.shadow.camera.top = 50;
dirLight.shadow.camera.bottom = -50;
```

**Best Practices:**
- Position doesn't affect illumination direction; only the vector to target matters
- Set shadow camera frustum to tightly fit your scene
- Use `shadow.bias` (-0.0001 to -0.001) to reduce shadow acne

**React-Three-Fiber:**
```jsx
<directionalLight
  position={[10, 20, 10]}
  intensity={1}
  castShadow
  shadow-mapSize-width={2048}
  shadow-mapSize-height={2048}
  shadow-camera-near={0.5}
  shadow-camera-far={500}
  shadow-camera-left={-50}
  shadow-camera-right={50}
  shadow-camera-top={50}
  shadow-camera-bottom={-50}
  shadow-bias={-0.0001}
/>
```

---

### 4. PointLight

Omnidirectional light emanating from a single point (like a light bulb).

```javascript
const pointLight = new THREE.PointLight(color, intensity, distance, decay);

// Parameters:
// distance - Maximum range (0 = infinite, not recommended)
// decay - Amount light dims along distance (default: 2, physically correct)
```

**Best Practices:**
- Always set a distance for performance
- Use decay=2 for physically accurate falloff
- Shadow-casting point lights are expensive (renders 6 shadow maps)

**React-Three-Fiber:**
```jsx
<pointLight
  position={[0, 10, 0]}
  color="#ff9900"
  intensity={1}
  distance={50}
  decay={2}
  castShadow={false} // Usually disabled for performance
  shadow-mapSize-width={512}
  shadow-mapSize-height={512}
/>
```

---

### 5. SpotLight

Conical light beam from a point, like a flashlight or stage light.

```javascript
const spotLight = new THREE.SpotLight(color, intensity, distance, angle, penumbra, decay);

// Parameters:
// angle - Maximum cone angle in radians (max: Math.PI/2)
// penumbra - Softness of cone edge (0-1, where 1 is fully soft)
```

**Best Practices:**
- Use penumbra > 0 for soft, realistic edges
- Target can be set explicitly via `.target` property
- Good for highlighting specific areas

**React-Three-Fiber:**
```jsx
<spotLight
  position={[10, 20, 10]}
  angle={Math.PI / 6}
  penumbra={0.5}
  intensity={1}
  distance={100}
  decay={2}
  castShadow
  shadow-mapSize-width={1024}
  shadow-mapSize-height={1024}
/>
```

---

### 6. RectAreaLight

Rectangular area light that emits uniformly across a rect surface (like a window or softbox).

```javascript
import { RectAreaLightHelper } from 'three/examples/jsm/helpers/RectAreaLightHelper.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';

// Must initialize uniforms first!
RectAreaLightUniformsLib.init();

const rectLight = new THREE.RectAreaLight(color, intensity, width, height);
rectLight.position.set(0, 5, 0);
rectLight.lookAt(0, 0, 0);
```

**Best Practices:**
- Only works with MeshStandardMaterial and MeshPhysicalMaterial
- Does NOT support shadows
- Very expensive; use sparingly
- Must call `RectAreaLightUniformsLib.init()` before use

**React-Three-Fiber:**
```jsx
import { RectAreaLight } from '@react-three/drei';

<RectAreaLight
  width={10}
  height={10}
  color="#ffffff"
  intensity={5}
  position={[0, 10, 0]}
  rotation={[-Math.PI / 2, 0, 0]}
/>
```

---

## Shadow Configuration

### Shadow Map Types

```javascript
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Recommended

// Options:
// THREE.BasicShadowMap - Fast, jagged
// THREE.PCFShadowMap - Default, filtered
// THREE.PCFSoftShadowMap - Softer, slightly more expensive
// THREE.VSMShadowMap - Soft, but can have artifacts
```

### Shadow Map Resolution Guidelines

| Resolution | Quality | Performance | Use Case |
|------------|---------|-------------|----------|
| 512x512 | Low | Best | Mobile, many lights |
| 1024x1024 | Medium | Good | General use |
| 2048x2048 | High | Medium | Desktop, important shadows |
| 4096x4096 | Very High | Poor | Hero shots only |

### Shadow Bias and Normal Bias

```javascript
light.shadow.bias = -0.0001;      // Reduces shadow acne (surface artifacts)
light.shadow.normalBias = 0.02;   // Reduces peter-panning (shadow offset)
```

### Optimizing Shadow Camera Frustum

For directional lights, tightly fit the shadow camera to your scene:

```jsx
// Bad - wasteful, low resolution shadows
shadow-camera-left={-1000}
shadow-camera-right={1000}

// Good - fits scene boundaries
shadow-camera-left={-HALL_WIDTH / 2}
shadow-camera-right={HALL_WIDTH / 2}
```

---

## Performance Considerations

### Light Count Impact

| Lights | Shadows | Impact |
|--------|---------|--------|
| 1-4 | 0-1 | Minimal |
| 5-8 | 1-2 | Noticeable |
| 8+ | 3+ | Heavy |

### Performance Optimization Strategies

1. **Limit Shadow-Casting Lights**
   - Only main directional light should cast shadows
   - Point/spot lights for fill without shadows

2. **Use Light Distance**
   ```jsx
   <pointLight distance={50} /> // Light doesn't affect objects beyond 50 units
   ```

3. **Bake Static Lighting**
   - Use lightmaps for static geometry
   - Real-time lights only for dynamic elements

4. **Level of Detail for Shadows**
   ```javascript
   // Reduce shadow quality on mobile
   const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
   const shadowSize = isMobile ? 1024 : 2048;
   ```

5. **Frustum Culling**
   - Three.js automatically culls lights by frustum
   - Keep scenes well-organized spatially

---

## Advanced Techniques

### 1. Three-Point Lighting

Classic cinematography setup:

```jsx
// Key Light - Main light source
<directionalLight position={[10, 10, 5]} intensity={1} />

// Fill Light - Soften shadows
<directionalLight position={[-10, 5, 5]} intensity={0.3} />

// Rim/Back Light - Edge separation
<directionalLight position={[0, 5, -10]} intensity={0.5} />
```

### 2. Light Probes (Indirect Lighting)

Capture and apply indirect lighting:

```javascript
import { LightProbe } from 'three';
import { LightProbeGenerator } from 'three/examples/jsm/lights/LightProbeGenerator.js';

// Generate from cube render target or environment map
const lightProbe = LightProbeGenerator.fromCubeTexture(cubeTexture);
scene.add(lightProbe);
```

### 3. Environment Maps for Reflections

```jsx
import { Environment } from '@react-three/drei';

<Environment
  preset="sunset"  // or "studio", "city", "forest", etc.
  background={false}
/>
```

### 4. Post-Processing Bloom

Make lights glow:

```jsx
import { EffectComposer, Bloom } from '@react-three/postprocessing';

<EffectComposer>
  <Bloom
    luminanceThreshold={0.9}
    luminanceSmoothing={0.9}
    intensity={0.5}
  />
</EffectComposer>
```

### 5. Volumetric Lighting (God Rays)

```jsx
import { GodRays } from '@react-three/postprocessing';

// Requires a mesh as the light source
<GodRays
  sun={sunMeshRef}
  samples={60}
  density={0.97}
/>
```

### 6. Light Helpers (Development)

```jsx
import { useHelper } from '@react-three/drei';
import { DirectionalLightHelper, PointLightHelper } from 'three';

function LightWithHelper() {
  const lightRef = useRef();
  useHelper(lightRef, DirectionalLightHelper, 1);
  
  return <directionalLight ref={lightRef} />;
}
```

---

## Recommendations for This Project

### Immediate Improvements

1. **Add Shadow Bias**
   ```jsx
   <directionalLight
     // existing props...
     shadow-bias={-0.0001}
     shadow-normalBias={0.02}
   />
   ```

2. **Environment Map for Reflections**
   Add subtle reflections to the metal materials:
   ```jsx
   import { Environment } from '@react-three/drei';
   
   <Environment preset="warehouse" background={false} />
   ```

3. **Adjust Ambient/Hemisphere Ratio**
   Current setup may be slightly over-lit. Consider:
   ```jsx
   <ambientLight intensity={0.25} />  // Reduced from 0.45
   <hemisphereLight intensity={0.5} /> // Increased from 0.4
   ```

### Medium-Term Enhancements

1. **Torch/Wall Sconce Lights**
   Add atmospheric point lights with orange/red tint:
   ```jsx
   <pointLight
     position={[wallX, SCALE(4), z]}
     color="#ff6b35"
     intensity={0.4}
     distance={SCALE(20)}
     decay={2}
   />
   ```

2. **Contact Shadows for Players**
   ```jsx
   import { ContactShadows } from '@react-three/drei';
   
   <ContactShadows
     position={[0, 0.01, 0]}
     scale={20}
     blur={2}
     opacity={0.4}
   />
   ```

3. **Fog for Depth**
   ```jsx
   <fog attach="fog" args={['#15110e', SCALE(20), SCALE(100)]} />
   ```

### VR-Specific Considerations

1. **Performance Budget**
   - VR requires 72-90 FPS per eye
   - Limit to 1 shadow-casting light
   - Use 1024x1024 max shadow maps

2. **Avoid Screen-Space Effects**
   - Post-processing effects can cause VR discomfort
   - Use geometry-based techniques instead

3. **Light Intensity in VR**
   - VR can appear darker than desktop
   - Test and adjust intensity values in headset

---

## Color Temperature Reference

| Kelvin | Description | Hex Approximation |
|--------|-------------|-------------------|
| 1800K | Candlelight | #ff8a00 |
| 2700K | Warm incandescent | #ffb347 |
| 3000K | Warm white LED | #ffc58f |
| 4000K | Cool white | #fff0db |
| 5000K | Daylight | #ffeedd |
| 6500K | Overcast | #e0e5ff |
| 10000K | Blue sky | #c9d1ff |

Current project uses warm tones (~2700-3000K), appropriate for the grand hall aesthetic.

---

## References

- [Three.js Lighting Documentation](https://threejs.org/docs/#api/en/lights/Light)
- [React-Three-Fiber Documentation](https://docs.pmnd.rs/react-three-fiber)
- [Three.js Fundamentals - Lights](https://threejs.org/manual/#en/lights)
- [Drei Helpers Library](https://github.com/pmndrs/drei)

---

*Last updated: January 2026*
