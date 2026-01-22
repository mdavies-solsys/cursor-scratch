import React, { useEffect, useState } from "react";
import Scene from "../components/Scene.jsx";
import xrStore from "../xrStore.jsx";

const VrIntro = () => {
  const [xrSupported, setXrSupported] = useState(false);
  const [session, setSession] = useState(null);
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (navigator?.xr?.isSessionSupported) {
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
        });
    }
    return () => {
      isMounted = false;
    };
  }, []);

  const handleEnter = async () => {
    if (!navigator?.xr || isRequesting || session) {
      return;
    }
    setIsRequesting(true);
    try {
      const xrSession = await xrStore.enterXR("immersive-vr");
      if (!xrSession) {
        return;
      }
      xrSession.addEventListener(
        "end",
        () => {
          setSession(null);
        },
        { once: true }
      );
      setSession(xrSession);
    } catch (error) {
      console.error("Unable to enter VR session", error);
    } finally {
      setIsRequesting(false);
    }
  };

  if (session) {
    return <Scene store={xrStore} />;
  }

  return (
    <div className="vr-intro">
      <div className="vr-intro__content">
        <h1 className="vr-intro__title">Matt’s World</h1>
        <p className="vr-intro__text">A quiet space. No rules. Just move and see who’s around.</p>
        {xrSupported || session ? (
          <button className="vr-intro__button" type="button" onClick={handleEnter} disabled={isRequesting}>
            {isRequesting ? "Entering..." : "Enter VR"}
          </button>
        ) : (
          <span className="vr-intro__notice">VR headset required.</span>
        )}
      </div>
    </div>
  );
};

export default VrIntro;
