
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

  const refreshAuth = async (isRetry = false) => {
    let timeoutId: any;
    try {
      // Safety timeout for refreshAuth
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Refresh auth timeout')), 15000);
      });

      const currentUser = await Promise.race([
        api.getCurrentUser(),
        timeoutPromise
      ]) as CurrentUser;

      setUser(currentUser);
    } catch (e) {
      console.error('Refresh auth failed:', e);
      
      // If it's a timeout and we haven't retried yet, try one more time
      if (e instanceof Error && e.message === 'Refresh auth timeout' && !isRetry) {
        console.log('Retrying auth refresh...');
        if (timeoutId) clearTimeout(timeoutId);
        return refreshAuth(true);
      }

      // If we already have a user (e.g. from Login page), don't clear it on timeout
      if (e instanceof Error && e.message === 'Refresh auth timeout') {
        // Just log and continue, don't clear user
      } else {
        setUser(null);
      }
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    let authTimeout: any;

    const initAuth = async () => {
      try {
        // Safety timeout: if auth doesn't resolve in 20 seconds, stop loading
        authTimeout = setTimeout(() => {
          if (mounted) {
            console.warn('Auth initialization timed out');
            setLoading(false);
          }
        }, 20000);

        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Session error:', error);
          if (mounted) setLoading(false);
          return;
        }

        if (session && mounted) {
          await refreshAuth();
        } else if (mounted) {
          setLoading(false);
        }
      } catch (e) {
        console.error('Auth init exception:', e);
        if (mounted) setLoading(false);
      } finally {
        if (authTimeout) clearTimeout(authTimeout);
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
      } else if (event === 'INITIAL_SESSION') {
        if (!session && mounted) setLoading(false);
      }
    });

    return () => {
      mounted = false;
      if (authTimeout) clearTimeout(authTimeout);
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refreshAuth, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};
