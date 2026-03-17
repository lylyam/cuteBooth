import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/homePage/HomePage';
import LayoutPage from './pages/layoutPage/LayoutPage';
/* import CameraPage from './pages/cameraPage/CameraPage';
import UploadPage from './pages/uploadPage/UploadPage';
import DecorationPage from './pages/decorationPage/DecorationPage';
import FinalPage from './pages/finalPage/FinalPage'; */ 

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"           element={<HomePage />} />
        <Route path="/layout"     element={<LayoutPage />} />
      {/*  <Route path="/camera"     element={<CameraPage />} />
        <Route path="/upload"     element={<UploadPage />} />
        <Route path="/decoration" element={<DecorationPage />} />
        <Route path="/final"      element={<FinalPage />} /> */ }
      </Routes>
    </BrowserRouter>
  );
};

export default App;