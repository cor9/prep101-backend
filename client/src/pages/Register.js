import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import '../styles/shared.css';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      toast.error('Password must contain at least one uppercase letter, one lowercase letter, and one number');
      return;
    }

    setLoading(true);

    try {
      await register(formData.name, formData.email, formData.password);
      toast.success('Account created successfully!');
      navigate('/account');
    } catch (error) {
      console.error('Registration error:', error);
      
      // Handle validation errors from backend
      if (error.response?.data?.errors) {
        const validationErrors = error.response.data.errors;
        validationErrors.forEach(err => {
          toast.error(`${err.param}: ${err.msg}`);
        });
      } else {
        toast.error(error.response?.data?.message || 'Registration failed');
      }
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
              Join PREP101
            </h2>
            <p style={{ color: 'var(--gray-500)' }}>Create your account to get started</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="form-group">
              <label className="form-label">
                Full Name
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="form-input"
                required
              />
            </div>

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
              <small style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                Must be at least 8 characters with uppercase, lowercase, and number
              </small>
            </div>

            <div className="form-group">
              <label className="form-label">
                Confirm Password
              </label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
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
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <div className="text-center mt-3">
            <p style={{ color: 'var(--gray-500)', marginBottom: '1rem' }}>
              Already have an account?{' '}
              <Link to="/login" style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: '600' }}>
                Sign in here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
