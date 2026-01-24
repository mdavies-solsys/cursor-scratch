/**
 * Scene constants and configuration values
 * Centralized configuration for the 3D game environment
 */
import * as THREE from "three";

// ============================================================================
// Movement & Control Constants
// ============================================================================
export const DEADZONE = 0.1;
export const MAX_SPEED = 8;
export const LOOK_SPEED = 1.8;
export const MOUSE_SENSITIVITY = 0.0025;
export const CAMERA_HEIGHT = 1.6;
export const MAX_PITCH = Math.PI / 2 - 0.08;

// ============================================================================
// Multiplayer Constants
// ============================================================================
export const SYNC_INTERVAL = 50;
export const POSITION_LERP = 10;
export const REMOTE_LERP = 8;
export const AVATAR_HEIGHT = 0.9;

// ============================================================================
// Shared Vectors (reusable to avoid allocations)
// ============================================================================
export const UP = new THREE.Vector3(0, 1, 0);
export const ZERO_AXIS = { x: 0, y: 0 };

// ============================================================================
// Hall Dimensions
// ============================================================================
export const HALL_SCALE = 5;
export const SCALE = (value) => value * HALL_SCALE;

// Room dimensions - 5x wider and longer than original
export const HALL_WIDTH = SCALE(44 * 5);  // 5x original width
export const HALL_LENGTH = SCALE(110 * 5);  // 5x original length
export const HALL_HEIGHT = SCALE(32);

// Render distance based on largest room dimension
export const MAX_ROOM_DIMENSION = Math.max(HALL_WIDTH, HALL_LENGTH, HALL_HEIGHT);
export const RENDER_DISTANCE = MAX_ROOM_DIMENSION * 1.5;

// Wall/Floor/Ceiling dimensions
export const WALL_THICKNESS = SCALE(1.6);
export const FLOOR_THICKNESS = SCALE(1.2);
export const CEILING_THICKNESS = SCALE(1.1);

// Boundary calculations
export const BOUNDARY_MARGIN = 1.2;
export const HALL_HALF_WIDTH = HALL_WIDTH / 2;
export const HALL_HALF_LENGTH = HALL_LENGTH / 2;

// ============================================================================
// Door/Arch Dimensions
// ============================================================================
export const DOOR_WIDTH = SCALE(14);
export const DOOR_HEIGHT = SCALE(18);  // Height to arch spring point
export const ARCH_RADIUS = DOOR_WIDTH / 2;  // Semicircular arch
export const TOTAL_DOOR_HEIGHT = DOOR_HEIGHT + ARCH_RADIUS;  // Full height including arch

// ============================================================================
// Column Dimensions
// ============================================================================
export const COLUMN_BASE_HEIGHT = SCALE(4.0);  // Wide base at bottom
export const COLUMN_RING_HEIGHT = SCALE(1.5);  // Transition piece
export const COLUMN_CAP_HEIGHT = SCALE(3.0);   // Capital at top
export const COLUMN_TOP_HEIGHT = SCALE(2.0);   // Top piece
export const COLUMN_CLEARANCE = SCALE(0.1);
export const COLUMN_TOTAL_HEIGHT = Math.max(SCALE(6), HALL_HEIGHT - COLUMN_CLEARANCE);
export const COLUMN_SHAFT_HEIGHT = Math.max(
  SCALE(4),
  COLUMN_TOTAL_HEIGHT - COLUMN_BASE_HEIGHT - COLUMN_RING_HEIGHT - COLUMN_CAP_HEIGHT - COLUMN_TOP_HEIGHT
);
export const COLUMN_SHAFT_Y = COLUMN_BASE_HEIGHT + COLUMN_RING_HEIGHT + COLUMN_SHAFT_HEIGHT / 2;
export const COLUMN_CAP_Y = COLUMN_BASE_HEIGHT + COLUMN_RING_HEIGHT + COLUMN_SHAFT_HEIGHT + COLUMN_CAP_HEIGHT / 2;
export const COLUMN_TOP_Y = COLUMN_BASE_HEIGHT + COLUMN_RING_HEIGHT + COLUMN_SHAFT_HEIGHT + COLUMN_CAP_HEIGHT + COLUMN_TOP_HEIGHT / 2;

// ============================================================================
// Texture Repeat Calculations
// ============================================================================
export const FLOOR_TILE_SIZE = SCALE(8);  // Each tile represents 8 scaled units
export const FLOOR_REPEAT_X = Math.ceil(HALL_WIDTH / FLOOR_TILE_SIZE);
export const FLOOR_REPEAT_Z = Math.ceil(HALL_LENGTH / FLOOR_TILE_SIZE);
export const WALL_TILE_SIZE = SCALE(6);
export const WALL_REPEAT_H = Math.ceil(HALL_LENGTH / WALL_TILE_SIZE);
export const WALL_REPEAT_V = Math.ceil(HALL_HEIGHT / WALL_TILE_SIZE);
