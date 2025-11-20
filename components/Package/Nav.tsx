
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { House, ChatCircleDots } from '@phosphor-icons/react';
import { theme } from '../../Theme';
import { motion } from 'framer-motion';

export const Nav: React.FC = () => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;
  
  // Hide on detail pages for immersion
  const isDetail = location.pathname.match(/^\/messages\/.+/) || location.pathname.match(/^\/post\/.+/) || location.pathname === '/login' || location.pathname === '/live';

  if (isDetail) return null;

  const dockContainerStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: '32px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 1000,
    display: 'flex',
    justifyContent: 'center',
    width: 'auto',
  };

  return (
    <div style={dockContainerStyle}>
      <motion.div 
        initial={{ y: 30, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, ...theme.motion.gentle }}
        style={{
          background: theme.colors.glass,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: theme.radius.full,
          padding: '6px 6px', // Tight padding
          display: 'flex',
          gap: '0px', // ZERO gap as requested for snug fit
          alignItems: 'center',
          boxShadow: theme.shadow.soft,
          border: `1px solid ${theme.colors.border}`
        }}
      >
        <DockItem to="/" icon={House} active={isActive('/')} label="Home" />
        <DockItem to="/messages" icon={ChatCircleDots} active={isActive('/messages')} label="Talks" />
      </motion.div>
    </div>
  );
};

const DockItem = ({ to, icon: Icon, active, label }: { to: string, icon: any, active: boolean, label: string }) => {
  return (
    <Link to={to} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
      <motion.div
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        transition={theme.motion.spring}
        style={{
          position: 'relative',
          color: active ? theme.colors.text1 : theme.colors.text3,
          background: active ? theme.colors.surface3 : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '56px', // Slightly wider for touch target
          height: '48px',
          borderRadius: theme.radius.full, // Pill shape for active state
          transition: 'background-color 0.4s ease, color 0.4s ease'
        }}
      >
        <Icon size={26} weight={active ? 'fill' : 'regular'} />
        
        {active && (
          <motion.div 
            layoutId="dock-indicator"
            transition={theme.motion.spring}
            style={{
              position: 'absolute',
              bottom: '6px',
              width: '4px',
              height: '4px',
              borderRadius: '50%',
              background: theme.colors.accent,
              boxShadow: `0 0 8px ${theme.colors.accent}`
            }}
          />
        )}
      </motion.div>
    </Link>
  );
};
