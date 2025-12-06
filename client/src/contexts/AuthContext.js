import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, signIn, signUp, signOut, getCurrentUser } from '../utils/supabase';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const mapSessionToUser = (session) => {
    if (!session || !session.user) return null;
    const email = session.user.email || '';
    const derivedName =
      session.user.user_metadata?.full_name ||
      session.user.user_metadata?.name ||
      (email ? email.split('@')[0] : 'Prep101 Actor');

    return {
      ...session.user,
      name: derivedName,
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      token: session.access_token
    };
  };

  // Load user on mount and listen for auth changes
  useEffect(() => {
    const loadUser = async () => {
      try {
        const { user: currentUser, error } = await getCurrentUser();
        if (error) {
          console.error('Error loading user:', error);
        } else {
          setUser(currentUser);
        }
      } catch (error) {
        console.error('Error in loadUser:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        setUser(mapSessionToUser(session));
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email, password) => {
    console.log('AuthContext: login called with:', email);

    try {
      const { data, error } = await signIn(email, password);
      if (error) {
        throw new Error(error.message);
      }

      console.log('✅ User logged in via Supabase');
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

      console.log('✅ User registered via Supabase');
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
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
