import React, { createContext, useContext, useState, useEffect } from 'react';
import { signIn, signUp, signOut, getCurrentUser } from '../utils/supabase';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load user on mount
  useEffect(() => {
    const loadUser = async () => {
      try {
        console.log('AuthContext: Loading user...');
        const { user: currentUser, error } = await getCurrentUser();
        if (error) {
          console.error('Error loading user:', error);
        } else {
          console.log('AuthContext: User loaded:', currentUser?.email || 'none');
          setUser(currentUser);
        }
      } catch (error) {
        console.error('Error in loadUser:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

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
        setUser({
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
        setUser({
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
    // Always clear user state regardless of errors
    setUser(null);
    console.log('✅ User logged out, state cleared');
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
