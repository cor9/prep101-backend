import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { StripeProvider } from './contexts/StripeContext';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import Pricing from './pages/Pricing';
import Examples from './pages/Examples';
import GuideView from './pages/GuideView';
import StripeSuccess from './pages/StripeSuccess';
import PaymentSuccess from './pages/PaymentSuccess';
import SubscriptionManager from './components/SubscriptionManager';
import Terms from './pages/Terms';
import AdminDashboard from './pages/AdminDashboard';
import './App.css';

// Initialize Stripe
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

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
      <StripeProvider>
        <Elements stripe={stripePromise}>
          <Router>
            <div className="App">
              <Toaster position="top-right" />
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/examples" element={<Examples />} />
                <Route
                  path="/account"
                  element={<Navigate to="/dashboard" replace />}
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
                <Route
                  path="/subscription"
                  element={
                    <ProtectedRoute>
                      <SubscriptionManager />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute>
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route path="/app/stripe/success" element={<StripeSuccess />} />
                <Route path="/payment-success" element={<PaymentSuccess />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/" element={<Home />} />
              </Routes>
            </div>
          </Router>
        </Elements>
      </StripeProvider>
    </AuthProvider>
  );
}

export default App;
