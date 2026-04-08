import React, { useEffect } from 'react';

export default function AuthCallback() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const redirect = params.get('redirect') || '/dashboard';

    if (token) {
      localStorage.setItem('prep101_token', token);
      localStorage.removeItem('prep101_user');
    }

    window.location.replace(redirect);
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
