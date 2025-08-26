import React, { createContext, useContext, useState } from 'react';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  const login = async () => {
    // Just fake success
    const fakeUser = {
      id: 1,
      name: 'Test User',
      email: 'test@test.com',
      subscription: 'free',
      guidesUsed: 0,
      guidesLimit: 3
    };
    setUser(fakeUser);
    return fakeUser;
  };

  const register = async () => {
    const fakeUser = {
      id: 1,
      name: 'Test User',
      email: 'test@test.com',
      subscription: 'free',
      guidesUsed: 0,
      guidesLimit: 3
    };
    setUser(fakeUser);
    return fakeUser;
  };

  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading: false }}>
      {children}
    </AuthContext.Provider>
  );
};
