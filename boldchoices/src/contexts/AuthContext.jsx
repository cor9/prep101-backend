import React, { createContext, useContext, useState, useEffect } from 'react';
import API_BASE from '../config/api.js';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('bc_user');
      if (stored) setUser(JSON.parse(stored));
    } catch (_) {}
    setLoading(false);
  }, []);

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
    setUser(u);
    localStorage.setItem('bc_user', JSON.stringify(u));
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
      setUser(u);
      localStorage.setItem('bc_user', JSON.stringify(u));
      return u;
    }
    return data.user;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('bc_user');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
