
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
import { NotificationProvider, useNotifications } from './contexts/NotificationContext';
import { ModalProvider } from './contexts/ModalContext';
import { Loader } from './components/Core/Loader';
import ReactDOM from 'react-dom';
import { Post, CurrentUser, Notification } from './types';
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
          {/* Public Routes */}
          <Route path="/" element={<Feed />} />
          <Route path="/login" element={<Login />} />
          
          {/* Protected Routes */}
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
    const { lastActivity } = useNotifications();
    const [toast, setToast] = useState<{ message: string, visible: boolean, icon?: React.ReactNode, mediaUrl?: string } | null>(null);

    useEffect(() => {
        if (!lastActivity) return;
        
        const { type, sender_profile, receiver_profile, user_id, sender_id, media_url } = lastActivity;
        
        // Skip toast for own actions to avoid self-spam
        if (user && sender_id === user.id) return;

        const senderName = sender_profile?.username || 'Someone';
        const receiverName = user && user_id === user.id ? 'your' : `${receiver_profile?.username || 'someone'}'s`;
        const receiverNameFollow = user && user_id === user.id ? 'you' : (receiver_profile?.username || 'someone');

        let msg = "";
        let icon = null;
        
        if(type === 'like') {
            msg = `${senderName} liked ${receiverName} moment`;
        }
        if(type === 'comment') {
            msg = `${senderName} commented on ${receiverName} moment`;
        }
        if(type === 'follow') {
            msg = `${senderName} started following ${receiverNameFollow}`;
        }
        if(type === 'message') {
            msg = `${senderName} sent a message`;
        }
        if(type === 'post') {
            msg = `${senderName} shared a new moment`;
        }
        if(type === 'call') {
            msg = `${senderName} started a call`;
        }
        
        if (msg) {
            setToast({ message: msg, visible: true, mediaUrl: media_url });
        }
    }, [lastActivity?.id, user?.id]);

    useEffect(() => {
        if (toast?.visible) {
            const timer = setTimeout(() => {
                setToast(prev => prev ? { ...prev, visible: false } : null);
                setTimeout(() => setToast(null), 500);
            }, 4000);
            return () => clearTimeout(timer);
        }
    }, [toast?.message, toast?.visible]);

    if (!toast) return null;

    return ReactDOM.createPortal(
        <AnimatePresence>
            {toast.visible && (
                <motion.div 
                    initial={{ opacity: 0, y: -100, x: '-50%', scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -100, scale: 0.9 }}
                    transition={DS.Motion.Spring.Gentle}
                    style={{ 
                        position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', 
                        background: DS.Color.Base.Surface[2], 
                        color: DS.Color.Base.Content[1], 
                        padding: '8px 8px 8px 16px', 
                        borderRadius: DS.Radius.Full, 
                        boxShadow: '0 20px 40px rgba(0,0,0,0.2)', 
                        zIndex: 100000,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        border: `1px solid ${DS.Color.Base.Border}`,
                        minWidth: '280px',
                        maxWidth: '90vw',
                        backdropFilter: 'blur(12px)',
                        WebkitBackdropFilter: 'blur(12px)'
                    }}
                >
                    <div style={{ flex: 1, fontSize: '13px', fontWeight: 600, letterSpacing: '-0.01em' }}>
                        {toast.message}
                    </div>
                    {toast.mediaUrl && (
                        <div style={{ width: '36px', height: '36px', borderRadius: DS.Radius.Full, overflow: 'hidden', flexShrink: 0, border: `1px solid ${DS.Color.Base.Border}` }}>
                            <img src={toast.mediaUrl} alt="context" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                    )}
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
}

const ConnectionErrorBanner = () => {
    const { connectionError, refreshAuth, setMockMode } = useAuth();
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
        setMockMode(true);
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

const DemoModeBanner = () => {
    const { isMockMode, setMockMode } = useAuth();
    
    if (!isMockMode) return null;

    return (
        <div style={{ 
            background: DS.Color.Accent.Surface, 
            color: 'white', 
            padding: '8px 16px', 
            fontSize: '11px', 
            textAlign: 'center',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
        }}>
            <span>🚀 Currently in Demo Mode (Mock Data)</span>
            <button 
                onClick={() => setMockMode(false)}
                style={{
                    background: 'white',
                    border: 'none',
                    color: DS.Color.Accent.Surface,
                    padding: '2px 10px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    cursor: 'pointer',
                    fontWeight: 700
                }}
            >
                Exit Demo Mode
            </button>
        </div>
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
      <DemoModeBanner />
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
        <NotificationProvider>
          <ModalProvider>
            <Router>
              <AppLayout />
            </Router>
          </ModalProvider>
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
