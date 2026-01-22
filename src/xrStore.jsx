import React from "react";
import { createXRStore, XRControllerModel } from "@react-three/xr";

const LeftControllerModel = () => <XRControllerModel />;

const xrStore = createXRStore({
  offerSession: false,
  controller: {
    left: LeftControllerModel,
    right: false,
  },
  hand: false,
  transientPointer: false,
  gaze: false,
  screenInput: false,
  optionalFeatures: ["local-floor", "bounded-floor", "hand-tracking"],
});

export default xrStore;
