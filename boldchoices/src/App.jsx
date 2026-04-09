import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx';
import { buildPrepOnboardingUrl } from './utils/ecosystemLinks.js';
import Landing from './pages/Landing.jsx';
import Generate from './pages/Generate.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Admin from './pages/Admin.jsx';
import AuthCallback from './pages/AuthCallback.jsx';


function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        height: '100vh', background: '#0a0a0f', color: 'rgba(255,255,255,0.5)',
        fontSize: 14, letterSpacing: '0.05em'
      }}>
        Loading...
      </div>
    );
  }
  if (!user) {
    const redirect = `${location.pathname}${location.search || ''}`;
    return <Navigate to={`/auth-callback?redirect=${encodeURIComponent(redirect)}`} replace />;
  }
  if (user?.account?.onboardingRequired) {
    const token = user?.accessToken || user?.token;
    const next = `https://boldchoices.site${location.pathname}${location.search || ''}`;
    return <AccountSetupRedirect token={token} next={next} />;
  }
  return children;
}

function AccountSetupRedirect({ token, next }) {
  useEffect(() => {
    window.location.replace(buildPrepOnboardingUrl({ token, next }));
  }, [token, next]);

  return (
    <div style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      height: '100vh', background: '#0a0a0f', color: 'rgba(255,255,255,0.6)',
      fontSize: 14, letterSpacing: '0.05em'
    }}>
      Opening your Child Actor 101 account setup...
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1a1a24',
              color: '#F0EEF5',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 10,
              fontSize: 14,
              fontFamily: 'DM Sans, sans-serif',
            },
            success: { iconTheme: { primary: '#00D4C8', secondary: '#0a0a0f' } },
            error: { iconTheme: { primary: '#FF4D4D', secondary: '#0a0a0f' } },
          }}
        />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/generate"
            element={
              <ProtectedRoute>
                <Generate />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <Admin />
              </ProtectedRoute>
            }
          />
          <Route path="/auth-callback" element={<AuthCallback />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
