
import React, { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { Feed } from './components/Section/Feed';
import { Nav } from './components/Package/Nav';
import { ChatWindow } from './components/Section/ChatWindow';
import { MessagesList } from './components/Section/MessagesList';
import { Profile } from './components/Page/Profile';
import { Login } from './components/Page/Login';
import { Activity } from './components/Page/Activity';
import { DirectCall } from './components/Page/DirectCall';
import { PostDetail } from './components/Page/PostDetail';
import { theme } from './Theme';
import { ThemeProvider } from './ThemeContext';
import { AnimatePresence, motion } from 'framer-motion';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Loader } from './components/Core/Loader';
import { api, supabase } from './services/supabaseClient';
import { DS } from './Theme';

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
      <motion.div 
        key={location.pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        style={{ width: '100%', height: '100%' }}
      >
        <Routes location={location}>
          <Route path="/login" element={<Login />} />
          
          {/* Protected Routes */}
          <Route path="/" element={<RequireAuth><Feed /></RequireAuth>} />
          <Route path="/profile/:userId" element={<RequireAuth><Profile /></RequireAuth>} />
          <Route path="/post/:postId" element={<RequireAuth><PostDetail /></RequireAuth>} />
          <Route path="/messages" element={<RequireAuth><MessagesList /></RequireAuth>} />
          <Route path="/messages/:friendId" element={<RequireAuth><ChatWindow /></RequireAuth>} />
          <Route path="/call/:roomId" element={<RequireAuth><DirectCall /></RequireAuth>} />
          <Route path="/activity" element={<RequireAuth><Activity /></RequireAuth>} />
        </Routes>
      </motion.div>
  );
};

const NotificationContainer = () => {
    const { user } = useAuth();
    const [toast, setToast] = useState<{ message: string, visible: boolean } | null>(null);

    useEffect(() => {
        if(!user) return;
        
        // Use global channel for all platform activities
        const channel = supabase.channel('global_activities')
            // 1. Instant Delivery via Broadcast
            .on('broadcast', { event: 'activity' }, payload => {
                console.log("App: Global broadcast activity received", payload);
                const { type, sender_profile, receiver_profile, user_id } = payload.payload || {};
                
                const senderName = sender_profile?.username || 'Someone';
                const receiverName = user_id === user.id ? 'your' : `${receiver_profile?.username}'s`;
                const receiverNameFollow = user_id === user.id ? 'you' : receiver_profile?.username;

                let msg = "";
                if(type === 'like') msg = `${senderName} liked ${receiverName} moment`;
                if(type === 'comment') msg = `${senderName} commented on ${receiverName} moment`;
                if(type === 'follow') msg = `${senderName} started following ${receiverNameFollow}`;
                
                if (msg) {
                    setToast({ message: msg, visible: true });
                    setTimeout(() => setToast(null), 3000);
                }
            })
            // 2. Consistency via Postgres Changes (DB sync)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, async (payload) => {
                console.log("App: Global DB notification received", payload);
                
                // Fetch profiles for the toast if broadcast was missed
                const { data: notif } = await supabase
                    .from('notifications')
                    .select('*, sender_profile:profiles!sender_id(*), receiver_profile:profiles!user_id(*)')
                    .eq('id', payload.new.id)
                    .single();

                if (notif) {
                    const senderName = notif.sender_profile?.username || 'Someone';
                    const receiverName = notif.user_id === user.id ? 'your' : `${notif.receiver_profile?.username}'s`;
                    const receiverNameFollow = notif.user_id === user.id ? 'you' : notif.receiver_profile?.username;

                    let msg = "";
                    if(notif.type === 'like') msg = `${senderName} liked ${receiverName} moment`;
                    if(notif.type === 'comment') msg = `${senderName} commented on ${receiverName} moment`;
                    if(notif.type === 'follow') msg = `${senderName} started following ${receiverNameFollow}`;

                    if (msg) {
                        setToast({ message: msg, visible: true });
                        setTimeout(() => setToast(null), 3000);
                    }
                }
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

const ConnectionErrorBanner = () => {
    const { connectionError, refreshAuth } = useAuth();
    const [retrying, setRetrying] = useState(false);
    
    const handleRetry = async () => {
        setRetrying(true);
        try {
            await refreshAuth();
        } finally {
            setRetrying(false);
        }
    };

    const handleTryDemo = () => {
        localStorage.setItem('supabase_mock_mode', 'true');
        window.location.reload();
    };

    const isDefaultUrlError = connectionError?.includes('default Supabase project');

    return (
        <AnimatePresence>
            {connectionError && (
                <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    style={{ 
                        background: '#ef4444', 
                        color: 'white', 
                        padding: '12px 16px', 
                        fontSize: '12px', 
                        textAlign: 'center',
                        fontWeight: 500,
                        position: 'sticky',
                        top: 0,
                        zIndex: 10000,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span role="img" aria-label="warning">⚠️</span>
                        {connectionError}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                            onClick={handleRetry}
                            disabled={retrying}
                            style={{
                                background: 'rgba(255,255,255,0.2)',
                                border: '1px solid rgba(255,255,255,0.4)',
                                color: 'white',
                                padding: '4px 12px',
                                borderRadius: '4px',
                                fontSize: '10px',
                                cursor: 'pointer',
                                textTransform: 'uppercase',
                                fontWeight: 700
                            }}
                        >
                            {retrying ? 'Retrying...' : 'Retry'}
                        </button>
                        {isDefaultUrlError && (
                            <button 
                                onClick={handleTryDemo}
                                style={{
                                    background: 'white',
                                    border: 'none',
                                    color: '#ef4444',
                                    padding: '4px 12px',
                                    borderRadius: '4px',
                                    fontSize: '10px',
                                    cursor: 'pointer',
                                    textTransform: 'uppercase',
                                    fontWeight: 700
                                }}
                            >
                                Try Demo Mode
                            </button>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

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
      <ConnectionErrorBanner />
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
