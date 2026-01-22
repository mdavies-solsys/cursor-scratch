import React from "react";
import { Route, Routes } from "react-router-dom";
import Home from "./pages/Home.jsx";
import VrIntro from "./pages/VrIntro.jsx";

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/vr-intro" element={<VrIntro />} />
      <Route path="*" element={<Home />} />
    </Routes>
  );
};

export default App;
