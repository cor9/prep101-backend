import React, { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

/**
 * AuthBridge — Prep101 route that hands a short-lived auth token to another ecosystem site.
 * URL: /auth-bridge?redirect=https://boldchoices.site/auth-callback
 *
 * If logged in: appends ?token=JWT to the redirect URL.
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

    if (user?.accessToken || user?.token) {
      const token = user.accessToken || user.token;
      if (token && token !== "null" && token !== "undefined") {
        const sep = redirect.includes('?') ? '&' : '?';
        window.location.href = `${redirect}${sep}token=${encodeURIComponent(token)}`;
        return;
      }
    }
    
    // Not logged in (or token invalid) — bounce to login, come back here after
    const returnUrl = encodeURIComponent(window.location.href);
    window.location.href = `/login?next=${returnUrl}`;
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
