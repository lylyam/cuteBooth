import { HashRouter, Routes, Route } from 'react-router-dom';
import { PhotoBoothProvider } from './context/PhotoBoothContext';
import HomePage from './pages/homePage/HomePage';
import LayoutPage from './pages/layoutPage/LayoutPage';
import CameraPage from './pages/cameraPage/CameraPage';
import UploadPage from './pages/uploadPage/UploadPage';
import ReviewPage from './pages/reviewPage/ReviewPage';
import DecorationPage from './pages/decorationPage/DecorationPage';
import FinalPage from './pages/finalPage/FinalPage';

function App() {
  return (
    <HashRouter>
      <PhotoBoothProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/layout" element={<LayoutPage />} />
          <Route path="/camera" element={<CameraPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/decoration" element={<DecorationPage />} />
          <Route path="/final" element={<FinalPage />} />
        </Routes>
      </PhotoBoothProvider>
    </HashRouter>
  );
}

export default App;
