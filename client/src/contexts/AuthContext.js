import React, { createContext, useContext, useState } from 'react';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  // Debug logging
  console.log('AuthContext: user state is:', user);

  const login = async (email, password) => {
    console.log('AuthContext: login called with:', email, password);
    // This should be a real login function that requires actual credentials
    // For now, return null to prevent automatic login
    return null;
  };

  const register = async (email, password, name) => {
    console.log('AuthContext: register called with:', email, password, name);
    // This should be a real registration function that requires actual user input
    // For now, return null to prevent automatic registration
    return null;
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
