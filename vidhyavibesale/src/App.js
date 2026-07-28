import { BrowserRouter, Route, Routes } from 'react-router-dom';
import SalesLandingPage from './components/SalesLandingPage';
import PrivacyPage from './pages/PrivacyPage';
import RefundPolicyPage from './pages/RefundPolicyPage';
import TermsPage from './pages/TermsPage';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SalesLandingPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/refund-policy" element={<RefundPolicyPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
