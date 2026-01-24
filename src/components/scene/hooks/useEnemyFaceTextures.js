/**
 * Enemy face texture loading hook
 * Loads face images for enemy characters
 */
import { useState, useEffect } from "react";
import * as THREE from "three";

// Face texture paths
const FACE_TEXTURE_PATHS = [
  "/IMG_2364.jpeg",
  "/IMG_2365.jpeg",
  "/IMG_2366.jpeg",
  "/IMG_2372.jpeg"
];

/**
 * Hook to load enemy face textures
 * @returns {Array<THREE.Texture|null>} - Array of loaded textures
 */
export const useEnemyFaceTextures = () => {
  const [textures, setTextures] = useState([null, null, null, null]);
  
  useEffect(() => {
    const loader = new THREE.TextureLoader();
    const loadedTextures = [];
    let loadedCount = 0;
    
    FACE_TEXTURE_PATHS.forEach((path, index) => {
      loader.load(
        path,
        (texture) => {
          loadedTextures[index] = texture;
          loadedCount++;
          if (loadedCount === FACE_TEXTURE_PATHS.length) {
            setTextures([...loadedTextures]);
          }
        },
        undefined,
        (error) => {
          console.warn(`Failed to load face texture ${path}:`, error);
          loadedTextures[index] = null;
          loadedCount++;
          if (loadedCount === FACE_TEXTURE_PATHS.length) {
            setTextures([...loadedTextures]);
          }
        }
      );
    });
  }, []);
  
  return textures;
};
