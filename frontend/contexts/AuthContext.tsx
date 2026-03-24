'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const API_URL = 'https://ceatmeuuhb.execute-api.us-east-1.amazonaws.com/dev';

interface User {
  id: string;
  email: string;
  name: string;
  subscription?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('auth_token');
    const savedUser = localStorage.getItem('auth_user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      const parsed: User = JSON.parse(savedUser);
      setUser(parsed);
      // Sync maestro workspace keys
      if (!localStorage.getItem('token')) {
        localStorage.setItem('token', savedToken);
        localStorage.setItem('email', parsed.email);
        localStorage.setItem('plan_type', parsed.subscription || 'gratuito');
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Error al iniciar sesión');
    }
    const user: User = {
      id: data.email,
      email: data.email,
      name: data.nombre,
      subscription: data.plan_type,
    };
    setToken(data.token);
    setUser(user);
    localStorage.setItem('auth_token', data.token);
    localStorage.setItem('auth_user', JSON.stringify(user));
    // Also set keys used by maestro workspace
    localStorage.setItem('token', data.token);
    localStorage.setItem('email', data.email);
    localStorage.setItem('plan_type', data.plan_type || 'gratuito');
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'register', email, password, nombre: name }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Error al registrarse');
    }
    const user: User = {
      id: data.email,
      email: data.email,
      name: data.nombre,
      subscription: data.plan_type,
    };
    setToken(data.token);
    setUser(user);
    localStorage.setItem('auth_token', data.token);
    localStorage.setItem('auth_user', JSON.stringify(user));
    // Also set keys used by maestro workspace
    localStorage.setItem('token', data.token);
    localStorage.setItem('email', data.email);
    localStorage.setItem('plan_type', data.plan_type || 'gratuito');
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('token');
    localStorage.removeItem('email');
    localStorage.removeItem('plan_type');
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
