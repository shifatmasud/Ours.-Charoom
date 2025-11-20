
import React from 'react';
import { HashRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { Feed } from './components/Section/Feed';
import { Nav } from './components/Package/Nav';
import { ChatWindow } from './components/Section/ChatWindow';
import { MessagesList } from './components/Section/MessagesList';
import { Profile } from './components/Page/Profile';
import { Login } from './components/Page/Login';
import { LiveCall } from './components/Page/LiveCall';
import { GroupCall } from './components/Page/GroupCall';
import { theme } from './Theme';
import { ThemeProvider } from './ThemeContext';
import { AnimatePresence } from 'framer-motion';

const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Feed />} />
        <Route path="/profile/:userId" element={<Profile />} />
        <Route path="/messages" element={<MessagesList />} />
        <Route path="/messages/:friendId" element={<ChatWindow />} />
        <Route path="/live" element={<LiveCall />} />
        <Route path="/call/:roomId" element={<GroupCall />} />
      </Routes>
    </AnimatePresence>
  );
};

const AppLayout: React.FC = () => {
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
      <Nav />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <Router>
        <AppLayout />
      </Router>
    </ThemeProvider>
  );
};

export default App;
