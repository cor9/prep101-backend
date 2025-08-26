import React, { createContext, useContext, useState } from 'react';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  // Debug logging
  console.log('AuthContext: user state is:', user);

  const login = async (email, password) => {
    console.log('AuthContext: login called with:', email, password);
    
    // For now, create a fake user for demo purposes
    // In production, this would call your backend API
    const fakeUser = {
      id: 1,
      name: 'Demo User',
      email: email,
      subscription: 'free',
      guidesUsed: 0,
      guidesLimit: 3
    };
    
    setUser(fakeUser);
    console.log('AuthContext: user set to:', fakeUser);
    return fakeUser;
  };

  const register = async (email, password, name) => {
    console.log('AuthContext: register called with:', email, password, name);
    
    // For now, create a fake user for demo purposes
    // In production, this would call your backend API
    const fakeUser = {
      id: 1,
      name: name || 'Demo User',
      email: email,
      subscription: 'free',
      guidesUsed: 0,
      guidesLimit: 3
    };
    
    setUser(fakeUser);
    console.log('AuthContext: user set to:', fakeUser);
    return fakeUser;
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
