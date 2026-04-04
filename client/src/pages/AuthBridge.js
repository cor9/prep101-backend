import React, { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

/**
 * AuthBridge — Prep101 route that hands a JWT to another ecosystem site.
 * URL: /auth-bridge?redirect=https://boldchoices.site/auth-callback
 *
 * If logged in: appends ?token=JWT to the redirect URL.
 * If not logged in: saves redirect URL, sends user to /login.
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

    if (user?.accessToken || user?.token) {
      const token = user.accessToken || user.token;
      const sep = redirect.includes('?') ? '&' : '?';
      window.location.href = `${redirect}${sep}token=${encodeURIComponent(token)}`;
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
