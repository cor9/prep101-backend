import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import API_BASE from '../config/api.js';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const persistUser = useCallback((nextUser) => {
    if (nextUser) {
      localStorage.setItem('bc_user', JSON.stringify(nextUser));
      if (nextUser.accessToken || nextUser.token) {
        localStorage.setItem('ca101_token', nextUser.accessToken || nextUser.token);
      }
      setUser(nextUser);
    } else {
      localStorage.removeItem('bc_user');
      localStorage.removeItem('ca101_token');
      setUser(null);
    }
    return nextUser;
  }, []);

  const hydrateUserFromToken = useCallback(async (token) => {
    const res = await fetch(`${API_BASE}/api/auth/verify`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error('Session expired');
    }

    const data = await res.json();
    if (!data.valid || !data.user) {
      throw new Error('Invalid session');
    }

    return {
      ...data.user,
      accessToken: token,
      token,
    };
  }, []);

  // Restore session from localStorage on mount
  useEffect(() => {
    const restore = async () => {
      try {
        const stored = localStorage.getItem('bc_user');
        if (!stored) return;

        const parsed = JSON.parse(stored);
        const storedToken = parsed?.accessToken || parsed?.token;
        if (!storedToken) {
          setUser(parsed);
          return;
        }

        const hydrated = await hydrateUserFromToken(storedToken);
        persistUser(hydrated);
      } catch (_) {
        persistUser(null);
      } finally {
        setLoading(false);
      }
    };

    restore();
  }, [hydrateUserFromToken, persistUser]);

  const login = async (email, password) => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Login failed');

    const u = {
      ...data.user,
      accessToken: data.token,
      token: data.token,
    };
    persistUser(u);
    return u;
  };

  const register = async (email, password, name) => {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Registration failed');

    // Auto-login after register if token returned
    if (data.token) {
      const u = { ...data.user, accessToken: data.token, token: data.token };
      persistUser(u);
      return u;
    }
    return data.user;
  };

  const logout = () => {
    persistUser(null);
  };

  // Called by AuthCallback when receiving a token from prep101.site bridge
  const loginWithToken = async (token) => {
    const u = await hydrateUserFromToken(token);
    persistUser(u);
    return u;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, loginWithToken }}>
      {children}
    </AuthContext.Provider>
  );
}
