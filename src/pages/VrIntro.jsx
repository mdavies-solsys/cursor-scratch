import React, { useEffect, useMemo, useRef, useState } from "react";
import Scene from "../components/Scene.jsx";
import TouchControls from "../components/TouchControls.jsx";
import xrStore from "../xrStore.jsx";

const VrIntro = () => {
  const [xrSupported, setXrSupported] = useState(false);
  const [xrChecking, setXrChecking] = useState(true);
  const [xrError, setXrError] = useState("");
  const [session, setSession] = useState(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [inputSourcesCount, setInputSourcesCount] = useState(0);
  const [sessionVisibility, setSessionVisibility] = useState("");
  const [sessionBlendMode, setSessionBlendMode] = useState("");
  const [sessionInteractionMode, setSessionInteractionMode] = useState("");
  const diagnosticsRootRef = useRef(null);
  const leftAxisRef = useRef({ x: 0, y: 0 });
  const rightAxisRef = useRef({ x: 0, y: 0 });
  const [entered, setEntered] = useState(false);
  const xrAvailable = typeof navigator !== "undefined" && Boolean(navigator.xr);
  const isTouchDevice =
    typeof window !== "undefined" &&
    (navigator.maxTouchPoints > 0 || window.matchMedia?.("(pointer: coarse)")?.matches);

  useEffect(() => {
    let isMounted = true;
    const checkSupport = () => {
      if (!navigator?.xr?.isSessionSupported) {
        if (isMounted) {
          setXrSupported(false);
          setXrChecking(false);
        }
        return;
      }
      if (typeof window !== "undefined" && !window.isSecureContext) {
        if (isMounted) {
          setXrSupported(false);
          setXrChecking(false);
          setXrError("WebXR requires HTTPS. Non-VR entry still works on insecure origins.");
        }
        return;
      }
      setXrChecking(true);
      setXrError("");
      navigator.xr
        .isSessionSupported("immersive-vr")
        .then((supported) => {
          if (isMounted) {
            setXrSupported(Boolean(supported));
          }
        })
        .catch(() => {
          if (isMounted) {
            setXrSupported(false);
          }
        })
        .finally(() => {
          if (isMounted) {
            setXrChecking(false);
          }
        });
    };

    checkSupport();
    navigator?.xr?.addEventListener?.("devicechange", checkSupport);
    return () => {
      isMounted = false;
      navigator?.xr?.removeEventListener?.("devicechange", checkSupport);
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setInputSourcesCount(0);
      setSessionVisibility("");
      setSessionBlendMode("");
      setSessionInteractionMode("");
      return;
    }
    setSessionEnded(false);
    setInputSourcesCount(session.inputSources?.length ?? 0);
    setSessionVisibility(session.visibilityState || "");
    setSessionBlendMode(session.environmentBlendMode || "");
    setSessionInteractionMode(session.interactionMode || "");
    const handleEnd = () => {
      setSessionEnded(true);
    };
    const handleVisibility = () => {
      setSessionVisibility(session.visibilityState || "");
      if (session.visibilityState === "hidden") {
        setSessionEnded(true);
      }
    };
    const handleInputSources = () => {
      setInputSourcesCount(session.inputSources?.length ?? 0);
    };
    session.addEventListener("end", handleEnd);
    session.addEventListener("visibilitychange", handleVisibility);
    session.addEventListener("inputsourceschange", handleInputSources);
    return () => {
      session.removeEventListener("end", handleEnd);
      session.removeEventListener("visibilitychange", handleVisibility);
      session.removeEventListener("inputsourceschange", handleInputSources);
    };
  }, [session]);

  const handleEnter = async () => {
    if (!navigator?.xr || !xrSupported || isRequesting || session || !sceneReady) {
      if (!xrSupported && !isRequesting && !session && sceneReady) {
        setEntered(true);
      }
      return;
    }
    setIsRequesting(true);
    setXrError("");
    setSessionEnded(false);
    try {
      const overlayRoot = diagnosticsRootRef.current;
      const sessionInit = overlayRoot
        ? {
            optionalFeatures: ["local-floor", "bounded-floor", "dom-overlay"],
            domOverlay: { root: overlayRoot },
          }
        : undefined;
      await xrStore.enterXR("immersive-vr", sessionInit);
    } catch (error) {
      console.error("Unable to enter VR session", error);
      const message =
        error?.name === "NotAllowedError"
          ? "VR entry was cancelled. Accept the headset prompt to continue."
          : "Unable to enter VR session. Please reload and try again.";
      setXrError(message);
    } finally {
      setIsRequesting(false);
    }
  };

  const flatActive = entered && !session;
  const flatControls = useMemo(
    () => ({
      active: flatActive,
      leftAxisRef,
      rightAxisRef,
      enablePointerLock: !isTouchDevice,
    }),
    [flatActive, isTouchDevice, leftAxisRef, rightAxisRef]
  );
  const showTouchControls = flatActive && isTouchDevice;
  const buttonLabel = isRequesting ? "Entering..." : sceneReady ? "Enter Matt’s World" : "Preparing world...";
  const noticeMessage = xrError
    ? xrError
    : sessionEnded
    ? "VR session ended. Tap Enter Matt’s World to try again."
    : xrChecking
    ? "Checking for VR headset..."
    : "";
  const secureContext = typeof window !== "undefined" ? window.isSecureContext : false;
  const pageVisibility = typeof document !== "undefined" ? document.visibilityState : "unknown";

  return (
    <>
      <Scene
        store={xrStore}
        onSessionChange={setSession}
        onReady={() => setSceneReady(true)}
        flatControls={flatControls}
        xrEnabled={xrAvailable}
      />
      {!session && !entered && (
        <div className="vr-intro">
          <div className="vr-intro__content">
            <h1 className="vr-intro__title">Matt’s World</h1>
            <p className="vr-intro__text">
              Step into the same world from VR headsets, desktop browsers, mobile screens, and Steam Deck.
            </p>
            <ul className="vr-intro__controls">
              <li>
                <strong>VR:</strong> headset + controllers.
              </li>
              <li>
                <strong>Desktop:</strong> WASD + mouse look.
              </li>
              <li>
                <strong>Mobile & Steam Deck:</strong> dual analog sticks.
              </li>
            </ul>
            {xrSupported || session ? (
              <button
                className="vr-intro__button"
                type="button"
                onClick={handleEnter}
                disabled={isRequesting || !sceneReady}
              >
                {buttonLabel}
              </button>
            ) : (
              <button className="vr-intro__button" type="button" onClick={() => setEntered(true)} disabled={!sceneReady}>
                {buttonLabel}
              </button>
            )}
            {noticeMessage ? <span className="vr-intro__notice">{noticeMessage}</span> : null}
          </div>
        </div>
      )}
      <TouchControls leftAxisRef={leftAxisRef} rightAxisRef={rightAxisRef} visible={showTouchControls} />
      <div className="vr-diagnostics-root" ref={diagnosticsRootRef}>
        <div className="vr-diagnostics">
          <div className="vr-diagnostics__title">VR Diagnostics</div>
          <dl className="vr-diagnostics__list">
            <div className="vr-diagnostics__row">
              <dt>Secure Context</dt>
              <dd>{secureContext ? "yes" : "no"}</dd>
            </div>
            <div className="vr-diagnostics__row">
              <dt>XR Support</dt>
              <dd>{xrChecking ? "checking" : xrSupported ? "yes" : "no"}</dd>
            </div>
            <div className="vr-diagnostics__row">
              <dt>Scene Ready</dt>
              <dd>{sceneReady ? "yes" : "no"}</dd>
            </div>
            <div className="vr-diagnostics__row">
              <dt>Requesting</dt>
              <dd>{isRequesting ? "yes" : "no"}</dd>
            </div>
            <div className="vr-diagnostics__row">
              <dt>Session</dt>
              <dd>{session ? "active" : "none"}</dd>
            </div>
            <div className="vr-diagnostics__row">
              <dt>Session Visibility</dt>
              <dd>{sessionVisibility || "n/a"}</dd>
            </div>
            <div className="vr-diagnostics__row">
              <dt>Input Sources</dt>
              <dd>{session ? inputSourcesCount : "n/a"}</dd>
            </div>
            <div className="vr-diagnostics__row">
              <dt>Blend Mode</dt>
              <dd>{sessionBlendMode || "n/a"}</dd>
            </div>
            <div className="vr-diagnostics__row">
              <dt>Interaction</dt>
              <dd>{sessionInteractionMode || "n/a"}</dd>
            </div>
            <div className="vr-diagnostics__row">
              <dt>Page Visibility</dt>
              <dd>{pageVisibility}</dd>
            </div>
            <div className="vr-diagnostics__row">
              <dt>Last Error</dt>
              <dd>{xrError || "none"}</dd>
            </div>
          </dl>
        </div>
      </div>
    </>
  );
};

export default VrIntro;
