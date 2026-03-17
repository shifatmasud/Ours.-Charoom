
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
  const [user, setUser] = useState<CurrentUser | null>(() => {
    // Optimistic hydration from localStorage
    try {
      const savedUser = localStorage.getItem('auth_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (e) {
      return null;
    }
  });
  const [loading, setLoading] = useState(() => {
    // If we have a cached user, we can skip the initial full-screen loader
    return !localStorage.getItem('auth_user');
  });

  const updateUserInfo = (newUser: CurrentUser | null) => {
    setUser(newUser);
    if (newUser) {
      localStorage.setItem('auth_user', JSON.stringify(newUser));
    } else {
      localStorage.removeItem('auth_user');
    }
  };

  const refreshAuth = async (isRetry = false) => {
    let timeoutId: any;
    try {
      // Increased safety timeout for refreshAuth to 30s
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Refresh auth timeout')), 30000);
      });

      const currentUser = await Promise.race([
        api.getCurrentUser(),
        timeoutPromise
      ]) as CurrentUser;

      updateUserInfo(currentUser);
    } catch (e) {
      console.error('Refresh auth failed:', e);
      
      // If it's a timeout and we haven't retried yet, try one more time
      if (e instanceof Error && e.message === 'Refresh auth timeout' && !isRetry) {
        console.log('Retrying auth refresh...');
        if (timeoutId) clearTimeout(timeoutId);
        return refreshAuth(true);
      }

      // If we already have a user (e.g. from localStorage or Login), don't clear it on timeout
      // This prevents the app from logging the user out just because of a slow network
      if (e instanceof Error && (e.message === 'Refresh auth timeout' || e.message.includes('timeout'))) {
        console.warn('Auth refresh timed out, keeping existing session if available');
      } else {
        // Only clear user on explicit auth errors (401, etc)
        updateUserInfo(null);
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
          updateUserInfo(null);
          setLoading(false);
        }
      } else if (event === 'INITIAL_SESSION') {
        if (!session && mounted) {
          updateUserInfo(null);
          setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      if (authTimeout) clearTimeout(authTimeout);
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refreshAuth, setUser: updateUserInfo }}>
      {children}
    </AuthContext.Provider>
  );
};
