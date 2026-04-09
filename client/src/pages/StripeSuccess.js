import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import API_BASE from '../config/api';
import '../App.css';

const StripeSuccess = () => {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [countdown, setCountdown] = useState(3);
  const [syncMessage, setSyncMessage] = useState('Syncing your subscription...');

  useEffect(() => {
    // Start countdown and redirect
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate('/dashboard');
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate]);

  useEffect(() => {
    const token = user?.accessToken || user?.token || localStorage.getItem('prep101_token');
    if (!token) {
      setSyncMessage('Processing your purchase...');
      return;
    }

    let cancelled = false;

    const syncSubscription = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/stripe/sync-subscription`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        const result = await response.json().catch(() => ({}));

        if (cancelled) return;

        if (response.ok && result?.success) {
          try {
            await refreshUser();
          } catch (refreshError) {
            console.warn('Could not refresh user after Stripe sync:', refreshError);
          }
          if (result.synced) {
            setSyncMessage('Your subscription is active and linked to your account.');
          } else {
            setSyncMessage('Purchase received. Finalizing account access...');
          }
        } else {
          setSyncMessage('Purchase received. Finishing account setup...');
        }
      } catch (error) {
        if (!cancelled) {
          setSyncMessage('Purchase received. Finishing account setup...');
        }
      }
    };

    syncSubscription();

    return () => {
      cancelled = true;
    };
  }, [user, refreshUser]);

  return (
    <div className="stripe-success-container">
      <div className="stripe-success-content">
        <div className="success-icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        
        <h1 className="success-title">Payment Successful!</h1>
        
        <div className="processing-message">
          <LoadingSpinner size="medium" />
          <p>Processing your purchase...</p>
          <p>{syncMessage}</p>
          <p className="countdown">Redirecting to dashboard in {countdown} seconds</p>
        </div>
        
        <div className="success-details">
          <p>Your subscription has been updated and will be active shortly.</p>
          <p>You'll be redirected to your dashboard where you can see your new plan limits.</p>
        </div>
        
        <button 
          className="dashboard-button"
          onClick={() => navigate('/dashboard')}
        >
          Go to Dashboard Now
        </button>
      </div>
    </div>
  );
};

export default StripeSuccess;
