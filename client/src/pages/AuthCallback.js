import React, { useEffect } from 'react';
import API_BASE from '../config/api';

export default function AuthCallback() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const redirect = params.get('redirect') || '/dashboard';

    const finish = async () => {
      if (token && token !== 'null') {
        // Persist token to localStorage immediately so it's available 
        // even if the cookie-based session call fails or is blocked
        try {
          localStorage.setItem('ca101_token', token);
          console.log('✅ Token persisted to localStorage');
        } catch (e) {
          console.warn('⚠️ Failed to persist token to localStorage', e);
        }

        try {
          const res = await fetch(`${API_BASE}/api/auth/session`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ token }),
          });
          
          if (!res.ok) {
            console.error('❌ Session creation failed:', res.status);
          }
        } catch (err) {
          console.error('❌ Auth session fetch error:', err);
        }
      }

      window.location.replace(redirect);
    };

    finish();
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#111827',
      color: '#f3f4f6',
      fontFamily: 'Inter, sans-serif'
    }}>
      <p>Opening your Child Actor 101 account…</p>
    </div>
  );
}
