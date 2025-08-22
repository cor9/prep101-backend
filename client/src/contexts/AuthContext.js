import React, { createContext, useContext, useState } from 'react';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState({
    id: 1,
    name: 'Test User',
    email: 'test@test.com',
    subscription: 'free',
    guidesUsed: 0,
    guidesLimit: 3
  });

  const login = async () => {
    // Just fake success
    return user;
  };

  const register = async () => {
    return user;
  };

  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading: false }}>
      {children}
    </AuthContext.Provider>
  );
};
