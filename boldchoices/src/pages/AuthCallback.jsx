import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import API_BASE from '../config/api.js';

/**
 * AuthCallback — legacy compatibility route for old tokenized ecosystem links.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const { loginWithToken, loading, user } = useAuth();

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const redirect = params.get('redirect') || '/generate';

    const run = async () => {
      if (!token && loading) {
        return;
      }

      if (user) {
        navigate(redirect, { replace: true });
        return;
      }

      if (token) {
        try {
          await loginWithToken(token);
          if (active) navigate(redirect, { replace: true });
        } catch (_) {
          if (active) navigate(`/login?next=${encodeURIComponent(redirect)}`, { replace: true });
        }
      } else {
        try {
          const verifyResponse = await fetch(`${API_BASE}/api/auth/verify`, {
            credentials: 'include',
          });
          const verifyData = await verifyResponse.json();
          if (verifyResponse.ok && verifyData.valid && verifyData.user) {
            navigate(redirect, { replace: true });
            return;
          }
        } catch (_) {}

        if (active) navigate(`/login?next=${encodeURIComponent(redirect)}`, { replace: true });
      }
    };

    run();
    return () => { active = false; };
  }, [loading, loginWithToken, navigate, user]);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0a0a0f', color: 'rgba(240,238,245,0.6)', fontFamily: 'DM Sans, sans-serif'
    }}>
      <p>Signing you in…</p>
    </div>
  );
}
