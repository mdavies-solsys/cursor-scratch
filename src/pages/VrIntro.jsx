import React, { useEffect, useState } from "react";
import Scene from "../components/Scene.jsx";
import xrStore from "../xrStore.jsx";

const VrIntro = () => {
  const [xrSupported, setXrSupported] = useState(false);
  const [xrChecking, setXrChecking] = useState(true);
  const [xrError, setXrError] = useState("");
  const [session, setSession] = useState(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);

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
          setXrError("WebXR requires HTTPS. Open this page on a secure origin.");
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
      return;
    }
    setSessionEnded(false);
    const handleEnd = () => {
      setSessionEnded(true);
    };
    const handleVisibility = () => {
      if (session.visibilityState === "hidden") {
        setSessionEnded(true);
      }
    };
    session.addEventListener("end", handleEnd);
    session.addEventListener("visibilitychange", handleVisibility);
    return () => {
      session.removeEventListener("end", handleEnd);
      session.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [session]);

  const handleEnter = async () => {
    if (!navigator?.xr || !xrSupported || isRequesting || session || !sceneReady) {
      return;
    }
    setIsRequesting(true);
    setXrError("");
    setSessionEnded(false);
    try {
      await xrStore.enterXR("immersive-vr");
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

  const shouldRenderScene = xrSupported || session;
  const buttonLabel = isRequesting ? "Entering..." : sceneReady ? "Enter VR" : "Preparing VR...";
  const noticeMessage = xrError
    ? xrError
    : sessionEnded
    ? "VR session ended. Tap Enter VR to try again."
    : xrChecking
    ? "Checking for VR headset..."
    : !xrSupported
    ? "VR headset required."
    : "";

  return (
    <>
      {shouldRenderScene ? (
        <Scene store={xrStore} onSessionChange={setSession} onReady={() => setSceneReady(true)} />
      ) : null}
      {!session && (
        <div className="vr-intro">
          <div className="vr-intro__content">
            <h1 className="vr-intro__title">Matt’s World</h1>
            <p className="vr-intro__text">A quiet space. No rules. Just move and see who’s around.</p>
            {xrSupported || session ? (
              <button
                className="vr-intro__button"
                type="button"
                onClick={handleEnter}
                disabled={isRequesting || !sceneReady}
              >
                {buttonLabel}
              </button>
            ) : null}
            {noticeMessage ? <span className="vr-intro__notice">{noticeMessage}</span> : null}
          </div>
        </div>
      )}
    </>
  );
};

export default VrIntro;
