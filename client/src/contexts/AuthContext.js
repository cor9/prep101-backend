import React, { createContext, useContext, useState } from 'react';
import API_BASE from '../config/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  // Debug logging
  console.log('AuthContext: user state is:', user);

  const login = async (email, password) => {
    console.log('AuthContext: login called with:', email, password);
    
    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error('Login failed');
      }

      const data = await response.json();
      const realUser = {
        ...data.user,
        accessToken: data.token
      };
      
      setUser(realUser);
      console.log('AuthContext: user set to:', realUser);
      return realUser;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const register = async (email, password, name) => {
    console.log('AuthContext: register called with:', email, password, name);
    
    try {
      const response = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, name }),
      });

      if (!response.ok) {
        throw new Error('Registration failed');
      }

      const data = await response.json();
      const realUser = {
        ...data.user,
        accessToken: data.token
      };
      
      setUser(realUser);
      console.log('AuthContext: user set to:', realUser);
      return realUser;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  };

  const logout = () => {
    console.log('AuthContext: logout called');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading: false }}>
      {children}
    </AuthContext.Provider>
  );
};
