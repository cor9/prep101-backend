import React, { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext.jsx';

const S = {
  page: {
    minHeight: '100vh',
    background: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(255,77,77,0.12) 0%, transparent 70%), #0a0a0f',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 24px',
  },
  logo: {
    fontFamily: 'Fraunces, serif',
    fontSize: '1.6rem',
    fontWeight: 900,
    color: '#F0EEF5',
    marginBottom: 8,
    letterSpacing: '-0.02em',
  },
  logoSub: { fontSize: 12, color: 'rgba(240,238,245,0.35)', marginBottom: 40, letterSpacing: '0.06em', textTransform: 'uppercase' },
  card: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: 18,
    padding: '36px 40px',
    width: '100%',
    maxWidth: 420,
  },
  title: { fontFamily: 'Fraunces, serif', fontSize: '1.7rem', fontWeight: 900, color: '#F0EEF5', marginBottom: 6, },
  sub: { fontSize: 14, color: 'rgba(240,238,245,0.45)', marginBottom: 28, lineHeight: 1.5, },
  field: { marginBottom: 16 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(240,238,245,0.5)', marginBottom: 5, letterSpacing: '0.04em', },
  input: {
    width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 10, padding: '12px 14px', fontSize: 15, color: '#F0EEF5', outline: 'none',
    boxSizing: 'border-box', transition: 'border-color 0.2s',
  },
  btn: {
    width: '100%', background: 'linear-gradient(135deg, #FF4D4D 0%, #F5A623 100%)',
    color: '#fff', border: 'none', borderRadius: 10, padding: '14px', fontSize: 15,
    fontWeight: 700, cursor: 'pointer', marginTop: 8, boxShadow: '0 4px 20px rgba(255,77,77,0.25)',
    transition: 'opacity 0.2s',
  },
  footer: { marginTop: 24, textAlign: 'center', fontSize: 13.5, color: 'rgba(240,238,245,0.35)', },
  footerLink: { color: '#FF4D4D', textDecoration: 'none', fontWeight: 600, },
};

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const nextDestination = useMemo(
    () => new URLSearchParams(location.search).get('next'),
    [location.search]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { toast.error('Email and password required'); return; }
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back!');
      if (nextDestination) {
        navigate(nextDestination, { replace: true });
        return;
      }
      navigate('/generate');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={S.page}>
      <style>{`.auth-input:focus { border-color: rgba(255,77,77,0.5) !important; } .auth-btn:hover:not(:disabled) { opacity: 0.88; }`}</style>
      <div style={S.logo}>Bold Choices</div>
      <div style={S.logoSub}>by Prep101</div>
      <form style={S.card} onSubmit={handleSubmit}>
        <div style={S.title}>Welcome back.</div>
        <div style={S.sub}>Sign in to generate your bold choices.</div>
        <div style={S.field}>
          <label style={S.label}>Email</label>
          <input className="auth-input" style={S.input} type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
        </div>
        <div style={S.field}>
          <label style={S.label}>Password</label>
          <input className="auth-input" style={S.input} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
        </div>
        <button className="auth-btn" style={S.btn} type="submit" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
        <div style={S.footer}>
          No account?{' '}
          <Link to={nextDestination ? `/register?next=${encodeURIComponent(nextDestination)}` : '/register'} style={S.footerLink}>Create one free</Link>
        </div>
      </form>
    </div>
  );
}
