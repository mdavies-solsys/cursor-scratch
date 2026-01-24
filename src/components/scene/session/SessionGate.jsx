/**
 * Session Gate
 * Monitors XR session state and renders appropriate session world
 */
import React, { useEffect } from "react";
import { useXR } from "@react-three/xr";
import SessionWorld from "./SessionWorld.jsx";

/**
 * SessionGate - Renders SessionWorld only when XR session is active
 */
const SessionGate = ({ onSessionChange }) => {
  const session = useXR((state) => state.session);

  useEffect(() => {
    if (onSessionChange) {
      onSessionChange(session ?? null);
    }
  }, [onSessionChange, session]);

  if (!session) {
    return null;
  }

  return <SessionWorld />;
};

export default SessionGate;
