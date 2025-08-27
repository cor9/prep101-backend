import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import '../App.css';

const StripeSuccess = () => {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(3);

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
