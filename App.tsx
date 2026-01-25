
import React, { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { Feed } from './components/Section/Feed';
import { Nav } from './components/Package/Nav';
import { ChatWindow } from './components/Section/ChatWindow';
import { MessagesList } from './components/Section/MessagesList';
import { Profile } from './components/Page/Profile';
import { Login } from './components/Page/Login';
import { Activity } from './components/Page/Activity';
import { GroupCall } from './components/Page/GroupCall';
import { PostDetail } from './components/Page/PostDetail';
import { theme } from './Theme';
import { ThemeProvider } from './ThemeContext';
import { AnimatePresence, motion } from 'framer-motion';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Loader } from './components/Core/Loader';
import { api, supabase } from './services/supabaseClient';
import { DS } from './Theme';
import { LiveCall } from './components/Page/LiveCall';

// --- Auth Guard ---
const RequireAuth = ({ children }: { children?: React.ReactNode }) => {
    const { user, loading } = useAuth();
    
    if (loading) {
        return <Loader fullscreen label="AUTHENTICATING" />;
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return <>{children}</>;
};

const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={<Login />} />
        
        {/* Protected Routes */}
        <Route path="/" element={<RequireAuth><Feed /></RequireAuth>} />
        <Route path="/profile/:userId" element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="/post/:postId" element={<RequireAuth><PostDetail /></RequireAuth>} />
        <Route path="/messages" element={<RequireAuth><MessagesList /></RequireAuth>} />
        <Route path="/messages/:friendId" element={<RequireAuth><ChatWindow /></RequireAuth>} />
        <Route path="/call/:roomId" element={<RequireAuth><GroupCall /></RequireAuth>} />
        <Route path="/live" element={<RequireAuth><LiveCall /></RequireAuth>} />
        <Route path="/activity" element={<RequireAuth><Activity /></RequireAuth>} />
      </Routes>
    </AnimatePresence>
  );
};

const NotificationContainer = () => {
    const { user } = useAuth();
    const [toast, setToast] = useState<{ message: string, visible: boolean } | null>(null);

    useEffect(() => {
        if(!user) return;
        const channel = supabase.channel('global_notif_listener')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, payload => {
                const type = payload.new.type;
                let msg = "New notification";
                if(type === 'like') msg = "Someone liked your moment";
                if(type === 'comment') msg = "New comment on your moment";
                if(type === 'follow') msg = "You have a new follower";
                
                setToast({ message: msg, visible: true });
                setTimeout(() => setToast(null), 3000);
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [user]);

    return (
        <AnimatePresence>
            {toast && (
                <motion.div 
                    initial={{ opacity: 0, y: -20, x: '-50%' }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    style={{ 
                        position: 'fixed', top: '24px', left: '50%', transform: 'translateX(-50%)', 
                        background: DS.Color.Accent.Surface, color: 'white', padding: '12px 24px', 
                        borderRadius: DS.Radius.Full, boxShadow: DS.Effect.Shadow.Soft, zIndex: 9999,
                        fontWeight: 600, fontSize: '14px'
                    }}
                >
                    {toast.message}
                </motion.div>
            )}
        </AnimatePresence>
    )
}

const AppLayout: React.FC = () => {
  const { user } = useAuth();
  
  return (
    <div style={{ 
      fontFamily: theme.fonts.body, 
      color: theme.colors.text1, 
      background: theme.colors.surface1, 
      minHeight: '100vh', 
      width: '100%',
      position: 'relative',
      overflowX: 'hidden',
      transition: 'background-color 0.6s cubic-bezier(0.22, 1, 0.36, 1), color 0.6s cubic-bezier(0.22, 1, 0.36, 1)'
    }}>
      <NotificationContainer />
      <AnimatedRoutes />
      {/* Only show Nav if logged in and not on login page */}
      {user && <Nav />}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <AppLayout />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
