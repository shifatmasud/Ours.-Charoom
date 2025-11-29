
import React from 'react';
import { HashRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { Feed } from './components/Section/Feed';
import { Nav } from './components/Package/Nav';
import { ChatWindow } from './components/Section/ChatWindow';
import { MessagesList } from './components/Section/MessagesList';
import { Profile } from './components/Page/Profile';
import { Login } from './components/Page/Login';
import { LiveCall } from './components/Page/LiveCall';
import { GroupCall } from './components/Page/GroupCall';
import { PostDetail } from './components/Page/PostDetail';
import { theme } from './Theme';
import { ThemeProvider } from './ThemeContext';
import { AnimatePresence } from 'framer-motion';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CircleNotch } from '@phosphor-icons/react';

// --- Auth Guard ---
const RequireAuth = ({ children }: { children?: React.ReactNode }) => {
    const { user, loading } = useAuth();
    
    if (loading) {
        return (
            <div style={{ height: '100vh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: theme.colors.surface1 }}>
                <CircleNotch size={32} className="animate-spin" color={theme.colors.accent} />
            </div>
        );
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
        <Route path="/live" element={<RequireAuth><LiveCall /></RequireAuth>} />
        <Route path="/call/:roomId" element={<RequireAuth><GroupCall /></RequireAuth>} />
      </Routes>
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
      <AnimatedRoutes />
      {/* Only show Nav if logged in and not on login page (handled by Nav internal check mostly, but safer here too) */}
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