import React, { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import Footer from '../components/Footer';
import '../styles/shared.css';

const resolvePostAuthDestination = (nextDestination, user) => {
  if (!nextDestination) return null;

  const token = user?.accessToken || user?.token;
  if (!token) return nextDestination;

  try {
    const url = new URL(nextDestination, window.location.origin);
    if (url.pathname === '/auth-bridge') {
      const redirect = url.searchParams.get('redirect');
      if (!redirect) return nextDestination;

      const bridgeTarget = new URL(redirect);
      bridgeTarget.searchParams.set('token', token);
      return bridgeTarget.toString();
    }

    if (
      url.origin !== window.location.origin &&
      /auth-callback(\.html)?$/i.test(url.pathname)
    ) {
      url.searchParams.set('token', token);
      return url.toString();
    }

    return nextDestination;
  } catch (_) {
    return nextDestination;
  }
};

const getLoginContext = (nextDestination) => {
  const destination = String(nextDestination || '').toLowerCase();

  if (destination.includes('reader101.site')) {
    return {
      badge: 'R',
      title: 'Welcome Back',
      subtitle: 'Sign in to your Child Actor 101 account for Reader101',
    };
  }

  if (destination.includes('boldchoices.site')) {
    return {
      badge: 'B',
      title: 'Welcome Back',
      subtitle: 'Sign in to your Child Actor 101 account for Bold Choices',
    };
  }

  return {
    badge: 'P',
    title: 'Welcome Back',
    subtitle: 'Sign in to your Child Actor 101 account',
  };
};

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const nextDestination = useMemo(
    () => new URLSearchParams(location.search).get('next'),
    [location.search]
  );
  const loginContext = useMemo(
    () => getLoginContext(nextDestination),
    [nextDestination]
  );

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
      const loggedInUser = await login(formData.email, formData.password);
      toast.success('Welcome back!');
      if (nextDestination) {
        window.location.replace(resolvePostAuthDestination(nextDestination, loggedInUser));
        return;
      }
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
              {loginContext.badge}
            </div>
            <h2 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--gray-700)', marginBottom: '0.5rem' }}>
              {loginContext.title}
            </h2>
            <p style={{ color: 'var(--gray-500)' }}>{loginContext.subtitle}</p>
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
              <Link to={nextDestination ? `/register?next=${encodeURIComponent(nextDestination)}` : '/register'} style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: '600' }}>
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

export default Login;
