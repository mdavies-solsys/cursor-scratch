import React from "react";
import { Route, Routes } from "react-router-dom";
import Home from "./pages/Home.jsx";
import MobileBuild from "./pages/MobileBuild.jsx";
import VrIntro from "./pages/VrIntro.jsx";

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/mobile-build" element={<MobileBuild />} />
      <Route path="/game" element={<VrIntro />} />
      <Route path="*" element={<Home />} />
    </Routes>
  );
};

export default App;
