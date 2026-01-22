import React, { useCallback, useRef, useState } from "react";

const STICK_RADIUS = 40;

const clampAxis = (value) => Math.min(1, Math.max(-1, value));

const VirtualJoystick = ({ label, axisRef, side }) => {
  const baseRef = useRef(null);
  const pointerIdRef = useRef(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const updateAxis = useCallback(
    (x, y) => {
      if (axisRef?.current) {
        axisRef.current.x = x;
        axisRef.current.y = y;
      }
    },
    [axisRef]
  );

  const updateFromEvent = useCallback(
    (event) => {
      const base = baseRef.current;
      if (!base) {
        return;
      }
      const rect = base.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = event.clientX - centerX;
      const dy = event.clientY - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const clampedDistance = Math.min(distance, STICK_RADIUS);
      const angle = Math.atan2(dy, dx);
      const clampedX = distance > 0 ? Math.cos(angle) * clampedDistance : 0;
      const clampedY = distance > 0 ? Math.sin(angle) * clampedDistance : 0;
      const normalizedX = clampAxis(clampedX / STICK_RADIUS);
      const normalizedY = clampAxis(clampedY / STICK_RADIUS);

      setKnob({ x: clampedX, y: clampedY });
      updateAxis(normalizedX, normalizedY);
    },
    [updateAxis]
  );

  const reset = useCallback(() => {
    setKnob({ x: 0, y: 0 });
    updateAxis(0, 0);
  }, [updateAxis]);

  const handlePointerDown = (event) => {
    if (!baseRef.current) {
      return;
    }
    pointerIdRef.current = event.pointerId;
    baseRef.current.setPointerCapture(event.pointerId);
    updateFromEvent(event);
  };

  const handlePointerMove = (event) => {
    if (pointerIdRef.current !== event.pointerId) {
      return;
    }
    updateFromEvent(event);
  };

  const handlePointerUp = (event) => {
    if (pointerIdRef.current !== event.pointerId) {
      return;
    }
    pointerIdRef.current = null;
    baseRef.current?.releasePointerCapture(event.pointerId);
    reset();
  };

  const handlePointerCancel = (event) => {
    if (pointerIdRef.current !== event.pointerId) {
      return;
    }
    pointerIdRef.current = null;
    reset();
  };

  return (
    <div
      className={`touch-joystick touch-joystick--${side}`}
      ref={baseRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      aria-label={label}
    >
      <div className="touch-joystick__base"></div>
      <div
        className="touch-joystick__knob"
        style={{ transform: `translate(-50%, -50%) translate(${knob.x}px, ${knob.y}px)` }}
      ></div>
      <span className="touch-joystick__label">{label}</span>
    </div>
  );
};

const TouchControls = ({ leftAxisRef, rightAxisRef, visible }) => {
  if (!visible) {
    return null;
  }

  return (
    <div className="touch-controls" aria-hidden={!visible}>
      <VirtualJoystick side="left" label="Move" axisRef={leftAxisRef} />
      <VirtualJoystick side="right" label="Look" axisRef={rightAxisRef} />
    </div>
  );
};

export default TouchControls;
