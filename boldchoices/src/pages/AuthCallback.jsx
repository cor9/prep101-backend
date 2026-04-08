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
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const redirect = params.get('redirect') || '/generate';

    const run = async () => {
      if (token) {
        try {
          await loginWithToken(token);
          if (active) navigate(redirect, { replace: true });
        } catch (_) {
          if (active) {
            const callbackUrl = `${window.location.origin}/auth-callback?redirect=${encodeURIComponent(redirect)}`;
            window.location.href = `https://prep101.site/auth-bridge?redirect=${encodeURIComponent(callbackUrl)}`;
          }
        }
      } else {
        const callbackUrl = `${window.location.origin}/auth-callback?redirect=${encodeURIComponent(redirect)}`;
        window.location.href = `https://prep101.site/auth-bridge?redirect=${encodeURIComponent(callbackUrl)}`;
      }
    };

    run();
    return () => { active = false; };
  }, [loginWithToken, navigate]);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0a0a0f', color: 'rgba(240,238,245,0.6)', fontFamily: 'DM Sans, sans-serif'
    }}>
      <p>Signing you in…</p>
    </div>
  );
}
