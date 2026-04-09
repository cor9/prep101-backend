import React, { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

/**
 * AuthBridge — legacy Prep101 route that preserves old redirect links.
 * URL: /auth-bridge?redirect=https://boldchoices.site/auth-callback
 *
 * If logged in: forwards directly to the destination.
 * If not logged in: sends user to /login and returns here after.
 */
export default function AuthBridge() {
  const { user } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get('redirect');

    if (!redirect) {
      window.location.href = '/';
      return;
    }

    if (user) {
      window.location.href = redirect;
    } else {
      // Not logged in — bounce to login, come back here after
      const returnUrl = encodeURIComponent(window.location.href);
      window.location.href = `/login?next=${returnUrl}`;
    }
  }, [user]);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0f172a', color: 'rgba(226,232,240,0.5)', fontFamily: 'Inter, sans-serif'
    }}>
      <p>Connecting your account…</p>
    </div>
  );
}
