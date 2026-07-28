import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { PhotoBoothProvider } from './context/PhotoBoothContext';
import HomePage from './pages/homePage/HomePage';
import LayoutPage from './pages/layoutPage/LayoutPage';
import UploadPage from './pages/uploadPage/UploadPage';
import ReviewPage from './pages/reviewPage/ReviewPage';
import FinalPage from './pages/finalPage/FinalPage';
/* Pendientes: los .tsx siguen a 0 bytes hasta que se cierren U1 y U3.
import CameraPage from './pages/cameraPage/CameraPage';
import DecorationPage from './pages/decorationPage/DecorationPage'; */

function App() {
  return (
    <BrowserRouter>
      <PhotoBoothProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/layout" element={<LayoutPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/final" element={<FinalPage />} />
          {/* Pendientes: U1 y U3.
          <Route path="/camera"     element={<CameraPage />} />
          <Route path="/decoration" element={<DecorationPage />} /> */}
        </Routes>
      </PhotoBoothProvider>
    </BrowserRouter>
  );
}

export default App;
