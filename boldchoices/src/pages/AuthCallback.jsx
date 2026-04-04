import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * AuthCallback — receives token from prep101.site auth bridge.
 * URL: /auth-callback?token=JWT&redirect=/generate
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const redirect = params.get('redirect') || '/generate';

    if (token) {
      loginWithToken(token);
      navigate(redirect, { replace: true });
    } else {
      // No token — send to prep101 bridge
      const callbackUrl = `${window.location.origin}/auth-callback?redirect=${encodeURIComponent(redirect)}`;
      window.location.href = `https://prep101.site/auth-bridge?redirect=${encodeURIComponent(callbackUrl)}`;
    }
  }, []);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0a0a0f', color: 'rgba(240,238,245,0.6)', fontFamily: 'DM Sans, sans-serif'
    }}>
      <p>Signing you in…</p>
    </div>
  );
}
