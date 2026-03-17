
import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, supabase } from '../services/supabaseClient';
import { CurrentUser } from '../types';

interface AuthContextType {
  user: CurrentUser | null;
  loading: boolean;
  refreshAuth: (sessionUser?: any) => Promise<void>;
  setUser: (user: CurrentUser | null) => void;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  loading: true,
  refreshAuth: async () => {},
  setUser: () => {}
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshAuth = async (sessionUser?: any) => {
    try {
      const currentUser = await api.getCurrentUser(sessionUser);
      setUser(currentUser);
    } catch (e) {
      console.error("Failed to refresh auth:", e);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
         if (session) {
            await refreshAuth(session.user);
         } else {
            setUser(null);
            setLoading(false);
         }
      } else if (event === 'SIGNED_OUT') {
         setUser(null);
         setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refreshAuth, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};
