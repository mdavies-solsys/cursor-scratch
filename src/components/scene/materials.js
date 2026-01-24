/**
 * Material and texture creation utilities
 * Procedural texture generation for the ruins environment
 */
import * as THREE from "three";

/**
 * Create a canvas with marble-like noise texture
 * @param {number} size - Canvas dimensions
 * @param {string} baseColor - Base color (CSS color string)
 * @param {string} accentColor - Accent color for gradient
 * @param {number} noiseStrength - Intensity of noise
 * @param {number} veinCount - Number of vein lines
 * @returns {HTMLCanvasElement}
 */
export const createNoiseCanvas = (size, baseColor, accentColor, noiseStrength = 22, veinCount = 18) => {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return canvas;
  }

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, size, size);
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, baseColor);
  gradient.addColorStop(1, accentColor);
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  ctx.globalAlpha = 1;

  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * noiseStrength;
    data[i] = THREE.MathUtils.clamp(data[i] + noise, 0, 255);
    data[i + 1] = THREE.MathUtils.clamp(data[i + 1] + noise, 0, 255);
    data[i + 2] = THREE.MathUtils.clamp(data[i + 2] + noise, 0, 255);
  }
  ctx.putImageData(imageData, 0, 0);

  ctx.strokeStyle = "rgba(15, 15, 15, 0.2)";
  ctx.lineWidth = 1;
  for (let i = 0; i < veinCount; i += 1) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * size, Math.random() * size);
    ctx.lineTo(Math.random() * size, Math.random() * size);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
  for (let i = 0; i < veinCount * 2; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const w = 2 + Math.random() * 6;
    const h = 1 + Math.random() * 3;
    ctx.fillRect(x, y, w, h);
  }

  return canvas;
};

/**
 * Create a grainy texture canvas for bump/roughness maps
 * @param {number} size - Canvas dimensions
 * @param {number} base - Base gray value
 * @param {number} variance - Color variance
 * @returns {HTMLCanvasElement}
 */
export const createGrainCanvas = (size, base = 140, variance = 70) => {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return canvas;
  }
  const imageData = ctx.createImageData(size, size);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const value = THREE.MathUtils.clamp(base + (Math.random() - 0.5) * variance, 0, 255);
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
    data[i + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
};

/**
 * Build a Three.js CanvasTexture with standard settings
 * @param {HTMLCanvasElement} canvas - Source canvas
 * @param {[number, number]} repeat - Texture repeat values
 * @param {boolean} isColorTexture - Whether this is a color (sRGB) texture
 * @returns {THREE.CanvasTexture}
 */
export const buildCanvasTexture = (canvas, repeat, isColorTexture) => {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat[0], repeat[1]);
  texture.anisotropy = 8;  // Reduced from 16 for performance
  if (isColorTexture) {
    texture.colorSpace = THREE.SRGBColorSpace;
  }
  return texture;
};

/**
 * Create a textured PBR material with procedural textures
 * @param {Object} options - Material configuration
 * @returns {THREE.MeshStandardMaterial}
 */
export const createTexturedMaterial = ({
  baseColor,
  accentColor,
  repeat = [4, 4],
  roughness = 0.9,
  metalness = 0.1,
  bumpScale = 0.2,
  noiseStrength = 22,
  veinCount = 18,
  grainBase = 140,
  grainVariance = 70,
  textureSize = 512,
  useRoughnessMap = true,
}) => {
  // Fallback for SSR or non-browser environments
  if (typeof document === "undefined") {
    return new THREE.MeshStandardMaterial({ color: baseColor, roughness, metalness });
  }

  const diffuseCanvas = createNoiseCanvas(textureSize, baseColor, accentColor, noiseStrength, veinCount);
  const grainCanvas = createGrainCanvas(textureSize, grainBase, grainVariance);
  const map = buildCanvasTexture(diffuseCanvas, repeat, true);
  const bumpMap = buildCanvasTexture(grainCanvas, repeat, false);
  
  map.anisotropy = 8;
  bumpMap.anisotropy = 8;

  const materialConfig = {
    color: baseColor,
    map,
    bumpMap,
    bumpScale,
    roughness,
    metalness,
  };

  // Only create roughnessMap if enabled - roughnessMap multiplies with roughness property,
  // so even roughness=1.0 becomes shiny if roughnessMap has dark values
  if (useRoughnessMap) {
    const roughnessMap = buildCanvasTexture(grainCanvas, repeat, false);
    roughnessMap.anisotropy = 8;
    materialConfig.roughnessMap = roughnessMap;
  }

  return new THREE.MeshStandardMaterial(materialConfig);
};
