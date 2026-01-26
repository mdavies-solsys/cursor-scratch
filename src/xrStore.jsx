import React from "react";
import { createXRStore, XRControllerModel } from "@react-three/xr";

const LeftControllerModel = () => <XRControllerModel />;
// Right controller model hidden - we render our own sword there
// Note: Must return a valid group (not null) so the object reference exists for VRSword tracking
const RightControllerModel = () => <group />;

const xrStore = createXRStore({
  offerSession: false,
  controller: {
    left: LeftControllerModel,
    right: RightControllerModel,
  },
  hand: false,
  transientPointer: false,
  gaze: false,
  screenInput: false,
  optionalFeatures: ["local-floor", "bounded-floor"],
});

export default xrStore;
