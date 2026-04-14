import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { signIn, signUp, signOut, getCurrentUser } from '../utils/supabase';
import API_BASE from '../config/api';
import { withApiCredentials } from '../utils/apiAuth';
import { buildReaderLogoutUrl } from '../utils/ecosystemLinks';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const AUTH_TOKEN_KEY = "ca101_token";

  const readStoredToken = useCallback(() => {
    try {
      return localStorage.getItem(AUTH_TOKEN_KEY) || null;
    } catch (_) {
      return null;
    }
  }, []);

  const writeStoredToken = useCallback((token) => {
    try {
      if (token) {
        localStorage.setItem(AUTH_TOKEN_KEY, token);
      } else {
        localStorage.removeItem(AUTH_TOKEN_KEY);
      }
    } catch (_) {}
  }, []);

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
      const authToken =
        nextUser?.accessToken ||
        nextUser?.token ||
        readStoredToken() ||
        null;
      const hydrated = authToken
        ? {
            ...nextUser,
            accessToken: authToken,
            token: authToken,
          }
        : nextUser;
      writeStoredToken(authToken);
      syncActiveActorCache(hydrated);
      setUser(hydrated);
      return hydrated;
    } else {
      localStorage.removeItem('active_actor_id');
      writeStoredToken(null);
      setUser(null);
      return null;
    }
  }, [syncActiveActorCache, readStoredToken, writeStoredToken]);

  const refreshUser = useCallback(async () => {
    const { user: currentUser, error } = await getCurrentUser();
    if (error) throw error;
    return persistUser(currentUser);
  }, [persistUser]);

  // Load user on mount
  useEffect(() => {
    const loadUser = async () => {
      try {
        console.log('AuthContext: Loading user...');
        const currentUser = await refreshUser();
        if (currentUser) {
          console.log('AuthContext: User loaded:', currentUser.email);
        }
      } catch (error) {
        console.error('Error in loadUser:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [refreshUser]);

  const login = async (email, password) => {
    console.log('AuthContext: login called with:', email);

    try {
      const { data, error } = await signIn(email, password);
      if (error) {
        throw new Error(error.message);
      }

      console.log('✅ User logged in successfully');
      // Update user state with the logged-in user
      if (data?.user) {
        writeStoredToken(data.session?.access_token || null);
        const hydratedUser = {
          ...data.user,
          accessToken: data.session?.access_token,
          token: data.session?.access_token
        };
        persistUser(hydratedUser);
        return hydratedUser;
      }
      return data?.user || null;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const register = async (email, password, name) => {
    console.log('AuthContext: register called with:', email, name);

    try {
      const { data, error } = await signUp(email, password, name);
      if (error) {
        throw new Error(error.message);
      }

      console.log('✅ User registered successfully');
      // Update user state with the registered user
      if (data?.user) {
        writeStoredToken(data.session?.access_token || null);
        const hydratedUser = {
          ...data.user,
          accessToken: data.session?.access_token,
          token: data.session?.access_token
        };
        persistUser(hydratedUser);
        return hydratedUser;
      }
      return data?.user || null;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  };

  const logout = async (options = {}) => {
    console.log('AuthContext: logout called');
    try {
      const { error } = await signOut();
      if (error) {
        console.error('Logout error:', error);
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
    persistUser(null);
    console.log('✅ User logged out, state cleared');

    if (typeof window !== 'undefined' && options.redirect !== false) {
      const nextUrl =
        options.nextUrl ||
        `${window.location.origin}/`;
      window.location.replace(buildReaderLogoutUrl(nextUrl));
    }
  };

  const completeOnboarding = async (payload) => {
    const res = await fetch(`${API_BASE}/api/auth/onboarding`, {
      method: 'POST',
      ...withApiCredentials({
        headers: {
        'Content-Type': 'application/json',
      }}, user),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to save onboarding');
    return persistUser(data.user);
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
    return persistUser(data.user);
  };

  const addActor = async (payload) => {
    const res = await fetch(`${API_BASE}/api/auth/add-actor`, {
      method: 'POST',
      ...withApiCredentials({
        headers: {
        'Content-Type': 'application/json',
      }}, user),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to add actor');
    return persistUser(data.user);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading, refreshUser, completeOnboarding, selectActor, addActor }}>
      {children}
    </AuthContext.Provider>
  );
};
