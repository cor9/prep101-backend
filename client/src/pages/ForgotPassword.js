import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import Footer from '../components/Footer';
import API_BASE from '../config/api';
import '../styles/shared.css';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        setSubmitted(true);
        toast.success('Password reset email sent! Check your inbox.');
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to send reset email');
      }
    } catch (error) {
      toast.error('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="page-dark">
        <div className="container-wide" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 80px)' }}>
          <div className="card-white" style={{ maxWidth: '400px', width: '100%', textAlign: 'center' }}>
            <div style={{
              width: '64px',
              height: '64px',
              background: 'var(--gold-grad)',
              borderRadius: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#2f2500',
              fontWeight: 'bold',
              fontSize: '2rem',
              margin: '0 auto 1rem',
              boxShadow: '0 4px 15px rgba(255,200,58,0.3)'
            }}>
              ✓
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--gray-700)', marginBottom: '1rem' }}>
              Check Your Email
            </h2>
            <p style={{ color: 'var(--gray-500)', marginBottom: '1.5rem', lineHeight: '1.6' }}>
              We've sent a password reset link to <strong>{email}</strong>. 
              Click the link in your email to reset your password.
            </p>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem' }}>
              <p style={{ color: '#166534', fontSize: '0.875rem', margin: 0 }}>
                <strong>Didn't receive the email?</strong> Check your spam folder or try again.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                onClick={() => setSubmitted(false)}
                className="btn btnSecondary"
              >
                Try Again
              </button>
              <Link to="/login" className="btn btnGhost" style={{ textDecoration: 'none' }}>
                Back to Login
              </Link>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <Footer />
      </div>
    );
  }

  return (
    <div className="page-dark">
      <div className="container-wide" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 80px)' }}>
        <div className="card-white" style={{ maxWidth: '400px', width: '100%' }}>
          <div className="text-center mb-4">
            <div style={{
              width: '64px',
              height: '64px',
              background: 'var(--gold-grad)',
              borderRadius: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#2f2500',
              fontWeight: 'bold',
              fontSize: '2rem',
              margin: '0 auto 1rem',
              boxShadow: '0 4px 15px rgba(255,200,58,0.3)'
            }}>
              🔑
            </div>
            <h2 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--gray-700)', marginBottom: '0.5rem' }}>
              Forgot Password?
            </h2>
            <p style={{ color: 'var(--gray-500)' }}>
              Enter your email and we'll send you a reset link
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="form-group">
              <label className="form-label">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                required
                placeholder="Enter your email address"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btnPrimary"
              style={{ marginTop: '0.5rem' }}
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>

          <div className="text-center mt-3">
            <p style={{ color: 'var(--gray-500)', marginBottom: '1rem' }}>
              Remember your password?{' '}
              <Link to="/login" style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: '600' }}>
                Sign in here
              </Link>
            </p>
            <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>
              Don't have an account?{' '}
              <Link to="/register" style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: '600' }}>
                Sign up here
              </Link>
            </p>
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <Footer />
    </div>
  );
};

export default ForgotPassword;
