import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { signIn, signUp, signOut, getCurrentUser } from '../utils/supabase';
import API_BASE from '../config/api';
import { withApiCredentials } from '../utils/apiAuth';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
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
        persistUser({
          ...data.user,
          accessToken: data.session?.access_token,
          token: data.session?.access_token
        });
      }
      return data.user;
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
        persistUser({
          ...data.user,
          accessToken: data.session?.access_token,
          token: data.session?.access_token
        });
      }
      return data.user;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  };

  const logout = async () => {
    console.log('AuthContext: logout called');
    try {
      const { error } = await signOut();
      if (error) {
        console.error('Logout error:', error);
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
    setUser(null);
    console.log('✅ User logged out, state cleared');
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
