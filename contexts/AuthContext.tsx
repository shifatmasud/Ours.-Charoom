
import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, supabase } from '../services/supabaseClient';
import { CurrentUser } from '../types';

interface AuthContextType {
  user: CurrentUser | null;
  loading: boolean;
  refreshAuth: () => Promise<void>;
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

  const refreshAuth = async () => {
    try {
      const currentUser = await api.getCurrentUser();
      setUser(currentUser);
    } catch (e) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && mounted) {
           await refreshAuth();
        } else if (mounted) {
           setLoading(false);
        }
      } catch (e) {
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
         if (mounted) await refreshAuth();
      } else if (event === 'SIGNED_OUT') {
         if (mounted) {
           setUser(null);
           setLoading(false);
         }
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
