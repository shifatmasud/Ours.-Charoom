
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
    const hasCache = !!localStorage.getItem('auth_user');
    console.log('Auth: Initial loading state:', !hasCache);
    return !hasCache;
  });

  const updateUserInfo = (newUser: CurrentUser | null) => {
    console.log('Auth: Updating user info:', newUser?.id || 'null');
    setUser(newUser);
    if (newUser) {
      localStorage.setItem('auth_user', JSON.stringify(newUser));
    } else {
      localStorage.removeItem('auth_user');
    }
  };

  const refreshAuth = async (isRetry = false) => {
    console.log('Auth: Refreshing auth...');
    let timeoutId: any;
    try {
      // 5s safety timeout - will not throw, just resolve null to allow app to continue
      const timeoutPromise = new Promise((resolve) => {
        timeoutId = setTimeout(() => {
          console.warn('Auth: Refresh auth timed out (5s), using cached data');
          resolve(null);
        }, 5000);
      });

      const currentUser = await Promise.race([
        api.getCurrentUser(),
        timeoutPromise
      ]) as CurrentUser | null;

      if (currentUser) {
        updateUserInfo(currentUser);
      }
    } catch (e) {
      console.error('Auth: Refresh auth failed with error:', e);
      // Only clear user on explicit auth errors (e.g. 401 Unauthorized)
      // If it's a network error, we keep the cached user
      if (e instanceof Error && (e.message.includes('401') || e.message.includes('unauthorized'))) {
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
      console.log('Auth: Initializing...');
      try {
        // Safety timeout: if auth doesn't resolve in 5 seconds, stop loading
        authTimeout = setTimeout(() => {
          if (mounted) {
            console.warn('Auth: Initialization timed out');
            setLoading(false);
          }
        }, 5000);

        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Auth: Session error:', error);
          if (mounted) setLoading(false);
          return;
        }

        if (session && mounted) {
          console.log('Auth: Session found, refreshing profile...');
          await refreshAuth();
        } else if (mounted) {
          console.log('Auth: No session found');
          updateUserInfo(null);
          setLoading(false);
        }
      } catch (e) {
        console.error('Auth: Init exception:', e);
        if (mounted) setLoading(false);
      } finally {
        if (authTimeout) clearTimeout(authTimeout);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth: State change event:', event);
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (mounted) await refreshAuth();
      } else if (event === 'SIGNED_OUT') {
        if (mounted) {
          updateUserInfo(null);
          setLoading(false);
        }
      } else if (event === 'INITIAL_SESSION') {
        // Only clear if we don't have a session AND we don't have a cached user
        // This prevents the optimistic UI from being wiped out by a slow INITIAL_SESSION
        if (!session && mounted) {
          const hasCache = !!localStorage.getItem('auth_user');
          if (!hasCache) {
            updateUserInfo(null);
            setLoading(false);
          }
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
