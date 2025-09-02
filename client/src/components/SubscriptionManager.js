import React, { useState, useEffect } from 'react';
import { useStripe, useAuth } from '../contexts';
import { CardElement, useElements } from '@stripe/react-stripe-js';
import API_BASE from '../config/api';

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: '16px',
      color: '#424770',
      '::placeholder': {
        color: '#aab7c4',
      },
    },
    invalid: {
      color: '#9e2146',
    },
  },
};

const SubscriptionManager = () => {
  const { stripe, prices, subscription, loading, createSubscription, cancelSubscription, reactivateSubscription, createCustomerPortalSession } = useStripe();
  const { user } = useAuth();
  const [selectedPrice, setSelectedPrice] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const elements = useElements();

  const handlePriceSelect = (price) => {
    setSelectedPrice(price);
    setError(null);
    setSuccess(null);
  };

  const handleSubscribe = async (event) => {
    event.preventDefault();
    
    if (!selectedPrice) {
      setError('Please select a subscription plan');
      return;
    }

    if (!stripe || !elements) {
      setError('Stripe not loaded');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      // Create payment method
      const { error: paymentError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: elements.getElement(CardElement),
      });

      if (paymentError) {
        setError(paymentError.message);
        setProcessing(false);
        return;
      }

      // Create subscription
      const result = await createSubscription(selectedPrice.id, paymentMethod.id);
      
      if (result.success) {
        setSuccess('Subscription created successfully!');
        setSelectedPrice(null);
        // Clear card element
        elements.getElement(CardElement).clear();
      } else {
        setError(result.error.message || 'Failed to create subscription');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('Subscription error:', err);
    }

    setProcessing(false);
  };

  const handleCancelSubscription = async () => {
    if (!window.confirm('Are you sure you want to cancel your subscription? You can reactivate it anytime.')) {
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const result = await cancelSubscription();
      
      if (result.success) {
        setSuccess('Subscription will be canceled at the end of the current period');
      } else {
        setError(result.error.message || 'Failed to cancel subscription');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('Cancel error:', err);
    }

    setProcessing(false);
  };

  const handleReactivateSubscription = async () => {
    setProcessing(true);
    setError(null);

    try {
      const result = await reactivateSubscription();
      
      if (result.success) {
        setSuccess('Subscription reactivated successfully!');
      } else {
        setError(result.error.message || 'Failed to reactivate subscription');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('Reactivate error:', err);
    }

    setProcessing(false);
  };

  const handleManageBilling = async () => {
    setProcessing(true);
    setError(null);

    try {
      const result = await createCustomerPortalSession();
      
      if (!result.success) {
        setError(result.error.message || 'Failed to open billing portal');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('Billing portal error:', err);
    }

    setProcessing(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="text-lg">Loading subscription information...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Subscription Management</h2>
        <p className="text-gray-600">Manage your subscription and billing information</p>
      </div>

      {/* Current Subscription Status */}
      {subscription && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h3 className="text-xl font-semibold mb-4">Current Subscription</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <p className="font-medium capitalize">{subscription.status}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Plan</p>
              <p className="font-medium">{user?.subscription || 'Free'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Guides Used</p>
              <p className="font-medium">{user?.guidesUsed || 0} / {user?.guidesLimit || 1}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Next Billing</p>
              <p className="font-medium">
                {user?.currentPeriodEnd ? new Date(user.currentPeriodEnd).toLocaleDateString() : 'N/A'}
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {subscription.status === 'active' && (
              <>
                <button
                  onClick={handleManageBilling}
                  disabled={processing}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  Manage Billing
                </button>
                <button
                  onClick={handleCancelSubscription}
                  disabled={processing}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                >
                  Cancel Subscription
                </button>
              </>
            )}
            
            {subscription.status === 'canceled' && (
              <button
                onClick={handleReactivateSubscription}
                disabled={processing}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                Reactivate Subscription
              </button>
            )}
          </div>
        </div>
      )}

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-6">
          {success}
        </div>
      )}

      {/* Available Plans */}
      {!subscription || subscription.status === 'canceled' ? (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-semibold mb-6">Choose a Plan</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {prices.map((price) => (
              <div
                key={price.id}
                className={`border rounded-lg p-6 cursor-pointer transition-all ${
                  selectedPrice?.id === price.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => handlePriceSelect(price)}
              >
                <div className="flex justify-between items-start mb-4">
                  <h4 className="text-lg font-semibold">{price.name}</h4>
                  <span className="text-2xl font-bold">${price.price}</span>
                </div>
                <p className="text-gray-600 mb-4">per month</p>
                <ul className="space-y-2">
                  {price.features.map((feature, index) => (
                    <li key={index} className="flex items-center">
                      <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Payment Form */}
          {selectedPrice && (
            <form onSubmit={handleSubscribe} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Information
                </label>
                <div className="border border-gray-300 rounded-md p-4">
                  <CardElement options={CARD_ELEMENT_OPTIONS} />
                </div>
              </div>

              <button
                type="submit"
                disabled={processing}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing ? 'Processing...' : `Subscribe to ${selectedPrice.name} for $${selectedPrice.price}/month`}
              </button>
            </form>
          )}
        </div>
      ) : (
        <div className="bg-gray-50 rounded-lg p-6 text-center">
          <p className="text-gray-600">You have an active subscription. Use the buttons above to manage your billing.</p>
        </div>
      )}
    </div>
  );
};

export default SubscriptionManager;
