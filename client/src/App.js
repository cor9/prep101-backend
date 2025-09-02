import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Pricing from './pages/Pricing';
import Examples from './pages/Examples';
import Account from './pages/Account';
import GuideView from './pages/GuideView';
import StripeSuccess from './pages/StripeSuccess';
import './App.css';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  
  console.log('🔒 ProtectedRoute - user:', user ? 'logged in' : 'not logged in');
  console.log('🔒 ProtectedRoute - loading:', loading);
  
  if (loading) {
    console.log('🔒 ProtectedRoute - showing loading screen');
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: '#111827',
        color: '#f3f4f6'
      }}>
        <div>Loading...</div>
      </div>
    );
  }
  
  if (!user) {
    console.log('🔒 ProtectedRoute - redirecting to login');
    return <Navigate to="/login" />;
  }
  
  console.log('🔒 ProtectedRoute - rendering protected content');
  return children;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Toaster position="top-right" />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/examples" element={<Examples />} />
            <Route 
              path="/account" 
              element={
                <ProtectedRoute>
                  <Account />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/create-guide" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/guide/:id" 
              element={
                <ProtectedRoute>
                  <GuideView />
                </ProtectedRoute>
              } 
            />
            <Route path="/app/stripe/success" element={<StripeSuccess />} />
            <Route path="/" element={<Home />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
