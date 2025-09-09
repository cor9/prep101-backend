import React, { createContext, useContext, useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { useAuth } from './AuthContext';
import API_BASE from '../config/api';

const StripeContext = createContext();

export const useStripe = () => useContext(StripeContext);

export const StripeProvider = ({ children }) => {
  const [stripe, setStripe] = useState(null);
  const [prices, setPrices] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // Initialize Stripe
  useEffect(() => {
    const initStripe = async () => {
      try {
        const stripeKey = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY;
        if (!stripeKey || stripeKey === 'pk_test_placeholder') {
          console.log('⚠️ Stripe key not configured, skipping Stripe initialization');
          setLoading(false);
          return;
        }
        
        const stripeInstance = await loadStripe(stripeKey);
        setStripe(stripeInstance);
        console.log('✅ Stripe initialized');
      } catch (error) {
        console.error('❌ Failed to initialize Stripe:', error);
      }
    };

    initStripe();
  }, []);

  // Load subscription prices
  const loadPrices = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/stripe/prices`);
      if (response.ok) {
        const data = await response.json();
        setPrices(data.prices);
        console.log('✅ Prices loaded:', data.prices);
      }
    } catch (error) {
      console.error('❌ Failed to load prices:', error);
    }
  };

  // Load user's subscription status
  const loadSubscriptionStatus = async () => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/stripe/subscription-status`, {
        headers: {
          'Authorization': `Bearer ${user.accessToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSubscription(data.subscription);
        console.log('✅ Subscription status loaded:', data.subscription);
      }
    } catch (error) {
      console.error('❌ Failed to load subscription status:', error);
    } finally {
      setLoading(false);
    }
  };

  // Create subscription
  const createSubscription = async (priceId, paymentMethodId) => {
    try {
      const response = await fetch(`${API_BASE}/api/stripe/create-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.accessToken}`
        },
        body: JSON.stringify({ priceId, paymentMethodId })
      });

      if (response.ok) {
        const data = await response.json();
        setSubscription(data.subscription);
        console.log('✅ Subscription created:', data.subscription);
        return { success: true, data };
      } else {
        const error = await response.json();
        console.error('❌ Failed to create subscription:', error);
        return { success: false, error };
      }
    } catch (error) {
      console.error('❌ Error creating subscription:', error);
      return { success: false, error: { message: 'Network error' } };
    }
  };

  // Cancel subscription
  const cancelSubscription = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/stripe/cancel-subscription`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.accessToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSubscription(data.subscription);
        console.log('✅ Subscription canceled:', data.subscription);
        return { success: true, data };
      } else {
        const error = await response.json();
        console.error('❌ Failed to cancel subscription:', error);
        return { success: false, error };
      }
    } catch (error) {
      console.error('❌ Error canceling subscription:', error);
      return { success: false, error: { message: 'Network error' } };
    }
  };

  // Reactivate subscription
  const reactivateSubscription = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/stripe/reactivate-subscription`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.accessToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSubscription(data.subscription);
        console.log('✅ Subscription reactivated:', data.subscription);
        return { success: true, data };
      } else {
        const error = await response.json();
        console.error('❌ Failed to reactivate subscription:', error);
        return { success: false, error };
      }
    } catch (error) {
      console.error('❌ Error reactivating subscription:', error);
      return { success: false, error: { message: 'Network error' } };
    }
  };

  // Create customer portal session
  const createCustomerPortalSession = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/stripe/create-customer-portal-session`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.accessToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        window.location.href = data.url;
        return { success: true, data };
      } else {
        const error = await response.json();
        console.error('❌ Failed to create customer portal session:', error);
        return { success: false, error };
      }
    } catch (error) {
      console.error('❌ Error creating customer portal session:', error);
      return { success: false, error: { message: 'Network error' } };
    }
  };

  // Load data when user changes
  useEffect(() => {
    loadPrices();
    loadSubscriptionStatus();
  }, [user]);

  const value = {
    stripe,
    prices,
    subscription,
    loading,
    createSubscription,
    cancelSubscription,
    reactivateSubscription,
    createCustomerPortalSession,
    loadSubscriptionStatus
  };

  return (
    <StripeContext.Provider value={value}>
      {children}
    </StripeContext.Provider>
  );
};
