import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import SignerPage from './pages/SignerPage';
import VerifierPage from './pages/VerifierPage';
import authService from './services/authService';
import './App.css';

function App() {
  const isAuthenticated = authService.isAuthenticated();
  const role = authService.getRole();

  // Komponent dla chronionej trasy użytkownika
  const UserRoute = ({ children }: { children: React.ReactNode }) => {
    if (!isAuthenticated) return <Navigate to="/login" />;
    if (role !== 'user') return <Navigate to="/verifier" />;
    return <>{children}</>;
  };

  // Komponent dla chronionej trasy admina
  const AdminRoute = ({ children }: { children: React.ReactNode }) => {
    if (!isAuthenticated) return <Navigate to="/login" />;
    if (role !== 'admin') return <Navigate to="/signer" />;
    return <>{children}</>;
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        
        <Route 
          path="/signer" 
          element={
            <UserRoute>
              <SignerPage />
            </UserRoute>
          } 
        />
        
        <Route 
          path="/verifier" 
          element={
            <AdminRoute>
              <VerifierPage />
            </AdminRoute>
          } 
        />
        <Route path="/" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
