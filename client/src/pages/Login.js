import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login(formData.email, formData.password);
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #2dd4bf 0%, #06b6d4 50%, #1d4ed8 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem'
    }}>
      <div style={{
        maxWidth: '400px',
        width: '100%',
        background: 'white',
        borderRadius: '1.5rem',
        boxShadow: '0 25px 80px rgba(0,0,0,0.15)',
        padding: '2rem'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '64px',
            height: '64px',
            background: 'linear-gradient(135deg, #2dd4bf 0%, #06b6d4 100%)',
            borderRadius: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '2rem',
            margin: '0 auto 1rem',
            boxShadow: '0 4px 15px rgba(45, 212, 191, 0.3)'
          }}>
            P
          </div>
          <h2 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#374151', marginBottom: '0.5rem' }}>
            Welcome Back
          </h2>
          <p style={{ color: '#6b7280' }}>Sign in to your PREP101 account</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <label style={{ 
              display: 'block', 
              fontSize: '0.9rem', 
              fontWeight: '600', 
              color: '#374151',
              marginBottom: '0.5rem'
            }}>
              Email Address
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '2px solid #e5e7eb',
                borderRadius: '0.75rem',
                fontSize: '1rem',
                transition: 'all 0.3s ease',
                outline: 'none'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#2dd4bf';
                e.target.style.boxShadow = '0 0 0 3px rgba(45, 212, 191, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e5e7eb';
                e.target.style.boxShadow = 'none';
              }}
              required
            />
          </div>

          <div>
            <label style={{ 
              display: 'block', 
              fontSize: '0.9rem', 
              fontWeight: '600', 
              color: '#374151',
              marginBottom: '0.5rem'
            }}>
              Password
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '2px solid #e5e7eb',
                borderRadius: '0.75rem',
                fontSize: '1rem',
                transition: 'all 0.3s ease',
                outline: 'none'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#2dd4bf';
                e.target.style.boxShadow = '0 0 0 3px rgba(45, 212, 191, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e5e7eb';
                e.target.style.boxShadow = 'none';
              }}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              background: loading ? '#9ca3af' : 'linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%)',
              color: 'white',
              padding: '0.75rem',
              border: 'none',
              borderRadius: '0.75rem',
              fontWeight: '600',
              fontSize: '1rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease'
            }}
            onMouseOver={(e) => {
              if (!loading) {
                e.target.style.background = 'linear-gradient(135deg, #0d9488 0%, #0891b2 100%)';
              }
            }}
            onMouseOut={(e) => {
              if (!loading) {
                e.target.style.background = 'linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%)';
              }
            }}
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <p style={{ color: '#6b7280' }}>
            Don't have an account?{' '}
            <Link 
              to="/register" 
              style={{ 
                color: '#14b8a6', 
                fontWeight: '600', 
                textDecoration: 'none'
              }}
              onMouseOver={(e) => e.target.style.color = '#0d9488'}
              onMouseOut={(e) => e.target.style.color = '#14b8a6'}
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
