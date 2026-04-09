import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import API_BASE from '../config/api.js';
import { withApiCredentials } from '../utils/apiAuth.js';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const syncActiveActorCache = useCallback((nextUser) => {
    const activeActorId =
      nextUser?.account?.activeActor?.id ||
      nextUser?.account?.profile?.activeActorId ||
      null;

    if (activeActorId) {
      localStorage.setItem('active_actor_id', activeActorId);
    } else {
      localStorage.removeItem('active_actor_id');
    }
  }, []);

  const persistUser = useCallback((nextUser) => {
    if (nextUser) {
      syncActiveActorCache(nextUser);
      setUser(nextUser);
    } else {
      localStorage.removeItem('active_actor_id');
      setUser(null);
    }
    return nextUser;
  }, [syncActiveActorCache]);

  const hydrateUserFromToken = useCallback(async (token) => {
    const exchangeResponse = await fetch(`${API_BASE}/api/auth/session`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });

    if (!exchangeResponse.ok) {
      throw new Error('Session exchange failed');
    }

    const verifyResponse = await fetch(`${API_BASE}/api/auth/verify`, withApiCredentials());
    if (!verifyResponse.ok) {
      throw new Error('Session expired');
    }

    const data = await verifyResponse.json();
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
        const res = await fetch(`${API_BASE}/api/auth/verify`, withApiCredentials());
        if (!res.ok) {
          persistUser(null);
          return;
        }

        const data = await res.json();
        if (data.valid && data.user) {
          persistUser(data.user);
          return;
        }
        persistUser(null);
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
      credentials: 'include',
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
      credentials: 'include',
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

  const logout = async () => {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (_) {}
    persistUser(null);
  };

  // Called by AuthCallback when receiving a token from prep101.site bridge
  const loginWithToken = async (token) => {
    const u = await hydrateUserFromToken(token);
    persistUser(u);
    return u;
  };

  const selectActor = async (actorId) => {
    const res = await fetch(`${API_BASE}/api/auth/select-actor`, {
      method: 'POST',
      ...withApiCredentials({
        headers: {
        'Content-Type': 'application/json',
      }}, user),
      body: JSON.stringify({ actorId }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to switch actor');

    persistUser(data.user);
    return data.user;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, loginWithToken, selectActor }}>
      {children}
    </AuthContext.Provider>
  );
}
