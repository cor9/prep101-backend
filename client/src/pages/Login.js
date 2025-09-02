import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import Footer from '../components/Footer';
import '../styles/shared.css';

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
      navigate('/account');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

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
              P
            </div>
            <h2 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--gray-700)', marginBottom: '0.5rem' }}>
              Welcome Back
            </h2>
            <p style={{ color: 'var(--gray-500)' }}>Sign in to your PREP101 account</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="form-group">
              <label className="form-label">
                Email Address
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                Password
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="form-input"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btnPrimary"
              style={{ marginTop: '0.5rem' }}
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          <div className="text-center mt-3">
            <p style={{ color: 'var(--gray-500)', marginBottom: '0.5rem' }}>
              <Link to="/forgot-password" style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: '600' }}>
                Forgot your password?
              </Link>
            </p>
            <p style={{ color: 'var(--gray-500)', marginBottom: '1rem' }}>
              Don't have an account?{' '}
              <Link to="/register" style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: '600' }}>
                Sign up here
              </Link>
            </p>
          </div>
        </div>
        
        {/* Footer */}
        <Footer />
      </div>
    </div>
  );
};

export default Login;
