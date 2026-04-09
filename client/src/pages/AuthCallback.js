import React, { useEffect } from 'react';
import API_BASE from '../config/api';

export default function AuthCallback() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const redirect = params.get('redirect') || '/dashboard';

    const finish = async () => {
      if (token) {
        try {
          await fetch(`${API_BASE}/api/auth/session`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ token }),
          });
        } catch (_) {}
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
